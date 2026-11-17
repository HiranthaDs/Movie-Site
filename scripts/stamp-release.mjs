import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const output=new URL('../dist/client/',import.meta.url);
const root=fileURLToPath(output);
const digest=createHash('sha256');
async function include(directory){
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const path=join(directory,entry.name);
    if(entry.isDirectory())await include(path);
    else if(entry.isFile()&&relative(root,path)!=='sw.js'){
      digest.update(relative(root,path).replaceAll('\\','/'));
      digest.update(await readFile(path));
    }
  }
}
await include(root);
const hash=digest.digest('hex').slice(0,12);
const serviceWorker=new URL('sw.js',output);
const source=await readFile(serviceWorker,'utf8');
const stamped=source.replace(/var VERSION='cinera-v\d+-[^']+';/,`var VERSION='cinera-v10-${hash}';`);
if(stamped===source)throw new Error('Could not stamp the service worker release.');
await writeFile(serviceWorker,stamped);
console.log(`PWA release cinera-v10-${hash}`);
