import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let pythonProcess;

// This function creates the main Electron browser window.
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: false,
        },
    });

    // Load your built React app's index.html file.
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

    // Once the window is ready to be shown, make it visible.
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle window close event.
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

// This function spawns the Python backend process.
const startPythonServer = () => {
    // Determine the path to the Python executable.
    const pythonExecutable = process.platform === 'win32' ? 'python.exe' : 'python';
    
    // Path to your server.py file. Adjust if your directory structure changes.
    const pythonScriptPath = path.join(__dirname, '..', 'back-end', 'server.py');

    // Spawn the Python process.
    pythonProcess = spawn(pythonExecutable, [pythonScriptPath]);
    
    // Log output from the Python process for debugging.
    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python Server: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Server Error: ${data}`);
    });
};

// App event listeners
app.on('ready', () => {
    startPythonServer();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    // Ensure the Python process is killed when the app closes.
    if (pythonProcess) {
        console.log("Stopping Python server.");
        pythonProcess.kill();
    }
});