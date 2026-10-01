import {useEffect} from 'react';
import {useMembership} from '../components/Membership';
import {loadUnifiedQuestionSearch} from './question-search-loader';
import {rankQuestionEntries} from './question-search';
import {useState} from 'react';
export function useSourceSearch(query,language,source){
 const {revision}=useMembership();const [state,setState]=useState({});
 useEffect(()=>{let live=true;if(!query.trim())return;setState({});const timer=setTimeout(()=>loadUnifiedQuestionSearch(language).then(index=>{if(live)setState({query,results:rankQuestionEntries(index.filter(row=>row.entry.source===source),query)});}).catch(()=>{if(live)setState({query,error:true});}),180);return()=>{live=false;clearTimeout(timer);};},[query,language,source,revision]);
 return {results:state.query===query?state.results||[]:[],loading:!!query.trim()&&state.query!==query,error:state.query===query&&state.error};
}
