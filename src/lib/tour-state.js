import {CORE_STEP_COUNT} from './tour-steps.js';
export const TOUR_VERSION=4;
export const tourKey=id=>`ddphysics-tour:v${TOUR_VERSION}:${encodeURIComponent(id)}`;
export const freshTour=()=>({version:TOUR_VERSION,status:'not-started',lastCompleted:-1,skippedSteps:[],pages:{}});
export function readTour(storage,id){
 try{const value=JSON.parse(storage.getItem(tourKey(id)));if(value?.version!==TOUR_VERSION){const old=JSON.parse(storage.getItem(`ddphysics-tour:v3:${encodeURIComponent(id)}`))||JSON.parse(storage.getItem(`ddphysics-tour:v2:${encodeURIComponent(id)}`))||JSON.parse(storage.getItem(`ddphysics-tour:v1:${encodeURIComponent(id)}`));return old&&['completed','skipped'].includes(old.status)?{...freshTour(),status:old.status}:freshTour();}
 return {version:TOUR_VERSION,status:['not-started','in-progress','completed','skipped'].includes(value.status)?value.status:'not-started',lastCompleted:Number.isInteger(value.lastCompleted)?Math.max(-1,Math.min(CORE_STEP_COUNT-1,value.lastCompleted)):-1,skippedSteps:Array.isArray(value.skippedSteps)?[...new Set(value.skippedSteps.filter(n=>Number.isInteger(n)&&n>=0&&n<CORE_STEP_COUNT))]:[],pages:value.pages&&typeof value.pages==='object'&&!Array.isArray(value.pages)?value.pages:{}};
 }catch{return freshTour();}
}
export function saveTour(storage,id,value){try{storage.setItem(tourKey(id),JSON.stringify(value));return true;}catch{return false;}}
export function completeTourStep(value,index){const skippedSteps=(value.skippedSteps||[]).filter(n=>n!==index);return {...value,skippedSteps,status:index===CORE_STEP_COUNT-1?(skippedSteps.length?'skipped':'completed'):'in-progress',lastCompleted:Math.max(value.lastCompleted,index)};}
