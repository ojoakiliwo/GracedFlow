import { sendEmail, sendSms, sendWhatsApp } from "./comms.js";
import { config } from "./config.js";
import { toE164 } from "./util.js";

function portalUrl(path: string): string {
  return `${config.appUrl.replace(/\/$/, "")}${path}`;
}

async function deliverToMember(
  member: { first_name?: string; email?: string | null; phone?: string | null },
  subject: string,
  body: string,
): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  if (member.phone) {
    const dest = toE164(member.phone);
    jobs.push(sendSms(dest, body));
    jobs.push(sendWhatsApp(dest, body));
  }
  if (member.email) {
    jobs.push(sendEmail(member.email, subject, body));
  }
  await Promise.allSettled(jobs);
}

export async function notifyMemberInvite(member: {
  first_name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<void> {
  const registerUrl = portalUrl("/register");
  const loginUrl = portalUrl("/login");
  const body =
    `Hello ${member.first_name}, you have been added to ${config.church.name}. ` +
    `This is your church record, not a login yet. Open ${registerUrl} and use the same email or phone ` +
    `to create your password. Then sign in at ${loginUrl}.`;
  await deliverToMember(member, `Welcome to ${config.church.name}`, body);
}

export async function notifyTaskAssigned(input: {
  assignee: { first_name: string; email?: string | null; phone?: string | null };
  title: string;
  dueDate?: string | null;
  assignerName: string;
}): Promise<void> {
  const loginUrl = portalUrl("/login");
  const due = input.dueDate ? ` Due ${input.dueDate}.` : "";
  const body =
    `Hello ${input.assignee.first_name}, ${input.assignerName} assigned you a task: "${input.title}".` +
    `${due} Open your dashboard: ${loginUrl}`;
  await deliverToMember(input.assignee, `New task: ${input.title}`, body);
}
