const path=require("path");
const JSDOM=require(path.join("/sessions/quirky-confident-franklin/mnt/CasaRoca Ai System/prototipo/node_modules/jsdom")).JSDOM;
const fs=require("fs");
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="ps-app"></div></body></html>',{runScripts:"outside-only",pretendToBeVisual:true,url:"http://localhost/"});
const {window}=dom;
window.matchMedia=window.matchMedia||function(){return{matches:false,addEventListener(){},removeEventListener(){}};};
window.scrollTo=window.scrollTo||function(){};
const files=["data.js","landing-data.js","store.js","director-data.js","rocakids-data.js","pastor-data.js","pastor-rocakids.js","pastor.js","mobile.js"];
const errors=[];
for(const f of files){ try{ window.eval(fs.readFileSync("assets/js/"+f,"utf8")); }catch(e){ errors.push(f+": "+e.message); } }
if(errors.length){ console.log("LOAD ERRORS:\n"+errors.join("\n")); process.exit(1); }
console.log("Scripts cargados OK.");
try{ window.document.dispatchEvent(new window.Event("DOMContentLoaded")); }catch(e){ console.log("DCL err:",e.message); }
const appEl=window.document.getElementById("ps-app");
console.log("readyState:", window.document.readyState, "| app len:", appEl&&appEl.innerHTML.length);
const g=window.document.getElementById("ps-google");
console.log("login button:", !!g);
if(!g){ console.log("app innerHTML head:", appEl.innerHTML.slice(0,200)); process.exit(1); }
g.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const navCrm=window.document.querySelector('[data-accion="ir"][data-vista="crm"]');
console.log("nav CRM presente:", !!navCrm);
navCrm.dispatchEvent(new window.MouseEvent("click",{bubbles:true}));
const before=(window.document.getElementById("ps-crm-body")||{}).querySelectorAll?window.document.getElementById("ps-crm-body").querySelectorAll("tr").length:-1;
console.log("filas CRM antes:", before);
window.STORE.crmAgregar({nombres:"ZZTest",apellidos:"Central",correo:"zztest@central.com",genero:"M",ministerio:"General"},"verificacion");
const bodyAfter=window.document.getElementById("ps-crm-body");
const after=bodyAfter?bodyAfter.querySelectorAll("tr").length:-1;
const found=window.document.body.innerHTML.includes("ZZTest");
console.log("filas CRM después:", after, "| aparece ZZTest:", found);
console.log(found && after===before+1 ? "RESULTADO: OK" : "RESULTADO: REVISAR");
