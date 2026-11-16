import {taskSay,reminderSay} from './i18n';
// Construit la liste des événements sonores (pur, testable).
const toMs=(date,t)=>{const [y,m,d]=date.split('-').map(Number);const [h,mi,s]=t.split(':').map(Number);return new Date(y,m-1,d,h,mi,s||0).getTime();};
export function buildEvents(tasks,s,now,days=1){
  const out=[];if(!s||!s.name)return out;
  for(const t of tasks){if(t.done)continue;
    out.push({id:'t'+t.id+t.date+t.start,at:toMs(t.date,t.start),say:taskSay(s.lang||'fr',s.name,t.title,t.end)});}
  for(let i=-1;i<=days;i++){
    const d=new Date(now);d.setDate(d.getDate()+i);d.setHours(21,0,0,0);
    const say=reminderSay(s.lang||'fr',s.name,[1,3,6].includes(d.getDay()));
    out.push({id:'r'+d.getTime(),at:d.getTime(),say});
    const m=new Date(now);m.setDate(m.getDate()+i);m.setHours(0,0,0,0);
    out.push({id:'m'+m.getTime(),at:m.getTime(),mid:m});
  }
  return out;
}
