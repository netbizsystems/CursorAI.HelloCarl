module.exports = {
  apps: [
    {
      name: 'hellodave-live',
      cwd: 'C:/Users/dande/source/repos/CursorAI.HelloDave',
      script: 'npm.cmd',
      args: 'run dev:all',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 20,
    },
  ],
};
