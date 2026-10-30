import React,{useEffect,useState} from 'react';
import {View,Text,TextInput,TouchableOpacity,ScrollView,StatusBar,Alert,Platform,PermissionsAndroid,StyleSheet} from 'react-native';
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
const QUOTES=["La discipline, c'est choisir entre ce que tu veux maintenant et ce que tu veux le plus.","Apprendre un peu chaque jour vaut mieux que beaucoup une fois.","Ce que tu repousses te poursuit.","Chaque seconde planifiée est une seconde gagnée."];

Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowAlert:true,shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false})});
const notifyMidnight=async(tasks,m)=>{
  try{
    await Notifications.setNotificationChannelAsync('discipline',{name:'Niveau de discipline',importance:Notifications.AndroidImportance.HIGH,sound:null});
    const y=new Date(m.getFullYear(),m.getMonth(),m.getDate()-1,12);
    await Notifications.scheduleNotificationAsync({content:{title:'Niveau de discipline',body:midnightMessage(tasks,y,m.getTime()),sound:false},trigger:{channelId:'discipline'}});
  }catch(e){}
};
// ---------- Moteur d'arrière-plan : dort jusqu'au prochain événement (très peu de RAM/CPU) ----------
const fired=new Set();
const events=async(now)=>{
  const s=await load('settings',{});const tasks=await load('tasks',[]);const out=[];
  if(!s.name)return {s,out};
  for(const t of tasks){if(t.done)continue;
    out.push({id:'t'+t.id+t.date+t.start,at:toMs(t.date,t.start),say:`${s.name}, il est l'heure de ${t.title}. Fin à ${said(t.end)}.`});}
  for(let i=-1;i<=1;i++){const d=new Date(now);d.setDate(d.getDate()+i);d.setHours(21,0,0,0);
    let say=`${s.name}! fais l'emploi du temps de demain et que ça saute !`;
    if([1,3,6].includes(d.getDay()))say+=' et fais les exercices physiques !';
    out.push({id:'r'+d.getTime(),at:d.getTime(),say});
    const m=new Date(now);m.setDate(m.getDate()+i);m.setHours(0,0,0,0);
    out.push({id:'m'+m.getTime(),at:m.getTime(),run:()=>notifyMidnight(tasks,m)});}
  return {s,out};
};
const bgTask=async()=>{
  while(BackgroundService.isRunning()){
    const now=Date.now();const {s,out}=await events(now);let next=now+30000;
    for(const e of out){if(fired.has(e.id))continue;
      if(e.at<=now&&now-e.at<60000){fired.add(e.id);if(e.run)await e.run();else Speech.speak(e.say,{language:'fr-FR',voice:s.voice||undefined,rate:0.95});}
      else if(e.at>now)next=Math.min(next,e.at);}
    await new Promise(r=>setTimeout(r,Math.max(250,next-Date.now())));
  }
};
const bgOpts={taskName:'Discipline',taskTitle:'Discipline',taskDesc:'Rappels vocaux actifs',taskIcon:{name:'ic_launcher',type:'mipmap'},color:'#14c0e8',linkingURI:'discipline://'};

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

export default function App(){
  const [ready,setReady]=useState(false);
  const [tasks,setTasks]=useState([]);
  const [s,setS]=useState({name:'',apiKey:'',model:'openrouter/free',voice:''});
  const [nameIn,setNameIn]=useState('');
  const [f,setF]=useState({title:'',date:fmt(),start:'',end:''});
  const [prompt,setPrompt]=useState('');
  const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState(null);
  const analyse=()=>{if(prompt.trim())setPreview(parsePlanning(prompt));};
  const confirm=()=>{preview.tasks.forEach(t=>addTask({title:t.title,date:t.date,start:t.start,end:t.end}));setPreview(null);setPrompt('');};

  useEffect(()=>{(async()=>{
    setTasks(await load('tasks',[]));
    const saved=await load('settings',null);if(saved)setS(p=>({...p,...saved}));
    setReady(true);
    if(Platform.OS==='android')await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
    if(!BackgroundService.isRunning())await BackgroundService.start(bgTask,bgOpts);
  })();},[]);
  useEffect(()=>{if(ready)AsyncStorage.setItem('tasks',JSON.stringify(tasks));},[tasks,ready]);
  const saveS=v=>{setS(v);AsyncStorage.setItem('settings',JSON.stringify(v));};

  const addTask=(t)=>setTasks(p=>[...p,{id:Date.now()+Math.random(),done:false,...t}]);
  const addManual=()=>{
    const st=normT(f.start),en=normT(f.end);
    if(!f.title.trim()||!okT(st)||!okT(en)||!/^\d{4}-\d{2}-\d{2}$/.test(f.date))return Alert.alert('Champs invalides','Date AAAA-MM-JJ, heures HH:MM:SS');
    addTask({title:f.title.trim(),date:f.date,start:st,end:en});setF({...f,title:'',start:'',end:''});
  };
  const askAI=async()=>{
    if(!s.apiKey)return Alert.alert('Clé OpenRouter manquante','Renseigne-la en bas de l\'écran.');
    if(!prompt.trim())return;setBusy(true);
    try{
      const n=new Date();
      const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',
        headers:{Authorization:'Bearer '+s.apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({model:s.model,messages:[
          {role:'system',content:`Tu es l'assistant d'un emploi du temps. Maintenant: ${fmt(n)} ${n.toTimeString().slice(0,8)} (${n.toLocaleDateString('fr-FR',{weekday:'long'})}). Transforme la demande en JSON strict, sans aucun texte autour: [{"title":"...","date":"AAAA-MM-JJ","start":"HH:MM:SS","end":"HH:MM:SS"}]. "demain" = le lendemain d'aujourd'hui.`},
          {role:'user',content:prompt}]})});
      const j=await r.json();
      const arr=JSON.parse(j.choices[0].message.content.match(/\[[\s\S]*\]/)[0]);
      const good=arr.filter(a=>a.title&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)&&okT(normT(a.start))&&okT(normT(a.end)))
        .map(a=>({title:a.title,date:a.date,start:normT(a.start),end:normT(a.end)}));
      if(!good.length)throw new Error('vide');
      setPreview({tasks:good,errors:[]});
    }catch(e){Alert.alert('L\'IA n\'a pas réussi','Reformule, ou essaie un autre modèle gratuit.');}
    setBusy(false);
  };
  const cycleVoice=async()=>{
    const vs=(await Speech.getAvailableVoicesAsync()).filter(v=>v.language.toLowerCase().startsWith('fr'));
    if(!vs.length)return Alert.alert('Aucune voix française','Installe-en une dans Paramètres > Synthèse vocale.');
    const i=(vs.findIndex(v=>v.identifier===s.voice)+1)%vs.length;
    saveS({...s,voice:vs[i].identifier});
    Speech.speak(`${s.name}, il est l'heure. Voix numéro ${i+1} sur ${vs.length}.`,{language:'fr-FR',voice:vs[i].identifier});
  };
  const exp=async()=>{
    const p=FileSystem.cacheDirectory+'discipline-sauvegarde.json';
    await FileSystem.writeAsStringAsync(p,JSON.stringify({v:1,name:s.name,tasks}));
    await Sharing.shareAsync(p,{mimeType:'application/json',dialogTitle:'Enregistrer sur Drive'});
  };
  const imp=async()=>{
    const r=await DocumentPicker.getDocumentAsync({type:'application/json',copyToCacheDirectory:true});
    if(r.canceled)return;
    try{const d=JSON.parse(await FileSystem.readAsStringAsync(r.assets[0].uri));
      const m=new Map(tasks.map(t=>[t.id,t]));d.tasks.forEach(t=>m.set(t.id,t));setTasks([...m.values()]);
      Alert.alert('Importé','Sauvegarde fusionnée.');}catch{Alert.alert('Fichier invalide');}
  };

  // ---------- Progression ----------
  const byDay={};tasks.forEach(t=>{(byDay[t.date]=byDay[t.date]||[]).push(t);});
  const full=k=>byDay[k]&&byDay[k].every(t=>t.done);
  let streak=0;const cur=new Date();if(!full(fmt(cur)))cur.setDate(cur.getDate()-1);
  while(full(fmt(cur))){streak++;cur.setDate(cur.getDate()-1);}
  const tt=byDay[fmt()]||[];const dn=tt.filter(t=>t.done).length;const pct=tt.length?Math.round(100*dn/tt.length):0;
  const W=weekStats(tasks,new Date(),Date.now());const tr=trendOf(W.delta);
  const list=[...tasks].filter(t=>t.date>=fmt()).sort((a,b)=>toMs(a.date,a.start)-toMs(b.date,b.start));

  if(!ready)return <View style={st.root}/>;
  if(!s.name)return(
    <View style={[st.root,{justifyContent:'center',alignItems:'center',padding:30}]}>
      <StatusBar barStyle="light-content"/><Logo size={110}/>
      <Text style={st.h1}>Discipline</Text>
      <Text style={st.sub}>Comment dois-je t'appeler ?</Text>
      <TextInput style={[st.in,{width:'100%'}]} placeholder="Ton nom d'utilisateur" placeholderTextColor="#6b7a99" value={nameIn} onChangeText={setNameIn}/>
      <TouchableOpacity style={st.btn} onPress={()=>nameIn.trim()&&saveS({...s,name:nameIn.trim()})}><Text style={st.bt}>Commencer</Text></TouchableOpacity>
    </View>);

  return(
    <ScrollView style={st.root} contentContainerStyle={{padding:18,paddingTop:48}}>
      <StatusBar barStyle="light-content"/>
      <View style={{flexDirection:'row',alignItems:'center'}}><Logo/><View style={{marginLeft:12,flex:1}}>
        <Text style={st.h1}>Discipline</Text><Text style={st.sub}>{s.name}, {new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</Text></View></View>
      <Text style={st.quote}>« {QUOTES[new Date().getDate()%QUOTES.length]} »</Text>

      <View style={st.card}><Text style={st.t}>Niveau de discipline</Text>
        <Text style={{color:tr.color,fontSize:46,fontWeight:'800'}}>{W.curAvg===null?'—':W.curAvg+' %'}</Text>
        <Text style={{color:tr.color,fontWeight:'600'}}>{tr.text}</Text>
        <View style={{flexDirection:'row',alignItems:'flex-end',marginTop:14}}>
          {['L','M','M','J','V','S','D'].map((l,i)=>(
            <View key={i} style={{flex:1,alignItems:'center'}}>
              <Text style={{color:tr.color,fontSize:11,height:16}}>{W.cur[i]===null?'':W.cur[i]}</Text>
              <View style={{flexDirection:'row',alignItems:'flex-end',height:82}}>
                <View style={{width:7,height:Math.max(3,(W.prev[i]||0)*0.8),backgroundColor:'#3a4678',marginRight:2,borderRadius:3}}/>
                <View style={{width:13,height:Math.max(3,(W.cur[i]||0)*0.8),backgroundColor:W.cur[i]===null?'#26346e':tr.color,borderRadius:3}}/>
              </View>
              <Text style={st.sub}>{l}</Text></View>))}
        </View>
        <Text style={[st.sub,{marginTop:8}]}>Barre colorée : cette semaine · barre grise : semaine passée. Une tâche non faite après son heure de fin compte comme manquée.</Text></View>

      <View style={st.card}><Text style={st.t}>Progression du jour</Text>
        <View style={st.bar}><View style={[st.fill,{width:pct+'%'}]}/></View>
        <Text style={st.sub}>{dn}/{tt.length} tâches · {pct}% · 🔥 série : {streak} jour(s)</Text></View>

      <View style={st.card}><Text style={st.t}>Assistant (hors ligne)</Text>
        <TextInput style={st.in} multiline placeholder={'Écris ou dicte avec le micro 🎤 de ton clavier : « demain de 5h30 à 6h30 sport puis 8h à 12h maths »'} placeholderTextColor="#6b7a99" value={prompt} onChangeText={v=>{setPrompt(v);setPreview(null);}}/>
        <View style={{flexDirection:'row',gap:8}}>
          <TouchableOpacity style={[st.btn,{flex:1}]} onPress={analyse}><Text style={st.bt}>Analyser</Text></TouchableOpacity></View>
        {preview&&<View style={{marginTop:10}}>
          {preview.tasks.map((t,i)=><Text key={i} style={st.tt}>✔ {t.title}{'\n'}<Text style={st.sub}>{t.date} · {t.start} → {t.end}{t.note?' ('+t.note+')':''}</Text></Text>)}
          {preview.errors.map((e,i)=><Text key={i} style={{color:'#ff6fa8',marginTop:4}}>✖ {e}</Text>)}
          {preview.tasks.length>0&&<TouchableOpacity style={st.btn} onPress={confirm}><Text style={st.bt}>Ajouter {preview.tasks.length} tâche(s)</Text></TouchableOpacity>}
          {preview.errors.length>0&&!!s.apiKey&&<TouchableOpacity style={st.btn2} onPress={askAI} disabled={busy}><Text style={st.bt}>{busy?'Réflexion…':'Essayer avec l\'IA en ligne'}</Text></TouchableOpacity>}
        </View>}</View>

      <View style={st.card}><Text style={st.t}>Ajouter une tâche</Text>
        <TextInput style={st.in} placeholder="Titre" placeholderTextColor="#6b7a99" value={f.title} onChangeText={v=>setF({...f,title:v})}/>
        <TextInput style={st.in} placeholder="Date AAAA-MM-JJ" placeholderTextColor="#6b7a99" value={f.date} onChangeText={v=>setF({...f,date:v})}/>
        <View style={{flexDirection:'row',gap:8}}>
          <TextInput style={[st.in,{flex:1}]} placeholder="Début HH:MM:SS" placeholderTextColor="#6b7a99" value={f.start} onChangeText={v=>setF({...f,start:v})}/>
          <TextInput style={[st.in,{flex:1}]} placeholder="Fin HH:MM:SS" placeholderTextColor="#6b7a99" value={f.end} onChangeText={v=>setF({...f,end:v})}/></View>
        <TouchableOpacity style={st.btn} onPress={addManual}><Text style={st.bt}>Ajouter</Text></TouchableOpacity></View>

      <Text style={[st.t,{marginTop:8}]}>Emploi du temps</Text>
      {list.length===0&&<Text style={st.sub}>Rien de prévu. Ajoute ta première tâche.</Text>}
      {list.map(t=>(
        <View key={t.id} style={[st.task,t.done&&{opacity:0.5}]}>
          <TouchableOpacity style={{flex:1}} onPress={()=>setTasks(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))}>
            <Text style={st.tt}>{t.done?'✅ ':'⬜ '}{t.title}</Text>
            <Text style={st.sub}>{t.date} · {t.start} → {t.end}</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=>setTasks(p=>p.filter(x=>x.id!==t.id))}><Text style={{color:'#ff3d9a',fontSize:20}}>✕</Text></TouchableOpacity>
        </View>))}

      <View style={st.card}><Text style={st.t}>Réglages</Text>
        <TextInput style={st.in} placeholder="Clé API OpenRouter (optionnel, en ligne)" placeholderTextColor="#6b7a99" secureTextEntry value={s.apiKey} onChangeText={v=>saveS({...s,apiKey:v})}/>
        <TextInput style={st.in} placeholder="Modèle OpenRouter (ex : xxx:free)" placeholderTextColor="#6b7a99" autoCapitalize="none" value={s.model} onChangeText={v=>saveS({...s,model:v})}/>
        <TouchableOpacity style={st.btn2} onPress={cycleVoice}><Text style={st.bt}>🔊 Changer / tester la voix</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={exp}><Text style={st.bt}>☁️ Sauvegarder (Drive…)</Text></TouchableOpacity>
        <TouchableOpacity style={st.btn2} onPress={imp}><Text style={st.bt}>📥 Restaurer une sauvegarde</Text></TouchableOpacity></View>
    </ScrollView>);
}

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
