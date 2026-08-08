import { webkit } from 'playwright';
const out = '/Users/kylewensel/.buzz/.scratch/deploy-2a9ade6';
const pages = [['landing','https://credenzafashion.com/landing/'],['guides','https://credenzafashion.com/guides/'],['pricing','https://credenzafashion.com/pricing/'],['faq','https://credenzafashion.com/faq/']];
const b = await webkit.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 520 } });
for (const [name, url] of pages) {
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log(name, 'ok');
}
await b.close();
