compile with expo (first go in the file directory afer unzipping and enter the file then open terminal)
1. npm install
2. npx expo install --fix
3. set EAS_NO_VCS=1
4. echo node_modules> .easignore
5. npx eas-cli build -p android --profile preview
