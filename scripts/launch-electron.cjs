const { spawn } = require('child_process');
const electronBinary = require('electron');

const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ['.'], {
  stdio: 'inherit',
  env: cleanEnv,
  windowsHide: false,
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
