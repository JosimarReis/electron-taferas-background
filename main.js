const { app, BrowserWindow, ipcMain, dialog } = require("electron");

const cpus = require('os').cpus().length;
console.log('cpus: ' + cpus);

//pilha de threads de plano de fundo disponiveis
var available = []

//filas de tarefas a serem execudatas
var tasks = []

// distribui as tarefas para threads em espera
function doIt() {
  while (available.length > 0 && tasks.length > 0) {
    var task = tasks.shift()
    available.shift().send(task[0], task[1])
  }
  renderer.webContents.send('status', available.length, tasks.length)
}

// Crie uma janela oculta em segundo plano
function createBgWindow() {
  result = new BrowserWindow({
    show: false, webPreferences: {
      nodeIntegration: true,
    }
  })
  result.loadURL('file://' + __dirname + '/background.html')
  result.on('closed', () => {
    console.log('background window closed')
  });
  return result
}

app.on('ready', function () {
  // Create the "renderer" window which contains the visible UI
  renderer = new BrowserWindow({
    width: 1024,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
    },
    autoHideMenuBar: true,
    show: false,
  })
  renderer.webContents.openDevTools();

  renderer.loadURL('file://' + __dirname + '/renderer.html')
  renderer.show()
  renderer.on('closed', () => {
    // call quit to exit, otherwise the background windows will keep the app running
    app.quit()
  })

  // create background thread for each cpu
  for (var i = 0; i < cpus; i++) createBgWindow()

  // Thread principal pode receber diretamente do Windows
  ipcMain.on('to-main', (event, arg) => {
    console.log(arg)
  });

  // O Windows pode se comunicar via main
  ipcMain.on('for-renderer', (event, arg) => {
    renderer.webContents.send('to-renderer', arg);
  });
  ipcMain.on('for-background', (event, arg) => {
    tasks.push(['message', arg])
    doIt()
  });

  // processamento pesado feito no encadeamento em segundo plano
  // para que a interface do usuário e os threads principais permaneçam responsivos
  ipcMain.on('assign-task', (event, arg) => {
    tasks.push(['task', arg])
    doIt()
  });

  ipcMain.on('ready', (event, arg) => {
    available.push(event.sender)
    doIt()
  })
})