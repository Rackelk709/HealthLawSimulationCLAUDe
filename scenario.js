/* =====================================================================
   SCENARIO FILE  -  the only file you need to edit to change the content.

   Everything students see (briefing, decisions, consequences, indicators,
   debrief questions, report wording) is defined here. The engine in
   engine.js, the screens in app.js and the report builder in report.js
   read this object and contain no scenario text of their own.

   Quick guide
   -----------
   config      Titles, branding, timer, submission instructions, report text.
   landing     Text on the opening screen.
   metrics     Indicator names, hints, which ones are "risk" (lower is better)
               and their starting values.
   rounds      One entry per decision. Each needs exactly the same option
               count as you want students to see (2-4 recommended); every
               option needs an `effects` value for EVERY indicator.
   debrief     Discussion questions shown after the last decision.
   rules       Small functions that add situation updates and extra
               consequences depending on the current indicators.

   Changing scenarios? Also change `config.id` so work saved by students in
   their browser from a previous scenario is never mixed with the new one.
   If you make a mistake the page shows a plain-language error listing it.
   ===================================================================== */
window.SCENARIO = {

  config: {
    id: "redwood-valley",
    version: 1,

    siteTitle: "Redwood Valley | Public Health Crisis",
    siteDescription:
      "An executive leadership simulation in fictional Redwood Valley. Make five public health decisions and download your after-action report.",

    brand: { mark: "RV", name: "Redwood Valley", sub: "Emergency Operations Center" },
    exerciseLabel: "Exercise only",
    exerciseNote: "Fictional scenario · Educational simulation",
    headerLabel: "Executive leadership exercise",
    headerCode: "RV–PH / 01",
    footerLeft: "Redwood Valley / Public health response",
    footerRight: "Fictional educational simulation. Not medical or legal advice.",

    // Suggested working time in minutes. It is a discussion guide only: students
    // can pause it and nothing locks at zero. Use 0 to hide the timer.
    suggestedMinutes: 45,

    // Name on the report. `required: true` asks for it before the record can be
    // downloaded, so every submitted file can be matched to a student or team.
    participant: {
      label: "Participant name(s)",
      placeholder: "Who is completing this exercise?",
      required: true,
    },

    // Students must explain their reasoning (and any custom policy) in at least
    // this many characters before a decision is accepted.
    minReasoningChars: 20,
    allowCustomPolicy: true,

    // How students hand the work in. GitHub Pages cannot receive uploads, so
    // students download the file (or copy the text) and submit it in your LMS.
    // Optional: paste a direct link to the assignment into `linkUrl`.
    submission: {
      lms: "Canvas",
      landingNote:
        "At the end, download a PDF or text decision record (or copy the text) and submit it through your course. This simulation does not submit anything for you. Your entries stay in this browser; share a device if working as a team.",
      instructions:
        "Download your record as a PDF, or copy the text. Then upload the file, or paste the text, into the Canvas assignment your instructor created for this exercise. Open the file first and check that your name appears on page one.",
      linkUrl: "",
      linkLabel: "Open the Canvas assignment",
    },

    // Wording used in the downloaded PDF / text / printed record.
    report: {
      fileSlug: "redwood-valley-decision-record",
      title: "PUBLIC HEALTH CRISIS",
      subtitle: "Redwood Valley | Executive Leadership Simulation",
      label: "AFTER-ACTION DECISION RECORD",
      disclaimer:
        "Fictional educational exercise. Indicators are teaching estimates, not epidemiological predictions, legal evaluations, or grades.",
      closingNote:
        "Generated from this team’s completed simulation. Downloading does not submit work to Canvas.",
      pdfHeader: "REDWOOD VALLEY  /  EXECUTIVE LEADERSHIP EXERCISE",
      pdfFooter: "EXERCISE ONLY  |  Fictional educational simulation",
      pdfTitle: "Redwood Valley - Decision Record",
      pdfAuthor: "Redwood Valley Educational Simulation",
      pdfSubject: "Completed executive leadership decision record",
    },
  },

  landing: {
    eyebrow: "Public health crisis · Executive simulation",
    headline: { line1: "The next decision", line2: "changes", accent: "the response." },
    lead:
      "An emerging outbreak. A divided community. Five decisions that will test how you lead when public health, individual rights, and institutional responsibilities collide.",
    tags: ["5 decision points", "45-minute suggested time", "Individual or team exercise"],
    dossier: {
      label: "Situation brief 001",
      tag: "Initial alert",
      title: "Redwood Valley",
      lines: ["Suspected measles outbreak", "Regional response activation"],
      facts: [
        { value: "240k", label: "Residents" },
        { value: "2", label: "Hospitals" },
        { value: "12", label: "Initial cases" },
      ],
      footer: "Fictional region / exercise data",
    },
    briefingTitle: "Your executive briefing",
    briefingBefore:
      "You are the executive leadership team responsible for coordinating a response to an escalating infectious disease emergency. Several large community gatherings have preceded a suspected measles outbreak in fictional Redwood Valley.",
    mission: {
      label: "Your mission",
      text:
        "Protect public health while navigating legal authority, patient rights, organizational constraints, equity, political pressure, and community trust.",
    },
    briefingAfter:
      "There is no single perfect solution. Review each briefing, choose a policy, and explain the legal and ethical tradeoffs. Your decisions shape the simulated consequences that follow.",
    setupEyebrow: "Enter the operations center",
    setupTitle: "Prepare your response",
    beginLabel: "Begin simulation",
  },

  workspace: {
    eyebrow: "Public health crisis / Executive response",
    title: "Public health response",
    customLabel: "Propose an alternative or blended policy",
    customDetail: "Describe your own approach and choose which response model to apply.",
    reasoningLabel: "Explain your legal and ethical reasoning",
    reasoningPlaceholder: "What authority applies? Who is affected? What tradeoffs are you accepting?",
  },

  complete: {
    eyebrow: "After-action review / Response complete",
    headline: "Five decisions. A record of your leadership.",
    sub: "All 5 decisions recorded · Ready for reflection and download",
    reflectionLabel: "Final team reflection",
    reflectionPlaceholder: "Summarize your most important leadership lessons.",
  },

  // ---- Indicators ---------------------------------------------------
  metricMeta: {
    severity: "Outbreak severity",
    trust: "Community trust",
    capacity: "Hospital capacity",
    legal: "Legal exposure",
    pressure: "Political pressure",
    equity: "Equity impact",
    morale: "Staff morale",
  },

  metricDirections: {
    severity: "Lower = less severe",
    trust: "Higher = stronger trust",
    capacity: "Higher = more capacity",
    legal: "Lower = less exposure",
    pressure: "Lower = less pressure",
    equity: "Higher = more equitable access",
    morale: "Higher = stronger morale",
  },

  // Indicators where a LOWER number is the better outcome.
  riskMetrics: ["severity", "legal", "pressure"],

  // Starting values (0-100).
  initialState: { severity: 35, trust: 65, capacity: 70, legal: 20, pressure: 30, equity: 60, morale: 65 },

  // ---- Decisions ----------------------------------------------------
  // `effects` are added to the indicators when that option is chosen
  // (negative numbers lower an indicator). Values are clamped to 0-100.
  rounds: [
    {
      title: "First Alert",
      role: "County Health Director",
      story: "Redwood Valley confirms 12 measles cases. Several patients visited schools, a crowded community event, and a hospital emergency department while potentially infectious. Vaccination coverage varies substantially across neighborhoods.",
      context: "The hospital can manage its facilities and clinical operations. The county health department must separately assess its statutory authority for public health orders.",
      question: "How should your leadership team respond during the first 24 hours?",
      options: [
        {
          title: "Launch a broad emergency response",
          detail: "Public warning, rapid tracing, expanded testing and vaccination access.",
          result: "Response capacity expands quickly, but some residents question the urgency.",
          stakeholder: "The mayor asks whether the public announcement could create unnecessary panic.",
          legal: "Emergency messaging and resource mobilization do not automatically authorize compulsory restrictions.",
          reflection: "How would you explain the level of uncertainty to the public?",
          effects: { severity: -9, trust: -3, capacity: -6, legal: 3, pressure: 9, equity: 4, morale: -3 },
        },
        {
          title: "Use a targeted, coordinated response",
          detail: "Notify affected groups, coordinate clinical response, and expand voluntary services.",
          result: "Targeted action reduces disruption, although some exposures remain unidentified.",
          stakeholder: "A school principal asks why families outside the identified exposure network have not been notified.",
          legal: "Targeting should rely on evidence, consistent criteria, and equitable access.",
          reflection: "What evidence would justify expanding the response?",
          effects: { severity: -5, trust: 5, capacity: -3, legal: -3, pressure: 2, equity: 4, morale: 2 },
        },
        {
          title: "Begin with voluntary monitoring",
          detail: "Issue limited guidance and rely on healthcare providers to report new cases.",
          result: "Initial disruption is limited, but additional exposures go undetected.",
          stakeholder: "Emergency clinicians report concern that the response is too slow.",
          legal: "Avoiding restrictions reduces some liberty concerns but does not eliminate institutional duties to respond.",
          reflection: "What is the ethical cost of delay?",
          effects: { severity: 13, trust: 1, capacity: -8, legal: 5, pressure: 6, equity: -6, morale: -7 },
        },
      ],
    },
    {
      title: "Isolation Dispute",
      role: "Hospital Legal Counsel",
      story: "A patient with suspected measles refuses recommended isolation and wishes to leave the hospital. Several exposed individuals have also declined voluntary guidance.",
      context: "Legal counsel cautions that clinical recommendations, hospital infection-control policies, and government isolation orders involve different sources of authority.",
      question: "How will your team respond to the patient and the broader exposure risk?",
      options: [
        {
          title: "Seek a formal isolation order",
          detail: "Request public health legal review and pursue compulsory measures if authorized.",
          result: "Transmission risk is reduced, but the intervention attracts scrutiny.",
          stakeholder: "A patient advocate demands information about appeal rights, humane conditions, and access to counsel.",
          legal: "Authority, procedural safeguards, necessity, and least-restrictive alternatives must be assessed under applicable law.",
          reflection: "What procedural protections would make this intervention defensible?",
          effects: { severity: -11, trust: -9, capacity: -3, legal: 12, pressure: 10, equity: -7, morale: -2 },
        },
        {
          title: "Negotiate supported voluntary isolation",
          detail: "Offer clear information, assistance, and a defined reassessment process.",
          result: "Most individuals cooperate, but some exposure risk persists.",
          stakeholder: "A social worker requests transportation, food, and income support for affected households.",
          legal: "Voluntary compliance may be more sustainable when meaningful supports address practical barriers.",
          reflection: "What happens if voluntary cooperation fails?",
          effects: { severity: -5, trust: 9, capacity: -5, legal: -5, pressure: -2, equity: 9, morale: 2 },
        },
        {
          title: "Avoid compulsory measures",
          detail: "Provide advice and allow individuals to determine whether to comply.",
          result: "Individual autonomy is preserved, but additional contacts are exposed.",
          stakeholder: "A parent of an immunocompromised child argues that the response ignores vulnerable residents.",
          legal: "Respect for autonomy must be balanced against foreseeable harms to others.",
          reflection: "When might nonintervention become ethically unacceptable?",
          effects: { severity: 15, trust: -5, capacity: -8, legal: 7, pressure: 9, equity: -10, morale: -5 },
        },
      ],
    },
    {
      title: "Workforce Shortage",
      role: "Hospital Chief Operating Officer",
      story: "Hospital admissions are increasing. Several staff members have been exposed, and others are requesting leave. The emergency department is approaching its operational limits.",
      context: "The hospital must address patient safety, employment obligations, infection control, disability-related accommodations, and equitable access to services.",
      question: "What workforce and service strategy will your team adopt?",
      options: [
        {
          title: "Implement aggressive staffing controls",
          detail: "Restrict leave, reassign personnel, and reduce nonurgent services.",
          result: "Short-term clinical coverage improves, but staff exhaustion and grievances rise.",
          stakeholder: "Nursing leadership challenges the fairness and safety of mandatory reassignments.",
          legal: "Employment rules, safety duties, collective agreements where applicable, and accommodation requirements need review.",
          reflection: "How do you protect staff without compromising patient care?",
          effects: { severity: -6, trust: -4, capacity: 12, legal: 12, pressure: 5, equity: -7, morale: -15 },
        },
        {
          title: "Use supported surge staffing",
          detail: "Recruit temporary support, offer accommodations, and prioritize care.",
          result: "The hospital stabilizes more slowly but preserves greater workforce cooperation.",
          stakeholder: "A finance officer warns that temporary staffing and support programs will be expensive.",
          legal: "Document transparent triage and staffing criteria while considering reasonable accommodations.",
          reflection: "How should limited resources be allocated fairly?",
          effects: { severity: -5, trust: 5, capacity: 8, legal: -4, pressure: 1, equity: 7, morale: 10 },
        },
        {
          title: "Maintain normal staffing policies",
          detail: "Rely on existing schedules and voluntary overtime.",
          result: "Immediate workplace conflict is limited, but service delays worsen.",
          stakeholder: "An emergency physician reports unsafe wait times and growing burnout.",
          legal: "Maintaining ordinary policies does not remove obligations to address foreseeable safety risks.",
          reflection: "At what point must normal operations be altered?",
          effects: { severity: 10, trust: -5, capacity: -17, legal: 7, pressure: 7, equity: -8, morale: -7 },
        },
      ],
    },
    {
      title: "Public Backlash",
      role: "Community Relations Director",
      story: "A social media post alleges that hospital policies favor affluent neighborhoods. A community leader disputes the county's case figures, and reporters demand a public response.",
      context: "Public communication must protect confidential information while addressing misinformation, uncertainty, and legitimate concerns about unequal access.",
      question: "How will your team respond publicly?",
      options: [
        {
          title: "Directly challenge public critics",
          detail: "Issue a strong statement defending the response and correcting disputed claims.",
          result: "The message is clear, but the conflict becomes more visible.",
          stakeholder: "A community organizer says officials are dismissing residents' lived experiences.",
          legal: "Accuracy and privacy are essential. Public disagreement should not become retaliation or unsupported disclosure.",
          reflection: "How can officials correct misinformation without silencing criticism?",
          effects: { severity: -2, trust: -12, capacity: 0, legal: 5, pressure: 13, equity: -5, morale: 1 },
        },
        {
          title: "Hold a transparent community briefing",
          detail: "Share verified information, acknowledge gaps, and invite participation.",
          result: "Trust improves, although the team faces difficult public questions.",
          stakeholder: "A local clinician requests translated updates and accessible vaccination services.",
          legal: "Communications should avoid identifiable patient information and unsupported claims.",
          reflection: "How will you show that community input changes policy?",
          effects: { severity: -4, trust: 13, capacity: -3, legal: -5, pressure: -7, equity: 10, morale: 4 },
        },
        {
          title: "Limit public comment",
          detail: "Release a brief written statement and avoid further media engagement.",
          result: "The organization avoids immediate confrontation, but rumors intensify.",
          stakeholder: "A reporter questions why leadership is withholding information.",
          legal: "Privacy duties do not generally justify withholding all aggregate public health information.",
          reflection: "What are the risks of remaining silent during uncertainty?",
          effects: { severity: 5, trust: -13, capacity: 0, legal: 4, pressure: 11, equity: -7, morale: -3 },
        },
      ],
    },
    {
      title: "Stabilization and Recovery",
      role: "Regional Emergency Coordinator",
      story: "The crisis enters its third week. Transmission appears to be slowing in some areas, but hospital staff are exhausted and residents are demanding a timeline for lifting emergency measures.",
      context: "The leadership team must distinguish temporary emergency actions from long-term policies and determine what evidence supports de-escalation.",
      question: "What recovery strategy will you adopt?",
      options: [
        {
          title: "Maintain broad emergency controls",
          detail: "Continue restrictions until case activity falls substantially.",
          result: "Risk remains controlled, but frustration and resource strain grow.",
          stakeholder: "Business and patient groups demand a clear justification for continuing restrictions.",
          legal: "Emergency measures require ongoing review for necessity, proportionality, and legal authority.",
          reflection: "What objective conditions would trigger repeal?",
          effects: { severity: -12, trust: -9, capacity: -8, legal: 10, pressure: 12, equity: -5, morale: -9 },
        },
        {
          title: "Use phased, evidence-based recovery",
          detail: "Set public thresholds, restore services gradually, and audit equity impacts.",
          result: "Recovery progresses with continued monitoring and transparent criteria.",
          stakeholder: "A patient representative requests a public review of delays and unequal treatment.",
          legal: "Documented criteria and review processes can strengthen accountability.",
          reflection: "How will the organization evaluate its emergency decisions?",
          effects: { severity: -7, trust: 11, capacity: 10, legal: -7, pressure: -7, equity: 10, morale: 9 },
        },
        {
          title: "End emergency measures immediately",
          detail: "Restore normal operations and leave future precautions voluntary.",
          result: "Some services recover quickly, but renewed transmission becomes a concern.",
          stakeholder: "Infection prevention staff warn that surveillance is insufficient.",
          legal: "The decision should consider available evidence and continuing duties to vulnerable populations.",
          reflection: "How would you respond if cases rise again?",
          effects: { severity: 13, trust: 2, capacity: 7, legal: 6, pressure: 4, equity: -7, morale: 5 },
        },
      ],
    },
  ],

  // ---- Debrief ------------------------------------------------------
  debrief: [
    "Which decision presented the greatest conflict between public safety and individual rights?",
    "Where did hospital authority end and public health authority begin?",
    "Which groups experienced disproportionate burdens?",
    "How did your communication choices affect trust?",
    "What would you change with better information?",
    "What safeguards would you require before implementing your most restrictive policy?",
  ],

  // ---- Rules --------------------------------------------------------
  // m = current indicators. Return text only; no HTML.
  rules: {
    // Situation updates shown before each decision and saved in the report.
    contextNotes(m) {
      const notes = [];
      if (m.severity >= 60) notes.push("Escalation: transmission is accelerating. The next decision carries greater clinical urgency.");
      if (m.trust <= 40) notes.push("Trust crisis: community groups now question official guidance and demand independent review.");
      if (m.capacity <= 40) notes.push("Capacity crisis: hospital leadership reports serious constraints on available services.");
      if (m.legal >= 55) notes.push("Legal challenge: counsel reports growing requests for documentation and review.");
      if (m.equity <= 35) notes.push("Equity warning: underserved neighborhoods report disproportionate barriers to care.");
      return notes;
    },

    // Extra consequences that depend on where the indicators stand BEFORE the
    // decision. Applied first, then the option's own `effects`.
    //   before      indicators before this decision
    //   optionIndex which modeled response is applied (0, 1, 2 ...)
    //   roundIndex  0 for the first decision, 1 for the second ...
    // Return { warnings: [text...], adjust: { indicator: change, ... } }
    modifiers(before, optionIndex, roundIndex) {
      const warnings = [];
      const adjust = {};
      if (before.severity >= 60) {
        warnings.push("High transmission magnifies the consequences of any delay or gaps in implementation.");
        if (optionIndex === 2) adjust.severity = 5;
      }
      if (before.trust <= 40 && optionIndex === 0) {
        warnings.push("Low community trust increases resistance to restrictive policies.");
        adjust.trust = -5;
      }
      if (before.capacity <= 40 && roundIndex >= 2) {
        warnings.push("Existing hospital strain limits the effectiveness of this response.");
        adjust.capacity = -4;
      }
      return { warnings, adjust };
    },

    // One paragraph summarizing the final indicators.
    narrative(m) {
      return [
        m.severity >= 65
          ? "The outbreak remains difficult to control."
          : m.severity <= 30
          ? "The response has substantially reduced the simulated outbreak severity."
          : "The outbreak shows partial stabilization.",
        m.trust <= 40
          ? "Public trust is fragile, complicating recovery."
          : m.trust >= 70
          ? "Public trust is relatively strong, which supported recovery efforts."
          : "Public trust is mixed, requiring continued communication and accountability.",
        m.capacity <= 40
          ? "Hospital capacity remains a major risk to long-term operations."
          : m.capacity >= 70
          ? "The system has regained enough operational capacity to function more steadily."
          : "Operational capacity is unstable but manageable.",
        m.legal >= 60
          ? "Legal exposure remains elevated and will likely require formal review of decisions."
          : m.legal <= 30
          ? "Legal exposure is relatively contained, though future disputes remain possible."
          : "Legal exposure requires continued attention during recovery.",
      ].join(" ");
    },
  },
};
