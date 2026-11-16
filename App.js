import React,{useEffect,useState} from 'react';
import {buildEvents} from './events';
import {I,LANGS,voiceOf} from './i18n';
import {View,Text,TextInput,TouchableOpacity,ScrollView,KeyboardAvoidingView,StatusBar,Alert,Platform,PermissionsAndroid,StyleSheet} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import BackgroundService from 'react-native-background-actions';
import {parsePlanning} from './parser';
import {weekStats,trendOf,midnightMessage} from './score';
import * as Notifications from 'expo-notifications';
import Svg,{Path,Defs,LinearGradient,Stop,Circle} from 'react-native-svg';

const pad=n=>String(n).padStart(2,'0');
const fmt=(d=new Date())=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toMs=(date,t)=>{const [y,m,d]=date.split('-').map(Number);const [h,mi,s]=t.split(':').map(Number);return new Date(y,m-1,d,h,mi,s||0).getTime();};
const normT=t=>{t=(t||'').trim();return t.length===5?t+':00':t;};
const okT=t=>/^\d{2}:\d{2}:\d{2}$/.test(t);
const said=t=>{const [h,m,s]=t.split(':').map(Number);return `${h} heures ${m} minutes ${s} secondes`;};
const load=async(k,d)=>{try{const v=await AsyncStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}};

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowAlert:true,shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
const notifyMidnight=async(tasks,m)=>{
  try{
    await Notifications.setNotificationChannelAsync('discipline',{name:'Niveau de discipline',importance:Notifications.AndroidImportance.HIGH,sound:null});
    const lg=((await load('settings',{}))||{}).lang||'fr';
    const y=new Date(m.getFullYear(),m.getMonth(),m.getDate()-1,12);
    await Notifications.scheduleNotificationAsync({content:{title:I[lg].level,body:midnightMessage(tasks,y,m.getTime(),lg),sound:false},trigger:{channelId:'discipline'}});
  }catch(e){}
};
// ---------- Moteur : service d'arrière-plan + alarmes exactes (notifications) qui réveillent l'app ----------
const spoken=new Set();
const speakOnce=async(id,text)=>{
  if(spoken.has(id))return;spoken.add(id);
  try{const st0=await load('settings',{});Speech.speak(text,{language:LANGS[st0.lang||'fr'].tts,voice:voiceOf(st0),rate:0.95});}catch(e){}
};
Notifications.addNotificationReceivedListener(n=>{const d=(n.request&&n.request.content&&n.request.content.data)||{};if(d.say)speakOnce(d.id,d.say);});
const scheduleAll=async(tasks,s)=>{
  try{
    await Notifications.cancelAllScheduledNotificationsAsync();
    if(!s||!s.name)return;
    await Notifications.setNotificationChannelAsync('discipline',{name:'Rappels Discipline',importance:Notifications.AndroidImportance.HIGH,sound:null});
    const fut=buildEvents(tasks,s,Date.now(),14).filter(e=>e.say&&e.at>Date.now()+1500).sort((a,b)=>a.at-b.at).slice(0,60);
    for(const e of fut)await Notifications.scheduleNotificationAsync({content:{title:I[s.lang||'fr'].notifTitle(s.name),body:e.say,sound:false,data:{id:e.id,say:e.say}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(e.at),channelId:'discipline'}});
  }catch(e){}
};
const bgTask=async()=>{
  while(BackgroundService.isRunning()){
    try{
      const now=Date.now();const s=await load('settings',{});const tasks=await load('tasks',[]);
      let next=now+20000;
      for(const e of buildEvents(tasks,s,now,1)){
        if(spoken.has(e.id))continue;
        if(e.at<=now&&now-e.at<60000){if(e.mid){spoken.add(e.id);await notifyMidnight(tasks,e.mid);}else speakOnce(e.id,e.say);}
        else if(e.at>now)next=Math.min(next,e.at);
      }
      await new Promise(r=>setTimeout(r,Math.max(250,next-Date.now())));
    }catch(e){await new Promise(r=>setTimeout(r,5000));}
  }
};
const bgOpts=lg=>({taskName:'Discipline',taskTitle:'Discipline',taskDesc:I[lg||'fr'].svcDesc,taskIcon:{name:'ic_launcher',type:'mipmap'},color:'#14c0e8',linkingURI:'discipline://'});

// ---------- Logo "D" ----------
const D="M26 18V82H46C74 82 82 64 82 50C82 36 74 18 46 18Z";
const Logo=({size=60})=>(
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs><LinearGradient id="g" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#1a4dff"/><Stop offset="0.55" stopColor="#14c0e8"/><Stop offset="1" stopColor="#ff3d9a"/></LinearGradient></Defs>
    <Path d={D} stroke="#ffd060" strokeWidth={16} strokeLinejoin="round" fill="none" transform="translate(6 6)"/>
    <Path d={D} stroke="#ff6fa8" strokeWidth={16} strokeLinejoin="round" fill="none" transform="translate(3 3)"/>
    <Path d={D} stroke="url(#g)" strokeWidth={16} strokeLinejoin="round" fill="none"/>
    <Circle cx={88} cy={12} r={6} fill="#ff9a10"/>
  </Svg>);

function App(){
  const [ready,setReady]=useState(false);
  const [tasks,setTasks]=useState([]);
  const [s,setS]=useState({name:'',voice:'',lang:'fr'});
  const lang=s.lang||'fr';const L=I[lang];
  const [nameIn,setNameIn]=useState('');
  const [f,setF]=useState({title:'',date:fmt(),start:'',end:''});
  const [prompt,setPrompt]=useState('');
  const [preview,setPreview]=useState(null);
  const [cand,setCand]=useState(null);
  const [svc,setSvc]=useState(null);
  const [svcErr,setSvcErr]=useState('');
  const startService=async()=>{
    try{
      if(!BackgroundService.isRunning()){const sv=await load('settings',{});await BackgroundService.start(bgTask,bgOpts(sv.lang));}
      setSvc(!!BackgroundService.isRunning());setSvcErr('');
    }catch(e){setSvc(false);setSvcErr(String((e&&e.message)||e).slice(0,300));}
  };
  const analyse=()=>{
    if(!prompt.trim())return;
    if(lang==='en'){Alert.alert(L.aEnOnly[0],L.aEnOnly[1]);return;}
    setPreview(parsePlanning(prompt));
  };
  const confirm=()=>{preview.tasks.forEach(t=>addTask({title:t.title,date:t.date,start:t.start,end:t.end}));setPreview(null);setPrompt('');};

  useEffect(()=>{(async()=>{
    setTasks(await load('tasks',[]));
    const saved=await load('settings',null);if(saved){delete saved.apiKey;delete saved.model;setS(p=>({...p,...saved}));}
    setReady(true);
    try{if(Platform.OS==='android')await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');await Notifications.requestPermissionsAsync();}catch(e){}
    await startService();
  })();},[]);
  useEffect(()=>{if(ready)AsyncStorage.setItem('tasks',JSON.stringify(tasks));},[tasks,ready]);
  useEffect(()=>{if(ready)scheduleAll(tasks,s);},[tasks,s.name,s.lang,ready]);
  const saveS=v=>{setS(v);AsyncStorage.setItem('settings',JSON.stringify(v));};

  const addTask=(t)=>setTasks(p=>[...p,{id:Date.now()+Math.random(),done:false,...t}]);
  const addManual=()=>{
    const st=normT(f.start),en=normT(f.end);
    if(!f.title.trim()||!okT(st)||!okT(en)||!/^\d{4}-\d{2}-\d{2}$/.test(f.date))return Alert.alert(L.aBadFields[0],L.aBadFields[1]);
    addTask({title:f.title.trim(),date:f.date,start:st,end:en});setF({...f,title:'',start:'',end:''});
  };
  const pickVoice=async()=>{
    try{
      const all=(await Speech.getAvailableVoicesAsync()).filter(v=>(v.language||'').toLowerCase().startsWith(LANGS[lang].prefix));
      const loc=all.filter(v=>!/network/i.test(v.identifier+' '+v.name));
      const vs=loc.length?loc:all;
      if(!vs.length)return Alert.alert(L.aNoVoice[0],L.aNoVoice[1]);
      const from=cand?cand.id:voiceOf(s);
      const i=(vs.findIndex(v=>v.identifier===from)+1)%vs.length;
      setCand({id:vs[i].identifier,n:i+1,total:vs.length});
      Speech.stop();Speech.speak(L.voiceTest(s.name),{language:LANGS[lang].tts,voice:vs[i].identifier});
    }catch(e){Alert.alert(L.aVoiceErr[0],L.aVoiceErr[1]);}
  };
  const validateVoice=()=>{
    if(!cand)return Alert.alert(L.aNoCand[0],L.aNoCand[1]);
    saveS({...s,voices:{...(s.voices||{}),[lang]:cand.id}});setCand(null);Alert.alert(L.aVoiceOk[0],L.aVoiceOk[1]);
  };
  const setLang=l=>{setCand(null);saveS({...s,lang:l});try{Promise.resolve(BackgroundService.updateNotification({taskDesc:I[l].svcDesc})).catch(()=>{});}catch(e){}};
  const testAlarm=()=>{
    const n=Date.now(),f=x=>{const d=new Date(x);return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;};
    addTask({title:L.testTitle,date:fmt(new Date(n+10000)),start:f(n+10000),end:f(n+70000)});
    Alert.alert(L.aTest[0],L.aTest[1]);
  };
  const exp=async()=>{
    const p=FileSystem.cacheDirectory+'discipline-sauvegarde.json';
    await FileSystem.writeAsStringAsync(p,JSON.stringify({v:1,name:s.name,tasks}));
    await Sharing.shareAsync(p,{mimeType:'application/json',dialogTitle:L.dlg});
  };
  const imp=async()=>{
    const r=await DocumentPicker.getDocumentAsync({type:'application/json',copyToCacheDirectory:true});
    if(r.canceled)return;
    try{const d=JSON.parse(await FileSystem.readAsStringAsync(r.assets[0].uri));
      const m=new Map(tasks.map(t=>[t.id,t]));d.tasks.forEach(t=>m.set(t.id,t));setTasks([...m.values()]);
      Alert.alert(L.aImp[0],L.aImp[1]);}catch{Alert.alert(L.aBadFile);}
  };

  // ---------- Progression ----------
  const byDay={};tasks.forEach(t=>{(byDay[t.date]=byDay[t.date]||[]).push(t);});
  const full=k=>byDay[k]&&byDay[k].every(t=>t.done);
  let streak=0;const cur=new Date();if(!full(fmt(cur)))cur.setDate(cur.getDate()-1);
  while(full(fmt(cur))){streak++;cur.setDate(cur.getDate()-1);}
  const tt=byDay[fmt()]||[];const dn=tt.filter(t=>t.done).length;const pct=tt.length?Math.round(100*dn/tt.length):0;
  const W=weekStats(tasks,new Date(),Date.now());const tr=trendOf(W.delta,lang);
  const list=[...tasks].filter(t=>t.date>=fmt()).sort((a,b)=>toMs(a.date,a.start)-toMs(b.date,b.start));

  if(!ready)return <View style={st.root}/>;
  if(!s.name)return(
    <View style={[st.root,{justifyContent:'center',alignItems:'center',padding:30}]}>
      <StatusBar barStyle="light-content"/><Logo size={110}/>
      <Text style={st.h1}>Discipline</Text>
      <Text style={st.sub}>{L.nameAsk}</Text>
      <TextInput style={[st.in,{width:'100%'}]} placeholder={L.namePh} placeholderTextColor="#6b7a99" value={nameIn} onChangeText={setNameIn}/>
      <TouchableOpacity style={st.btn} onPress={()=>nameIn.trim()&&saveS({...s,name:nameIn.trim()})}><Text style={st.bt}>{L.start}</Text></TouchableOpacity>
    </View>);

  return(
    <KeyboardAvoidingView style={{flex:1,backgroundColor:'#0a0f24'}} behavior="padding">
    <ScrollView style={st.root} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,paddingTop:48,paddingBottom:120}}>
      <StatusBar barStyle="light-content"/>
      <View style={{flexDirection:'row',alignItems:'center'}}><Logo/><View style={{marginLeft:12,flex:1}}>
        <Text style={st.h1}>Discipline</Text><Text style={st.sub}>{s.name}, {new Date().toLocaleDateString(LANGS[lang].locale,{weekday:'long',day:'numeric',month:'long'})}</Text></View></View>
      <Text style={st.quote}>{L.qo}{L.quotes[new Date().getDate()%L.quotes.length]}{L.qc}</Text>

      <View style={st.card}><Text style={st.t}>{L.level}</Text>
        <Text style={{color:tr.color,fontSize:46,fontWeight:'800'}}>{W.curAvg===null?'—':W.curAvg+' %'}</Text>
        <Text style={{color:tr.color,fontWeight:'600'}}>{tr.text}</Text>
        <View style={{flexDirection:'row',alignItems:'flex-end',marginTop:14}}>
          {L.days.map((l,i)=>(
            <View key={i} style={{flex:1,alignItems:'center'}}>
              <Text style={{color:tr.color,fontSize:11,height:16}}>{W.cur[i]===null?'':W.cur[i]}</Text>
              <View style={{flexDirection:'row',alignItems:'flex-end',height:82}}>
                <View style={{width:7,height:Math.max(3,(W.prev[i]||0)*0.8),backgroundColor:'#3a4678',marginRight:2,borderRadius:3}}/>
                <View style={{width:13,height:Math.max(3,(W.cur[i]||0)*0.8),backgroundColor:W.cur[i]===null?'#26346e':tr.color,borderRadius:3}}/>
              </View>
              <Text style={st.sub}>{l}</Text></View>))}
        </View>
        <Text style={[st.sub,{marginTop:8}]}>{L.legend}</Text></View>

      <View style={st.card}><Text style={st.t}>{L.today}</Text>
        <View style={st.bar}><View style={[st.fill,{width:pct+'%'}]}/></View>
        <Text style={st.sub}>{L.prog(dn,tt.length,pct,streak)}</Text></View>

      <View style={st.card}><Text style={st.t}>{L.assistant}</Text>
        <TextInput style={st.in} multiline placeholder={L.assistPh} placeholderTextColor="#6b7a99" value={prompt} onChangeText={v=>{setPrompt(v);setPreview(null);}}/>
        <View style={{flexDirection:'row',gap:8}}>
          <TouchableOpacity style={[st.btn,{flex:1}]} onPress={analyse}><Text style={st.bt}>{L.analyse}</Text></TouchableOpacity></View>
        {preview&&<View style={{marginTop:10}}>
          {preview.tasks.map((t,i)=><Text key={i} style={st.tt}>✔ {t.title}{'\n'}<Text style={st.sub}>{t.date} · {t.start} → {t.end}{t.note?' ('+t.note+')':''}</Text></Text>)}
          {preview.errors.map((e,i)=><Text key={i} style={{color:'#ff6fa8',marginTop:4}}>✖ {e}</Text>)}
          {preview.tasks.length>0&&<TouchableOpacity style={st.btn} onPress={confirm}><Text style={st.bt}>{L.addN(preview.tasks.length)}</Text></TouchableOpacity>}
        </View>}</View>

      <View style={st.card}><Text style={st.t}>{L.addTitle}</Text>
        <TextInput style={st.in} placeholder={L.phTitle} placeholderTextColor="#6b7a99" value={f.title} onChangeText={v=>setF({...f,title:v})}/>
        <TextInput style={st.in} placeholder={L.phDate} placeholderTextColor="#6b7a99" value={f.date} onChangeText={v=>setF({...f,date:v})}/>
        <View style={{flexDirection:'row',gap:8}}>
          <TextInput style={[st.in,{flex:1}]} placeholder={L.phStart} placeholderTextColor="#6b7a99" value={f.start} onChangeText={v=>setF({...f,start:v})}/>
          <TextInput style={[st.in,{flex:1}]} placeholder={L.phEnd} placeholderTextColor="#6b7a99" value={f.end} onChangeText={v=>setF({...f,end:v})}/></View>
        <TouchableOpacity style={st.btn} onPress={addManual}><Text style={st.bt}>{L.add}</Text></TouchableOpacity></View>

      <Text style={[st.t,{marginTop:8}]}>{L.schedule}</Text>
      {list.length===0&&<Text style={st.sub}>{L.empty}</Text>}
      {list.map(t=>(
        <View key={t.id} style={[st.task,t.done&&{opacity:0.5}]}>
          <TouchableOpacity style={{flex:1}} onPress={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))}>
            <Text style={st.tt}>{t.done?'✅ ':'⬜ '}{t.title}</Text>
            <Text style={st.sub}>{t.date} · {t.start} → {t.end}</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTasks(p=>p.filter(x=>x.id!==t.id))}><Text style={{color:'#ff3d9a',fontSize:20}}>✕</Text></TouchableOpacity>
        </View>))}

      <View style={st.card}><Text style={st.t}>{L.langTitle}</Text>
        <View style={{flexDirection:'row',gap:8}}>
          <TouchableOpacity style={[lang==='fr'?st.btn:st.btn2,{flex:1}]} onPress={()=>setLang('fr')}><Text style={st.bt}>Français</Text></TouchableOpacity>
          <TouchableOpacity style={[lang==='en'?st.btn:st.btn2,{flex:1}]} onPress={()=>setLang('en')}><Text style={st.bt}>English</Text></TouchableOpacity></View></View>
      <View style={st.card}><Text style={st.t}>{L.svcTitle}</Text>
        <Text style={st.sub}>{L.status}{svc===null?'…':svc?L.on:L.off}{svcErr?'\n'+svcErr:''}</Text>
        <TouchableOpacity style={st.btn2} onPress={startService}><Text style={st.bt}>{L.restart}</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={testAlarm}><Text style={st.bt}>{L.test}</Text></TouchableOpacity></View>
      <View style={st.card}><Text style={st.t}>{L.voiceTitle}</Text>
        <Text style={st.sub}>{L.savedVoice}{voiceOf(s)||L.def}</Text>
        {cand&&<Text style={{color:'#ffd060',marginTop:4}}>{L.trying(cand.n,cand.total)}</Text>}
        <TouchableOpacity style={st.btn2} onPress={pickVoice}><Text style={st.bt}>{L.pick}</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn} onPress={validateVoice}><Text style={st.bt}>{L.validate}</Text></TouchableOpacity></View>
      <View style={st.card}><Text style={st.t}>{L.backup}</Text>
        <TouchableOpacity style={st.btn2} onPress={exp}><Text style={st.bt}>{L.exp}</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={imp}><Text style={st.bt}>{L.imp}</Text></TouchableOpacity></View>
      <Text style={[st.sub,{textAlign:'center',marginTop:10}]}>Discipline v1.1.0</Text>
    </ScrollView>
    </KeyboardAvoidingView>);
}

class EB extends React.Component{
  state={e:null};
  static getDerivedStateFromError(e){return {e};}
  render(){
    if(this.state.e)return(<View style={[st.root,{padding:30,justifyContent:'center'}]}><Text style={st.h1}>Oups</Text><Text style={st.sub}>{String(this.state.e.message||this.state.e)}</Text>
      <TouchableOpacity style={st.btn} onPress={()=>this.setState({e:null})}><Text style={st.bt}>Réessayer</Text></TouchableOpacity></View>);
    return this.props.children;
  }
}
export default function Root(){return <EB><App/></EB>;}

const st=StyleSheet.create({
  root:{flex:1,backgroundColor:'#0a0f24'},
  h1:{color:'#fff',fontSize:28,fontWeight:'800'},sub:{color:'#9fb0d6',fontSize:13,marginTop:4},
  quote:{color:'#14c0e8',fontStyle:'italic',marginVertical:14},
  card:{backgroundColor:'#121a3a',borderRadius:18,padding:14,marginVertical:8,borderWidth:1,borderColor:'#1f2b5c'},
  t:{color:'#fff',fontSize:16,fontWeight:'700',marginBottom:8},
  in:{backgroundColor:'#0a0f24',color:'#fff',borderRadius:12,padding:12,marginVertical:5,borderWidth:1,borderColor:'#26346e'},
  btn:{backgroundColor:'#1a8cff',borderRadius:12,padding:13,alignItems:'center',marginTop:8},
  btn2:{backgroundColor:'#7a3cff',borderRadius:12,padding:12,alignItems:'center',marginTop:8},
  bt:{color:'#fff',fontWeight:'700'},
  bar:{height:10,backgroundColor:'#0a0f24',borderRadius:6,overflow:'hidden'},fill:{height:10,backgroundColor:'#ff3d9a'},
  task:{flexDirection:'row',alignItems:'center',backgroundColor:'#121a3a',borderLeftWidth:4,borderLeftColor:'#ffd060',borderRadius:12,padding:12,marginVertical:5},
  tt:{color:'#fff',fontSize:15,fontWeight:'600'}
});
