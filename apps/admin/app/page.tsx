"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Item={document_id:string;professional_id:string;professional_name:string;headline:string|null;city:string|null;state:string|null;years_experience:number;document_type:string;document_path:string;submitted_at:string};
type Professional={user_id:string;display_name:string|null;headline:string|null;city:string|null;state:string|null;verification_status:string;trust_score:number;is_available:boolean;service_radius_km:number};
type Skill={id:string;name:string;category:string;description:string|null;is_active:boolean;professional_count:number};
type Area={id:string;label:string;city:string|null;state:string|null;latitude:number|null;longitude:number|null;radius_km:number;is_primary:boolean};
type Reputation=Record<string,any>;
type Portfolio={id:string;professional_id:string;professional_name:string;title:string;description:string|null;media_url:string;moderation_status:"pending"|"approved"|"rejected";moderation_note:string|null;created_at:string};

const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||"",process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"");

export default function AdminHome(){
 const[session,setSession]=useState<any>(null);
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState("");
 const[items,setItems]=useState<Item[]>([]),[pros,setPros]=useState<Professional[]>([]),[skills,setSkills]=useState<Skill[]>([]);
 const[areas,setAreas]=useState<Area[]>([]),[reputation,setReputation]=useState<Reputation|null>(null),[customers,setCustomers]=useState<any[]>([]),[complaints,setComplaints]=useState<any[]>([]),[portfolio,setPortfolio]=useState<Portfolio[]>([]);\n const[areaDraft,setAreaDraft]=useState<Partial<Area>|null>(null),[areaSaving,setAreaSaving]=useState(false);
 const[selected,setSelected]=useState<Professional|null>(null),[loading,setLoading]=useState(false);

 useEffect(()=>{
   supabase.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)loadAll()});
   const sub=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(s)loadAll()});
   return()=>sub.data.subscription.unsubscribe();
 },[]);

 async function login(){setMessage("");const{error}=await supabase.auth.signInWithPassword({email,password});if(error)setMessage(error.message)}
 async function loadAll(){await Promise.all([load(),loadMarketplace(),loadSkills(),loadCustomers(),loadComplaints(),loadPortfolio()])}
 async function loadPortfolio(){const{data,error}=await supabase.rpc("admin_portfolio_moderation");if(error)setMessage(error.message);else setPortfolio((data||[]) as Portfolio[])}
 async function load(){setLoading(true);const{data,error}=await supabase.rpc("admin_pending_verifications");if(error)setMessage(error.message);else setItems((data||[]) as Item[]);setLoading(false)}
 async function loadMarketplace(){const{data,error}=await supabase.rpc("admin_marketplace_professionals");if(error)setMessage(error.message);else setPros((data||[]) as Professional[])}
 async function loadSkills(){const{data,error}=await supabase.rpc("admin_marketplace_skills");if(error)setMessage(error.message);else setSkills((data||[]) as Skill[])}
 async function loadCustomers(){const{data,error}=await supabase.rpc("admin_customer_reputation");if(error)setMessage(error.message);else setCustomers(data||[])}
 async function loadComplaints(){const{data,error}=await supabase.rpc("admin_complaints");if(error)setMessage(error.message);else setComplaints(data||[])}
 async function reviewComplaint(id:string,status:string){const note=window.prompt("Admin note (optional):")||null;const{error}=await supabase.rpc("admin_review_complaint",{p_complaint_id:id,p_status:status,p_note:note});if(error)setMessage(error.message);else{setMessage("Complaint updated.");await loadComplaints();await loadCustomers();await loadMarketplace();}}
 async function review(id:string,decision:"approved"|"rejected"){const note=decision==="rejected"?window.prompt("Reason for rejection (optional):")||null:null;setLoading(true);const{error}=await supabase.rpc("admin_review_verification",{p_document_id:id,p_decision:decision,p_note:note});if(error)setMessage(error.message);else{setMessage(decision==="approved"?"Professional approved.":"Professional rejected.");await loadMarketplace();await load()}}
 async function openDocument(item:Item){const{data,error}=await supabase.storage.from("verification-documents").createSignedUrl(item.document_path,300);if(error)setMessage(error.message);else if(data?.signedUrl)window.open(data.signedUrl,"_blank")}
 async function setStatus(id:string,status:"active"|"suspended"){const{error}=await supabase.rpc("admin_set_professional_status",{p_user_id:id,p_status:status});if(error)setMessage(error.message);else await loadMarketplace()}
 async function setAvailability(id:string,available:boolean){const{error}=await supabase.rpc("admin_set_professional_availability",{p_user_id:id,p_available:available});if(error)setMessage(error.message);else await loadMarketplace()}
 async function inspectProfessional(p:Professional){
   setSelected(p);setReputation(null);setAreas([]);
   const[a,r]=await Promise.all([supabase.rpc("admin_professional_service_areas",{p_user_id:p.user_id}),supabase.rpc("admin_professional_reputation",{p_user_id:p.user_id})]);
   if(a.error)setMessage(a.error.message);else setAreas((a.data||[]) as Area[]);
   if(r.error)setMessage(r.error.message);else setReputation(r.data||{});
 }
 async function saveArea(action:"create"|"update"|"delete",area?:Area){
  if(!selected)return;
  if(action!=="delete"&&!areaDraft)return;
  setAreaSaving(true);
  const d=areaDraft||area||{};
  const {error}=await supabase.rpc("admin_save_professional_service_area",{
    p_action:action,p_user_id:selected.user_id,p_area_id:area?.id||null,
    p_label:d.label||null,p_city:d.city||null,p_state:d.state||null,
    p_latitude:d.latitude??null,p_longitude:d.longitude??null,
    p_radius_km:Number(d.radius_km||10),p_is_primary:Boolean(d.is_primary)
  });
  setAreaSaving(false);
  if(error){setMessage(error.message);return;}
  setAreaDraft(null);setMessage(action==="delete"?"Service area deleted.":"Service area saved.");await inspectProfessional(selected);
}
async function setSkill(id:string,active:boolean){const{error}=await supabase.rpc("admin_set_skill_status",{p_skill_id:id,p_active:active});if(error)setMessage(error.message);else await loadSkills()}
 async function reviewPortfolio(id:string,decision:"approved"|"rejected"){const note=window.prompt(decision==="rejected"?"Reason for rejection (optional):":"Admin note (optional):")||null;const{error}=await supabase.rpc("admin_review_portfolio",{p_portfolio_id:id,p_decision:decision,p_note:note});if(error)setMessage(error.message);else{setMessage(decision==="approved"?"Portfolio item approved.":"Portfolio item rejected.");await loadPortfolio()}}

 if(!session)return <main style={s.wrap}><div style={s.card}><h1>VASUDHA CONNECT</h1><p style={s.muted}>Admin control centre</p><input style={s.input} placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)}/><input style={s.input} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/><button style={s.primary} onClick={login}>Sign in</button>{message&&<p>{message}</p>}<p style={s.note}>Only users explicitly added to the VASUDHA admin allow-list can access this dashboard.</p></div></main>;

 return <main style={s.wrap}>
  <header style={s.header}><div><h1>VASUDHA CONNECT ADMIN</h1><p style={s.muted}>Marketplace control centre</p></div><button style={s.secondary} onClick={()=>supabase.auth.signOut()}>Sign out</button></header>
  {message&&<div style={s.alert}>{message}</div>}

  <section style={s.card}><div style={s.row}><h2>Pending verification</h2><button style={s.secondary} onClick={load}>Refresh</button></div>
   {loading&&!items.length?<p>Loading...</p>:!items.length?<p style={s.muted}>No pending verification requests.</p>:items.map(x=><article key={x.document_id} style={s.item}><div style={{flex:1}}><h3>{x.professional_name}</h3><p>{x.headline||"Professional"}{x.city?" • "+x.city:""}{x.state?", "+x.state:""}</p><p style={s.muted}>{x.years_experience} years • {x.document_type} • {new Date(x.submitted_at).toLocaleString()}</p></div><div style={s.actions}><button style={s.secondary} onClick={()=>openDocument(x)}>View document</button><button style={s.primary} onClick={()=>review(x.document_id,"approved")}>Approve</button><button style={s.danger} onClick={()=>review(x.document_id,"rejected")}>Reject</button></div></article>)}
  </section>

  <section style={s.card}><div style={s.row}><h2>Professionals</h2><button style={s.secondary} onClick={loadMarketplace}>Refresh</button></div>
   {!pros.length?<p style={s.muted}>No professionals registered yet.</p>:pros.map(x=><article key={x.user_id} style={s.item}>
    <div style={{flex:1}}><h3>{x.display_name||"Professional"}</h3><p>{x.headline||"No headline"}{x.city?" • "+x.city:""}{x.state?", "+x.state:""}</p><p style={s.muted}>{x.verification_status} • Trust {Math.round(x.trust_score||0)}/100 • {x.is_available?"Available":"Unavailable"} • {x.service_radius_km} km</p></div>
    <div style={s.actions}><button style={s.secondary} onClick={()=>inspectProfessional(x)}>Reputation & areas</button><button style={s.secondary} onClick={()=>setAvailability(x.user_id,!x.is_available)}>{x.is_available?"Set unavailable":"Set available"}</button>{x.verification_status==="verified"&&<button style={s.secondary} onClick={()=>setStatus(x.user_id,"active")}>Activate</button>}<button style={s.danger} onClick={()=>setStatus(x.user_id,"suspended")}>Suspend</button></div>
   </article>)}
  </section>

  {selected&&<section style={s.card}><div style={s.row}><div><h2>{selected.display_name||"Professional"}</h2><p style={s.muted}>Reputation and service-area detail</p></div><button style={s.secondary} onClick={()=>setSelected(null)}>Close</button></div>
   <div style={s.grid}>{[
    ["Trust score",\`\${Math.round(reputation?.trust_score??selected.trust_score??0)}/100\`],
    ["Average rating",\`\${reputation?.avg_rating??0}/5\`],
    ["Jobs completed",\`\${reputation?.jobs_completed??0} / \${reputation?.jobs_total??0}\`],
    ["Completion rate",\`\${Math.round(reputation?.completion_rate??0)}%\`],
    ["Cancellation rate",\`\${Math.round(reputation?.cancellation_rate??0)}%\`],
    ["Response rate",\`\${Math.round(reputation?.response_rate??0)}%\`],
    ["Would hire again",\`\${reputation?.would_hire_again_pct??0}%\`],
    ["Reviews",\`\${reputation?.reviews_total??0}\`],
   ].map(([a,b])=><div key={a} style={s.metric}><span style={s.muted}>{a}</span><strong>{b}</strong></div>)}</div>
   <h3>Service areas</h3><button style={s.primary} onClick={()=>setAreaDraft({label:"",city:selected.city||"",state:selected.state||"",radius_km:10,is_primary:areas.length===0})}>Add service area</button>
   {areaDraft&&<div style={s.editor}>
    <input style={s.input} placeholder="Area label" value={areaDraft.label||""} onChange={e=>setAreaDraft({...areaDraft,label:e.target.value})}/>
    <div style={s.two}><input style={s.input} placeholder="City" value={areaDraft.city||""} onChange={e=>setAreaDraft({...areaDraft,city:e.target.value})}/><input style={s.input} placeholder="State" value={areaDraft.state||""} onChange={e=>setAreaDraft({...areaDraft,state:e.target.value})}/></div>
    <div style={s.two}><input style={s.input} type="number" step="0.000001" placeholder="Latitude" value={areaDraft.latitude??""} onChange={e=>setAreaDraft({...areaDraft,latitude:e.target.value===""?null:Number(e.target.value)})}/><input style={s.input} type="number" step="0.000001" placeholder="Longitude" value={areaDraft.longitude??""} onChange={e=>setAreaDraft({...areaDraft,longitude:e.target.value===""?null:Number(e.target.value)})}/></div>
    <div style={s.two}><input style={s.input} type="number" min="1" max="500" placeholder="Radius km" value={areaDraft.radius_km??10} onChange={e=>setAreaDraft({...areaDraft,radius_km:Number(e.target.value)})}/><label style={s.check}><input type="checkbox" checked={Boolean(areaDraft.is_primary)} onChange={e=>setAreaDraft({...areaDraft,is_primary:e.target.checked})}/> Primary area</label></div>
    <div style={s.actions}><button style={s.primary} disabled={areaSaving} onClick={()=>saveArea(areaDraft.id?"update":"create",areaDraft as Area)}>{areaSaving?"Saving...":"Save area"}</button><button style={s.secondary} onClick={()=>setAreaDraft(null)}>Cancel</button></div>
   </div>}
   {!areas.length?<p style={s.muted}>No service areas configured.</p>:areas.map(a=><div key={a.id} style={s.area}><div><strong>{a.label}</strong><span style={{display:"block"}}>{a.city||""}{a.state?", "+a.state:""} • {a.radius_km} km{a.is_primary?" • Primary":""}</span></div><div style={s.actions}><button style={s.secondary} onClick={()=>setAreaDraft({...a})}>Edit</button><button style={s.danger} onClick={()=>saveArea("delete",a)}>Delete</button></div></div>)}
  </section>}

  <section style={s.card}><div style={s.row}><h2>Complaints & Disputes</h2><button style={s.secondary} onClick={loadComplaints}>Refresh</button></div>{!complaints.length?<p style={s.muted}>No complaints reported.</p>:complaints.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.category.replaceAll("_"," ")} • {x.status}</h3><p>{x.reporter_name||"User"} reported {x.against_name||"User"}</p><p>{x.description}</p><p style={s.muted}>Job: {x.job_id} • {new Date(x.created_at).toLocaleString()}</p></div><div style={s.actions}>{x.status==="open"&&<button style={s.secondary} onClick={()=>reviewComplaint(x.id,"under_review")}>Review</button>}{x.status==="under_review"&&<><button style={s.danger} onClick={()=>reviewComplaint(x.id,"upheld")}>Uphold</button><button style={s.secondary} onClick={()=>reviewComplaint(x.id,"dismissed")}>Dismiss</button></>}{x.status==="upheld"&&<button style={s.secondary} onClick={()=>reviewComplaint(x.id,"resolved")}>Resolve</button>}</div></article>)}</section>

  <section style={s.card}><div style={s.row}><h2>Portfolio Moderation</h2><button style={s.secondary} onClick={loadPortfolio}>Refresh</button></div>{!portfolio.length?<p style={s.muted}>No portfolio items submitted.</p>:portfolio.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.title} <span style={{fontSize:12,fontWeight:500}}>• {x.moderation_status}</span></h3><p>{x.professional_name}</p>{x.description&&<p>{x.description}</p>}<p style={s.muted}>{new Date(x.created_at).toLocaleString()}{x.moderation_note?" • "+x.moderation_note:""}</p><a href={x.media_url} target="_blank" rel="noreferrer">View media</a></div><div style={s.actions}>{x.moderation_status==="pending"&&<><button style={s.primary} onClick={()=>reviewPortfolio(x.id,"approved")}>Approve</button><button style={s.danger} onClick={()=>reviewPortfolio(x.id,"rejected")}>Reject</button></>}</div></article>)}</section>

  <section style={s.card}><div style={s.row}><h2>Customers & Reputation</h2><button style={s.secondary} onClick={loadCustomers}>Refresh</button></div>{!customers.length?<p style={s.muted}>No customer reputation data yet.</p>:customers.map(x=><article key={x.user_id} style={s.item}><div style={{flex:1}}><h3>{x.display_name||"Customer"}</h3><p>{x.city||""}{x.state?", "+x.state:""}</p><p style={s.muted}>Trust {Math.round(x.customer_trust_score||0)}/100 • {x.jobs_completed||0} jobs completed • {x.reviews_received||0} reviews • Would work again {x.would_work_again_pct||0}%</p></div></article>)}</section>

  <section style={s.card}><div style={s.row}><h2>Skill catalogue</h2><button style={s.secondary} onClick={loadSkills}>Refresh</button></div>
   {skills.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.name}</h3><p style={s.muted}>{x.category} • {x.professional_count} professionals{x.description?" • "+x.description:""}</p></div><button style={x.is_active?s.danger:s.primary} onClick={()=>setSkill(x.id,!x.is_active)}>{x.is_active?"Deactivate":"Activate"}</button></article>)}
  </section>
 </main>
}

const s:any={
 wrap:{minHeight:"100vh",background:"#f5f6f8",padding:32,fontFamily:"system-ui"},
 header:{display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:1100,margin:"0 auto 24px"},
 card:{background:"#fff",borderRadius:18,padding:24,maxWidth:1100,margin:"0 auto 20px",boxShadow:"0 2px 12px rgba(0,0,0,.06)"},
 alert:{maxWidth:1100,margin:"0 auto 20px",padding:12,borderRadius:10,background:"#fff7ed"},
 input:{display:"block",width:"100%",boxSizing:"border-box",padding:12,border:"1px solid #ddd",borderRadius:10,margin:"10px 0"},
 primary:{border:0,borderRadius:10,padding:"11px 16px",background:"#111",color:"#fff",fontWeight:700,cursor:"pointer"},
 secondary:{border:"1px solid #ccc",borderRadius:10,padding:"10px 14px",background:"#fff",cursor:"pointer"},
 danger:{border:0,borderRadius:10,padding:"10px 14px",background:"#fee2e2",color:"#991b1b",fontWeight:700,cursor:"pointer"},
 row:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16},
 item:{display:"flex",gap:20,alignItems:"center",borderTop:"1px solid #eee",padding:"18px 0"},
 actions:{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"},
 muted:{color:"#666"},
 note:{fontSize:12,color:"#777",marginTop:16},
 grid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,margin:"18px 0 24px"},
 metric:{border:"1px solid #eee",borderRadius:12,padding:14,display:"flex",flexDirection:"column",gap:6},
 area:{display:"flex",justifyContent:"space-between",gap:16,borderTop:"1px solid #eee",padding:"12px 0",flexWrap:"wrap"},editor:{border:"1px solid #ddd",borderRadius:12,padding:14,margin:"14px 0"},two:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},check:{display:"flex",alignItems:"center",gap:8,padding:12,border:"1px solid #ddd",borderRadius:10}
};