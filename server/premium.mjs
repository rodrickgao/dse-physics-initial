export function protectStudyFiles(req, res) {
  // Compatibility fail-closed guard. Use createApi().protectFiles for the authenticated proxy.
  const path=new URL(req.url,'http://localhost').pathname;
  if (/text-papers|textbook-exercises|textbook-examples|knowledge-network-data|paper2-knowledge-data/.test(path)) {
    res.writeHead(404,{'Cache-Control':'no-store'});res.end('Not found');return true;
  }
  return false;
}
