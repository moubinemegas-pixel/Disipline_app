// Textes et phrases vocales FR / EN. Les données (tâches, notes) ne dépendent pas de la langue.
const pad=n=>String(n).padStart(2,'0');
export const LANGS={fr:{tts:'fr-FR',locale:'fr-FR',prefix:'fr'},en:{tts:'en-US',locale:'en-US',prefix:'en'}};
export const voiceOf=s=>{const l=(s&&s.lang)||'fr';return ((s&&s.voices)||{})[l]||(l==='fr'?(s&&s.voice):undefined)||undefined;};
const speakTime=(lang,t)=>{
  const [h,m,s]=t.split(':').map(Number);
  if(lang==='en'){const ap=h>=12?'PM':'AM',h12=h%12||12;return s?`${h12}:${pad(m)}:${pad(s)} ${ap}`:`${h12}:${pad(m)} ${ap}`;}
  return `${h} heures ${m} minutes ${s} secondes`;
};
export const taskSay=(lang,name,title,end)=>lang==='en'
  ?`${name}, it's time for ${title}. It ends at ${speakTime('en',end)}.`
  :`${name}, il est l'heure de ${title}. Fin à ${speakTime('fr',end)}.`;
export const reminderSay=(lang,name,exo)=>lang==='en'
  ?`${name}! Make tomorrow's schedule and make it happen!${exo?' And do your physical exercises!':''}`
  :`${name}! fais l'emploi du temps de demain et que ça saute !${exo?' et fais les exercices physiques !':''}`;

export const I={
fr:{locale:'fr-FR',notifTitle:n=>`${n}, il est l'heure`,svcDesc:'Rappels vocaux actifs',
 nameAsk:"Comment dois-je t'appeler ?",namePh:"Ton nom d'utilisateur",start:'Commencer',
 qo:'« ',qc:' »',quotes:["La discipline, c'est choisir entre ce que tu veux maintenant et ce que tu veux le plus.","Apprendre un peu chaque jour vaut mieux que beaucoup une fois.","Ce que tu repousses te poursuit.","Chaque seconde planifiée est une seconde gagnée."],
 level:'Niveau de discipline',days:['L','M','M','J','V','S','D'],legend:'Barre colorée : cette semaine · barre grise : semaine passée. Une tâche non faite après son heure de fin compte comme manquée.',
 today:'Progression du jour',prog:(d,n,p,s)=>`${d}/${n} tâches · ${p}% · 🔥 série : ${s} jour(s)`,
 assistant:'Assistant (hors ligne)',assistPh:'Écris ou dicte avec le micro 🎤 de ton clavier : « demain de 5h30 à 6h30 sport puis 8h à 12h maths »',
 analyse:'Analyser',addN:n=>`Ajouter ${n} tâche(s)`,
 addTitle:'Ajouter une tâche',phTitle:'Titre',phDate:'Date AAAA-MM-JJ',phStart:'Début HH:MM:SS',phEnd:'Fin HH:MM:SS',add:'Ajouter',
 schedule:'Emploi du temps',empty:'Rien de prévu. Ajoute ta première tâche.',
 langTitle:'Langue',
 svcTitle:'Service vocal',status:'État : ',on:'actif ✅',off:'inactif ❌',restart:'Redémarrer le service',test:"⏱ Tester l'alarme (dans 10 s)",
 voiceTitle:'Voix',savedVoice:'Voix enregistrée : ',def:'par défaut',trying:(n,t)=>`Voix en essai : ${n}/${t} (pas encore enregistrée)`,pick:'🔊 Sélectionner la voix',validate:'✅ Valider',
 backup:'Sauvegarde',exp:'☁️ Sauvegarder (Drive…)',imp:'📥 Restaurer une sauvegarde',
 aBadFields:['Champs invalides','Date AAAA-MM-JJ, heures HH:MM:SS'],
 aNoVoice:['Aucune voix française','Installe-en une dans Paramètres > Synthèse vocale.'],voiceTest:n=>`${n}, il est l'heure de tester cette voix.`,aVoiceErr:['Voix','Impossible de lister les voix.'],
 aNoCand:['Aucune voix à valider','Appuie d\'abord sur « Sélectionner la voix ».'],aVoiceOk:['Voix enregistrée','Elle sera utilisée pour toutes les alarmes.'],
 testTitle:'Test alarme',aTest:['Test lancé',"Quitte l'app : la voix doit parler dans 10 secondes."],dlg:'Enregistrer sur Drive',aImp:['Importé','Sauvegarde fusionnée.'],aBadFile:'Fichier invalide',
 aEnOnly:['','']},
en:{locale:'en-US',notifTitle:n=>`${n}, it's time`,svcDesc:'Voice reminders active',
 nameAsk:'What should I call you?',namePh:'Your username',start:'Start',
 qo:'“',qc:'”',quotes:["Discipline is choosing between what you want now and what you want most.","A little learning every day beats a lot once.","What you put off keeps chasing you.","Every planned second is a second gained."],
 level:'Discipline level',days:['M','T','W','T','F','S','S'],legend:'Coloured bar: this week · grey bar: last week. A task not done after its end time counts as missed.',
 today:"Today's progress",prog:(d,n,p,s)=>`${d}/${n} tasks · ${p}% · 🔥 streak: ${s} day(s)`,
 assistant:'Assistant (French only for now)',assistPh:'The assistant understands French only for now. Add tasks manually below.',
 analyse:'Analyse',addN:n=>`Add ${n} task(s)`,
 addTitle:'Add a task',phTitle:'Title',phDate:'Date YYYY-MM-DD',phStart:'Start HH:MM:SS',phEnd:'End HH:MM:SS',add:'Add',
 schedule:'Schedule',empty:'Nothing planned. Add your first task.',
 langTitle:'Language',
 svcTitle:'Voice service',status:'Status: ',on:'active ✅',off:'inactive ❌',restart:'Restart service',test:'⏱ Test the alarm (in 10 s)',
 voiceTitle:'Voice',savedVoice:'Saved voice: ',def:'default',trying:(n,t)=>`Voice being tried: ${n}/${t} (not saved yet)`,pick:'🔊 Select voice',validate:'✅ Confirm',
 backup:'Backup',exp:'☁️ Back up (Drive…)',imp:'📥 Restore a backup',
 aBadFields:['Invalid fields','Date YYYY-MM-DD, times HH:MM:SS'],
 aNoVoice:['No English voice','Install one in Settings > Text-to-speech.'],voiceTest:n=>`${n}, this is how I will sound.`,aVoiceErr:['Voice','Could not list the voices.'],
 aNoCand:['No voice to confirm','Tap "Select voice" first.'],aVoiceOk:['Voice saved','It will be used for all alarms.'],
 testTitle:'Alarm test',aTest:['Test started','Leave the app: the voice should speak in 10 seconds.'],dlg:'Save to Drive',aImp:['Imported','Backup merged.'],aBadFile:'Invalid file',
 aEnOnly:['Assistant','The assistant understands French only for now. Please add the task manually below.']}
};
