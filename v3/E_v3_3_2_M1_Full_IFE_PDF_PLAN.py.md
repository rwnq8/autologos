---
modified: 2025-05-23T03:49:04Z
---

```python
# E_v3_3_2_M1.py - Minified AIOS Engine with functional IFE_M, PDF_M, PLAN_M, and TDE_M_STUB
# Version: 3.3.2.M1 (Reflects successful minification and MH implementations)
import json
import uuid
import datetime
import time # For simulating work

class E_v3_3_2_M1:
    def __init__(self, iss_json_str=None):
        self.lh = [] # log_history
        self.evf = "AIOS_Engine_v3.3.2.M1 (Minified)" # engine_version_full
        self.evs = "3.3.2.M1" # engine_version_short
        self.ccm = "System_M" # current_context_mh
        self.ssv = "1.0.M1" # state_schema_version

        self.i_ds() # _initialize_default_state
        self.l("System_M", "E_M1 __init__: Started.")

        if iss_json_str:
            try:
                self.imp_s(iss_json_str) # import_state
                self.l("System_M", f"E_M1 instance created, state imported. Schema: {self.ssv}")
            except Exception as e:
                self.l("System_M", f"ERROR during __init__ state import: {str(e)}. Init with default.")
                self.i_ds()
                self.l("System_M", f"{self.evf} instance created with default state after import error.")
        else:
            self.l("System_M", f"{self.evf} instance created with default state.")
        self.l("System_M", "E_M1 __init__: Completed.")

    def i_ds(self): # _initialize_default_state
        self.KAS = None; self.KCM = None; self.KMI = None; self.CCOd = None
        self.s_ife, self.s_pdf, self.s_pln, self.s_cag, self.s_tde, self.s_sel, self.s_kau, self.s_fel, self.s_mro = {}, {}, {}, {}, {}, {}, {}, {}, {}
        if not hasattr(self, 'lh'): self.lh = []
        if not hasattr(self, 'ccm'): self.ccm = "System_M"

    def exp_s(self) -> str: 
        sd = {"ssv": self.ssv, "evf": self.evf, "evs": self.evs, "ccm": self.ccm, "KAS": self.KAS, "KCM": self.KCM, "KMI": self.KMI, "CCOd": self.CCOd, "s_ife": self.s_ife, "s_pdf": self.s_pdf, "s_pln": self.s_pln, "s_cag": self.s_cag, "s_tde": self.s_tde, "s_sel": self.s_sel, "s_kau": self.s_kau, "s_fel": self.s_fel, "s_mro": self.s_mro, "lh": self.lh}
        try: return json.dumps(sd)
        except TypeError as e: 
            self.l("System_M", f"ERROR exp_s: JSON serialization fail: {str(e)}")
            pk=[]
            for k,v_val in sd.items(): 
                 if not isinstance(v_val, (int, float, str, list, dict, bool, type(None))) and not callable(v_val): 
                    pk.append(k)
                    sd[k]=f"UNSERIALIZABLE ({type(v_val).__name__})"
            self.l("System_M", f"exp_s: Problematic keys after UNSERIALIZABLE check: {pk}")
            return json.dumps(sd)

    def imp_s(self, sjs: str): 
        sd = json.loads(sjs)
        if sd.get("ssv") != self.ssv: self.l("System_M", f"WARN imp_s: Schema mismatch. Eng: {self.ssv}, Imp: {sd.get('ssv')}.")
        self.evf=sd.get("evf",self.evf); self.evs=sd.get("evs",self.evs); self.ccm=sd.get("ccm","System_M"); self.KAS=sd.get("KAS"); self.KCM=sd.get("KCM"); self.KMI=sd.get("KMI"); self.CCOd=sd.get("CCOd")
        for s_attr in ['s_ife','s_pdf','s_pln','s_cag','s_tde','s_sel','s_kau','s_fel','s_mro']: setattr(self, s_attr, sd.get(s_attr,{}))
        self.lh=sd.get("lh",[])

    def gts(self): return datetime.datetime.now(datetime.timezone.utc).isoformat()
    def l(self, ctx, msg): ts=self.gts();vs=getattr(self,'evs','unk_M');fl=f"{ts}-LOG_M({ctx} v{vs}):{msg}";print(fl);self.lh.append(fl)

    def clr(self, tt, pu=None, ctd=None, eid=None, ch=None, ccd=None): 
        rq={"rts":self.gts(),"evc":self.evf,"c_c":self.ccm,"tt":tt}
        if pu:rq["pu"]=pu;
        if ctd:rq["ctd"]=ctd
        if eid:rq["eid"]=eid;
        if ch:rq["ch"]=ch
        cp = ccd if ccd is not None else self.CCOd
        if cp: rq["ccd"]=cp
        print(f"\\n---B_LLM_REQ_M---\\n{json.dumps(rq,indent=2)}\\n---E_LLM_REQ_M---")
        return {"s":"AWAIT_LLM_M","rd":rq,"ces":self.gess()}

    def gess(self): 
        ss={"KCM":self.KCM,"KMI":self.KMI,"KAS_100":(self.KAS[:100]+"...")if self.KAS else None,"CCOd_id":self.CCOd.get('cco_id','N/A')if isinstance(self.CCOd,dict)else'N/A',"ccm_log":self.ccm,"ssv":self.ssv}
        for dn in ['s_ife','s_pdf','s_pln','s_cag','s_tde','s_sel','s_kau','s_fel','s_mro']:
            dval=getattr(self,dn,{});
            if dval:ss[f"{dn}_k"]=list(dval.keys())
        return ss
    
    def PUM(self, mt, mc): self.l(self.ccm,f"PUM_M(T:{mt}):{mc}");return self.clr(tt="PUM_USER_M",ctd={"mt":mt,"c":mc})
    def PJsToC(self,jsi):
        if jsi is None or not isinstance(jsi,str)or jsi.strip()=="":self.l(self.ccm,"PJsToC_M: Inp null/empty.");return None
        try: return json.loads(jsi)
        except json.JSONDecodeError as e:self.l(self.ccm,f"ERR PJsToC_M:{e}. Inp:'{jsi}'");raise ValueError(f"JSONParseErr_M:{e}")
    def CCnlToJs(self,coi):
        if coi is None:return "null"
        try: return json.dumps(coi)
        except TypeError as e:self.l(self.ccm,f"ERR CCnlToJs_M:{e}");raise ValueError(f"JSONFormatErr_M:{e}")
    def LToCH(self, cdd, let, msg, ado=None):
        self.l(self.ccm,f"LToCH_M:T='{let}',M='{msg}'")
        if not isinstance(cdd,dict):self.l(self.ccm,"LToCH_M:CCOd not dict. Init.");cdd={"op_log_json":"[]", "cco_id":f"log_cco_m_{uuid.uuid4().hex[:6]}"}
        olljs=cdd.get("op_log_json","[]");oll=self.PJsToC(olljs);oll=[] if not isinstance(oll,list)else oll
        nle={"ts":self.gts(),"let":let,"log_msg":msg}
        if ado is not None:nle["adjs"]=self.CCnlToJs(ado)
        oll.append(nle);cdd["op_log_json"]=self.CCnlToJs(oll);self.CCOd=cdd;self.KAS=self.CCnlToJs(cdd);return cdd

    def f_ipo(self,pu,olc): return self.clr(tt="UIR_PO_M",pu=pu,ctd={"opts":olc,"it":"opt_sel"},eid="JSON LLM:{'s':'USR_CMD_M','c':<val>}",ch="E_v3_3_2_M1.k_pirc(llr)")
    def f_iudfnm(self,uit): 
        self.l(self.ccm,f"f_iudfnm_M:'{uit}'");luit=uit.lower().strip();nmh="AUI_M";nis={};upm="Cmd_M?"
        if any(x==luit for x in["new process","1","1."]):nmh="IFE_M";upm=None 
        elif any(x==luit for x in["evolve engine","2","2."]):nmh="FEL_M";upm=None
        elif any(x==luit for x in["terminate aios","terminate","exit","quit","3","3."]):nmh="TA_M";upm=None
        ro={"s":"Ok_M"if nmh!="AUI_M"else"Clarify_M","nmh":nmh,"nis_js":self.CCnlToJs(nis)};
        if upm:ro["upm"]=upm
        return ro

    def k_se(self,iss=None): 
        if iss:self.imp_s(iss);self.l("Kernel_M",f"k_se_M:Resumed. KCM:{self.KCM}");return self.k_rcmh()if self.KCM and self.KCM!="AUI_M"else(self.l("Kernel_M","k_se_M:Resumed,no active MH.PIO."),self.k_pio())
        self.l("Kernel_M","k_se_M:New session.");self.ccm="Kernel_M";self.l(self.ccm,f"{self.evf}-Kernel_M start.");self.PUM("Status",f"{self.evf} Init_M.PIO_ready.");res=self.k_pio();self.l("Kernel_M","k_se_M:Done,LLM req for PIO gen.");return res
    def k_pio(self):self.ccm="Kernel_M";self.l(self.ccm,"k_pio_M:Pres init opts.");olc=[{"v":"New Process","l":"1.NewProc_M"},{"v":"Evolve Engine","l":"2.EvolveAIOS_M"},{"v":"Terminate AIOS","l":"3.TerminateAIOS_M"}];return self.f_ipo(pu=f"AIOS_M v{self.evs} Rdy.Begin?",olc=olc)
    def k_pirc(self,llr): 
        self.ccm="Kernel_M"
        if not llr or not isinstance(llr,dict)or llr.get("s")!="USR_CMD_M":self.l(self.ccm,"Inv res_M.Re-prompt.");self.PUM("Warn_M","Cannot process sel_M.");return self.k_pio()
        cmdv=llr.get("c");self.l(self.ccm,f"Proc init choice_M:'{cmdv}'");ir=self.f_iudfnm(cmdv);self.KCM=ir.get("nmh");self.KMI=ir.get("nis_js")
        if self.KCM=="TA_M":self.PUM("Status_M","AIOS_M term init.");return{"s":"TERM_REQ_M","fes":self.gess()}
        elif self.KCM and self.KCM!="AUI_M":self.l(self.ccm,f"Kernel_M:Next MH_M:{self.KCM}");return self.k_rcmh()
        else:self.PUM("Warn_M",ir.get("upm",f"Unrec choice_M:'{cmdv}'."));return self.k_pio()
    def k_rcmh(self): 
        self.ccm="Kernel_M"
        if self.KCM=="TA_M":self.PUM("Status_M","AIOS_M terminated.");return{"s":"TERM_M","fes":self.gess()}
        elif self.KCM=="AUI_M"or not self.KCM:self.l(self.ccm,"Kernel_M paused.");return self.clr(tt="UIR_GEN_DIR_M",pu="AIOS_M paused.Next?",ch="E_v3_3_2_M1.k_pgud(llr)")
        self.l(self.ccm,f"Kernel_M:Exec MH_M:{self.KCM}");self.PUM("Status_M",f"Exec MH_M:{self.KCM}");mio=self.PJsToC(self.KMI)
        if self.KCM=="IFE_M":return self.ife_s1(mio) 
        elif self.KCM=="PDF_M":return self.pdf_s1_init(mio) 
        elif self.KCM=="PLAN_M":return self.plan_s1_init(mio) 
        elif self.KCM=="FEL_M":return self.fel_s1(mio)
        elif self.KCM=="TDE_M":return self.tde_s1_stub(mio) 
        else:self.l(self.ccm,f"Err_M:MH_M'{self.KCM}'NI_M.");self.PUM("Err_M",f"MH_M'{self.KCM}'NA_M.");self.KCM="AUI_M";return self.k_rcmh()
    def k_pmhr(self,mjid,mhr): 
        self.ccm="Kernel_M";s=mhr.get("s");self.l(self.ccm,f"Proc res_M from'{mjid}'.S:'{s}'")
        if not mhr or not isinstance(mhr,dict):self.PUM("Err_M",f"Inv res_M from'{mjid}'.");self.KCM="AUI_M";return self.k_rcmh()
        if "uccoj" in mhr:self.KAS=mhr["uccoj"];self.CCOd=self.PJsToC(self.KAS);self.l(self.ccm,f"CCOd_M upd by'{mjid}'.")
        elif self.CCOd is not None:self.KAS=self.CCnlToJs(self.CCOd)
        if s=="AWAIT_LLM_M":self.l(self.ccm,f"'{mjid}'awaits LLM_M for:{mhr.get('rd',{}).get('tt')}");return mhr
        dfl=mhr.get("dfl")
        if self.CCOd is None:self.CCOd={"op_log_json":"[]","cco_id":f"k_cco_m_{uuid.uuid4().hex[:8]}"};self.KAS=self.CCnlToJs(self.CCOd);self.l(self.ccm,"Init min CCOd_M for log MH_C_M.")
        self.CCOd=self.LToCH(self.CCOd,"MH_C_M",f"{mjid} s:{s}.",dfl)
        if "Err_M"in s or "Fail_M"in s:self.PUM("Err_M",f"MH_M {mjid} issue:{s}.")
        else:self.PUM("Status_M",f"{mjid} complete s:{s}.")
        nmh="AUI_M";nis={}
        if mjid=="IFE_M" and "IFE_C_M" in s: nmh="PDF_M" 
        elif mjid=="PDF_M" and "PDF_C_M" in s: nmh="PLAN_M" 
        elif mjid=="PLAN_M" and "PLAN_C_M" in s: nmh="TDE_M" 
        elif mjid=="TDE_M_STUB" and "TDE_STUB_C_M" in s: nmh="AUI_M" 
        elif mjid=="FEL_M"and"FEL_EVO_PROP_C_M"in s:nmh="TA_M"
        self.KCM=nmh;self.KMI=self.CCnlToJs(nis)
        if ("Complete"in s or "_C_M" in s) and nmh!="TA_M"and self.CCOd:self.PUM("Suggest_M","Work_M done.Save CCOd_M state.") # Changed "Complete" to generic "_C_M"
        return self.k_rcmh()
    def k_pgud(self,llr): 
        self.ccm="Kernel_M";udt=llr.get("c","");self.l(self.ccm,f"Proc gen directive_M:'{udt}'");iro=self.f_iudfnm(udt);self.KCM=iro.get("nmh","AUI_M");self.KMI=iro.get("nis_js","{}")
        if self.KCM=="AUI_M"and iro.get("upm"):return self.clr(tt="UIR_GEN_DIR_M",pu=iro.get("upm"),ch="E_v3_3_2_M1.k_pgud(llr)")
        return self.k_rcmh()

    def ife_s1(self, mi): self.ccm="IFE_M";self.s_ife={};self.l(self.ccm,"ife_s1_M: Init. Getting core idea.");self.PUM("Status_M","IFE_M: Starting Idea Formulation...");self.s_ife["initial_CCOd_exists"]=self.CCOd is not None;return self.clr(tt="UIR_ET_M",pu="IFE_M: What is the core idea or problem for this new process?",ch="E_v3_3_2_M1.ife_s2(llr)")
    def ife_s2(self, llr): self.ccm="IFE_M";idea_txt=llr.get("c");self.l(self.ccm,f"ife_s2_M: Rcvd core idea: '{idea_txt}'.");
        if not idea_txt or idea_txt.strip()=="": self.PUM("Err_M","IFE_M: No core idea provided.");return self.k_pmhr("IFE_M",{"s":"IFE_ERR_NO_IDEA_M"})
        self.s_ife["idea_txt"]=idea_txt
        if not self.s_ife.get("initial_CCOd_exists")and self.CCOd is None:new_cco_id=f"ife_cco_m_{uuid.uuid4().hex[:6]}";self.CCOd={"cco_id":new_cco_id,"op_log_json":"[]"};self.KAS=self.CCnlToJs(self.CCOd);self.l(self.ccm,f"ife_s2_M: New CCOd {new_cco_id} created.");self.CCOd=self.LToCH(self.CCOd,"IFE_INIT_M",f"CCO {new_cco_id} init with idea.",{"idea":idea_txt})
        else:self.CCOd=self.LToCH(self.CCOd or {"op_log_json":"[]","cco_id":f"ife_tmp_{uuid.uuid4().hex[:4]}"},"IFE_IDEA_RCVD_M",f"Processing idea.",{"idea":idea_txt})
        self.CCOd["ife_idea_txt"]=idea_txt;self.KAS=self.CCnlToJs(self.CCOd);self.l(self.ccm,"ife_s2_M: Req LLM draft core essence.");ctd={"idea_txt":self.s_ife["idea_txt"],"cco_id":self.CCOd.get("cco_id"),"out_fmt_guide":"JSON obj:{'essence_txt':'<essence>', 's':'Suc_M'}"};return self.clr(tt="CT_IFE_DRAFT_ESS_M",ctd=ctd,ch="E_v3_3_2_M1.ife_s3(llr)")
    def ife_s3(self, llmcr): self.ccm="IFE_M";essence_txt=llmcr.get("essence_txt");self.l(self.ccm,f"ife_s3_M: Rcvd essence draft: '{essence_txt}'.");
        if not essence_txt:self.PUM("Warn_M","IFE_M: LLM failed draft. Placeholder.");essence_txt=f"Placeholder essence for: {self.s_ife.get('idea_txt','Unknown')}"
        self.s_ife["essence_txt"]=essence_txt;self.CCOd["ife_essence_txt"]=essence_txt;self.CCOd=self.LToCH(self.CCOd,"IFE_ESSENCE_C_M",f"Core essence established.",{"essence":essence_txt});self.KAS=self.CCnlToJs(self.CCOd);self.PUM("Status_M",f"IFE_M: Idea&essence formulated. CCOd: {self.CCOd.get('cco_id')}.");return self.k_pmhr("IFE_M",{"s":"IFE_C_M","uccoj":self.KAS,"dfl":{"summary":f"IFE_M for CCOd {self.CCOd.get('cco_id')} complete."}})

    def pdf_s1_init(self, mi): self.ccm="PDF_M";self.s_pdf={};self.l(self.ccm,"pdf_s1_M: Init. Proc CCO from IFE.");self.PUM("Status_M","PDF_M: Starting Problem Definition...");
        if not self.CCOd or"ife_essence_txt"not in self.CCOd:self.PUM("Err_M","PDF_M: CCOd or IFE essence miss.");return self.k_pmhr("PDF_M",{"s":"PDF_ERR_NO_ESSENCE_M"})
        self.s_pdf["core_essence"]=self.CCOd.get("ife_essence_txt");self.s_pdf["cco_id"]=self.CCOd.get("cco_id");self.l(self.ccm,f"pdf_s1_M: Use essence '{self.s_pdf['core_essence'][:30]}...' from CCOd '{self.s_pdf['cco_id']}'.");return self.clr(tt="UIR_ET_M",pu="PDF_M: Provide details/constraints for problem def:",ch="E_v3_3_2_M1.pdf_s2_proc_details(llr)")
    def pdf_s2_proc_details(self, llr): self.ccm="PDF_M";user_details=llr.get("c","");self.l(self.ccm,f"pdf_s2_M: Rcvd user details: '{user_details}'.");self.s_pdf["user_details"]=user_details;self.CCOd=self.LToCH(self.CCOd,"PDF_DETAILS_M","User details for PDF.",{"details":user_details});self.CCOd["pdf_user_details_str"]=user_details;self.KAS=self.CCnlToJs(self.CCOd);self.l(self.ccm,"pdf_s2_M: Req LLM problem decomp.");
        stmt=f"Essence: {self.s_pdf.get('core_essence','')}\nDetails: {user_details}";ctd={"problem_statement_full":stmt,"cco_id":self.s_pdf.get("cco_id"),"out_fmt_guide":"JSON obj:{'decomposition_obj':{'summary_str':'','sub_problems_list':[],'key_questions_list':[],'constraints_list':[],'scope_notes_str':''}, 's':'Suc_M'}"};return self.clr(tt="CT_PDF_DECOMPOSE_M",ctd=ctd,ch="E_v3_3_2_M1.pdf_s3_proc_decomp(llr)")
    def pdf_s3_proc_decomp(self, llmcr): self.ccm="PDF_M";decomp_obj=llmcr.get("decomposition_obj");self.l(self.ccm,f"pdf_s3_M: Rcvd decomp: {decomp_obj}.");
        if not decomp_obj or not isinstance(decomp_obj,dict):self.PUM("Warn_M","PDF_M: LLM fail decomp. Placeholder.");decomp_obj={"error_str":"Decomposition failed","orig_details_str":self.s_pdf.get("user_details")}
        self.s_pdf["decomposition_obj"]=decomp_obj;self.CCOd["pdf_problem_definition_obj"]=decomp_obj;self.CCOd=self.LToCH(self.CCOd,"PDF_DECOMP_C_M","Problem decomp complete.",{"decomposition":decomp_obj});self.KAS=self.CCnlToJs(self.CCOd);self.PUM("Status_M",f"PDF_M: Problem def complete. CCOd: {self.s_pdf.get('cco_id')}.");return self.k_pmhr("PDF_M",{"s":"PDF_C_M","uccoj":self.KAS,"dfl":{"summary":f"PDF_M for CCOd {self.s_pdf.get('cco_id')} complete."}})

    def plan_s1_init(self, mi):
        self.ccm = "PLAN_M"; self.s_pln = {}
        self.l(self.ccm, "plan_s1_M: Init. Processing CCO from PDF."); self.PUM("Status_M", "PLAN_M: Starting Planning & Strategy...")
        if not self.CCOd or "pdf_problem_definition_obj" not in self.CCOd:
            self.PUM("Err_M", "PLAN_M: CCOd or PDF definition missing."); return self.k_pmhr("PLAN_M", {"s": "PLAN_ERR_NO_PDF_DEF_M"})
        self.s_pln["problem_def_obj"] = self.CCOd.get("pdf_problem_definition_obj")
        self.s_pln["cco_id"] = self.CCOd.get("cco_id")
        self.l(self.ccm, f"plan_s1_M: Using PDF def from CCOd '{self.s_pln['cco_id']}' for planning.")
        ctd = {"problem_def_obj": self.s_pln["problem_def_obj"], "cco_id": self.s_pln["cco_id"], "out_fmt_guide": "JSON obj:{'phases_list':[{'id':'P1','name':'PhaseName','goal':'PhaseGoal'}], 's':'Suc_M'}"}
        return self.clr(tt="CT_PLAN_CREATE_PHASES_M", ctd=ctd, ch="E_v3_3_2_M1.plan_s2_proc_phases(llr)")
    def plan_s2_proc_phases(self, llmcr):
        self.ccm = "PLAN_M"; phases_list = llmcr.get("phases_list", [])
        self.l(self.ccm, f"plan_s2_M: Rcvd {len(phases_list)} phase(s) from LLM.")
        if not phases_list: self.PUM("Warn_M", "PLAN_M: No phases from LLM."); phases_list = [{"phase_id":"P_FALLBACK","name":"Overall Project Execution","goal":"Address the core problem directly."}]
        self.s_pln["phases_list"] = phases_list
        self.s_pln["plan_obj"] = {"phases": phases_list, "tasks_by_phase": {}}
        self.s_pln["current_phase_idx"] = 0
        self.CCOd = self.LToCH(self.CCOd, "PLAN_PHASES_C_M", "Plan phases created by LLM.", {"phases":phases_list})
        return self._plan_s2b_gen_tasks_for_phase()
    def _plan_s2b_gen_tasks_for_phase(self): 
        self.ccm = "PLAN_M"; idx = self.s_pln["current_phase_idx"]
        if idx >= len(self.s_pln["phases_list"]): return self.plan_s3_finalize_plan()
        current_phase = self.s_pln["phases_list"][idx]
        self.l(self.ccm, f"plan_s2b_M: Requesting LLM to generate tasks for phase '{current_phase.get('id', 'N/A')}:{current_phase.get('name', 'N/A')}'.")
        ctd = {"current_phase_obj": current_phase, "problem_def_obj": self.s_pln["problem_def_obj"], "out_fmt_guide": "JSON obj:{'tasks_list':[{'id':'T1.1','name':'TaskName','mh_suggestion':'SUG_MH_ID'}], 's':'Suc_M'}"}
        return self.clr(tt="CT_PLAN_CREATE_TASKS_M", ctd=ctd, ch="E_v3_3_2_M1.plan_s2c_proc_tasks(llr)")
    def plan_s2c_proc_tasks(self, llmcr):
        self.ccm = "PLAN_M"; tasks_list = llmcr.get("tasks_list", [])
        idx = self.s_pln["current_phase_idx"]; current_phase_id = self.s_pln["phases_list"][idx].get("id", f"PH_IDX_{idx}")
        self.l(self.ccm, f"plan_s2c_M: Rcvd {len(tasks_list)} task(s) for phase '{current_phase_id}'.")
        if not tasks_list: self.PUM("Warn_M", f"PLAN_M: No tasks received from LLM for phase {current_phase_id}. Phase will be empty of tasks.")
        self.s_pln["plan_obj"]["tasks_by_phase"][current_phase_id] = tasks_list
        self.CCOd = self.LToCH(self.CCOd, "PLAN_TASKS_C_M", f"Tasks for phase {current_phase_id} created by LLM.", {"phase_id":current_phase_id, "tasks_count":len(tasks_list), "tasks_preview": tasks_list[:2]})
        self.s_pln["current_phase_idx"] += 1
        return self._plan_s2b_gen_tasks_for_phase()
    def plan_s3_finalize_plan(self):
        self.ccm = "PLAN_M"; self.l(self.ccm, "plan_s3_M: All phases processed. Finalizing plan.")
        self.CCOd["plan_obj"] = self.s_pln["plan_obj"] 
        self.CCOd = self.LToCH(self.CCOd, "PLAN_FINAL_C_M", "Full plan created and stored in CCOd.", {"total_phases": len(self.s_pln.get("phases_list",[]))})
        self.KAS = self.CCnlToJs(self.CCOd); self.PUM("Status_M", f"PLAN_M: Plan creation complete. CCOd ID: {self.s_pln.get('cco_id')}.")
        return self.k_pmhr("PLAN_M", {"s": "PLAN_C_M", "uccoj": self.KAS, "dfl": {"summary": f"PLAN_M for CCOd {self.s_pln.get('cco_id')} complete."}})

    def fel_s1(self,mi): self.ccm="FEL_M";self.s_fel={};self.l(self.ccm,"fel_s1_M:Init.");self.PUM("Status_M","FEL_M:Start Evo Loop_M.");self.s_fel["cer"]=mi.get("cesm","CREP_DEF_M")if mi else"CREP_DEF_M";return self.clr(tt="UIR_ET_M",pu="FEL_M:Provide TIDs(JSON) or src.",ch="E_v3_3_2_M1.fel_s2(llr)")
    def fel_s2(self,llr): self.ccm="FEL_M";tsi=llr.get("c");self.l(self.ccm,f"fel_s2_M:Rcvd TID_M src:{tsi}");return self.clr(tt="CT_FEL_LT_M",ctd={"tsd_obj":{"src_desc":tsi,"cur_eng_ver":self.evs},"out_fmt_guide":"JSON obj:{'tids_loaded_list':[],'status':'Success_M'}"},ch="E_v3_3_2_M1.fel_s3(llr)")
    def fel_s3(self,llmcr): self.ccm="FEL_M";self.s_fel["ltids"]=llmcr.get("tids_loaded_list",[]);
        if not self.s_fel["ltids"]:self.PUM("Err_M","FEL_M:No TIDs loaded.");return self.k_pmhr("FEL_M",{"s":"FEL_ERR_NO_TID_M"})
        self.PUM("Info_M",f"FEL_M:Loaded {len(self.s_fel['ltids'])} TIDs.");
        if self.CCOd is None:self.CCOd={"cco_id":f"fel_cco_m_{uuid.uuid4().hex[:4]}","op_log_json":"[]"};self.KAS=self.CCnlToJs(self.CCOd);self.l(self.ccm,"Init min CCOd_M for FEL_M.")
        self.CCOd=self.LToCH(self.CCOd,"FEL_TID_LOAD_M",f"Loaded {len(self.s_fel['ltids'])} TIDs.",{"tids":self.s_fel["ltids"]});return self.clr(tt="CT_FEL_CALC_VER_M",ctd={"cur_eng_rep":self.s_fel["cer"],"out_fmt_guide":"JSON obj:{'next_ver_str':'x.y.z','status':'Success_M'}"},ch="E_v3_3_2_M1.fel_s4(llr)")
    def fel_s4(self,llmcr): self.ccm="FEL_M";self.s_fel["nvs"]=llmcr.get("next_ver_str",f"v{self.evs}-evoM-{uuid.uuid4().hex[:4]}");self.PUM("Info_M",f"FEL_M:Next ver_M:{self.s_fel['nvs']}");self.CCOd=self.LToCH(self.CCOd,"FEL_VER_CALC_M",f"Next ver_M:{self.s_fel['nvs']}.",{"next_ver":self.s_fel['nvs']});emfl={"desc_M":"Cur AIOS_M Eng Py Logic","cur_ver_M":self.evs,"key_comp_hint_M":["Kernel_M","IFE_M","MRO_M"],"fsc_avail_M":True};return self.clr(tt="CT_FEL_APPLY_TIDS_M",ctd={"eng_model_obj":emfl,"tids_list_obj":self.s_fel["ltids"],"out_fmt_guide":"JSON obj:{'evo_eng_model_obj':{},'app_log_str':'','status':'Success_M'}"},ch="E_v3_3_2_M1.fel_s5(llr)")
    def fel_s5(self,llmcr): self.ccm="FEL_M";self.s_fel["eemc"]=llmcr.get("evo_eng_model_obj",{});apl=llmcr.get("app_log_str","NoLog_M");self.PUM("Info_M",f"FEL_M:TIDs concept applied_M.Log:{apl}");self.CCOd=self.LToCH(self.CCOd,"FEL_TID_APPLIED_C_M",f"LLM_M concept TIDs applied.Log:{apl[:50]}...",{"app_log":apl,"concept_model":self.s_fel["eemc"]});
        if not self.s_fel["eemc"]:self.PUM("Err_M","FEL_M:LLM_M fail evo model_M.");return self.k_pmhr("FEL_M",{"s":"FEL_ERR_TID_APP_FAIL_M"})
        return self.clr(tt="CT_FEL_REGEN_ARTEFACT_M",ctd={"evo_eng_model_obj":self.s_fel["eemc"],"target_fmt_str":"python_script_text_M","out_fmt_guide":"JSON obj:{'eng_artefact_txt':'<full_script>','chg_log_txt':'...','status':'Success_M'}"},ch="E_v3_3_2_M1.fel_s6(llr)")
    def fel_s6(self,llmcr): self.ccm="FEL_M";eat=llmcr.get("eng_artefact_txt");clt=llmcr.get("chg_log_txt","NoChgLog_M");
        if not eat:self.PUM("Err_M","FEL_M:LLM_M fail gen artefact_M.");return self.k_pmhr("FEL_M",{"s":"FEL_ERR_REGEN_FAIL_M"})
        self.PUM("Info_M",f"FEL_M:Evo eng artefact_M(V:{self.s_fel.get('nvs')})gen LLM_M.");self.PUM("GenEngArtefact_M",{"new_eng_ver":self.s_fel.get('nvs'),"eng_script_txt":eat,"chg_log":clt});self.CCOd=self.LToCH(self.CCOd or {},"FEL_MH_RESULT_M",f"Eng evo_M to {self.s_fel.get('nvs')} prop.",{"new_ver":self.s_fel.get('nvs'),"chg_log":clt}); 
        return self.k_pmhr("FEL_M",{"s":"FEL_EVO_PROP_C_M","uccoj":self.CCnlToJs(self.CCOd)})

    def tde_s1_stub(self, mi): # NEW TDE_M_STUB
        self.ccm = "TDE_M_STUB"; self.s_tde = {}
        self.l(self.ccm, "tde_s1_stub_M: Init. Reviewing plan from CCOd.")
        self.PUM("Status_M", "TDE_M_STUB: Starting Task Dispatch & Execution (Stub)...")
        if not self.CCOd or "plan_obj" not in self.CCOd:
            self.PUM("Err_M", "TDE_M_STUB: CCOd or Plan object missing."); return self.k_pmhr("TDE_M_STUB", {"s": "TDE_STUB_ERR_NO_PLAN_M"})
        
        plan = self.CCOd.get("plan_obj", {})
        self.l(self.ccm, f"tde_s1_stub_M: Loaded plan with {len(plan.get('phases',[]))} phases.")
        self.CCOd = self.LToCH(self.CCOd, "TDE_STUB_PLAN_LOADED_M", f"Plan loaded for TDE with {len(plan.get('phases',[]))} phases.", {"plan_phase_count":len(plan.get('phases',[]))})

        for phase_idx, phase in enumerate(plan.get("phases",[])):
            phase_id = phase.get("id","P_unknown")
            self.l(self.ccm, f"tde_s1_stub_M: STUB: Iterating Phase {phase_idx+1}/{len(plan.get('phases',[]))} ID: {phase_id} - {phase.get('name','NoName')}")
            tasks = plan.get("tasks_by_phase",{}).get(phase_id,[])
            for task_idx, task in enumerate(tasks):
                self.l(self.ccm, f"  tde_s1_stub_M: STUB: Iterating Task {task_idx+1}/{len(tasks)} ID: {task.get('id','T_unknown')} - {task.get('name','NoName')} (Suggested MH: {task.get('mh_suggestion','N/A')}). SIMULATED EXECUTION.")
        
        self.l(self.ccm, "tde_s1_stub_M: All planned tasks conceptually processed by stub.")
        self.PUM("Status_M", "TDE_M_STUB: All tasks in plan (simulated as processed by stub).")
        self.CCOd = self.LToCH(self.CCOd, "TDE_STUB_ALL_TASKS_SIM_M", "All tasks processed by TDE_M_STUB.")
        return self.k_pmhr("TDE_M_STUB", {"s": "TDE_STUB_C_M", "uccoj": self.KAS})

```
