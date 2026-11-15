import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIME={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
export function createPreviewServer(root, prefix='/') {
  const base=path.resolve(root);
  return http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      const pathname=decodeURIComponent(url.pathname);
      if(!pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
      let relative=pathname.slice(prefix.length);
      if(!relative||relative.endsWith('/'))relative+='index.html';
      const file=path.resolve(base,relative);
      if(file!==base&&!file.startsWith(base+path.sep)){res.writeHead(403);res.end();return;}
      const data=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(data);
    } catch {res.writeHead(404);res.end('Not found');}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..',process.argv.includes('--source')?'.':'www');
  const port=Number(process.env.PORT||8768);
  const server=createPreviewServer(root);
  server.listen(port,'127.0.0.1',()=>console.log(`萃离预览：http://127.0.0.1:${port}/`));
}
