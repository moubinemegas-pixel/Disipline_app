Discipline est une app que j'ai créée qui permet de faire un enregistrement vocal de tâches selon le format écrit dans l'app et qui fait des rappels vocaux avec 11 voix disponibles. J'ai créé cette app pour aider qui le veut bien à lutter efficacement contre la procrastination vu qu'à l'installation l'app demande le nom de l'utilisateur pour l'inclure dans les alarmes. 

NB : Cette fonction de rappel vocal ne fonctionne malheuresement pas encore en arrière plan (quand l'on vide la RAM) mais envoie des notifications à la place. Je corrigerai ceci à l'avenir !


compile with expo (first go in the file directory afer unzipping and enter the file then open terminal)
compilez avec expo ( aller d'abord dans le répertoire du dossier après avoir dézippé, ensuite ouvrir le terminal)

1. npm install
2. npx expo install --fix
3. set EAS_NO_VCS=1
4. echo node_modules> .easignore
5. npx eas-cli build -p android --profile preview

NB : You can get the compiled apk from this link : https://drive.google.com/file/d/1Pgd0t995jkgS-OOU7TqJp255DUVCQRJj/view
NB : Vous pouvez obtenir la version apk compilée sur le lien suivant : https://drive.google.com/file/d/1Pgd0t995jkgS-OOU7TqJp255DUVCQRJj/view
