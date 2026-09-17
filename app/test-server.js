const http = require('http');
http.createServer((req, res) => {
  console.log('Request:', req.url);
  res.writeHead(200);
  res.end('ok');
}).listen(3000, '0.0.0.0', () => {
  console.log('Test server on 3000');
});