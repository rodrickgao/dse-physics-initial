import {useEffect,useState} from 'react';
import {useMembership} from '../components/Membership';
import {searchQuestions} from './question-search-loader';
export function useSourceSearch(query,language,source){
 const {revision}=useMembership();const [state,setState]=useState({});
 const key=JSON.stringify([query,language,source,revision]);
 useEffect(()=>{
  if(!query.trim())return;
  const controller=new AbortController();
  const timer=setTimeout(()=>searchQuestions(language,query,{source,limit:50,signal:controller.signal})
   .then(data=>{if(!controller.signal.aborted)setState({key,results:data.results});})
   .catch(()=>{if(!controller.signal.aborted)setState({key,error:true});}),250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query,language,source,revision,key]);
 const ready=state.key===key;
 return {results:ready?state.results||[]:[],loading:!!query.trim()&&!ready,error:ready&&state.error};
}
