// Analyseur de planning en français : déterministe, hors ligne, sans IA.
const pad=n=>String(n).padStart(2,'0');
const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const DAYS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MONTHS=['janvier','f[ée]vrier','mars','avril','mai','juin','juillet','ao[uû]t','septembre','octobre','novembre','d[ée]cembre'];
const TIME=/(?:(\d{1,2})\s*h(?:eures?)?(?![a-zéèêàû])\s*(\d{1,2})?(?:\s*(\d{1,2})\s*(?:s|sec\w*)(?!\w))?|(\d{1,2}):(\d{2})(?::(\d{2}))?|\b(midi|minuit)\b)(?:\s*(du matin|du soir|de l['’]apr[eè]s-midi))?/g;
const addDays=(n,k)=>new Date(n.getFullYear(),n.getMonth(),n.getDate()+k);
const hms=t=>`${pad(t.h)}:${pad(t.mi)}:${pad(t.s)}`;
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

function toTime(m){
  let h,mi=0,s=0;
  if(m[7])h=m[7]==='midi'?12:0;
  else if(m[1]!==undefined){h=+m[1];mi=+(m[2]||0);s=+(m[3]||0);}
  else{h=+m[4];mi=+m[5];s=+(m[6]||0);}
  const p=m[8];
  if(p){if(/matin/.test(p)){if(h===12)h=0;}else if(h<12)h+=12;}
  if(h>23||mi>59||s>59)return null;
  return {h,mi,s,pm:!!p&&!/matin/.test(p)};
}
function findDay(c,now){
  let m,date=null,wd;
  const r={};
  if(m=/apr[eè]s[- ]demain/.exec(c))date=addDays(now,2);
  else if(m=/\bdemain\b/.exec(c))date=addDays(now,1);
  else if(m=/aujourd['’]?\s?hui/.exec(c))date=addDays(now,0);
  else if(m=/\b(\d{4})-(\d{2})-(\d{2})\b/.exec(c))date=new Date(+m[1],+m[2]-1,+m[3]);
  else if(m=new RegExp(`(?:\\ble\\s+)?\\b(\\d{1,2})\\s+(${MONTHS.join('|')})\\b(?:\\s+(\\d{4}))?`).exec(c)){
    const mo=MONTHS.findIndex(x=>new RegExp('^(?:'+x+')$').test(m[2]));
    date=new Date(+(m[3]||now.getFullYear()),mo,+m[1]);
    if(!m[3]&&date<addDays(now,0))date.setFullYear(date.getFullYear()+1);
  }else if(m=/(?:\ble\s+)?\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(c)){
    let y=m[3]?+m[3]:now.getFullYear();if(y<100)y+=2000;
    date=new Date(y,+m[2]-1,+m[1]);
    if(!m[3]&&date<addDays(now,0))date.setFullYear(date.getFullYear()+1);
  }else if(m=new RegExp(`\\b(${DAYS.join('|')})\\b(?:\\s+prochain)?`).exec(c))wd=DAYS.indexOf(m[1]);
  if(m)r.span=[m.index,m.index+m[0].length];
  if(date)r.date=date;
  if(wd!==undefined)r.wd=wd;
  return r;
}
const LEAD=/^(?:ajoute(?:r)?|rajoute(?:r)?|mets?|mettre|programme(?:r)?|planifie(?:r)?|note(?:r)?|je veux|je dois|il faut|fais|faire|le|la|les|un|une|du|des|de|à|a|au|aux|pour|dans|ce|cet|cette|ensuite|aussi|stp|s'il te pla[iî]t)(?:\s+|$)/;
const TRAIL=/(?:^|\s+)(?:de|du|des|à|a|au|aux|le|la|les|pour|stp|et|puis|dans|ce|cette|s'il te pla[iî]t)$/;
function cleanTitle(t){
  t=t.replace(/\s+/g,' ').trim();let p;
  do{p=t;t=t.replace(LEAD,'').replace(/^(?:l|d)['’]/,'').replace(TRAIL,'').trim();}while(t!==p);
  return t;
}

export function parsePlanning(text,now=new Date()){
  const tasks=[],errors=[];let cur=null;
  const clauses=text.toLowerCase().split(/\s*(?:[,;.\n]|\bpuis\b|\bensuite\b|\bet\b)\s*/).map(s=>s.trim()).filter(Boolean);
  for(const c0 of clauses){
    let c=c0;const day=findDay(c,now);
    if(day.span)c=c.slice(0,day.span[0])+' '.repeat(day.span[1]-day.span[0])+c.slice(day.span[1]);
    if(day.date||day.wd!==undefined)cur=day;
    let durM=/\bpendant\s+(\d{1,2})\s*(?:(h)(?:eures?)?\s*(\d{1,2})?|min\w*)/.exec(c),dur=null;
    if(durM){dur=durM[2]?(+durM[1])*60+(+(durM[3]||0)):+durM[1];c=c.slice(0,durM.index)+' '.repeat(durM[0].length)+c.slice(durM.index+durM[0].length);}
    const times=[...c.matchAll(TIME)].map(m=>({m,t:toTime(m),i:m.index,e:m.index+m[0].length}));
    if(!times.length){
      if(day.span&&!cleanTitle(c))continue;
      errors.push(`Heure manquante : « ${c0} »`);continue;}
    if(times.some(x=>!x.t)){errors.push(`Heure invalide : « ${c0} »`);continue;}
    let start,end,s0,s1;
    if(times.length===2){
      const between=c.slice(times[0].e,times[1].i);
      if(!/^\s*(?:à|a|au|-|–|—|jusqu['’]?\s*(?:à|a|au))\s*$/.test(between)){errors.push(`Je ne comprends pas les heures : « ${c0} »`);continue;}
      start=times[0].t;end=times[1].t;s0=times[0].i;s1=times[1].e;
      if(end.pm&&!start.pm&&start.h<12&&start.h+12<=end.h)start.h+=12;
    }else if(times.length===1&&dur!==null){
      start=times[0].t;
      const tot=(start.h*3600+start.mi*60+start.s+dur*60)%86400;
      end={h:Math.floor(tot/3600),mi:Math.floor(tot%3600/60),s:tot%60};
      s0=times[0].i;s1=times[0].e;
    }else if(times.length===1){errors.push(`Heure de fin manquante : « ${c0} »`);continue;
    }else{errors.push(`Trop d'heures dans une même tâche : « ${c0} »`);continue;}
    const title=cleanTitle(c.slice(0,s0)+' '+c.slice(s1));
    if(!title){errors.push(`Titre manquant : « ${c0} »`);continue;}
    if(hms(start)===hms(end)){errors.push(`Début et fin identiques : « ${c0} »`);continue;}
    // résolution de la date
    const nowMs=now.getTime();let date,note='';
    const at=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),start.h,start.mi,start.s).getTime();
    if(cur&&cur.date){date=cur.date;if(at(date)<=nowMs)note='heure déjà passée';}
    else if(cur){let k=(cur.wd-now.getDay()+7)%7;date=addDays(now,k);if(k===0&&at(date)<=nowMs)date=addDays(now,7);}
    else{date=addDays(now,0);if(at(date)<=nowMs){date=addDays(now,1);note='demain, car l\'heure est déjà passée';}}
    tasks.push({title:cap(title),date:fmt(date),start:hms(start),end:hms(end),note});
  }
  if(!tasks.length&&!errors.length)errors.push("Je n'ai trouvé aucune tâche. Exemple : « demain de 5h30 à 6h30 sport »");
  return {tasks,errors};
}
