export interface OutreachTemplate {
  label: string;
  channel: string;
  body: string;
}

/**
 * Short, plain spoken messages. Every template keeps the facts generic on
 * purpose. The user fills in dates, projects and names before sending.
 */
export function outreachTemplates(company: string, role: string, name: string): OutreachTemplate[] {
  const who = name || "your name";
  const org = company || "the company";
  const target = role || "the role";
  return [
    {
      label: "LinkedIn connection note",
      channel: "LinkedIn",
      body: `Hi there, I am ${who}. I applied for the ${target} role at ${org} and wanted to introduce myself. I have done similar work and can share a short example if it is useful. Thanks for your time.`,
    },
    {
      label: "Follow up after applying",
      channel: "Email",
      body: `Hello, I applied for the ${target} role at ${org} on [date]. I am still interested and happy to answer any questions. I can share more detail on the experience most relevant to the role whenever it helps. Thank you.`,
    },
    {
      label: "Thank you after an interview",
      channel: "Email",
      body: `Hello, thank you for the conversation about the ${target} role at ${org}. The part about [specific topic] stayed with me, and it maps to work I have done. I am glad to provide anything else the team needs.`,
    },
    {
      label: "Referral request to a former colleague",
      channel: "Direct message",
      body: `Hi [name], I hope you are well. I am applying for the ${target} role at ${org} and remembered our work together on [project]. If you are comfortable referring me, I can send a short summary and the posting. No pressure either way. Thanks.`,
    },
    {
      label: "Recruiter introduction",
      channel: "Email",
      body: `Hello [name], I saw the ${target} opening at ${org}. My background is in [two relevant areas], and I would like to be considered. I have attached my resume and can share examples of [specific outcome] if that helps. Thank you for your time.`,
    },
    {
      label: "Post interview question",
      channel: "Email",
      body: `Hello [name], thank you again for the conversation about the ${target} role. I have been thinking about [topic we discussed] and wanted to ask one follow up question: [question]. I am happy to clarify anything from my background. Thank you.`,
    },
  ];
}
