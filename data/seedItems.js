function createSeedPhoto(title, accentA, accentB) {
  const safeTitle = String(title)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${accentA}" />
          <stop offset="100%" stop-color="${accentB}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#bg)" />
      <circle cx="940" cy="160" r="130" fill="rgba(255,255,255,0.12)" />
      <circle cx="200" cy="660" r="170" fill="rgba(255,255,255,0.08)" />
      <rect x="110" y="110" width="980" height="580" rx="38" fill="rgba(10,10,15,0.18)" stroke="rgba(255,255,255,0.16)" />
      <text x="120" y="360" fill="white" font-size="74" font-family="Arial, sans-serif" font-weight="700">${safeTitle}</text>
      <text x="120" y="438" fill="rgba(255,255,255,0.88)" font-size="34" font-family="Arial, sans-serif">FindIt sample photo</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const seedItems = [
  {
    type: "lost",
    status: "open",
    name: "Blue Leather Wallet",
    category: "accessories",
    photoData: createSeedPhoto("Blue Leather Wallet", "#3154d6", "#111827"),
    description: "Lost a blue bifold leather wallet near the city palace area. It contains ID cards, bank cards, and some cash.",
    location: "City Palace Road",
    date: "2026-04-28",
    contactName: "Arjun Sharma",
    phone: "+91 98765 43210",
    email: "arjun@example.com",
    reward: "Rs. 500 reward"
  },
  {
    type: "found",
    status: "open",
    name: "iPhone 14 Pro",
    category: "electronics",
    photoData: createSeedPhoto("iPhone 14 Pro", "#161b22", "#334155"),
    description: "Found a black iPhone near the hill parking area. The screen has a small crack.",
    location: "Hill Parking",
    date: "2026-04-29",
    contactName: "Priya Nair",
    phone: "+91 87654 32109",
    email: "priya@example.com",
    reward: ""
  },
  {
    type: "lost",
    status: "open",
    name: "Golden Retriever - Bruno",
    category: "pets",
    photoData: createSeedPhoto("Golden Retriever Bruno", "#8b5e34", "#f59e0b"),
    description: "Bruno went missing from our backyard. He is friendly and wears a brown collar with a name tag.",
    location: "Vijayanagar",
    date: "2026-04-26",
    contactName: "Sneha Reddy",
    phone: "+91 76543 21098",
    email: "sneha@example.com",
    reward: "Rs. 2000 reward for safe return"
  },
  {
    type: "found",
    status: "open",
    name: "Honda Car Keys",
    category: "keys",
    photoData: createSeedPhoto("Honda Car Keys", "#ef4444", "#1f2937"),
    description: "Found a Honda key with a red keychain and two extra keys near the mall parking entrance.",
    location: "Lulu Mall Parking",
    date: "2026-04-30",
    contactName: "Ravi Kumar",
    phone: "+91 65432 10987",
    email: "ravi@example.com",
    reward: ""
  },
  {
    type: "lost",
    status: "open",
    name: "Black Laptop Bag",
    category: "bags",
    photoData: createSeedPhoto("Black Laptop Bag", "#111827", "#4b5563"),
    description: "Left a black Dell laptop bag on a bus. It contains a laptop, charger, notebooks, and documents.",
    location: "Central Bus Stand",
    date: "2026-04-25",
    contactName: "Kiran Patil",
    phone: "+91 54321 09876",
    email: "kiran@example.com",
    reward: "Rs. 1000 reward"
  },
  {
    type: "found",
    status: "open",
    name: "Prescription Glasses",
    category: "accessories",
    photoData: createSeedPhoto("Prescription Glasses", "#7c3aed", "#0f172a"),
    description: "Found a pair of glasses with a brown frame near the market. Stored safely for the owner.",
    location: "KR Market",
    date: "2026-05-01",
    contactName: "Meera Singh",
    phone: "+91 43210 98765",
    email: "meera@example.com",
    reward: ""
  },
  {
    type: "lost",
    status: "open",
    name: "Aadhaar and PAN Card",
    category: "documents",
    photoData: createSeedPhoto("Important ID Documents", "#0f766e", "#164e63"),
    description: "Lost important ID documents near the city bus stop. Needed urgently for official work.",
    location: "City Bus Stop",
    date: "2026-04-24",
    contactName: "Ganesh Murthy",
    phone: "+91 32109 87654",
    email: "ganesh@example.com",
    reward: "Rs. 500 reward"
  },
  {
    type: "lost",
    status: "resolved",
    name: "Blue Umbrella",
    category: "other",
    photoData: createSeedPhoto("Blue Umbrella", "#2563eb", "#38bdf8"),
    description: "This umbrella was returned by a kind stranger. Keeping the post here as a success story.",
    location: "Infosys Campus",
    date: "2026-04-20",
    contactName: "Ananya B",
    phone: "+91 21098 76543",
    email: "ananya@example.com",
    reward: ""
  }
];

async function backfillMissingPhotos(ItemModel) {
  const itemsWithoutPhotos = await ItemModel.find({
    $or: [
      { photoData: { $exists: false } },
      { photoData: "" },
      { photoData: null }
    ]
  });

  if (itemsWithoutPhotos.length === 0) {
    return;
  }

  for (const item of itemsWithoutPhotos) {
    item.photoData = createSeedPhoto(item.name || "FindIt Item", "#1f2937", "#4f46e5");
    await item.save();
  }

  console.log(`Backfilled photos for ${itemsWithoutPhotos.length} existing items.`);
}

async function seedItemsIfNeeded(ItemModel) {
  const total = await ItemModel.countDocuments();

  if (total > 0) {
    await backfillMissingPhotos(ItemModel);
    return;
  }

  await ItemModel.insertMany(seedItems);
  console.log("Seed data inserted.");
}

module.exports = {
  seedItemsIfNeeded
};
