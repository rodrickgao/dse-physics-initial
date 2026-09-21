import { jsx as baseJsx, jsxs as baseJsxs, Fragment } from 'react/jsx-runtime';
import { jsxDEV as baseDev } from 'react/jsx-dev-runtime';
import { translate } from './ui-translations';
export { Fragment };
function localized(type,props){
 if(typeof type!=='string'||!props||props.translate==='no'||props.className==='tutoring-message')return props;
 const result={...props};
 for(const key of ['title','placeholder','aria-label','alt'])if(typeof result[key]==='string')result[key]=translate(result[key]);
 const child=value=>typeof value==='string'?translate(value):Array.isArray(value)?value.map(child):value;
 result.children=child(props.children);return result;
}
export const jsx=(type,props,key)=>baseJsx(type,localized(type,props),key);
export const jsxs=(type,props,key)=>baseJsxs(type,localized(type,props),key);
export const jsxDEV=(type,props,...args)=>baseDev(type,localized(type,props),...args);
