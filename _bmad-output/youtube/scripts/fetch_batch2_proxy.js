#!/usr/bin/env node
/**
 * Fetch YouTube transcripts - Batch 2 (14 new inspiration channels).
 * Uses ANDROID InnerTube API + CORS proxy.
 * Outputs merged files (scripts + links) to ../channels/
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHANNELS_DIR = path.join(__dirname, '..', 'channels');
const TRANSCRIPT_DIR = path.join(__dirname, '..', 'transcripts');
fs.mkdirSync(CHANNELS_DIR, { recursive: true });
fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });

const INNERTUBE_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';
const PROXY_BASE = 'https://corsproxy.io/?';

const CHANNELS = {
  "Erika Kullberg": [
    ["gQ_HOsc7R6s", "Final call: Free 4 Day Investing Workshop starts Mon Feb 16 Grab your spot: Erika.com/invest #shorts", "23000"],
    ["9tnQ5pbZSQU", "How they keep you from owning a home 😡 #lawyer #money", "46000"],
    ["FgK0q_JCiXQ", "Are you losing $80,000 without realizing it? #shorts", "45000"],
    ["SQTWbt-kKsE", "#Ad Confused about individual stocks vs. ETFs? Here's what you need to understand about each one.", "7100"],
    ["eht9dn6fSxU", "#Ad Individual stocks vs. ETFs - here's what each approach is really like.", "5100"],
    ["FWfQ9gijE0U", "#Ad Individual stocks or ETFs? Here's how two different strategies could play out over 20 years.", "6700"],
    ["WLpuU7qtAp0", "the “Timer” hack 🤫 #lawyer #travel #money", "13000"],
    ["Djza8eomdVk", "What airlines don’t 🤫 want you to know #lawyer #fineprint #travel", "41000"],
    ["sjqUWiNswio", "2025 was the hardest year of my life. But still grateful for so many things", "120000"],
    ["_hbjvnEH2Ms", "#ad Travel hack: Skip roaming fees. Use Airalo eSIM from $2! Code ERIKA3 for $3 off. ✈️📱", "729000"],
    ["aZW6h5pzupg", "Skip airport lines! Free Global Entry for kids! ✈️✨ #TravelHacks #FamilyTravel #erikakullberg", "19000"],
    ["PT5hlOc9MS8", "Damaged baggage? Know your rights! 💼💥 #TravelHacks #KnowYourRights #ErikaKullberg #shorts", "45000"],
    ["u7stYJVCiuc", "🚨 Airlines changed their rules! 💵✈️ They could owe you more 💵 #travelhacks #personalfinance", "150000"],
    ["R-JgPewV8gs", "Go to Erika.com/T to join my free live travel secrets workshop ✈️ #shorts", "13000"],
    ["EITDVlPfT_E", "Airlines don’t want you to know this first-class hack… ✈️ 💰 #travel #personalfinance #erika #shorts", "31000"],
    ["844GgXrYOO8", "#AiraloPartner Save 20% on Airalo! Use code ERIKA20 at erika.com/airalo 🌍📱 #ExplorewithAiralo", "31000"],
    ["ESzpqTXj7dc", "How I got a $12K first-class ticket for 99.1% off 🤯 #travelhacks #luxurytravel #moneysmart #shorts", "50000"],
    ["gB0-a-m0Ir8", "Airlines don’t want you to know this first-class hack… ✈️💰 #travel #personalfinance #erika #shorts", "168000"],
    ["1sI9RvZ-X5E", "Go to Erika.com/secrets for my free travel secrets workshop. #shorts", "60000"],
    ["PUdwwFPTwxE", "Shop Hyundai on Amazon", "564000"],
    ["RM_dRuBMjRE", "Don’t throw out old Nikes—you could get a free replacement or a gift card! 🚨 #shorts", "84000"],
    ["OUD1is7maSI", "They don’t want you to know this about lifestyle inflation 🤯 #shorts", "1100000"],
    ["JR1Etnh1IbM", "You can get paid time off for anxiety & depression—without your employer even knowing why. 💰", "48000"],
    ["T-NVqNfA0ck", "Stop overpaying for baggage fees! Here’s a hack they don’t want you to know about. ✈️ #shorts", "59000"],
    ["eELSqRdZQsY", "Switch jobs, double your income. Most people settle for 3% raises—but you don’t have to 💼💰", "63000"],
    ["AATzni_1kkQ", "Airlines don’t want you to know this! ✈️ #TravelHacks #AirlineSecrets #MoneyTips #shorts", "125000"],
    ["wWOtqe_lynk", "Airlines don’t want you to know this family seating hack 🤯 #travelhack #moneytips #shorts", "247000"],
    ["X-UXdlAPmHQ", "12 years to pay off $400k debt? Is it worth it? 🤔 #doctor #studentloan #personalfinance #shorts", "1100000"],
    ["_LoUfW9qBqU", "The airline delayed your flight? They owe you $617 🤯 #travel #lawyer #shorts", "351000"],
    ["KCBKqtLOnEA", "They don’t want you to know how much waiting to invest is costing you 💸 #lawyer #investing #shorts", "41000"],
    ["ywKSrM3EYr0", "#LeaseEndPartner Do THIS with your car lease 🚗🤯🤫 #lawyer #erikataughtme #money", "47000"],
    ["cyd7eTl0yHc", "Are you losing $80,000 without realizing it? #shorts", "60000"],
    ["wGLLeVUAUBE", "The “Timer\" trick that pays off! ⏱️ #lawyer #travel #money #shorts", "75000"],
    ["X_VeaLAeHgA", "Don’t fall for the lifestyle inflation trap 🤯🤫 #shorts", "42000"],
    ["aXMXmjq8gF8", "When your raise doesn’t even counteract inflation 🤯🤫 #lawyer #erikataughtme﻿﻿﻿ #shorts", "92000"],
    ["Xhb4vfasZzE", "What airlines don’t want you to know 🤯🤫 #shorts", "59000"],
    ["5B6WkNlIlHA", "The mortgage trick to save money 🤯🤫 #lawyer #erikataughtme﻿﻿﻿ #shorts", "172000"],
    ["-qRWU0x_rfo", "What airlines don’t 🤫 want you to know #lawyer #fineprint #travel #shorts", "102000"],
    ["njVX44XM0QE", "I stopped buying these #lawyer #money #savingmoney #shorts", "57000"],
    ["H1i59llsBh0", "Investing from 25 vs 35 - guess the difference 🤯😱 #erikataughtme #lawyer #investing #shorts", "1200000"],
    ["xndUuUG9_S4", "How to negotiate your salary 💰 #lawyer #negotiation #erikataughtme #personalfinance #shorts", "338000"],
    ["TfNFRS7VuVQ", "Flight delayed or canceled? Here’s how to get what you're entitled to. 🎄✈️ #shorts", "35000"],
    ["arVdIvrpuzw", "How to get an extra seat for free 🤯🤫 #lawyer #erikataughtme #money #shorts", "91000"],
    ["dX8VC3KJYZA", "How to retire with $1 million 🤯🤫 #lawyer #erikataughtme #money", "162000"],
    ["vva5PGWejRE", "How to DOUBLE your salary 🤯🤫 #erikataughtme #lawyer #career", "1500000"],
    ["2L8YxxV3kpU", "Here’s why you should NEVER pay USD when abroad 🤯🤫 #lawyer #erikataughtme #money #shorts", "745000"],
    ["8TPQH1lNhYg", "Save $$$ on your next flight 🤯🤫 #lawyer #erikataughtme #money", "576000"],
    ["Fx2IQ9WiqXk", "Save $$$ on flights through this trick 🤫🤫🤯 #lawyer #erikataughtme #money", "87000"],
    ["89MRSKC9gxk", "Get money for your lost bag 🤯🤫 #lawyer #erikataughtme #money", "37000"],
    ["n1cfXUevYDs", "Return wedding ring for $$$ 🤯🤫 #lawyer #erikataughtme #money #shorts", "49000"],
  ],
  "Mark Tilbury": [
    ["6LLUnfFc53s", "How Banks Turn Your $10,000 Into $1,000,000 😳", "216000"],
    ["leomAgMr8rk", "You Won The Lottery, Now What?", "143000"],
    ["Axkw72JNxdk", "The BEST Financial Advice You’ll Hear Today!", "869000"],
    ["CRiUJKrsQA8", "How to turn $5 into $1,000,000", "1400000"],
    ["jZbu8Dw2_do", "Why ‘THEY’ want to BAN cash 😳", "1300000"],
    ["Hylse3lulsc", "5 JOBS That Will KEEP You POOR", "734000"],
    ["322xoMIt-7I", "Why MrBeast gives away Lambos (and not Ferrari’s)", "3600000"],
    ["AYyG9Af5Klo", "5 JOBS that will make you MILLIONAIRE", "1000000"],
    ["vf_OqekwNQY", "How Money Laundering Really Works 😅", "2600000"],
    ["hRmwUajWZws", "The Cost of a Formula 1 Car 😳", "1600000"],
    ["kLsMnkWUxwk", "Why RICH People HATE Ferrari 😳", "2000000"],
    ["sj-OhzyeSQY", "WHAT IF I GAVE YOU $100,000,000? 😳", "746000"],
    ["ed7xFYRCOa4", "Do THIS Every Time You Use an ATM (Common Scam)", "1700000"],
    ["lXgWeE3PBFs", "WARNING: Never Use This Credit Card", "723000"],
    ["6YyLAPLHG0E", "I’m 58. If you’re in your 20s watch this.", "805000"],
    ["Z1MGRCiGcrM", "How can an iPhone make you a millionaire?", "754000"],
    ["rUwUh9tvtj4", "WARNING: Never Use Your Debit Card", "2900000"],
    ["gJ4Q2zGO0Rg", "HOW REAL MILLIONAIRES ROLL (in London)", "1300000"],
    ["GoO54Q_hwjc", "WHY GIFT CARDS KEEP YOU POOR", "8300000"],
    ["UJ3FX6TjvJw", "5 EXTREMELY IMPORTANT RULES for your 20s", "1200000"],
    ["KBOjOTyVK4k", "Do THIS To Get Hired In Any Job Interview", "1000000"],
    ["zc7F-CcZj0Y", "How to PROPERLY Use a Credit Card", "3800000"],
    ["IRqFCF3Yp4s", "The 3 WORST Businesses", "1800000"],
    ["qu6xmPvsWZQ", "WHY MOST PEOPLE ARE POOR", "2600000"],
    ["OeKKIxIqQQY", "HOW BANKS KEEP YOU POOR", "1300000"],
    ["E_ZIRoEnlKw", "Do THIS to Win in Life", "920000"],
    ["tfrSy6sfP4E", "Why You Don’t Need $10,000", "1600000"],
    ["JEy2Nd1TpPc", "I Spent $100 On Lottery Tickets and WON", "4500000"],
    ["I_KbSAB0Tko", "RENTING VS BUYING (what’s better?)", "3600000"],
    ["nlErbtMGB48", "Do These 5 Things To Get RICH 💰", "1400000"],
    ["FIdnR2Vcf3o", "What if everyone got $1 billion? 😳", "16000000"],
    ["3TpM-rfxuFU", "Why ‘they’ want to BAN cash 😳", "11000000"],
    ["DfEVBTRjLRg", "HOW BRANDS MANIPULATE YOU", "1100000"],
    ["z6GgAODb8Cw", "How Fast Celebrities Make $1 Million 😳", "1100000"],
    ["F_1g0jALLJE", "HOW COSTCO IS TRICKING YOU", "6000000"],
    ["N9rUrza9_J8", "Why You’ll Never Be Rich", "3200000"],
    ["lGXe_zX3CmU", "What Things Cost 100 Years Ago 😳", "1000000"],
    ["GST4EmuudJo", "THE ONLY 5 ACCOUNTS YOU'LL EVER NEED", "1700000"],
    ["Mod73xKUHCU", "What Costs More, Raising A Child Or These Things?!", "6800000"],
    ["lXBtU0uYOXI", "$1 to $1 Sextillion 😅", "18000000"],
    ["XqwM0RESuwI", "HIGH-PAYING Remote Jobs Without a Degree 🤑", "1700000"],
    ["EqB0MNwSfXs", "How Long Does It Take For These Companies To Make $1 Million?", "11000000"],
    ["ALOM73Kej7Y", "5 EXTREMELY IMPORTANT BOOKS for your 20s", "4100000"],
    ["Y913RdUvhFI", "MILLIONAIRE CAUGHT NOT TIPPING 😅", "1800000"],
    ["g9xYm4Zuvk0", "How Quickly Can You Spend A Trillion Dollars?", "4700000"],
    ["QpORH6NsCLk", "How Much McDonalds Employees Make 😳", "2200000"],
    ["McewsayhivY", "Costco’s DIRTY Secret 😳", "8400000"],
    ["MptPhNyLA5I", "How Much Costco Employees Make! 😳", "12000000"],
    ["-ob_6t8EygU", "Asking a Millionaire How To Invest 🤑", "3400000"],
    ["ipBdfN7LlJ4", "5 Secret Costco Money Hacks 🛒 🤫", "3400000"],
  ],
  "Humphrey Yang": [
    ["B5rAAG9up8c", "3 ETF’s That Took Me From $10K to $100K by 30.", "44000"],
    ["sKDXKVvh9M8", "The difference between 14K vs 24K Gold (and 18K)", "30000"],
    ["C8WwUyPbJWo", "How Much Income You Need To Qualify For a $400,000 Home", "44000"],
    ["niE9qiLY5nQ", "How Much House Can You Afford?", "43000"],
    ["0L0VM34nmTY", "How to Pay Off Your Mortgage Faster", "106000"],
    ["nmX5s9Ph3Og", "Share Prices do NOT equal Market Cap: A Quick Stock Market Lesson", "86000"],
    ["3FfBcCf9pwg", "Should You Pay Off Your Mortgage Early or Invest Instead?", "78000"],
    ["EJKhR3FfZlQ", "The Biggest Car Payment Trap No One Talks About: Long Loan Terms", "129000"],
    ["XPPuaksFmdM", "How My Dad's Upbringing Affected My Mindset on Money", "231000"],
    ["ihu0KSJAff0", "ETFs vs Mutual Funds: What are the differences?", "129000"],
    ["0LprsBrwXRo", "How Long Should You Keep Your Car? My thoughts 💭", "2000000"],
    ["_ib3IruiS7Y", "Average Income by Age in 2026! Where do you stand?", "57000"],
    ["h2bblp5j3fU", "What is your time ACTUALLY worth?", "38000"],
    ["BniuxGMGGZY", "VOO vs SPY vs IVV: Which S&P 500 ETF should you choose?", "671000"],
    ["2z0DQMMrIJ8", "How Much Car Can You Actually Afford?", "56000"],
    ["JpdMo0qMs6g", "An Important Stock Market Lesson...  👀", "230000"],
    ["B_Xns_eQD_k", "How to Invest $1000 (As a Beginner)", "135000"],
    ["f4N6Yja4JcI", "3 Things To Do Financially in 2026!", "366000"],
    ["5cCJq4ybul4", "3 Things You Must Do When You Get Paid! #bank #personalfinance #affiliate #emergencyfund", "53000"],
    ["7lxVsdjc26I", "How Much Rent Can You Afford? (Comfortably)", "101000"],
    ["Zvu9jePPXA4", "Investing isn't as risky as you think (Here's the Data)", "68000"],
    ["3ecHqrdCE9s", "Recession Headlines Appear Every Year. Should You Listen?", "95000"],
    ["tWsFLnzbpZU", "Selling My 2nd Costco Gold Bar 7 Months Later 👀", "580000"],
    ["Mky8JxPcGxU", "Once You Get Money, Upgrade These 5 Things ASAP", "215000"],
    ["1YWpfwlzLJ4", "The Most and Least Stolen Cars according to Consumer Reports", "451000"],
    ["_waiTKEop9c", "How much should you keep in your checking account? Use this framework!", "202000"],
    ["cqYos8yvuyU", "Taking a Zoox self driving car with Shelby Church! Here's our experience", "53000"],
    ["aatq0k2MZ3U", "The Federal Reserve Cut Rates by 0.25% Today. Do These 3 Things Immediately.", "260000"],
    ["xUeiZ-J48-k", "How Gold Scraps are Melted And Sold (Scraps are from Witter Coin)", "315000"],
    ["hf5cIRkJlmk", "4 Signs You're Richer Than You Think", "159000"],
    ["Xv2F0YALvxQ", "4 Things Broke People Buy, That The Wealthy Don’t:", "207000"],
    ["-l_u_qAyxPc", "4 More Signs You're Living Below Your Means", "61000"],
    ["sT9okKEtoYs", "4 Signs You're Living Below Your Means", "127000"],
    ["6EDOgQdOQss", "Explaining Netflix's 10:1 Stock Split Today", "2800000"],
    ["nFVAmP96lYg", "Pepsi is a Dividend King: A Very Rare Stock Indeed", "1800000"],
    ["obWQh0M_BYM", "4 Things To Do Financially Before 2025 Ends", "37000"],
    ["fpkJWmbCQCI", "The Median Age Of First Time Homebuyers is Now 40 Years Old...", "33000"],
    ["40760KSC-gw", "$250,000 is HALFWAY to $1 Million Dollars", "137000"],
    ["3hpPt6VqvwU", "Think Deeper and try Claude yourself for financial planning scenarios! Link in description.", "27000"],
    ["G0XDVinVI0g", "A Jaw Dropping Money Stat 🤯", "633000"],
    ["7w6v3NKPzeI", "Part 1: I went to a Gold Factory in Switzerland. Subscribe for Part 2!", "8500000"],
    ["rM2_yPNgXRA", "How much are these Gold Items Worth? The price per ounce of Gold is soaring right now!", "102000"],
    ["KdhT6KEDWhE", "Claude can help you with the deepest problems. Check the description to try it yourself.", "27000"],
    ["o5FUISn4UNc", "The Federal Reserve Just Cut Rates. 3 Things To Do Now.", "140000"],
    ["LfCNsgvLFlw", "Why You Shouldn't Try to \"Time The Market\"", "57000"],
    ["frH40SkT8Rw", "3 Financial Moves To Make Before 2025 Ends...", "124000"],
    ["SiZ8E5fAtkg", "How much Apple Stock would you need to get an iPhone 17 paid for with Dividends?", "769000"],
    ["6nGGHe2HMaE", "Selling My 10 Ounce Silver Bar  👀", "19000000"],
    ["HIJmhQWv-ws", "Girl Math... Explained!", "66000"],
    ["QCe9TmAc4uI", "The American Express Platinum Increased Annual Fee of $895: Is it Worth It?", "74000"],
  ],
  "How Money Works": [
    ["oQBssOH06Hg", "Amazon Is Being Sued Over Donkey Meat", "81000"],
    ["HG2KQJExaYI", "How The Richest Chef in The World Made $45 Million By leaving Google - How Money Works #shorts", "92000"],
    ["C-t6J1JQIJI", "Billionaires Who Made The Most In 2022 - How Money Works #shorts", "65000"],
    ["t7RfpgS1I8Q", "Billionaires That Lost The Most In 2022 - How Money Works #shorts", "65000"],
    ["_Kim7DP1T0k", "Where Did SBF Get $250 MILLION To Pay Bail? - How Money Works #shorts", "66000"],
    ["YKncyvxbwAU", "The Green Energy Initiative That Bankrupted A Government - How Money Works #shorts", "42000"],
    ["pgLnmXeVKKk", "How the British Military Was Outsmarted By A Bunch Of Farmers - How Money Works #shorts", "1300000"],
    ["yyJ4BbKSyUc", "How This Man Used A Dumb Government Program to Make $3,000 In One Weekend - How Money Works #shorts", "2900000"],
    ["lzlDkN4qH4Q", "These Children Become Multi-Millionaires The Day They Turn 18 - How Money Works #shorts", "1300000"],
    ["RZ-lREhozXU", "Wall Street Bankers Got a $2 Billion Fine For Using Private Messaging Apps - How Money Works #shorts", "52000"],
    ["URdoFaDKO5c", "How £760,000,000 Was Stolen From a Single Delivery Driver - How Money Works #shorts", "163000"],
    ["kFkpX3ecYQc", "How Wall Street Is Betting on Musk's Twitter Takeover - How Money Works #shorts", "55000"],
    ["6IaBV2I-XYA", "Goldman Sachs Is Not Looking Good - How Money Works #shorts", "197000"],
    ["MKTdnCetDRo", "Why Bill Gates Has More Invested In Apple Than Microsoft - How Money Works #shorts", "1000000"],
    ["1mDNMCkOxnA", "The Richest 9-5 Employee Ever is Kind of A Weirdo - How Money Works #shorts", "1100000"],
    ["zMBlWMix3Us", "The Pokémon Company Is Trying To Crash Its Own Trading Card Market - How Money Works #shorts", "54000"],
    ["-8kD35RCn1A", "Why Is The Wall Street Journal Trying To Become an Ecommerce Platform? - How Money Works #shorts", "33000"],
    ["hTM0eNWnRUA", "Bezos Chose This Man To Save Amazon - How Money Works #shorts", "59000"],
    ["_oC2cR4GjyU", "35% Of People Earning Over $250,000 Are Broke - How Money Works #shorts", "182000"],
    ["WxVnaGdRDsA", "Buzzfeed's IPO Was A Disaster (The Reasons Won't Shock You) - How Money Works #Shorts", "197000"],
    ["3MYBeaJAGHk", "Why Richard Branson's Virgin Hyperloop is Failing Fast - How Money Works #Shorts", "66000"],
    ["TwAESVv2jUg", "The IRS Just Had Its Best Year Ever Thanks To MEME Stocks & Crypto - How Money Works #Shorts", "65000"],
    ["PxotVwknm-U", "Why The Treasury Is Giving Away Massive Returns That Are \"Risk Free\" - How Money Works #Short", "47000"],
    ["ay1qLKAp2EI", "Why Walmart Truckers Are Earning More Than Goldman Sachs Analysts - How Money Works #Shorts", "1900000"],
    ["98M_o0ODxWg", "Facebook Tried To Blame Its Own Misinformation On TikTok (It Backfired) - How Money Works #Shorts", "42000"],
    ["wHUatIPjQoc", "IRS Auditors Are Getting... Audited? - How Money Works #Shorts", "134000"],
    ["4Q0PV51MivU", "How A $1.9 Billion Deal Was Stopped By Regular Printer Paper - How Money Works #Shorts", "60000"],
    ["HBm_fa36dRA", "Why Don't Hedge Fund Managers Just Invest Their Own Money? - How Money Works #Shorts", "96000"],
    ["wc3qri_D-1w", "JP Morgan Chase is Suing Tesla For $162 Million Because Elon Made a Bad Joke #Shorts", "1100000"],
    ["45d4FImzs4g", "How This Man Used His American Express To Make an Infinite Money Machine (Tax Free) - #Shorts", "3500000"],
    ["GA9veC0VvCU", "Why Is Every Book A New York Times Best Seller? - How Money Works #Shorts", "842000"],
    ["HEHuGcsGk9A", "Some American Stocks Are Trading More Than Entire European Markets (That's Bad) - #Shorts", "119000"],
    ["jCV32N2H09M", "The World is Running Out of Investment Bankers - How Money Works #Shorts", "145000"],
    ["NR-aK67NBtc", "Why Coinbase is in Trouble Over the Definition of a \"Currency\" - How Money Works #Shorts", "77000"],
    ["tm_GrRTBkhk", "How Tutors Caused The Trillion Dollar Market Crash in China - How Money Works #Shorts", "337000"],
    ["lER_aNgS7s0", "Do YouTubers Still Make Money If You Skip The Ads? - How Money Works #Shorts", "4400000"],
    ["mSfkBTo7kwc", "Investment Banks Are NOT Banks & They Don't Invest Either - How Money Works #Shorts", "210000"],
    ["gZgLXJyNhqo", "The Myth of \"Artificial Scarcity\" In the Diamond Market - How Money Works", "157000"],
    ["CNiwsdDxaLs", "How Are Swiss Citizens So Rich Without Owning Homes? - How Money Works #Shorts", "2000000"],
    ["jJ0i4JxY-tE", "How This Vandal Made $200 Million by Spray Painting An Office Building - How Money Works #Shorts", "5400000"],
    ["GRnW47i36WQ", "How Many Stocks Are Listed in the S&P 500? - Hint: It's Not 500 - How Money Works #Shorts", "85000"],
    ["Unk0CeyMBXM", "Why is Amazon Dumping Millions Worth of Stock? Why Not Just Sell It All? - How Money Works #Short", "2600000"],
    ["2tt-j4BLnkA", "How Options Contracts Were First Created 2,600 Years Ago - How Money Works #Shorts", "38000"],
    ["zmqFfelPHT8", "Why Is This Failing Deli Worth $100 Million? - How Money Works #Shorts", "99000"],
    ["1TgrZsZRMfY", "How To Insider Trade Like the Best In the Business - How Money Works #Short", "105000"],
    ["1OFJM4STSpI", "How To Buy a Bank for $1 - How Money Works #Shorts", "69000"],
    ["JobSUJXK9J0", "How The Rich Never Need to Pay Tax - How Money Works - #Shorts", "290000"],
    ["v2j9Z8F-jLw", "How Insider Trading is Conducted \"Legally\" - How Money Works #Shorts", "224000"],
    ["xUpGhkYjpSo", "How to Get Rich By Starting A Charity - How Money Works #Shorts", "176000"],
    ["6ejgRs-cFo0", "Why Does Goldman Sachs Have its Own Programming Language? - How Money Works #Shorts", "114000"],
  ],
  "Vincent Chan": [
    ["CtRu8h-aR3Y", "My favorite 3 index funds", "1900"],
    ["Ufx-e2uEVKU", "Why you SHOULD NOT invest", "3700"],
    ["zpXzoxRelic", "Which stage do you feel like you’re in right now: 1, 2, or 3?", "3200"],
    ["vN0W6pJidvE", "Index Fund Explained For Beginners", "2600"],
    ["FcHDetl6nlE", "Index Fund Explained For Beginners", "6500"],
    ["BXfbvhyFym4", "How much you should invest as beginner", "7900"],
    ["_X_wHHIvzsg", "2 ways your money grows in the stock market", "5000"],
    ["9TMfEN1LyYQ", "My 3 favorite investments in my 20s and 30s", "7500"],
    ["OSabr2WLzdc", "How to be financially successful in your 30s and 40s", "3900"],
    ["cSmfE3r3SGY", "Why EVERYTHING changes after $25k (4/6)", "10000"],
    ["Pq6nk2loEgA", "Things i stopped buying", "19000"],
    ["mY2XyE5kG3E", "#Sponsored Buy on Amazon! Use products only as directed.", "2600000"],
    ["kNOa4ITLHZw", "Things i stopped buying", "16000"],
    ["ZLPi7ivvo7k", "Things I stopped buying", "23000"],
    ["zRIrgr3ncJI", "Avoid losing money!", "4000"],
    ["M_pvh3lUv8I", "Stop Saving", "11000"],
    ["30c9yOH7l6Y", "3 Investment accounts", "12000"],
    ["GWSOC7m5eBk", "Why Inflation is good for you", "7200"],
    ["vQmcdqk7BiI", "Things i stopped buying", "11000"],
    ["fTjaNsj6Atg", "How I'm using other people's money to build wealth", "10000"],
    ["sbdZqMAfRlg", "Things I stopped buying", "13000"],
    ["JsZP5EdfC0M", "This never made sense to me", "4700"],
    ["pa5wG4bgvk8", "Things to avoid if you want to be rich", "5200"],
    ["qYA-I2fV924", "Interest rates and home prices (What people get wrong)", "5000"],
    ["16yalvFYBQQ", "Things I stopped buying (3/9)", "6700"],
    ["kkyuD1eWz0E", "I bought a house in NYC", "14000"],
    ["zT5ZwfFwNY0", "Things I stopped buying (2/9)", "5100"],
    ["64GerPygJ9w", "Set it once, save forever #moneyhacks #automation #wealth", "5900"],
    ["u216AbXJcUY", "Avoid doing this", "6500"],
    ["Uy3CcjBvPo4", "Things i stopped buying (1/9)", "14000"],
    ["qCf3G3Cg-V0", "Tax hack", "19000"],
    ["PPEe7KLJZqs", "Millionaires and coupons", "18000"],
    ["o9CijHNn5tM", "Money and guessing games", "5500"],
    ["yd6Eg49di44", "Stop falling for this", "32000"],
    ["MfTB9RGUkSo", "The worst money mistake", "20000"],
    ["UQyuEVcG5M8", "The biggest wealth killer", "13000"],
    ["KOA_oZ20_8I", "Invisible spending", "21000"],
    ["85IhVqB0huw", "Frugal vs cheap", "89000"],
    ["N3KyWZNz_aM", "Ask yourself this", "28000"],
    ["I60TCuFhxzU", "The mindset that changes everything financially #money #mindset #wealth", "20000"],
    ["zfPdecqA-ms", "Free $50 DoorDash Gift Card", "3900"],
    ["8AR0wz5sR3g", "Small vs big pot", "10000"],
    ["21hsnw2oy84", "Free $50 Starbucks Giftcard", "7100"],
    ["lA048vQj_AE", "How to invest 1k", "27000"],
    ["VvXVDGc9o-o", "Can you clock this?", "51000"],
    ["FlWmmNANZDo", "list of my favorite HYSAs", "28000"],
    ["WPkY8UmKdfg", "Free $50 Apple Gift Card", "10000"],
    ["hDmd9BdmX_0", "3 Worst Insurance Company", "8100"],
    ["5cEwR4ElfS8", "The easiest, lowest-effort ways to wealth", "34000"],
    ["TpWQEYNBeb8", "How to not waster your evenings after work", "42000"],
  ],
  "Patrick Boyle": [
    ["dMajzHMU4Sg", "The FTX Collapse in One Minute #shorts", "337000"],
    ["MjJKGPgPvvw", "Teslabot Unveiling #shorts", "65000"],
    ["DTqGX2X_iBE", "Warren Buffett Hates Bankers!", "211000"],
    ["39X3pnrwNa8", "How Renaissance Used Options To Dodge Taxes #Shorts", "215000"],
    ["DyClYlUnidc", "Chinese Variable Interest Entities #Shorts", "130000"],
    ["ABe1XThMvYI", "Companies Complain About Robinhood Stock Giveaway  #Shorts", "129000"],
    ["A1fe3TB0PwE", "Why Do Investors Care About The Jackson Hole Economic Symposium? #Shorts", "117000"],
  ],
  "Caleb Hammer": [
    ["ls02DfN9DzU", "Real Estate Agent Made $40k in First Year", "363000"],
    ["FIpoEytBAvE", "Narcissist Husband Blames Wife For HIS DEBT", "467000"],
    ["KUaGn-9xMCA", "Making $90k a Year and Can't Afford Insurance", "368000"],
    ["PA1sLibJke4", "Parents Will Be Absent From Son's Life", "255000"],
    ["sHD0DWUCGK4", "It's Time To Cancel The Fat Acceptance Movement", "857000"],
    ["q-H10scH_hc", "This Side Hustle Makes $15k Per Month", "728000"],
    ["x_wixAVFQh4", "How Much Money Stock Traders Make", "557000"],
    ["acYNRH-FJkw", "This Side Hustle Makes $1 Million Per Month", "158000"],
    ["kxqqZUavlxo", "I Interviewed MULAN", "208000"],
    ["LVTHXTSOCIo", "I Interviewed a PSYCHIC", "258000"],
    ["AYoKllmTGYw", "Locksmiths Make $200 an Hour", "915000"],
    ["-BH1-wPGgWQ", "Financial Audit Guest Makes $2 Million PER MONTH", "890000"],
    ["XkhWX2AFIqo", "Landlord Refuses to Rent to Women", "529000"],
    ["xoZHgYXQPrI", "TOP 5 HIGHEST PAYING JOBS", "607000"],
    ["QNL6RkhsxVE", "Financial Audit Guest Brings Me TAQUITOS", "1700000"],
    ["y75ZDcCdwJw", "This Side Hustle Pays $250 an Hour", "1000000"],
    ["_79WaF1e_So", "How Much Money Twitch Streamers Make", "1400000"],
    ["7e6njtSfZfk", "Couple Makes $300k a Year!", "1700000"],
    ["4rDzj-Lh1hA", "Wife Divorced Me Because I Don't Make Enough Money", "994000"],
    ["v9LtplYwpnA", "Thick Latina Financial Audit", "1400000"],
    ["oOJ_Ed3AiOI", "He Makes $100k a Year Working in The Oil Field!", "2600000"],
    ["aYlzCNBir-M", "Spending $50,000 For A Twilight Wedding", "370000"],
    ["J4PJ9maSSak", "How Much Money Funeral Directors Make", "1000000"],
    ["K2DwdPZgGVI", "Couple Breaks Up During Financial Audit", "1500000"],
    ["4PlV_mcruVI", "This Side Hustle Makes $9k Per Month", "1200000"],
    ["YM-QhaY4qBw", "Mother Will Be Absent From Son's Life", "1900000"],
    ["96kAn5G3ssc", "Husband Purchased Cars Behind Wife's Back", "1200000"],
    ["eVivF0oXSho", "Unemployed 31-Year-Old Man Still Lives With Mommy", "445000"],
    ["KMUdzLVpMsw", "She Spent Taxpayer Money on Disneyland", "878000"],
    ["-qlD4vGvBsc", "I Bought My Ex a $4,000 PC Then He Broke Up With Me", "434000"],
    ["MGt9ka8dHe0", "Couple is $90k in DEBT", "489000"],
    ["3J2SUqH1Ivc", "How Much Money Photographers Make", "418000"],
    ["kupq8xaYI3E", "How Much Money Stay-at-home Mothers Make", "820000"],
    ["evHql1DAIUI", "30% Interest Rate Car Loan on a NISSAN", "280000"],
    ["kyuPW38bQU0", "Boyfriend Tried Hiding These Purchases", "176000"],
    ["2cV38YHrdMw", "He Doesn't Deserve Her", "1400000"],
    ["ZCAjICPkk-0", "Boyfriend Takes Girlfriend For Granted", "234000"],
    ["11Aw7Tis1i4", "This Software Engineer Makes $200k Per Year!", "825000"],
    ["BIqM5LsCDBg", "Couple in Their 40s With $0 in Retirement", "863000"],
    ["dxZ_baXIGOo", "She Spent $7,000 on Labubus", "909000"],
    ["WCzDVpjZgNk", "How Much Money Tesla Employees Make", "1000000"],
    ["JtAFVGtSgbM", "Billie Eilish Financial Audit", "806000"],
    ["_uozGb_rvwU", "How Much Money Baristas Make", "1800000"],
    ["w5Uae-elngo", "How Much Money The Military Pays Part Time", "950000"],
    ["V-ixudMSRDU", "40-Year-Old is $350,000 in Debt", "993000"],
    ["XR_UfAQdEs0", "This Side Hustle Makes $4,000 Per Month", "105000"],
    ["uL86QTvUhwg", "Panda Express INVENTED Orange Chicken!", "770000"],
    ["ZB51v95_qK8", "This Side Hustle Makes $5k Per Month!", "2400000"],
    ["RgBUGZnoz2c", "She Financed $40 Chick-fil-A", "640000"],
    ["8Rk205BhIEA", "Her Boyfriend Finds Out", "1000000"],
  ],
  "Alex Hormozi": [
    ["tVoMl6oXBgU", "Which Life Would You Pick?", "10000"],
    ["VA23Lg7J4k8", "\"You Haven't Nailed Your Model\"", "67000"],
    ["1gKe4t7qy3o", "We Dominated The Gym Industry With This", "61000"],
    ["jTn9bzRDfJ8", "Your Business Can't Be Unbalanced", "36000"],
    ["YhSdZTlOzqY", "Sell Stuff People Don't Stop Buying", "84000"],
    ["L_4Stkl_Bw0", "This Is How I Make 750 Ads", "94000"],
    ["BOFU4yMod9I", "Does Raising Capital Make Sense?", "34000"],
    ["P3Frryj16tk", "You Need Data", "72000"],
    ["vNHLOUjwNww", "What I Would Do To Go From $0 To $1M In 2026", "210000"],
    ["ir3ATIsg0VM", "The 2 Types Of Problem-Solving", "124000"],
    ["-nL5pd-hxz4", "Bad VS Good Email Marketing", "54000"],
    ["HEylgw2AH28", "What Do You Need To Scale A Business?", "42000"],
    ["caS7LgKqkMc", "50% Of U.S. Businesses Don't Make Money", "82000"],
    ["0BNSyDJFowo", "The Toughest Decision I Ever Made", "83000"],
    ["-WonbL_Ia9U", "You're Probably Underpriced", "61000"],
    ["tQQnk8Flkm0", "Levels Of A CEO From $100K To $100M", "125000"],
    ["u-XfOFp6KDM", "What's The Most Important Part Of A Business?", "106000"],
    ["3fN57Kkhwd4", "Just Make A Decision", "80000"],
    ["uOTWtWiSL_s", "This Is How I Make My Money", "161000"],
    ["nMHvDZa-vZw", "Why Your Competitors Are Beating You..", "57000"],
    ["UdSmFXevg3s", "Rating Productivity Hacks", "209000"],
    ["jihPiZRmtk0", "Big Problems Pay Well", "115000"],
    ["91z4YtppWjQ", "Business Books Tier List", "356000"],
    ["mTlAtSnLdgc", "What You Like VS What You Need", "43000"],
    ["7_NOrSBIYG0", "We Make Our Landing Pages Like This", "120000"],
    ["EUTjEZWmU1E", "\"You Already Have A Valuable Business..\"", "462000"],
    ["3w-xVGpCSWU", "My Founder Story", "132000"],
    ["TK5z1WTK9TY", "This Is Why Paid Ads Crush", "85000"],
    ["2DIQmRw5DaA", "The Best Closers Gets The Best Leads", "78000"],
    ["Pzs0d2gCt98", "Reversing Lifestyle Creep", "96000"],
    ["KcDygTUGvvU", "When It Gets Easy Is When You Go Hard", "182000"],
    ["EUAlLId7MW8", "My Most Controversial Tweets", "63000"],
    ["HQ_lBMJqGLE", "Does Success Create Pressure?", "38000"],
    ["xHKxYbxZ758", "How Do You Prove Loyalty?", "40000"],
    ["GQBJd2zSZtk", "The Ultimate Hack For Life", "137000"],
    ["tOICv4xayFk", "Do This When You Don't Know What To Do", "153000"],
    ["dKhx8HtYtC0", "You Need More Active Income", "159000"],
    ["jnYVXLGoZk8", "Make It 5X As Expensive", "103000"],
    ["2Zj2YA1k8e4", "My Favorite Service Business To Start", "193000"],
    ["QWZeNBw8Glc", "Hire 1 To Hire 10", "87000"],
    ["Si3wvcFr7vg", "A Big Money Mistake I See People Make", "140000"],
    ["Xa0BJYvRKtI", "Delete Shame To Change Your Life", "72000"],
    ["remIjeS3EkA", "Ranking The Fastest Business Types To Grow", "185000"],
    ["KIs4jM1Wf6I", "Your Prices Are Too Low", "178000"],
    ["BzmpcWKHyNs", "The Most Important Thing When Advertising?", "76000"],
    ["0C11AZPvKTc", "I Did 100 Math Problems A Day For 4 Months", "135000"],
    ["J78a_09Nd1c", "The Point Of Losing Is To Avoid It", "221000"],
    ["a4QjgIwRXNY", "Just Raise Your Price", "107000"],
    ["KvY-0X6Zx1k", "This Costs You $950K A Year", "131000"],
    ["Xu2IoA5Fp7Q", "How To Balance Duty And Enjoyment?", "28000"],
  ],
  "Codie Sanchez": [
    ["YqAFDg1VphU", "How clarity creates momentum", "7900"],
    ["R6Zbzg5s9EQ", "Know where to grab the deal", "10000"],
    ["1-FR1I87l4w", "Change needs a deadline.", "18000"],
    ["FAXR1__Gr_E", "Quietly one of the smartest business moves in entertainment lately.", "124000"],
    ["I36gGNjQ7Eo", "Elite Thinkers Correct Faster", "25000"],
    ["Kn0BfCtU8UA", "The 5 Numbers Before You Quit", "37000"],
    ["UrIVj1WxPd4", "Learn AI in one afternoon.", "25000"],
    ["K-HB-ZbYWiM", "Decide on a Deal in 5 Minutes", "30000"],
    ["HK0bT4yKj5I", "Your moat is higher prices.", "28000"],
    ["Yn7DMNY2lkg", "How To Eliminate Weakness?", "20000"],
    ["o1hs-TFUZeI", "Protect your partner. Always.", "38000"],
    ["BnR2t3COXWw", "Build a faster money vehicle.", "95000"],
    ["JcQJI-SHR14", "High income isn’t freedom.", "50000"],
    ["HuOQBzlyc-8", "Thank your past self today.", "78000"],
    ["SjEr_sjAY2w", "The Rules in America 2.0", "27000"],
    ["X9Lx1Yp3BwI", "Stop whispering your wishes and start shouting your intentions.", "27000"],
    ["yOF5KdkuY94", "Outgrow them with results.", "9900"],
    ["5ohJJEKyu_4", "Buy a House or Invest Instead?", "81000"],
    ["87k9sULcbU0", "Solve Rich Problems, Get Paid", "38000"],
    ["zYYf-Vw0HG0", "Look the part, win more deals", "73000"],
    ["Mod-6NGxQbM", "Your 20s Build the Base", "17000"],
    ["n69Zq_1nlPs", "Scale Is Math, Not Hustle", "53000"],
    ["EHqaVZKAuJo", "Divas or Just Elite?", "35000"],
    ["FwXMr9IP2EM", "Patrick Mahomes’ Business Strategy", "28000"],
    ["mxQotvyQmWs", "Selling to the private economy.", "72000"],
    ["MbosdItHMHw", "The Remote vs Office Math", "17000"],
    ["3We8BioV3nE", "Hard days are still a privilege.", "30000"],
    ["Izxhu0XPYt4", "Not all capital is the same!", "32000"],
    ["GKihSSbezQM", "The 6-Word Email Rule", "37000"],
    ["3GjG-D31ACg", "This AI side hustle shouldn’t have worked.", "77000"],
    ["EmWn7tEGrCE", "Why you’re stuck under $1M", "56000"],
    ["iqCDYXK6PhU", "5 Rules to Live By", "88000"],
    ["Sxv7azI4qng", "Gen Z Isn’t Broke", "52000"],
    ["7VSNzB4vFGk", "5 Rules CEO’s Live By", "55000"],
    ["WWFnB95l1D0", "Can Your Business Run Without You?", "33000"],
    ["1_eF5ngKEu4", "Cold offices, better work?", "38000"],
    ["RQU3XFUxDUw", "From Entrepreneur — to CEO", "89000"],
    ["G15681HOvMM", "59 Seconds to Steal My Sales Secret", "65000"],
    ["FT2mOAPYpRc", "The three most underrated businesses to buy in 2026.", "111000"],
    ["XqzmC_nU5SM", "7 terms to know to get ahead in business in 2026.", "97000"],
    ["8xtC__BKyfM", "Don’t start the New Year without leaving behind these money mistakes.", "84000"],
    ["nRj57QCw-co", "At Main Street Millionaire Live, I show you how to find, buy, and grow a biz that AI can’t touch", "65000"],
    ["ja1TCJHjXHk", "The 6 levels of wealth & how you can think about your next assets.", "113000"],
    ["qdD7S2AFhZc", "The three people you need to outwork to get free.", "47000"],
    ["iSk9B_UMKAQ", "Ready to be on Mariah-level in 2026?", "102000"],
    ["hRXezTKYKik", "There are 3 brutal truths about people you must accept immediately.", "66000"],
    ["aQu2mU1mIhI", "How tiny \"bids\" for connection can save your business.", "33000"],
    ["rdcMB2iYGw4", "How to buy profitable businesses at a discount.", "60000"],
    ["s2_5sxyDng8", "Get in the game and learn the investing levels of AI.", "53000"],
    ["8XaM3qez4SE", "Most failed acquisitions fail because the buyer didn’t understand the math.", "196000"],
  ],
  "Ahrefs": [
    ["F8RC7yUhBBU", "Why Most Marketing Content is Boring", "2200"],
    ["HlulHAsnnyQ", "The Website Traffic Hack People Are Too Lazy to Do", "3000"],
    ["iXUel633tAk", "The First Thing I’d Do to Get Traffic to a New Site", "9400"],
    ["ke-53zivOaw", "The Content Format AI Overviews Haven’t Taken Over Yet", "2300"],
    ["YOJupUEXUWA", "How Google AI Overviews are Boosting Conversions", "4500"],
    ["i8-pTvf15uM", "The Google Update No One Noticed", "10000"],
    ["SRMT6tR2aT0", "Proof that Fresh Content Boosts AI Rankings", "13000"],
    ["Dkemv18SwZQ", "How to Win Across AI Platforms", "5100"],
    ["w_ya5THCrk8", "Guess these shoe brands in Google AI Search - Win $100", "2500"],
    ["jr2d80RK8UY", "Rank these coffee brands in Google AI Search - Win $100", "3500"],
    ["RrXRe0Mof_8", "How ChatGPT Chooses Who to Recommend", "8400"],
    ["lxzWpUKw4Tg", "Rank these musicians in Google AI Search - Win $100", "2300"],
    ["2P_6cg7D__g", "Rank these fast food brands in Google AI search - Win $100", "2800"],
    ["8S4ewSQPs8s", "The #1 GEO Ranking Factor", "6500"],
    ["WHw9QSv5fhw", "Rank these Pop stars in Google AI search - Win $100", "3500"],
    ["D1GrspJRbAY", "Rank these browsers in Google AI search - Win $100", "6200"],
    ["HhliwuDoxkI", "Rank these car brands in Google AI search - Win $100", "6700"],
    ["rj1Vy7S80wc", "Rank these movies in Google AI Search - Win $100", "3000"],
    ["AVVuLprvmKg", "Why Everyone's Using ChatGPT the Wrong Way for SEO", "18000"],
    ["puoIIsszZdw", "I Tried to Rank #1 in Google in 24 Hours", "19000"],
    ["nuME3i9BRMA", "We used AI to Get 1 MILLION Visitors from Google", "43000"],
    ["nsxs1ExD8Lo", "The SEO hack we use to get 25k visits/month", "18000"],
  ],
  "Slidebean": [
    ["4iU9kfIZnhs", "The real test for humanoid robots isn’t performance.", "14000"],
    ["HWmEGKdCysI", "What prediction markets reveal about founder credibility", "19000"],
    ["8lUx_MqPjx4", "Why the next AI battle won’t be about models", "165000"],
    ["gcQ-PfoIqb8", "The most important question about AI no one agrees on", "21000"],
    ["KkapCicmKc4", "Why these three companies could redefine public markets", "8500"],
    ["ApRS7OjCvUU", "Why SpaceX’s Mars plan is on a clock", "12000"],
    ["xvxtJ9FO3OY", "Why banning deepfake apps isn’t working", "12000"],
    ["aJ8qF6Uk8zs", "Threads just passed X and the reason matters for founders.", "14000"],
    ["GBKOK_Iv5lw", "This startup went from pitch competition to diagnosing unborn babies in two years", "15000"],
    ["8M7cN26Y5qE", "Elon Musk is taking OpenAI to court", "21000"],
    ["fjOTjmm14_Y", "The same CEO is building AI and the chip to read your thoughts", "14000"],
    ["tN0XwQGkXL4", "Boston Dynamics just gave its robots Google’s brain.", "10000"],
    ["teVq80B_6UE", "AI isn’t just learning anymore, it’s teaching itself", "11000"],
    ["Y-Ee1Q1XETM", "Surveillance is becoming a two way mirror", "16000"],
    ["_tRxVWPOjAU", "The scariest hacks don’t steal data. They stop time.", "8700"],
    ["PN2rX1oZGb4", "Elon Musk helped make Tesla $3B richer", "23000"],
    ["QfdKXIJkXUo", "The internet’s most dangerous people aren’t hackers anymore", "10000"],
    ["Kym3MxjMQ3Q", "Elon Musk is worth $600 billion  but that number isn’t what you think", "67000"],
    ["EAN2l84mztM", "The real AI race isn’t software, it’s infrastructure.", "21000"],
    ["DnyQ4nt2NoU", "OpenAI wants to raise $100B in one round and that’s the least wild part", "52000"],
    ["Eev-qbLY478", "Why OpenAI’s child safety reports exploded 80×", "15000"],
    ["_qu2BnWiNvg", "Apple engineers are quietly fixing American factories, one bottleneck at a time", "108000"],
    ["Kbuifyz8_fI", "Why “$9 trillion markets” say more about storytelling than reality", "17000"],
    ["eAtHtxI5UY8", "Why real time deepfake tools represent a new phase of online fraud", "55000"],
    ["AalVehoakMs", "The border is becoming a drone network", "6500"],
    ["JrZDMNApIxU", "Stores now have to tell you when prices are personalized", "36000"],
    ["pCJsNpPgX18", "Instagram put Reels on TV because TV ads pay more", "7000"],
    ["RCWjhnSHwZU", "AI weapons failed a Navy test and that’s a big problem.", "18000"],
    ["xxtUUtU6jA4", "Meta is paying publishers to train the AI that may replace them.", "15000"],
    ["ojUCWqiXLiw", "Sanctions didn’t slow China’s AI. They changed how it wins", "27000"],
    ["EKapjLkVqbE", "Bitcoin miners found a better customer than Bitcoin", "277000"],
    ["3N0_9g3HOuA", "OpenAI just launched a model that charges more when it thinks harder.", "18000"],
    ["n7p05ZDPy4U", "Neuralink wants to upgrade a brain chip while it’s still in someone’s head.", "42000"],
    ["MFMP9vud8sY", "Google is trying AI glasses again. This time, they can’t afford to be weird.", "9600"],
    ["oMhMdPrPznA", "What happens when scientific research becomes entertainment?", "17000"],
    ["x03AFcu4sgk", "MrBeast’s next move turns audiences into owners", "34000"],
    ["lU8v3Xyu9JY", "Disney didn’t fight AI it bought into it.", "17000"],
    ["4GnNLN5wH8E", "Windows isn’t broken, it’s doing exactly what Microsoft wants.", "15000"],
    ["SnkdsEvQ8oM", "HP’s long term plan reveals what AI job loss really looks like", "15000"],
    ["DEFomC5dTbg", "Roblox’s CEO snapped when asked about child safety.", "15000"],
    ["S90SxOOnbjs", "AI + satellites just found a massive hidden lithium reserve.", "41000"],
    ["kEDYvNjZN2U", "The iPhone’s designer wants to replace the iPhone", "31000"],
    ["7d6Cf2L4kAI", "The U.S. is suing states for regulating AI, even though it has no AI laws", "10000"],
    ["69e6YI0YfQQ", "This AI knows if you’re balding, it just can’t say it out loud.", "11000"],
    ["z2y5KHAKShc", "A new AI model is challenging OpenAI by giving away its secrets.", "36000"],
    ["TaCPQh_FxJM", "A WhatsApp design flaw exposed identity data for 3.5 billion users", "31000"],
    ["j6l24CjN9xw", "AI’s biggest constraints are physical, not digital.", "38000"],
    ["ba2XuUEo1DI", "Elon’s new AI model is so big it literally doesn’t fit on Earth", "147000"],
    ["9C2bqNi1688", "Visa and Mastercard position stablecoins at the center of global payments", "22000"],
    ["X33e2ZGg9zw", "Europe makes the talent. America makes the trillionaires.", "112000"],
  ],
  "Kurzgesagt": [
    ["dwZgy7SNMRc", "The Virus We Almost Beat", "499000"],
    ["mWN2IefeJow", "The Lake That Killed a Village", "556000"],
    ["bRkxPsuVEeU", "Zombie Proteins in Your Brain!", "659000"],
    ["zg40FHOAqC0", "Jupiter Made Earth Possible", "1400000"],
    ["OU36JDGzXb0", "Planets Around Black Holes", "1600000"],
    ["hDU9WcmQA2E", "Let’s Cook a Planet!", "2900000"],
    ["sravy3Vjdlw", "Nature’s Ultimate Impostor", "1100000"],
    ["UC5Mpc-GQCg", "The Moon’s Invisible Threat", "3300000"],
    ["1bQsvHqSfpU", "How to Destroy a Black Hole", "1300000"],
    ["T6tCY6SOSXo", "Does Legalizing Drugs Help?", "1800000"],
    ["omNvSHfIv7s", "Will Fungi Infect Us All?", "1800000"],
    ["fAkMppZZiSI", "How Big Is a Human Cube?", "1100000"],
    ["OxOx6--oN8I", "The Most Dangerous Animal", "1400000"],
    ["nDKHvoo4f-8", "You Are Everyone", "1400000"],
    ["pt0iG95Fsmc", "Let’s Cause a Country-Wide Blackout!", "889000"],
    ["Ghy3qRR6kiw", "Touchscreens – How Do They Work?", "1300000"],
    ["cE0zgN6pYOc", "Dig Deep, Power a City", "1500000"],
    ["ty0WVFjOkok", "What If Earth Suddenly Turned Into Gold?", "1900000"],
    ["mxG0ts7qmq0", "How to Bottle a Star", "1100000"],
    ["V7wlYQ2_Q8o", "This Is the Deadliest Virus on Earth", "2000000"],
    ["ByD__-ECSeI", "Can We Run on Renewables?", "583000"],
    ["XFODuRPv8Yw", "Our PC Game Is Finally Here!", "696000"],
    ["K1J9LNElrso", "What If a Massive Solar Storm Hits Earth?", "1800000"],
    ["LbARorLmhsc", "Would You Upload Your Mind?", "639000"],
    ["UNunBadMlHQ", "We Won’t Explore the Galaxy...", "1000000"],
    ["x7IrzHMxEMM", "POV: A Nuclear War Just Started", "3400000"],
    ["3D9uIn2oBLI", "Which One Are You?", "3100000"],
    ["IZ55YvFE960", "The 5 Times Life on Earth Almost Ended", "2500000"],
    ["xP2tHAXjZhI", "How many organs can YOU live without? Turns out: More than we thought.", "4700000"],
    ["rHQeg5EtqDQ", "Invisible Extinction From Space – Gamma Ray Bursts", "1100000"],
    ["2ukNLhC8N4Y", "Some Galaxies Move Faster Than the Speed of Light", "936000"],
    ["EJoJzLaIcEc", "How the Universe Might End", "2200000"],
    ["6TcFvx8ajD4", "Why Do Planets Rotate in a Disk?", "1400000"],
    ["Ce9kHZQk3MI", "Test Our PC Game – Star Birds Demo Out Now!", "561000"],
    ["o7aXV_PV4ss", "Dozens of Nukes Are Missing. Why? HOW?", "2700000"],
    ["kYOkrswU1KE", "Panic Attacks Explained in 60 Seconds", "1100000"],
    ["MDZ2iWN0ZSI", "Heat Affects Who Gets Born", "858000"],
    ["UjAJ2jKH_QM", "Why Do We Itch?", "6600000"],
    ["eGU9Bvl7VvQ", "Your Spacesuit Fails – What Now?", "2400000"],
    ["PHI07XtbfVA", "Bird Flu Simulator", "3300000"],
    ["joYJahY4FUI", "What If Continents and Oceans Switched Places?", "9100000"],
    ["FPZuklD9eRg", "How Radioactive Are Your Teeth?", "7600000"],
    ["XQQkHLW8b3Y", "How to Clean Up Space Debris", "1000000"],
    ["KmgRBiRMmAU", "What Falling in Love Does to You", "1400000"],
    ["RLEvo3I5C6w", "How Chicken Heads Stopped Rabies", "3700000"],
    ["UyUm3KEnZxE", "Are You a Machine?", "3200000"],
    ["oR3Q7RntqEw", "Whales Evolved from This Animal", "4700000"],
    ["0pyGPK3fG4U", "Your Brain Deletes Your Childhood Memories", "1700000"],
    ["mCAm38dSD78", "Lightning: Nature’s Plasma Highway", "2000000"],
    ["Pkbhn8sIWuw", "How EXACTLY Does Beaming Work?", "2400000"],
  ],
  "Nas Daily": [
    ["tQfhQvsuiwA", "the fastest way to make your first dollar online", "34000"],
    ["h099Cw-Pm_I", "WhatsApp is better than Email!", "57000"],
    ["AJbbLTQhjCM", "be careful of the 1 price trap", "61000"],
    ["jpBmRV1EK1A", "I built an AI that makes viral video ads", "91000"],
    ["zx56bFxTMxA", "why I’m wearing a suit in 2026", "119000"],
    ["k4UlBSTLpfo", "My summary of 2025", "191000"],
    ["8bDRgU_nK1w", "I found the king of dropshipping", "452000"],
    ["0HUFZuVGu2c", "why we water plants drip by drip", "452000"],
    ["5wMWKaEjcTU", "these rare schools give me hope", "164000"],
    ["5JN22Y_pMTo", "the impossible dinner", "374000"],
    ["97kNHVoNYSY", "the country with the fastest ambulances", "214000"],
    ["GGy3J5cCedo", "the billion dollar startup country", "169000"],
    ["WzWzgzft-GM", "let me show you my home", "151000"],
    ["Sm0549Zo7oc", "introducing lead forms", "209000"],
    ["rLabo4Rckbo", "Quit your job in 2026.", "140000"],
    ["KeAIYPawsyY", "the coffee billionaire of Thailand!", "581000"],
    ["XiHZEufUMIo", "The Most Generous Announcement", "227000"],
    ["0ut3dpYSRUw", "The best saleswoman in the world!", "584000"],
    ["z2Qzonfk5NM", "I saw the biggest energy event in the world", "397000"],
    ["_9ncCfm1Img", "The hottest building in the world", "913000"],
    ["XQwTanNFvyY", "This UAE solar plant works at night!", "511000"],
    ["GsAjUJAqYaw", "He's building the next San Francisco", "522000"],
    ["e3wufbwFZbs", "He invented LinkedIn!", "578000"],
    ["VWJ_sNpiUjg", "The Bitcoin Billionaire of Latin America", "367000"],
    ["PSiNCc0DUlI", "Introducing the 100 Customer Challenge!", "159000"],
    ["5pq4zMTdI9M", "There is time for war. And there is time for peace.", "310000"],
    ["-Te83U1COlk", "the luckiest students in the world.", "422000"],
    ["ePv8OSeZTGc", "I spent 40,000 dollars on an AI experiment", "717000"],
    ["jkKOCL7rA1Q", "where animals don’t die….", "584000"],
    ["usV_ixuyNaE", "where pen*s is not sexual....", "392000"],
    ["BG_S6Burvuw", "The most expensive visa in the world", "2600000"],
    ["TlFgRCbVhfo", "Most romantic country in the world!", "4400000"],
    ["qitcnvokK2I", "It's Day 100 out of 100!", "1000000"],
    ["d0N-o__lP8Y", "the ugly side of history", "1300000"],
    ["kimYtEBXn9M", "Non-violence is stronger than any army.", "9500000"],
    ["IF9p_qnyM5I", "the secret immigration of dust that keeps us alive", "766000"],
    ["WRt1rVAvJsk", "How can Muslims get to Heaven.", "1200000"],
    ["zG66WPwiv4Y", "why prophets leave their home.", "938000"],
    ["PRj3rKRpOo0", "The quietest disaster in the world", "2200000"],
    ["lSJHB6z6hiY", "the story of the empty boat.", "700000"],
    ["mtXnbWCq4go", "the story of the stone cutter.", "14000000"],
    ["Hr-NUUqtKjM", "He is the Cheapest Billionaire", "1300000"],
    ["BDLEEdS-xSc", "let’s go back to 1948", "574000"],
    ["URf84f714Ps", "we can’t kill billionaires….", "784000"],
    ["vBosTIyTtsg", "Why Japan loves broken stuff", "2600000"],
    ["v2b4a0YGYkA", "There was a 4th plane on 9/11…", "1600000"],
    ["yb8IksX5yas", "I brought my favorite philosopher back to life..", "424000"],
    ["sSp_U4fo9Qg", "if George Orwell saw us today, what would he say?", "570000"],
    ["5xv3ESutQl0", "He invented Chess... and became a billionaire", "4700000"],
    ["I2P7hDFme6s", "This man saved a billion lives", "738000"],
  ],
  "Ali Abdaal": [
    ["_AnPfMhkTUM", "5 years from now, today won't matter", "12000"],
    ["rkorr-tHPTM", "Feeling Lost? Try These Journaling Prompts", "23000"],
    ["XQjjlGpsuLY", "What would you do if you didn't care what people thought?", "15000"],
    ["M2M7tb2mTuM", "You don't need to be famous to get rich", "21000"],
    ["H0F7Sjve7mw", "The fastest way to get your first sale", "23000"],
    ["jHok7fJKzqA", "A friendly reminder...", "17000"],
    ["HYLLea-rrkc", "The top mistake people make in setting goals", "18000"],
    ["gR1F1lzwZpY", "If you find building a business hard, watch this", "22000"],
    ["l5Ppm1L1XEA", "The richest people I know do this", "83000"],
    ["cNZCYPtQZ8M", "3 Simple Questions To Find Your Business Idea", "19000"],
    ["WGprnys0nD0", "If I want to build a $100k a year business, I'd do this", "46000"],
    ["5AxEJHMiut4", "One of my favourite AI productivity desktop apps #ad", "29000"],
    ["DDzQTEiEOWk", "5 Productivity Apps I Use Every Day", "49000"],
    ["SEm1mNjIzVw", "Have a nice day :)", "125000"],
    ["svCFdavru9I", "3 Money Tips You Didn't Learn in School", "61000"],
    ["kCi6eP7MiXI", "How to show up energised when you're completely drained", "31000"],
    ["ANxV-2ex10w", "Instant gratification can be good for you", "22000"],
    ["jLfG7kBBIu4", "Your feelings don't control your actions", "50000"],
    ["c6ila1QDDLo", "The best email app to level up your work #ad", "27000"],
    ["GOQEBQdxfdc", "The simplest path to wealth", "85000"],
    ["sKzrq62LjQM", "The 4 Levels of Productivity", "28000"],
    ["kreFO3uM7Xc", "I like to set goals but don't follow through", "37000"],
    ["hYjCtQqIzbQ", "This $10 book made me $2 million", "103000"],
    ["RtXOwd2QftA", "3 ways to get customers", "16000"],
    ["Nb9BSLGXk5U", "What to do if you fail", "23000"],
    ["zSCPdqtzFi8", "How to set achievable goals", "14000"],
    ["OvPKkal78c4", "My favourite email app #ad", "16000"],
    ["YfQaj7Izavg", "5 books I'm reading this month", "100000"],
    ["qryrrf-WSEc", "These are the types of burnout", "23000"],
    ["x--PxxlkLTc", "The responsibility shift that changed everything", "48000"],
    ["rmW4rFTrRyM", "Should you leave money on the table?", "23000"],
    ["A_-AOQk300I", "The simple trick to achieve your goals", "29000"],
    ["ijqhSt-8eq0", "The goal setting trick that actually works", "33000"],
    ["P2Ct8P2etAc", "Should you build a side hustle in 2026?", "37000"],
    ["thppgFlGU6s", "This is actually why you can't focus", "18000"],
    ["zFe63nnphWc", "The paperback edition of Feel-Good Productivity just dropped", "18000"],
    ["JBSb3NZVLG8", "How to stay consistent with your goals", "74000"],
    ["ItNdPA0PfSg", "This is your sign to make 2026 your best year yet", "54000"],
    ["zrA4_z3AoKI", "This one habit can change your days dramatically", "37000"],
    ["aEufguFv96w", "We've got less than 10 days left in 2025", "42000"],
    ["UF0CbiMgjVE", "How to be confident", "49000"],
    ["q7mguoZ79zo", "Using Hostinger and n8n to automate your workflow #ad", "20000"],
    ["ILkNdKUh2q4", "My daily quests framework for a fulfilled life", "31000"],
    ["9POjvCV2clM", "How to make the most of your time", "24000"],
    ["wZXho7o0oRI", "Why you should map out your perfect week", "31000"],
    ["56aSqjNw7B8", "My favourite calendar trick to get stuff done", "33000"],
    ["X_ZMp081WLc", "The reMarkable Paper Pro Move - my new pocket notebook #ad", "49000"],
    ["mAcvWbHgupo", "The mistake people make with their time", "28000"],
    ["fy0FuA95z5Y", "How do I feel fulfilled as a student?", "20000"],
    ["LvUIHxzkb1g", "How you can make 2026 the most successful year of your life", "44000"],
  ],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const method = options.method || 'GET';
    const u = new URL(url);
    const reqOpts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method,
      headers: {
        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
        ...(options.headers || {})
      }
    };
    const req = proto.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function getSignedCaptionUrl(videoId) {
  const body = JSON.stringify({
    videoId,
    context: { client: { clientName: 'ANDROID', clientVersion: '19.09.37', hl: 'en', gl: 'US' } }
  });
  const resp = await fetchUrl(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
    { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }
  );
  if (resp.status !== 200) return null;
  const data = JSON.parse(resp.data);
  if (!data.captions || !data.captions.playerCaptionsTracklistRenderer) return null;
  const tracks = data.captions.playerCaptionsTracklistRenderer.captionTracks;
  if (!tracks || tracks.length === 0) return null;
  return tracks[0].baseUrl;
}

function parseTimedTextXml(xml) {
  const segments = [];
  const sMatches = [...xml.matchAll(/<s[^>]*>(.*?)<\/s>/g)];
  if (sMatches.length > 0) {
    for (const m of sMatches) {
      const text = m[1].trim();
      if (text) segments.push(text);
    }
  }
  if (segments.length === 0) {
    const textMatches = [...xml.matchAll(/<text[^>]*>(.*?)<\/text>/gs)];
    for (const m of textMatches) {
      const text = m[1].trim();
      if (text) segments.push(text);
    }
  }
  let result = segments.join(' ');
  result = result
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  return result;
}

async function fetchTranscript(videoId) {
  const cachePath = path.join(TRANSCRIPT_DIR, `${videoId}.txt`);
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    if (stat.size > 10) {
      return { text: fs.readFileSync(cachePath, 'utf-8'), cached: true };
    }
  }
  const capUrl = await getSignedCaptionUrl(videoId);
  if (!capUrl) return { text: null, error: 'No captions available' };
  const proxyUrl = PROXY_BASE + encodeURIComponent(capUrl);
  const resp = await fetchUrl(proxyUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  });
  if (resp.status !== 200 || resp.data.length < 10) {
    return { text: null, error: `HTTP ${resp.status}` };
  }
  const text = parseTimedTextXml(resp.data);
  if (!text || text.length < 5) {
    return { text: null, error: 'Empty transcript' };
  }
  fs.writeFileSync(cachePath, text);
  return { text, cached: false };
}

function formatViews(v) {
  const n = parseInt(v);
  if (isNaN(n)) return v;
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return v;
}

async function main() {
  const totalVideos = Object.values(CHANNELS).reduce((sum, arr) => sum + arr.length, 0);
  let ok = 0, fail = 0, cached = 0;

  for (const [channel, shorts] of Object.entries(CHANNELS)) {
    console.log(`\n=== ${channel} (${shorts.length} shorts) ===`);
    const results = {};

    for (let i = 0; i < shorts.length; i++) {
      const [vidId, title] = shorts[i];
      try {
        const result = await fetchTranscript(vidId);
        if (result.text) {
          results[vidId] = result.text;
          ok++;
          if (result.cached) {
            cached++;
            console.log(`  CACHED [${ok}/${totalVideos}]: ${title.substring(0, 60)}`);
          } else {
            console.log(`  OK [${ok}/${totalVideos}]: ${title.substring(0, 60)} (${result.text.length} chars)`);
            await sleep(3000);
          }
        } else {
          fail++;
          results[vidId] = `ERROR: ${result.error}`;
          console.log(`  FAIL: ${title.substring(0, 60)}: ${result.error}`);
          await sleep(1000);
        }
      } catch (e) {
        fail++;
        results[vidId] = `ERROR: ${e.message}`;
        console.log(`  FAIL: ${title.substring(0, 60)}: ${e.message}`);
        await sleep(1000);
      }
    }

    // Build merged markdown: scripts first, links table at end
    const slug = channel.toLowerCase().replace(/\s+/g, '-');
    let md = `# ${channel} Shorts Scripts\n\n`;
    md += `${shorts.length} shorts transcripts.\n\n---\n\n`;

    for (let i = 0; i < shorts.length; i++) {
      const [vidId, title, views] = shorts[i];
      const text = results[vidId] || 'N/A';
      md += `## ${i + 1}. ${title}\n`;
      md += `**Channel:** ${channel} | **Views:** ${formatViews(views)} | **ID:** ${vidId}\n`;
      md += `**Link:** https://youtube.com/shorts/${vidId}\n\n`;
      md += `### Script:\n${text}\n\n---\n\n`;
    }

    // Links table at end
    md += `\n---\n\n# ${channel} - Links & Metadata\n\n`;
    md += `| # | ID | Views | Title | Link |\n`;
    md += `|---|-----|-------|-------|------|\n`;
    for (let i = 0; i < shorts.length; i++) {
      const [vidId, title, views] = shorts[i];
      md += `| ${i + 1} | ${vidId} | ${formatViews(views)} | ${title} | https://youtube.com/shorts/${vidId} |\n`;
    }

    const outPath = path.join(CHANNELS_DIR, `${slug}-shorts.md`);
    fs.writeFileSync(outPath, md);
    console.log(`  -> Saved ${outPath}`);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`TOTAL: ${ok}/${totalVideos} OK (${cached} cached), ${fail} failed`);
}

main().catch(e => console.error('Fatal:', e));
