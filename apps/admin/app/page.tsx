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
 const[areas,setAreas]=useState<Area[]>([]),[reputation,setReputation]=useState<Reputation|null>(null),[customers,setCustomers]=useState<any[]>([]),[complaints,setComplaints]=useState<any[]>([]),[portfolio,setPortfolio]=useState<Portfolio[]>([]);\n const[areaDraft,setAreaDraft]=useState<Partial<Area>|null>(null),[areaSaving,setAreaSaving]=useState(false);\n const[activeTab,setActiveTab]=useState("overview");
 const[jobs,setJobs]=useState<any[]>([]),[payments,setPayments]=useState<any[]>([]),[notifications,setNotifications]=useState<any[]>([]),[auditLogs,setAuditLogs]=useState<any[]>([]);\n const[search,setSearch]=useState(""),[statusFilter,setStatusFilter]=useState("all");
 const[selected,setSelected]=useState<Professional|null>(null),[loading,setLoading]=useState(false);

 useEffect(()=>{
   supabase.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)loadAll()});
   const sub=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(s)loadAll()});
   return()=>sub.data.subscription.unsubscribe();
 },[]);

 async function login(){setMessage("");const{error}=await supabase.auth.signInWithPassword({email,password});if(error)setMessage(error.message)}
 async function loadAll(){await Promise.all([load(),loadMarketplace(),loadSkills(),loadCustomers(),loadComplaints(),loadPortfolio(),loadJobs(),loadPayments(),loadNotifications(),loadAudit()])}
 async function loadJobs(){const{data,error}=await supabase.rpc("admin_jobs");if(error)setMessage(error.message);else setJobs(data||[])}
 async function loadPayments(){const{data,error}=await supabase.rpc("admin_payment_orders");if(error)setMessage(error.message);else setPayments(data||[])}
 async function loadNotifications(){const{data,error}=await supabase.rpc("admin_notifications");if(error)setMessage(error.message);else setNotifications(data||[])}
 async function loadAudit(){const{data,error}=await supabase.rpc("admin_audit_log");if(error)setMessage(error.message);else setAuditLogs(data||[])}
 async function audit(action:string,entityType:string,entityId?:string,metadata:any={}){await supabase.rpc("admin_record_audit",{p_action:action,p_entity_type:entityType,p_entity_id:entityId||null,p_metadata:metadata});}
 async function loadPortfolio(){const{data,error}=await supabase.rpc("admin_portfolio_moderation");if(error)setMessage(error.message);else setPortfolio((data||[]) as Portfolio[])}
 async function load(){setLoading(true);const{data,error}=await supabase.rpc("admin_pending_verifications");if(error)setMessage(error.message);else setItems((data||[]) as Item[]);setLoading(false)}
 async function loadMarketplace(){const{data,error}=await supabase.rpc("admin_marketplace_professionals");if(error)setMessage(error.message);else setPros((data||[]) as Professional[])}
 async function loadSkills(){const{data,error}=await supabase.rpc("admin_marketplace_skills");if(error)setMessage(error.message);else setSkills((data||[]) as Skill[])}
 async function loadCustomers(){const{data,error}=await supabase.rpc("admin_customer_reputation");if(error)setMessage(error.message);else setCustomers(data||[])}
 async function loadComplaints(){const{data,error}=await supabase.rpc("admin_complaints");if(error)setMessage(error.message);else setComplaints(data||[])}
 async function reviewComplaint(id:string,status:string){const note=window.prompt("Admin note (optional):")||null;const{error}=await supabase.rpc("admin_review_complaint",{p_complaint_id:id,p_status:status,p_note:note});if(error)setMessage(error.message);else{setMessage("Complaint updated.");await loadComplaints();await loadCustomers();await loadMarketplace();}}
 async function review(id:string,decision:"approved"|"rejected"){const note=decision==="rejected"?window.prompt("Reason for rejection (optional):")||null:null;setLoading(true);const{error}=await supabase.rpc("admin_review_verification",{p_document_id:id,p_decision:decision,p_note:note});if(error)setMessage(error.message);else{setMessage(decision==="approved"?"Professional approved.":"Professional rejected.");await loadMarketplace();await load();await audit(decision,"verification",id);await loadAudit()}}
 async function openDocument(item:Item){const{data,error}=await supabase.storage.from("verification-documents").createSignedUrl(item.document_path,300);if(error)setMessage(error.message);else if(data?.signedUrl)window.open(data.signedUrl,"_blank")}
 async function setStatus(id:string,status:"active"|"suspended"){const{error}=await supabase.rpc("admin_set_professional_status",{p_user_id:id,p_status:status});if(error){setMessage(error.message);return;}\n await loadMarketplace();await audit(status,"professional",id);await loadAudit()}
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
async function setSkill(id:string,active:boolean){const{error}=await supabase.rpc("admin_set_skill_status",{p_skill_id:id,p_active:active});if(error){setMessage(error.message);return;}\n await loadSkills();await audit(active?"activate":"deactivate","skill",id);await loadAudit()}
 async function reviewPortfolio(id:string,decision:"approved"|"rejected"){const note=window.prompt(decision==="rejected"?"Reason for rejection (optional):":"Admin note (optional):")||null;const{error}=await supabase.rpc("admin_review_portfolio",{p_portfolio_id:id,p_decision:decision,p_note:note});if(error)setMessage(error.message);else{setMessage(decision==="approved"?"Portfolio item approved.":"Portfolio item rejected.");await loadPortfolio();await audit(decision,"portfolio",id);await loadAudit()}}

 if(!session)return <main style={s.wrap}><div style={s.card}><h1>VASUDHA CONNECT</h1><p style={s.muted}>Admin control centre</p><input style={s.input} placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)}/><input style={s.input} type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/><button style={s.primary} onClick={login}>Sign in</button>{message&&<p>{message}</p>}<p style={s.note}>Only users explicitly added to the VASUDHA admin allow-list can access this dashboard.</p></div></main>;

 return <main style={s.wrap}>
  <header style={s.header}><div><h1>VASUDHA CONNECT ADMIN</h1><p style={s.muted}>Marketplace control centre</p></div><button style={s.secondary} onClick={()=>supabase.auth.signOut()}>Sign out</button></header>
  {message&&<div style={s.alert}>{message}</div>}
  <nav style={s.nav} aria-label="Admin sections">{[["overview","Dashboard"],["professionals","Professionals"],["verification","Verification"],["customers","Customers"],["services","Service Catalogue"],["jobs","Jobs"],["payments","Payments"],["notifications","Notifications"],["complaints","Complaints"],["portfolio","Portfolio"],["audit","Audit Logs"]].map(([id,label])=><button key={id} style={activeTab===id?s.navActive:s.navItem} onClick={()=>setActiveTab(id)}>{label}</button>)}</nav>

  {activeTab==="overview"&&<section style={s.card}><div style={s.row}><div><h2>Dashboard</h2><p style={s.muted}>Live marketplace administration overview</p></div><button style={s.secondary} onClick={loadAll}>Refresh all</button></div><div style={s.grid}>{[["Verified professionals",pros.filter(p=>p.verification_status==="verified").length],["Pending verification",items.length],["Customers",customers.length],["Open complaints",complaints.filter(x=>x.status==="open"||x.status==="under_review").length],["Portfolio pending",portfolio.filter(x=>x.moderation_status==="pending").length],["Active services",skills.filter(x=>x.is_active).length],["Jobs",jobs.length],["Paid orders",payments.filter(x=>x.status==="paid").length]].map(([a,b])=><div key={a} style={s.metric}><span style={s.muted}>{a}</span><strong style={{fontSize:28}}>{b}</strong></div>)}</div><div style={s.quick}><h3>Admin workflow</h3><p style={s.muted}>Use the sections above to operate professionals, verification, customers, services, work, payments, notifications, complaints, portfolio moderation and audit history.</p><div style={s.actions}><button style={s.primary} onClick={()=>setActiveTab("verification")}>Review verification</button><button style={s.secondary} onClick={()=>setActiveTab("professionals")}>Manage professionals</button><button style={s.secondary} onClick={()=>setActiveTab("complaints")}>Open complaints</button></div></div></section>}


  {activeTab==="verification"&&<>
  <section style={s.card}><div style={s.row}><h2>Pending verification</h2><button style={s.secondary} onClick={load}>Refresh</button></div>
   {loading&&!items.length?<p>Loading...</p>:!items.length?<p style={s.muted}>No pending verification requests.</p>:items.map(x=><article key={x.document_id} style={s.item}><div style={{flex:1}}><h3>{x.professional_name}</h3><p>{x.headline||"Professional"}{x.city?" • "+x.city:""}{x.state?", "+x.state:""}</p><p style={s.muted}>{x.years_experience} years • {x.document_type} • {new Date(x.submitted_at).toLocaleString()}</p></div><div style={s.actions}><button style={s.secondary} onClick={()=>openDocument(x)}>View document</button><button style={s.primary} onClick={()=>review(x.document_id,"approved")}>Approve</button><button style={s.danger} onClick={()=>review(x.document_id,"rejected")}>Reject</button></div></article>)}
  </section>
  </>}

  {activeTab==="professionals"&&<>
  <section style={s.card}><div style={s.row}><h2>Professionals</h2><button style={s.secondary} onClick={loadMarketplace}>Refresh</button></div>
   {!pros.filter(x=>(statusFilter==="all"||x.verification_status===statusFilter||((statusFilter==="suspended")&&x.verification_status==="suspended"))&&(!search||`${x.display_name||""} ${x.headline||""} ${x.city||""} ${x.state||""}`.toLowerCase().includes(search.toLowerCase()))).length?<p style={s.muted}>No professionals match the current filters.</p>:pros.filter(x=>(statusFilter==="all"||x.verification_status===statusFilter||((statusFilter==="suspended")&&x.verification_status==="suspended"))&&(!search||`${x.display_name||""} ${x.headline||""} ${x.city||""} ${x.state||""}`.toLowerCase().includes(search.toLowerCase()))).map(x=><article key={x.user_id} style={s.item}>
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
  </>}

  {activeTab==="jobs"&&<section style={s.card}><div style={s.row}><div><h2>Jobs & Work</h2><p style={s.muted}>Live accepted work and operational status.</p></div><button style={s.secondary} onClick={loadJobs}>Refresh</button></div><div style={s.filters}><input style={s.input} placeholder="Search job, customer or professional..." value={search} onChange={e=>setSearch(e.target.value)}/><select style={s.select} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="on_the_way">On the way</option><option value="arrived">Arrived</option><option value="work_started">Work started</option><option value="work_completed">Completed</option><option value="cancelled">Cancelled</option></select></div>{!jobs.filter(x=>(statusFilter==="all"||x.status===statusFilter)&&(!search||`${x.title||""} ${x.customer_name||""} ${x.professional_name||""}`.toLowerCase().includes(search.toLowerCase()))).length?<p style={s.muted}>No jobs match the current filters.</p>:jobs.filter(x=>(statusFilter==="all"||x.status===statusFilter)&&(!search||`${x.title||""} ${x.customer_name||""} ${x.professional_name||""}`.toLowerCase().includes(search.toLowerCase()))).map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.title||"Work"}</h3><p>{x.customer_name} → {x.professional_name}</p><p style={s.muted}>{x.status} • ₹{Number(x.agreed_amount_inr||0).toLocaleString("en-IN")} • {new Date(x.created_at).toLocaleString()}</p></div></article>)}</section>}

{activeTab==="payments"&&<section style={s.card}><div style={s.row}><div><h2>Payments</h2><p style={s.muted}>Connection purchase orders and Razorpay reconciliation.</p></div><button style={s.secondary} onClick={loadPayments}>Refresh</button></div>{!payments.length?<p style={s.muted}>No payment orders yet.</p>:payments.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.customer_name} • {x.package_code}</h3><p>₹{Number(x.amount_inr||0).toLocaleString("en-IN")} • {x.status} • {x.provider||"—"}</p><p style={s.muted}>{new Date(x.created_at).toLocaleString()}{x.paid_at?" • Paid "+new Date(x.paid_at).toLocaleString():""}</p></div><div style={s.muted}>{x.provider_payment_id||x.provider_order_id||"No provider reference"}</div></article>)}</section>}

{activeTab==="notifications"&&<section style={s.card}><div style={s.row}><div><h2>Notifications</h2><p style={s.muted}>Recent notification and push delivery health.</p></div><button style={s.secondary} onClick={loadNotifications}>Refresh</button></div>{!notifications.length?<p style={s.muted}>No notifications yet.</p>:notifications.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.title}</h3><p>{x.user_name} • {x.type}</p><p style={s.muted}>{x.message}</p></div><div style={{textAlign:"right"}}><strong>{x.push_sent_at?"Sent":x.push_error?"Failed":"Pending"}</strong><p style={s.muted}>Attempts: {x.push_attempts||0}</p></div></article>)}</section>}

{activeTab==="audit"&&<section style={s.card}><div style={s.row}><div><h2>Audit Logs</h2><p style={s.muted}>Admin actions recorded from this console.</p></div><button style={s.secondary} onClick={loadAudit}>Refresh</button></div>{!auditLogs.length?<p style={s.muted}>No admin actions recorded yet.</p>:auditLogs.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.action} • {x.entity_type}</h3><p>{x.actor_name} • {x.entity_id||"—"}</p><p style={s.muted}>{new Date(x.created_at).toLocaleString()}</p></div></article>)}</section>}

{activeTab==="complaints"&&<>
  <section style={s.card}><div style={s.row}><h2>Complaints & Disputes</h2><button style={s.secondary} onClick={loadComplaints}>Refresh</button></div>{!complaints.length?<p style={s.muted}>No complaints reported.</p>:complaints.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.category.replaceAll("_"," ")} • {x.status}</h3><p>{x.reporter_name||"User"} reported {x.against_name||"User"}</p><p>{x.description}</p><p style={s.muted}>Job: {x.job_id} • {new Date(x.created_at).toLocaleString()}</p></div><div style={s.actions}>{x.status==="open"&&<button style={s.secondary} onClick={()=>reviewComplaint(x.id,"under_review")}>Review</button>}{x.status==="under_review"&&<><button style={s.danger} onClick={()=>reviewComplaint(x.id,"upheld")}>Uphold</button><button style={s.secondary} onClick={()=>reviewComplaint(x.id,"dismissed")}>Dismiss</button></>}{x.status==="upheld"&&<button style={s.secondary} onClick={()=>reviewComplaint(x.id,"resolved")}>Resolve</button>}</div></article>)}</section>
  </>}

  {activeTab==="portfolio"&&<>
  <section style={s.card}><div style={s.row}><h2>Portfolio Moderation</h2><button style={s.secondary} onClick={loadPortfolio}>Refresh</button></div>{!portfolio.length?<p style={s.muted}>No portfolio items submitted.</p>:portfolio.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.title} <span style={{fontSize:12,fontWeight:500}}>• {x.moderation_status}</span></h3><p>{x.professional_name}</p>{x.description&&<p>{x.description}</p>}<p style={s.muted}>{new Date(x.created_at).toLocaleString()}{x.moderation_note?" • "+x.moderation_note:""}</p><a href={x.media_url} target="_blank" rel="noreferrer">View media</a></div><div style={s.actions}>{x.moderation_status==="pending"&&<><button style={s.primary} onClick={()=>reviewPortfolio(x.id,"approved")}>Approve</button><button style={s.danger} onClick={()=>reviewPortfolio(x.id,"rejected")}>Reject</button></>}</div></article>)}</section>
  </>}

  {activeTab==="customers"&&<>
  <section style={s.card}><div style={s.row}><h2>Customers & Reputation</h2><button style={s.secondary} onClick={loadCustomers}>Refresh</button></div>{!customers.length?<p style={s.muted}>No customer reputation data yet.</p>:customers.map(x=><article key={x.user_id} style={s.item}><div style={{flex:1}}><h3>{x.display_name||"Customer"}</h3><p>{x.city||""}{x.state?", "+x.state:""}</p><p style={s.muted}>Trust {Math.round(x.customer_trust_score||0)}/100 • {x.jobs_completed||0} jobs completed • {x.reviews_received||0} reviews • Would work again {x.would_work_again_pct||0}%</p></div></article>)}</section>
  </>}

  {activeTab==="services"&&<>
  <section style={s.card}><div style={s.row}><h2>Skill catalogue</h2><button style={s.secondary} onClick={loadSkills}>Refresh</button></div>
   {skills.map(x=><article key={x.id} style={s.item}><div style={{flex:1}}><h3>{x.name}</h3><p style={s.muted}>{x.category} • {x.professional_count} professionals{x.description?" • "+x.description:""}</p></div><button style={x.is_active?s.danger:s.primary} onClick={()=>setSkill(x.id,!x.is_active)}>{x.is_active?"Deactivate":"Activate"}</button></article>)}
  </section>
  </>}
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
 area:{display:"flex",justifyContent:"space-between",gap:16,borderTop:"1px solid #eee",padding:"12px 0",flexWrap:"wrap"},editor:{border:"1px solid #ddd",borderRadius:12,padding:14,margin:"14px 0"},filters:{display:"grid",gridTemplateColumns:"minmax(220px,1fr) 180px",gap:10,margin:"14px 0"},select:{width:"100%",boxSizing:"border-box",padding:12,border:"1px solid #ddd",borderRadius:10,background:"#fff"},nav:{display:"flex",gap:8,maxWidth:1100,margin:"0 auto 20px",overflowX:"auto",paddingBottom:4},navItem:{border:"1px solid #ddd",borderRadius:10,padding:"10px 14px",background:"#fff",whiteSpace:"nowrap",cursor:"pointer"},navActive:{border:"1px solid #111",borderRadius:10,padding:"10px 14px",background:"#111",color:"#fff",whiteSpace:"nowrap",cursor:"pointer"},quick:{border:"1px solid #eee",borderRadius:14,padding:18},two:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},check:{display:"flex",alignItems:"center",gap:8,padding:12,border:"1px solid #ddd",borderRadius:10}
};