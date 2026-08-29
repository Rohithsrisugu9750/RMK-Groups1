const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Server is ALIVE! If you see this, the problem is missing dependencies. Please run "npm install" on the server or use the Hostinger hPanel to install them.\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('Test server running on port ' + PORT);
});
