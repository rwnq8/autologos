# AIOS_Engine_v5.1.py (Minified, Functionally Comprehensive, Log Optimized)
# Based on v5.0mfc-conv1, with TID_PERF_002 (Log History Export Optimization) implemented.

import json as jsn, uuid as uid, datetime as dt, time as t 

class A_MFC_v5_1: 
    def __init__(self, i_sjs=None): 
        self.lh = []  
        self.vF = "AIOS_Engine_v5.1mfc-logopt"  
        self.vS = "5.1mfc-logopt"  
        self.cM = "Sys"  
        self.sV = "2.1mfc-lo"  
        self.kAS = None  
        self.kCI = None  
        self.kMI = None  
        self.cco = None  
        
        self.sI = {} 
        self.sP = {} 
        self.sPl = {} 
        self.sCg = {} 
        self.sT = {} 
        self.sSl = {} 
        self.sK = {} 
        self.sFe = {} 
        self.sMr = {} 

        self.lg("Sys", f"INIT: {self.vS} Started.")
        if i_sjs:
            try:
                self.is_(i_sjs) 
            except Exception as e: # Catching generic Exception for broader safety during import
                self.lg("Sys", f"ERR: State import failed: {e}. Using defaults.")
                self._ids() 
        else:
            self.lg("Sys", f"INIT: {self.vS} (default state).")
        self.lg("Sys", "INIT: Completed.")

    def _ids(self): 
        self.lh = getattr(self, 'lh', []) 
        self.vF = "AIOS_Engine_v5.1mfc-logopt"  
        self.vS = "5.1mfc-logopt"  
        self.cM = "Sys"
        self.sV = "2.1mfc-lo" 
        self.kAS = None; self.kCI = None; self.kMI = None; self.cco = None
        self.sI={}; self.sP={}; self.sPl={}; self.sCg={}; self.sT={}; self.sSl={}; self.sK={}; self.sFe={}; self.sMr={}
        
    def exs(self):
        MAX_LOG_ENTRIES_IN_STATE = 50 
        lh_to_export = self.lh
        lh_summary = None
        if len(self.lh) > MAX_LOG_ENTRIES_IN_STATE:
            lh_to_export = self.lh[-MAX_LOG_ENTRIES_IN_STATE:]
            lh_summary = {
                "total_entries": len(self.lh),
                "showing_last": MAX_LOG_ENTRIES_IN_STATE,
                "oldest_shown_ts": lh_to_export[0].split(" - ")[0] if lh_to_export else None,
                "newest_shown_ts": lh_to_export[-1].split(" - ")[0] if lh_to_export else None
            }
        sd = { 
            "sV": self.sV, "vF": self.vF, "vS": self.vS, "cM": self.cM,
            "kAS": self.kAS, "kCI": self.kCI, "kMI": self.kMI, "cco": self.cco,
            "sI": self.sI, "sP": self.sP, "sPl": self.sPl, "sCg": self.sCg, 
            "sT": self.sT, "sSl": self.sSl, "sK": self.sK, "sFe": self.sFe,
            "sMr": self.sMr, 
            "lh": lh_to_export, 
            "lh_s": lh_summary 
        }
        try: return jsn.dumps(sd)
        except TypeError as e:
            self.lg("Sys", f"ERR: EXS JSON fail: {e}")
            pk = [] 
            for k, v_item in sd.items(): 
                try: jsn.dumps({k: v_item})
                except: pk.append(k); sd[k] = f"UNS ({type(v_item).__name__})"
            self.lg("Sys", f"EXS: FB with {pk}")
            return jsn.dumps(sd)

    def is_(self, sjs):
        try: sd = jsn.loads(sjs)
        except jsn.JSONDecodeError as e: self.lg("Sys", f"ERR: IS JSON fail: {e}"); raise ValueError(f"IV_SJSON: {e}") from e
        
        imported_sv = sd.get("sV")
        if imported_sv != self.sV and not (imported_sv == "2.0mfc-c1" and self.sV == "2.1mfc-lo"): 
             self.lg("Sys", f"WARN: Schema mismatch. Engine: {self.sV}, Imp: {imported_sv}. Attempting import.")
        
        # Set engine's own versions, don't adopt from state unless for initial placeholder override
        current_vF = self.vF
        current_vS = self.vS
        self.vF = sd.get("vF", current_vF) 
        self.vS = sd.get("vS", current_vS)
        if self.vS != current_vS : # If state had a different version, log it but stick to class's version
            self.lg("Sys", f"Imported state version {sd.get('vS')} noted. Engine remains {current_vS}.")
            self.vS = current_vS
            self.vF = current_vF # Ensure full version also aligns with class-defined short version
        
        self.cM = sd.get("cM", "Sys")
        self.kAS = sd.get("kAS"); self.kCI = sd.get("kCI"); self.kMI = sd.get("kMI"); self.cco = sd.get("cco")
        self.sI = sd.get("sI", {}); self.sP = sd.get("sP", {}); self.sPl = sd.get("sPl", {})
        self.sCg = sd.get("sCg", {}); self.sT = sd.get("sT", {}); self.sSl = sd.get("sSl", {})
        self.sK = sd.get("sK", {}); self.sFe = sd.get("sFe", {}); self.sMr = sd.get("sMr", {})
        self.lh = sd.get("lh", []) 
        if "lh_s" in sd and sd["lh_s"] is not None: 
             self.lg("Sys", f"Log history imported (truncated). Summary: {sd['lh_s']}")
        self.lg("Sys", f"IS: State processed. Engine now {self.vS}.")


    def _gt(self): return dt.datetime.now(dt.timezone.utc).isoformat() 
    def lg(self, c, m): 
        ts = self._gt(); vs = getattr(self, 'vS', 'unk'); fl = f"{ts} - LG ({c} v{vs}): {m}"; print(fl)
        if hasattr(self, 'lh') and isinstance(self.lh, list): self.lh.append(fl)
        else: print(f"F_LG_LH_ISSUE:{fl}"); self.lh = [f"LH_ISSUE@{ts}", fl] if not hasattr(self, 'lh') or not isinstance(self.lh, list) else self.lh 

    def _cr(self, tt, pu=None, ctd=None, eid=None, ch=None, ccd=None): 
        r = {"rts": self._gt(), "evc": self.vF, "ccm": self.cM, "tt": tt} 
        if pu: r["pu"] = pu
        if ctd: r["ctd"] = ctd
        if eid: r["eid"] = eid
        if ch: r["ch"] = ch
        cp = ccd if ccd is not None else self.cco 
        if cp:
            if isinstance(cp, dict): r["ccd"] = cp
            elif isinstance(cp, str):
                try: r["ccd"] = jsn.loads(cp)
                except: r["ccd"] = {"err": "CCO parse fail", "prev": cp[:100]}
        return {"s": "A_LLM", "rd": r, "ces": self.exs()} 

    def _ges(self): # Retained for potential internal use, though _cr now uses exs()
        s = {"kCI": self.kCI, "kMI": self.kMI, "kAS100": (self.kAS[:100] + "...") if self.kAS else None, 
             "ccoId": self.cco.get('id', self.cco.get('cco_id', 'N/A')) if isinstance(self.cco, dict) else 'N/A', 
             "ccm_log": self.cM, "sV": self.sV}
        for dn in ['sI', 'sP', 'sPl', 'sCg', 'sT', 'sSl', 'sK', 'sFe', 'sMr']: 
            d_val = getattr(self, dn, {}); 
            if d_val: s[f"{dn}K"] = list(d_val.keys()) 
        return s

    def pum(self, mt, mc): 
        self.lg(self.cM, f"PUM: {mt}: {mc if isinstance(mc, str) else type(mc).__name__}"); 
        return self._cr(tt="PUM", ctd={"mt": mt, "c": mc, "rmh": self.cM}, ch="Orch.present_message_to_user")

    def pco(self, jsi): 
        if jsi is None or not isinstance(jsi, str) or jsi.strip() == "": self.lg(self.cM, "PCO: Null/empty input."); return None
        try: return jsn.loads(jsi)
        except jsn.JSONDecodeError as e: self.lg(self.cM, f"ERR: PCO JSON fail: {e}. Input: '{jsi[:50]}...'"); raise ValueError(f"JSON_PARSE_ERR: {e}") from e

    def cjo(self, coi): 
        if coi is None: return "null"
        try: return jsn.dumps(coi)
        except TypeError as e: self.lg(self.cM, f"ERR: CJO JSON fail: {e}"); raise ValueError(f"JSON_FORMAT_ERR: {e}") from e

    def lco(self, cco_d, let, msg, ado=None): 
        if not isinstance(cco_d, dict): self.lg(self.cM, "LCO: CCO not a dict. Creating."); cco_d = {"olj": "[]"} 
        log_key = "olj" if "olj" in cco_d else "operational_log_cco_json"
        if log_key not in cco_d: cco_d[log_key] = "[]"
        oll = self.pco(cco_d.get(log_key, "[]")); oll = [] if not isinstance(oll, list) else oll 
        nle = {"ts": self._gt(), "let": let, "lm": msg} 
        if ado is not None: nle["adj"] = self.cjo(ado) 
        oll.append(nle); cco_d[log_key] = self.cjo(oll); self.cco = cco_d; self.kAS = self.cjo(cco_d); return cco_d

    def f_ipo(self, pu, ol): 
        cont_hint_mh = self.cM.lower() if self.cM else "kernel" 
        return self._cr(tt="UIR_PO", pu=pu, ctd={"o": ol, "it": "os"}, eid="JSON {'s':'UC','c':<v>}", ch=f"A_MFC_v5_1().{cont_hint_mh}_pirc(r)")

    def f_iei(self, pu, h=None, ch=None): 
        cont_hint_mh = self.cM.lower() if self.cM else "kernel"
        ch = ch or f"A_MFC_v5_1().{cont_hint_mh}_s2(r)" 
        return self._cr(tt="UIR_ET", pu=pu, ctd={"it": "ft", "h": h} if h else {"it": "ft"}, eid="JSON {'s':'UC','c':<txt>}", ch=ch)

    def f_gid(self, p): return {"s": "Gen", "uid": f"{p}{uid.uuid4()}"} 

    def f_dts(self, i, cx, dlh, rgh, okn="dtxt", ch_override=None): 
        cont_hint_mh = self.cM.lower() if self.cM else "kernel"
        ch = ch_override if ch_override else f"A_MFC_v5_1().{cont_hint_mh}_s_cdt(r)" 
        return self._cr(tt="CT_DDT", ctd={"tsn": "cDTS", "i": i, "cx": cx, "dlh": dlh, "rgh": rgh, "ofg": f"JSON {{'{okn}':'','s':'DraftComplete'}}"}, eid=f"JSON {{'{okn}':'<txt>','s':'DraftComplete'}}", ch=ch, ccd=self.cco)

    def f_ucs(self, cco_d, sp, ncj): 
        if not isinstance(cco_d, dict): self.lg(self.cM, "fUCS: CCO not dict."); return cco_d
        ks = sp.split('.'); cl = cco_d 
        try:
            for i_idx, k_key in enumerate(ks): 
                if i_idx == len(ks) - 1: cl[k_key] = ncj
                else:
                    if k_key not in cl or not isinstance(cl[k_key], dict): cl[k_key] = {}
                    cl = cl[k_key]
            self.cco = cco_d; self.kAS = self.cjo(cco_d); return cco_d
        except Exception as ex: self.lg(self.cM, f"ERR: fUCS '{sp}': {ex}"); return cco_d

    def f_mrp(self, dcjs, rgo_obj, ccjs, cmc, cch): 
        return self.mro_s1i(djs=dcjs, rgjs=self.cjo(rgo_obj), ccjs=ccjs, cmc=cmc, cch=cch) 

    def f_iud(self, uit): 
        l_str = uit.lower().strip(); nid = "AUI"; ni = {}; upm = "Cmd not understood. What next?" 
        if any(x in l_str for x in ["new process", "new", "start over"]) or l_str in ["1", "1."]: nid = "IFE"; upm = None
        elif any(x in l_str for x in ["evolve engine", "evolve"]) or l_str in ["2", "2."]: nid = "FEL"; upm = None
        elif any(x in l_str for x in ["terminate aios", "terminate", "exit", "quit"]) or l_str in ["3", "3."]: nid = "TA"; upm = None
        elif "define problem" in l_str or "pdf" in l_str: nid = "PDF"; upm = None
        elif "create plan" in l_str or "plan" in l_str: nid = "PLN"; upm = None
        elif "execute plan" in l_str or "run tasks" in l_str or "tde" in l_str: nid = "TDE"; upm = None
        elif "explore solutions" in l_str or "sel" in l_str: nid = "SEL"; upm = None
        elif "update knowledge" in l_str or "kau" in l_str or "learn" in l_str: nid = "KAU"; upm = None
        r = {"s": "OK" if nid != "AUI" else "Clarify", "nid": nid, "nijs": self.cjo(ni)};
        if upm: r["upm"] = upm
        return r

    def f_qacr(self, ccjs, ccf): return self._cr(tt="CT_MRO_QACR", ctd={"ccj": ccjs, "ccf": ccf, "ofg": "JSON {'r':[]}"}, eid="JSON {'r':[]}", ch="A_MFC_v5_1().mro_cacr(r)") 
    def f_acc(self, ctcr, qcj, cx, ar): return self._cr(tt="CT_MRO_ACC", ctd={"ctcj": ctcr, "qcj": qcj, "cxj": cx, "arj": ar, "ofg": "JSON {'qr':'report_text_or_obj'}"}, eid="JSON {'qr':'...'}", ch="A_MFC_v5_1().mro_cacc(r)") 
    def f_uvds(self, doj, sn): return self._cr(tt="CT_MRO_VS", ctd={"doj": doj, "sn": sn, "ofg": "JSON {'iv':True/False,'e':'...'}"}, eid="JSON {'iv':True/False,'e':'...'}", ch="A_MFC_v5_1().mro_cav(r)") 
    def f_asc(self, rcrjas, sgjs): return self._cr(tt="CT_MRO_SC", ctd={"rcrjas": rcrjas, "sgjs": sgjs, "ofg": "JSON {'scs':{...}}"}, eid="JSON {'scs':{...}}", ch="A_MFC_v5_1().mro_casc(r)") 
    def f_csr(self, ccj, scj, cxj): return self._cr(tt="CT_MRO_CSR", ctd={"ccj": ccj, "scj": scj, "cxj": cxj, "ofg": "JSON {'rs':{...}}"}, eid="JSON {'rs':{...}}", ch="A_MFC_v5_1().mro_casr(r)") 
    def f_car(self, ccj, ri, cxj): return self._cr(tt="CT_MRO_CAR", ctd={"ccj": ccj, "rij": ri, "cxj": cxj, "ofg": "JSON {'rc':'revised_content_text_or_obj'}"}, eid="JSON {'rc':'...'}", ch="A_MFC_v5_1().mro_caar(r)") 
    def f_acv(self, cv1, cv2, ct): return self._cr(tt="CT_MRO_ACV", ctd={"cv1j": cv1, "cv2j": cv2, "ctj": ct, "ofg": "JSON {'cr':{...}}"}, eid="JSON {'cr':{...}}", ch="A_MFC_v5_1().mro_cacv(r)") 
    
    def f_fcnv(self, cer): return self._cr(tt="CT_FEL_CNV", ctd={"cer": cer, "ofg": "JSON {'nvs':'x.y.z','s':'OK'}"}, eid="JSON {'nvs':'...','s':'OK'}", ch="A_MFC_v5_1().fel_s4pv(r)") 
    def f_flt(self, tsd): return self._cr(tt="CT_FEL_LT", ctd={"tsd": tsd, "ofg": "JSON {'tl':[],'s':'OK'}"}, eid="JSON {'tids_loaded':[],'s':'OK'}", ch="A_MFC_v5_1().fel_s3pt(r)")  
    def f_fatem(self, cem, tta): return self._cr(tt="CT_FEL_ATEM", ctd={"cem": cem, "tta": tta, "ofg": "JSON {'eem':{},'al':'...','s':'OK'}"}, eid="JSON {'eem':{},'al':'...','s':'OK'}", ch="A_MFC_v5_1().fel_s5pat(r)") 
    def f_urea(self, eem, tf="py"): return self._cr(tt="CT_FEL_UREA", ctd={"eem": eem, "tf": tf, "ofg": "JSON {'eat':'<txt>','clt':'...','s':'OK'}"}, eid="JSON {'eat':'<txt>','clt':'...','s':'OK'}", ch="A_MFC_v5_1().fel_s6f(r)") 

    def f_aled(self, dta, lf, cco_): return self._cr(tt="CT_KAU_ALED", ctd={"dta": dta, "lf": lf, "cco": cco_, "ofg": "JSON {'l':[]}"}, eid="JSON {'learnings':[{...}],'s':'OK'}", ch="A_MFC_v5_1().kau_s2pl(r)") 
    def f_agso(self, pc, cco_): return self._cr(tt="CT_SEL_AGSO", ctd={"pc": pc, "cco": cco_, "ofg": "JSON {'so':[]}"}, eid="JSON {'solution_options':[{...}],'s':'OK'}", ch="A_MFC_v5_1().sel_s2pgo(r)") 
    def f_aeso(self, so, ec, cco_): return self._cr(tt="CT_SEL_AESO", ctd={"so": so, "ec": ec, "cco": cco_, "ofg": "JSON {'oid':'','es':{},'sum':''}"}, eid="JSON {'oid':'','es':{},'sum':'','s':'OK'}", ch="A_MFC_v5_1().sel_sper(r)") 
    def f_adp(self, ps, cco_): return self._cr(tt="CT_PDF_ADP", ctd={"ps": ps, "cco": cco_, "ofg": "JSON {'dd':{}}"}, eid="JSON {'decomposition_details':{...},'s':'OK'}", ch="A_MFC_v5_1().pdf_s3pd(r)") 
    def f_pcp(self, pd, cco_): return self._cr(tt="CT_PLN_PCP", ctd={"pd": pd, "cco": cco_, "ofg": "JSON {'phs':[]}"}, eid="JSON {'phases':[{...}],'s':'OK'}", ch="A_MFC_v5_1().pln_s2pp(r)") 
    def f_pct(self, ph, pd, cco_): return self._cr(tt="CT_PLN_PCT", ctd={"ph": ph, "pd": pd, "cco": cco_, "ofg": "JSON {'tsks':[]}"}, eid="JSON {'tasks':[{...}],'s':'OK'}", ch="A_MFC_v5_1().pln_spt(r)") 

    def k_st(self, sjs=None):  
        if sjs:
            try:
                self.is_(sjs)
                self.lg("K", f"RESTART: From state (MH: {self.kCI}).")
                if self.kCI and self.kCI != "AUI": return self.k_rcmh() 
                else: return self.k_pio()  
            except Exception as e:
                self.lg("K", f"ERR: State import fail in k_st: {e}. Starting fresh.")
                self._ids(); self.cM = "K"; self.lg("K", f"{self.vF} starting (post-import-error).")
                self.pum("Status", f"{self.vF} Init. Ready."); res = self.k_pio(); self.lg("K", "START: Done (post-error)."); return res
        self.cM = "K"; self.lg("K", f"{self.vF} starting.")
        self.pum("Status", f"{self.vF} Init. Ready."); res = self.k_pio(); self.lg("K", "START: Done."); return res

    def k_pio(self): 
        self.cM = "K"; self.lg(self.cM, "PIO: Presenting init opts.")
        opts = [{"v": "NP", "l": "1. New Process"}, {"v": "EE", "l": "2. Evolve Engine"}, {"v": "TA", "l": "3. Terminate"}]
        return self.f_ipo(pu=f"AIOS v{self.vS} Ready. How to begin?", ol=opts)

    def kernel_pirc(self, llr): 
        self.cM = "K"
        if not llr or not isinstance(llr, dict) or llr.get("s") != "UC": 
            self.lg(self.cM, "Invalid initial choice result. Reprompting.")
            self.pum("Warning", "Invalid choice. Retry.")
            return self.k_pio()
        
        cmd = llr.get("c", llr.get("command")) 
        self.lg(self.cM, f"Processing initial choice: '{cmd}'")
        ir = self.f_iud(cmd) 
        self.kCI = ir.get("nid"); self.kMI = ir.get("nijs")
        if self.kCI == "TA":
            self.pum("Status", "AIOS termination initiated.")
            return {"s": "TERM_REQ", "fes": self.exs()} 
        elif self.kCI and self.kCI != "AUI": self.lg(self.cM, f"Kernel: Next MH: {self.kCI}"); return self.k_rcmh()
        else: self.pum("Warning", ir.get("upm", f"Unrecognized choice: '{cmd}'.")); return self.k_pio()

    def k_rcmh(self): 
        self.cM = "K"
        if self.kCI == "TA": self.pum("Status", "AIOS terminated."); return {"s": "TERM", "fes": self.exs()}
        elif self.kCI == "AUI" or not self.kCI: self.lg(self.cM, "Kernel paused."); return self._cr(tt="UIR_GD", pu="AIOS paused. What next?", eid="User's command.", ch="A_MFC_v5_1().k_pgud(r)") 
        self.lg(self.cM, f"Kernel: Executing MH: {self.kCI}"); self.pum("Status", f"Executing MH: {self.kCI}")
        mi = self.pco(self.kMI) if self.kMI else {} 
        mh_map = {"IFE": self.ife_s1, "PDF": self.pdf_s1, "PLN": self.pln_s1, "TDE": self.tde_s1, 
                    "CAG": self.cag_s1, "SEL": self.sel_s1, "KAU": self.kau_s1, "FEL": self.fel_s1i,
                    "MRO": self.mro_s1i 
                   }
        if self.kCI in mh_map: return mh_map[self.kCI](mi)
        else: self.lg(self.cM, f"ERR: MH '{self.kCI}' not impl."); self.pum("Error", f"MH '{self.kCI}' not available."); self.kCI = "AUI"; return self.k_rcmh()

    def k_pmr(self, mjid, mhr): 
        self.cM = "K"; s_status = mhr.get("s"); self.lg(self.cM, f"Processing result from '{mjid}'. Status: '{s_status}'") 
        if not mhr or not isinstance(mhr, dict): self.pum("Error", f"Invalid result from '{mjid}'."); self.kCI = "AUI"; return self.k_rcmh()
        
        if s_status == "MRO_PIPELINE_COMPLETE":
            self.lg(self.cM, f"MRO complete. Returning to {mhr.get('cmc')} via {mhr.get('cch')}")
            cmn = mhr.get("cch"); 
            if cmn and hasattr(self, cmn.split('.')[-1]):
                return getattr(self, cmn.split('.')[-1])(mhr.get("mro_result", {})) 
            else: self.lg(self.cM, f"ERR: Invalid MRO cont hint: '{cmn}'"); self.kCI = "AUI"; return self.k_rcmh()

        if "uccoj" in mhr: self.kAS = mhr["uccoj"]; self.cco = self.pco(self.kAS); self.lg(self.cM, f"CCO updated by '{mjid}'.")
        elif self.cco is not None: self.kAS = self.cjo(self.cco) 
        
        if s_status == "A_LLM": self.lg(self.cM, f"'{mjid}' awaits LLM for: {mhr.get('rd',{}).get('tt')}"); return mhr
        
        ld = mhr.get("dfl") 
        if self.cco is None: 
             self.cco = {"id": f"kcco_{uid.uuid4().hex[:4]}", "olj": "[]"}; self.kAS = self.cjo(self.cco); self.lg(self.cM, "Init minimal CCO for MH_C.")
        self.cco = self.lco(self.cco, "MH_C", f"{mjid} s: {s_status}.", ld) 
        
        if "Error" in s_status or "Failed" in s_status or "ERR" in s_status: self.pum("Error", f"MH {mjid} issue: {s_status}.") 
        else: self.pum("Status", f"{mjid} completed with status: {s_status}.")
        
        nMH = "AUI"; ni = {} 
        if mjid == "IFE" and "Complete" in s_status: nMH = "PDF"
        elif mjid == "PDF" and "Complete" in s_status: nMH = "PLN"
        elif mjid == "PLN" and "Complete" in s_status: nMH = "TDE"
        elif mjid == "TDE" and "AllTasksComplete" in s_status: nMH = "KAU" 
        elif mjid == "CAG" : 
            if "SubTask_Complete_ReturnToTDE" in s_status: nMH = "TDE" 
            elif "UserReview" in s_status or "Complete" in s_status : nMH = "AUI" 
        elif mjid == "SEL" and "Complete" in s_status: nMH = "KAU" 
        elif mjid == "KAU" and "Complete" in s_status: nMH = "AUI" 
        elif mjid == "FEL" and "EvolutionProposed_Complete" in s_status: nMH = "TA" 
        
        self.kCI = nMH; self.kMI = self.cjo(ni)
        if "Complete" in s_status and nMH != "TA" and self.cco: self.pum("Suggestion", "Significant work completed. Consider saving CCO state.")
        return self.k_rcmh()

    def k_pgud(self, llr): 
        self.cM = "K"; udt = llr.get("c", llr.get("command", "")); self.lg(self.cM, f"Processing general directive: '{udt}'")
        ir = self.f_iud(udt) 
        self.kCI = ir.get("nid", "AUI"); self.kMI = ir.get("nijs", "{}")
        if self.kCI == "AUI" and ir.get("upm"): return self._cr(tt="UIR_GD", pu=ir.get("upm"), ch="A_MFC_v5_1().k_pgud(r)") 
        return self.k_rcmh()

    def ife_s1(self, a): 
        self.cM = "IFE"; self.sI = {}; self.lg(self.cM, "S1: Start")
        self.pum("Status", f"IFE (v{self.vS}): Starting...")
        self.sI["u_ptfk"] = a.get("uip") if a else None 
        self.sI["cco_jfk"] = a.get("eccojir") if a else self.kAS 
        self.cco = self.pco(self.sI["cco_jfk"]) if self.sI["cco_jfk"] else None
        if self.sI["u_ptfk"]:
            self.lg(self.cM, "Core idea from Kernel.")
            llr = {"s": "UC", "c": self.sI["u_ptfk"], "ut": self.sI["u_ptfk"]}
            return self.ife_s2(llr) 
        else:
            self.lg(self.cM, "Eliciting core idea.")
            return self.f_iei(pu="What's the core idea/problem?", ch=f"A_MFC_v5_1().ife_s2(r)") 

    def ife_s2(self, llr): 
        self.cM = "IFE"
        upt = llr.get("c", llr.get("user_text")) 
        self.lg(self.cM, f"S2: Core idea: '{upt}'")
        if not upt:
            self.pum("Error", "No core idea provided.")
            return self.k_pmr("IFE", {"s": "IFE_Failed_NoCoreIdea", "uccoj": self.cjo(self.cco)})
        self.sI["uci"] = upt 
        if self.cco is None:
            self.lg(self.cM, "Init new CCO.")
            id_res = self.f_gid("cco_"); nid = id_res.get("uid") 
            psumm = self.sI["uci"][:47] + "..." if len(self.sI["uci"]) > 50 else self.sI["uci"] 
            self.cco = {
                "cco_id": nid, "parent_cco_id": None,
                "metadata_internal_cco": {"name_label": f"CCO for: {psumm}", "current_form": "IFE", 
                                          "target_product_form_descriptor": "To_Be_Defined_PDF-MH",
                                          "schema_version_used": "AIOS_CCO_Schema_v3.0", "engine_version_context": self.vF,
                                          "user_provided_creation_date_context": self._gt(), "tags_keywords": psumm.split()[:3],
                                          "current_phase_id": "IFE_S2_DefineEssence", "phase_history_json": "[]"},
                "core_essence_json": "null",
                "initiating_document_scaled_json": jsn.dumps({"user_prompt": self.sI["uci"]}),
                "plan_structured_json": "null", "product_content_data_json": "null",
                "knowledge_artifacts_contextual_json": jsn.dumps({"LHR":[], "LHL":[], "style_guide_active_json":"null", "glossary_active_json":"null"}), 
                "execution_log_detailed_json": "[]", "operational_log_cco_json": "[]",
                "associated_data_json": "null", "open_seeds_exploration_json": "null"
            }
            self.cco = self.lco(self.cco, let="IFE_EVT", msg="New CCO init.", ado={"nid": nid})
            self.pum("Info", f"New CCO {nid} created.")
        else:
            self.lg(self.cM, f"Using existing CCO: {self.cco.get('cco_id', 'N/A')}")
            self.cco = self.lco(self.cco, let="IFE_EVT", msg=f"Processing idea: '{self.sI['uci']}'", ado={"p": self.sI['uci']})
        self.kAS = self.cjo(self.cco) 
        self.lg(self.cM, "Req LLM to draft core essence.")
        dc = {"upi": self.sI["uci"], "cco_id": self.cco.get("cco_id"), "cpi": self.cco.get("metadata_internal_cco", {}).get("current_phase_id"), "eg": f"Focus on TP. Adhere to {self.vS}."} 
        return self.f_dts(i="Draft 'core_essence_text'.", cx=dc, dlh="1-3 sent", rgh="summ_insp_def_ce", okn="cet", ch_override=f"A_MFC_v5_1().ife_s3(r)") 

    def ife_s3(self, llr): 
        self.cM = "IFE"; self.lg(self.cM, "S3: Received LLM draft for core essence.")
        if not llr or llr.get("s") != "DraftComplete" or not llr.get("cet"):
            self.pum("Error", "Invalid core essence draft. Placeholder.")
            llr_payload = {"cet": "Placeholder essence due to LLM draft error.", "s": "ErrFall_Draft"}
        else:
            llr_payload = {"cet": llr.get("cet"), "status_from_dts": llr.get("s")}

        self.sI["dejs_mro"] = self.cjo(llr_payload) 
        self.lg(self.cM, "Req LLM to refine core essence (MRO).")
        rgo = { 
            "qcj": self.cjo({f"AIOS_v{self.vS}_TVNF": True, f"AIOS_v{self.vS}_IDCF": True, "ClarityAndImpact": True, "TargetProductForm": "Core Essence for CCO"}), 
            "cfh": "Maximize Transformative Value of the 'cet'. Ensure it's concise yet comprehensive.", 
            "rsv": False 
        }
        return self.f_mrp(dcjs=self.sI["dejs_mro"], rgo_obj=rgo, ccjs=self.cjo(self.cco), cmc="IFE", cch="A_MFC_v5_1().ife_s4(r)") 

    def ife_s4(self, mro_res): 
        self.cM = "IFE"; 
        self.lg(self.cM, f"S4: Received MRO result. Status: {mro_res.get('s')}")
        if not mro_res or mro_res.get("s") not in ["Success_Converged", "Success_MaxIterReached"] or not mro_res.get("roj"):
            self.pum("Warning", "MRO didn't refine. Using pre-MRO draft.")
            self.sI["rejs_cco"] = mro_res.get("roj", self.sI.get("dejs_mro", self.cjo({"cet": "MRO Error in IFE S4"}))) 
        else: self.sI["rejs_cco"] = mro_res.get("roj") 
        
        self.cco = self.f_ucs(self.cco, "core_essence_json", self.sI["rejs_cco"])
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_form", "PDF_Ready") 
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "IFE_Complete")

        self.cco = self.lco(self.cco, "IFE_EVT", f"Core essence finalized. MRO Status: {mro_res.get('s', 'N/A')}", self.pco(self.sI["rejs_cco"]))
        self.lg(self.cM, "Concluded successfully."); self.pum("Status", "IFE: Idea Exploration complete.")
        final_res = {"s": "IFE_Complete", "uccoj": self.cjo(self.cco), "dfl": {"summary": f"IFE finished for CCO ID: {self.cco.get('cco_id', 'N/A')}"}}
        return self.k_pmr("IFE", final_res)

    def pdf_s1(self, mi): 
        self.cM = "PDF"; self.sP = {}; self.lg(self.cM, "S1: Start"); self.pum("Status", "PDF: Starting...")
        if not self.cco or not self.pco(self.cco.get("core_essence_json")): 
             self.pum("Error", "PDF: Missing CCO or valid core_essence_json."); return self.k_pmr("PDF", {"s": "PDF_ERR_NO_ESSENCE", "uccoj": self.cjo(self.cco)})
        self.sP["ceo"] = self.pco(self.cco.get("core_essence_json")) 
        self.pum("Info", f"PDF: Reviewing core essence: {self.sP['ceo'].get('cet','Error reading essence')}")
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "PDF_S1_ElicitDetails")
        self.kAS = self.cjo(self.cco)
        return self.f_iei(pu="PDF: Further details/constraints for problem definition?", ch=f"A_MFC_v5_1().pdf_s2(r)") 

    def pdf_s2(self, llr): 
        self.cM = "PDF"; ud = llr.get("c", llr.get("user_text")); self.sP["ud"] = ud 
        self.lg(self.cM, f"S2: Received details: {ud}")
        self.cco = self.lco(self.cco, "PDF_DETAILS", "User provided details.", {"details": ud})
        psfa = f"Core Essence: {self.sP['ceo'].get('cet', '')}\nUser Details: {ud}" 
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "PDF_S2_DecomposeProblem")
        self.kAS = self.cjo(self.cco)
        return self.f_adp(psfa, self.cco) 

    def pdf_s3pd(self, llr): 
        self.cM = "PDF"; self.lg(self.cM, f"S3: Received decomposition: {type(llr).__name__}")
        dd = llr.get("decomposition_details", llr if isinstance(llr,dict) else {}) 
        self.sP["dd"] = dd
        
        ka_str = self.cco.get("knowledge_artifacts_contextual_json", "{}")
        ka = self.pco(ka_str)
        if not isinstance(ka, dict): ka = {} 
        ka["problem_definition_details_json"] = self.cjo(self.sP["dd"]) 
        self.cco = self.f_ucs(self.cco, "knowledge_artifacts_contextual_json", self.cjo(ka))
        
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_form", "PLAN_Ready")
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "PDF_Complete")
        self.cco = self.lco(self.cco, "PDF_RESULT", "Problem decomposition stored.", self.sP["dd"])
        self.pum("Info", "PDF: Problem decomposition complete.")
        return self.k_pmr("PDF", {"s": "PDF_Complete", "uccoj": self.cjo(self.cco)})

    def pln_s1(self, mi): 
        self.cM = "PLN"; self.sPl = {}; self.lg(self.cM, "S1: Start"); self.pum("Status", "PLAN: Starting...")
        if not self.cco: self.pum("Error", "PLAN: Missing CCO."); return self.k_pmr("PLN", {"s": "PLN_ERR_NO_CCO"})
        
        ka_str = self.cco.get("knowledge_artifacts_contextual_json", "{}")
        ka = self.pco(ka_str)
        if not ka or not isinstance(ka.get("problem_definition_details_json"), str):
            self.pum("Error", "PLAN: Missing problem definition in KAs."); return self.k_pmr("PLN", {"s": "PLN_ERR_NO_PDF_IN_KA"})
        
        self.sPl["pd"] = self.pco(ka["problem_definition_details_json"]) 
        self.pum("Info", f"PLAN: Using problem definition: {type(self.sPl['pd']).__name__}")
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "PLN_S1_CreatePhases")
        self.kAS = self.cjo(self.cco)
        return self.f_pcp(self.sPl["pd"], self.cco) 

    def pln_s2pp(self, llr): 
        self.cM = "PLN"; self.lg(self.cM, f"S2: Received phases: {type(llr).__name__}")
        phs = llr.get("phases", []) 
        if not phs: self.pum("Warning", "PLAN: No phases generated."); return self.k_pmr("PLN", {"s": "PLN_ERR_NO_PHS"})
        self.sPl["phs"] = phs
        self.sPl["po"] = {"phases": self.sPl["phs"], "tasks_by_phase_id": {}} 
        self.sPl["cpi"] = 0 
        self.cco = self.lco(self.cco, "PLN_PHASES", "Plan phases created.", {"phases": phs})
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "PLN_S2_CreateTasks")
        self.kAS = self.cjo(self.cco)
        return self._pln_pnt() 

    def _pln_pnt(self): 
        self.cM = "PLN"
        if self.sPl["cpi"] >= len(self.sPl["phs"]): return self.pln_s3fp() 
        cp = self.sPl["phs"][self.sPl["cpi"]] 
        self.lg(self.cM, f"Req tasks for phase: {cp.get('id')} - {cp.get('name')}")
        return self.f_pct(ph=cp, pd=self.sPl["pd"], cco_=self.cco) 

    def pln_spt(self, llr): 
        self.cM = "PLN"; cpi = self.sPl["cpi"]; cpid = self.sPl["phs"][cpi].get("id", f"phase_{cpi}") 
        self.lg(self.cM, f"Rcvd tasks for phase {cpid}: {type(llr).__name__}")
        tsks = llr.get("tasks", []) 
        self.sPl["po"]["tasks_by_phase_id"][cpid] = tsks
        self.cco = self.lco(self.cco, let="PLN_TASKS", msg=f"Tasks for {cpid} created.", ado={"pid": cpid, "tc": len(tsks)})
        self.sPl["cpi"] += 1
        self.kAS = self.cjo(self.cco)
        return self._pln_pnt()

    def pln_s3fp(self): 
        self.cM = "PLN"; self.lg(self.cM, "All phases proc. Finalizing plan.")
        pjs = self.cjo(self.sPl["po"]); self.cco = self.f_ucs(self.cco, "plan_structured_json", pjs)
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_form", "TDE_Ready")
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "PLN_Complete")
        self.cco = self.lco(self.cco, let="PLN_FINAL", msg="Plan finalized.", ado=self.sPl["po"])
        self.pum("Info", "PLAN: Plan generation complete.")
        return self.k_pmr("PLN", {"s": "PLAN_Complete", "uccoj": self.cjo(self.cco)})

    def tde_s1(self, mi): 
        self.cM = "TDE"; self.sT = {}; self.lg(self.cM, "S1: Start"); self.pum("Status", "TDE: Starting...")
        if not self.cco or not self.cco.get("plan_structured_json") or self.cco.get("plan_structured_json") == "null": 
            self.pum("Error", "TDE: Missing CCO or plan."); return self.k_pmr("TDE", {"s": "TDE_ERR_NO_PLAN"})
        self.sT["plan"] = self.pco(self.cco.get("plan_structured_json"))
        if not self.sT["plan"] or not self.sT["plan"].get("phases"): 
            self.pum("Error", "TDE: Invalid plan structure."); return self.k_pmr("TDE", {"s": "TDE_ERR_INV_PLAN"})
        self.sT["cpi"] = 0; self.sT["ctip"] = 0 
        self.pum("Info", f"TDE: Loaded plan ({len(self.sT['plan']['phases'])} phases).")
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "TDE_S1_ExecTasks")
        self.cco = self.lco(self.cco, let="TDE_START", msg=f"Plan loaded ({len(self.sT['plan']['phases'])} phases).", ado={"pc": len(self.sT['plan']['phases'])})
        self.kAS = self.cjo(self.cco)
        return self._tde_pnt() 

    def _tde_pnt(self): 
        self.cM = "TDE"; s = self.sT
        if s["cpi"] >= len(s["plan"]["phases"]): self.lg(self.cM, "All phases processed."); return self._tde_fin()
        
        cp = s["plan"]["phases"][s["cpi"]]; cpid = cp.get("id"); 
        tsks = s["plan"].get("tasks_by_phase_id", {}).get(cpid, []) 
        
        if s["ctip"] >= len(tsks): 
            self.lg(self.cM, f"Phase {cpid} complete."); s["cpi"] += 1; s["ctip"] = 0; 
            self.kAS = self.cjo(self.cco); 
            return self._tde_pnt()
        
        ct = tsks[s["ctip"]]; self.lg(self.cM, f"Dispatching task: {ct.get('id')} - {ct.get('name')}"); 
        self.pum("Info", f"TDE: Starting '{ct.get('name')}'") 
        
        tt = ct.get("type", "unknown").lower(); mhs = ct.get("assigned_mh_suggestion", "").upper() 
        
        sub_mh_id_to_call = None
        if mhs == "CAG": sub_mh_id_to_call = "CAG"
        elif mhs == "SEL": sub_mh_id_to_call = "SEL"
        elif mhs == "KAU": sub_mh_id_to_call = "KAU"
        elif mhs == "PDF" and ct.get("is_sub_problem_definition", False) : sub_mh_id_to_call = "PDF" 

        if sub_mh_id_to_call:
            self.lg(self.cM, f"Task '{ct.get('name')}' -> Sub-MH: {sub_mh_id_to_call}")
            self.sT["_current_task_being_processed"] = ct 
            self.kCI = sub_mh_id_to_call 
            self.kMI = self.cjo({"task_details": ct, "ccoj": self.kAS, "caller_mh": "TDE"}) 
            return self.k_rcmh() 
        else:
            self.lg(self.cM, f"Task '{ct.get('name')}' (type: {tt}, MH: {mhs}) requires direct LLM or other. Simulating.")
            self.pum("Info", f"TDE: Task '{ct.get('name')}' execution simulated by LLM/Orchestrator.")
            self.cco = self.lco(self.cco, "TDE_TASK_SIM", f"Task '{ct.get('id')}' simulated.", {"task":ct})
            s["ctip"] += 1;  self.kAS = self.cjo(self.cco);
            return self._tde_pnt() 

    def _tde_fin(self): 
        self.cM = "TDE"; self.lg(self.cM, "All tasks executed.")
        self.pum("Status", "TDE: All planned tasks processed.")
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_form", "KAU_Ready") 
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "TDE_Complete")
        self.kAS = self.cjo(self.cco)
        return self.k_pmr("TDE", {"s": "TDE_AllTasksComplete", "uccoj": self.cjo(self.cco)})

    def cag_s1(self, mi): 
        self.cM = "CAG"; self.sCg = {}; self.lg(self.cM, "S1: Start"); self.pum("Status", f"CAG (v{self.vS}): Starting...")
        ccojs = mi.get("ccoj", self.kAS if self.kAS else self.cjo(self.cco))
        self.cco = self.pco(ccojs) if ccojs else self.cco 
        
        if not self.cco or not self.pco(self.cco.get("core_essence_json")):
            self.pum("Error", "CAG: Missing CCO or core essence."); return self.k_pmr("CAG", {"s": "CAG_ERR_NO_ESSENCE", "uccoj":self.cjo(self.cco)})
        
        ceo = self.pco(self.cco.get("core_essence_json", "{}")) 
        cets = ceo.get("cet", "The core idea.") 
        
        task_instr = mi.get("task_details", {}).get("instructions", f"Draft content based on essence: '{cets}'")
        target_doc_part = mi.get("task_details", {}).get("target_section_name", "General Content Draft")
        self.sCg["target_doc_part"] = target_doc_part 
        self.pum("Info", f"CAG: Drafting '{target_doc_part}' based on: '{cets}'")

        ka_str = self.cco.get("knowledge_artifacts_contextual_json", "{}")
        ka = self.pco(ka_str) if isinstance(ka_str, str) else (ka_str if isinstance(ka_str, dict) else {})

        dc = {"ces": cets, "ccoid": self.cco.get("cco_id"), "task_instr": task_instr,
              "style_guide": self.pco(ka.get("style_guide_active_json","null")),
              "glossary": self.pco(ka.get("glossary_active_json","null")),
              "target_doc_part": target_doc_part
             } 
        di = f"Draft '{target_doc_part}'. {task_instr}. Adhere to {self.vS} principles. Integrate KAs." 
        
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", f"CAG_S1_Draft_{target_doc_part.replace(' ','_')[:10]}")
        self.kAS = self.cjo(self.cco)
        return self.f_dts(i=di, cx=dc, dlh="1-2 para", rgh=f"draft_{target_doc_part.replace(' ','_')[:15]}", okn="sdt", ch_override=f"A_MFC_v5_1().cag_s2(r)") 

    def cag_s2(self, llr): 
        self.cM = "CAG"; self.lg(self.cM, "S2: Received LLM draft.")
        if not llr or llr.get("s") != "DraftComplete" or not llr.get("sdt"):
            self.pum("Error", "CAG: Invalid draft. Placeholder.")
            draft_payload = {"sdt": "Placeholder section due to LLM draft error.", "status_from_dts": "ErrorFallback_Draft"}
        else: draft_payload = {"sdt": llr.get("sdt"), "status_from_dts": llr.get("s")}

        self.sCg["djs_mro"] = self.cjo(draft_payload) 
        self.lg(self.cM, "Req MRO refinement.")
        rgo = {"qcj": self.cjo({f"AIOS_v{self.vS}_TVNF": True, f"AIOS_v{self.vS}_IDCE": True, "ClarityAndEngagement": True, "LogicalFlow": True}), 
               "cfh": "Refine for narrative, insight, and adherence to style if provided.",
               "rsv": False 
              }
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", f"CAG_S2_MRO_Refine")
        self.kAS = self.cjo(self.cco)
        return self.f_mrp(dcjs=self.sCg["djs_mro"], rgo_obj=rgo, ccjs=self.cjo(self.cco), cmc="CAG", cch="A_MFC_v5_1().cag_s3(r)") 

    def cag_s3(self, mro_res): 
        self.cM = "CAG"; 
        self.lg(self.cM, f"S3: Received MRO result. Status: {mro_res.get('s')}")
        if not mro_res or mro_res.get("s") not in ["Success_Converged", "Success_MaxIterReached"] or not mro_res.get("roj"):
            self.pum("Warning", "CAG: MRO didn't refine. Using pre-MRO draft.")
            rsec_cjs = mro_res.get("roj", self.sCg.get("djs_mro", self.cjo({"sdt": "MRO Error in CAG S3"}))) 
        else: rsec_cjs = mro_res.get("roj")
        
        pcd_str = self.cco.get("product_content_data_json", "{}") 
        pdd = self.pco(pcd_str) 
        if not isinstance(pdd, dict): pdd = {}
        if "document_sections" not in pdd or not isinstance(pdd["document_sections"], list): pdd["ds"] = [] 
        else: pdd["ds"] = pdd.pop("document_sections") 

        section_title_hint = self.sCg.get("target_doc_part", "GeneratedSection")

        nse = {"st": f"{section_title_hint} (Draft, Refined)", "cdjs": rsec_cjs, "mrsj": mro_res.get("rsj")} 
        pdd["ds"].append(nse)
        self.cco = self.f_ucs(self.cco, "product_content_data_json", self.cjo(pdd))
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", f"CAG_S3_Complete_{section_title_hint.replace(' ','_')[:10]}")
        self.cco = self.lco(self.cco, "CAG_EVT", f"{section_title_hint} drafted & refined.", self.pco(rsec_cjs))
        self.pum("Status", f"CAG: {section_title_hint} draft complete.")
        
        rt = self.pco(rsec_cjs); ftxt = rt.get("sdt", "Error displaying draft.") 
        self.pum("DraftOutput", {"title": f"Draft: {section_title_hint}", "content": ftxt, "notes": f"MRO for {self.vS}"})
        
        return self.k_pmr("CAG", {"s": "CAG_SubTask_Complete_ReturnToTDE", "uccoj": self.cjo(self.cco), "dfl": {"summary": f"CAG draft for TDE task complete" }})


    def sel_s1(self, mi): 
        self.cM = "SEL"; self.sSl = {}; self.lg(self.cM, "S1: Start"); self.pum("Status", "SEL: Starting...")
        if "ccoj" in mi: self.cco = self.pco(mi["ccoj"]); self.kAS = mi["ccoj"]
        
        pc = mi.get("pc") 
        if pc: self.sSl["pc"] = pc
        elif self.cco:
            ka_str = self.cco.get("knowledge_artifacts_contextual_json", "{}")
            ka = self.pco(ka_str) if isinstance(ka_str, str) else (ka_str if isinstance(ka_str, dict) else {})
            pdd_str = ka.get("problem_definition_details_json")
            self.sSl["pc"] = self.pco(pdd_str) if pdd_str else None
        
        if not self.sSl.get("pc"): self.pum("Error", "SEL: Missing problem context."); return self.k_pmr("SEL", {"s": "SEL_ERR_NO_CONTEXT", "uccoj": self.cjo(self.cco)})
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "SEL_S1_GenOpts")
        self.kAS = self.cjo(self.cco)
        return self.f_agso(self.sSl["pc"], self.cco) 

    def sel_s2pgo(self, llr): 
        self.cM = "SEL"; self.sSl["so"] = llr.get("solution_options", []) 
        if not self.sSl["so"]: self.pum("Warning", "SEL: No options generated."); return self.k_pmr("SEL", {"s": "SEL_NoOpts", "uccoj": self.cjo(self.cco)})
        self.pum("Info", f"SEL: Generated {len(self.sSl['so'])} options.")
        self.sSl["ec"] = {"criteria": ["feasibility", "impact", "effort", "alignment_with_core_essence", "aios_tvnf_alignment"]} 
        self.sSl["eo"] = []; self.sSl["coi"] = 0 
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "SEL_S2_EvalOpts")
        self.kAS = self.cjo(self.cco)
        return self._sel_eno() 

    def _sel_eno(self): 
        self.cM = "SEL"
        if self.sSl["coi"] >= len(self.sSl["so"]): return self.sel_s3peo() 
        co = self.sSl["so"][self.sSl["coi"]] 
        return self.f_aeso(so=co, ec=self.sSl["ec"], cco_=self.cco) 

    def sel_sper(self, llr): 
        self.cM = "SEL"; 
        self.sSl["eo"].append(llr); self.sSl["coi"] += 1; 
        self.kAS = self.cjo(self.cco) 
        return self._sel_eno()

    def sel_s3peo(self): 
        self.cM = "SEL"; self.pum("Info", "SEL: All options evaluated.")
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "SEL_S3_UserSelect")
        self.kAS = self.cjo(self.cco)
        do = [] 
        for opt_res in self.sSl.get("eo", []): 
            v_val = opt_res.get("oid", str(uid.uuid4())) 
            l_label = opt_res.get("sum", opt_res.get("solution_option",{}).get("description", f"Option {v_val}")) 
            es = self.cjo(opt_res.get("es", {})) 
            fl = f"{l_label} (Scores: {es})" 
            do.append({"v": v_val, "l": fl, "d": opt_res}) 
        return self.f_ipo(pu="SEL: Review & select a solution:", ol=do) 


    def sel_pirc(self, llr): 
        return self.sel_s4fs(llr)


    def sel_s4fs(self, llr): 
        self.cM = "SEL"; csi = llr.get("c", llr.get("command")) 
        self.sSl["cs"] = next((opt for opt in self.sSl.get("eo", []) if opt.get("oid") == csi), None) 
        
        if not self.sSl["cs"]: 
            self.pum("Error", f"SEL: Invalid selection ID: {csi}"); 
            return self.k_pmr("SEL", {"s": "SEL_ERR_INV_SEL", "uccoj": self.cjo(self.cco)})
        
        ka_str = self.cco.get("knowledge_artifacts_contextual_json", "{}")
        ka = self.pco(ka_str) if isinstance(ka_str, str) else (ka_str if isinstance(ka_str, dict) else {})
        ka["selected_solution_details_json"] = self.cjo(self.sSl["cs"]) 
        self.cco = self.f_ucs(self.cco, "knowledge_artifacts_contextual_json", self.cjo(ka))
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_form", "KAU_Ready") 
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "SEL_Complete")

        self.cco = self.lco(self.cco, "SEL_RES", "Solution selected.", self.sSl["cs"])
        self.pum("Info", f"SEL: Solution '{csi}' selected.")
        return self.k_pmr("SEL", {"s": "SEL_Complete", "uccoj": self.cjo(self.cco)})

    def kau_s1(self, mi): 
        self.cM = "KAU"; self.sK = {}; self.lg(self.cM, "S1: Start"); self.pum("Status", "KAU: Starting...")
        if "ccoj" in mi: self.cco = self.pco(mi["ccoj"]); self.kAS = mi["ccoj"]
        
        self.sK["idfl"] = mi.get("dtp", self.cco) 
        self.sK["lf"] = mi.get("lf", "general_process_insights_and_heuristics") 
        
        if not self.sK["idfl"]: self.pum("Warning", "KAU: No input data."); return self.k_pmr("KAU", {"s": "KAU_ERR_NO_INPUT", "uccoj": self.cjo(self.cco)})
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "KAU_S1_ExtractLearnings")
        self.kAS = self.cjo(self.cco)
        return self.f_aled(self.sK["idfl"], self.sK["lf"], self.cco) 

    def kau_s2pl(self, llr): 
        self.cM = "KAU"; self.sK["el"] = llr.get("learnings", []) 
        if not self.sK["el"]: self.pum("Info", "KAU: No specific learnings extracted."); return self.k_pmr("KAU", {"s": "KAU_NoLearns", "uccoj": self.cjo(self.cco)})
        
        if not self.cco: 
             self.cco = {"id": f"kau_cco_{uid.uuid4().hex[:4]}", "knowledge_artifacts_contextual_json": "{}", "olj": "[]"}; 
             self.kAS = self.cjo(self.cco); self.lg(self.cM, "Created minimal CCO for KAU.")

        ka_str = self.cco.get("knowledge_artifacts_contextual_json", "{}")
        ka = self.pco(ka_str) if isinstance(ka_str, str) else (ka_str if isinstance(ka_str, dict) else {})

        if "LHR" not in ka or not isinstance(ka["LHR"], list): ka["LHR"] = [] 
        ka["LHR"].extend(self.sK["el"]) 
        
        self.cco = self.f_ucs(self.cco, "knowledge_artifacts_contextual_json", self.cjo(ka))
        self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "KAU_Complete")
        self.cco = self.lco(self.cco, "KAU_RES", "Learnings stored.", {"lc": len(self.sK["el"])}) 
        self.pum("Info", f"KAU: {len(self.sK['el'])} learnings stored.")
        return self.k_pmr("KAU", {"s": "KAU_Complete", "uccoj": self.cjo(self.cco)})

    def mro_s1i(self, djs, rgjs, ccjs, cmc, cch, mi=3, ifc=False, pdo=None):
        self.cM = "MRO"; self.lg(self.cM, "S1I: Start"); self.pum("Status", "MRO: Init...")
        self.sMr = {
            "odjs": djs, "cdjs": djs, "pdjs": pdo, "ccjs": ccjs, "rgjs": rgjs,
            "prg": self.pco(rgjs), "mxI": mi, "ifc": ifc, "cI": 0, "rl": [],
            "cMet": False, "cmc": cmc, "cch": cch
        }
        self.sMr["rl"].append(f"{self._gt()} - MRO_INIT. MaxIt: {mi}. Caller: {cmc}")
        return self._mro_ls()

    def _mro_ls(self):
        self.cM = "MRO"; s = self.sMr
        if s["cI"] >= s["mxI"] or s["cMet"]: return self._mro_fin()
        s["cI"] += 1; lm = f"--- MRO_ITER: {s['cI']}/{s['mxI']} ---"; s["rl"].append(f"{self._gt()} - {lm}"); self.lg(self.cM, lm); self.pum("Status", f"MRO_ITER: {s['cI']}/{s['mxI']}")
        cf = s["prg"].get("cfh", "general_quality")
        return self.f_qacr(s["ccjs"], cf)

    def mro_cacr(self, llr):
        self.cM = "MRO"; s = self.sMr; s["rl"].append(f"{self._gt()} - AdaCritRules. Res: {llr.get('s') if isinstance(llr,dict) else 'Unknown'}")
        arjs = llr.get("r", "{}") if isinstance(llr,dict) else "{}"
        qcj = s["prg"].get("qcj", self.cjo({"default_crit":True}))
        return self.f_acc(s["cdjs"], qcj, s["ccjs"], arjs) 

    def mro_cacc(self, llr):
        self.cM = "MRO"; s = self.sMr; s["rl"].append(f"{self._gt()} - QualAssess. Res: {llr.get('s') if isinstance(llr,dict) else 'Unknown'}")
        qrjs = llr.get("qr", "{}") if isinstance(llr,dict) else "{}"
        s["_cqrjs"] = qrjs 
        if s["ifc"] or s["prg"].get("rsv", False): 
            sn = s["prg"].get("tsn", "AIOS_CCO_Schema_v3.0") 
            s["rl"].append(f"{self._gt()} - SchemaVal Req: {sn}")
            return self.f_uvds(s["cdjs"], sn) 
        else:
            s["rl"].append(f"{self._gt()} - SchemaVal Skip."); s["_cvjs"] = "null" 
            return self._mro_casc_entry()

    def _mro_casc_entry(self): 
        self.cM = "MRO"; s = self.sMr
        crl = [s["_cqrjs"]] 
        if s.get("_cvjs", "null") != "null": crl.append(s["_cvjs"])
        rcrjas = self.cjo(crl) 
        sgjs = s["prg"].get("sgj", self.cjo({"default_synth":True})) 
        return self.f_asc(rcrjas, sgjs)

    def mro_cav(self, llr): 
        self.cM = "MRO"; s = self.sMr; s["rl"].append(f"{self._gt()} - SchemaVal. Res: {llr.get('s') if isinstance(llr,dict) else 'Unknown'}")
        if isinstance(llr,dict) and "iv" in llr: s["_cvjs"] = self.cjo(llr) 
        elif isinstance(llr,dict) : s["_cvjs"] = llr.get("vrjs", self.cjo({"iv":False, "e":"Val fn err"}))
        else: s["_cvjs"] = self.cjo({"iv":False, "e":"Val non-dict resp"})
        return self._mro_casc_entry()

    def mro_casc(self, llr): 
        self.cM = "MRO"; s = self.sMr; s["rl"].append(f"{self._gt()} - CritSynth. Res: {llr.get('s') if isinstance(llr,dict) else 'Unknown'}")
        scjs = llr.get("scs", "{}") if isinstance(llr,dict) else "{}"
        s["_cscjs"] = scjs 
        cso = self.pco(scjs) 
        if cso and cso.get("mat", False) and cso.get("aic", 1) == 0: 
            s["cMet"] = True; s["rl"].append(f"{self._gt()} - Conv by crit summ."); self.pum("Status", "MRO: Conv by crit.")
            return self._mro_ls()
        return self.f_csr(s["cdjs"], s["_cscjs"], s["ccjs"])

    def mro_casr(self, llr): 
        self.cM = "MRO"; s = self.sMr; s["rl"].append(f"{self._gt()} - RevSugg. Res: {llr.get('s') if isinstance(llr,dict) else 'Unknown'}")
        rsjs = llr.get("rs", "{}") if isinstance(llr,dict) else "{}"
        s["_crsjs"] = rsjs 
        so = self.pco(rsjs) 
        if so and so.get("has", False): 
            return self.f_car(s["cdjs"], s["_crsjs"], s["ccjs"]) 
        else:
            s["rl"].append(f"{self._gt()} - No act sugg. Conv."); s["cMet"] = True
            return self._mro_ls()

    def mro_caar(self, llr): 
        self.cM = "MRO"; s = self.sMr; s["rl"].append(f"{self._gt()} - RevApply. Res: {llr.get('s') if isinstance(llr,dict) else 'Unknown'}")
        rdjs = llr.get("rc", s["cdjs"]) if isinstance(llr,dict) else s["cdjs"]
        s["_cndjs"] = rdjs 
        ctj = s["prg"].get("ctj", self.cjo({"default_comp":True})) 
        return self.f_acv(s["cdjs"], s["_cndjs"], ctj) 

    def mro_cacv(self, llr): 
        self.cM = "MRO"; s = self.sMr; s["rl"].append(f"{self._gt()} - VerComp. Res: {llr.get('s') if isinstance(llr,dict) else 'Unknown'}")
        co = self.pco(llr.get("cr", "{}") if isinstance(llr,dict) else "{}")
        if co and co.get("isc", False): 
            s["pdjs"] = s["cdjs"]; s["cdjs"] = s["_cndjs"]; s["rl"].append(f"{self._gt()} - Sig change applied.")
        else:
            s["rl"].append(f"{self._gt()} - No sig change. Conv."); s["cMet"] = True
        return self._mro_ls()

    def _mro_fin(self): 
        self.cM = "MRO"; s = self.sMr; fss = "Success_Converged" if s["cMet"] else "Success_MaxIterReached" 
        self.lg(self.cM, f"MRO Pipeline complete. Status: {fss}"); self.pum("Result", {"m": "MRO Complete.", "s": fss})
        mfr = {"roj": s["cdjs"], "rsj": self.cjo(s["rl"]), "s": fss } 
        return self.k_pmr("MRO", {"s": "MRO_PIPELINE_COMPLETE", "mro_result": mfr, "cmc": s.get("cmc"), "cch": s.get("cch"), "uccoj": self.kAS})

    def fel_s1i(self, mi): 
        self.cM = "FEL"; self.sFe = {}; self.lg(self.cM, "S1I: Start"); self.pum("Status", "FEL: Starting...")
        self.sFe["cer"] = mi.get("cesm", f"Conceptual representation of {self.vF}") 
        self.sFe["eg"] = mi.get("evolution_goal", "General self-improvement.") 
        if mi.get("auto_tid", False): 
            self.lg(self.cM, "Autonomous TID generation invoked.")
            return self.fel_gst(self.sFe["eg"], self.cjo(self.cco))
        else:
            return self.f_iei(pu="FEL: Provide TIDs (JSON) or source.", ch=f"A_MFC_v5_1().fel_s2lt(r)") 

    def fel_s2lt(self, llr): 
        self.cM = "FEL"; tsi = llr.get("c", llr.get("command")) 
        self.lg(self.cM, f"S2: Received TID source: {tsi}")
        return self.f_flt({"sd": tsi, "cev": self.vS}) 

    def fel_s3pt(self, llr): 
        self.cM = "FEL"; self.sFe["lt"] = llr.get("tids_loaded", llr.get("tl", [])) 
        if not self.sFe["lt"]:
            self.pum("Error", "FEL: No TIDs loaded."); return self.k_pmr("FEL", {"s":"FEL_ERR_NO_TIDS"})
        self.pum("Info", f"FEL: Loaded {len(self.sFe['lt'])} TIDs.")
        if self.cco is None: self._fel_init_cco() 
        self.cco = self.lco(self.cco, "FEL_TIDS_LOADED", f"Loaded {len(self.sFe['lt'])} TIDs.", {"tids": self.sFe['lt']})
        return self.f_fcnv(self.sFe["cer"]) 

    def fel_s4pv(self, llr): 
        self.cM = "FEL"; self.sFe["nvs"] = llr.get("nvs", f"v{self.vS}-evo-{uid.uuid4().hex[:4]}") 
        self.pum("Info", f"FEL: Next engine version: {self.sFe['nvs']}")
        self.cco = self.lco(self.cco, "FEL_VER_CALC", f"Next ver: {self.sFe['nvs']}.", {"nv": self.sFe['nvs']})
        eem = {"desc": "Current AIOS Engine Model", "cv": self.vS, "kc": ["Kernel", "IFE", "MRO"], "fsc": True } 
        return self.f_fatem(self.cjo(eem), self.cjo(self.sFe["lt"])) 

    def fel_s5pat(self, llr): 
        self.cM = "FEL"
        self.sFe["eemc"] = llr.get("eem", {}) 
        al = llr.get("al", "No detailed log from LLM.") 
        self.pum("Info", f"FEL: TIDs conceptually applied. Log: {al}")
        self.cco = self.lco(self.cco, "FEL_TIDS_APPLIED", f"LLM applied TIDs. Log: {al[:50]}...", {"al": al, "cem": self.sFe["eemc"]})
        if not self.sFe["eemc"]:
            self.pum("Error", "FEL: LLM failed to evolve model."); return self.k_pmr("FEL", {"s":"FEL_ERR_TID_APP_FAIL"})
        return self.f_urea(self.sFe["eemc"], "python_script_text") 

    def fel_s6f(self, llr): 
        self.cM = "FEL"; eat = llr.get("eat") 
        clt = llr.get("clt", "No changelog.") 
        if not eat:
            self.pum("Error", "FEL: LLM failed to gen artefact."); return self.k_pmr("FEL", {"s":"FEL_ERR_REGEN_FAIL"})
        self.pum("Info", f"FEL: Evolved artefact (Ver: {self.sFe.get('nvs')}) generated.")
        self.pum("GeneratedEngineArtefact", {"nev": self.sFe.get('nvs'), "est": eat, "cl": clt}) 
        self.cco = self.lco(self.cco, "FEL_RESULT", f"Evo to {self.sFe.get('nvs')} proposed.", {"nv": self.sFe.get('nvs'), "cl": clt}) 
        if self.cco: self.cco = self.f_ucs(self.cco, "metadata_internal_cco.current_phase_id", "FEL_Complete")
        return self.k_pmr("FEL", {"s": "FEL_EvolutionProposed_Complete", "uccoj": self.cjo(self.cco)})

    def _fel_init_cco(self): 
        self.cM="FEL"; self.lg(self.cM, "Init minimal CCO for FEL.")
        self.cco = {"id": f"fel_cco_{uid.uuid4().hex[:4]}", "olj": "[]"}; self.kAS = self.cjo(self.cco)

    def fel_gst(self, gstr, ccojs): 
        self.cM = "FEL"; self.lg(self.cM, f"GST: Goal: {gstr}. Req LLM for TID gen.")
        return self._cr(tt="CT_FEL_GST", ctd={"g": gstr, "ccoj": ccojs, "cev": self.vS, "ofg": "JSON {'tid':{...}}"}, eid="JSON {'tid':{...}}", ch="A_MFC_v5_1().fel_sXpgt(r)") 

    def fel_asc(self, nst, cls): 
        self.cM = "FEL"; self.lg(self.cM, "ASC: Conceptual application of new script.")
        self._conceptual_new_script = nst 
        self._conceptual_changelog = cls
        self.pum("Status", "FEL: New engine script conceptually ready for orchestrator application.")
        return {"s": "FEL_ConceptualScriptReady", "dfl": {"new_script_preview": nst[:200]+"..."}}

# --- End of A_MFC_v5_1 class ---

# --- Orchestration Logic for Clean Finalization ---
print("--- AIOS Engine v5.1 Clean Finalization ---")

engine = A_MFC_v5_1() 
print(f"Engine v{engine.vS} instantiated for clean finalization.")

initial_llm_req_pkg = engine.k_st()

simulated_user_choice_response = {"s": "UC", "c": "TA"}
final_engine_output = {}

expected_ch_for_k_st = "A_MFC_v5_1().kernel_pirc(r)"
actual_ch_from_k_st = initial_llm_req_pkg.get("rd",{}).get("ch")

if actual_ch_from_k_st == expected_ch_for_k_st:
    print(f"Calling kernel_pirc with choice: {simulated_user_choice_response['c']}")
    final_engine_output = engine.kernel_pirc(simulated_user_choice_response)
else:
    print(f"ERROR: Unexpected continuation hint from k_st(): Expected '{expected_ch_for_k_st}', Got '{actual_ch_from_k_st}'")
    print(f"Attempting fallback to k_pgud due to unexpected hint.")
    # This fallback is less ideal for a clean start->terminate, but for robustness:
    # We need to ensure the engine is in a state k_pgud can handle.
    # k_st() leaves kCI as None, cM as K. k_pgud expects an LLM response.
    # The direct call to kernel_pirc is cleaner if the hint is correct.
    # If hint is wrong, it implies an issue in f_ipo or k_st.
    # For this specific clean finalization, if the hint is wrong, we'll just construct a TERM state.
    engine.kCI = "TA" # Force termination state
    final_engine_output = engine.k_rcmh()


print("\n---FINAL_ENGINE_OUTPUT_PACKAGE_FOR_SESSION (v5.1 Clean Finalization)---")
print(jsn.dumps(final_engine_output, indent=2))

print("\n--- End of AIOS Engine v5.1 Clean Finalization ---")