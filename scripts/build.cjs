'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');

function buildSite({root=path.join(__dirname,'..'),outDir=path.join(root,'dist'),updatedAt}={}){
  root=path.resolve(root);outDir=path.resolve(outDir);
  if(root===outDir||root.startsWith(outDir+path.sep))throw new Error('Folder hasil build harus terpisah dari sumber.');
  const productPath=path.join(root,'products.js');
  delete require.cache[require.resolve(productPath)];
  const bank=require(productPath);
  const products=require(path.join(root,'core.js')).prepareBank(bank);
  if(updatedAt===undefined){
    try{updatedAt=execFileSync('git',['log','-1','--format=%cI','--','products.js'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
    catch{throw new Error('Riwayat Git products.js tidak tersedia. Gunakan checkout dengan fetch-depth: 0.');}
    if(!updatedAt)throw new Error('Riwayat Git products.js tidak tersedia. Commit daftar produk sebelum build.');
  }
  if(typeof updatedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(updatedAt)||!Number.isFinite(Date.parse(updatedAt)))throw new Error('Tanggal pembaruan products.js tidak valid.');
  updatedAt=new Date(updatedAt).toISOString();
  const meta={count:products.length,updatedAt};
  const date=new Date(updatedAt).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Jakarta'});
  const description=`Latihan 100 soal acak dari ${products.length} produk. Data diperbarui ${date}. Nilai otomatis, riwayat latihan, dan mode fokus.`;
  const assets={},files=new Map();
  let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  for(const file of ['products.js','core.js','history.js','app.js','styles.css','favicon.svg']){
    let content=fs.readFileSync(path.join(root,file),'utf8');
    // Keep the catalog and its metadata in one immutable asset.
    if(file==='products.js')content+=`\n;globalThis.PRODUCT_META=Object.freeze(${JSON.stringify(meta)});\n`;
    const hash=createHash('sha256').update(content).digest('hex').slice(0,16);
    const extension=path.extname(file),name=`${path.basename(file,extension)}.${hash}${extension}`;
    assets[file]=name;files.set(name,content);
    const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html=html.replace(new RegExp(`((?:src|href)=")${escaped}(?:\\?[^\"]*)?(\")`,'g'),`$1${name}$2`);
  }
  html=html.replace(/(<meta name="description" content=")[^"]*(">)/,`$1${description}$2`);
  files.set('index.html',html);files.set('.nojekyll','');
  // All validation and reads finish before replacing generated output.
  fs.rmSync(outDir,{recursive:true,force:true});fs.mkdirSync(outDir,{recursive:true});
  for(const [name,content] of files)fs.writeFileSync(path.join(outDir,name),content);
  return {...meta,assets};
}

if(require.main===module){
  try{const result=buildSite({updatedAt:process.env.PRODUCTS_UPDATED_AT});console.log(`Built ${result.count} products; products.js updated ${result.updatedAt}`);}
  catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={buildSite};
