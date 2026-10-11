const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {buildSite}=require('../scripts/build.cjs');
const source=path.join(__dirname,'..');

function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'quiz-build-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const file of ['index.html','styles.css','favicon.svg','products.js','core.js','history.js','app.js'])fs.copyFileSync(path.join(source,file),path.join(root,file));
  const git=(args,env={})=>execFileSync('git',args,{cwd:root,env:{...process.env,...env},stdio:'pipe'}).toString().trim();
  git(['init','--initial-branch=main']);git(['config','user.name','Build test']);git(['config','user.email','build@example.invalid']);
  const commit=(date)=>{git(['add','.']);git(['commit','-m','Fixture update'],{GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date});};
  const bank=Array.from({length:113},(_,i)=>({code:String(i+1).padStart(5,'0'),name:`PRODUK ${i+1}`}));
  const writeBank=()=>fs.writeFileSync(path.join(root,'products.js'),`(function(root){const products=${JSON.stringify(bank)};if(typeof module==='object'&&module.exports)module.exports=products;else root.PRODUCT_BANK=products;})(globalThis);\n`);
  writeBank();commit('2026-01-01T12:00:00Z');
  return {root,bank,writeBank,commit,build:()=>buildSite({root,outDir:path.join(root,'dist')})};
}

function readBuilt(f){
  const html=fs.readFileSync(path.join(f.root,'dist/index.html'),'utf8');
  const productAsset=html.match(/src="(products\.[a-f0-9]+\.js)"/)[1];
  const context={};vm.runInNewContext(fs.readFileSync(path.join(f.root,'dist',productAsset),'utf8'),context);
  return {html,productAsset,meta:JSON.parse(JSON.stringify(context.PRODUCT_META)),bank:context.PRODUCT_BANK};
}

test('a product-only commit updates count, date and asset URL without editing other source files',t=>{
  const f=fixture(t);f.build();const initial=readBuilt(f);
  const originalHtml=fs.readFileSync(path.join(f.root,'index.html'),'utf8');
  assert.equal(initial.meta.count,113);assert.equal(initial.meta.updatedAt,'2026-01-01T12:00:00.000Z');
  f.bank.push({code:'99999',name:'PRODUK BARU'});f.writeBank();f.commit('2026-02-02T18:30:00Z');
  f.build();const added=readBuilt(f);
  assert.equal(added.bank.length,114);assert.equal(added.meta.count,114);
  assert.equal(added.meta.updatedAt,'2026-02-02T18:30:00.000Z');
  assert.notEqual(added.productAsset,initial.productAsset);
  assert.match(added.html,/114 produk.*3 Februari 2026/);
  assert.equal(fs.readFileSync(path.join(f.root,'index.html'),'utf8'),originalHtml);
  fs.appendFileSync(path.join(f.root,'app.js'),'\n// Unrelated UI change\n');f.commit('2026-03-03T12:00:00Z');
  f.build();const unrelated=readBuilt(f);
  assert.equal(unrelated.meta.updatedAt,added.meta.updatedAt);
  assert.equal(unrelated.productAsset,added.productAsset);
  for(const ref of unrelated.html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g))assert(fs.existsSync(path.join(f.root,'dist',ref[1])),ref[1]);
});

test('renaming a product changes its asset URL even when the catalog count is unchanged',t=>{
  const f=fixture(t);f.build();const before=readBuilt(f);
  f.bank[0].name='NAMA PRODUK DIPERBARUI';f.writeBank();f.commit('2026-04-04T12:00:00Z');f.build();
  const after=readBuilt(f);assert.equal(after.meta.count,before.meta.count);
  assert.equal(after.bank[0].name,'NAMA PRODUK DIPERBARUI');assert.notEqual(after.productAsset,before.productAsset);
});

test('invalid product data fails the build before replacing an existing deployment',t=>{
  const f=fixture(t);f.build();const before=readBuilt(f);
  f.bank.push({...f.bank[0]});f.writeBank();
  assert.throws(()=>f.build(),/duplikat/i);
  assert.equal(readBuilt(f).productAsset,before.productAsset);
});

test('a build without Git history requires a verified timestamp instead of inventing today',t=>{
  const f=fixture(t);fs.rmSync(path.join(f.root,'.git'),{recursive:true,force:true});
  assert.throws(()=>f.build(),/riwayat Git/i);
  const result=buildSite({root:f.root,outDir:path.join(f.root,'dist'),updatedAt:'2026-05-05T12:00:00Z'});
  assert.equal(result.updatedAt,'2026-05-05T12:00:00.000Z');
  assert.throws(()=>buildSite({root:f.root,updatedAt:'not-a-date'}),/tanggal/i);
});
