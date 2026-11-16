// Niveau de discipline : calcul pur, partagé par l'écran et le service de minuit.
const pad=n=>String(n).padStart(2,'0');
const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const addDays=(d,k)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+k);
const ms=(date,t)=>{const [y,m,d]=date.split('-').map(Number);const [h,mi,s]=t.split(':').map(Number);return new Date(y,m-1,d,h,mi,s||0).getTime();};
const endMs=t=>ms(t.date,t.end)+(t.end<=t.start?86400000:0);
const mean=a=>{const v=a.filter(x=>x!==null);return v.length?Math.round(v.reduce((x,y)=>x+y,0)/v.length):null;};

// Note du jour (0-100) = tâches faites / (tâches faites + tâches dont l'heure de fin est passée sans être faites).
// Les tâches encore à venir ne comptent pas. Jour sans tâche concernée => null.
export function dayScore(tasks,dateStr,nowMs){
  const c=tasks.filter(t=>t.date===dateStr&&(t.done||endMs(t)<=nowMs));
  if(!c.length)return null;
  return Math.round(100*c.filter(t=>t.done).length/c.length);
}
// Semaine lundi→dimanche contenant refDate, comparée à la précédente.
export function weekStats(tasks,refDate,nowMs=refDate.getTime()){
  const mon=addDays(refDate,-((refDate.getDay()+6)%7));
  const cur=[],prev=[];
  for(let i=0;i<7;i++){cur.push(dayScore(tasks,fmt(addDays(mon,i)),nowMs));prev.push(dayScore(tasks,fmt(addDays(mon,i-7)),nowMs));}
  const curAvg=mean(cur),prevAvg=mean(prev);
  return {cur,prev,curAvg,prevAvg,delta:curAvg!==null&&prevAvg!==null?curAvg-prevAvg:null};
}
export function trendOf(delta,lang='fr'){
  const en=lang==='en';
  if(delta===null)return {color:'#14c0e8',text:en?'Not enough data to compare with last week':'Pas encore de comparaison avec la semaine passée'};
  if(delta>0)return {color:'#2ecc71',text:en?`Up ${delta} % vs last week`:`Croissance de ${delta} % par rapport à la semaine passée`};
  if(delta<0)return {color:'#ff4d4d',text:en?`Down ${-delta} % vs last week`:`Baisse de ${-delta} % par rapport à la semaine passée`};
  return {color:'#14c0e8',text:en?'Stable vs last week':'Stable par rapport à la semaine passée'};
}
// Message de la notification de minuit (yDate = le jour qui vient de finir).
export function midnightMessage(tasks,yDate,nowMs,lang='fr'){
  const en=lang==='en';
  const w=weekStats(tasks,yDate,nowMs),i=(yDate.getDay()+6)%7,y=w.cur[i];
  if(y===null)return (en?'No tasks yesterday. ':'Aucune tâche hier. ')+(w.curAvg!==null?(en?`Week: ${w.curAvg} %.`:`Semaine : ${w.curAvg} %.`):'');
  const p=dayScore(tasks,fmt(addDays(yDate,-1)),nowMs);
  const d=p===null?'':(en?` (${y===p?'same as the day before':(y>p?'↑ ':'↓ ')+Math.abs(y-p)+' pts vs the day before'})`:` (${y===p?'= comme la veille':(y>p?'↑ ':'↓ ')+Math.abs(y-p)+' pts vs la veille'})`);
  return en?`Yesterday: ${y} %${d}. Week: ${w.curAvg} %. ${trendOf(w.delta,lang).text}.`:`Hier : ${y} %${d}. Semaine : ${w.curAvg} %. ${trendOf(w.delta,lang).text}.`;
}
