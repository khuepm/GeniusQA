# Design Document

## Overv

This design document add


olsdebugging toed 
   - Advancnectioics colle metrPerformancres
   - ecific featutform-spl pla- Additionay**:
   Low Priorition

4. **idatvalty ompatibili-core c- Crossations
   mizrmance opti - Perfong
  dli error hanncedAdva- rity**:
   rio Pium
3. **Med
ismsry mechanve Error recoogging
   -rehensive lmp - Covements
  improng accuracy Timi*:
   - ority*. **High Pri

2o UI streaming tnt  - Eved logging
 ing anerror handl
   - Basic click)ve, mouse_use_momocution (tomation exe Platform au)**:
   -al (Must Fix*Criticity

1. *tion Prior# Implementa
#playback
ith Rust ed scripts wordhon-rec Test Pyt*:e* **Cross-Cors
5. callpecific APIlatform-sest p*: Tfic*form Speci
4. **Platsdinateions or coor acth invalidripts witling**: Scr Hand
3. **Errorequirementse timing th precis wicy**: Scriptiming Accuras
2. **T and clickoves mouse mscript with Simple  Playback**:**Basic1. enarios

t Scesy T# Ke Linux

##andS, , macOWindowsn *: Test o Testing*rmtfolaoss-Pipts
- **Cred scrrecordith yback flow wull pla*: Test fsting*tegration Te*In- *ies
t utilitcific tespeplatform-s**: Use stingform Te- **Platg
stinteperty-based for proest` ropt`pse  UCore**:

- **Rust rkramewo Testing Ftest

###y-based ertsingle propented by a ty is implemproperectness orr Each c_text}**'
-typerpronumber}: {y {ertx, Propack-fit-core-playbture: rus'**Feath: gged wi are taoperty teststions
- Pr00 iteraf 1minimum oruns a est -based tropertych pg
- Eabased testint property-Rus` crate for testopprUse `**
- ements:sting Required Tety-Bas
**Proper controls
/resume/stop Test pauseates
-I updeaming and Uevent strpe
- Test  tych errordling for ear hanest erroations
- Tlculming cayback tist pla- Ten
iod in isolattion methom automatfor each plast Tents:**
-remequiting Re**Unit Tesh

acesting Appro
### Dual Tegy
ratg St
## Testinr]
```
seM[Notify U   L --> rces]
  ResouCleanup   F --> L[--> K
  I --> K
     
    H |No| F
   J -->]
   ontinuees| K[C-->|Y   J  
 ss?}
   --> J{Succe
    G ]sonLog Skip Rea I[   E -->
 ing]t Tim H[Adjus  D --> 
     o| F
   C -->|Nf]
 with BackofRetry Yes| G[  C -->|
    
  ck]op PlaybaSt F[ Error|source -->|Re  Btion]
   E[Skip Acpt Error|cri
    B -->|Sing]rng WaLo D[g Error|in->|TimB -    ?}
ecoverable Error| C{Rorm|Platf}
    B -->r Type{Erro B Occurs] -->Errorh TD
    A[ermaid
grap
```mry Flow
coveror Re

### Ertedl disconnecnt channeve- Example: E   fy user
rces, notian up resouback, cleop playtrategy: St- S  
 sconnectionsl dies, channed failurhrea, tssuesry i Memo**: Errorsce4. **Resourform

ent platrted on curre not suppo action typpt containsample: Scrions
   - Exh valid actiit, continue wingsog warn llid actions,nvakip iStrategy: Ss
   -  issueats, formperation ortedpos, unsupactionlid  Inva*:ipt Errors**Scr3. *
 drift
 timingoad causesstem under lple: Sy   - Examack
e playbnug, contit timinning, adjuswartegy: Log 
   - Straissueshronization  synct respected,*: Delays noErrors**Timing 2. *s

 coordinatee to invalidve fails dumo: Mouse ample
   - Exy userifotssible, nry if porecovetempt or, attailed err deegy: Logtrats
   - System errorissues, ssion  permisll failures,API ca Errors**: **Platform1. ories

 Error Categayback Plg

###ror Handlin

## Er0.4** 1ntsequireme: R
**Validatesormationnfayback iplal essentie preservould m sh the systetween cores,etadata beferent mwith difpt ny* scrin
*For aatiodata preservty 38: Meta

Proper.3**ts 10enirem: Requtes**Validags
with warninully them gracefndle m should hates, the syscet differencript forma* s*For any
handlingdifference  Format roperty 37:10.2**

Pts ens: Requirem**Validatens
ioible actl compate alexecutre should n copt, Pythoecorded scrist-r*For any* Ruibility
ython compat: Rust-to-PProperty 36
s 10.1**
menttes: Requirelida*Va actions
*patiblell comld execute are shoucoust d script, R-recordethonny* Pyity
*For abilcompati-Rust 5: Python-toroperty 3**

Pts 9.5: RequiremendatesVali
**t logicese rting andoop counnt lctly implemeshould correystem e se loops, th multiplk withany* playbacor ectness
*Founting corrp cy 34: Loo*

Propertments 9.4*equireValidates: Rnel
**sender chane event ough ththrd it ld senhoum s the systeback event,or any* playattern
*Fsender p Event  33:
Property3**
ments 9.s: Requiretey
**Validad safets for threaionic operat use atomshouldstem sy, the k stateybacpla to cessoncurrent acny* c a*Fort
nagemenafe state maThread-srty 32: 2**

Propeirements 9.quidates: Re*Val
*ckingpanihout ndle it witd should hasync methoion_xecute_actant, the enType variy* Actioing
*For anype handll ActionTAloperty 31: 
Pr
s 8.5** Requirement**Validates:hin 100ms
e witUI statld update system shou, the e, stop) resum(pause,on peratirol ontr any* cos
*Foesresponsivene update : UI statoperty 30
Prnts 8.3**
equiremelidates: RVa
**urcessoan up retely and clemmediak iaybacnate plould termish the system st, stop reque any*ormination
*Fate stop ter9: Immedierty 2
Prop
.2**rements 8quidates: Ren
**Valiitioaused pos the ptinue from should contemsyshe est, tresume requ* 
*For anyd positionauseume from py 28: ResProperts 8.1**

ementes: Requir*Validat action
*renting the curr complete afteausd pem shoul the systlayback,during puest use reqany* paary
*For ion bound at actPauserty 27: 

Prope.5**rements 7tes: Requi*Validaback
*ue playontinnings and clog warem should yst srror, theoverable eecy* ring
*For anndle error ha Recoverabl 26:ty

Propernts 7.4**uiremeates: Reqr
**Validy the usek and notiftop playbacd sm shoulstee sy thtical error,r any* cring
*Foandliical error hCritroperty 25: *

Ps 7.3*equirementidates: Res)
**Valordinat, type, coon indextirmation (ac infode contextincluould shhe system ny* error, tr a
*Foinclusionontext  cy 24: Erroropert 7.2**

Pruirementses: Req**Validatty
r severi errot based onue or abor contine whether toshould decid system ailure, then fn executioactioFor any* 
*dlingeverity hanr sty 23: Erro**

Proper.1s 7ementuirs: ReqValidateonError
**Automatirt them to onveand ctions  excepuld catch system sho, thel failurecalutomation form aany* platon
*For  conversimationErrorn to AutotioExcep22: ty 

Proper 6.4**tsmenequiredates: Rr
**Valipriate erroth an approuest wiject the reqm should resystee ctive, th aplayback ishile  w requestplaybacky* or an*F rejection
ent playbackcurr1: Con
Property 2 6.3**
ntsquireme Res:teValidaly
**ateimmedistop urces and resolean up m should c systek, the playbacst duringtop requer any* sanup
*Fo0: Stop cle
Property 2
s 6.2**ment Requires:idateyback
**Vallapping pthout stonings wiand log war skip them m should the systeions,orted actuppnsh uitipt wcrFor any* sndling
*d action haporteUnsupoperty 19: Prts 6.1**

menequireates: R**Validrnings
and log wa bounds to screenates p coordind clamystem shoulhe s tcoordinates,valid t with inip scrny**For ag
mpindinate cla 18: Coor

Propertys 5.5**Requirementlidates: **Vats
equiremenmission ric pere specif report thandould detect  system shsion, the permising* miss*For any detection
rmissionerty 17: Pe*

Props 5.4*entuiremates: Reqalidmation
**Vfor inonabletiges with acmessar ic errospeciform-ovide platfshould pr the system  failure,ationrm autom platfor any*s
*Fo messageerrorfic -speci: Platformy 16Propert**

ts 4.4uiremenidates: Reqal**VUI
e nt to than error eved  should senem systtheg playback, ror durinor any* ergation
*F propaent evError: y 15
Properts 4.3**
mentes: Requirealidat00ms
**V 1 withinstatusUI  update the  shouldstemsyhe e request, tany* pauseness
*For ivuse respons Paerty 14:

Prop.2**ments 4s: Require
**Validateexecutinge orhe UI befw event to ton previe actid anentem should se sysn, thtioxecun e actior any*s
*Fontpreview eve Action  13:Propertys 4.1**

ntquiremealidates: Re
**V action)perast once (at leals lar interv UI at regus to thetegress updad send proystem shoulk, the se playbactivr any* acy
*Fouencvent freqgress e 12: Pro

Property4**s 3.irement: Requalidateses
**Vactack tr s andontexting action con includtirmar infoailed errold log det shoustemhe syyback, tg plaerror durinor any* t
*Fex conting withor logg1: Errroperty 1**

Pirements 3.3es: Requat**Valideters
and paramI call c APifiorm-specg the platfld loem shoul, the syston calrm automati* platfor anyg
*Foll logginform caPlaty 10: 

Propert.2**irements 3dates: Reqult
**Valin resud executiordinates, anpe, cootion tyog the acem should lsysttion, the execuon or any* actiss
*Fmpleteneg con loggin9: Actio
Property ts 2.3**
equiremen Ridates:plier
**Vald multieely to the sponalporti procale should slays, timing detmentdjusspeed a* playback *For anynality
proportioeed scaling 8: Sproperty 

P*ts 2.2*uiremen Reqidates:**Val tolerance
ithin 10%ion wratcording due rethould match  shution time total execthe, 1.0x speedplayback at r any* 
*Foyng accuracmi0x speed tioperty 7: 1.
Prs 2.1**
rement: Requialidatesce
**Vable toleranaccept within tions acays between deltimestamprespect the d system shoul the layback,cript pFor any* sect
*y respela Timestamp dty 6:Proper

*rements 1.5*tes: RequiValidaogging)
**th led wiicitly skippxplor euted (d be exechoulcript File s the Sroms f actioneration, allback opr any* playon
*Fon executitioomplete acperty 5: C**

Proents 1.4: Requirem
**Validatesredoccurction  the adicating the UI intoent d send an evoulhe system sh, tng playbackd durion execute* acti*For anyvents
 feedback etion 4: Ac

Propertyents 1.3**equiremdates: R
**Vali key pressesandded text core reuld type thho s the systemions,d actyboartion with keck opera playbaFor any*execution
*ction oard a: Keyberty 3*

Propnts 1.2*uiremes: Reqte
**Validatesordinacorded the recoe clicks at ousal merform actum should p the systections,use click an with mo operatioplayback any* 
*Forecutionclick exe 2: Mousroperty **

Pements 1.1equir: ResValidatns
**ed positioordeco the rrsor the mouse cuuld move tshoe system s, thve actionth mouse moation wiayback operr any* pl*Fo execution
or movementrs1: Mouse cuerty es.*

Propguarantes tnesorrecrifiable cine-vend machations aficable specin-readen humage betwethe brids serve as ropertie. Pd doystem shoulhat the sent about wtem formal staally, a-essentiemns of a systecutiod exvalil s alcrosue ald hold trat shouehavior theristic or bs a charactroperty ities

*A p Properrectness

## Corr>,
}
```ckErroec<Playbars: Vpub erro
    leted: u32,s_comp pub loop    Duration,
action_time:age_    pub aver
ration,on: Dudurati pub total_ize,
    usns:tioipped_acub sk    ps: usize,
actionfailed_ pub 
   ze,: usid_actionsecuteexpub 
    ons: usize,b total_acti {
    puisticstatPlaybackSpub struct )]
alizeserialize, Dee, Seri Clonebug,ve(D
#[deri`rust
``ics
tistStaack 
### Playb}
```
  }
    }
    rue,
  treaming: t event_s           fo,
ogLevel::Inl: Lg_leve  lo      
    ons: true,erify_acti      v
      ror: false,top_on_er     s 1,
       ps:  loo    
      .0,ed: 1      spe        Self {
 
     elf {> St() -ul
    fn defaackConfig {yblt for Pla Defau
}

impl bool,treaming:pub event_svel,
    l: LogLe_leveb log    pu
l,tions: boo verify_ac  pub
  : bool,errorn_ stop_o
    pub: u32,ub loops  p: f64,
  b speedig {
    puonfckCybaPlat pub struc)]
Cloneve(Debug, ri[deust
#```r

ationfigurk Conlaybacels

### PMod Data 

##}
}
```   )
    or
     ing_errderly.unself            ype,
f.action_t         selndex,
   lf.action_i  se   
       ?}): {}", ({: {}t actionack error a  "Playb          rmat!(
 fo     {
   tringlf) -> Se(&seser_messagto_ub fn  
    pu   }
   
   )    r { .. }
  tErroreenshoError::Scmation     Auto    |
    t { .. }npualidI::InvionErrorutomat  A          _error,
lying.underself            ches!(
 mate &&overablelf.rec       s bool {
 (&self) ->ontinueld_cfn shou    pub  {
laybackErrorl Pl,
}

impooe: boverabl  pub rec  64,
stamp: f pub timerror,
    AutomationEr:rlying_errob undepu    , i32)>,
on<(i32tiates: Opoordin,
    pub ctionTypepe: Acction_ty pub asize,
   dex: ub action_in
    pu {or PlaybackErrub structlone)]
pbug, Cive(De
#[der
```rust:
text cons with typeror
Enhanced ererror.rs`
ore/src/t-crusckages/pacation**: `tegy

**Loing StraError Handl# 4. `

##}
``}
           );
,
       None      ),
arams pon,perati: {}", oth params} wicall: {form mat!("Plat     for),
       imestamp()::now().tUtcchrono::ration, }_{}", opeform_{"platmat!(  for        ayback,
  pe::PlperationTy    O       st,
 CoreType::Ru           ce,
 el::Tra    LogLevn(
        tioperalog_o   logger.     {
et_logger() logger) = ge(  if let Som {
  : &str)&str, paramstion: eral(opm_cal_platfor fn log }
}

pub   );
    }),
        
        ta      metada        }
            y));
       json!(ng(),to_strit("y".ata.inseretad         m         
  tion.y {e(y) = acf let Som         i}
                      on!(x));
 ing(), js"x".to_strrt(ata.insead    met           .x {
     = actionSome(x) if let          
       ype)));ion_tion.act:?}", act"{!(at!(formon, jsg()e".to_strin"action_typ.insert(   metadata         ;
    son!(index)) jing(),.to_strex"ction_inda.insert("a     metadat     w();
      neMap::a = Hash mut metadatlet                  Some({
         ion.y),
 ction.x, action_type, ation.act index, ac    
           {:?})", ?}, t ({:?} ation {}: {:ting ac!("Execuformat          ),
  mestamp()w().tiUtc::nohrono:: index, c_{}_{}","action  format!(         layback,
 pe::PrationTy Ope      st,
     ::Ru   CoreType    ug,
     evel::Deb  LogL       ation(
   .log_oper logger
       ogger() { get_ler) =gg(lo Someif let
    n) {&Actioze, action: dex: usition(inexecu log_action_pub fn}


 };
    )
              }),  tadata
         me         loops));
 n!(ng(), jso".to_striopsinsert("loa.dat meta         ;
      ed))(spe, json!g()strin.to_("speed"data.insert        meta   t));
     action_coun json!(to_string(),_count".rt("action.insetatadame              w();
  p::neMa Hashdata =metat mut       le      Some({
             loops),
   nt, speed, n_cou       actio
         }", oops={eed={}x, l spions,ck: {} actng playba"Startiat!(    form   ),
     imestamp()now().throno::Utc::{}", cback_start_play  format!("          ayback,
ionType::Plrat     Ope
       ::Rust,    CoreType   
     Info, LogLevel::      on(
     log_operati  logger.);
      ap_or(0.unwr)).len(s.actionsap(|s| t.as_ref().mrip_count = scion actlet   ) {
     et_logger(ger) = glogSome(   if let  {
 loops: u32)d: f64, ta>, spee<ScriptDaptionript: &Ock_start(scn log_playbab fpuunctions
 f loggingificayback-spec/ Pl``rust
//

`ing:k debuggaybacng for pl loggiced

Enhanrs`rc/logging.e/scorst-ages/ru: `packcation***Lo
*tem
g Syse Logginrehensivmp
### 3. Co}
```
 }
(())
          Oke");
 mouse_movuccess("rm_satfoog_pl
        l
          }             ));
l_y
     uaual_x, act_y, actpedam clmped_x,        cla       , {})",
 {}got ({}), d ({}, texpecsmatch: eon miositi"Mouse p         t!(
       ing(&formag_warnlo     
       lamped_y {ctual_y != cped_x || a= clam_x ! actual        if?;
n()io_mouse_positet.g selfy) =ual_l_x, actctua  let (a
      e succeededify the mov  // Ver     
 
               }   }
        or);
  rr(err    return E      r);
      e", &erroe_moverror("mousg_platform_  lo             
         };              ),
          ()
    Errord_y, GetLastlampex, c    clamped_             ,
       "code: {} {}). Error },ordinates ({d for corPos faile  "SetCurso                 
     e: format!(ag mess                 Error {
  temr::SysrotomationEror = Au     let err
           t == 0 {   if resul         _y);
edx, clamp(clamped_Pos SetCursorlet result =           safe {
      unndling
    hah errorute wit/ Exec      /        
    }
  ));
          
      lamped_y_x, cmped  x, y, cla             {})",
  to ({}, })from ({}, {amped tes cloordina    "C         
   g(&format!(warninlog_           {
  d_y != y x || clampemped_x !=      if cla   
  );
     2 - 1height as i3 screen_amp(0,ed_y = y.clet clamp      l  - 1);
32 as iwidth een_mp(0, scr = x.claed_xet clamp
        lize()?;reen_self.get_sc st) =screen_heigheen_width,   let (scr
      coordinatesidate  // Val   
       ));
     ", x, y}, y={}rmat!("x={ve", &fomouse_mom_call("platfor log_n
       ratio Log the ope
        //lt<()> { -> Resui32, y: i32)self, x: ove(& fn mouse_m
   tion {ndowsAutomaon for WimAutomatiorl Platf
imptionimplementaced Windows / Enhan
/
```ruston needs:
tientaform implemEach plat
form/*.rs`
ate/src/pls/rust-cor**: `package*Locationements

* Enhancm AutomationatforPl. `

### 2
``    }
}    result
      
            }
,
  duration)n, e, , actioion_indexerror(actlog_action_=> (e)  Err         ,
  ion)ction, duraton_index, a(actiess_succg_actionk(_) => lo         O {
   esultch &r mat      result
  tionexecu   // Log      
     );
   psed(_time.elatart sration = let du
               ;
       })e
           
           &e);ction,index, ation_re(acaction_failuog_           l {
     p_err(|e|ma  .
           &config)on,m, actitforlation_sync(p:execute_acSelf: = sultt re      le
  ntext corrorith e// Execute w 
             
  w(); Instant::notart_time =t s le        
     on);
  tin_index, acioion(act_executlog_action       pt
 ion attemecutg action ex // Lo {
       lt<()>> Resu,
    ) -ex: usizeon_ind   acti   &Action,
  n:      actio
   omation,ormAutn Platform: &dy       platfging(
 logwith_ute_action_ exec
    fnlingror hand ergging andive lo comprehens withonte acti /// Execu 
     }
     Ok(())
             
  )?;
 ormatfplck_loop(ecute_playbaelf.ex   s     
dlingr hananced erro enhithloop wck cute playba  // Exe      
     }
     });
                  
o_string(),.tsions"miserm psysteires requ"Playback eration:           op  
    ionDenied {rmissPeor::nErrtomation Err(Au retur     
      ons()? {ssik_permi.checlatform!p     if tarting
   fore sons bey permissiif   // Ver
       ?;
        })         
      e           &e);
 on",m automati platfor createtor("Failed erro    log_            
_err(|e| {ap      .m
      utomation()_platform_arm = createtfopla       let andling
 h error hit wautomationform atte pl    // Crea    
      l);
  loops_tota, self.k_speedaybacelf.pl script,t_s&self.currenk_start(log_playbac     context
    full t withlayback star    // Log p<()> {
     -> Resultelf)n(&sutiock_execstart_playba    fn g
ve logginprehensi with comck executionaybaanced pl   /// Enher {
 ayust
impl Pl``rd:

`ts needeimprovemen.rs`

Key rc/playert-core/sackages/rus: `pLocation**

**iontater Implemenayanced Pl## 1. Enhs

#erfacents and Int## Compone
```

Updated]Not -> E3[UI d]
    E -onnectennel Disc[Cha --> E2
    Ets Not Sent]> E1[Even
    E -- covery]
   --> D3[No Reext]
    D Contg -> D2[Missins]
    D -ent Failure> D1[Sil
    D --    caling]
3[Speed S
    C --> Cion]lculattamp CaC2[Times
    C --> p Timing]Thread Slee  C --> C1[]
    
  ationanslte TrdinaoorB --> B3[C]
    ion Issues[Permiss B --> B2ting]
   Execuot alls N> B1[API C
    B --ng]
    mit Streaven --> E[Eng]
    AHandlirror  A --> D[Euracy]
   ng Acc--> C[TimiA ion]
    tform ExecutPlaB[ues] --> back IssPlay   A[B
 aid
graph Tmermd

```iereas Identif AblemPro
```

### atusUpdate StPC->>UI: Event
    Iletion end Comp>>IPC: Syer-  
    Pla   end
gress
   date ProC->>UI: Up
        IPgress Event Pro>IPC: SendPlayer->     t
   ayer: Resul->>Pllatform-      P
  sulttform: Re OS-->>Pla
       l API Cal>OS: Systemm->    Platfor    on
ecute Actilatform: Exayer->>P       PlTimestamp
 Wait for layer: Player->>Pg
        e Timinalculatayer: C>>Pl Player-       h Action
 Eacor   loop F
    
 hreadBackground Tt  Star->>Player:ayer    Plpt
ate Scri: ValidPlayer   Player->> loops)
 d,ayback(speetart_pler: s->>Play
    Routerust Coreto RRoute ->>Router:     IPCack
rt PlaybtaI->>IPC: S
    U
    ystemerating Snt OS as Op   participation
 utoma Alatform as Pt PlatformrticipanpaPlayer
    as Rust Player nt icipa
    partouter as Core Routeripant R   partic
 ridgeC as IPC Bcipant IP
    partict UII as Reant Upa particiagram
   
sequenceDiid``mermak Flow

` Playbac# Current

##rchitecture

## Aatforms.upported plall s across ably reliack worksat playb ensuring thissue,s for each led solutionovides detaiprs design ed

Thionnecte properly c not bming mayeavent stres
5. Eailurecific ftform-spng for plaerror handli4. Missing 
resback failulaydiagnose plogging to nsufficient hread
3. Iback t in the playtion issueshronizaand sync Timing y
2.rectl corutingbe execmay not s  callationorm automPlatf:
1. tified areidens issue primary 
Therrectly.orking co is not wion)cuttion exend acovement a msorl mouse curtuation (ac execulaybacknt, but pore managemed c, anbackrding, playure for reconfrastructd the ifully createesstation succ implemen Phase 1 core. Thee Pythonwith thparity ull feature nsuring fand ectionality ck funplaybafixing cusing on ion, folementatn core impmatioRust auto2 of the e sses Phasre
