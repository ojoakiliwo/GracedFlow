export type AutomationCopyKind = "sunday" | "prayer" | "birthday" | "anniversary";

export type AutomationCopy = {
  subject: string;
  body: string;
};

export type PickedAutomationCopy = AutomationCopy & {
  index: number;
  total: number;
};

/** Monday-based week number that increases forever (does not reset each January). */
export function mondayWeekIndex(date: Date, timeZone = "Africa/Lagos"): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const utc = Date.UTC(year, month - 1, day);
  const weekday = new Date(utc).getUTCDay(); // 0 Sun … 6 Sat
  const daysFromMonday = (weekday + 6) % 7;
  const monday = utc - daysFromMonday * 86_400_000;
  return Math.floor(monday / (7 * 86_400_000));
}

export const AUTOMATION_COPY: Record<AutomationCopyKind, readonly AutomationCopy[]> = {
  sunday: [
    {
      subject: "See you tomorrow at Infinitely Graced Church",
      body: "Hello {{first_name}}, this is a loving reminder about our Sunday Service tomorrow. Come expectant — His infinite grace awaits you! God bless you.",
    },
    {
      subject: "Grace is gathering tomorrow",
      body: "{{first_name}}, tomorrow we assemble at Infinitely Graced Church at 8:00 AM. Come hungry for the Word — His grace still speaks. See you there.",
    },
    {
      subject: "Your seat is waiting, {{first_name}}",
      body: "Don't miss Sunday service tomorrow. Come as you are; the Father has a word in season for you. Infinitely Graced Church, 8:00 AM.",
    },
    {
      subject: "One more sleep until worship",
      body: "Good evening {{first_name}}. Tomorrow we lift Jesus together. Rest well tonight and come ready — Sunday Celebration Service, 8:00 AM.",
    },
    {
      subject: "Come expectant this Sunday",
      body: "{{first_name}}, the doors of Infinitely Graced Church open tomorrow at 8:00 AM. Come believing. Grace has not run out.",
    },
    {
      subject: "Family, we meet tomorrow",
      body: "Hello {{first_name}}, your church family will be looking for you tomorrow. Sunday Service, 8:00 AM — let's honour the Lord together.",
    },
    {
      subject: "A fresh word for {{first_name}}",
      body: "Tomorrow is Sunday Celebration. Bring an open heart; God still meets His people. Infinitely Graced Church, 8:00 AM. We love you.",
    },
    {
      subject: "Tomorrow: worship, Word, and grace",
      body: "{{first_name}}, join us tomorrow as we worship and sit under the Word. Sunday Service starts at 8:00 AM. Come early if you can.",
    },
    {
      subject: "Don't stay away tomorrow",
      body: "Hello {{first_name}}. If this week was heavy, Sunday is for you. Come and be refreshed at Infinitely Graced Church, 8:00 AM.",
    },
    {
      subject: "See you in His presence",
      body: "{{first_name}}, we gather tomorrow in the presence of the Lord. Sunday Celebration Service, 8:00 AM. Come expecting a touch of grace.",
    },
    {
      subject: "Sunday is almost here",
      body: "A gentle reminder, {{first_name}}: service is tomorrow at 8:00 AM. Invite someone along. Infinitely Graced Church is home.",
    },
    {
      subject: "Come, let us go to the house of the Lord",
      body: "{{first_name}}, tomorrow we go up together. Sunday Service at Infinitely Graced Church, 8:00 AM. His infinite grace awaits you.",
    },
  ],
  prayer: [
    {
      subject: "Wednesday Prayer Meeting today",
      body: "Good morning {{first_name}}! Remember our Wednesday Prayer Meeting today. Let us gather and press in together. See you there!",
    },
    {
      subject: "We pray today at 4:00 PM",
      body: "{{first_name}}, it is Wednesday — our prayer meeting is today at 4:00 PM. Come and agree with us. Heaven still answers.",
    },
    {
      subject: "A call to the altar, {{first_name}}",
      body: "Good morning. Leave the rush and come pray with your church family this afternoon. Wednesday Prayer Meeting, 4:00 PM at Infinitely Graced Church.",
    },
    {
      subject: "Press in with us today",
      body: "{{first_name}}, corporately we seek the Lord today. Wednesday Prayer starts at 4:00 PM. Come believing; come burdened; come as you are.",
    },
    {
      subject: "Prayer changes things — today",
      body: "Hello {{first_name}}. If you have a request, bring it. If you have praise, bring that too. Wednesday Prayer Meeting, 4:00 PM.",
    },
    {
      subject: "Stand with us in prayer",
      body: "Good morning {{first_name}}. We meet this afternoon to pray. Your voice matters in the room. Infinitely Graced Church, 4:00 PM.",
    },
    {
      subject: "Wednesday: we wait on the Lord",
      body: "{{first_name}}, today we wait on God together. Come hungry. Wednesday Prayer Meeting, 4:00 PM. Grace will meet us there.",
    },
    {
      subject: "Come, let us seek His face",
      body: "A reminder for you, {{first_name}}: prayer meeting is today at 4:00 PM. Don't pray alone if you can pray with family.",
    },
    {
      subject: "The prayer room is open today",
      body: "Good morning {{first_name}}. Wednesday Prayer at Infinitely Graced Church is 4:00 PM. Come early if you need a quiet moment before we start.",
    },
    {
      subject: "We need you in the gap",
      body: "{{first_name}}, we stand in the gap for families, the church and this city today. Join us at 4:00 PM. Your amen counts.",
    },
    {
      subject: "Midweek encounter",
      body: "Hello {{first_name}}. Midweek is for encounter. Wednesday Prayer Meeting, 4:00 PM — come and be filled again.",
    },
    {
      subject: "Today we pray, {{first_name}}",
      body: "Good morning. The Lord is near to all who call. Gather with us at 4:00 PM for Wednesday Prayer. Infinitely Graced Church.",
    },
  ],
  birthday: [
    {
      subject: "Happy Birthday from your church family!",
      body: "Happy Birthday, {{first_name}}! The whole family at Infinitely Graced Church celebrates you today. May God's infinite grace crown this new year of your life with joy, health and testimonies. We love you!",
    },
    {
      subject: "Another year of grace, {{first_name}}",
      body: "Happy Birthday! We thank God for your life. May this new year overflow with peace, strength and the kindness of the Lord. With love from Infinitely Graced Church.",
    },
    {
      subject: "We celebrate you today",
      body: "{{first_name}}, heaven and your church family rejoice over you today. Happy Birthday. May joy be your portion and grace your covering all year long.",
    },
    {
      subject: "Blessed birthday, {{first_name}}",
      body: "On your birthday we pray: the Lord bless you and keep you. May He shine His face on this new chapter. Happy Birthday from Infinitely Graced Church.",
    },
    {
      subject: "A gift to us — and to the kingdom",
      body: "Happy Birthday, {{first_name}}. You are a gift to this house. May God increase you, keep you healthy, and write beautiful stories in the year ahead.",
    },
    {
      subject: "Grow in grace this new year",
      body: "{{first_name}}, happy birthday! As you add a year, may you also add wisdom, joy and fresh oil. We love you — Infinitely Graced Church.",
    },
    {
      subject: "Today is your day of praise",
      body: "Happy Birthday! We praise God for the day you were born. {{first_name}}, may testimonies follow you, and may His presence go with you. Amen.",
    },
    {
      subject: "Many happy returns in Christ",
      body: "{{first_name}}, your church family sings over you today. Happy Birthday. May the years ahead be gentle, fruitful and full of Jesus.",
    },
    {
      subject: "Grace for the year ahead",
      body: "Happy Birthday, {{first_name}}! Whatever you are believing God for, may this year answer with grace. We stand with you — Infinitely Graced Church.",
    },
    {
      subject: "Celebrating the life of {{first_name}}",
      body: "Today we honour you. Happy Birthday. May your table be full, your heart be light, and your walk with God be deeper still. With love from IGC.",
    },
    {
      subject: "Shine on, {{first_name}}",
      body: "Happy Birthday! May the light of Christ rest on you in this new year — health in your body, rest in your mind, and favour in your going out. We love you.",
    },
    {
      subject: "A new year of His goodness",
      body: "{{first_name}}, happy birthday from Infinitely Graced Church. Surely goodness and mercy shall follow you. Enjoy your day — you are deeply loved.",
    },
  ],
  anniversary: [
    {
      subject: "Happy Wedding Anniversary!",
      body: "Happy Wedding Anniversary, {{first_name}}! We thank God for your union. May His grace continue to strengthen and beautify your marriage. Congratulations from all of us at Infinitely Graced Church!",
    },
    {
      subject: "Celebrating your covenant today",
      body: "{{first_name}}, happy anniversary! May your home remain a place of peace, laughter and the presence of God. We honour your covenant — Infinitely Graced Church.",
    },
    {
      subject: "Grace over your marriage",
      body: "Congratulations on another year together. {{first_name}}, may love deepen, patience abound, and Christ remain at the centre. Happy Wedding Anniversary from IGC.",
    },
    {
      subject: "Still better together",
      body: "Happy Anniversary, {{first_name}}! Thank you for the testimony of your marriage. May the Lord keep knitting your hearts as one. We celebrate you.",
    },
    {
      subject: "A year more of God's kindness",
      body: "{{first_name}}, we rejoice with you today. Happy Wedding Anniversary. May this next year be marked by understanding, joy and fresh grace at home.",
    },
    {
      subject: "Honour to your union",
      body: "From your church family: congratulations! May your marriage speak of Jesus — faithful, kind and strong. Happy Anniversary, {{first_name}}.",
    },
    {
      subject: "Two made one — still God's idea",
      body: "Happy Wedding Anniversary! {{first_name}}, we pray covering over your home, wisdom for every season, and sweetness in your friendship as husband and wife.",
    },
    {
      subject: "Love that lasts, grace that holds",
      body: "{{first_name}}, another year of covenant deserves a song. We sing with you today. May God keep what He joined. Happy Anniversary from Infinitely Graced Church.",
    },
    {
      subject: "Congratulations on your anniversary",
      body: "We celebrate your marriage today. Happy Anniversary, {{first_name}}. May arguments be few, prayers be many, and joy be at home.",
    },
    {
      subject: "A toast in prayer, not just in words",
      body: "{{first_name}}, we thank God for your spouse and for the years behind you. May the years ahead overflow with mercy. Happy Wedding Anniversary.",
    },
    {
      subject: "Built by grace, kept by grace",
      body: "Happy Anniversary from Infinitely Graced Church. {{first_name}}, may your house stand through every weather, founded on Christ. We love you both.",
    },
    {
      subject: "One more year of 'I do'",
      body: "{{first_name}}, congratulations! May you find new reasons to say I do. Peace to your home, favour to your labour, and Jesus at the table. Happy Anniversary.",
    },
  ],
};

export function pickAutomationCopy(
  kind: AutomationCopyKind,
  date: Date = new Date(),
  timeZone = "Africa/Lagos",
): PickedAutomationCopy {
  const bank = AUTOMATION_COPY[kind];
  const total = bank.length;
  const index = ((mondayWeekIndex(date, timeZone) % total) + total) % total;
  const copy = bank[index]!;
  return { subject: copy.subject, body: copy.body, index, total };
}

export function plusDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function parseAutomationDate(value?: Date | string | null): Date {
  if (!value) return new Date();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
