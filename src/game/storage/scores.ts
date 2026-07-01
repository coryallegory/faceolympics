import type { EventResult } from '../core/types';
const KEY='face-olympics-results-v1';
export function saveResult(result:EventResult):void{const history=loadResults().filter((item)=>item.eventId!==result.eventId);localStorage.setItem(KEY,JSON.stringify([...history,result]));}
export function loadResults():EventResult[]{const raw=localStorage.getItem(KEY);if(!raw)return [];const parsed=JSON.parse(raw) as EventResult[];return Array.isArray(parsed)?parsed:[];}
