import {useEffect,useState} from 'react';
import {useMembership} from '../components/Membership';
import {searchQuestions} from './question-search-loader';
export function useSourceSearch(query,language,source){
 const {revision}=useMembership();const [state,setState]=useState({});
 useEffect(()=>{let live=true;if(!query.trim())return;setState({});const timer=setTimeout(()=>searchQuestions(language,query,{source,limit:50}).then(data=>{if(live)setState({query,results:data.results});}).catch(()=>{if(live)setState({query,error:true});}),250);return()=>{live=false;clearTimeout(timer);};},[query,language,source,revision]);
 return {results:state.query===query?state.results||[]:[],loading:!!query.trim()&&state.query!==query,error:state.query===query&&state.error};
}
