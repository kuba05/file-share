const express = require('express');
const path = require('path');
const fs = require('fs');

const { ArgumentParser } = require('argparse');
const parser = new ArgumentParser({
  description: 'Simple file sharing server'
});

parser.add_argument('-d', '--dev', { action: 'store_true', help: 'run in dev mode' });
parser.add_argument('-q', '--qr', { action: 'store_true', help: 'show qr code' });
parser.add_argument('-p', '--port', { type: 'int' });
parser.add_argument('folder', { nargs: '?', default: path.join(__dirname, 'shared'), help: 'shared folder' });

const app = express();
const argv = parser.parse_args();

const sharedFolder = argv.folder;
const buildFolder = path.join(__dirname, 'client', 'build');

if (!fs.existsSync(sharedFolder)) {
  fs.mkdirSync(sharedFolder);
}

if (!fs.existsSync(buildFolder) || !fs.readdirSync(buildFolder).includes('index.html')) {
  console.log('Couldn\'t find index.html. Try rebuilding the client');
  process.exit(1);
}

app.use(require('express-fileupload')());
app.use(require('cors')());
app.use(require('morgan')('dev'));

app.use('/', express.static(buildFolder));
app.use('/files', express.static(sharedFolder, { dotfiles: 'allow' }));

app.post('/upload', ({ files }, res) => {
  try {
    if (!files || !files.uploads) {
      return res.send({ error: 'No files selected' });
    }

    files.uploads.forEach((file) => {
      const { name } = file;
      file.mv(path.join(sharedFolder, name));
    });

    res.redirect('/?error=none');
  } catch (err) {
    console.error(err);
    res.send({ error: 'Internal error' });
  }
});

app.get('/list', async (req, res) => {
  try {
    const folder = path.join(sharedFolder, req.query.path);
    console.log('path', folder);
    console.log('req', req.query);

    if (!fs.existsSync(folder)) {
      return res.send({ error: 'Folder does not exist' });
    }

    const contents = await fs
      .promises
      .readdir(folder);

    const files = contents.filter(item => fs
      .lstatSync(path.join(folder, item))
      .isFile()
    );

    const folders = contents.filter(item => fs
      .lstatSync(path.join(folder, item))
      .isDirectory()
    );

    res.send({ files, folders });
  } catch (err) {
    console.error(err);
    res.send({ error: 'Internal error' });
  }
});

console.log(`Using folder: ${sharedFolder}`);

if (argv.dev) {
  const port = 5000;
  app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
} else {
  const port = argv.port !== undefined ? argv.port : 0; // port 0 = OS chooses random free port

  const server = app.listen(port, () => {
    const { port } = server.address();
    const ip = require('ip').address('public');

    const address = `http://${ip}:${port}`;

    require('qrcode-terminal').generate(address, { small: true });

    console.log(`Listening at ${address}`);
  });
}
