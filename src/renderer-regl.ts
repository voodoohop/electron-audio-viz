// import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer, DirectionalLight , Vector2, Vector3, ArrowHelper, Group, BufferAttribute, Line, BufferGeometry,LineBasicMaterial} from 'THREE';
import Stats = require('stats.js');

const {smooth, normalize, gaussSmoothList} = require("./smooth");

const smoothJs = require("smooth");

function log(...args) {
  console.log(...args);
  appendToDroidOutput(args.join(" "));
}

function pad(a,b){return(1e15+a+"").slice(-b)}

function getDroidOutput():HTMLTextAreaElement { return <HTMLTextAreaElement> document.getElementById("droid-output");  };
function getStatus():HTMLDivElement      { return <HTMLDivElement> document.getElementById("status");  };

const dialog = require('electron').remote.dialog;
var fs = require('fs'); // Load the File System to execute our common tasks (CRUD)



const Meyda = require('meyda');

const {createSongUri} = require("electron-audio-conversion");

interface WriteableArrayLike<T> {
  readonly length: number;
  [n: number]: T;
}

const {dirname,extname, basename} = require("path");

const tmpOutput = async (audioPath) => {
  const audioDirectory = dirname(audioPath);
  const audioExtension = extname(audioPath);
  console.log({audioExtension})
  const audioBaseName = basename(audioPath,audioExtension);
  const frameDir = `${audioDirectory}/${audioBaseName}_frames`;
  const frameGlobPath = frameDir + "/*.png";
  await runProcess("rm",["-r",frameDir]);
  await runProcess("mkdir",[frameDir]);
  const outputVideoPath = `${audioDirectory}/${audioBaseName}.mov`;
  return {frameDir,frameGlobPath, outputVideoPath, audioPath}
}

// const desiredFPS=20;
const bufferSize = 1024;
const hopSize = bufferSize;//Math.floor(44100/desiredFPS)
const outputFPS:number=44100/bufferSize;
const targetFPS = 20;
console.log("FPS",  outputFPS);
log("Meyda",Meyda);
log("hopSize",hopSize);
initApp();

const mime = require("mime-types");

interface LoadedAudio {
  audioPath: string,
  dataURI:  string
}

async function openAudioFileDialog() {
  return new Promise<LoadedAudio>((resolve, reject) => {
    dialog.showOpenDialog({properties: ['openFile', 'openDirectory', 'multiSelections']}, 
  async (files) => {
    const audioFileName = files[0];
    const mimeType = mime.lookup(audioFileName);
    log("loading song",audioFileName,mimeType)
    const song = await createSongUri(audioFileName,mimeType);
    log("loaded song");
    resolve({audioPath: audioFileName, dataURI: song});
  })
  })
}

async function initAudio(audioFeatureCallback: Function, onFinished:Function) {
  const audioContext = new AudioContext();
  log("audioContext",audioContext);
  const {dataURI, audioPath} = await openAudioFileDialog();

  const outputLocation = await tmpOutput(audioPath);

  var tune = new Audio(dataURI);
  document.body.appendChild(tune);
 log(tune);
  tune.controls = true;
  var source = audioContext.createMediaElementSource(tune);
  log("sample rate", audioContext.sampleRate);
  source.connect(audioContext.destination)
  let tick=0;
  const meydaAnalyzer = Meyda.createMeydaAnalyzer({
    "audioContext":audioContext, // required
    "source":source, // required
    bufferSize, // required
    hopSize, // optional
    // "windowingFunction": "hamming", // optional
    windowingFunction: 'blackman',// optional - A string, or an array of strings containing the names of features you wish to extract.
    "callback": (features) => audioFeatureCallback(features, outputLocation,tick++) // optional callback in which to receive the features fo
  });
    




    
    
    tune.addEventListener("ended",() => {
      meydaAnalyzer.stop();
      onFinished(outputLocation);
    })
    tune.addEventListener("canplay", () => { 
      log("starting to play");
      tune.muted = false;
      tune.volume=1;
      meydaAnalyzer.start(['amplitudeSpectrum', 'powerSpectrum','spectralCentroid', 'spectralRolloff', 'spectralFlatness','loudness', 'rms','mfcc',`perceptualSharpness`]);
      tune.play();
    })

    // log("audio", tune);



}



async function initApp() {
  log('App initialized!');

  /* stats */
  let stats = new Stats();
  document.body.appendChild(stats.dom);
  stats.showPanel(0);



  const width=512;
  const height=512;






    
  // Render Spectrogram



  const canvas = <HTMLCanvasElement> document.getElementById("web-gl-canvas")
  const regl = require('regl')({
    canvas,
    attributes: {
			alpha: true,
			depth: false,
      antialias: true,
      preserveDrawingBuffer:true
  
    },
    
  })
 
  const fftSize = Math.floor(1 * bufferSize/2)
  log("fftSize", fftSize);
  const frequencies = new Float32Array(fftSize)
  const fftBuffer = regl.buffer({
    length: fftSize*4,
    type: 'float',
    usage: 'dynamic'
  })

  const drawSpectrum = regl({
    vert: `
    precision mediump float;
    #define FFT_SIZE ${fftSize}
    #define PI ${Math.PI}
    attribute float index, frequency;
    uniform float angleoffset, scale,xoffset,yoffset;
    void main() {
      float theta = 2.0 * PI * index / float(FFT_SIZE) + (angleoffset * PI / 180.0) ;
      gl_Position = vec4(
        xoffset*2.0+ scale * cos(theta) * (1.0 + (frequency)*2.0),
        yoffset + scale * sin(theta) * (1.0 + (frequency)*2.0),
        0,
        1);
    }`,

    frag: `
    precision mediump float;
    uniform vec4 col;
    void main() {
      gl_FragColor = col;
    }`,

    attributes: {
      index: Array(fftSize).fill(0).map((_, i) => i),
      frequency: {
        buffer: fftBuffer,
        normalized: true
      }
    },
    elements: null,
    instances: -1,
    lineWidth: 1,
    depth: {enable: false},
    count: fftSize,
    primitive: 'triangle fan',
    uniforms: {
      angleoffset: regl.prop("angleOffset"),
      col: regl.prop("col"),
      scale: regl.prop("scale"),
      xoffset: regl.prop("xOffset"),
      yoffset: regl.prop("yOffset")
    },    
    blend: {
      enable: true,
      func: {
        src: 'src alpha',
        dst: 'one minus src alpha'
      }
    },
  })

  

    const smoother = smooth(0.7,0.94);
    const normalizer = normalize();
    const normalizer2 = normalize();

    // const gaussianSmoothingKernel = normaliseKernel([0.1, 0.2,0.2,0.2,0.2,0.3, 0.3,0.3, 0.3, 0.3,0.3, 0.3, 0.2,0.2,0.2,0.2,0.1]);
    // console.log()
    const convoluter = data => gaussSmoothList(data, 20)
    const smoother2 = smooth(0.98,0.98)
    let renderedFrame = 0;
    let renderedFrames=[];
    function render(features, outputLocation,tick) {
      // log(features);  
      stats.begin();
      // const features = a.get(['amplitudeSpectrum', 'spectralCentroid', 'spectralRolloff', 'loudness', 'rms']);

  
 
      // // log(features.amplitudeSpectrum)
      const smoothedFFT = 
      normalizer
      (
        smoother(
          // convoluter 
          (features.amplitudeSpectrum.slice(0,fftSize))).map(val => Math.log(val*10+1))
      );
      fftBuffer.subdata(smoothedFFT)
       regl.clear({
        color: [0.5, 0.5, 0.5, 1],
        depth: 0
      })
      // Draw the spectrum
      const cols=[[1,1,1,1],
      [0,0,0,1]];

      const smoothedExtraFeatures = smoother2(normalizer2([features.spectralCentroid, features.spectralRolloff])); 
      drawSpectrum(
        [{angleOffset: 0+tick/10,col:cols[0],scale:0.3+0.4*Math.sin(tick/70), xOffset: 0*smoothedExtraFeatures[0]*3-1.5*0,yOffset: smoothedExtraFeatures[1]*3-1.5*0},
        {angleOffset: 180+tick/30,col:cols[1], scale:0.1+0.4*Math.sin(tick/100), xOffset: 0* -1*(smoothedExtraFeatures[0]*2-1),yOffset: 0*-1*(smoothedExtraFeatures[1]*2-1)}]
      );
      // drawSpectrum(
      //   [{angleOffset: 0+0*tick/10,col:cols[0],scale:1.5+0*Math.sin(tick/50), xOffset: 0,yOffset:0},
      //   // {angleOffset: 180+tick/10,col:cols[1], scale:0.9+0.5*Math.sin(tick/30), xOffset: -1*(smoothedExtraFeatures[0]*2-1),yOffset: -1*(smoothedExtraFeatures[1]*2-1)}
      // ]m 
      // );
      // log(canvas.width);
      const base64png = canvas.toDataURL().split(",")[1];
      var buffer = new Buffer(base64png, 'base64');
      const framePath = `${outputLocation.frameDir}/frame_${pad(renderedFrame++, 5)}.png`;
      // renderedFrames.push({framePath, buffer});
      
      fs.writeFile(framePath,buffer,() => 
      // log(`written ${framePath}`  )
 null   
    );
     
 
      stats.end();
    }

    initAudio(render, async (outputLocation) => {
      log("ended, writing frames");
      // for (let {framePath,buffer} of renderedFrames) {
      //   await new Promise(res => fs.writeFile(framePath,buffer,res));
      //   log(`written ${framePath}`);
      // }
  
      log(JSON.stringify(outputLocation))
      const exitCode = await ffmpegCommand(outputLocation.audioPath, outputLocation.frameGlobPath ,outputFPS, outputLocation.outputVideoPath,targetFPS);
   });
 

    // regl.frame(({tick}) => {
    //   // Clear draw buffer

  
    //   // Poll microphone data
    //   // analyser.getByteFrequencyData(frequencies)
  
    //   // Here we use .subdata() to update the buffer in place

    // })
}




async function ffmpegCommand(audioPath:string, framesPath:string, inputFPS:number,outputPath, outputFPS:number=20):Promise<number> {
  // ffmpeg -pattern_type glob -framerate 20 -i "results/wildeJagd2/latest_net_G_waveformAmp/images/output/*.png"  -b 1296k results/wildeJagd2/latest_net_G_waveformAmp/video.avi
  // -c:v prores_ks -profile:v 3  -f mov -acodec libmp3lame -aq 2 -crf 17
  return await runProcess("ffmpeg", ["-y","-pattern_type","glob", "-framerate",""+inputFPS,"-i",framesPath,"-i",audioPath, "-b","1296k", "-c:v", "prores_ks","-profile:v", "3", "-f", "mov","-acodec", "libmp3lame", "-aq", "2", "-crf", "17","-r",""+outputFPS, outputPath]);
}



function appendToDroidOutput(msg) { getDroidOutput().value += msg+"\n"; getDroidOutput().scrollTop = getDroidOutput().scrollHeight;};
function setStatus(msg)           { getStatus().innerHTML = msg; appendToDroidOutput(msg)};

async function runProcess(cmd,args=[]):Promise<number> {
  return new Promise<number>(resolve =>{ 
    const process = require('child_process');   // The power of Node.JS
    log(`running: ${cmd} ${args.join(" ")}`)
    var ls = process.spawn(cmd, args);
    // var ls = process.spawn('./test.sh');
  
    ls.stdout.on('data', function (data) {
      // log('stdout: <' + data+'> ');
          // appendToDroidOutput(data);
      appendToDroidOutput('' + data+'');
    });

    ls.stderr.on('data', function (data) {
      // log('stderr: ' + data);
      appendToDroidOutput('stderr: <' + data+'>');
    });
    
    ls.on('close', function (code:number) {
      // log('child process exited with code ' + code);
          if (code == 0)
         setStatus(`child process complete.  ${cmd} ${args.join(" ")}`);
          else
         setStatus(`child process exited with code ${code} - ${cmd} ${args.join(" ")}`);
        getDroidOutput().style.background = "DarkGray";
        resolve(code);  
    });
  });
}