# Anastasi In Tech Long-Form Transcripts

50 video transcripts.

---

## 1. What They Just Built Is Unreal
**Channel:** Anastasi In Tech | **Views:** 220K | **Date:** 2 days ago | **Duration:** 20:19 | **ID:** oGg96zK6Lvw
**Link:** https://youtube.com/watch?v=oGg96zK6Lvw

### Transcript:
We are watching AI outgrow the planet. Not 
metaphorically, physically. Gigawatt scale   data centers are rising everywhere. Some already 
consume as much power as entire countries. And   the road map says we need 100x more compute. But 
a small team of engineers is claiming something   uncomfortable that the direction where we are 
going may be wrong. So they went back to the   first principles and built a new kind of optical 
chip based on a different class of transistors   so-called metasurfaces. And this new chip delivers 
a compute of 100 GPUs in the footprint of one   while using roughly 1% of power. If that holds up, 
it breaks the core belief the entire AI industry   runs on. That intelligence scales with energy. 
I'm a chief design engineer and I know exactly   what you're thinking. These numbers sound too 
good to be true. Subscribe to the channel and   let me show you why they might be actually right. 
For decades, computing followed one simple rule.   Make transistors smaller, put more of them on a 
chip, get faster. That rule gave us everything.   Smartphones, the cloud, modern AI. And then 
over time, transistor scaling slowed. Power   stopped scaling down. AI didn't wait. So, the 
industry adapted. We stopped making computer chips   smaller and started making them bigger. We began 
connecting more chips, stacking them together,   both horizontally and vertically, squeezing 
performance out of scale instead of physics.   without saying it out loud, we all accept it that 
intelligence has a fixed energy cost and the only   way forward is to pay it. So when AI models 
exploded in size, the logic felt obvious. Build   more compute. Build larger data centers. Build the 
power plants to feed them. But when I look at this   5 gigawatt data center being built in northern 
Louisiana, something doesn't sit right because   the real bottleneck isn't compute. It's energy per 
operation. The amount of computation we need at   this point as a result of agentic AI as a result 
of reasoning is easily a 100 times more than we   thought we needed this time last year. If you take 
a 700 watt NVIDIA GPU and try to make it 100 times   faster without changing how computation itself 
is done, you don't get the progress. You get a   chip that burns 70 kilowatts and melts the moment 
you turn it on. This is where the current road map   stops making sense. So if we want AI chips to 
be 100 times faster, we need different physics.   So where do you even look for an answer like that? 
Well, you actually start with the workload itself.   Modern AI is dominated by one operation, matrix 
multiplication. And we actually solved this one   before with systolic arrays. Instead of shuttling 
data back and forth between compute and memory,   you load it once and then reuse it many times. 
That's the trick. And that saves us a lot of   energy because this memory access is exactly where 
the most energy goes. This idea dates back to the   1970s and for a while it was forgotten until 2017 
when Google brought it back with its custom AI   chip so-called TPU tensor processing unit. This is 
Google's custom AI chip built around exactly this   concept and it worked extremely well and this gave 
them one of the most efficient AI silicon in the   world to date competing with NVIDIA GPUs powering 
models like Gemini and attracting customers like   Anthropic. And in the digital world, this approach 
is brilliant up to some point while arrays stay   small because as we push to larger and larger 
matrices, these arrays have to grow. And as   they grow larger, power starts to scale with 
area. At that point, most of the energy is no   longer spent moving data. It's burnt inside the 
compute units. Every multiply, every accumulate,   every clock tick builds up faster than you can 
remove it. Performance stalls. This is where a   digital array stops scaling. So researchers took 
the next logical step, not better architectures.   A fundamentally different approach to computing -
analog. Analog systems are linear physical systems   and matrix multiplication are linear operations. 
So you see these sort of were meant for each   other. In analog computing most of the energy 
is burned at the perimeter. That's where you   inject inputs and read out results. Inside 
the array, nothing is switching on or off.   And this is beautiful because the computation is 
happening passively. As signals propagate through   the physical system, as you scale the array 
larger and larger, the interior doesn't become   more expensive, only the edges do. So the total 
energy stays roughly the same. And that efficiency   is exactly what AI needs. So everyone rushed 
in. A wave of analog chips followed. And for   a very brief moment, this looked like an answer. 
But most of the analog chips failed or walking   dead. And there were many reasons, but one problem 
showed up again and again. They were still built   with electronics, resistors, and capacitors. And 
those don't move signals instantly. They have to   charge and discharge. And these introduces delays 
and dissipates energy. As arrays grow larger,   those delays pile up. Noise increases. control 
becomes harder. So while the math was right,   the medium wasn't. So the industry abandoned 
analog. But what if analog was actually right,   but electronics wasn't? This is the moment 
engineers get uncomfortable because it's one thing   to optimize architectures and another to question 
the medium itself. What if instead of pushing   electrons through wires, we used light signals 
that propagate instantly without resistance? Now,   if we imagine building these systolic arrays with 
optical components, something strange happens.   Every time you double the size, you don't just get 
double compute, you turn energy efficiency into   speed. Because when we make this chip bigger, 
we get way more compute than extra power cost.   That shouldn't be possible. Yet, it is. And you 
may say, well, people already tried to build it,   optical computing chips. And you're right. 
Optical computing has been a dream for decades,   but it remained a dream for one simple reason. 
Traditional optical transistors are enormously   large. Look at this one. It's 5 mm. Now compare 
that to silicon transistors. Today we are talking   about transistors with features just a few 
nanometers wide. You see it's not even the   same universe. And this size kills scaling even 
before you get started. And that's why optical   computing never stood a chance. Not against GPUs. 
These scale too well. But then something changed.   This is Neurophos, a Texas-based startup 
baked by fund of Bill Gates, Jeff Bezos,   and Michael Bloomberg. And that matters because 
they backed the Neurophos at this specific moment   of time when AI data centers started turning into 
energy problem. What's so interesting, their goal   is not to replace the GPU ecosystem. It's to plug 
into it. Look at this one. Right next to the chip,   there is a red glowing block. It almost looks out 
of place. It made me very curious. That's actually   the optical compute module. This is where the math 
happens using light interacting with metasurfaces.   In a moment, I will show you how this exactly 
works and why this matters. But before that, look   at this. AI models are getting scary good at image 
and video generation. The problem is to get good   results, you usually need multiple subscriptions 
and to be really good at prompting until now.   Last week, I've been testing the new Kilng 3.0 
model on Higgsfield. And this is the first model   where I moved from trial and error to actually 
directing the output. What makes it different?   It's been trained as unified multi-model model. 
Everything trained together natively. text to   video, image to video, reference to video. Look 
what it can do. I upload a character reference,   write a scene description, and the model generates 
a multi-shot sequence with different angles and   camera movements in one generation. The character 
stays the same character. And here is a wild part.   You can add dialogue directly in the model 
in multiple languages, and it syncs naturally   with character expressions and emotion. These data 
centers consume far too much power. Physics works.   Impressive cinematic shots, controlled motion. If 
you are creating content with AI, this is honestly   a game changer and Higgsfield has unlimited access 
to Kling 3.0. And right now they are offering 70%   off premium plans. If you want to try it, use 
my link below to get the best deal. And thanks   to Higgsfield AI for sponsoring this episode. Now, 
let's get back to the light because what Neurophos   built follows a very particular philosophy. 
Their chip is built the same way GPUs are built   today. Same foundries, same supply chain, same 
packaging logic. So from the outside, this still   looks familiar, but inside everything flips. In 
a normal GPU, compute cores constantly pull data   from memory. That back and forth is where the 
most of the energy goes. Neurophos flips this   idea. Here the memory is the computation. This 
chip still uses familiar packaging. High-bandwith  memory sits beside the optical chip and the small 
electronic controller drives everything. But the   key difference where the weights of neural network 
leave. So instead of storing them as digital bits,   they are stored physically in the metasurface 
written in how it reflects and shapes light. Light   hits the surface and the math happens instantly 
at the point of the contact. So how does this   suddenly become possible? Their breakthrough is 
actually in the metasurface. And this didn't come   out of nowhere. Patrick Bowen spent years working 
on metasurfaces long before AI pushed data centers   to the edge. Originally metasurfaces are about 
controlling light, making objects smaller, more   precise. But then in this process, a different 
idea emerged. If we can control light that   precisely, maybe we can also use it for computing. 
So what is a metasurface? Imagine an ultra thin   glass. flatters in a mirror, but instead of 
being smooth, it's covered with millions of tiny   patterns. This is a physical instruction set. When 
light hits this surface, these instructions decide   what happens. They bend it, shift phase, redirect 
all at once without any moving parts. Before they   were never used for computing because traditional 
metasurfaces are static. Once etched, they're   fixed forever. Imagine it like burning in the 
numbers right into the hardware. This is great for   lenses but not so useful for computing. Neurophos 
changed that. They've built an active metasurface   device where that function can be written and 
then rewritten electronically. And now finally   it start to look less like a lens and more like a 
photonic memory. Now imagine each pixel contains   millions of tiny cells and each of the cell can be 
programmed its reflection and the phase shift by   applying the voltage to the cell and now it looks 
more like an optical DRAM which is done using the   standard foundry process. Now imagine a beam of 
light coming in. The brightness of that light   encodes input data. Brighter means larger value. 
Dimmer means smaller value and that light hits a   pixel with a certain reflectivity. If the pixel 
reflects half the light, the output becomes half   as strong. So here input light times reflectivity 
equals output light. That is multiplication done   directly in physics. And these optical cells are 
extremely small, up to 10,000 times smaller than   traditional optical devices. This means we can 
pack millions of them in a chip and when the   upcoming light hits the surface, every pixel 
multiplies once, but all of them are doing it   at the same time. The reflection itself performs 
the math and the result is a dense optical matrix   multiplier working at the speed of light. And 
when you cross that threshold, something strange   happens. Throughput starts scaling with area. So 
when you make the chip bigger, it's actually gets   better. According to Neurophos, a single unit can 
reach 1.2 million tera operations per second. And   when you place eight of these units in a tray, 
they project performance that can exceed the   entire GPU rack using a fraction of the energy. If 
this holds at this system scale, the implications   are beyond more efficient chips. It will change 
the entire AI data center economics. This means   power stops being the primary constraint for 
scaling. And that matters because this changes   where AI can run, who can afford it, and how fast 
it can grow. Which raises the obvious question.   Do we actually want that? Because half of the 
internet is really scared of AI. And now we are   talking about removing one of the last things 
that slows it down. So what they have actually   shown they have already a working test chip 
a prototype in silicon and basically they've   already derisked all the fundamental physics. 
The computing cores run at 56 GHz. That sounds   absurdly fast and it is but there is a reason for 
that. As we just discussed, there are very little   things inside that slows the signal down. There 
are no electrons pushing through resistance. There   are no capacitors that have to be charged and 
discharged. No long metal wires heating up. That's   the reason why traditional silicon chips hit a 
wall at a few GHz. But this chip doesn't play by   those rules because the physics itself underneath 
is different. And this shows up in efficiency.   These are the measurements from their paper. For 
reference, NVIDIA Blackwell GPU delivers about 9   POPS of compute at roughly 1,000 W. That lands 
around 9 TOPS per watt efficiency, while this   new chip at peak targets about 235 POPS per second 
at 675 W of power. So they report roughly 30 times   better efficiency than today's state-of-the-art 
NVIDIA GPU and that's why they are targeting   hyperscalers first inference applications where 
efficiency matters more than raw peak performance.   You can think of workloads like search and ranking 
and realtime inference behind ChatGPT and image   generation. These systems run all the time and 
they dominate data center energy use and if you   can cut power there the impact compounds quickly. 
Their road map points to data center ready systems   around 2028. I personally think it's a little 
bit optimistic but it's close enough so that the   industry can't ignore it. And this matters for one 
more reason. It is designed to be manufactured at   factories like TSMC on standard silicon photonic 
process and this means it fits into existing   semiconductor supply chain and that's makes a 
huge difference between an idea a lab experiment   and something that can be actually scaled. Here 
is a problem. Every few years, someone claims   that optical computing will replace GPUs. And 
almost every time it fails when scaling starts,   startups don't win on physics alone because 
physics alone doesn't decide winners. Ecosystems   do. Manufacturing metasurfaces at scale is hard. 
What works on test silicon does not automatically   survive real production. Those large arrays 
introduce defects. Thermal stability becomes   a problem. So far the results are at prototype 
scale and the next step is proving that they can   scale reliably. And then there is software because 
hardware doesn't win without the ecosystem. GPUs   have decades of momentum. Compilers, frameworks, 
entire teams have been built around them. And in   general competing with NVIDIA Blackwell GPU 
which is already shipping at massive scale or   upcoming Rubin GPU sets an extremely high bar. 
For Neurophos proving that physics work is just   the first step. They also have to prove software 
compatibility and cost parity. And they have to   do it fast because by the time their early 
data center prototypes arrive, NVIDIA will   not be standing still. This is definitely one 
of the most exciting bets in modern computing,   but history isn't kind here. Optical computing 
startups have hit this wall before. Many of them   never made it past the lab because hyperscalers 
didn't want to take this risk. The physics is   compelling. The prototypes are real, but scale 
is the test. Still, the future of computing looks   bright. It definitely won't be purely electronic 
anymore, but it won't be photonic either. It will   be heterogeneous. And for the first time, power 
may be not the limit. If, and it's a very big if,   the ecosystem can move fast enough to catch up 
with the physics. Now, if you want to go deeper,   watch this episode where I break down the insane 
story of the world's largest AI data center.   You will love it. or this one where I explain 
what it takes to invent the smallest microchip   technology to date. And remember to subscribe 
to the channel. I will see you there. Ciao.

---

## 2. World’s Largest AI Datacenter — $100B Disaster
**Channel:** Anastasi In Tech | **Views:** 315K | **Date:** 13 days ago | **Duration:** 21:32 | **ID:** NuJGgmhKqyQ
**Link:** https://youtube.com/watch?v=NuJGgmhKqyQ

### Transcript:
There is a huge shift underway in computing and 
there is no going back. This isn't about better   AI models. It's about who controls compute, 
power, land, and time. Let me show you what   that looks like. This is Hyperion, 
the world's largest AI data center,   crushing New York City. Several million GPUs 
under one roof, eating up to 5 gigawatts  of power. This is the story of the world's largest 
AI factory and the extreme decisions it takes to   build it so fast. I am an engineer who spent over 
a decade building the most critical chips for the   systems like this one. And I've covered other 
massive data centers on this channel before. But   Hyperion is different. Not because it's bigger, 
because when we look at compute, power, cooling,   network, it breaks all the rules others still 
follow. And those choices will shape the future   of AI and the global economy itself. Subscribe to 
the channel and let me explain. This story starts   with a business that prints cash. For years, Meta 
used AI where it paid best. Better targeting,   better ads, and this strategy delivered. Meta 
outgrew nearly every major player in digital   advertising. But that success created a problem. 
While it optimized feeds, the AI frontier moved   elsewhere. For Meta, money was never the issue. 
Performance was. Llama models lost the lead. The   shift became undeniable when DeepSeek, a Chinese 
AI lab, beat Meta on key benchmarks. That's when   Mark Zuckerberg stepped in personally 
and narrowed the strategy to two things:   talent and compute. Well, you can't buy a 
breakthrough, but you can buy the oats. Meta   spend billions pulling elite researchers out of 
places they never planned to live. Offers up to   $300 million over four years. But even the best 
team hits the same wall. Compute. Right now,   AI isn't constrained by ideas or algorithms. 
It constrained by compute and power. And that   at scale forces a different kind of decision 
making. It's forcing them to make infrastructure   decisions so extreme that they make traditional 
data centers look obsolete. At that point, Meta   had two paths. Keep renting compute and depend 
on someone else infrastructure or do something   no other social media company ever attempted 
to build and control its own compute and power.   Hyperion was that choice. If this works, it will 
give Meta the highest amount of raw compute pure   researcher and might even put them ahead of hyper 
scalers like Google and Amazon. But that outcome   hangs on a very big if because before Hyperion 
there was Prometheus Meta's Ohio supercluster.   There was no single campus no clean design. GPUs 
came online wherever they could fit. And this   included even tent style buildings. All of that 
distributed across Ohio, linked with ultra high   bandwidth networks. And this was fast, improvised, 
and enough to buy time. When the grid couldn't   keep up, Meta didn't wait. They went behind the 
meter, dropped natural gas generators right next   to the racks. Every decision was a trade-off. 
None of them elegant, but it worked. Prometheus   bought Meta time. Hyperion is what comes next. 
Centralized and designed to last. At full scale,   Hyperion will pull up to 5 gigawatts of power. And 
that's enough to overwhelm most regional grids.   Now, just imagine all of this consumed by a single 
campus for a single task. Training Llama models.   Before we go further, we have to understand 
how an AI data center works. Because it isn't   just a building full of GPUs. It's something way 
more interesting. It's a single machine which is   designed to turn electricity into intelligence 
as efficiently as physics allows. Imagine you're   about to build a 5 gigawatt data center. The first 
problem isn't servers or GPUs, it's power. Where   do I find 5 gigawatts of electricity when the grid 
is already sold out? And here Meta was thinking,   do we wait another 2 years for the grid upgrades 
or do we redesign a data center? And that's   exactly where Hyperion gets very interesting. 
5 gigawatts actually simplifies your life   because it's instantly disqualifies almost every 
location on Earth. That's why Hyperion landed in   northern Louisiana. It won for two reasons 
most sites simply could not match. First,   a massive flat mega site with direct access to 
water and expandable power. Second, speed permits   fast-tracked equipment tax waved on a project this 
size that saves hundreds of millions and months of   time. The rural location matters too. Many places 
can offer land. Very few can offer power. Almost   none can offer both quickly. Louisiana could. 
And that raises the real question. Where do   we get 5 gigawatts of power? Meta partnered with 
Entergy Louisiana to construct three natural gas   power plants sized for Hyperion. Two of them 
will sit right next to the campus in Richland   Parish. A third fits in from over 100 miles 
away through new transmission lines. Together   they will deliver over 2 gigawatts of gas power 
backed by 1.5 gigawatts of solar. So you see,   Hyperion doesn't connect to the grid, it extends 
it. But it turns out generating all that power is   just half of the story. How do you push all that 
electricity without frying the grid? So Entergy   is building a new electrical backbone. 100 mile 
transmission lines, substations, and transformers   sized for a load no city was built for. Power 
flows straight from the plants into the campus.   No sharing. That's how Hyperion will reach 2 
gigawatts by 2030 and keep climbing towards 5. But   even with power secured and delivered, one problem 
still remains time. At the current AI race, the   speed of buildout is no longer the detail. It's 
decisive. And Meta chose to play the speed card.   They actually broke the rules data centers treat 
as secret. They dropped redundancy. Normally power   in a data center takes the long cautious path from 
the grid through backup diesel through battery   holes that smooth every spike. Only then does 
electricity reach the racks. That's how you get   perfect uptime and really long project timelines. 
Hyperion throws that out. No giant battery rooms,   no diesel generators for emergency because those 
things don't just cost money, they cost time,   permits, and reviews. So that big decision was 
a calculated risk because Hyperion won't serve   life users. All of that is for training workloads 
and those accept imperfections. If power dips,   runs pause, status check-pointed, and later 
work resumes. At this scale, hardware issues   are expected and actually the software stack 
is already designed with this reality in mind.   So they got many months shaved off the timeline. 
And this was the change because Meta didn't just   scale compute anymore. It started to rebuild the 
energy system around it. Basically turning from   a software company into the energy developer. And 
the irony is that power gets you to the starting   line. But then compute cooling and networking 
lock in outcomes for years. And by the end of   this video, you will understand exactly why. But 
before that, here is the upside of all that AI   progress as systems become more complicated and 
our work too. You don't actually have to carry on   everything yourself anymore. And that's something 
I've started leaning on too. Which brings me   to this. These are Sintra's AI agents. They are
built to take real work off your plate. You know,   most AI tools just sit idle. You prompt, you 
wait. Sintra agents are different. They are   proactive. On busy days, I start with Vizzy, my 
personal assistant. I will say, Vizzy, help me   to prepare for today's meetings. It pulls from my 
email and calendar, gives me a clean summary. Who   am I meeting? What were my action items from the 
last time? So, I have time to prepare and think   about it. For business development, Sintra 
keeps things moving. It drafts follow-ups,   keeps context without me repeating it. And then 
there is Gigi for personal development. Small   nudges that keeps you focused when the day gets 
chaotic. What makes all of this work is something   called Brain AI. I uploaded my context once. 
Projects, goals, priorities. From that point on,   every agent already knows how I think. So when 
I ask for help, it's spot on. Sinntra integrates   with Gmail, Slack, Calendar, Outlook, and Notion, 
tools you already use, and it removes repetitive   work so you can focus on decisions that actually 
matter. If you are thinking about hiring your   first AI employees that never sleep, Sintra makes 
it surprisingly easy, and you can get 72% off all   plans using my code INTECH through the link below.
There is also a 14-day money back guarantee,   so you can try it with zero risk. And thank you 
Sintra AI for sponsoring this episode. Now back to   the story. Imagine they've built all that power. 
But there is a brutal irony in all of that because   the moment electricity reaches the rack, every 
watt you feed in returns as heat. All that heat   trapped inside four walls at densities no building 
was ever designed to survive. And once you zoom   out at Hyperion scale, the next constraint 
is obvious. It's size. It's five miles long,   a mile wide. At that scale, forget air cooling, 
you need water and a lot of it. AI data centers   are actually infamous for draining local water 
supplies. At full scale, a campus like Hyperion   can consume up to 23 million gallons of water per 
day. That's a city-level demand. It competes with   farms, towns, entire regions. And that's why so 
many recent data center projects have sparked   backlash, especially in places like Arizona and 
Nevada where every gallon is already contested.   Now 23 million gallons of water per day sounds 
really terrifying. But this is what the most   people miss. At this scale, power generation 
is the real problem. It multiplies everything.   Emissions, heat, and water. Those three gas plants 
we've talked about use far more water for cooling   than the data center itself. Together they can 
draw up to 700 million gallons per day. That's   a 30 time amplification of the data center's 
footprint. This is the biggest hidden cost of   scale. But just consider that heavy industries 
like steel industry still uses more. more water   and it pollutes more. So yes, these numbers sound 
enormous, but relative to regional supply, they   still don't break the system. The real risk is 
what comes next. The data center power consumption   is projected to reach 20% of the global energy 
consumption by 2030. And this means it stops being   a regional infrastructure question and becomes 
a planetary one. Louisiana is one of the most   water-rich states in the United States. Sitting 
inside the Mississippi River basin, Hyperion   draws water from the Mississippi River alluvial 
aquifer, a shallow system that recharges quickly.   And this 23 million gallons of water per day, it's 
not like it's used once and it lost. It runs in   closed cooling loops. In these loops, roughly 95% 
stays in the system each cycle. Over time though,   heat has to leave as evaporation. and Meta funds 
local projects with a goal to restore more water   than it consumes by 2030. Everything up to now 
was a setup power and cooling just to get you to   the line. But none of that matters if compute if 
silicon don't scale because that's where the real   money gets burned. And here is what's interesting. 
Meta doesn't bet on a single chip. Alongside with   NVIDIA GPUs, it will run its custom silicon. 
What's interesting, each of these two is built   for a different job with a goal to squeeze out the 
most performance for every dollar spent. Meta's   in-house design silicon is called MTIA. Meta 
Training and Inference Accelerator. It's designed   to do repetitive and expensive work extremely 
well. things like recommendation systems, ranking,   embeddings, and large scale inference. Under 
the hood, it's a grid of small processing units   running in parallel. And the key idea is simple. 
Reuse data more, move data less. Meta's chip keeps   data close to the compute, cutting costly memory 
traffic. That matters because recommendation   workloads are mostly sparse. Large portions are 
zero, repeated, or barely changed. while moving   the data back and forth to the memory burns more 
energy than the math itself. Meta avoids that   waste and they come to much higher performance 
per dollar. That custom silicon alone cuts cost   by half comparing to running the same workloads on 
GPUs and that was the first reason for the custom   silicon. The second is control. With its custom 
silicon, Meta controls how memory is accessed, how   data moves and how software maps onto the silicon. 
And this is a huge win for efficiency and it   reduces dependence on external vendors. And most 
importantly, it frees NVIDIA GPUs for one thing   that matters the most, training. That's actually 
where all the heavy lifting is happening. And for   that, Hyperion will mostly rely on the latest 
NVIDIA Blackwell Ultra GPUs. If you crack open   one of Hyperion's racks, the structure becomes 
clear. Each of them contains 36 NVIDIA superchips.   Every superchip combines 1 NVIDIA Grace CPU which 
is ARM based and handling orchestration and data   flow and 2 Blackwell Ultra GPUs doing the actual 
training work. NVIDIA Blackwell GPU is built on   TSMC's 4 nanometer process and delivers over 20 
petaflops of FP4 compute per chip. Under the hood,   each Blackwell GPU uses a dual die design which is 
related to theoretical size reaching the limits.   Here you can see how two large compute dies are 
linked by high-speed die to die interface. Moving   data at roughly 10 terabits per second. To make 
this tight connection between two computing dies   possible, NVIDIA relies on TSMC Chip-on-wafer-on- 
-Substrate-L packaging technology. This is a very   interesting and very popular advanced packaging 
technology which allows you to pack multiple   silicon components like compute dies and memory 
and interconnect and bond them into one shared   silicon interposer. In this case, it integrates 
two computing dies alongside with eight stacks of   high bandwidth memory into a single package. Then 
two of these superchips sit on each compute tray.   18 compute trays make up a rack. Above them, nine 
NVLink switch trays tie all 72 GPUs into a single   unified fabric. And the beauty of it that each GPU 
can talk to any other GPU at full speed. And from   the software perspective, it will be seen as one 
giant GPU. Each of these racks pulls roughly 140   kW. That's the moment when scale snaps into focus. 
Just think about it. At roughly two gigawatts,   you're already looking at 14 to 15,000 racks. And 
if we push toward long-term 5 gigawatt number,   that number climbs past 30,000 racks. And that 
puts Hyperion into the ballpark of roughly 2   million GPUs at the full buildout. Of course, 
real power budgets include all the infrastructure   margins, cooling overhead, and conversion 
losses. But even with conservative assumptions,   the conclusion doesn't change. The numbers 
are enormous. And that's even before the land,   building, transmission lines, power 
plants. Yes, the campus is expensive,   but the silicon bill is bigger by far. It's 
roughly it's up half of the data center costs.   NVIDIA is not selling GPUs. It's selling the 
infrastructure. Consider that each rack costs   several million dollars and this puts the compute 
costs alone in the range of tens of billions which   would be roughly 20 to 30 billion as an estimate 
and then power is the second largest expense and   everything else exists just to keep those racks 
alive. But still at this scale the network sets   the speed of intelligence. Here, Hyperion 
links its GPUs with ultra high bandwidth  fabrics. So overall, it behaves less like a 
traditional data center and more like a giant AI   supercomputer stretched across open fields. In a 
nutshell, this is the biggest difference between a   data center and an AI data center. We've discussed 
how power feeds it, how cooling keeps it alive,   and how compute does the math. But the network 
is what turns all of it into a single brain.   And if you fail any of these four, the whole 
system collapses. That's both the beauty and   the brutality of building something so complex 
as Hyperion. Now from this story, three lessons   stand out. First of all, AI frontier AI is now an 
infrastructure problem. Leading models don't come   from clever code alone. They come from land, 
power, grid, and years of planning. The second   lesson is right now scale defines the relevance. 
And if you don't have enough compute and you can   deploy it fast enough, ideas don't matter. And the 
third, probably my favorite, speed bids elegance.   This is a shift and this is why Hyperion matters. 
If you look around, Google owns data. Anthropic   dominates enterprise and coding. xAI stunned 
everyone with the construction speed of Colossus   2 data center in Memphis. OpenAI leads in closed 
models and Hyperion is Meta's huge bet, a direct   response to OpenAI's lead and the Stargate project 
and this is a very expensive bet. In total, Meta   will invest over $100 billion in the buildout and 
the current assumption is that more scale equals   more intelligence and that is not guaranteed. 
Eventually, Hyperion may become the blueprint   for how AI is built going forward or become a 
very expensive mistake. And here is the most   uncomfortable part because they built this massive 
data center to optimize engagement and attention   to make apps better at capturing and holding 
our focus than ever before. All these millions   of GPUs will be computing the better algorithm at 
capturing and holding our attention. So over time   it will be harder and harder to defend. The sad 
part is systems optimized for engagement don't   care why you stay. But I do. I do care that you 
stay on the bleeding edge of what's coming next   in technology. And if that's why you're here, 
subscribe to the channel. Now, if you want to go   deeper, watch this insane story about xAI Colossus 
2 data center in Memphis or this one to learn what   it takes to build this semiconductor factory from 
scratch. Right now, it's a very intense period in   my life and I really admire all your support. 
Love you guys and I will see you there. Ciao

---

## 3. Microchip Breakthrough No One Expected
**Channel:** Anastasi In Tech | **Views:** 379K | **Date:** 3 weeks ago | **Duration:** 19:07 | **ID:** 2Exyzeg5xGQ
**Link:** https://youtube.com/watch?v=2Exyzeg5xGQ

### Transcript:
For years, we all watched AI follow 
the same pattern. Build bigger models,   throw more GPUs at them, and then extend the data 
centers. Intelligence followed. That era is ending   because something fundamental has changed. Power 
stopped scaling. Right now, we are hitting hard   energy limits everywhere in the world, including 
the United States. Texas is the clearest warning   sign. Every single month, tens of gigawatts of new 
data center requests hit the grid and almost none   get approved. The grid is effectively sold out. 
And it's not just Texas. From Virginia to Ohio   to the West Coast, the story is the same. The grid 
is full. And extending that grid takes years. When   one gigawatt of AI compute can generate you tens 
of billions of dollars per year, waiting isn't   an option. So AI labs stopped waiting and build 
their own power plants. On-site generation is   exploding gas turbines, batteries, private power 
plants. As a chip design engineer, I see this as   a system problem. And the only realistic way out 
of this is not by generating more electricity.   It's by changing how computation itself is done. 
Subscribe to the channel and let me explain. This   story starts with a Korean founder who turned down 
a billion dollar acquisition offer from Meta. His   name is June Paik. He was a senior engineer at 
Samsung. He had a solid career, a safe trajectory   until a soccer injury took him out for months. He 
was stuck in bat and he started to study AI end to   end models, math systems, how software actually 
maps into silicon. And that's when it actually   clicked. June realized that the next ceiling 
in AI won't be algorithms. It would be power.   AI would need a new way to compute because power 
would no longer scale the way it used to. And if   that's true, then the winning chip will not be the 
one with the most brute force. It's the one that   can do the same work using less power. And at this 
point, he walked away from his role at Samsung   to build something from scratch. Because at the 
time, brute force was everywhere. GPUs ruled AI,   inference, training, everything. And that wasn't 
an accident because GPUs were built for graphics.   And what is graphics? It's math. Lots of math at 
massive scale. Think about a 4K screen. Millions   of pixels updated dozens of times per second. Each 
pixel needs the same math over and over, all done   in parallel. That's exactly what GPUs are good at. 
Huge amounts of simple math done simultaneously.   So when AI arrived, GPUs were already there. The 
world's best math machines. And that worked for   a long time. But GPUs were never designed with 
energy as a constraint. They were designed to   be fast, flexible, and general. That was fine when 
power was cheap and the grid had slack. Now energy   became the constraint. And he founded Furiosa AI 
with a clear promise. So from the very beginning,   our goal was to build efficient and high 
performance inference chips designed to serve   AI at scale in data centers and infrastructure. 
They've built an NPU, neural processing unit. They   called it Warboy, a chip designed for just one 
job, running AI inference when power is tight.   To understand why an NPU exists at all, you need 
to understand the mismatch. Neural networks run   on simple operations. Multiply, add, then repeat, 
millions, and then billions of times. Traditional   chips were not built for that pattern. A CPU is 
built for complex one at a time work, branching   logic, making decisions, and it's brilliant at 
that, but it's terribly inefficient at repetitive   math. A GPU was a major step up because it can do 
the same operation across huge blocks of data in   parallel. That's why it unlocked modern AI. 
But there's still general purpose. And that   flexibility cost energy because at scale moving 
data around starts to dominate the power bill. An   NPU gives up that generality. It's a purpose-built 
accelerator for one task inference. Essentially,   it's what happens after a model is trained when 
it takes real input and produces real output.   Every prompt you put in Gemini or ChatGPT image 
and video processing, wildfire detection, all of   that is inference. And at the core, inference is 
a very repetitive math. Input data multiplied by   learned weights over and over again. So instead of 
building a flexible machine, you build a factory   for that one operation. Inside the chip, you pack 
thousands of tiny cores, tiny circuits called MAC   units, multiply accumulate units, and each one 
does exactly the same thing. Multiply two numbers   and then add the result to the running total. But 
this is where Furiosa's technology goes beyond   standard neural engines. The real breakthrough is 
in how the data moves. Traditional chips follow   the Von Neumann model. fetch data from the memory, 
compute, store it back, repeat. And that constant   back and forth is what kills efficiency. Well, 
that's a problem because in modern AI workloads,   that moving data around now consumes even more 
energy than the computation itself. NPUs replace   it with a special data flow architecture called 
systolic array in order to perform large matrix   multiplications without using memory at all. Here 
instead of pulling data in and out of memory data   flows synchronically through the compute units 
like a pulse. What's beautiful each piece of   data gets reused every time as it pass through 
the array. In this way, those numbers stay on   the chip and get reused instead of being pulled 
from the memory over and over. And that makes a   huge difference for power consumption. By keeping 
the hot data on the chip, you cut memory traffic.   And that's where most of the power savings come 
from. That helps, but it doesn't solve the hardest   part. Real inference workloads don't look so neat. 
Data reuse patterns shift constantly. Classic NPU   designs really struggle here. Furiosa tackled this 
problem heads on. Instead of forcing workloads to   fit the hardware, they design the hardware in a 
way that it manages to fit the workload. And we   will break down how it works in a minute and the 
moment it became the turning point for Furiosa's   future. But before that, do you remember how all 
of that started? June decided to learn AI and to   end and that single decision changed his whole 
life trajectory which brings me to this. It's   January again. Most people have already made their 
resolutions. But the smartest one will be focusing   on one skill which will matter the most in 
2026. AI. Looking at how fast things are moving,   2026 is the year AI reaches maturity across real 
products and real jobs. Yet many people still   haven't learned it. That's why I recommend you 
joining me for this 2 day AI workshop by Outskill.   They're hosting a live training this Saturday and 
Sunday from 10:00 a.m. to 7:00 p.m. EST on both   days. More than 10 million professionals worldwide 
have already attended Outskill trainings. People   from marketing, finance, engineering is attending 
this because it isn't something specific to any   industry, but now needed across every of them. And 
the timing matters because right now, as a part of   their new year upskilling fest, you can join this 
training for free instead of the usual $395. This   is where you learn how to build AI agents and 
automate workflows across tools like sheets,   notion, and CRMs. You will also learn how to use 
AI to save hours weekly. If you attend both days,   you will receive additional bonuses, the AI 
prompt bible, the AI profit road map, and   your personalized AI toolkit builder. Seats are 
limited, so register right now through the link   below or scan the QR code here. And remember to 
join the WhatsApp community to stay updated before   the training starts. Tensors power everything from 
smartphone photos to black hole simulations. Yet   they start as a simple array of numbers. A 
number like room temperature or a letter is   a zero-dimensional tensor. Line those numbers 
up and you get a one-dimensional tensor like a   word. Stack vectors into rows and columns and you 
create a two-dimensional tensor. That is a matrix.   Now stack those matrices, add depth and you arrive 
at a three-dimensional tensor. Example is a color   image. Height times width times RGB channels. That 
multi-dimensional array is what we call a tensor.   Each extra dimension gives you room to pack richer 
structure. And to go fast, models process many   tensors at once. And actually the hard part is not 
computing the tensors, it's moving them into the   right shape at the right time. Furiosa AI chip 
does something smarter. Instead of forcing the   data to match the hardware, the hardware adapts to 
the data. What happens is NPUs rearrange tensors   internally, which means they fuse them, split 
them, reorder them. So frequently used data stays   very close to compute. In vision models, nearby 
pixels get reused again and again. In language   models, the same weights are reused across 
thousands of tokens. The basic idea is the neural   engine reorganizes this data around reuse, which 
means less data movement and less energy. Think of   it like a kitchen. A GPU is a very fast chef who 
keeps running back to the pantry. While neural   engine first lays out everything on the counter 
and never leaves the workspace, that gap barely   matters at the small scale. But at the data center 
scale, that difference is the energy bill. Beyond   what we've discussed so far, there are a couple of 
more clever decisions hiding under the hood. And   the first one is clock. You know, clock is like 
a hard bit of a chip, very important signal. And   this particular chip runs at very conservative 
one gigahertz clock and that's intentional.   The thing is the power chip spends on the 
operation scales with frequency and with square   of the voltage and lower clock means less power 
spent. Instead of pushing frequency this chip   scales throughput through parallelism, reuse and 
locality which brings me to the next point. This   chip features massive on chip SRAM memory. Just 
imagine each compute slice has large local memory   and across the chip this adds up to hundreds 
of megabytes. It's used to store results of   billions of small calculations. Why this matters 
is simple. This memory is pretty large. It's fast   and it's cheap because it sits right next to 
the compute engine. So instead of constantly   streaming data in and out of external memory, 
chip keeps it on the die. Weights stay local.   Activations get reused. Intermediate tensors 
never leave the chip. This is where a big part   of efficiency is coming from. Then they've built 
a more advanced version of it. RNGD chip. The chip   features two high bandwidth memories integrated 
with a processor using CoWoS-S as interposer from   TSMC. They manufactured the chip at 5 nanometers 
TSMC technology. Then hardware and software were   redefined together as one system. When the chip 
was finally ready, they brought it to Hot Chips   conference at Stanford. And this was the moment 
the first time when the work stepped into the   light. Furiosa AI shows their chip running Mata's 
llama model and it did so with more than twice   power efficiency of high-end NVIDIA GPUs. Well, 
the numbers make that concrete. Furiosa AI runs   at 150 W while high-end GPUs run at least at 350 
W. And with the latest generations, these numbers   keep climbing. With the latest Blackwell pushing 
well beyond 1,000 watts on standard inference   performance benchmarks, Furiosa demonstrated 
roughly 40% better performance per watt. And that   difference compounds at data center scale. This 
is significant. It translates into less cooling   required and far lower operating cost. And of 
course, this didn't go unnoticed by Meta because   Meta is very serious about AI and not just about 
the models. Meta also builds its own silicon. They   operate at massive data center scale and this 
is not slowing down. When a new AI chip shows   an efficiency gap like that, they pay attention. 
So Meta reportedly tried to acquire Furiosa AI for   almost $1 billion. Fioa said no. What matters more 
is what happened next. The chip started to show up   in real deployments and that tells you just as 
much as the offer itself. OpenAI used the chip   for a public demo in Seoul. Then LG AI research 
put it through a much longer test 7 months of   evaluation on real LLM workloads. The result 
was clear about 2.5 times better performance   per watt compared to GPU based solutions and that 
led to a commercial deal with LG and now they're   bringing it into their data centers and right 
now Furiosa's latest chip is in mass production.   That's the point where technology moved from 
the lab into real infrastructure. That chip and   that story matters a lot because it cuts power 
dramatically and this changes the economics. It   actually changes where AI can run without further 
expanding a power and cooling infrastructure. And   it changes who can deploy it at scale. And chances 
are you've already used an NPU, a neural engine,   just not in a data center. Neural engines started 
appearing in smartphones already a decade ago.   Typically, they are built into an SoC system on a 
chip. First, they were used for face recognition,   photo enhancements, and voice processing. Imagine 
the tasks that have to run constantly on the   background and have to be fast without draining 
the battery. Then they moved into laptops. Well,   probably the most famous NPU today is Apple's 
neural engine. This one works quite well,   not because it's unusually powerful, but because 
they managed to integrate it so deeply into the   system. The strategy is to offload the AI tasks 
to neural engine so CPU and GPU can do other   work and save the battery. While Furiosa AI is 
applying a similar idea at the data center scale   and to be fair, they are not the only one having 
this idea. And this is where things start to get   really interesting because the real competition 
of Furiosa is not GPUs. It's other purpose-built   AI chips. Like Google has its own Tensor chip, 
which is the most beautiful example of what an   ASIC is capable of. They've managed to 
achieve an outstanding performance per   dollar. Amazon's Tranium chip is also playing 
in the same arena. I will link my deep dive on   these two in the description box below so you 
can check it out later. Well, beyond Google,   there are other players pushing custom inference 
chips like Cerebras who has a radically different   wafer scale design, a chip occupying entire 
300 mm wafer. And then there is a Groq with   aggressive architecture or rather was because 
they've just sold their hardware assets and the   core team to NVIDIA this last December which is 
actually another way of saying how strategically   important inference has become. And that leaves us 
with very few independent companies still building   serious purpose-built chips at scale. I think 
the next phase in AI will be defined less by   who trains the biggest model but who can train 
the model in the most efficient way and scale   data centers fast. Actually for hyper scalers the 
speed of deployment here becomes the actual mode.   At the same time power is not getting cheaper and 
the companies that survive this phase will be the   ones that treat energy as a first class design 
constraint. Will neural processors like Furiosa AI   replace GPUs? Well, no, because GPUs will keep 
doing what they do the best, right? Pic raw   performance for the massive training. Will they 
reshape inference? Very likely. These new chips   will step in where efficiency matter more than 
raw speed, especially for AI that never turns off.   Now, if you want to stay up to date with most 
exciting shifts in AI and technology, subscribe   to the channel and now watch this episode where 
I explain a new disruptive technology that will   challenge both TSMC and ASML. Or watch this one 
where we go inside a secret chip factory to see   the future of microchips under the microscope. 
You will love it and I will see you there. Ciao.

---

## 4. This New Technology Could Kill TSMC and ASML
**Channel:** Anastasi In Tech | **Views:** 742K | **Date:** 1 month ago | **Duration:** 20:15 | **ID:** R539FPNAwes
**Link:** https://youtube.com/watch?v=R539FPNAwes

### Transcript:
Until now, advanced chipmaking has been defined 
by two companies. TSMC manufactures roughly 90%   of the world's most advanced chips. ASML 
is the only company that can build the   lithography machines capable of printing 
them. That balance held for a while. Now,   a new startup claims it can break both. Their 
new tool can print chips at the sub nanometer   scale in a single exposure at roughly half the 
cost. And here is the part the most people miss.   They don't want to sell this machine. They want to 
build entirely new chip factories around it. I've   spent more than 10 years designing microchips. 
And typically this industry is quite conservative.   It moves in tiny incremental steps. But this 
one is not incremental because if this works,   it doesn't just threaten ASML and TSMC. It puts 
the entire advanced chip manufacturing model at   risk. Subscribe to the channel and let me explain. 
Every breakthrough in microchips eventually runs   into the same wall. How do you print it? Chip 
manufacturing uses hundreds of tools, thousands   of steps, but one step dominates everything. 
lithography. This is an EUV lithography machine.   It is the most complex and expensive manufacturing 
tool humanity has ever built. Its job is simple   to describe. It prints transistor features onto 
silicon wafers. It actually defines how small,   how dense, and how powerful chips can become. 
At today's leading edge, those are just a few   nanometers wide. See it for yourself. Here we 
are zooming into a 0.2 nanometer chip by firing   electrons. What you are seeing are features just 
a few nanometers wide. This particular transistor   is more than 10,000 times smaller than a human 
hair. So how do you manufacture something so   small with a machine so colossal of the size 
of a bus? And the answer is light. You shine   light through a mask onto a silicon wafer coated 
with light sensitive chemistry. Where light hits,   chemistry changes. Where it doesn't, material is 
removed. Layer by layer, a chip appears. That's   how we turn sand into thinking machines. 
The idea is pretty simple. Making it work   at nanometer scale is not. As transistor 
shrunk, light became the limiting factor.   Early lithography used deep ultraviolet light at 
193 nanometers wavelength. It worked until physics   stopped it. It turned out you can't reliably 
print features smaller than the wavelength you   are using. So the industry made a radical shift 
to extreme ultraviolet lithography. EUV uses light   with a wavelength of 13.5 nm, more than 10 times 
shorter than before. That single change combined   with a cascade of hard-worn innovations is what 
unlocked the most advanced chips on earth. But   EUV comes at the price. EUV light gets absorbed 
by almost everything. Air, glass, lenses. That's   why the entire system has to run in a near vacuum. 
To generate EUV, molten tin droplets are blasted   with lasers inside a vacuum chamber. The light 
is then reflected using mirrors polished at near   atomic precision. This took decades of research, 
much of it pioneered in the United States. Today,   only one company can actually build these 
machines, ASML in Netherlands. And each tool   cost roughly $400 million. And despite that price, 
the economics still work. A single EUV machine   can generate over $600 million worth of wafers per 
year. The real challenge isn't buying the machine,   it's making it to work. And at the leading edge, 
only a handful of companies can do that reliably.   The list is really short. It's TSMC, Samsung, 
and Intel. Which brings us to the real problem.   As transistor nodes shrink, printing gets harder. 
Eventually, you can't print the smallest features   in a single exposure. So, the industry is forced 
to rely on a very complicated workaround. It   splits patterns into multiple passes. This is 
so-called multi-patterning. Imagine drawing   fine lines with a marker that is too thick. 
In this case, you draw every other line first,   then you shift the grid and repeat. This lets us 
produce patterns at least four times denser than   the original. It works, but every extra path add 
masks, costs, and defect risks. Costs rise fast,   and this is a real killer today. To keep scaling 
alive, ASML pushed EUV even harder. The new   version High-NA EUV still uses the same light but 
with far more aggressive optics and that enabled   scaling beyond 2 nanometers towards the Angstrom 
era. These machines are already running at TSMC,   Samsung and Intel but the cost is extreme. Each 
tool is approaching half a billion dollars. The   next step, Hyper-NA EUV, pushing EUV even harder. 
So instead of changing the source of light,   they extracting even more resolution from the same 
light by pushing a numerical aperture that makes   the machines even larger, more complex, and of 
course more expensive. At some point, the machine   becomes so expensive that the chip it enables stop 
making economic sense. Just think about it. By the   end of this decade, leading edge fabs are expected 
to cost $50 billion each. This will further   concentrate advanced chipmaking in the hands of 
just a few companies with massive capital. Wafer   costs are projected to climb to $100,000 per 
wafer. And at that point, advanced chips will   become inaccessible to smaller companies and new 
entrants. You see what's happening? the industry   keep pushing the same technology even if the costs 
rise faster than the benefits. So here is the real   question. What if the problem isn't how far we 
can push the EUV but that we are keep pushing EUV   at all? What if there is a better alternative? 
What if smaller features could be printed in a   single shot at 1/10th of a price? This is where 
Substrate US-based startup proposes a different   path. Instead of pushing EUV objects even harder, 
they abandoning EUV entirely and betting on   X-ray lithography. The idea itself isn't new. 
Researchers have explored it for decades. The   execution is X-rays have much shorter wavelength 
than anything used in today fabs, but they're   extremely hard to control. For a long time, 
the optics simply didn't exist, and generating   stable X-rays meant using synchrotrons. These were 
machines hundreds of meters long, often occupying   the entire buildings, not something you could 
ever put inside a factory. Inside the synchrotron,   electrons are accelerated to almost the speed of 
light. Powerful magnets then bend their pairs and   this motion creates extremely bright X-ray light. 
What changed is not the concept but the supporting   technology. Over the years, the objects 
improved. X-ray sources became more compact   and better controllable. and all this progress 
accumulated and then Substrate pulled all these   pieces together. Instead of adding more masks and 
more steps through multi-patterning, they asked   a simpler question. What if we stop increasing 
complexity and just print it all at once? You can   think about it this way. EUV is like sketching 
a drawing line by line. X-ray lithography aims   to stamp the entire drawing in a single exposure. 
Here we are dealing with electromagnetic radiation   in the range of a few angstroms which is 0.01 
to 10 nm range which makes it up to 1,000 times   shorter than the wavelength of EUV. And this is 
ideal for scaling because this practically means   you can draw smaller features. In practice, 
it's extremely difficult. X-rays pass through   most materials instead of bending where you want 
them to, making them notoriously hard to control.   That's why X-ray lithography lived in research 
papers for decades. The physics is elegant.   Manufacturing has been hard. Substrate claims that 
they've crossed now enough of these barriers to   turn X-ray lithography into real manufacturing 
tool. If this works, it doesn't just change   one tool. It reshapes who can afford to build 
factories at all. Next, we will break down how do   they generate this light and the first Substrate 
results and what it will take them to build a new   semiconductor factory around this tool. While fabs 
are hitting physical limits, AI is disappearing in   the everyday life. At CES 2026, the world's 
largest tech show, everything evolved around   AI. DREO showed what AI looks like when it moves 
directly into everyday products. At the center   is DREO's new AIoT ecosystem where intelligence 
lives directly inside the device. They launched   a new generation of AI powered home and kitchen 
appliances, including the AI sensory lab. Inside,   lightning, airflow, humidity, and temperature 
shift automatically, recreating the atmosphere of   a place you remember. This is AI that understands 
context. Then they brought it into the kitchen.   DREO unveiled an AI powered cooking experience 
that lowers the barrier to cooking to the point   where it becomes effortless, even for me. You 
type what you want to cook or speak naturally and   the system turns this text and voice into instant 
context-aware cooking guidance. And then you taste   it. Food made with Chef Maker. That's what DREO 
showed at CES. AI that turns climate, comfort,   and cooking into something you don't have to think 
about. Now, we are back to the chip factories,   to the core problem. How do you produce X-ray 
light inside a fab without building a particle   accelerator the size of a city block? This is 
where things get really interesting. They're not   sharing much details, but it seems they're using 
a compact particle accelerator built in directly   into the lithography system. Not a kilometer scale 
synchrotron, but something that actually fits   inside a factory. Inside the system, electrons are 
accelerated to near the speed of light using radio   frequency cavities. Those electrons are then sent 
through precisely arranged magnetic structures.   As they pass through these magnetic fields, they 
are forced to wiggle. And when electrons wiggle at   these energies, they emit intense bursts of X-ray 
light. It's the same idea used in a synchrotron,   just compressed down by orders of magnitude to fit 
inside a factory tool. Substrate haven't shared   much technical details on the tool itself, likely 
for competitive reasons, but they have shared the   results. And this is where a conversation shifts 
from theory to evidence. What do they actually   have to show? So far, Substrate has demonstrated 
printing of 12 nanometer features. Those are   directly relevant for building sub 2 nanometer 
transistors. They also claim they can use single   patterning for all the layers. In other words, 
printing in one shot what today requires multiple   complex passes. According to the Substrate data, 
they already achieved the resolution comparable   to ASML most advanced High-NA EUV system. And 
some of the numbers here what really caught   my attention. When we talk about lithography 
quality, consistency matters a lot. They report   consistent feature sizes across the entire wafer 
with accuracy down to about 0.25 nanometers. That   consistency measured in a fraction of an atom. 
If these numbers hold, the implications are   significant. This means we will be able to pack 
more logic into a smaller area and print it all   in one exposure using the tool which costs just 
$50 million instead of $500 million. In practical   terms, that translates to better chips for AI and 
mobile applications at dramatically lower cost.   But that only works if you can control more 
than just this machine. And that's why Substrate   doesn't want to sell these machines, but they want 
to build the entire manufacturing process around   it. And there is a reason for that. And these 
nodes lithography alone is not enough. X-rays   don't behave like the light today's fabs are 
build around. They carry far more energy which   means the materials that work for EUV simply stop 
working here. Here Substrate has to reinvent the   photoresist itself. And the same applies to 
masks and optics and then there is a risk of   damage and noise. X-rays can push straight through 
materials. If they are not controlled perfectly,   they can damage transistors or introduce subtle 
defects that destroy the yield. And finally,   there is a topic of throughput because currently 
Substrate has a demo, but full scale semiconductor   manufacturing is an entirely different universe. 
Making something work once in a lab is one thing.   making it work reliably across hundreds of 
millions of wafers at the most advanced nodes.   It's something else entirely. That's why most 
chip makers have dropped out of leading edge   manufacturing over the years. At mass production 
scale, tool has to run fast all day every day   around the year. And for EUV, it took more than a 
decade to make this jump. X-ray lithography would   have to go through the same process. So, Substrate 
doesn't plan to sell tools. Instead, they want to   build their own factory in America, install their 
own machines, figure out the recipe, and then   offer foundry services directly, and this will put 
them in direct competition with players like TSMC   and Samsung. So, this is not just about inventing 
a new tool. It's about inventing entirely new   factory and the foundry model around it. And this 
will take at least another five years. And this is   where reality hits. There is a reason NVIDIA stays 
fabless and lets TSMC handle manufacturing. TSMC   didn't just buy machines. They built recipes over 
decades. They invested hundreds of billions into   yield learning and manufacturing discipline. And 
just imagine, all of that only pays off for them   because of scale. TSMC runs around 30 factories 
and produces roughly 1.6 million wafers every   month across many customers and products. And 
that combination of process mastery, volume,   and packaging is why matching or especially 
beating TSMC is so hard. So we will see because   this could be a start of a new era or just lesson 
on how unforgiving chip manufacturing actually is.   If Substrate plan works, the implications go 
far beyond technology. Advanced chipmaking is   now tightly linked to economic power and national 
security. And the most important promise here is   simple. Costs drop dramatically. To see why 
that matters, just look at space. For many,   many years, it was government-only domain. 
Launches were rare and incredibly expensive.   Tens of thousands of dollars per kilogram to 
orbit. Then SpaceX changed just one assumption.   Rockets didn't have to be disposable. Reusability 
cut launch costs by roughly an order of magnitude   and that single shift changed everything. Lower 
prices unlocked new markets, faster iterations,   entire industries that didn't exist before. So the 
same logic applies here. If this new tool can cut   the cost of advanced chip manufacturing by half, 
the consequences are enormous. For innovations,   for startups like mine, this would make a huge 
difference because currently tape out in advanced   nodes costs millions of dollars, which basically 
means you get just one shot. If you can drop   costs, it means you can do more attempts, faster 
iterations. that will accelerate innovation and   ultimately expand how much compute is available 
for AI and everything built on top of it. It's   also important to be clear that Substrate is not 
the only one company who is working on particle   accelerators as light sources. In the United 
States alone there is also xLight and Inversion   and they are building particle accelerators 
and there also research ongoing in Europe,   Japan and China. But unlike Substrate they 
are solving a different problem. Most of this   efforts focus on the light source itself. How 
to generate brighter EUV or soft X-ray light to   push existing lithography further. For example, 
xLight is building a free electron light source   designed to extend EUV and this fits into the 
existing road map and eventually it will help ASML   tools to go further but it doesn't replace them. 
Substrate is aiming much higher. They trying to   replace entire lithography step with a completely 
different tool and then rebuild the whole chip   manufacturing process around it. If they succeed, 
the effects compound quickly and accelerate the   progress in computing. And this one will drive 
progress everywhere else. Throughout history,   advances in civilization have closely tracked 
advances in computing, which is why we care   about technology and chips a little obsessively. 
And if you do too, remember to subscribe to the   channel. And now watch this episode where I take 
you inside the secret chip factory to see how the   future transistors are being developed. Or watch 
this episode where I break down step by step   what it takes to build the microchip factory 
from scratch. And I will see you there. Ciao.

---

## 5. This Will Power Everything
**Channel:** Anastasi In Tech | **Views:** 408K | **Date:** 1 month ago | **Duration:** 26:24 | **ID:** KTyNig7enkQ
**Link:** https://youtube.com/watch?v=KTyNig7enkQ

### Transcript:
Across the planet, entire landscapes are getting 
wiped and rebuilt. Fields, suburbs, open land,   all turning into AI data centers almost overnight. 
And each new one is bigger, pulling more power and   more water. The scale keeps rising. The physical 
limits stay put. Silicon and electrons carried us   as far as they could and that gap can only be 
closed by an entirely new technology. It's the   hottest problem in the industry today and a search 
for a solution triggering a new gold rush. I am   coming from chip design and in this industry it's 
quite rare that you see a shift that big and even   more rare that you can explain it as it happens. 
So in today's episode, we will cover three key   innovations that form the blueprint for how AI 
data centers will scale over the next two decades.   Subscribe to the channel and let's get into it. A 
single next generation AI campus now draws 1 to 2   GW of power. That is the same order of magnitude 
as an entire metropolitan area. In some regions   like Virginia, data centers already swallow a 
quarter of the grid and we are still just getting   started. Inside these buildings, millions of GPUs 
crunch data and dump heat into the air. And once   this heat hits the room, it has to be pushed away 
just as fast. Almost 40% of the total power inside   a modern data center doesn't go to the chips at 
all. It goes straight into cooling, eaten up by   giant chillers humming in the background. The real 
problem is not even this massive compute at this   intense AI workloads. It's this sheer volume of 
data being moved because we simply moving too   much data and doing it wrong. Because AI data 
centers aren't just bigger data centers, they   are something entirely different. This is Meta's 
Hyperion project in Richland Parish, Louisiana.   The largest AI data center ever attempted in 
North America. Hyperion is a computer the size of   Manhattan. And this is just one AI cluster planned 
to scale to 5 GW. Inside over 1 million GPUs,   acting as one single AI supercomputer. What 
used to be a warehouse of computers has now   become a single computer this size of a city. And 
when a single workload spans an entire building,   every link delay becomes a choke point. And here 
the network stops being the connection and becomes   the computation itself. The bottleneck is no 
longer inside the AI chips. It lives between them.   And this is why the new gold rush in AI data 
centers is actually in the network itself.   Who is getting rich when there is a gold rush? 
The guys who sell the shovels. Now let's find   the shovel sellers. At the center of all of it is 
copper. The metal that carried the entire digital   revolution. Right now it's everywhere inside data 
centers between chips across boards. across racks.   A single hypers scale AI site can swallow 50,000 
tons of it. For decades, copper was familiar,   perfect, cheap, and easy to route. But today, it's 
exactly the thing that holds us back. At modest   speeds, copper can carry signal over hundreds 
of meters. But at tens of gigabits per second,   that shrinks to just a few meters. So companies 
are trying to get their racks as close as they   can and lace them together as tight as possible 
with copper. But obviously that's not something   that's going to scale going forward. And 
if you try to push signal even faster,   you are getting down to just a few inches because 
the faster you're trying to push the signal,   the more it's getting attenuated. Basically the 
faster it travels, the weaker it becomes. that   at some point it just becomes unusable. To 
keep the signal alive, you stack equalizers,   amplifiers, retimers, and each of these burning 
more power. And suddenly every cm cost you even   more power and heat. And this is the biggest pain 
point in AI infrastructure today. At some point,   you can double the number of processors and 
see almost no speed up because the network is   suffocating them. At this point, copper has taken 
us as far as it can. And the only medium left with   enough runway is light. Because once information 
rides photons, all the old constraints fall away.   Light plays by a completely different set of 
rules. Photons do not grind through resistance in   metal. They do not spill energy as heat when you 
push them to move faster or further. You finally   get a medium where sending more data does not mean 
fighting more heat. It's like switching from a car   which is constantly stuck in the city traffic 
to a train that is gliding on its own rails.   And optics is already working beautifully in a 
distance. It's a backbone of every data center,   every rack-to-rack switch, every long haul fiber 
that keeps internet alive. Right now, optics is   literally everywhere except for the place where 
we need it the most, right next to compute on the   chip. There is still an electrical path between 
the chip dice and between the chip and those   optical switches. And that short copper hop is 
where all the power, latency, and heat spike.   And inside an AI supercluster, that difference 
is everything. This last few centimeters bringing   optics to the chip is where the entire 
industry has been stuck for over a decade.   And this is where things start to get really 
interesting because bringing optics to the chip   sound quite simple, but it was actually a physics 
nightmare. The problem is classical photonic parts   force a painful tradeoff. The device you see 
on the screen is basically a transistor of the   photonic world. It's so-called modulator. It takes 
your data and turn it into light. For now, you can   imagine it as a device that shapes and controls 
photons the way transistor controls electrons. As   you can see, some of these devices are huge by 
microchip standards. Look at this Mach-Zehnder   interferometer. It is obviously too big to place 
it on a tiny chip next to nanoscopic transistors.   Others are tiny like this micro ring modulator, 
but they drift with the slightest temperature   change. These are so sensitive that even a 
2° temperature shift knocks them out of tune,   while high performance GPUs leave through brutal 
temperature swings. Imagine hundreds of watts   of power packed into a few square cm of silicon. 
Here temperatures jump from 30° C at idle to 90° C   under training load. Sometimes it happens in a few 
seconds. Thermal stability becomes the hill where   the most of photonic ideas die. This is why every 
skeptic argued that this would never work. How can   you put something so sensitive next to something 
so hot? And for the last 20 years, this is exactly   where photonics failed. These last 2 centimeters 
are the most important 2 cm in a data center. And   now for the first time, we can actually cross 
them. If you look at what happened over the   last years in a nutshell, it's fun because it's 
sort of a steady march of flight trying to get   closer and closer and closer to the transistor. 
At first, optics lived far away out in the cables   safely isolated from heat and noise. Then they 
moved onto the motherboard. Then co-packaging   brought them right beside the compute die. And 
each step was a small rebellion against physics.   And now we are chasing the final form, the optical 
interposer where light moves between compute dies   the same way copper does today. That's the real 
end game. And this is why this gold rush is so   fierce because the one who cracks it will control 
AI infrastructure of the future. But to get there,   we still have two problems to solve. First, we 
need a good on-chip modulator. A device which is   tiny enough, fast and can survive huge temperature 
changes. Second, we need something that can   actually generate light inside the chip. At the 
same time, live inside this thermal chaos. Today,   this light source usually sits outside the 
package. But we want to bring it in. And   this is where everyone been stuck because light 
hates heat. Silicon hates light. And traditional   photonics was never designed to sit inside a 
multi-kilowatt package. But now something changed.   A big innovation, a breakthrough cracked both of 
these problems. And we will deep dive into it in   a moment. But before that, here is the same idea 
playing out right on your desk. A good computer   today is no longer just convenience. It shapes how 
efficiently you think, build, and ship results.   Whenever I build a PC, I start with the part that 
matters the most, the processor. And here I go for   the one that can actually keep up with my insane 
workflow. That's AMD Threadripper Pro 9000 series.   This one has highest specs for professional 
workloads. Here you get massive memory bandwidth,   huge RAM capacity and enough PCIe lanes to drive 
multiple GPUs and fast storage without slowing   anything down. Threadripper Pro has 96 cores 
and up to 192 threads. While AI development   scales with course, you get faster training 
and inference and much better responsiveness   when running models locally. It's also essential 
when you're running large engineering simulations   or any workloads which pushes large data 
sets through the system. These workloads   often involve sensitive data. The AMD secure 
processor provides hardware level protection. It   verifies code before it runs and blocks anything 
untrusted. And this is essential for enterprise   and research environments. AMD Threadripper 
Pro 9000 series is targeted at professional   workstation users, especially across the fields 
of engineering, research, manufacturing, design,   and AI. Check it out through the link below. 
And thank you AMD for sponsoring this episode.   Now back to the gold rush. Traditional photonics 
was never designed to survive inside the hot GPU   package. For 20 years is where every optical dream 
was challenged until one group refused to give up.   Imec. It is a small semiconductor research hub 
in Belgium. a nonprofit semiconductor lab where   the biggest tech companies test ideas long before 
they reach industry. Imec is strongest whereas the   rest of the world struggles the most materials. 
Over the years they kept looking for something   better than silicon and they found one. The entire 
modern world runs on silicon. It switches current   beautifully. It holds charge well. It lets you to 
pack billions of transistors into a single die.   But the moment it needs to emit light, the physics 
refuses to play along. To generate a photon,   you need a clean direct energy drop inside the 
crystal. Silicon doesn't give you that. Instead   of emitting photons, it's just loses energy 
as heat. That's why we need something better,   something that actually likes producing photons. 
Imec went through almost the entire Mendeleev   Table, testing crystals, tuning chemistries. Most 
materials broke down. Too lossy, too fragile,   impossible to grow on real wafers. But one kept 
rising to the top. Gallium arsenide. It blends   light cleanly, runs cooler. If you want a stable, 
bright, efficient light source, gallium arsenide   is at the top of the food chain. But there was 
actually one huge problem. Manufacturing. Silicon   comes on 300 mm wafers and we have mastered 
that world. Gallium arsenide wafers are small,   expensive, and mechanically nothing like silicon. 
For most of the industry, that clash was the   end of the road. This means you could pick 
silicon or you could pick gallium arsenide,   but not both. While we need them both at the same 
time layered on top of each other so we can bring   light right above the compute so that light 
and logic can finally leave on the same chip.   Through iterations, they figured out how to 
grow tiny gallium arsenide lasers directly   on silicon. Imec's trick was simple in idea but 
hard in execution. Instead of trying to force a   big block of gallium arsenide on top of silicon 
and watching it crack, they craved tiny V-shaped   trenches into silicon and grew the material 
inside those microscopic channels. These walls   trapped the defects before it could spread. The 
crystal aligned correctly. And for the first time,   gallium arsenide could sit on silicon without 
tearing itself apart. That tiny geometrical trig   changed everything. And now we can build lasers 
on silicon and reproduce it at mass scale. But   this breakthrough exposes a bigger challenge. Now 
we need to find a way to encode data into that   light. Remember those modulators? Now we need 
a device which is tiny and reliable and which   can sit right next to the chip and survive 
these extreme temperature swings. Silicon,   the backbone of every chip you ever touched, 
just can't do it. It's too slow, too lossy.   Great for logic, but terrible for bending light 
at this extreme speeds. So, the search continued.   Labs started tearing apart the periodic table, 
looking for something tougher, something faster,   something that wouldn't fall apart at 90° C. And 
that trail leads straight to Silicon Germanium.   That's quite a legendary material for photonics. 
on periodic table. It sits right below silicon and   it's close enough to cooperate but still different 
enough to do things which silicon can't. It react   fast to tiny electric fields and it stays stable 
even when the temperature swings wildly. Honestly,   I wish I handle stress the way Germanium handles 
temperature swings because this single difference   changes everything. We knew that Germanium is 
great for modulation at least for a decade. But   one huge problem stopped everyone manufacturing. 
Silicon and silicon germanium lattices are not   naturally compatible. On paper they should 
work, but the moment you force them into the   same crystal, everything clashes. Their crystal 
lattice don't line up. That mismatch builds stress   between the layers, create defects, dark current, 
and long-term reliability problems. So, Imec had   to fix the material itself. And they did it the 
hard way layer by layer. years of optimizing how   Germanium grows on silicon, controlling stress, 
tuning, dopping to keep dark current low,   shrinking the footprint until the device was both 
fast and stable. As a result, it finally behaves   well on top of silicon wafer. And now everything 
snapped into the right place. With that,   they build a modulator device that can push about 
440 gigabits per second per lane. That's more than   the double of the industry standard. Just think 
about it. This tiny microscopic device can fire   half a trillion pulses every second. This one 
device moves as much data as an entire bundle of   high-end copper lanes with a fraction of the power 
for AI systems and especially for SerDes. This is   massive. Now combine these two innovations 
we discussed, laser and silicon germanium   modulator and we can finally cross the last two 
cm and bring light right to the chip. That's why   Celestial AI went all in on Germanium. They spent 
years building their own Germanium modulators. At   the Hot Chips conference this year, they were 
showing chiplets at speeds that made copper   and MZIs look old. And just some days ago, Marvell 
bought them for more than $3 billion. This is why   everyone calls it an "all or zero bet" because the 
outcome determines who controls the gateway 200   terabit per second per rack. While some teams 
bet on this innovative Germanium modulators,   others bet on completely different path new TSMC 
COUPE technology and this one is based on micro   ring modulators and typically TSMC knows what 
they're doing. The next big thing is being built   inside TSMC factory so-called COUPE technology 
compact universal photonic engine. Think of it as   a complete optical module inside a single package. 
Inside COUPE, you have an electronic chip tightly   integrated with a photonic chip. The electronic 
chip drives modulators and read photo detectors  while the photonic chip roots the light and 
modulates it. Here TSMC manages to bond them   micrometers apart. So, electrons and photons 
hand off almost instantly. And that stack does   the whole optical pipeline in one place. It takes 
electrical signals from the accelerator or a GPU,   turn it into light, send that light over fibers, 
catch it on the other side, and convert it back   into signals that GPU or an AI ASICC can actually 
use. And that's a big deal because it unlocks   terabit speeds, slashes power by at least three 
times, and finally gives us a clean path to scale   it all the way to million GPU AI factories. And 
just a few days ago, Ayar Labs unveiled the first   chip built using COUPE technology. And the biggest 
semiconductor giants are already lining up to get   their hands on it. While the biggest players 
are betting on COUPE, a couple of bold teams   are taking a huge moonshot on Germanium. But 
for Germanium, they have to still figure out   actually the hardest part reliability. And the 
stakes are very high here because if Germanium   bet eventually work out, if these devices 
survive long-term stress, keep dark current low,   that will be the huge success story. This is a 
multi-billion dollar market. This will change   how we build and scale AI data centers and that's 
why entire industry is watching it so closely. And   if you want to stay ahead of shifts like this 
and be informed about the most important trends   in the industry in chips, data centers, and AI, 
remember to subscribe to the channel. But probably   the most interesting company in AI right now is 
Lightmatter and they are not building bigger GPUs.   They're going after the most annoying problem in 
AI infrastructure, the last two centimeters. This   is Passage. It's an optical layer that sits under 
the processor. It lets many chips inside one giant   package talk directly to the outside world using 
light. It works by sending data vertically from   each chip into a photonic layer, then out through 
optical waveguides. So every chip has its own fast   exit lane. That technology is the future. 
As we build larger and more powerful chips,   we pack more chiplets into one package. Passage 
enables all chips in a huge package to send and   receive data at the speed of light without waiting 
in line. That means you can build much larger   chips and keep them all busy instead of idle. 
So, Lightmatter is really the bleeding edge on   how fast these systems can be. We're about 8 to 
10x faster than any of the companies that are out   there. People are announcing 8 TB and 6 TB. we're 
at 64 and Passage has a couple unique properties. one of them is that it allows you to build 
very large chip packages. So, if you look at   the way that people do interconnect today 
for scale out networking and some, you know,   forms of scale up, they use these pluggable 
optical engines. Pluggable optics, they cost,   let's say, roughly 70 cents per gigabit per 
second. The cost of integrated optics like what we   do at Lightmatter is significantly lower. So you 
actually have a lot more performance for the same   amount of money. So it's kind of an obvious win 
and that's why the industry will adopt it. It's   clear that the future of AI factories will run on 
light, not copper. And the technology we discussed   today form the new blueprint. Optics is about to 
become the real continuation of the Moore's law.   Your speed is no longer about how many transistors 
we can pack on a chip or how fast this chip is,   but how fast can hundreds of thousands of AI 
chips behave as one computer. If you zoom out   and look at the bigger picture, every jump in 
human capability at civilization level came   basically from two things. Better ways to compute 
and better ways to move information. Writing let   knowledge survive over time. Transistors let us 
automate thought and build thinking machines.   The internet linked billions of minds and machines 
at once. AI is the next layer. The story of human   progress is about how fast information can move 
through our tools. And copper got us to the first   smartphones and early AI. Light is what will push 
us to the next milestone in our civilization and   right now optics becomes the next main driver in 
how computing evolves and with it humanity itself.   If you enjoyed this episode, you will definitely 
love this one where I explain the largest AI data   center without a single GPU. Or this one where I 
take you inside a secret microchip factory where   the future of technology is being invented before 
it comes to your phones in 2030. Check it out. And   I wish you happy, warm, beautiful holidays. Thank 
you so much for watching this channel this year,   for being a part of the community. I love you 
guys and I'm going to see you in 2026. ciao

---

## 6. Why Everyone Is Moving Away from NVIDIA
**Channel:** Anastasi In Tech | **Views:** 465K | **Date:** 2 months ago | **Duration:** 31:03 | **ID:** N10w1KvFKNQ
**Link:** https://youtube.com/watch?v=N10w1KvFKNQ

### Transcript:
There is a tectonic shift underway in computing. 
Something so massive it's reshaping the   entire energy industry, computing and even 
geopolitics. Let me show you. Last December,   it was just quiet farmland. Today, it hosts 
one of the largest AI data centers on Earth.   close to 1 million AI processors under one 
roof pulling up to 2 GW of power. And the   most remarkable detail inside there is not a 
single GPU. This is the first AI supercluster   of this scale built without a single GPU. And 
this is either the smartest bat in modern AI   or the most expensive miscalculation in the 
history. I have spent more than a decade in   semiconductor industry. But nothing prepared me 
for this. Across the planet, farmland is giving   way to data centers. Mother Earth is starting to 
look like a motherboard. This is rural Indiana. a   quiet town called New Carlisle with population of 
1,900 people. Today, it hosts the project Rainier,   an 11 billion AI supercluster. Amazon didn't 
just stumbled into Indiana. This was a calculated   choice. vast affordable land, space to expand far 
beyond what exists today, and most importantly,   the access to power grid that can deliver more 
than 2 GW of power. The project was announced last   year and somehow it's already operational under 12 
months. For something that large and that custom,   that's a breakneck pace. And the timing is 
no coincidence. Right now, the largest tech   companies on the planet, Google, Meta, Amazon, 
and others are locked in the race to control   AI infrastructure itself. Not just the models, 
but the physical foundation these models run on.   Hundreds of AI clusters are racing across the 
United States, Europe, and Asia, and almost   all of them follow the same formula. Endless rows 
of GPUs. But Project Rainier breaks that pattern.   It's already operates 7 buildings with planned 
for up to 30 total buildings on that site alone.   What makes it fundamentally different is 
what sits inside. Instead of filling all   these rooms with GPUs, Amazon build the system 
around its own in-house design chips which are   integrated in quite a different infrastructure. 
And that decision changed everything economically,   technically and strategically. And this 
is where all the risks begin. Until now,   the rules were simple. Buy GPUs, scale, 
repeat. The more the better. Okay. And so,   anyways, the more you buy, the more you 
save. In the largest AI superclusters,   GPUs are now effectively everywhere. Take 
the world's biggest AI supercluster today,   xAI's Colossus 2 in Memphis. It runs close 
to 1 million NVIDIA Hopper and Blackwell   GPUs under one roof. This model is powerful and 
proven. It's also scaling in a predictable way,   but it is showing cracks. Explosive demand 
has made GPUs the primary constraint and   it got worse as manufacturing delays started to 
pile up and actually the bottleneck shifted from   chip production to packaging. The interesting 
part is that Blackwell GPU relies on TSMC's   advanced packaging technology so-called CoWoS-L 
packaging Chip-on-Wafer-on-Substrate packaging.   This packaging tightly integrates high bandwidth 
memory directly with the GPU on a one single   massive interposer. That single packaging step 
has quietly become the true chalk point of the   AI supply chain. Demand for Hopper and Blackwell 
systems now exceeds what TSMC advanced packaging   capacity can physically produce. As someone who 
spent years in the industry, seeing what happening   with Blackwell genuinely scared me. Lead times 
stretched into months. Costs climbed and not just   for the chips, but for everything around them. 
Many still think NVIDIA is selling GPUs or graphic   cards. In reality, they control the entire AI 
ecosystem while actually they sell infrastructure   server platform like AGX platform including 
networking solutions and enterprise software.   This means big tech and AI labs were no longer 
simply buying compute but buying into an entire   controlled ecosystem. When a single high-end 
rack can approach $3 million, you can imagine   what it means to fill an entire data center with 
thousands of them. At the same time, workloads   kept exploding. Models jumped from billions to 
tens of trillions of parameters. Training cycles   stretched across many months. Power demand climbed 
into the gigawatt range. Suddenly the performance   alone was not the main constraint. Cost and 
efficiency became just as critical as the raw   compute. And with that competition just changed 
its nature. Now hyperscalers are no longer racing   to train the best models but also to control 
the silicon these models run on. And this is   the pivotal moment where the whole trajectory is 
shifted. Amazon saw it early. Even at their scale,   they did not have the control of its own 
AI infrastructure. It had to be owned,   controlled and optimized from the inside. So the 
strategy had to change. Amazon decided to build   its own silicon called Trainium. It is so-called 
ASIC Application Specific Integrated Circuit.   It's built for monthlong process of training 
large language models. Trainium circuits are   designed for this intense process where large 
language models are created, refined and scaled   over many months. And you can actually see this 
on silicon. It's the beauty of ASICs actually   because you can take the core defining algorithm 
and literally engrave it in silicon and that   unlocks the efficiency which software algorithms 
can merely imitate. Inside Tranium 2 you do not   find countless small GPU style cores. You'll 
find large number of neuron core wrapped in high   bandwidth memory. At a high level, it mirrors the 
philosophy behind Google TPU. Two compute dice,   four stacks of high bandwidth memory, an advanced 
CoWoS-R packaging. All of that optimized for cost   efficiency and a smooth supply chain. Inside 
data centers, these chips scale like a root   system. Trainium units sit in trays. trace 
form servers. Racks connects through Amazon's   custom network fabric until thousands of AI 
processors behave like one colossal machine   spanning entire buildings. According to Amazon, 
this setup delivers roughly 50% better pricing   than comparable GPU based systems. And that's a 
big deal. Plus this custom solution can reduce   data center energy consumption by up to 40%. And 
that is the whole point not to outmuscle GPUs on   the raw performance. This is still very distant. 
The objective is more strategic to control the   infrastructure to tame the cost curve and dictate 
the economics. At Amazon re:Invent event a couple   of days ago. They announced the new Trainium 3 
chip built in 3 nm process. 4.4x more compute, 3.9   times the memory bandwidth. And this one is super 
important. Five times more AI tokens per megawatt   of power. And as a special surprise, I have a 
rack of our Ultra servers on stage with me today. And this is where the story pivots because this 
project isn't limited by money or silicon. The   first battle isn't compute. At this scale, it's 
power. When you build an AI data center, you are   not just stacking servers. You are orchestrating 
power lines, substations, on-site generation,   cooling loops, transformers, and grid stability. 
When fully built, this site is expected to draw   more than 2 GW of power. In a town of just 
1,900 people, one AI campus now rivals the   power appetite of an entire region with millions 
of homes. And the local grid was never designed   for a machine of this magnitude. The problem was 
not even the scale but stability. Massive load   pushing the grid to its limits hovering very 
close to blackout. Here finding energy is just   a half of the story. Real challenge is keeping 
it perfectly steady. And that's a fundamental   difference because traditional data centers were 
built around storage and routine compute. While AI   data centers are a different beast, they require 
extreme performance, extreme compute density,   GPUs don't draw power smoothly. They demand jumps 
up and down in milliseconds. If the supply cannot   keep up with the swings, the entire system becomes 
unstable and a sudden surge can drop voltage and   in the worst case ripples through entire holes and 
restarting those runs burns millions of dollars   in wasted compute. Here, Amazon had to reinvent 
how the power flows in a data center. In fact, it   doesn't flow directly from the power grid to the 
racks. It passes through a special stabilization   system that smoothes out every shock before it 
reaches the hardware. At Rainier, Amazon deployed   a large scale battery system to absorb power 
fluctuations. They store energy when demand is low   and release it instantly when demand surges. The 
result is calm, predictable power feeding hundreds   of thousands of AI chips without interruption. 
And this is where the shift becomes obvious.   Hyperscalers are no longer just building data 
centers. They're literally turning into energy   developers. Just like Amazon along AI campuses, 
they are funding power plants, reinforcing grids,   and investing in renewables. and all of it to 
lock in cheap reliable electricity before anyone   else gets there first. And at the same time, 
they're pursuing the second level of control   designing custom silicon to squeeze as much 
compute as possible from every watt of power.   And this actually defines the next stage of AI 
development because the race is no longer about   performance. It's about who can engineer a whole 
system where power, cooling, silicon, and data   moves in a perfect lock step and keep working 
as scale moves from colossal to absurd. And if   you're enjoying this episode and you care about 
where the whole computing is heading, subscribe to   the channel. And this race at the infrastructure 
level is reshaping another one just as critical   skills. We are coming at the end of the year and 
AI was one of the most in demand skills as of 2025   according to the World Economic Forum and as 2026 
approaches the demand is only accelerating. Yet   many people still have not learned it. That's why 
I recommend you join me for the 2-day AI workshop   by Outskill. They're hosting a live workshop 
this Saturday and Sunday from 10:00 a.m. to   7:00 p.m. EST on both days. More than 10 million 
professionals just like you have already attended   this training. from marketers to engineers to 
founders. And many walked away not just smarter,   but with skills they can monetize. And the timing 
is perfect because right now they have a special   holiday offer. And you can attend this training, 
which usually costs $395 for free. I highly   recommend you to join this training because you 
will be mentored by AI experts from companies like   Microsoft and NVIDIA. Inside this 16 hours, you 
will learn how to use AI to simplify your daily   work. Build AI agents. Automate your workflows 
across Sheets, Notion, and CRMs. Create realtime   AI systems you can use for your job, business, or 
project. You will also receive bonuses worth over   $5,000 if you attend both days, including a prompt 
bible, a personalized AI toolkit, and a roadmap to   monetize these skills. This is your opportunity to 
step into 2026 sharper, more skilled, and ready to   level up your career. Register right now through 
the link below or scan the QR code here and join   their WhatsApp community to stay updated before 
the training starts. And thank you Outskill for   sponsoring this episode. Well, securing 2 GW of 
power only unlocks the next problem. The moment   electricity hits the servers, it becomes heat 
and the scale is unforgiving. It's roughly 2 GW   of heat wrapped inside four walls. Now, how do you 
remove all of that heat? To cool a data center at   this scale, it takes millions of gallons of water 
every day. In extreme cases, it pulls from the   same water supply people rely on for drinking and 
sucks their aquifers dry. Project Rainier stepped   straight into that pressure point. It pulls from 
the local environment in Indiana while operating   an AI supercluster with extreme cooling demands. 
The water problem was immediate and impossible to   ignore and Amazon took a strangely different path 
here. They designed Rainier to minimize water use   as much as possible. They designed it in a way 
that cooling leans heavily on outside air. From   October to March, it uses no water for cooling at 
all. And in warmer months, water is only used for   a few hours per day on average. And it looks 
almost counterintuitive. To make this work,   Reineer relies on massive fan walls and relentless 
airflow. The system stays in constant motion.   But this choice carries consequences. more noise, 
more power draw, and more strain on the electrical   system. In general, water is much better at 
absorbing and moving away the heat. It's roughly   30% more efficient than air. This means it allows 
to pack more compute in the same space and lower   the energy consumption. This particular design 
reflects a calculated compromise, a core dilemma   at the heart of modern AI. Protect water but burn 
more power. Save energy but strain local water   system. Every decision here carries a cost. And 
a search for new power sources is a part of the   answer, but it doesn't erase the core dilemma. But 
even if you build the best silicon in the world   and the best cooling system, still there is one 
thing that decides everything. The whole system   and a huge role here plays the network. Unlike 
data centers built around NVIDIA's infrastructure   which lean heavily on optical networking, Amazon 
chose a different path here. They've built a   custom network which is based on dense copper 
wiring. Optical interconnects at this scale is   extremely powerful. It's allowing for higher 
bandwidth and more elegant layouts at extreme   scale, but it's also extremely expensive. Amazon 
went for copper for extremely practical reasons.   its cheaper, more familiar, easier to install 
and deeply embedded in existing data center   infrastructure. Engineers know how to bend it, 
root it and scale it fast. But all that copper   comes with consequences. AI data centers are very 
different from typical data centers because here   we are pushing towards extreme bandwidth like 
800 Gbit per second and moving up towards a   terabit per second. And here copper runs into hard 
physical limits. What used to work in a typical   data center over long distances now only works 
over a few feet. Suddenly physics pushing back   and generates loss of heat. And yet Amazon stayed 
with copper only partially introducing optics for   longer distances and paired it with aggressive 
cooling techniques and obsessively controlled   layouts. The result works but at the edge where 
suddenly every inch of rooting matters. This scale   of investment we discussed today and this massive 
scale of buildout only makes sense when you have   an anchor customer, someone who would truly 
benefit from that much compute. Microsoft has   OpenAI, a tight partnership that has evolved into 
a stable multi-billion dollar revenue engine for   Amazon. This anchor customer is Anthropic. Their 
Opus 4.5 model is one of the best in the world.   Their revenue growing five-fold and approaching 
$5 billion annually. Amazon has invested roughly   $8 billion in Anthropic. And Anthropic has 
committed to running its flagship models on   Amazon's Tranium chips. If you're using any of 
Claude's latest generation models in Bedrock,   all of that traffic is running on Tranium, which 
is delivering the best end-to-end response times   compared to any other major provider. And that's 
part of the reason why we've deployed over 1   million Tranium chips already to date. Now, we've 
gotten to a million chips in record speed. And   that's because the whole process, we control 
the whole stack. We can optimize end-to-end   how we roll it out. And it allows us to move even 
faster. And this is where the strategy turns both   very powerful and dangerous. What's interesting, 
this Trainium 3 chip was co-designed in close   collaboration with entropic team. In practice, 
their model architecture shapes the silicon. The   silicon in turn accelerates the models and this 
is the true edge and the true beauty of co-design   which unlocks this efficiency which general 
systems can never reach. Until recently this   level of co-design was almost exclusive to Google 
and Deepmind through TPU. TPU is Google's in-house   design chip Tensor Processing Unit. Google's TPU 
is one of the purest expressions of what an ASIC   or a specialized AI accelerator is meant to be. 
Gemini 3, one of the best models on the planet,   runs on Google Cloud powered by these chips and 
now everyone wants it. Google is selling it to   external customers. xAI and Meta are circling. 
Anthropic is placing massive TPU orders. So why   all the top AI labs are lining up for these chips? 
Because GPUs designed for versatility. Their power   is flexibility and raw peak performance. While 
Trainium and Google's Ironwood TPU and ASICs in   general, they're intentionally sacrificing this 
to maximize efficiency. While currently everyone   is caring less and less about these benchmarks and 
more and more about one brutal metrics performance   per dollar and this is where the story turns 
because Amazon isn't just scaling compute it's   betting on delayed return but can they repeat 
the kind of success Google pulled off with TPUs?   Tranium 2 chips still have to prove itself 
at this massive scale and its success tightly   depends on the system and on the software and 
on success of Anthropic. This is the tension,   tension at the heart of Rainier. Now if we zoom 
out and look at the bigger picture Rainier is part   of a much larger buildout. Amazon is committing 
another 15 billion to Indiana alone, which means   more land and over 2.4 GW of new capacity. Across 
the United States, Amazon is investing over $100   billion in AI infrastructure in 2025 alone. And 
these new sites will power enterprises and AI   labs like Anthropic running and industrial 
intensity. Some of them will run on Trainium   chips while other sites will load up on GPUs for 
flexibility and immediate demand because customers   want options. Amazon runs basically both tracks 
in parallel custom silicon and GPUs and they are   not betting on a single future. They letting the 
market to decide which one survives. Everyone is   talking about AI bubble. But the real problem is 
structural. Anthropic's spends heavily on Amazon   cloud. Google also invested another four and a 
half billion in Anthropic and Claude now runs   across both ecosystems Amazon Trainium chips and 
Google TPU infrastructure. It's a capital loop.   Big tech injects money into AI labs. AI labs spend 
it on compute. New models need more compute and it   drives even more chip sales. The danger is that 
this cycle repeats faster than the actual profits   can catch up. And that's pretty exciting because 
now this story is not just about custom silicon   and building better chips. It's about the control 
over the most scarce resource in the whole AI   infrastructure power. And here Amazon's strategy 
is very strong. At first, they aimed to build more   efficient chips. But the real strategy is a full 
vertical control chips, software, data centers,   energy sourcing, and renewables. Here, the 
clearest signal is in Pennsylvania, where   Amazon acquired a 960 megawatt data center campus 
right next to the nuclear power plant. Actually,   the data center is connected straight to the power 
plant and this gives Amazon access to almost 40%   of all the electricity the plant produces. And 
this is a very powerful strategy because you   cannot simply drop a data center anywhere. Power 
for this scale must be engineered years before   the first server turns on. That is why Amazon 
is moving so aggressively and investing a lot   in nuclear power plants, large scale battery 
systems and renewables. More importantly,   it places all its data centers besides stable 
base load power. Ohio, Mississippi, Pennsylvania,   new sites keep switching on. These are not just 
data centers. This is a distributed power grid   spanning across the entire United States. And the 
future winners in AI will not just be the ones   with the smartest models. It will be the ones 
who secured power, land, and silicon first and   then aligned them together in one system that can 
scale without becoming too expensive to sustain.   And this is also a super interesting moment where 
AI hardware stops becoming a one vendor story. We   discussed Amazon and Google but also Meta is no 
longer just buying chips. It's designing them   with the help from Broadcom. Microsoft is also 
following the same arc and AMD is closing much of   the performance gap while steadily improving its 
software stack. We constantly see a wave of new AI   accelerators being announced and just as quietly 
many of them disappear. Not because the idea is   wrong but because the bar is too high because it 
is not just about the chips. If you cannot build   a system which is meaningfully faster, cheaper and 
more efficient that what you can already buy off   the shelf, then why to build it at all? Tesla DOJO 
is one example. Beautiful moonshot. Years of work,   a lot of inventions, world class team. Yet this 
year it was shut down. Startup Graphcore burned   $700 million building custom AI silicon, betting 
on the wrong algorithm. Still looking at success,   huge success of Google custom silicon and 
the general hyperscalers push for designing   in-house chips, it's quite clear that the future 
will belong not to a single vendor or a single   architecture. It will live across an ecosystem 
with GPUs for flexibility, custom accelerators for   efficiency and advancements in silicon photonics 
which will allow us to build better systems across the planet. Farmland is giving way to data 
centers. Corn fields are becoming compute fields.   Land once measured in harvests, now measured 
in gigawatts and exaflops. 10,000 years ago,   the first great revolution taught us humans how 
to feed ourselves. This one is teaching us how to   feed machines. And everything that follows will 
depend on that choice. If this episode sparked   your curiosity, you will definitely enjoy this 
one where I take you with me inside the secret   microchip factory where you can see with your 
own eyes the technology of the future which   is coming to all your devices after 2032. Or 
watch this episode where I break down what it   takes to build a $50 billion microchip factory 
from scratch. And I will see you there. Ciao.

---

## 7. What They Just Built Is Unreal
**Channel:** Anastasi In Tech | **Views:** 1.1M | **Date:** 2 months ago | **Duration:** 34:29 | **ID:** IS5FovPfvf0
**Link:** https://youtube.com/watch?v=IS5FovPfvf0

### Transcript:
Almost no one knows this place exists. Yet, every 
measure leap in technology starts here. Today,   for the first time, I'm taking you inside the 
secret lab. And you are about to see things   the public is never supposed to see. The 
technology that will power your smartphone,   laptop, and AI data centers 10 to 20 years from 
now. But before we open that door, we have to face   the harsh truth. As a chip design engineer, 
I am convinced that over the last 50 years,   we lived through a miracle. We've managed to 
double the number of transistors on a chip   roughly every 2 years. And that enabled massive 
performance gains. To understand how colossal this   progress was, let me show you something. The first 
NVIDIA GPU, the GeForce 256, released in 1999,   was manufactured using the 220 nm technology. Fast 
forward to today, and NVIDIA is ramping up the   production of its Rubin GPU in 3 nm. So in just 
last 25 years, we managed to shrink the transistor   by more than 70 times and turned graphic cards 
into the engine driving the entire AI revolution.   That's the miracle we lived through. For decades, 
engineers have been carving atomic scale machines   out of sand. It should be impossible. And yet year 
after year the chips kept getting smaller, faster   and more powerful. And for the next generation, 
we are heading into Ångström era. Numbers so   tiny they barely feel real anymore. But here is a 
truth no one wants to admit. This era is actually   ending. And this chart proves it. Right now we are 
running into the hard limits of physics. And as   you will see just in a moment, transistors are now 
literally just a few atoms wide. They are becoming   mechanically unstable. Heat is exploding. The 
alternative materials we hope would save us aren't   scaling fast enough either. And if we don't invent 
a new kind of device, not an upgrade, but a true   breakthrough, the computing revolution just stops. 
And with it stops everything that depends on the   progress in computing, technological advancements, 
AI, space tech, and even your devices. All of it   will hit a performance ceiling. And right at 
this moment of despair where the world largest   tech companies like Apple, Google, NVIDIA, AMD, 
and even TSMC had no answers left. They turned   to one place, a small lab in Belgium almost 
no one heard of. Yet the future of computing   is being invented right here. What happens inside 
these walls doesn't just advance tech. It decides   whether innovation continues or stops. Well, 
if you trace back any advanced chip from AMD or   NVIDIA to Apple Silicon, it leads not to Silicon 
Valley or Taiwan, but to a small, quiet town in   Belgium called Leuven, home to Imec. And this 
is not your typical chipmaker. It's a research   hub that in advance technologies that chip makers 
like TSMC, NVIDIA, Samsung, Intel going to use in   10 to 20 years from now. Here impossible physic 
problems turn into working prototypes long before   they appear in Apple or NVIDIA keynote. No matter 
where you're watching this, on your smartphone,   desktop, or even TV, all modern devices run 
on FinFET transistors. A transistor is a   tiny electronic switch that controls the flow of 
electricity inside the circuits. You can think of   it as a microscopic reach of silicon with a thin 
fin sticking up. This FinFET device was a hero   because it carried us through an entire decade 
of technological progress. From the first Apple   Silicon to the GPUs that power the most advanced 
data centers on Earth, but its time was up. To   keep shrinking transistors, the key structure 
inside it, the fin had to become thinner and   thinner. Imagine something just 6 nm wide and 
60 nm tall. At some point they literally started   bending and snapping during the manufacturing. 
In fact, when the challenge becomes too complex,   too expensive, and too risky to solve on their 
own, the world's biggest players, Intel, Samsung,   ASML, TSMC, all join forces with Imec because 
all of them want eventually the same thing,   a place to test impossible ideas before spending 
billions trying it on their own. By then, Imec   had already explored every path they could think 
of, including new materials, new architectures,   and new shapes. The problem was most of them 
went nowhere. And the stakes couldn't be higher   because the wrong bet wouldn't just slow us down, 
it would set the entire semiconductor roadmap back   by a decade. And eventually the industry wasn't 
looking for a next upgrade but for a reinvention.   And if any place can pull off a miracle, it was 
Imec. After years of failed ideas and dead ends,   the answer turned out to be very simple. And it 
started with a rough sketch on a whiteboard. And   they asked a deceptively simple question. 
If this tall structure becomes unstable,   what if we just flipped it sideways? And just 
imagine this simple idea became the second   biggest turning point in microchip history. 
The invention of gate-all-around transistor.   Instead of one tall fin, engineers stacked thin 
sheets horizontally, supported from below, making   them far more stable to build. And this trick 
solved the mechanical problems that were killing   FinFET. Right now, these devices are making 
their way into your next GPUs and smartphones.   This innovation definitely bought us time and it 
will carry us for another three chip generations.   But it wasn't the end game because right now even 
with this gate-all-around innovation we're still   running out of space on a chip and Imec had to 
go back to the drawing board again. When cities   run out of space they didn't stop building. They 
built skyscrapers. Imec asked a bold question. Why   not to do the same with transistors? Well, if we 
cannot shrink in 2D anymore, there is only one way   up. Stack one device on top of another vertically 
and you immediately double the transistor density.   And now I will walk you through step by step how 
this technology is being invented. Before anyone   touches a wafer, they spend years simulating 
this device, tweaking geometry, materials,   and then try every variation, kill the weak ones 
until the numbers finally say this might actually   work. And that's because every idea that dies here 
will save you years of effort and expenses in the   fab for CFET Imec explored multiple ways to stack 
transistors. Most of them failed, but one had the   pulse and that became the path forward. And when 
it finally worked, it changed everything. For the   first time in history, we began building chips in 
3D. And soon you're going to see it with your own   eyes. I could not be more excited because right 
now I'm taking you inside the fab to see something   almost no human eyes have ever seen. One of the 
greatest inventions in human history. First,   I sew it up in a cleanroom bunny suit. And of 
course, mine is like two sizes too big. So I'm   actually looking like a walking bat sheet with 
a badge. They blast me with air just to make   sure I don't contaminate anything inside. This 
place is insanely delicate. Clean rooms must be   cleaner than clean. Inside they are building 
technologies so tiny that one single hair,   one speck of dust and a million dollar experiment 
is gone. Once we are in, we are heading straight   to one of the coolest machines, Scanning Electron 
Microscope. This is the only way to actually see   something that small because a modern transistor 
is about 100 times smaller than a virus.   But here is a catch. The moment you look at it, 
you destroy it. You cannot actually see a 2 nm   structure or even a 10 nm structure because our 
eyes simply aren't built for that. Our eyes only   work when light bounces off the objects. 
But to bounce from something that small,   light is simply too big. Its wavelength is 
hundreds of nanometers wide. It's like a   giant wave trying to hit something smaller than 
a virus. That's why to see transistors, light,   and typical microscopes are practically useless. 
We need something far more powerful than that. We   need electrons. That's why we're going to use this 
Scanning Electron Microscope to see the unseen.   First, we place the wafer inside the chamber. 
Inside, a thin beam of electrons scans across   the surface of the chip. And this lets us zoom in 
hundreds of thousands of times. At first, what you   see looks like simple lines. But as we increase 
magnification 20,000 times, 50,000 times, 150,000   times, patterns begin to appear. What we see right 
now are metal contacts that lead to the device.   They are like tiny highways carrying electrical 
signals into the transistor. And here is a brutal   part. When the electron beam hits the surface 
of the chip, it instantly heats up. Stay on one   spot for just a half a second too long and the 
beam will destroy the sample. You get only a few   chances before it's gone. And this time, we had 
to sacrifice this one just to see what is inside.   Now, Felix fires up the iron beam and suddenly 
a tiny opening appears. In just a split second,   we cut out a slice thinner than a human hair by 
a thousand times. And only after making this cut,   we can see the most important part of the 
transistor, the nanosheet channel, the tiny   layer where the electric current actually 
flows. But even this super microscope has   its limits. We can actually zoom in here down to 
10 nm. But we still cannot see the atoms. To go   further to see the most interesting part, 
we actually have to leave the fab and do   something way more extreme. I will show you it 
in a moment. If you're enjoying this episode,   subscribe to the channel because everything which 
you've seen so far and which you're about to see   now is possible because of you watching 
this video. And the more people subscribe,   the more doors will be open to us and the more 
exciting content I can make for you. Thank you.   What we see right now is that AI is reshaping the 
job market across every industry from marketing   to finance to software. Many people think they 
won't be affected, but the world is changing fast   and the only way to stay relevant is to level up 
your skills. While everyone is busy buying things   this Black Friday, I think the smartest move is to 
invest in yourself in something that actually adds   long-term value. Which is why I teamed up with 
Outskill to bring you a 2-day live AI mastermind   training. They're hosting the next live workshop 
this Saturday and Sunday from 10:00 a.m. to 7:00   p.m. EST. Normally, this training costs $395, but 
Outskill is running their big Black Friday sale,   and they're giving all of my viewers a free seat. 
I highly recommend you joining it because not only   will you get AI certified, but you will be 
trained by mentors from Google, Microsoft,   OpenAI, NVIDIA, and more people who built the 
modern AI industry. In just 16 hours, you will   learn more than 10 AI powered tools, master AI in 
Excel, Sheets, and presentations. Start building   your own AI agents and workflows. If you attend 
both days, you will unlock bonuses worth $5,000,   including Prompt Bible and your personalized AI 
toolkit. Save your free spot right now by clicking   the link below or scanning the QR code here. And 
thank you Outskill for sponsoring this episode.   Now, this is where things start to get really 
wild because we left the fab and leveled up to   something far more powerful. Transmission Electron 
Microscope. This one can achieve magnifications of   up to 50 million times. And we are about to look 
at the invention that took over a decade to build   and cost the industry hundreds of millions to make 
real. Unlike the first microscope that shows you   only the surface, this one let us see through the 
material. Almost like X-ray at the atomic scale.   This one can zoom in far enough to see actual 
atoms and nothing else on Earth can do that.   Getting to the atoms is a whole science on 
its own. Do you remember we just cut out a   tiny slice of the chip a few nanometers thick 
called lamella. That's a slice thinner than a   strand of a DNA about 30 nm thick. any thicker and 
electrons can't pass through it. Now you see Felix   carefully placing this tiny slice on a copper grid 
and loaded into the microscope. I cut it short,   but this preparation took us at least half an 
hour. And now finally we are zooming into the   CFET transistor. Now on the screen you can 
see the bright shapes. These are the metals,   the contacts and the gate. The gray regions 
are silicon and silicon germanium. And running   through the image almost like a thin thread is the 
nanosheet channel. The tiny path where electric   current flows when transistor switches on. So 
this is the p-type channel at the top and here   at the bottom you have the n-type channel you 
see. And it's a rocket science to manufacture   this channel so tiny. So those are atoms. 
You can see them here. What you see right   now is a glimpse into one of the humanity's 
most advanced, tiniest creations, the CFET.   For the first time in history, two transistors 
stand on top of each other, packing more power   into less space and opening the door to a 
new era of computing. And now if we zoom in, we can see the single atoms of the channel. 
And this view is as close to the heart of   the chip as you can get. And this channel 
is about 30 atoms thick. When I saw this,   I just froze because this was the physical limit 
of reality right in front of me. There is a catch   though because to look at it, we literally shoot 
electrons at the device and every second we risk   to destroy it. Fun, right? But also terrifying. 
Every image feels like a one-time chance. Like a   shooting star. You're admiring it knowing that 
it's going to disappear. Why does this process   we went just through SEM and TEM which is so 
expensive and requires a lot of training to   do matter so much? In fact, this isn't just for 
cool visuals. These are two critical steps in   inventing every new chip technology because modern 
chipmaking involves building these tiny structures   layer by layer which involves thousands of 
steps. And at each stage, engineers need to   check if the structures are still perfect or if 
something went wrong. And if something went wrong,   they need to figure out why and fix the process. 
What you're seeing right now actually decides the   fate of this innovation. If it moves forward 
or if it ends right here. Most people think   new chip technology just appears every few years 
as if someone wakes up and says this is the next   transistor. But the reality is very different. In 
fact, from the moment a new transistor is imagined   till the moment it will end up in your phone, 
you are looking at 18 to 20 years. And so far,   we've explored just a tiny part of this innovation 
process, but I'm sure you already can see why this   is one of the hardest engineering challenges 
on the planet. And I was lucky to talk to Serge   Biesemans who led the invention of CFET technology 
at Imec. He is basically leading the innovation   that NVIDIA, TSMC, Intel and Apple will depend 
on in a decade from now. That's kind of exciting.   You've seen the TEM. It looks so simple, man. 
It took four years of my life to get there. It   was a day and night. But this is much more than 
a FinFET three times more aspect ratio. It's kind   of hard. And even when you come up with a perfect 
design, if the tools physically can't build it,   the idea dies. Because in this industry, a new 
device isn't just a design challenge. It's an   equipment challenge. In some sense, some people 
say Moore's law is an equipment capability law.   If the tool does not exist to print smaller 
features, if the tool does not exist to remove   certain materials selective to others, you would 
not be able to physically build the complicated   structure on your wafer. And CFET invention pushed 
tools harder than anything before it. In fact,   to stack two transistors on top of each other, 
they needed an entire new generation of tools.   You have to be able to precisely etch and build 
tall and narrow structures without letting them   collapse. Grow and remove materials layer by 
layer without damaging anything underneath it.   And you have to be able to deliver power from 
the backside of the wafer. Something that has   never been done before. That required new etching 
and deposition systems, new epitaxy techniques,   new backside power process, and on top of that, 
new tools capable of measuring details that once   were literally invisible. That's why Imec works 
closely with tool makers like ASML, the key edge   deposition and EPI suppliers and key material 
suppliers to co-develop equipment and materials   required to turn these ideas into reality. And 
these tools aren't cheap. The EUV scanner alone,   the queen of all chipmaking equipment, now cost 
over $250 million per unit. Most of the others   range from 10 to 50 million each. And to run even 
an experimental fab line, you need about 200 of   them. And once the early version of these tools 
exist, they don't go directly to TSMC or Intel.   They first land here at Imec. That's where 
researchers test them directly on silicon   long before any chip maker is even allowed to 
touch them. Right now here at the Imec fab,   they're assembling the new High NA EUV lithography 
machine from ASML, the most advanced lithography   machine ever made. They didn't let us film that 
part. Of course. But trust me, the single machine   will fill an entire hole. If the results look 
promising, only then Imec moves the work to its   pilot line. It's test kitchen where manufacturing 
flow is perfected. Because to make CFET real,   Imec isn't just developing the new device. They 
are reinventing the entire recipe. A recipe where   new tools, new materials, and new techniques 
all work together in a perfect sync. And while   the journey to make CFET manufacturable is still 
underway, Imec is already working on what is next   after CFET. Because in this industry, if you wait 
until the current technology run out of steam,   you are already too late. Now here is the part no 
one likes to admit. The future is still unknown.   CFET buys us a decade. But after that for the 
first time in the chip history there is no clear   road map after seat. No one even Imec doesn't know 
what is coming next. The only thing is certain   CFET cannot lower power or heat enough for the 
future AI demands here. We would need something   more to break the laws that limits the silicon 
itself. Now what comes after CFET? The only thing   that I can think of is that we start stacking even 
more layers. The reason that we stack is because   we can no longer scale X and Y. And I don't think 
that there is any idea right now out there that   can easily scale XY. So that means we have to make 
use of the vertical dimension and CFET is just the   first generation of learning how to do so. If we 
master that by the mid-30s next decade I believe   that opens up the room for not only hybrid 
channels but also hybrid technologies. Well,   that's interesting and we have to talk about this 
because if you look at the history of computing,   first the progress came from one just one thing, 
shrinking transistors. But it's not the case if   you look at what's happening right now. Around the 
2020, the physics of making transistors smaller   and smaller started to flatten. Costs exploded, 
heat exploded and physics stops cooperating. This   is the wall we spoke about. CFET will extend this 
line a little bit further. It buys us time. It   might carry us towards 2030, but it doesn't 
restore the exponential growth. This era is   gone. Right now the industry is forced to change 
the very definition of Moore's law because if   you cannot make transistors significantly better 
you have to make the whole system significantly   better. In fact in the modern chips performance 
doesn't come just from smaller transistors. It   comes from how fast many chiplets talk to each 
other. Now, instead of building one giant chip,   companies combine multiple smaller chips 
side by side or even vertically to unlock   far more power in a single package. And 
that approach changed everything. Right now,   chiplets on the chip sit centimeters apart. And 
at this distance, communication is like shouting   across a football stadium. It wastes energy and 
it slows everything down. A promising solution is   to let these chiplets talk using light instead of 
electricity and this is silicon photonics. Today   this technology is used to connect GPU racks 
across data centers. But soon it will move   inside the chip package itself letting chiplets to 
communicate with light at incredible speed. Right   now, silicon photonics still consumes way too much 
power to be used everywhere, especially inside   laptops and smartphones. The lasers run hot waste 
energy and the whole system is extremely sensitive   to the temperature. You often need heaters just to 
keep the light stable and this is sort of defeats   the purpose of saving energy. This is where 
Imec steps in. They are not trying to prove that   silicon photonic works. This is a done part. But 
they are trying to make it efficient enough so it   can be used everywhere. Right now they experiment 
with advanced optical materials you can't use in   the normal fab like barium titanite for your 
audience which I am one of them by the way.   This particular one is too detailed but it fits 
the material story. So photonics exist. The good   thing is it can be fabricated in any production 
line. Photonics is still a little bit power hungry   but there are materials that are optically very 
very interesting but that are not compatible.   We can at least deposit those materials on 300 
mm. We can pattern them. We can do the optical   characterization in a realistic demonstrator. So 
those are the type of research. So new materials   to scale the power budget of the photonic circuit. 
That's kind of I would say the tagline of what   we're trying to do here. If Imec is able to 
pull this off, this unlocks the whole new leap   in computing. Just imagine this kind of technology 
that today only NVIDIA can afford to use in their   giant GPU clusters could one day run inside your 
laptop or even your smartphone. Imec vision goes   far beyond that. Right now they are working on 
stacking entire wafers on top of each other.   Imagine taking two cities and perfectly stacking 
one on top of the other with every street aligned.   And if this works, we could eliminate most of the 
communication wiring between chips. And this means   lower power consumption, higher speed, and most 
importantly, the ability to stack different types   of chips and different types of materials on top 
of each other, not just silicon. And this leads us   to future where chips won't be flat anymore. They 
will look like a 3D computing cube. There is still   one more curve ahead. One that might completely 
change what a processor even means to eventually   use light instead of electrons for computation. 
Here is the interesting part. Imec isn't betting   just on one future. Right now they have multiple 
teams racing in parallel each exploring a   completely different path to what might come after 
silicon and no one knows which one if any will   work. Right now they are testing ternary logic, 
reversible logic, spintronics, cryogenic CMoS and   you are lucky because all of these technologies 
I've already covered on this channel but   eventually we might need an entirely new device 
one that follows different laws of physics not   the ones silicon obeys. I'm kind of proud to say 
that I probably touched upon all materials in the   Mendeleev table except the ones that radiate at 
night the radiative materials but other than that   we've probably touched upon most of them if they 
are available in a 300 mm cleanroom environment   right now they experimenting with germanium 
graphene 2D crystals like transition-metal  dichalcogenides
even carbon nanotubes, materials just a few   atoms thick. And they all look amazing under the 
microscope. But the challenge is turning them from   tiny lab samples into the real technology ready 
for mass production. The future is not decided.   Imec in collaboration with it partners saved 
Moore's law not once, not even twice. And right   now they are racing against limits of time, energy 
and physics itself. The future of computing might   be already here in one of the experimental wafers 
in Leuven. But even Imec doesn't know if it will   work. What makes this unique Imec model to work 
isn't just engineers and tools and partners, but   neutrality. Imec is nonprofit. It does not compete 
with anyone. And their secret edge that they have   entire semiconductor factory on site built just 
for the research and now they're expanding it to   more and more buildings to run more experiments. 
Most universities dream about one clean room.   Imec has an entire production line and that mix 
of brains, machines and neutrality makes Imec   something rare. Not just a lab, but the world's 
meeting point for the next generation of chips.   So now you can literally forget Belgium chocolate 
or waffles because Imec wafers is what the entire   tech industry is really addicted to. Now if 
you enjoyed this episode, share it with your   friends and colleagues and watch this video where 
I explain what it takes to build a semiconductor   factory and to manufacture these devices. You will 
love it. Thank you and I will see you there. Ciao

---

## 8. America’s New Chip Factory — $50B Disaster
**Channel:** Anastasi In Tech | **Views:** 1.1M | **Date:** 3 months ago | **Duration:** 34:47 | **ID:** 36W0dMwQJxU
**Link:** https://youtube.com/watch?v=36W0dMwQJxU

### Transcript:
Something colossal is rising from the Texas 
planes. A $50 billion microchip factory.   One of the most expensive and complex 
projects in the US history. And this   isn't just a factory. It's America's 
front line in the global chip race.   On paper, this new facility is a marvel. Built 
to rival TSMC's new mega factory in Arizona,   just one state away. But before it even came to 
life, it's already failing. I'm an engineer who   spent over a decade in semiconductor industry. 
And this story is unlike anything I've ever   seen. And everyone should understand what's 
happening because the future of AI an entire   global economy depends on it. To understand why 
we have to go back to the company behind it and   the moment when it's almost conquered the chip 
world. A decade ago Samsung was unstoppable.   It was and still is the second largest chip maker 
on the planet and the only one still keeping pace   with Taiwan's TSMC. Their dominance in memory 
chips is nothing short of legendary. From   DRAM in every server and smartphone to NAND that 
stores the world's data and memory wasn't enough.   They also built logic chips, the brains behind 
the first Apple iPhones, NVIDIAs early GPUs,   and Tesla's first autopilot computer. By 
2015, Samsung was on top, mastering 14 nm process, landing Apple, and standing right behind 
TSMC. For a moment, it looked like they might   even overtake them. But then everything turned. 
Apple became direct rival and trusting Samsung to   build iPhone chips was literally like asking your 
enemy to sharpen your sword. So Apple left, moving   all chip production to TSMC. A foundry that built 
chips for everyone but competed with no one. Then   came the cracks from within. Unlike TSMC, Samsung 
was pulled in every direction, building chips,   building memory, but at the same time, displays 
and smartphones. Their 10 nm process slipped   behind schedule. Yields crashed. By the time 
TSMC ramped five and three nanometer production,   Samsung was still fixing seven. Yields fell to 
around 40%. NVIDIA walked away. then Qualcomm,   then Tesla. Each loss drained billions of dollars 
and confidence. And it wasn't just the logic site   that struggled. Memory business was shrinking, 
too. Micron and SK Hynix kept taking a bigger   piece of the pie. And that's when Samsung decided 
to do something no one expected. Rebuild its chip   empire. But on the other side of the world, in 
2021, they decided to build a $17 billion chip   factory, not in Korea, but in the heart of Texas. 
A factory so ambitious it was announced as the   most advanced semiconductor factory ever built on 
US soil. The company chose Taylor, a quiet town   northeast of Austin, far away from Pyongyang, but 
close enough to its biggest customers, NVIDIA and   Tesla. The mission was clear. Proof that advanced 
chipmaking could thrive in the US again and Taylor   was a perfect choice. close to Tesla, Qualcomm 
and Google and surrounded by a booming tech scene   hungry for AI silicon. Even the land itself seemed 
made for it, vast, flat, and geologically stable,   far from earthquakes or flats with almost zero 
risks of natural disaster. And that's perfect   for massive clean rooms and billions of dollars in 
equipment. On paper, the plan looked simple. Break   ground in 2021, start 4 nm microchip production 
by 2024 and then push toward 2 nm soon after. This   Taylor Fab promised to make a history. But unlike 
the other Taylor, this one can't quite hit the   right notes. Honestly, it's kind of insane to tell 
this story because whatever could go wrong went   wrong. And here is where the story gets truly 
insane. Because building a chip factory isn't   just pure engineering, it's choreography at the 
atomic level. Imagine you are about to build the   most advanced chip factory on Earth. And here's 
a twist. You don't start with concrete. You don't   start with machines. You start by locking in the 
direction. Step one, lock the node, the transistor   generation your fab will produce and lock the 
first customer, the company whose chips you will   build. And that first customer is very important 
because the design the chip design of the first   customer is how the fab calibrates and optimizes 
every step in the process. And that first step   defines everything that follows the tools, 
geography, recipe, floor plan, even the power   grid, the entire playbook. First, Samsung decided 
for four nanometers, a safe, mature node, solid   yields, known recipe, and predictable economics. 
But just as construction began, the world hit fast   forward. AI workloads exploded and every measure 
chip maker started chasing 3 nanometers and below.   TSMC was already ramping up Apple and NVIDIA chips 
on its newest process and Samsung didn't have an   anchor customer of that scale and here Samsung 
made a fateful decision. Pivot Taylor to 2 nm. It   sounded bold but in reality it was catastrophic 
and that single change turned a controlled   build into a pure chaos. It meant new tools, new 
recipes, and steep learning curve. Even in Korea,   Samsung was still struggling with this node. And 
the math blew up overnight because moving from   4 nm to 2 isn't just about swapping a couple of 
machines. It means reinventing the entire factory.   The original $17 billion plan ballooned to $50 
billion. This change pushed the schedule out and   the budget through the roof and that was before 
they even broke the ground. Because before you   even start building the walls, you have to conquer 
the earth itself. The soil under Taylor looks calm   from above, but it's not. It's caliche, hard, 
dry, and uneven. strong enough to hold a highway   but not stable enough to hold the semiconductor 
fab still. When your printing transistor features   smaller than a human eye can see, even the 
tiniest vibration can destroy everything.   That's why absolute stillness is fundamental. 
Inside an EUV lithography machine, the tool   that prints those transistors, every mirror must 
stay perfectly still within just a few nanometers.   If the floor vibrates or moves even slightly, the 
laser misses its mark. The consequences, an entire   batch of wafers, worth millions, is gone. So 
Samsung went to a war with the ground itself and   they've built one of the most extreme foundation 
systems ever built for a semiconductor fab. Every   part was designed to keep the entire building 
perfectly still down to the scale of atoms.   They drilled more than 20,000 shafts, each about 
110 feet or 35 m deep, and they filled them with   over half a million cubic yards of concrete. Just 
imagine, five concrete plants were built right   on site just to feed that demand. That's enough 
material to build several skyscrapers. But this   time they poured it downward instead of upward. 
And here every inch mattered because a tiny   vibration can wipe out month of work. Typically a 
semiconductor fab uses reinforced slabs with local   vibration damping under specific tools. Samsung 
took a different path. It turned the entire   foundation into a massive floating platform. Those 
deep piers anchor directly into bedrock, isolating   the cleanroom from the shifting Texas soil above. 
The result is a building within a building. A   floating floor that absorbs every shock before 
it reaches chipmaking tools. The result is one   of the most advanced vibration control systems 
ever built, cancelling not just tiny earthquakes,   but the rumble of trucks. the hum of cooling 
systems and even tremor from the Pacific Rail   next door. Here they achieved not just stability 
but absolute stillness because at 2 nm even a tiny   vibration is the difference between a success 
and a multi-million dollar failure. And it's   almost ironic because all this colossal project, 
massive concrete, thousands of machines, all this   investment, everything goes into the building the 
tiniest devices on Earth. And that's because these   tiny new transistors are a huge deal. Every 
major customer wants them. Tesla, AMD, Apple,   Qualcomm, because they are not just smaller. They 
redefine how computation works at the atomic level   and for 70 years transistors was the beating 
heart of the modern technology. But now at 2   nm that transistor itself is changing shape and 
it's only the second time it happens in history.   The last time it was over a decade ago when the 
world moved from flat two-dimensional transistors   to FinFETs. But now at 2 nm, even FinFETs can't 
keep up. Because at this atomic scale, electrons   stop behaving like particles. They actually 
start to ripple and interfere like waves.   So engineers had to reinvent the transistor 
itself and the new radical design is called   gate-all-around. Instead of one tall fin, it uses 
multiple horizontal nanosheets. Tiny ribbons of   silicon each just a few atoms thick. And those are 
wrapped completely by the gate that controls them.   And that's what makes this device so powerful. 
And if you're curious to know and see how this was   invented and how right now the next generation is 
being developed, you must subscribe to the channel   because in the next episode we are going to the 
secret place where it's all happening. The reason   I'm explaining this new transistor to you because 
making these devices isn't easy. It's atomic   surgery. Each nanosheet has to be formed, stacked 
and then aligned with Ångström level precision.   An Ångström is 1/10 of a nanometer. And the only 
tool capable of printing these tiny structures is   EUV lithography machine. And it's happening by 
lasers bouncing off mirrors polished smoother   than any other surface on Earth. And if the mirror 
shifts by a few atoms, if the surface vibrates,   the pattern fails and the $30,000 wafer is gone. 
This is just to give you a feeling of how complex   and sensitive the process is that Samsung is 
trying to pull off in the Taylor side. That's why   so much engineering goes into building the fab and 
that's why they need this floating foundation to   kill every possible vibration. Once the foundation 
was stable, the bottle moved upward. TSMC was   pulling ahead and Samsung couldn't afford to fall 
further behind. To catch up, they had to once   again reinvent how the Fab is built. Normally, a 
chip factory takes a couple of years just to raise   its frame. Samsung didn't have that luxury. So, 
they tried something radical. Instead of pouring   concrete piece by pierce, they industrialized 
the construction itself. They turned to precast   building, a method usually reserved for bridges 
and stadiums. Thousands of columns, beams,   and slabs were made off site and then shipped 
in. For a month, the Taylor site consumed the   entire precast capacity of Texas. The scale of 
construction was staggering. Then everything   arrived like an industrial Lego kit ready to snap 
together in days instead of weeks. Well, it wasn't   cheap, but Samsung paid this premium gladly to 
speed up the construction because every month lost   meant billions in delayed chip revenue. And for a 
moment, it worked. The walls rose in record time.   But once the walls were up, they went searching 
for power because a semiconductor fab burns energy   like an entire city. Hundreds of megawws consumed 
24/7. And Taylor was about to plug into one of   the most unstable power grids in America. Well, if 
there is something riskier than printing nanometer   features of transistors, that's trusting the Texas 
grid in winter. Texas runs on its own isolated   electrical system, independent from the rest of 
the United States and dangerously fragile. In   2021, a single winter storm froze the system and 
plugged millions into darkness. Now, imagine the   same grid must keep alive a factory where a single 
flicker of voltage for a millisecond can destroy   millions of dollars in chips. So Samsung had to 
build its own safety net, a power grid inside the   grid. They added dual high voltage lines so fab 
could draw power from two independent sources.   Every power source was backed up. So even if the 
state grid blinks, the fab would never notice.   That's the madness and the genius of Taylor. When 
it comes to a semiconductor fab, an AI data center   or even your home, no matter how advanced the 
technology is, it still depends on one thing.   Power. And when it's gone, everything stops. 
Your fridge, your internet, your work. That's   why I've been testing the Jackery HP 3600 Plus. 
It's a home backup system designed to keep your   life running even when the grid goes down. It's 
powerful enough to keep a family fridge running   for up to 14 days. And it's ready to go in just 
2 seconds during a blackout. No setup, no stress,   just plugand play. And it's barely loses any 
charge, so it's ready to go just when you need it.   It also features seamless uninterruptible power 
supply system switching under 10 milliseconds,   which means your computer or even medical 
equipment keeps running without interruption.   So whether you're preparing for emergencies or 
just want to be more independent from the grid,   the HP 3600 Plus is one of these devices that 
will give you the peace of mind and the real   power when you need it the most. Check it out 
right now through the link below and save up to   65%. Once the ground was still and the power was 
stable, the next challenge came flowing in water.   And in semiconductor fab, water just as critical 
as power. If you've seen my episode on TSMC fab  21 in Arizona, you know why. We've already 
explored that. So in this episode I will be   building on top of that. Inside the semiconductor 
factory, every wafer drinks thousands of gallons   of water during its lifetime. Cleaning, rinsing, 
polishing, every step depends on it. In total,   the factory itself consumes around 15 million 
gallons of water every day. It's about five times   more than the entire city of Taylor itself. 
That water is non-negotiable. Without water,   the entire production line stops. To meet that 
need, Samsung built a water factory beside the   chip factory, the Blue Sky Water Reclamation 
Facility. It draws from Carizzo-Willcox aquifer,   one of Texas's largest underground water systems. 
And it doesn't just supply water, it recycles it.   Every drop that touches a wafer is then filtered, 
purified, and reused with recovery rates toward   90%. It's one of the most advanced water systems 
in the United States built to sustain a microchip   factory that never sleeps. At first, everything 
worked until Samsung upgraded the Fab from 4 mm to   2. That's where all the problems began because the 
smaller the transistor, the stricter the purity.   At 2 nm, even a single trace of contamination 
can destroy an entire wafer batch. So the team   now had to recalibrate every pipe, every filter, 
every valve to a level of precision they've never   reached before. What was meant to take weeks 
stretched into months and it's still ongoing   today. And then the next problem was actually at 
first invisible, the air. Because not all air is   created equally. In the Arizona desert, TSMC 
fights dust. In Texas, Samsung faces something   else. humidity and industrial emissions. Texas 
air is thick and alive, heavy with water vapor,   gasoline fumes, and traces of ozone. Each 
of these can react with delicate chemicals   used to make chips. Moisture can trigger static 
discharge, and ozone can literally burn through   the chemistry that shapes the circuit. So 
Samsung built one of the most advanced air   filtration systems. Massive ventilation towers 
push air through filters so fine they can trap   particles smaller than the virus. But clean isn't 
enough. Inside a chip factory, air itself becomes   part of the manufacturing process. Every cubic 
inch has to be perfectly balanced. temperature,   humidity and pressure because at 2 nm scale 
even a single droplet can destroy billions of   transistors. That's why fabs control moisture 
using something called due point, the exact   temperature where the water starts to condense. 
If it's too high, droplets form on wafers. If it's   too low, static electricity builds up. So inside 
a fab, it's kept within a fractions of a degree,   perfectly balanced between too wet and too dry. 
And the entire clean room is kept at slightly   higher pressure than the outside world. So air 
only ever flows out and never flows in. Step   inside and it feels like a silent bubble. Here the 
air doesn't move, it glides. This perfect filtered   air flow from ceiling to the floor, sweeping away 
every particle before it can touch silicon. The   clean room in Taylor span an area larger than 10 
football fields. It's one of the cleanest and most   precisely control environments humans have ever 
built. And it turns out even that isn't enough.   The real magic that actually builds transistors is 
chemistry. And this one runs on gases, nitrogen,   hydrogen, and neon. They drive the reactions that 
carve and coat silicon layer by layer. To supply   those cleanrooms, Samsung built massive onsite gas 
farms. This includes special air separation units   that extract nitrogen and argon directly from 
the atmosphere and hydrogen generators that split   water into pure hydrogen gas. But gases aren't 
enough. Chipmaking runs on acids. Without it,   nothing works. Sulfuric acid cleans wafer after 
each and every exposure step. And it has to be   pure down to one part per billion. And here is 
a wild part. Samsung fab still imports that acid   from South Korea nearly 7,000 miles away. It's 
shipped across the Pacific through US ports and   then trucked to Texas. It's expensive and absurdly 
complex. But until a local plant is built,   there is no other option. Even the raw silicon 
wafers are shipped in from Japan. This fab   runs on a complex supply chain stretched across 
continents. Hundreds of tools arrive from Japan,   Netherlands, and the US. Each worth millions, each 
to be calibrated to atomic precision. Not every   shipment arrived on time, and schedules slipped. 
But that wasn't the real problem. I know it's hard   to believe, but all these challenges we have just 
discussed, concrete, power, water, air, suppliers,   this was the easy part. What really makes or 
breaks a fab is the people who run it. Samsung   flew in hundreds of engineers from Korea while 
hiring and training local teams across Texas.   The problem is they've never built a 2 nm fab 
before even back home in South Korea. So they   didn't have this experience to bring in. At 
the same time across the state in Arizona,   TSMC was building the same kind of fab but with 
one key difference. They didn't start from zero.   TSMC first perfected the 2 nm manufacturing 
process at their main mother fab in Taiwan   where every tool, every parameter and every step 
was already mastered and only then did they bring   that experience and those people to Arizona. This 
means TSMC started from experience. Meanwhile,   Samsung had to reinvent everything. A new process 
in a new country with a new workforce. So, the   factory was almost complete. But it never truly 
came alive. Because running this multi-million   dollar machines isn't about default settings. 
It's about coordination, intuition, and trust.   And those are the things you can't import or rush. 
And that's where the big difference between TSMCs   Fab 21 in Arizona and Samsung Taylor fab begins. 
TSMC spent over 40 years mastering one thing,   building chips for others. Every engineer, 
supplier, and process serves a single goal. Yield.   yield is a percentage of working chips per wafer. 
And at 90% that TSMC achieves, you're practically   printing money. Samsung, on the other hand, 
fights too many battles, designing phones,   building displays, and making memory while trying 
to run a foundry for others. And that lack of   focus costs them a lot because the moment you 
compete with your customers, you lose them. And   TSMC in Arizona had Apple as a customer from the 
day one. And that gave them rhythm and stability.   Samsung had none, no stable flow of wafers to tune 
the process. That's why today TSMC's Arizona Fab   is already shipping 4 nm chips and ramping up the 
production of 2 nm while Taylor is not exactly   producing any hits. Because in chipmaking, you 
can copy the walls from one continent to another but you can't simply copy the recipe. 
Every fab uses roughly the same machines,   but each runs on its own secret 
combination of timings, chemistries,   and pressures that define the quality 
of every transistor. Those recipes   are the true intellectual property of 
chipmaking guarded like national secrets. And here is TSMC's unbeatable loop. The world's 
top customers, Apple, NVIDIA, AMD, Qualcomm,   all trust TSMC. That trust brings more data 
and revenue. And that revenue funds R&D. And   R&D improves the process. And better processes 
attract even more customers. And even if someone   would try to copy this recipe, it wouldn't 
work from scratch because no two fabs are   identical. Air is different. Water is different. 
Vibrations are different and people and culture is   also different. A process that works flawlessly 
in Taiwan or Arizona can take many years to   recalibrate in Texas. As you can see, it looked 
like the story was over for Samsung and Taylor.   Despite all this engineering brilliance and 
perseverance, they couldn't get it right.   And then, when everything seemed lost, Tesla 
stepped in. Tesla signed a $16.5 billion deal   running through 2033. And Samsung is committed 
to manufacture its next generation AI6 chip right   here in Texas. For the engineers in Taylor, it 
was a spark of redemption. Tesla's new AI6 chip   will power entire Tesla ecosystem, including Tesla 
full self-driving system, Optimus humanoid robots,   and AI training clusters. It's expected to be two 
to three times faster than Tesla's current AI5   chip. And this single chip will replace dual chip 
design used today. And this time, Samsung offered   something new, exclusivity. And for Tesla, this 
decision was strategic. Tesla wanted a dedicated   line, a factory that could focus on their design 
without fighting Apple or NVIDIA for priority.   They wanted control to send their engineers into 
cleanroom to core design and tweak parameters in   real time and they wanted proximity. And Taylor 
sits literally half an hour away from Tesla's   Austin headquarter. So Elon Musk could literally 
walk the line. Samsung offered something TSMC   couldn't, exclusivity and local production. In 
return, Samsung got what it desperately needed,   an anchor customer, a reason to finally turn the 
machines on. The production of AI6 is now expected   by 2028, ramping to full capacity by 2030. Just 
as Tesla scales robo taxes and humanoid robots,   that's when the fab will start making money. And 
it will take them quite some time to recover their   investment. For Samsung, it's a lifeline. For 
Tesla, still a risky gamble because if yields   fail, this partnership could collapse before it 
begins. Because Tesla chips demand just the same   high yield or the whole economics collapse. Taylor 
was meant to be the next chapter in America's   chip comeback. Proof that US can match Asia's 
precision. Instead, it became a huge warning.   Even if you have billions to spend, you can't 
simply copy this excellence. And at the same time,   it's a glimpse of how far ahead TSMC is and how 
much of our technological future still depends   on them. TSMC currently leads both Intel and 
Samsung in advanced semiconductor manufacturing,   dominating cutting edge nodes like 4 nm, 
2 nm, and ramping up soon 1.6 nm glass   technology. It's 2 nm process entering mass 
production right now and their next 1.6 nm processors are planned for 2027 and this will 
push chip making into the Ångström era and in   many ways Samsung's story mirrors Intels both led 
chipmaking and both lost their age trying to do   too many things at once they both face delays in 
next generation nodes struggled to win external   customers and watched competitors outpace them 
despite massive investments. And it looks like   the core problem is structural. Considering 
Samsung engineering culture, I'm pretty sure   they will manage to turn Taylor into success, even 
though the road there is way harder than anyone   ever expected. Now, if you want to know what it 
takes to build the world's largest AI data center,   make sure to watch this episode right now. You 
will love it. And I will see you there. Ciao.

---

## 9. Why Noise Will Change Computers Forever
**Channel:** Anastasi In Tech | **Views:** 334K | **Date:** 3 months ago | **Duration:** 27:46 | **ID:** w6RztFN36Vo
**Link:** https://youtube.com/watch?v=w6RztFN36Vo

### Transcript:
What if the biggest assumption in modern 
technology is wrong? Everything we build, phones,   laptops, even the entire internet is based on 
one belief that reality fits into zeros and ones,   right or wrong, that it's perfectly logical. But 
that belief falls apart in the real world because   reality isn't perfect. It's chaotic, noisy, and 
unpredictable. In biology, cells divide with tiny   errors. That's how evolution happens. In the 
brain, neurons fire irregularly. And that   randomness powers creativity. Even stars explode 
and from that chaos, new elements are born. In   nature, CHAOS isn't the enemy. It's the engine 
of creation. And maybe it's time machines learn   the same trick. I am a chip design engineer turned 
tech founder. And today we will dive into the most   mind bending idea I've ever explored. An approach 
to computing where physics does the math. And it   all began over a century ago in a very unexpected 
part of the world. Back then the world was very   different. There were no computers but the same 
question was already haunting science. Could we   ever truly understand the chaos around us? Back 
then many scientists believe that universe was   perfectly predictable. Which means if you knew 
the exact position and momentum of every particle,   you could estimate, you could calculate everything 
that could ever happen. This idea came from the   French mathematician Pierre-Simon Laplace, who 
imagined an all knowing intellect, later called   Laplace's demon, a being that could see every atom 
in the universe and compute the entire future.   No mystery, no randomness, total determinism. 
Sounds familiar, right? That's exactly how   modern binary computing treats the world today. 
And this belief in a perfectly deterministic   universe ruled science for nearly a century 
until one man dared to challenge it. It was   a young Russian mathematician called Andrey 
Markov. He didn't believe that universe was a   perfect machine. Markov saw randomness everywhere 
in nature, in music, in language and he refused to   ignore it. So he became obsessed with a question 
most scientists avoided. Can randomness be   predicted? He became convinced that chaos wasn't 
chaos at all. It followed certain patterns.   So he built a simple experiment. He took something 
that looked unpredictable and measured how often   one state follows another. Today is raining and 
if today is rainy, there might be 70% chance it's   going to be raining tomorrow and might be 30% 
chance it's going to be sunny. And he didn't   need the entire weather history for that. He just 
needed the current state to predict what is next.   And then came the breakthrough. Even randomness 
had structure. From one moment to the next, there   was a fixed probability of moving to each new 
state. Step by step, those probabilities formed   a chain, one that eventually settled into a stable 
pattern. This was a moment when he discovered what   we now call a Markov chain. And this gave science 
something priceless, a language for structured   randomness. It became a universal tool, a way to 
model evolution, molecules, weather, economies,   and even intelligence. Just imagine, decades 
later, the same idea powered things like Google's   Page Rank and Deepmind's Alpha Zero. It's crazy 
how this simple idea ended up changing everything.   And if you watch till the end of the video, you 
will see it's even changing the computing. That   was for the first time when the world seen an 
opportunity to predict unpredictable. Not exactly,   but statistically. And then this idea collided 
with the most dangerous scientific project in   history. The race to build the first atomic 
bomb, the Manhattan project. At this time,   physicists were racing to understand the most 
chaotic process on Earth, a nuclear explosion.   The equations behind nuclear reactions were 
chaotic and basically unsolvable by hand.   But what if they didn't need exact numbers? 
What if they could just sample reality the way   Markov had done? A nuclear chain reaction looks 
impossible to predict. Each neutron flies off,   splits an atom and releases more neutrons, maybe 
triggering another reaction. Maybe not. The number   of possible paths is just astronomical. So how do 
you simulate cows like that? At Los Alamos, one of   the scientists, Stanisław Ulam had an idea. What 
if instead of solving everything exactly, we could   sample randomness itself? In practice, that means 
if you repeat something random many many times,   the average result will reveal the true value. 
Look, if you flip a coin just five times, you   can get four times head and one time tail, which 
may look wrong if the probability is 50%. But if   you flip it 5,000 times, you might get 2507 heads 
and 2,493 tails. And that's 50.1%. Much closer   to reality. And that's the law of large numbers. 
The more trials you run, the more accurate is the   result. That's how Stanisław Ulam realized that 
instead of solving every equation exactly, you can   run thousands or even millions of random trials 
and then average the results. Do that and you can   predict the outcome of chaos. This was a genuine 
breakthrough. He brought this idea to his friend   John von Neumann. Yes, that von Neumann who just 
designed the first computer that can store and   run its own programs which is remarkable because 
this is the same blueprint behind every computer   today. Together they turned Ulam's hunch into real 
mathematics. They called it the Monte Carlo method   after the casino in Monaco because it was just 
like gambling, randomness, big numbers, and the   law of averages. This allowed them to understand 
how nuclear chain reaction would behave without   tracking every single particle. And that proved 
something profound that randomness isn't enemy.   It can be a powerful tool. The Monte Carlo method 
spread like wildfire from nuclear physics to   weather prediction, finance, biology, and decades 
later to AI itself. If randomness could help us   simulate nature, maybe it could help us to compute 
just like nature. In 1953, John von Neumann made   one of the boldest proposals in computing history. 
Back then, every computer, digital or analog,   tried to eliminate randomness, noise, uncertainty. 
Those were the problems to get rid of. But von   Neumann saw it differently. Back then he imagined 
a machine that doesn't rely on exact numbers   or perfect transistor devices but could handle 
uncertainty and even keep working when the parts   fail just like brain just like nature. This is 
when he proposed a totally new kind of computing   system. Instead of calculating with exact values, 
a computer could calculate using probabilities.   And this means that you could build a system that 
gets the right answer on average using randomness   itself as a computing resource. And this was 
the moment of bur of stochastic computing. And   stochastic simply means something that involve 
randomness and changes over time. You know, as it   often happens in life when we have deterministic 
goals and stochastic execution. What's interesting   instead of representing 0.75 as a 32-bit number, 
he represented it as a random bit stream of zeros   and ones. If 75% of the bits are ones and 
25% are zeros, that means the value is 0.75.   This is where probability becomes data. And here 
was the crazy part. These noisy little circuits   could compute by simply counting how many ones 
appeared over time. He could add, multiply, and   even teach a circuit to adapt and learn using just 
a handful of logic gates. He called it stochastic   computing. And unlike new radical ideas, 
this one actually worked. What's interesting,   von Neumann himself believed that this might 
be the only way to build machines that could   one day think. But von Neumann didn't stay alone 
for long. Across the Atlantic at the University   of Manchester, Gaines took the idea even further. 
His team built a machine called RASCEL, the Random   Access Stochastic Computing Experimental Logic. It 
was built from analog noise generators plus some   simple logic gates. It was computing information 
from random electrical pulses. Yet from that   chaos, the correct result emerged. Gaines and 
his team were stunned because RASCEL didn't   just worked. It performed computation with sort of 
biological resilience because you could cut a wire   or burn the transistor and you would still get the 
right result on average. For a moment, it looked   unstoppable. But hidden beneath the excitement 
was a fatal flaw. Stochastic circuits needed long   bitstreams to get accurate answers. Thousands 
of random bits for a single number. So it was   brilliant but unbearably slow and worse because 
if two bitstreams become slightly correlated,   the math would just collapse. In 1978, researchers 
held the first conference on stochastic computing.   Paper after paper, they reached the same quiet 
conclusion. It was elegant in theory. It worked,   but it was too slow to survive. The same year, 
the RASCEL was powered down and the world moved   on with binary. But not everything that goes dark 
is gone forever. What excites me the most about   this story that this was invented many decades 
ago and then buried and now it's coming back and   not out of nostalgia but out of necessity because 
today modern AI demands so much computation and   energy that data centers are hitting limits power 
grids and cooling can't keep up. And now it looks   like the next revolution in computing might not 
come from better GPUs or smaller transistors,   but from something far more radical. Learning to 
compute with probabilities and trust noise. And I   will show you how stochastic computing works just 
in a moment, as well as a new chip that proves it   on silicon. That's super interesting. But before 
that, we have roughly three months left till end   of 2025. And my biggest goal for this year was 
simple. Keep learning. And this year delivered   on that. From building my tech startup to studying 
business at Stanford, none of that was comfortable   or easy, but it was worth it. But the truth 
is, we all still need to catch up on AI skills.   And good news, there is still time to change 
that. I think keeping up with AI is essential   because already now people who know how to use AI 
tools are replacing those who don't. That's why I   recommend you to join me at this 2day AI workshop 
by Outskill. They are hosting a live workshop   this Saturday and Sunday 10:00 a.m. to 7:00 p.m. 
EST. The feedback on this course from you guys   was incredible so far. This course normally costs 
$395, but in this video I partnered with Outskill   to provide 1,000 free seats for you. This offer 
valid for only 48 hours as a part of pre Halloween   sale. It's a fully hands-on AI training from 
experts at Microsoft and NVIDIA, people who've   actually built this industry. In just 16 
hours, you will cover more than 10 AI tools,   AI in Excel, sheets, and presentations, building 
AI agents, automating your workflows, and more.   You will also get access to a learning dashboard 
to connect with other builders, plus bonuses worth   over $5,000 if you attend both days, including 
a prompt bible and a personalized AI toolkit.   All of that is for you so you can enter 2026 
ahead of the curve. Register right now through   the link below or scan the QR code here. And 
thank you Outskill for sponsoring this episode.   Right now, one company is turning the idea of 
stochastic computing into real silicon. Normal   Computing is building a stochastic computing 
chip. But don't let the name fool you because   nothing about this is normal. It's probably one 
of the most radical ideas in computing. They are   building machines that compute in probability 
and use noise as a computational resource.   Let me explain. Traditional chips, CPUs, 
GPUs, TPUs are architectured for precision.   This means everything has to be perfect. 
Every clock edges controlled. Everything   should be synced up. Voltage levels have to be 
perfect and clean. Timing should be perfect.   That's why modern computing consumes so much 
power because it spends enormous amount of energy   forcing transistors to behave perfectly. Normal 
Computing takes a different approach here. They   accept that electronics is actually a physical 
system full of noise, drift and randomness by   nature and they're harnessing this to compute. 
to introduce this random noise the operating   chip at lower voltages intentionally close 
to the physical limits. When this happens,   transistors no longer cleanly switch between 
zero and one. Instead, they enter a probabilistic   region. Sometimes switching too early, sometimes 
late, sometimes not switching at all. And this   is normally where traditional chips fail. But 
they are intentionally pushing devices into this   dangerous zone and capturing this randomness as 
a computational resource. Now you may wonder but   why? The thing is many of the modern scientific 
problems from simulating molecules in physics to   training AI models to solving global optimization 
can all be described by stochastic differential   equations. Even generative AI runs on this idea. 
Models like Sora and Stable Diffusion don't simply   generate images or videos out of thin air. They 
solve stochastic differential equations step by   step gradually transforming random noise into 
structure. And under the hood, diffusion models   are just controlled stochastic processes. 
And here is where things get interesting.   Because GPUs are designed for graphics and they 
can do very well matrix multiplication but they   are not good at solving stochastic differential 
equations and if you force them to they can do it   but it's slow power hungry and absurdly expensive 
at scale and there is clearly a huge demand to   find a better more efficient way to compute it. 
This is where Normal Computing comes in with a new   way of thinking. Their chip is not trying to solve 
long equations the way GPU does. Instead, it uses   physics to do the work. Instead of doing millions 
of precise calculations step by step, they let the   system to move through many tiny random steps 
and find the answer sampling probabilities.   If there is one thing you can take away from 
this video, when your life feels like chaos,   you don't lose sanity. In fact, you are sampling 
the reality. Now, let's figure out how stochastic   computing works. In binary computing, numbers are 
stored precisely. For example, if we take 0.75,   a possible bit stream for 0.75 could look like 
this. You just count how many ones and zeros there   are. What's interesting, the order of ones and 
zeros doesn't matter. The only thing that matters   is that these bits are random because as soon 
as they start to follow any particular pattern,   the math breaks. Here is the elegant part. 
If you take these two numbers A and B and   you want to multiply them, you can send them 
through a simple logic gate and the output will   automatically become the product of two values. 
Imagine that A is 0.5 and B is 0.5. And you want   to multiply these two numbers. So what you do, 
you feed them bit by bit into a simple AND gate.   This device gives you one only when both inputs 
are one. Below you can see the resulting bit   stream. Here 4 out of 16 bits are ones and 
that's 0.25 or 25%. You see the beauty of this   approach that you can do multiplication complex 
multiplication using a simple logic gate instead   of complex and massive multipliers. And that's 
the power of this approach that it turns hard   math into very simple logic using randomness. Why 
is this a big deal? Because in modern computers,   multipliers are expensive. They use thousands of 
transistors, burn a lot of power, and take up a   lot of area on the chip. And chip area means 
money. But in stochastic approach instead of   using thousands of transistors you can do the same 
operation using one simple gate. This is the power   of this approach and this can save a lot of energy 
when you scale it to millions of operations behind   the modern AI workloads. The catch the accuracy in 
this approach comes from the law of large numbers.   the same ideas used during the Manhattan project. 
Basically, the more random samples you take,   the closer you get to the true answer. So, 
stochastic computing makes a simple tradeoff,   speed for precision. This is the same tradeoff 
that killed RASCEL in the 1960s. Back then,   computers demanded exact precision. But today 
AI doesn't need perfection. It needs speed and   efficiency. Have you ever thought where do this 
random bitstreams are coming from? Because you   need an actual source of randomness. And this 
is exactly where things can get wrong. Because   if your randomness isn't good enough, your entire 
computation collapses and you don't even see it   happening. When I used to design chips, we used 
a special circuit. And this circuit, I will put   the name here, basically spills out the long bit 
streams which look random. The problem is that   this one is not fully random because the output 
is predictable. After certain number of bits,   it loops in again. So, it repeats itself. And 
once this happens, your probability streams   become correlated and correlation is death in 
stochastic computing. Obviously, this won't   work and we need another source of randomness. And 
another simple option is to use an analog device,   for example, a resistor. Every resistor produced 
tiny unpredictable fluctuations called thermal   noise. and you can turn it into a stream of 
truly random bits. This kind of randomness   that computers can't fake. Actually, in this case, 
bitstreams will never repeat in the lifetime of   the universe. This will work. And now your math 
behaves. And it's isn't just computing anymore.   It's actually physics doing math for you. To 
do this, Normal Computing uses an algorithm   called a lattice random walk. Think of it like 
searching for the lowest point in a landscape like   in a valley. In this case, a GPU would calculate 
slopes and gradients and solve long equations to   get there. Normal chip doesn't bother with all 
that math. Instead, it takes many tiny random   steps. Each step looks random, but guess what? 
It's a markup chain and each next step depends   not on the whole history, but on the current state 
and it's not wandering blindly. Physics biases the   steps. Energy, noise and constraints gently push 
the system in the right direction. So even though   every step is small and local over time the whole 
system drifts towards the statistically correct   solution. That's the genius of this approach. 
Not heavy hardcore matrix math just tiny physical   state changes. They just let probability to do 
the work. Normal Computing has already built the   first prototype and it's already ramping it up in 
the lab. This one is a proof of concept to show   that stochastic computing in silicon actually 
works. It's designed for generative AI for   image generation. And the second one already in 
development will target video generation. But this   idea comes with real challenges because this isn't 
a general purpose computer chip. It only works for   a specific class of problems. those that can be 
described as stochastic differential equations and   that covers many AI and physics problems but not 
general computing scaling is another question mark   because the prototype is here but no one knows 
how this architecture will behave and we try to   connect thousands of them something we are doing 
right now easily with GPU clusters so the idea is   powerful but it's not ready from prime time yet. 
There are still many engineering challenges ahead   of them. Just think about it. If they solve them, 
it could redefine how we compute. Just imagine,   noise could replace multiplication. Physics 
could replace math. And what seems radical   today could become the new normal. Let me know 
what you think about this in the comment section   below. I would love to hear. And honestly, this 
video was a little bit stochastic. It took a lot   of research and reading lots of papers. So, if 
you enjoyed it, the best way to support us is   by giving this video a like, subscribing 
to the channel, and sharing sharing this   episode with your friends and colleagues. And 
don't forget to connect with me on LinkedIn.   I post deep dives there and to my newsletter. 
All the links you can find in the description box   below. And now you may like to watch this episode 
where I break down step by step what it takes to   build an AI supercluster on the example of the 
largest AI data center in the world. Check it   out or this episode where I explain how ternary 
computing works and I will see you there. Ciao.

---

## 10. New Colossus: World's Largest AI Datacenter Isn’t What It Seems
**Channel:** Anastasi In Tech | **Views:** 994K | **Date:** 4 months ago | **Duration:** 30:50 | **ID:** RxuSvyOwVCI
**Link:** https://youtube.com/watch?v=RxuSvyOwVCI

### Transcript:
There is a Colossus effect underway in computing. 
Something so massive it's reshaping the entire   energy industry computing and even geopolitics. 
Let me show you. Back in March, this was an   abandoned factory. Just 6 months later, Colossus 
2 stands here. A machine the size of a city built   not for people but for intelligence. It's nearly 
a million GPUs under one roof eating up a gigawatt   of power. This is the story of the world's 
first AI gigafactory and the insane journey   took to build it. I am an engineer who spent 
a decade building the most critical chips for   this technology. That's why I'm so excited about 
this particular story and its impact. Subscribe to   the channel right now and let me explain. Today, 
Amazon, Microsoft, OpenAI, and Meta, everyone is   pouring billions into AI factories because the 
race isn't just about smarter models anymore.   Every new generation needs at least 10 times 
more compute power. So, the hyperscalers are no   longer just running datacenters. They are building 
power plants to fuel AI faster and cheaper. Amazon   needs it to defend the cloud. OpenAI to push the 
frontier. Meta just to catch up. So slowly but   surely AI labs are turning into energy companies. 
And now comes xAI. Last September, they shocked   the industry with a Colossus 1. When just in 122 
days, they turned an empty shell into one of the   world's largest AI training sites. Then it took 
them 19 days, just 19 days, to wire and to deploy   100,000 NVIDIA GPUs. That alone was historic. the 
speed, the scale. No one in the industry have ever   built like this before. But today's story is about 
something far bigger. Colossus 2. And on paper,   it might look like just another datacenter, but 
in reality, it's four giants rolled in one. Just   imagine at peak, it will draw up to 1.2 gigawatts 
of power. And that's a lot. That's enough to keep   the lights on in more than 2 million homes. So 
what does it take to build a gigawatt datacenter?   And here it's getting interesting because 
you actually don't start with GPUs. You start   with power in every sense of this word. Without 
gigawatts of stable energy, the racks stay dark.   And that's where Colossus 2 becomes fascinating. 
Imagine you want to build a datacenter. The first   challenge is simple and brutal. Where do you find 
a gigawatt of power? And even if you secure that   much power, how do you push it into one building 
without frying the grid? At this scale, you have   to actually build a new electrical backbone. 
You need substations, switch gear, transformers,   backup, and distribution lines feeding straight 
into the racks. This means when you're building   an AI datacenter, the first thing you have to 
build is a power factory. And that's where the   drama of Colossus 2 begins. Colossus needed at 
least a full gigawatt with scaling up to two.   The city of Memphis, Tennessee, could barely 
spare 50 megawatt. Colossus needed a thousand.   Regulators said no. Communities pushed back. For a 
moment, the project looked dead until xAI crossed   the state line. Here they did something extreme. 
They found a solution just across the state line   in Southaven, Mississippi. Just a few miles from 
Memphis, the site was former Duke Energy power   plant with gas pipelines and grid connections 
already in place, but gas turbines long gone. So,   they decided to acquire this gas plant, which was 
perfect for a rebuild. Then came the bold move,   buying natural gas turbines overseas and shipping 
it to the US. Basically, they found the former   power plant abroad in Europe and broke it into 
containers sized modules, shipped it to the US,   and reassembled it in Mississippi. Sounds crazy, 
but it was far faster than building it in a   conventional way. And it worked. Within just a 
couple of months, the turbines were spinning.   Seven Titan class units, each over 35 megawatts. 
Together, they brought approximately 460 megawatts   online. What's interesting, solving power was 
only a half of the bottle. The real challenge   isn't just delivering electricity, it's in keeping 
it perfectly stable. GPUs spike in milliseconds   and such millisecond surge can drop voltage and 
in the worst case cascade through entire hall.   And restarting these runs isn't just annoying. 
It burns millions of dollars wasted in compute.   Ironically, NVIDIA advancements make this story 
worse. What actually makes it worse is density.   Because these aren't just ordinary racks anymore. 
We quite used to racks drawing about 50 kW of   power. But with new NVIDIA Blackwheel chips, power 
draw jumps from 50 kW to 130 kW per rack. And at   this scale, each rack pulls as much electricity 
as a small neighborhood. And keeping this supply   uninterrupted was one of the toughest problems. 
Colossus 2 had to solve for that. Colossus 2 pairs   its turbines with 168 Tesla megapacks. You can 
think of them as giant rechargeable batteries.   They soak energy when demand is low and release it 
instantly when demand surges. What's essential to   understand here that power doesn't flow straight 
from the grid to the racks. It moves through a   layered system built for stability. The grid and 
backup diesel generators fit into the megapacks   which smooth out spikes and only then electricity 
is rooted through power distribution and into the   rack arrays. The result steady predictable power 
to hundreds of thousands of GPUs and with that   power factory for Colossus 2 came alive. Without 
that bold move across the border, Colossus 2 would   simply not exist. And power is just the first 
pillar of four and the most invisible to the   most of us. But in effort, complexity, 
and cost, it's enormous. At Colossus 2,   power infrastructure alone, it's up 20% of the 
budget. Just think about it. It's billions spent   long before a single server is installed. 
Now looking at the AI race more broadly,   the real bottleneck is actually in power. Access 
to stable and abundant energy now will determine   who can train the best models and ultimately who 
wins or falls behind. And that's why hyperscalers   and AI labs are now quietly turning into energy 
companies. Microsoft is restarting the Three   Mile Island nuclear power plant to secure about 
850 megawatts of clean energy for AI. Google is   funding three new nuclear power plants for the 
very same reason. And that's crazy because just   10 years ago, the biggest datacenters run on just 
tens of megawatts. And today AI demands gigawatts   energy enough to power entire cities consumed 
just to keep models running. And the crazy part   is that hyperscalers are now on track to own more 
nuclear power capacity than some nuclear nations.   And I think long term the one who can lock down 
the most energy will shape the balance of power   not just at the level of hyperscalers but at the 
level of entire nations. And I'm really curious   to read your take on this in the comment 
section below. Now the first challenge is   solved. Power but the moment that electricity 
hits the servers it creates the next enemy.   heat and the scale is staggering. A 1 gigawatt 
datacenter throws off one gigawatt of heat.   Just imagine the output of entire industrial 
power plant trapped inside these four walls.   That's so much heat. It's almost hard to believe. 
Researchers estimate that a 1 gigawatt datacenter   dumps enough heat so that if you capture it 
with a heat recovery system, you could generate   roughly 15 megawatts of secondary power. In other 
words, the byproduct of keeping all these GPUs   alive could power a small city. But in reality, 
almost all of it has to be cooled away. and just   cooling itself. eats up roughly 30% of the total 
energy bill. And this problem is getting worse and   worse from year to year as AI racks get denser. If 
cooling stops even for 2 minutes, GPUs first slow   down, then racks crash and parts start to take 
permanent damage. I lived it from the other side.   And when you design chips, you quickly realize 
that the performance isn't just defined by clever   circuit design. It depends as much on keeping 
them cool, on the code that runs on them and   on the networks that tie them together. And the 
industry has already learned this the hard way.   Meta demolished an entire datacenter mid 
construction because its design couldn't   handle the density required for modern AI. The 
techniques that worked just fine for social   media and YouTube streaming collapsed instantly at 
Blackwell densities. So cooling became the second   great battle of Colossus 2. They had to find a 
way to deal with all that heat. And at this scale,   forget air cooling. What you need is water and 
a lot of it. Massive AI datacenters are infamous   for draining local water supplies. One average 
datacenter can consume millions of gallons per   day, competing with cities, farms, and 
entire regions. In droughtprone areas,   that's a nightmare. And many of America's 
biggest datacenters are rising in the worst   possible places in water scarce regions like 
Arizona and Nevada where every gallon is already   contested. xAI solution was extreme and I really 
liked it. They had to build a second factory,   a water factory right on the Colossus 2 campus in 
Memphis. They built the world's largest ceramic   membrane bioreactor. Basically a wastewater 
treatment plant. Instead of draining Memphis   underground drinking water, Colossus takes the 
dirty waste water from the city and turns it into   pure water for cooling. The scale is Colossus. 13 
million gallons a day of recycled water. That's   actually even more than the datacenter needs and 
that's a rare case when AI datacenter doesn't   drain the local water supply but instead improves 
the balance and I'm totally for that. Next,   we will uncover two more factories hidden inside 
the datacenter. Plus, the genius of чAI approach   because honestly, making it all work together 
at the Colossus scale isn't just engineering,   it's rocket science. Now, we have about 90 days 
left in 2025. And if I look back at my goals,   one of the biggest one was simple, keep learning. 
And this year delivered on that. From building my   tech startup to spending summer at Stanford, 
none of that was easy, but it was worth it.   But the truth is, we all have to catch up on 
AI skills, and there is still time for that.   Keeping up with AI is essential because already 
now people who know how to use AI are replacing   those who don't. That's why I recommend you to 
join me at this 2day AI workshop by Outskill.   Outskill is the world's first AI focused education 
platform and they're hosting a live workshop this   Saturday and Sunday 10:00 a.m. to 7:00 p.m. EST. 
Over 10 million people worldwide have already   attended this training. Many boosted their careers 
or even build businesses. This course is rated 4.9   out of five on Trustpilot. This course normally 
costs $395, but I partnered with Outskill to   provide 1,000 free seats for you. It's valid for 
the next 48 hours as a part of pre Halloween sale.   It's a fully hands-on AI training from experts 
at Microsoft and NVIDIA, people who've actually   built this industry. In just 16 hours, you 
will cover more than 10 AI tools, AI in Excel,   Sheets and Presentations, building AI agents, 
automating your workflows, and more. You will also   get an opportunity to connect with other builders, 
plus bonuses worth over $5,000 if you attend both   days of the training. This includes a prompt bible 
and the personalized AI toolkit. This will enable   you to enter 2026 ahead of the curve. Register 
right now through the link below or scan the QR   code here. And thank you Outskill for sponsoring 
this episode. How do you cool a million GPUs?   Inside Colossus 2, cooling works like a factory 
assembly line. Moving heat step by step until it's   pushed out of the building. Here is how it works. 
First, every rack has its own plumbing. Coolant   flows through thin channels called manifolds, 
feeding cold liquid directly into cold plates,   bolted onto every GPU, CPU, and memory chip. Think 
of this cold plates as mini radiators that suck   the heat straight off the silicon. Here, pumps 
at the bottom of the rack keep the liquid moving   in the closed loop. As it passes through the 
chips, the liquid heats up to about 45° C or 113°   F. Sensors in the rack constantly track flow and 
temperature. Because a stall here could fry tens   of thousands of dollars worth of GPUs in seconds. 
The warm coolant flows to a coolant distribution   unit which transfers the heat to the bigger 
buildings chilled water system and that's where   the custom second stage kicks in. 119 massive 
air cooled chillers outside the data halls.   They work like giant car radiators blowing air to 
strip 5 to 7° C or 9 to 13° F from the water each   cycle. In this way, the water is cooled back down 
to around 38 to 40° C or 100° F and the water is   sent back inside this hybrid system. liquid on 
the chips, chillers outside allows Colossus 2 keep GPUs packed tighter than ever before. 
At this scale, cooling isn't optional. It's   survival. And roughly 15% of the total investment 
went into building up this cooling system,   roughly $3 billion. As you can see, keeping this 
datacenter cool is just as hard as powering it.   Building power plant and cooling plant are both 
colossal challenges. And yet that's still not   what gives Colossus 2 its edge. The true advantage 
of Colossus 2 is hidden in fabric in the network.   Because modern AI datacenters are not datacenters 
at all. These aren't just tracks of GPUs. It's   one massive unified supercomputer. 500,000 GPUs 
mean nothing if they can't work as one giant GPU.   And that's the power of the network. And that's 
where Colossus 2 pulls away from everyone else.   If you open a rack in Colossus 2, you will see 
NVIDIA NVLink stitching GPUs together. NVLink 72 packs 72 GPUs. so tightly they behave like a 
single giant processor. But the real challenge   isn't inside the rack. It's scaling beyond 
it. Picture this. Thousands of racks spread   across multiple holes each packed with GPUs. 
But unless they move data in perfect sync,   you get chaos. That's the edge of Colossus 2 
in how these GPUs are interconnected. NVIDIA   Spectrum-X Ethernet fabric links everything 
at terabit speeds. So over 550,000 GPUs can   act like a single brain. And forget the 1 Gbit 
per second Ethernet at home. Here each link runs   at 400 Gbit per second with every GPU server 
pushing up to 3.6 Tbit per second of bandwidth.   Smart traffic control keeps congestion down and 
throughput above 90% across the entire datacenter.   And here is why it matters. Because here at the 
scale, just like in life, timing is everything.   If gradients or parameters arrive late, even 
by milliseconds, their radius tail GPUs end up   crunching outdated data and efficiency drops by 
half. That's why Colossus 2 bets on Spectrum-X   Ethernet re-engineered for AI workloads. And under 
the hood, as always, the magic comes from chips.   Here, Spectrum-X special chip is co-ackaged very 
close with optics which cut electrical losses and   keep latency predictable. At each server, special 
NVIDIA chips called Bluefield dataprocessing units   handle the networking, storage, and security. 
So, the GPUs can only focus on actual computing.   Think of it this way. GPUs deliver the compute 
but the network is what keep it all in sync.   Basically turning all this hardware in a single 
coherent supercomputer. So from outside it might   look like a warehouse but inside it's the largest 
AI supercomputer on earth. And since high-speed   datacenter interconnect is exactly what my 
startup, so my team and I are building silicon   for this application. that's why I'm working on 
a deep dive episode on the key technologies that   enables it. Make sure to subscribe to the channel 
not to miss this special episode. As you can see,   you don't just build a datacenter. You build four 
factories at once. power, cooling, networking, and   finally compute. Miss one and everything collapses 
like pulling one leg off a chair. And when it   comes to cost, compute is by far the biggest 
factory of all. To power a modern AI datacenter   like Colossus 2, everything starts with GPUs. And 
in this case, that means NVIDIA. Colossus 2 began   with 200,000 Hopper GPUs. Now it's been expanded 
with another 350,000 of NVIDIA's latest GB200 and   GB300 Blackwell GPUs. The GB300, known as the 
Blackwell Ultra, is built on the TSMC's 4 nm process and pushes over 20 pflops of FP4 compute 
per chip. Think of it as strapping a rocket engine   onto every rack. At launch, Colossus 2 will 
deliver 50 exaflops of compute. That's about   seven times more compute than the world's top 
10 fastest supercomputers combined. A true   Colossus of compute. But row compute still needs 
orchestration. That's where AMD's EPYC and Intel   Xeon CPUs come in. handling control, scheduling, 
and the background workloads that keep hundreds   of thousands of GPUs working as one. Then come the 
networking chips that we've just discussed before.   And of course, none of that would work without 
high bandwidth memory. The high bandwidth memory   used in Colossus 2 is predominantly from SK hynix 
and it pumps terabytes of data per second into   the compute cores ensuring those GPUs stay fully 
utilized. And finally, this pipeline needs to be   fed. So petabytes of SSD storage stream training 
data at speeds fast enough to keep every rack   busy. This is a silicon stack behind Colossus 
2, and that's a lot of silicon. Ironically,   that's not yet the finish line. The long-term 
target is to scale Colossus 2 to 1 million GPUs,   all stitched into a single working machine. Here 
they are using NVIDIA GPUs. And you may wonder   what happened to Tesla DOJO supercomputer. I was 
watching this project very close for years and   it was a genuine moonshot but unfortunately 
they shut it down. Building a supercomputer   silicon the entire stack from scratch isn't an 
easy task. You need a lot of particular talent   which is not easy to find. You need a lot of 
investment and you need a clear business case.   Most likely to justify this investment very often 
you need to sell it externally. I admire Tesla   for trying and if you want to know more on what 
happened I will share a link to my LinkedIn post   in the description box below. Now let's move 
on. Colossus 2 is built to train xAI largest   models starting with Grok then powering the next 
generation of Tesla full self-driving system and   Optimus robot training. The strategy is simple in 
AI the lab with access to the most compute moves   fastest and set the pace for everyone else. That's 
why Colossus 2 is way more than a datacenter.   It's a $20 billion strategic bet here. Roughly 
half of the total investment went into silicon   and hardware infrastructure. And after discussing 
all these four pillars, it's crazy to think about   this. That's explains why NVIDIA is the most 
valuable company in the world. And the second   biggest bill is power. Everything else is just 
to keep it alive. Already in some weeks from now   in October this year, Colossus 2 will light up. 
The pace is staggering. Despite all the battles,   they managed to build it in just six months, which 
typically takes other companies more than 16. And   that's exciting, but also terrifying because 
facilities like this, they don't just crunch   numbers and do math. They are consuming huge 
amounts of electricity and water. And of course,   Colossus 2 isn't alone. Switch's Citadel Campus 
in Nevada is a monster on its own. 650 megawatts across 1.3 million square feet operating roughly 
250,000 GPUs. But Colossus 2 isn't just bigger.   It's an entirely new class of AI datacenter. And 
yet the competition is right behind. OpenAI and   Microsoft are building Stargate with total plant 
capacity reaching nearly 10 gigawatts of power and   the Stargate flagship campus near Abilene, Texas 
targeting 1 gigawatt already by 2026. Apart of   Colossus 2, hundreds more AI datacenters 
are breaking ground in the US, in China,   across Europe. each one demanding more land, more 
steel, more turbines and more energy. Actually,   hyperscalers now command more energy than some 
of the countries. The truth is right now we are   building a whole new industrial layer, power 
hungry AI factories that depend on the same   resource every community and every nation depends 
on. And the costs here aren't just dollars.   It can be that eventually we will decide who get 
this energy people or machines. So whether you   care about cheaper AI tools or rising energy bills 
or who wins the next technological race, what's   happening inside Colossus 2 will touch your life. 
And that's exactly why I'm making this episode,   why I'm telling this story, because the impact of 
this is thrilling. I want to leave you with this   one. Let's hope that all of this will pay off and 
AI will help us to discover new energy sources,   new drugs, and expand human lifespan. Whether 
it will or not, only time will tell. Now,   drop your take in the comment section 
below. If you enjoyed this episode,   let me know because this one took a lot of work, 
a lot of research from my side and scripting,   and we are obsessed with raising the quality bar 
with every single episode. So, if you enjoyed it,   the best way to support us is by sharing this 
video on social media and with your friends   and subscribing to the channel. Remember to 
connect with me on LinkedIn and subscribe to   the newsletter. You can find all the links in 
the description box below. If you enjoyed this   episode, you will most likely love my breakdown 
on what it takes to build a semiconductor fab.   I will link it here. Thank you for your 
support and I will see you there. Ciao.

---

## 11. The World's First Ternary Computer
**Channel:** Anastasi In Tech | **Views:** 691K | **Date:** 4 months ago | **Duration:** 17:05 | **ID:** 3aewaff1494
**Link:** https://youtube.com/watch?v=3aewaff1494

### Transcript:
There is a blind spot at the heart of 
modern computing. For the last 70 years,   every computer chip on Earth has been built on the 
same foundation, binary, just zeros and ones. And   no one ever questioned it. But what if that was 
just a historical accident? What if computers   wouldn't stop at two states? What if they had a 
third? That's the idea behind ternary computing.   And this simple idea could unlock levels of 
efficiency binary could never touch. And it's not   just a theory. Decades ago, the Soviets actually 
built one. And today, this story taking a very   unexpected turn. Subscribe if you're curious, and 
let's get into it. Imagine the Soviet Union in the   50s. They had a strong start. They built one of 
the Europe's very first digital computers. Soon   after they released the BESM-1, a machine that 
outpaced America's best computer, UNIVAC I. But   this triumph didn't last. And here is the real 
reason. At the time in the US, IBM was cranking   out computers by the thousands. Meanwhile, in the 
USSR, every machine was almost handmade, built   with scarce parts and no scale of production. 
At this time at Moscow State University,   engineer Nikolay Brusentsov and his small team 
were cornered. Binary mainframes were too costly,   sealed inside government labs. Academia couldn't 
get near them. That's when Brusentsov chose to   fight back to build a new kind of computer, simple 
enough to build it with his scraps he had. Cheap   enough that students could finally put their 
hands on it. Brusentsov searched for answers,   spending months on finding a new way forward. And 
that's when he met Sergey Sobolev, a brilliant   mathematician who introduced him to ternary 
mathematics, a system built not on two states,   but three. This moment was like discovering a 
color TV in a black and white world. Suddenly   there was a whole new dimension and together 
they began exploring how this elegant idea   could be turned into a working computer. What's 
interesting Brusentsov argued that binary was just   a historical accident. Relays and vacuum tubes had 
only two states. That's how 0 and 1 logic became   the default. And since then nobody questioned it. 
But Brusentsov and his team did. They started to   work on Setun, the world's first computer to run 
on three logic states. -1 for NO, 1 for YES, and 0   sort of for both. We will dive into the details of 
how exactly it works later in the video. But for   now, imagine that each bit so-called "trit" can 
represent now three states instead of two. That   means more data can be processed in each computing 
step and math can be done with fewer moves.   Even negative numbers in this case don't need an 
additional "sign bit". So subtraction and addition   became naturally easier. And soon Brusentsov 
realized that this elegant math could turn into   circuits that were simpler, more efficient, and 
far cheaper to build. After 2 years of non-stop   work, in 1958, they finally unveiled Setun, the 
world's first ternary computer. Production began   the following year at the Kazan Mathematical 
Machines Factory and lasted for several years.   The hardware was primitive by today's standards. 
Just 2,000 magnetic elements and 100 germanium   transistors. But here is the thing. Setun came 
live on a very few components and it was at least   10 times cheaper than the binary machines of the 
day. Based on this paper, the Setun used about 30%   fewer parts than a binary machine. It was radical, 
but it worked. In 1959, the Soviets had something   the West didn't, a working ternary computer. 
About 50 units were built and sent to research   institutions. But then reality hit. The Fab had 
no interest in scaling up the production and the   Setun was just discontinued. And that's really 
sad. It didn't fail because it didn't work, but   because the Soviet Union lacked both the ecosystem 
and the political will to push it forward. And   it also failed because the world had already 
chosen binary. Memory, transistors, software.   the entire stack was locked into two states. 
So, Setun never really stood a chance and it   just faded into history. Fast forward to today and 
now AI is burning through energy like there is no   tomorrow. Data centers are pushing power grids to 
its limits. And once again, computing is hitting a   wall. The same wall Brusentsov saw in the 1950s. 
binary might not be enough. And this time with   advanced chip manufacturing and new semiconductor 
materials, three-state logic might finally have   its moment. And Huawei just proven that this might 
be possible. Let me show you. Every computer chip   today is built of tiny devices called transistors. 
And these devices switch between two states. A   classical transistor does it by switching at 
a certain threshold level. You can think of   threshold level as of person's patience level. 
Imagine you annoy someone just a little bit. So   nothing happens. But if you cross this level, 
boom, and you get a reaction. That's exactly   how a transistor works. That's the foundation of 
binary logic behind all modern chips. Now imagine   a regular transistor has just one threshold 
level just like a regular person. But if we   want to build a ternary computer, we need to 
add something extra. We need a device that can   clearly tell apart three different states. How do 
you do that? By giving a transistor two threshold   levels instead of one. And that's the magic to 
unlock three states. And from there you can start   building the entire computer in ternary logic. And 
this means you have to rebuild all logic circuits   including memory. So it can switch between three 
states instead of two. And well, that's quite some   work. And here it's getting exciting. Huawei 
just released their new ternary chip at 7 nm and we will have a look into how it works 
exactly in details in a moment. But before that,   have you ever wondered how much of your personal 
information is out there online? Your name, home   address, phone number, even information about your 
family members could be floating around online.   This happens because data brokers collect 
and sell your personal information without   you even realizing it. And this exposes you to 
risks of data breaches and personal security.   That's where Incogni, the sponsor of today's 
episode, comes in. Incogni helps you to regain   control by removing your personal information 
from the databases that brokers rely on.   I use it myself and you will be surprised how 
simple it is. You sign up, authorize Incogni   to act on your behalf and they send data 
protection low compliant requests to these   companies forcing them to remove your 
information from their databases. And   just now Incogni introduced a new custom
removals feature. It allows you to submit   links to websites that expose your data and 
Incogni's experts will remove it beyond their   automatic system. And then you can track every 
step of the progress right from your dashboard. I highly recommend you to try out Incogni. 
It's a simple way to reduce unwanted spam and   keep your data off the grid. Use my code INTECH 
at the link below to get 60% off their annual plan. For decades, ternary logic was trapped 
in the lab. Clever but impossible to scale.   Over years, old patents from Soviet pioneers and 
even IBM have long expired. And just recently,   Huawei released a new patent. Brand new patent for 
a ternary chip. The trick here is special devices,   special transistors that have not one but 
two threshold levels. And this allows chip   to distinguish clearly between three different 
states. And from there they rebuilt all the   building blocks including logic gates and memory. 
A ternary memory cell can now hold three values   instead of two. Packing more data into fewer 
space. Let's make it real with one simple example,   AND gate. And this actually takes us back to 
the Setun computer which also featured these   kind of gates. Here we picked this particular AND 
gate because it's very simple, basic but at the   same time essential part of every computer chip. 
Without AND gates computer can't make decisions.   Its job is simple only if all inputs are true 
then it gives me true so you can trust it in   binary logic with zeros and ones it's very simple 
and it's basically just 4 possible combinations   in ternary chip things get spicy each input 
can be -1, 0 or +1. This gives us 27 possible   combinations in this new setup AND gate returns 
you the lowest value. If at the input you have +1 and + 1, you get +1. If you have +1 and 0, 
you get 0. Anything with -1, you get -1. As   you can see with this simple example, now each 
bit carries more information compared to binary,   meaning high information density. This means you 
can do more with the same amount of input wires,   and this results in more compact chip circuits 
and more efficient designs. Huawei's new patent   showed that their new chip used 40% fewer 
devices, 60% less power, and run 20% faster.   But here is the thing about patents. Patents 
are tricky. Now, for example, in my startup,   we are deciding what to patent and what not to 
patent because whatever you patent is publicly   available. That's why the biggest breakthroughs 
often never get patented. And this means there   can be a lot more going behind the scenes which we 
haven't seen yet. And that's exciting. Subscribe   to the channel right now to stay up to date with 
the most exciting updates in technology. In fact,   the biggest promise of three-state logic is 
efficiency at scale. And right now, training   massive neural networks is a multi-million dollar 
power bill. Ternary chips could slash the energy   bill and speed things up. In a data center, 
that could mean cutting power use by a third   while boosting throughput. That sounds almost too 
good to be true. And that's where the story takes   a turn. Ternary chips are still digital, but 
because they use three states, they sit halfway   to analog. So we have digital chips which are 
binary, just two states. We have analog chips   which have infinite states and in between sit 
ternary chips. This could be a perfect tradeoff.   But there is a catch. Noise. A ternary device has 
to distinguish between three different states,   not just two. And even the tiniest noise or 
manufacturing flaw can blur them, causing   errors. Building reliable three-state logic 
at scale is brutally hard. And don't forget,   today's entire semiconductor ecosystem is 
built for binary software, memory, compilers,   everything. That was a challenge in the 1950s and 
it hasn't gone away. The solution here could be   graphene and carbon nanotube transistors. One 
of the most powerful tricks nature gives us for   electronics. These are tiny rolled up sheets of 
graphene just a few nanometers wide. And these   are a perfect match for ternary logic because 
their size naturally decides how they switch. And   by changing the diameter of a nanotube, you can 
clearly set three logic levels. That makes them   perfect for ternary logic. In fact, advantages of 
graphene go way beyond that. Graphene itself can   move electricity incredibly fast, even at very low 
power. And for any kind of chip, that means cooler   processors, longer battery life, and big energy 
savings in data centers. That's why TSMC and IMEC   are betting on it as one of the strongest path 
for the post silicon era. And it's not just talk.   One of the recent IEEE papers showed a ternary 
chip built with carbon nanotubes transistors at   32 nm. The result 45% less area, 30% less energy 
for the same AI operations binary chips do today.   And that's not an incremental step. That's a big 
leap. So will ternary replace binary? Let me know   your thoughts in the comments. Probably it will 
find a way alongside binary for the applications   where we need it the most because history shows 
us that the biggest revolution in computing and   beyond coming not from having more of the same but 
from daring to try something entirely different.   And the same goes to you. The next big leap 
in your life or your career may come from one   thing everyone else is too afraid to try. Connect 
with me on LinkedIn and check out my newsletter.   We send it out weekly. All the links you will find 
in the description box below. A lot of good stuff.   Now check out this deep dive in the future of 
US chip manufacturing or this one deep dive   into the robotics the insane technology behind the 
first human clone and I will see you there. Ciao.

---

## 12. Huge US Chip Breakthrough — and a Big Warning for All
**Channel:** Anastasi In Tech | **Views:** 777K | **Date:** 5 months ago | **Duration:** 29:19 | **ID:** 1VX3jNJmbcI
**Link:** https://youtube.com/watch?v=1VX3jNJmbcI

### Transcript:
There is a tectonic shift underway in chipmaking 
One so big it's not just about factories. It's   about who controls the global economy itself. Let 
me show you. Just a few years ago, the Arizona   desert was nothing but dust. Fast forward to today 
and the same land holds America's most ambitious   project. TSMC's most advanced chip factory, a $165 
billion bet on the future of microchips. There is   a reason why TSMC chose Arizona. The desert offers 
one advantage Taiwan can't match. almost zero risk   of natural disaster. And that stability matters 
when the stakes are that high. The plan sounded   simple. Just copy a semiconductor fab from Taiwan 
into the US soil. But this turned out to be way   harder than anyone ever expected. In Arizona, 
TSMC ran straight into a sandstorm of problems   because chipmaking at the nanometer scale isn't 
about construction. It's choreography, equipment,   chemicals, and people moving in a perfect 
lock step. Get it right and you are printing   money. Miss just one step and billions go up in 
smoke. And here is the irony. The US invented   the semiconductor industry and still leads in 
design equipment and software for chip design.   But manufacturing dominance slipped away. US share 
of chips fell from 40% in 1990 to about 10% today.   Can TSMC bring advanced chip making back to the 
US? Subscribe if you're curious and let's get into   it. On paper, the plan is simple. In reality, it's 
brutal. In Taiwan, TSMC can build a fab in just   2 years. In Arizona, every single step took at 
least twice as long. So, what happened? I've been   working in semiconductor industry for the last 10 
years. And my main lesson is chipmaking is the art   of killing variables. Now consider this. At 4 nm 
process, there are hundreds of variables spread   across 4,000 manufacturing steps. And here is the 
catch. Any of them can kill a chip. And variables   don't behave the same in every place. In Taiwan, 
TSMC tuned the recipe for local water, air, power,   suppliers, and even culture. Move the fab to 
Arizona, and all these variables shift. Arizona   is not known for water. Air is different. And most 
important, the culture is very different. Even the   ground is different. Here the ground is much 
drier with rock hard layers beneath that gives   it the higher natural frequency. Any of those 
shifts can throw off nanoscale precision which   is enough to kill an entire chip. Now multiply 
that across thousands of wafers and suddenly   production yield drops. Yield is critical. It's 
a percentage of chips per wafer that actually   function. At 90% yield, like TSMC achieves in 
Taiwan, you're practically minting money. At 30%,   you're bleeding cash. But in Arizona, instead 
of glory, there was chaos. Variables drifted.   Dust storms breached clean rooms. Every system 
was pushed to its limits. Yield collapsed. The   truth is, you can ship in equipment. You can even 
fly in engineers from Taiwan, but you cannot ship   the context. And here is a hidden truth. Each 
time you want to build a semiconductor factory,   you're not just building one. In fact, you have 
to build four factories, four invisible factories   inside. The first invisible factory inside the 
factory is the Water Plant. And in the desert,   this is the hardest battle of all. You might be 
surprised, but at the bleeding edge, water matters   as much as the famous EUV lithography machines. 
And that's the problem because semiconductor   manufacturing uses a lot of water. While Arizona 
is one of the most water stressed places on Earth,   the state depends on the Colorado River which is 
already stretched to its limit. At the same time,   Arizona hosts more than 100 active data centers 
and this includes massive data centers run by   hyperscalers like Meta and Microsoft. These 
facilities consume enormous amount of water for   cooling. The irony is brutal. Those same data 
centers burn a lot of energy and power plants   again use water to generate this energy. That 
electricity turns into heat inside the servers   which then require even more water to cool them. 
It's a feedback loop with heavy consequences.   As you can see, the water situation there is 
already a nightmare. And now this new fab will   attempt to draw on the same finite supply. But a 
semiconductor fab is not just thirsty for large   quantities of water. It requires ultra pure water. 
That's the 1,000 times cleaner than drinking water   and even cleaner than the one used in medical 
injections. Because a single contaminant or   particle can destroy a $30,000 wafer. Water is 
a backbone of semiconductor manufacturing. It   touches nearly every step of the process. After 
etching, it rinses away acids. After photoresist,   it strips away chemicals. Just imagine even 
in immersion lithography water sits between   the lens and wafer sharpening the image and 
amount of water used is quite shocking. Each   and every silicon wafer drinks around 2,000 
gallons of water across its lifetime. This   means Fab 21 alone will consume more than 
4 million gallons. That's about six Olympic   swimming pools of water per day. In Taiwan, TSMC 
cracked this by building dedicated Water Plants,   purifying and recycling every possible drop. 
But in Arizona, water is different, chemically   different. It's full of magnesium and calcium. You 
can't just copy paste the solution from Taiwan.   So how do you get that much pure water in the 
middle of desert? The answer is hard. You don't   just build a semiconductor fab. You have to build 
a dedicated Water Plant of the size of a stadium.   Inside water flows through stage after stage, 
filtration, reverse osmosis and deionization.   And even after all of that, tiny impurities still 
remain. Then comes the final polishing. Resins and   ultra filters scrub out the last traces leaving 
water so pure it exists only in semiconductor fab.   And TSMC had to rebuild this entire system for the 
unique chemistry of Arizona's water. What comes   out is the purest water on Earth. And the genius 
of the water fab is that instead of dumping waste,   the plant recycles it, making sure their 
hard-earned investment doesn't go down the drain,   literally. If for some reason it can't be 
reused again, it gets redirected into cooling.   That's how Fab 21 reduces its draw on city water 
while still feeding one of the most water hungry   fabs on the planet. Soon they realized water 
wasn't enough. Another critical cleanser in tube   making is sulfuric acid. The quiet backbone of 
the fab. It strips photo resist, clears residues,   and burns away any trace of contamination so 
the next layer can stick. It's not glamorous,   but without sulfuric acid, the fab stops cold. 
and not just any acid will do. Again, it has   to be ultra pure. And that's where Arizona hit the 
wall. US vendors were able to make clean acid, but   local prices were nearly five times higher than in 
Taiwan. So, TSMC had to ship it 6,500 miles from   Taiwan. And as crazy as it sounds, it was still 
cheaper and more reliable than buying locally. Of   course, that couldn't last forever. So, the supply 
chain followed. Sunlit, a Taiwanese chemical giant   and one of the key TSMC partners, had to build 
a new plant in Phoenix. Again, not a copy-paste   factory, but one attuned to Arizona's specific 
water and desert conditions. And that move was   critical because copying a fab means copying its 
suppliers too and planting them next door. If acid   is a backbone, then gases are the lifeline of a 
fab. And not just oxygen or nitrogen, but gases   like neon, rare and tough to source at the ultra 
high purity chipmaking needs. Neon is critical for   the lasers used in photolithography. It makes up 
about 95% of the gas mix inside deep ultraviolet   tools that print chip patterns. EUV handles 
the most critical layers. The interconnect,   but DUV still prints the most of the stack. The 
fact is DUV can't run without neon. The catch here   is again it has to be ultra pure. I know I said 
it already three times, but that's the fact, the   truth of chipmaking. Everything has to be cleaner 
than clean. Even a trace of impurity destabilizes   the laser, blurs the light and seeds tiny defects 
that collapse the yield. And again, Arizona comes   up empty. No local supply. For now only a few 
essential gases used in chipmaking are produced   locally in Fab 21. But most of the speciality 
gases are still imported from Taiwan, Japan,   and Europe. That's the fragile truth. And even 
the silicon wafers themselves are still shipped   from Taiwan and Japan. So from the outside, Fab 
21 looks American, but under the hood, it's still   tied to a supply chain stretching far, thousands 
of miles across the oceans. And that reminds me   of something closer to home. These days, we are 
all juggling different AI tools. One for writing,   another for research, another for emails. And 
just like with fabs, when you source it all from   everywhere, the complexity adds up in time and 
in money. That's why I've been using Merlin AI.   It's all in one AI tool that brings together the 
best AI models all in one place. In my workflow,   it's super useful for summarizing dense research 
papers or fact checking or even scripting videos   like this one. While ChatGPT Plus is $20 a month 
for just one single model, with Merlin, you get   all of them in one place for about $5 a month with 
my 75% off code. If you want to try Merlin AI,   click the link below or scan the QR code here and 
use my code AN5 at the checkout. This code will   magically bring price down to about $5. This 
discount is valid for a limited time only. So   check it out right now and thank you Merlin for 
sponsoring this episode. Water is one challenge,   but what about air? You might think surely 
Arizona has plenty of air, right? But that's   the most fragile ingredient in the recipe. And 
once you get into a semiconductor fab, you will   immediately realize why. Back when I was doing 
my master thesis, which was now approximately   a decade ago, I used to go inside the fab, inside 
the cleanroom, because there was something wrong   going on with my chip and I had to go and watch 
the whole process to figure out what's going   on. That's when I first saw how extreme these 
environments are because the obsession with   cleanliness is beyond imagination. Basically, 
you are wrapped head to toe in a cleanroom suit. The rules are absolute. Nothing escapes 
your body into the air. Even a single eyelash   drifting onto a wafer can destroy weeks of 
progress. Cleanrooms is a place where the chips   really get their crunch. Fab's 21 cleanroom 
is enormous. About 160,000 square meters or   up to 1.7 million square ft. By size alone, it 
ranks among the largest cleanrooms ever built.   But the bigger the room, the harder it is to 
keep it pure. And the Arizona desert makes it   even tougher. Clean air is constantly pushed from 
the ceiling, flowing smoothly over the machines,   then slipping through vents in the floor. 
And it's all about pressure. Because the air   pressure inside the cleanroom is kept slightly 
higher than outside. Dust and particles from   the desert can never be permitted to leak in. 
TSMC flew in teams from Taiwan to fine-tune air   flow until it was perfect. Just imagine outside 
there are thousands of particles while inside   the fab inside the cleanroom it can never 
rise above 10 particles per cubic meter.   It's fascinating because the fab literally 
breathes outwards and pushes the desert away.   And once the air is finally under control, 
the next challenge begins. The tools arrive.   And this is where the real money shows up. 70% 
of a fab's cost isn't concrete or clean rooms.   It's the machines. billions of dollars worth 
of tools packed wall-to-wall. And this is an   area that really plays to America's strength. 
Companies like Applied Materials, Lam Research,   and KLA cover most of the critical steps in 
chipmaking, getting that equipment to Arizona   was an easy part. But one thing the US doesn't 
have is lithography. The most advanced tools,   EUV and DUV scanners that print chip patterns on 
the wafers come from ASML in Netherlands. Without   these tools, no fab, not even TSMC can print chips 
at 5, 3 or 2 nm. The United States lead in edge,   deposition, process control, but they still have 
to import EUV machines from Europe. Moving these   machines into the fab is a stressful process 
because if you tilt a component even slightly or   drop a part, the precision is ruined. Importing 
and installing EUV machines is a stressful job.   Just one mistake and the fab goes dark before 
it even starts. TSMC' Fab 21 needs not one but   dozens machines worth $150 million each just 
to get started. And once it's all in place,   you realize something else. Actually, building 
a fab was the easy part. The real challenge   is what comes next. getting these machines to 
work together seamlessly, flawlessly to crave   the tiniest transistor features into silicon. 
This is pure art. Imagine it's like conducting   an orchestra where every single instrument cost 
$150 million and plays at the scale of atoms. Here   the real battle for yield begins because the fab 
doesn't make any money before the wafer comes out   clean from defects and the first wafers never do. 
The equipment is new. The process steps are new   in the new environment. So engineers, operators, 
and even tool vendors work together day and night,   tuning, adjusting each of thousand steps it takes 
to build a modern computer chip. And the scale is   brutal. At 4 nm, a single wafer stacks more than 
80 layers across 4,000 process steps. It takes   months and thousands of tweaks before the first 
wafer finally comes out right. This is the first   4 nm wafer manufactured at Fab 21 in Arizona. The 
most advanced silicon wafer ever made on the US   soil. It's progress, but that only happened after 
going through a lot of pain. Output is still low,   covering only about 7% of the US demand. And 
costs in Arizona are at least 50% higher than   in Taiwan. Why? Because almost all raw materials 
from chemicals to wafers are still shipped in   from abroad. And that's quite surprising 
because Intel's most advanced fab, Fab 42, has been sitting just 30 minutes away for more 
than a decade. Yet, most of its materials still   come from abroad. Now, TSMC is trying to rebuild 
the entire supply chain here locally in Arizona.   And in the desert, engineering talent is even 
scarcier than water. Taiwan's real advantage   isn't just fabs, it's people. Generations of 
engineers trained in the rituals of chipmaking.   But here is a harsh truth. Why it is in fact so 
hard to build a semiconductor fab? Because yes,   you need machines and chemicals and ecosystem, but 
the breakthroughs don't come from machines. They   come from people. This is the invisible web that 
holds it all together. Engineers who know how to   fine-tune every process. Suppliers who can deliver 
pure chemicals on time and service teams who can   bring a $150 million EUV machine back to life at 
3:00 a.m. without stopping the line. In Taiwan,   this skill set has been built over decades. 
Arizona had none of that. So they started to   fix this gap. Local colleges started to create 
semiconductor programs. TSMC started to send   engineers to Taiwan to give them the opportunity 
to absorb the culture of extreme precision.   Because chipmaking at the bleeding edge isn't just 
knowledge, it's a habit, muscle memory. And slowly   yield began to climb. By January this year, Fab 21 
finally reached mass production of 4 nm chips with   yields now reported as comparable to TSMC's fabs 
in Taiwan. That means this complex choreography   is finally clicking. Water, air, wafers, acids, 
tools, and even people all moving together in   a perfect sync. This is a true milestone. By 
2028, this fab is set to grow to a mega fab,   cranking out 100,000 wafers a month. For the 
first time in decades, America is able to produce   bleeding edge logic chips built domestically. It's 
a breakthrough and warning at the same time. You   saw it yourself. These chips are expensive and 
still dependent on a long supply chain. Output is   still a fraction of what is produced in Taiwan. 
And packaging it still flies across the Pacific   because the chips like NVIDIA GPUs which are 
built in Fab 21 literally send back to Taiwan   for the final assembly. The reason is simple. The 
US doesn't have advanced packaging capacity yet,   especially for chip-on- -wafer-on-substrate 
packaging. And this one is critical because   it allows to place multiple dies side by side 
on a single interposer. Basically allowing you   to put high bandwidth memory right next to the GPU 
cores. That's why every NVIDIA GPU, including the   new Blackwell GPU, depends on it. And for now, 
this packaging can be only done in Taiwan. The   long-term goal eventually to bring this packaging 
in house on American soil. The biggest challenge   of Fab 21 is that it will be always behind 
the Taiwan by one or two process nodes. And   the logic is simple. Taiwan develops, Arizona 
inherits. Every new process node, let's say 1.6   nm starts in Taiwan. The R&D center runs the 
pilot line often with the yields below 30%. Then   the work shifts to the mother fab where yields are 
pushed up and the processes stabilized. Only once   it's mature, they transfer it overseas. That means 
Fab 21 won't invent new nodes, but it will take   on the critical ramp up. This model lets TSMC to 
expand globally without losing efficiency. But the   goal is even bigger to eventually build a mother 
fab in the US as well. And it's impressive that   despite all these challenges, TSMC is still pushed 
through. The 1,100-acre site is designed for up to   six fabs. Three are already underway alongside 
two advanced packaging facilities and an R&D   center. Together, they will form a start of a full 
semiconductor ecosystem right here in the desert.   The first fab, phase 1, is already ramping up the 
production of NVIDIA and Apple chips. Phase 1 and   phase 3 are planned for 2026, targeting the next 
generation 3 nm and 2 nm process nodes. But Fab   21 isn't enough. We need more fabs, more scale, 
more engineering talent. And that's why I think   Intel matters so much. Intel foundry isn't just 
another business unit. It's the most important   part of Intel and it carries massive strategic 
value for the United States. What is interesting,   Intel's Fab 42 is actually 25 miles away from 
this new TSMC fab. Today it manufactures 10   nm class technology and it is set to ramp up the 
production of Intel 7 and Intel 4 nodes. But the   bigger play is what comes next Intel 18A which is 
designed to compete with TSMC's A16. Both of them   will use the new gate-all-around transistor 
architecture and backside power delivery. You   can see now why Intel has struggled. One of the 
reasons on top of everything we've discussed that   fabs are just too expensive and this financial 
gravity pulled everyone else out of this tough   race. For a foundry to be profitable, you need 
to have massive wafer volume just to pay off the   billions invested. At the bleeding edge, only TSMC 
and Samsung have the capital and scale to make   the economics work. Will Intel be able to catch 
up? Only time will tell. For the US, the chips   act is just the beginning. To really compete, 
they need to streamline approvals so fabs don't   take a decade to build. And most importantly, they 
have to support semiconductor startups. After all,   it was Silicon Valley startups that created 
the whole modern semiconductor industry. And   the next step is to fix the talent pipeline 
means inspire new talent and build this whole   cultural prestige around semiconductors. This 
was actually the mission of my channel from the   very beginning. Back then, nobody was talking 
about semiconductors. And as a chip designer,   my goal was and still is to bring more young 
talent into the industry so we can push it   forward together. And if you believe in 
this mission, support me by sharing this   video with your friends and colleagues. 
Fab 21 proves something very important.   It proves that you can't just copy a semiconductor 
fab. You need to build four custom factories in   one. A factory for water, a factory for air, a 
factory for tools, and a factory for people. And   then even a factory for power, which we haven't 
discussed yet. Get one wrong, just a little bit,   and the whole system collapses. And Arizona 
showed just how brutal this can be. This time,   TSMC has given America a foothold. Will they be 
able to turn it into a powerhouse? We will find   out soon. You've been watching Anastasi in Tech. 
This episode was a lot of work. If you enjoyed it,   subscribe to the channel and connect with me 
on LinkedIn. You can find all the links in the   description box below. Thank you for your support 
and I going to see you in the next one. Ciao

---

## 13. I Met Protoclone. It’s Actually Insane
**Channel:** Anastasi In Tech | **Views:** 676K | **Date:** 5 months ago | **Duration:** 19:32 | **ID:** E1theCfcFsA
**Link:** https://youtube.com/watch?v=E1theCfcFsA

### Transcript:
Clone Robotics has just revealed a robot that 
looks, moves, and simply feels like us. They call   it Protoclone. Its body is powered by artificial 
muscles, bones, blood, and even a beating heart.  Our vision for a musculoskeletal clones 
comes from a deep desire to make.   So, we flew all the way to Wrotsław, Poland to 
meet the creators of Protoclone, and be among   the first ones to see it in action. Subscribe 
if you're curious, and let's get into it. It all   started with a muscle. Years ago, Lucas, now 
the CTO of Clone Robotics, was experimenting   with synthetic muscles and he stumbled across an 
unconventional design. No motors, no wires, just   rubber tubes. It looked simple, but it turned out 
to be one of the most radical ideas in robotics,   the McKibben muscle. Joseph McKibben, the man 
behind it, was a physicist who once worked on   the Manhattan project. But his most important 
invention had nothing to do with atomic bomb.   It came from a personal tragedy. His daughter 
has lost the use of your hands. And McKibben   devoted himself to build an artificial muscle 
so she could use her hands again. Over time,   McKibben came up with something new, the pneumatic 
muscle. So, you have an inner rubber tube and when   it's pressurized with fluid, like a balloon, 
it expands radially. And when surrounded with   a inextensible textile braided sleeve, you're 
able to constrain that radial expansion of the   balloon to produce a linear contraction with a 
pulling force in a single axis. You get to mimic   a lot of the properties of human skeletal muscle 
this way. So with a tube and some air, McKibben   managed to replicate some of the nature's most 
complex mechanisms. This was life changing for   his daughter and she was now able to eat and even 
write. This invention became known as a McKibben   muscle. Lucas was fascinated. These muscles were 
cheap, but soon he hit a hard truth. These muscles   were weak. you know, like a balloon filled with 
air. And maybe the story would have ended there if   not for someone else. That's when Dhanush, Clone 
Robotics CEO, stepped in to turn it into a working   humanoid. Together, they started to search for a 
way to make artificial muscles truly powerful. The   clue came from hydraulics because water, unlike 
air, carries real strength. What's interesting,   their early prototypes used air, but air was too 
weak and needed a bulky compressor. A hydraulic   pump, on the other hand, fits neatly into the 
abdomen. That's why today it fully runs on water.   The result, a new artificial muscle they called 
Myofiber. This was their first real breakthrough.   And it's really impressive and powerful. Imagine 
a muscle weighing just a gram can lift more than   300 times its own weight. The Myofiber muscles are 
also fast, contracting in under 50 milliseconds,   almost as quick as ours. And based on these new 
muscles, they started to build the hand. But   when we first started the company, we started 
by focusing on making a durable human level   robotic hand. And within the first 18 months 
of the company itself, this is something we   managed to do and something that I'm very proud 
of. And that's no coincidence. The hand is one   of the most complicated parts in the human's 
body. It would seem impossible to replicate.   It's a hand packed with dozens of muscles, 
ligaments, and joints. It moves with 27 degrees   of freedom. No other startup has mastered the hand 
at this level. It's strong enough to lift up to 15   lbs. And it can actually use human tools. So, they 
started with a hand first. 3 years later, they   revealed the Clone Torso. And in 2025, finally 
the full android with lags Protoclone. I saw it   myself. Live. And it's seriously impressive. We've 
been prepared for this moment our whole lives.   The Matrix, Terminator, Westworld, and now it has 
become reality. Our vision for a musculoskeletal   clone comes from a deep desire to make an 
android that can do anything a human can do. So   a functional human clone. Just think about it. If 
you want to build the most advanced perfect robot,   why not to copy the most advanced machine that 
exists today? Us. Our body was perfected by   millions of years of evolution. It's flexible, 
strong, and extremely energy efficient. We are   far from the most perfect mechanism. But we are 
the most universal one. And that's exactly what   Clone is targeting. What you see here isn't just 
a frame. It's a complete skeleton. With over 200   bonds and more than a 1,000 Myofiber muscles, 
it mimics the muscular, skeletal, circulatory,   and even nervous systems of a human. The bones 
are 3D printed from a lightweight polymer.   The beauty of this design that the muscles even 
attach at anatomically accurate points giving   it natural motion and range. So it moves just 
like you. If we go down inside the ribcage sits   the valve system almost like a synthetic organs 
and at its core beats a heart a hydraulic pump.   Instead of pumping blood, it pushes fluid into the 
artificial muscles, filling them with pressure,   so they're able to contract and move just 
like real muscles do. What's interesting,   the water isn't just for movement, it cools them 
down, just like in our own bodies where blood flow   regulates heat. And here is where is the story 
really splits. Most humanoid robots today from   1X Figure Tesla they are amazing but they depend 
on motors which comes at a cost. Motors drain   batteries add weight and make movement stiff. 
Clone decided to break from this path and instead   of motors they are using synthetic muscles as we 
discussed. What's interesting this single decision   changes everything about the robot. The muscles 
give it more degrees of freedom. Protoclone has   over 200° while its competitors between 30 
to 60. Could this be the iPhone moment in the   market full of Blackberries? I'm excited to see 
what you think in the comment section below and   remember to subscribe to the channel. Next, 
we are coming to the most interesting part.   We will talk about the brain and intelligence and 
what this robot is really built for. Because this   isn't just robotics, it's AI at work. In 2025, 
over half of all companies are already using AI.   Research shows that 40% of people worry AI will 
replace them at their workplace. But in reality,   it's people who use AI will replace the ones who 
don't. And it's already happening now. Microsoft,   Google, Amazon are currently hiring people that 
understand AI, who know how to build with AI.   And this isn't just about getting a job. If you're 
building a startup like me or create anything or a   working professional, AI, in fact, isn't a threat 
to you. It's a leverage. Used right. It can save   you hours of time and thousands of dollars in 
cost and you need to learn how to use it. Now,   this is why I highly recommend joining this 2 
days AI training by Outskill which takes you from   beginner to advanced AI professional in just 16 
hours. It's valued at $895. But I partnered with   Outskill to provide 1,000 free seats for you. 
This 2-day program offers 16 hours of live AI   training spread across 2 days happening on this 
Saturday and Sunday 10:00 a.m. to 7:00 p.m. of   the coming weekend. In this training, you will 
learn more than 20 AI tools: prompt engineering,   developing AI agents, and more. And exclusively 
for my audience you can join it for free. You can   click the link below or scan the QR code here. And 
thank you Outskill for sponsoring this episode.   So, how does it perceive the world? It turns 
out just like us. It's packed with sensors all   over its body. It has four depth cameras in the 
head, over 500 sensors across the body, including   70 inertial sensors to track movement, and 320 
pressure sensors built into the muscles and skin.   Those pressure sensors are critical for allowing 
it to grip objects gently without even thinking.   Without them, a robot could simply crush a cup. 
Just think about it. It's not just bones, muscles,   and sensors. It's all linked and working together 
as a single system. But what a body without a   brain. Especially when we love deep dives into 
hardware on this channel. Let's have a look   what drives it. Inside the skull, an NVIDIA chip 
does the thinking. Think of it as a supercomputer   packed into something the size of your hand. Today 
it's just the NVIDIA Jetson chip that controls the   entire robot. Over the longer term, we'll end 
up using um ASICS across the body. Kind of like   in the human body where you have neurons near 
the heart, you have neurons at the wrists. And   I I expect that in the long run, we may end up 
adding ASICS in various parts of the body. And on   the background, they are training the foundational 
model that controls vision, move and reaction in   real time. The critical part here is to be able 
to process sensors, vision, and even multiple AI   models in real time inside the robot's cow so it 
can react instantly without waiting for the cloud.   And that's it. What is left is to wrap it in skin, 
get the blood flowing, and then just send it back   in time. Here is a big question. What is the point 
of building a human-like body and brain without   a purpose? And this is where things start to get 
really interesting. The Clone is the ideal human   companion. Your Clone is your compliment that fits 
into your life like a perfect jigsaw puzzle piece.   So you wake up in the morning and your clone is 
at your bedside with a tray, and breakfast bites,   and orange juice. You get to your workplace 
and your android is acting as your assistant   helping you make your job super easy whatever your 
job may be. This is sort of the android companion   lifestyle we envision at Clone really transforming 
every aspect of your life being as sort of   attached to you as your iPhone is today. For their 
first fleet, the robot will simply learn from you.   Imagine it stands behind you watching what you 
do and then just copies that. Imagine it can cook   your favorite dish just the way you like it. You 
can talk to it in natural language and it can do   household tasks we all hate like dishwashing and 
laundry. What a dream come true. But before this   beautiful vision becomes real, they first have 
to solve quite some technical challenges. And   the first one is obvious. Walking. Right now, the 
robot is still hanging on cables from the ceiling.   They are in the process of teaching it to balance 
and walk on its own. Today, the milestone that   we're aiming for to I guess blow everyone's minds, 
including ourselves, is getting to the untethered   walking biped. So, like really the first synthetic 
human that you know is mobile walking on its own,   it doesn't require any kind of cable to the 
grid or tube to a central pressure source. That   involves not only you know obviously the physics 
simulation and software required to train it to   walk but also requires a ton of compactification 
and clever arrangement of the valves, batteries,   hydraulic power units which includes not only the 
pump but you know accumulators a reservoir a ton   of tubing and cabling and getting all of that 
fit inside of the limited volume we have inside   of the ribcage. So this is largely the focus of 
the company outside of continuing to improve the   biomechanics of the robot. This is one of the 
hardest challenges in robotics because actually   on Earth not so many creatures manage to master 
bipedal. So two legs balance because we humans   have a very complex system. Our ears helps us to 
sense tilt and stay upright and this is a complex   system working every second. Many animals rely 
on a tail to keep their balance. So this robot   doesn't come with this feature. Protoclone has to 
learn balance entirely from scratch. The secret   here is in neural networks which drive every 
movement. And before the robot even touches the   ground, it spent countless hours practicing in a 
simulation. And already the next generation Clone   Alpha is being designed to walk like a human. In 
terms of aesthetic appearance, you can imagine   it's going to have skin. So it will not won't have 
the all these muscles exposed in the robots that   we actually end up selling. By capabilities, we 
should have a first version of a robot foundation   model that's capable of learning to perform new 
manipulation tasks. For now, the robot doesn't   have a face, but eventually it will. And the 
challenge here is huge. If you don't replicate   them perfectly, you fall straight into the uncanny 
valley. It's a challenge to make a face that's   compelling, that fits aesthetic of the rest of 
the robot. that essentially needs to be a perfect   human face with 40 facial muscles replicating 
every little micro expression in the human face.   So, this is something that we'll treat really well 
and make sure we get right before we introduce   that. Likely separate product line to the market. 
But giving a robot a body is only half of the   story. The bigger question is how do you give it 
a mind? The challenge is training humanoids isn't   like training a large language model. ChatGPT and 
other language models know more than any human,   but they've never lived in the world. They never 
felt weight, cold, or heat. And most importantly,   they don't comprehend the consequences of their 
actions. What I'm trying to say that feeding data   for training of humanoids is not enough. You have 
to invent entirely new control systems and then   teach it how to interact with the real world. For 
that, Clone Robotics will use a physics simulator.   Basically, a virtual playground where thousands 
of androids can train in parallel. Basically, the   idea is to create endless synthetic worlds where 
androids can fail, try again, and learn faster.   They have to interpret sensory inputs, 
vision, touch, balance in context. In short,   humanoids learn the way we do - by doing. So 
here is a question. Does true superintelligence   actually require a body? A superintelligence 
doesn't require a body, but it makes it probably   a million times more useful to us. you're almost 
nerfing your super intelligence if you don't give   it a body. The vast majority of the things that I 
want to command some intelligence system to do is   in the real world because I'm an embodied being. 
so to drive utility out of a superintelligence,   I'd argue that you really do want it to have a 
body. And so robotics will end up becoming this   great lever for modern deep learning, modern AI. 
But why copy humans with all our flaws? Why not to   build something superior, stronger? I think those 
kind of robots could be just too much, too strong,   too heavy, and too unsafe to live at home with us. 
I think that's why Protoclone isn't built like an   indestructible machine. It has just like we have 
relatively fragile joints and limited motion.   Probably if we share the same weaknesses, we 
will feel more safe standing behind them. Will   it become a part of our lives? We will find 
out soon. This episode is definitely one of   my most favorite to date. We put a lot of 
effort in it. So, please share it with your   friends and colleagues. And it's definitely worth 
listening to our full conversation with Dhanush.   I will upload it on Apple Podcast and Spotify. 
Make sure to check it out. It's a great deep   dive into robotics. Thank you for your support. 
Love you guys. See you in the next one. Ciao

---

## 14. Why Light Will Change Computers Forever
**Channel:** Anastasi In Tech | **Views:** 213K | **Date:** 5 months ago | **Duration:** 16:19 | **ID:** b_PS8o8pi9A
**Link:** https://youtube.com/watch?v=b_PS8o8pi9A

### Transcript:
This tiny microchip is only a few millimeters 
across. But if you zoom in, you would see   hundreds of billions of transistors so small 
they're just a few atoms wide. But we can't   really shrink them much further. At the same time, 
our ambitions for artificial intelligence keep   skyrocketing and it's demanding more computing 
power than ever before. Here is a big question.   If today's chips can't keep up, what comes next? 
But maybe the answer isn't in electrons at all,   but in light. That would mean computing literally 
at the speed of light. This new microchip makes it   real. It's up to a 1,000 times faster than today's 
chips, using the same power as a single LED bulb.   This new light-based processor is a big 
collaboration between top US universities led   by some of the biggest names in photonics. After 
years of trial and error, they've done something   stunning. For the first time, light itself can 
not only compute but also remember with incredible   precision, something that seemed impossible 
just a few years ago. But hold on. How do you   actually store light? Inside your smartphone, 
there are over 60 chips built of more than 100   billion transistors. Think of transistors as tiny 
switches, so small you can't actually see them.   They do computing by flipping on and off billions 
of times every second. Every time it flips from 0   to 1, it's like cars driving through city traffic. 
They have to stop at every red light, start again,   stop again, and it all takes time. It slows 
computing down and wastes energy. With light,   it works differently. Light is a wave, so you 
can process it while it's still moving without   ever stopping the data. You can bend it, split 
it, or combine it, and it's just keep flowing.   In other words, here you're computing on the fly. 
And that's the beauty of it. And the best part,   it uses way less energy because you only need 
energy to send and to receive the light. At   least that's the theory. But the light alone has a 
fatal flaw. Memory. Imagine you are worried about   how much energy modern AI is burning and you 
should be and you decide to invent a completely   new kind of computer. To make it work, there are 
three things you have to figure out. First of all,   compute. You have to find a way to manipulate 
signals to add and to multiply them. Second is   interconnect. the ability to move data 
around on a chip. And the third one,   which is usually forgotten, is memory. You need 
to be able to somehow store results in order   to be able to use them later on. With photonic 
chips, we do really well on the first two. We can   compute with light and we can send data across 
chips and even entire data centers with light.   But storing results with light has been always a 
weak spot because reliable photonic memory doesn't   exist. This means whenever we have to save data, 
we have to go back to electronics basically to   switch from light to regular transistors. That 
part slows everything down and in many cases   cancels out the very benefits of using light in 
the first place. And this is exactly the part   scientists thought was impossible. There is no 
way to store light. And this new processor for   the first time actually gives light a memory. 
And this is a paradigm shift because now the   computing happens right where the data is stored. 
They found a way to compute directly in memory.   You could say this processor never forgets because 
it's got a photon graphic memory. If you're   enjoying this episode, could you do me a quick 
favor and hit the subscribe button? This helps   us a lot to bring you the highest quality content 
and the top guests from the industry. Thank you.   Now, this computer can actually remember 
things. And that's where it starts to get really   interesting. If we zoom in into the chip, it's 
built of special devices called resonators. You   can imagine it as a tiny ring that traps light. 
You can think of it like a wine glass. You tap it and it rings at one special note. In the same way, 
resonator rings at one special color of light. By   tuning the ring, you can decide how light goes 
through. And if you could build memory right   there, it could be a game changer for computing 
because AI demand is exploding. In 2025, over half   of all companies are already using AI. Research 
shows that 40% of people worry AI will replace   them at their job. But in reality, people using 
AI will replace those who don't. And it's already   happening right now. Microsoft, Google, Amazon 
are currently hiring people that understand AI,   who know how to build with AI. If you build a 
startup like me or create anything or a working   professional, AI isn't a threat to you. It's a 
leverage because used right it can help you to   save hours of time and thousands of dollars 
in cost and you need to learn how to use it   now. This is why I highly recommend joining this 
2-day AI training by Outskill, which takes you   from beginner to advanced AI professional in just 
16 hours. It's valued at $895, but I partnered   with Outskill to provide 1,000 free seats for 
you. And the feedback from you guys on this   training has been amazing so far. This two-day 
program offers 16 hours of live AI training spread   across two days happening on the coming weekend on 
this Saturday and Sunday 10:00 a.m. to 7:00 p.m.   In this training, you will learn more than 20 AI 
tools: prompt engineering, developing AI agents,   and more. And exclusively for my audience, you can 
join it for free. Register right now through the   link below or scan the QR code here. And thank you 
Outskill for sponsoring this episode. So, how do   they actually store light on this computer chip? 
They built a tiny ring on the chip and attached a   special phase change memory right on top of this 
ring. It's made of a crystalal-like material.   This layer can store numbers with very high 
precision up to 12 bits which means the chip   can do calculations much more accurately which 
is a big deal for photonics because one of the   biggest flows of its analog nature is actually 
precision. So by putting these two parts together,   ring and memory device, we can actually store 
data on the chip. And because we combined   computer engine and memory at one place, we can do 
in-memory computing. So when light passes through   the ring, it doesn't just move, it does the 
math instantly right where the value is stored.   And that's a big deal because for the first time 
light-based processor got the memory. Finally,   a chip with bright memory. Why this matter? 
Because our current processors like in your   laptop or your phone move data back and forth 
between memory and processor. In fact, roughly   80% of total energy is spent in this moving data. 
rather than on compute itself. Imagine that's   like driving a Porsche 911 GT3 RS in rush hour 
traffic. What a waste. While this new photonic   chip avoids this bottleneck. The outcome, it can 
perform a quadrillion operations every second at   low power. Imagine it's a sort of running a 
supercomputer on the power of a night light.   It's manufactured using conventional silicon 
photonic technology. Nothing exotic. At 22 nm  at Global Foundries. The chip maker that some 
years ago span out of AMD. The light part and the   electronic part are stacked together vertically, 
kind of like the Lightmatter chip I showed you   before. And if you missed that episode, subscribe 
to the channel and I will leave all the links in   the description box below for you to catch up. 
Why this chip is so special. To understand this,   you have to read this paper which is honestly not 
an easy read. The best investment of my life is   studying this stuff at university. What is special 
about this chip that with light on chip you can do   things you can never do with electronics and the 
genius of light that it has many different colors   and you can encode data at many different colors 
at the same time and process it all in parallel.   This new chip can already process data at 32 
different colors of light in parallel and it   can be scaled to more. Here is how it works. 
Let's take an example with four colors. We can   encode one number into purple light, another into 
blue, the third into green, and another into red.   That means four different numbers are written into 
four different colors of light and we can compute   all of them at once on just one device. This 
white ring. Basically, it allows us to process   a lot of information using just one device. In 
electronics, you would need a separate device   for each number. That makes a big difference. Now, 
why do we care? Because the core math behind all   the AI workloads is running billions of times per 
second every second every single day and it's done   now on traditional chips which takes one device 
per operation. Just imagine it's like airport   security. Passengers go through the scanner one 
at a time. But on a light-based chip it's like   scanning the entire crowd all at once. On a GPU, 
this kind of operation takes roughly 1,000 steps,   depending on the size, of course, but for example. 
But on a photonic chip, we can do it all at once.   That means computing with light enables us to 
compute up to a 1,000 times faster. Well, that's a   big promise. But what does it enable? These chips 
are not built to replace the processor in your   laptop, but they can do something normal chips 
can't. Handle massive amounts of data ultra fast   with very little energy. That makes them perfect 
for workloads like the 3 billion daily requests   behind ChatGPT, which today burns more energy than 
entire cities. The reason why all the hyperscalers   like Google, Microsoft, Amazon, everyone is 
building custom chips because they all have   massive AI workloads and looking for a cheaper 
way to run it at scale. As of today, saving energy   isn't just about saving the Earth's resources. 
It's actually a huge part of the operating costs   of a data center. So, if a light-based computer 
can deliver the same performance using at least a   little bit less energy, everyone will want to buy 
it. But we see that the promise here is in fact   much bigger. Computing with light could speed up 
way more things than just AI inference workloads.   For example, scientific simulations, which often 
take many months to finish. But before you get too   excited, there is a catch or three. The first one 
is scalability. This is a big one because photonic   components are much larger than electronic 
transistors. So you can't pack as many of them   onto a chip otherwise the chip will become huge. 
Still scaling it to a real AI models like gpt-5   remains a big challenge. The second challenge is 
the material itself. And this is where it start to   get really tricky. This special memory wears out 
if you use it too much. Like a battery that lasts   just so many charges. Thousands of cycles are 
fine for demos, but data centers need billions of   cycles. And this part isn't solved yet. And then 
as with any new technology there is a challenge   of integration with existing computers and systems 
that we are already using today. Everything today,   CPUs, GPUs, the software stack, entire data 
centers is built for electronic processors and   light-based accelerators need new interfaces and 
rewriting the software which takes time to build.   This work shows that the potential is real. The 
question is who will make it real first and who   will make it to work at scale. Here competition 
is heating up. Startups like Lightmatter,   Lightelligence, Q.ANT, and others all racing to 
deliver. Now, I'm curious to hear your thoughts   in the comment section below. And I hope this 
video lightened up your day. You've been watching   Anastasi in Tech. Remember to connect with me on 
LinkedIn and share this video with your friends.   I really appreciate your support and I will 
see you in the next episode. And for this one,   I got to travel far away to show you something 
very special. Love you guys. See you. Ciao.

---

## 15. The New Computer That Thinks Like a Brain
**Channel:** Anastasi In Tech | **Views:** 179K | **Date:** 6 months ago | **Duration:** 18:41 | **ID:** MmP8GYOoM-k
**Link:** https://youtube.com/watch?v=MmP8GYOoM-k

### Transcript:
For the last 50 years, your phone, your 
laptop, the entire internet has been powered   by traditional computer chips. Chips that compute 
in perfect rhythm. But your brain works completely   differently. It's chaotic, unpredictable, and only 
activates when it needs to. Yet, it's capable of   incredible things no traditional chip can match. 
Now, it seems we've built something very similar   to our brain. This is a new chip so small that it 
can balance on the tip of your fingernail. Yet,   it thinks like a brain and remembers everything. 
And it turned out to be 100 times faster than   the chips we use today while consuming 500 times 
less energy. In this video, we will explore how   this technology mimics our brain and why this 
might be the last microchip technology we will   ever need. Right now, the world is hungry for 
computing power. AI chips are faster than ever,   but they burn through energy like there is no 
tomorrow. Just imagine the latest NVIDIA GPU   uses roughly 1,000 W of power. Your brain only 20 
W less than a dim light bulb. And yet your brain   can match the computing power of Apple's latest 
chip with 28 billion transistors. Or imagine an   owl. Its brain runs on less than 1 W of 
power. Yet it can fly silently, spot a tiny   mouse in near total darkness, calculate the 
perfect angle, and catch it all in real time.   If you tried to do that with a computer chip, 
you would need a dozen of them, plus lots of   sensors burning hundreds of watts of power. And 
honestly, you would still probably miss the mouse.   And that's the beauty of neuromorphic computing. 
Biological brains can do so much using very little   power. And that's the reason why researchers 
have been obsessed with neuromorphic computing,   building chips that think like brains. Today we 
will look at a new chip called Pulsar, a tiny   brain-like processor only 3 mm wide. It's built 
by a small Dutch company called Innatera. Over   10 years ago, they quietly started experimenting 
with this idea. And now it's real. A tiny chip   that you can actually buy today. So how do you 
even replicate a brain on a chip? Your brain has   about 86 billion neurons and it's very different 
from a CPU. In a CPU, everything is built out of   tiny switches called transistors. And all those 
switches flip on and off in a perfect rhythm.   Because the whole chip runs on a central clock. 
For example, the latest Apple chip operates at up   to 4 GHz clock speed, which means it's switching 
4 billion times per second. This clock orchestrate   every calculation happening on a chip. And 
the thing is this clock is very power hungry.   What's interesting actually our brain proves 
that we don't need all this complexity to handle   incredibly complex tasks. Our brain is actually 
pretty slow, firing only about 40 times per   second. The 86 billion neurons in your head don't 
wait for a central clock to tell them what to do.   Each neuron just listens to tiny electrical 
spikes coming from its neighbors. But the most   beautiful part about our brain that it's actually 
an analog machine. Yes, it's chaotic if you zoom   in. But if you step back, it all comes together 
to create something astonishing. Consciousness.   When I used to design chips, now I supervise 
people in my startup. We are building silicon.   But I used to design chips and for a computer 
chip we want every signal to be perfect to   reduce noise. While here in this box it's very 
noisy. And yet our brain manages to turn all this   noise into a useful computation. If you want to 
build a computer chip that computes like a brain,   you need to start with a neuron. The basic 
building block. It's actually not a computing   core and not a memory either. It's kind of both 
at the same time. A neuron receives signals,   decides what to do, and then sends a signal 
forward. That's computation. And because the   connection points called synapses can get stronger 
or weaker based on experience, that's memory. So   each neuron is like a tiny processor with built-in 
memory. To build a real brain-like computer,   we have to copy that. And based on this paper, 
it seems they've built it in silicon using some   sort of resistive memory technology. Resistive 
memory works in a way that it computes and stores   information based on how easily electricity flows 
through it. You apply a signal pulse to the memory   and it changes how much electricity can go through 
it. On a neuromorphic chip, these neural network   weights are stored directly in these memory 
devices. Just imagine when the inputs arrive   the electric current flowing through the chip 
will flow through these memory devices and that   automatically does the multiplying for you right 
at the place where the weight is stored. This   means this chip can remember and compute in the 
same place just like the brain. Now before we dive   into how this new chip works, its key application 
and main drawbacks, have you ever thought about   how much of your personal information could 
be out there online? Your name, home address,   phone number, even information about your 
family members could be floating around online.   This happens because data brokers collect and 
sell your personal information without you even   realizing it. This exposes you to risks of data 
breaches and personal security. And that's where   Incogni, the sponsor of today's episode, comes 
in. Incogni helps you regain control by removing   your personal information from the databases 
that data brokers rely on. I've used it myself   and you will be surprised how simple it is. You 
sign up, authorize Incogni to act on your behalf   and they send data protection low compliant 
requests to these companies forcing them to   remove your information from their databases. 
And now just recently Incogni introduced a new   custom removals feature. This feature allows you 
to submit links to the websites which expose your   personal data and then Incogni's privacy experts 
will remove it beyond their automatic system. And   my favorite part, you can track every step of the 
progress in real time right from your dashboard.   As someone who values privacy, I highly recommend 
you to try out Incogni. It's a simple way to   reduce unwanted spam and keep your data off the 
grid. Use my code INTECH at the link below to get   60% off the annual plan. Now, let's peel back 
the layers of this tiny chip. Inside, you will   find two different brains working together. One is 
analog and spiking. This is the part mimicking the   brain that we've just discussed. It features 1,000 
neurons and basically runs approximation of neuron   behavior. And sure, 1,000 neurons is nothing when 
we compare it to 86 billion neurons in our brain.   It's nowhere near the real cognition. Yet, this 
tiny network of 1,000 neurons might be just enough   to process data coming from some sensor, a camera 
for example. And it does it by running a special   kind of neural network, so-called a Spiking 
Neural Network or SNN. Unlike regular AI models,   a Spiking Neural Network works more like a 
brain, processing information through spikes and   events instead of continuous signals. Instead of 
constantly crunching numbers, it stays quiet most   of the time. That's where the energy savings come 
from and only reacts when event happen. Imagine a   camera that doesn't record every single frame, 
but only reacts the moment a bird flies past.   And this property makes Spiking Neural Networks 
perfect for robots, sensors, or devices that need   to think fast without draining a battery. And the 
second brain is digital built to run Convolutional   Neural Networks which is another type of neural 
networks. Let me explain. So if you look on the   sketch which I drew just now, I'm clearly not 
an artist. It's pretty ugly, but you're still   probably able to guess that it's a house. Now this 
ability to recognize images comes so naturally to   us. But machines can't do that and that's where 
we need Convolutional Neural Networks that are   specializing on this pattern recognition. CNN's 
are really good at looking at images or things   that come in a grid like pictures or even sound 
waves. So the CNN can zoom in into particular   parts of this image and with the filters detect 
these parts just like our brain does. It detects   some of these features in parallel. And so here 
they combine Convolutional Neural Network and   Spiking Neural Network in one chip so that this 
chip can use CNNs to recognize patterns in the   data and then Spiking Neural Network to handle and 
react to the events. And it works in a way so that   when we connect this Pulsar chip to a sensor it 
can hear and it can see. It can recognize images,   process speech, and do it using almost no power. 
But unlike a biological brain, this chip doesn't   need to spend roughly 30% of time resting just 
to be able to function properly. Picture this,   a phone you don't have to charge for weeks, or a 
laptop that lasts a whole week on a single charge.   AI that runs almost anywhere without draining 
power. Well, that future just got a lot closer.   Innatera plans to bring this chip into billions of 
devices and sensors so that cameras, microphones,   and devices can see, hear, and think just like our 
brain. and all this data to be processed on this   tiny chip without sending any data to the cloud. 
Right now we have already a lot of sensors around   us in our phones, cars, factories and even in our 
homes. And it's already clear that in the next   years this market going to explode. Sensors will 
be everywhere in buildings, factories, robots,   and even our clothing. The result, a future where 
almost everything around us can sense, think,   and respond. And in order to be able to understand 
what we see with this sensors, we need a lot   of tiny and efficient chips. That's the market 
Innatera is going for. The idea of brain inspired   computing is powerful. Our brain outperforms the 
best chips we've ever built. But there is a risk.   One big challenge of this technology is scaling. 
We've already discussed that 1,000 neurons is not   enough. And to come closer to the capabilities of 
our brain, we have to scale it up. But there is a   challenge - parasitics. You can maybe double the 
number of neurons. But getting 10 times more will   be very hard. If we try to scale the analog core 
parasitics becoming bigger and bigger and this   makes bigger networks harder to run efficiently 
and also reduces the precision. I actually worked   in the past on a similar chip. Here is my 
LinkedIn. So when I was reading this paper,   something immediately caught my attention. Aside 
from two brains we've just discussed, this chip   actually looks a lot like a microcontroller. 
A microcontroller is basically a tiny computer   chips that controls simple tasks and devices 
and you will find many of them in your everyday   devices like in your fridge, in your car, in 
your washing machine. So this chip has all the   usual microcontroller parts which is good and 
bad news at the same time. Let me explain. The   biggest problem of this technology is the market 
because the opportunity is huge but this market   is very much cost sensitive. One thing I learned 
at Stanford that in a crowded market in order to   be just considered you have to get noticed and in 
order to get noticed you need to build something   new. So to add or to remove some of the features 
for this Innatera chip the brain like the spiking   component is how they stand out in the crowded 
world of microcontrollers. The biggest problem   here is that the microcontrollers market is a huge 
red ocean. So, you can build the best ever chip,   but you can't price it much higher, and that's 
a tough game. On top of that, big players like   Infineon, ST, NXP, Nordic are already adding AI 
features to their chips. And even the smartest   chip can fail if no one is ready to pay for it. In 
my opinion, long-term, these chips won't replace   the entire brain of the computer or compete with 
NVIDIA GPUs. Instead, they will power small niche   tasks like detecting objects or recognizing 
events. But before this mass adoption happens,   we have to address another challenge which is 
software. Because currently programming these   chips, these neuromorphic chips takes special 
skills. Unlike normal computer chips which have   decades of software development, neuromorphic 
chips are starting more or less from scratch.   Today they still require a regular computer to 
help with training and setup. and doing it fully   on the chip is still years away. And long term, 
the biggest impact is going to be in robotics   and factory automation. And this will be super 
exciting to watch. One thing is clear, soon we   will live in the world with trillions of tiny 
sensors. And brain-like computing technology is   still in its early stage. And no one knows if it 
will truly take off. But the world needs faster,   greener chips. And nothing inspires this future 
more than the brain itself. And it all begins with   a tiny chip that fits on your fingertip. My name 
is Anastasia and you've been watching Anastasi and   Tech. Remember to subscribe to the channel and 
check out all the links in the description box   below. And don't miss the new podcast episode that 
is coming this week featuring Nick Harris, the CEO   of Lightmatter. Thank you guys for your support. 
Love you. Got to see you in the next one. Ciao

---

## 16. Japan’s New Chip Breakthrough
**Channel:** Anastasi In Tech | **Views:** 447K | **Date:** 6 months ago | **Duration:** 21:57 | **ID:** _ja5Z3IHXu8
**Link:** https://youtube.com/watch?v=_ja5Z3IHXu8

### Transcript:
There was a time when one country was ahead 
of everyone in making computer chips and it   was Japan. In the late 80s, they produced more 
than half of all the chips in the world. Today,   less than 10%. But what if I told you that 
Japan is quietly getting ready for a huge   comeback? Right now, they're building one of 
the most advanced chip factories in the world.   and at the same time design top tier CPUs in 2nm 
technology. It's a huge bold move for the country.   I was very lucky to spend a decade designing 
chips and I also worked with Japanese teams.   That's why this episode is so exciting for me. So 
in this video we will talk about Japan's bold bet   on a company called Rapidus, their secret sauce, 
a brand new 2 nm chip and some materials they are   testing beyond silicon. Back in the 80s, Japan 
was the land of the rising chips. They dominated   memory production, providing nearly 90% of global 
supply, but it didn't last. So, what went wrong?   And it's important to understand this because 
it's a very interesting pattern. Something   similar might be happening right now with some 
other companies. The transistor, the tiny switch   that powers all modern electronics, was invented 
in the US at Bell Labs back in the 1950s. But in   the 1980s, Japan made a bold move. They bet early 
on a new type of chip technology, one that most   companies were not using yet. At that time, 
American companies mostly used the technology   called n-channel MoS, which was easier and cheaper 
to build. Meanwhile, Japan chose something else,   CMOS, which stands for Complimentary 
Metal-Oxide-Semiconductor. And believe it or not,   CMOS is still the technology which runs your 
laptop and phone today. Back then it was risky,   complicated and very expensive. So most companies 
just passed on it. But Japan took the risk. As   chipmaking tools became better, CMOS technology 
became cheaper and easier build at scale. So   this one decision helped Japan to pull ahead fast. 
Just imagine Japan became so strong in chips they   actually forced Intel to quit the memory business. 
And funny enough this was actually one of the best   things that happened to Intel. So Japan did a 
huge bet on this memory technology. And when   you combine that with access to cheap capital and 
world-class factory automation, they pulled way   ahead. But that success didn't last. There were a 
few reasons why, but the biggest one, Japan didn't   adapt fast because the rest of the world, the rest 
of the industry moved fast. And Japan was stuck to   doing everything by themselves, designing chips, 
manufacturing them, and packaging them all under   one roof. Funny enough, there are still some 
of those all-in-one players around today like   Intel and Samsung, but we will get to that later. 
Back then, it worked for Japan until it didn't.   The world became so fast and just moved on. 
Foundries like TSMC focused only on manufacturing,   manufacturing chips for others and they scaled 
much faster. So, we all know how it ended because   right now the most advanced chips are coming 
mostly from two places, Taiwan and South Korea.   And now Japan is stepping up too. It's strategic 
and long-term will affect everyone because if   Japan succeeds, it means better technology, more 
innovation, and potentially cheaper devices. But   honestly, it's not even about the cheaper price. 
It's about who controls the future of technology.   Now, to the most exciting part. Let's see what 
Japan is actually doing and how do you rebuild the   entire advanced chip industry from scratch. First, 
they are bringing in everyone, the government,   big companies, universities, even partners outside 
Japan like TSMC and IBM. But their biggest bet   is on one new company called Rapidus. And it's 
not your average startup. It's actually one of   the wildest startups out there. It's backed by the 
Japanese government and by huge names like Toyota,   Sony, SoftBank, and their mission is bold. 
They're building one of the most advanced chip   factories and their goal is to manufacture these 
state-of-the-art 2 nm chips right in Hokkaido,   Japan. That's what TSMC is working on right now 
and they will be bringing this technology to your   laptops and phones this fall and Japan wants to 
get there too. So I think they have a very clever   plan. They are teaming up with IBM and IMEC, two 
of the key innovators in chip technology. Now, if   you never heard of IMEC, it's one of the biggest 
innovators and one of the biggest research hubs   in the world for advanced technologies. I broke it 
down in my previous episode. I will link it below   because there is a very high chance you missed 
it because 70% of you watching this video are   unfortunately not subscribed to the channel. Make 
sure to subscribe right now. It's free. It cost   you nothing and it helps you to stay in the loop 
with what is next in technology. Rapidus teamed   up with IBM, the company that actually built the 
world's first 2 nm chip back in 2021. And right   now over 100 Japanese engineers are working side 
by side with IBM researchers in New York to make   it happen. You see IBM and IMEC are bringing 
in the know-how and Rapidus is responsible   for turning it into a real working fabs. What's 
really interesting, Rapidus is not just copying   what others are doing. They have their own secret 
sauce. Most big chip makers like TSMC, Intel,   Samsung build chips in batches. They process 25 
wafers at a time because it's faster and it saves   money, but Rapidus is doing it one wafer at a 
time, which totally makes sense when you are just   ramping up the production. Yes, it's slower, but 
it gives them way more control and it's worth it,   especially in the early stages when precision and 
fast learning matters more than volumes. get it   right and then scale it up. Clearly, they are 
going for quality first. And we always expect   it from Japanese products because made in Japan 
means top-notch. So, this quality first approach   is in their DNA, which is actually one of the 
most critical qualities and advantages when it   comes to chip manufacturing. Next, we are diving 
into the most fascinating part of this story.   Can Japan actually pull this off and compete with 
TSMC and how they plan to do it in just 5 years,   which is honestly insanely fast. And we will also 
have a look on the first wafers and the first 2 nm   chip and some very exciting materials they are 
investigating beyond silicon. But before that,   have you ever wondered how much of your personal 
information could be out there online? Your name,   phone number, home address, even information 
about your family members could be floating   around online. This happens because data brokers 
collect and sell your personal information without   you even realizing it. This exposes you to risks 
of data breaches and personal security. That's   where Incogni, the sponsor of today's episode, 
comes in. Incogni helps you to regain control   by removing your personal information from the 
databases that data brokers rely on. Actually,   I use it myself and you will be surprised how 
simple it is. You sign up authorize Incogni to act   on your behalf and they send data protection low 
compliant requests to these companies forcing them   to remove your information from their databases. 
And my favorite part, you can track every step   of the progress in real time right from your 
dashboard. As someone who values privacy a lot,   I highly recommend you to try out Incogni. It's 
a simple way to reduce unwanted spam and keep   your data off the grid. Use my code INTECH at 
the link below to get 60% off an annual plan. Thank you Incogni for sponsoring this episode. 
What surprises me about this story is how fast   it's moving. They started in 2023. In just 
five years, Japan wants to go from having no   advanced chip technology to building some 
of the most advanced chips on the planet.   Considering that they are almost starting from 
scratch, this 5-year timeline is very bold. So,   I'm very curious to see what's going to 
happen. And considering the name Rapidus,   they definitely admit that timing here matters. 
Just imagine already now Rapidus have a pilot line   up and running in Hokkaido. Inside the fab they've 
got hundreds of cutting-edge equipment, including   the famous EUV lithography machines from ASML, 
those that used to print tiny circuit patterns on   the wafer. Just one of these machines alone cost 
$300 million. It's a holy grail of advanced chip   manufacturing. And that's not all. Just a few days 
ago, they revealed their first chip. It's packed   with billions of transistors, and it works. Now, 
they are fine-tuning the process to make sure they   can reliably produce this technology at scale. And 
the plan is that the fab will be up and running by   2027. What's wild, Japan is actually building its 
own Silicon Valley, not in Tokyo, but in Hokkaido   and Kyoto, places better known for hot springs, 
temples, and snow. But here is a twist. It turns   out Kyoto is also home to some semiconductor 
companies like Screen Holdings and Rohm   Semiconductor. Now let's talk about what it really 
takes to build an advanced semiconductor fab. And   here it takes way more than just one company. We 
need entire ecosystem working together. Moreover,   when we are aiming for something so advanced 
as 2 nm technology, it gets insanely expensive.   Japan is going all-in, making a $67 billion bet 
to once again become a global chip powerhouse. It   takes about $40 billion just to build one 
fab. That's how much TSMC is spending in   Arizona. And Samsung's fab in taxes is in the 
same range. A rule of thumb, you need to buy   1,000 pieces of specialized equipment. You need 
machines for etching, deposition, lithography,   cleaning wafers, the full lineup. And that's 
not all. Then you need to build clean rooms,   ultra clean spaces with powerful filtering systems 
that remove even the smallest particles of dust   from the air. And on top of that, you need a 
massive amounts of water and electricity to run   this operation. and super orchestrated system 
behind to make sure it runs 24/7 and that's   not easy. Right now there are only few places in 
the world which can do that for the most advanced   technologies. These are TSMC and Samsung. Funny 
enough, building the fab is just half a battle.   You also need the special materials and 
engineering talent who can figure out the   manufacturing recipe which is actually the main 
secret sauce in the semiconductor manufacturing.   Essentially you need the entire ecosystem and 
supply chain working. That's why companies like   Huawei are heavily investing in building this up. 
I actually covered it in another very interesting   episode. Make sure to subscribe to the channel 
now to catch up later on. Now, Japan does have   many strengths. One thing Japan does really well 
is hard work and attention to details. When I   was working at a large semiconductor company, I 
was lucky to have a chance to work with Japanese   teams. By the way, here is my LinkedIn. And their 
culture is so interesting and so different. First   of all, there is this concept of Kaizen, which 
is a concept of continuous improvement. So you   would never see them rushing and cutting the 
corners. They are focused on the quality. And   in the chipmaking this kind of mindset really 
matters. then there is a strong respect for   hierarchy and seniority. So it's very important to 
understand the flow of decision making and this is   probably the biggest difference when we compare 
it to more flat fastmoving culture in the US.   That's why I'm so curious to see if Rapidus can 
actually pull this huge thing off in just 5 years.   Let me know what you think in the comments. Now, 
Japan is really strong in semiconductor materials   and precision equipment, but they've fallen 
behind in areas like lithography machines,   chip packaging, and AI memory. Here, the 
Japanese government stepped in with a new plan.   They are bringing in global players like TSMC to 
build in Japan. In my opinion, this is one of the   key factors for success because when TSMC comes 
in, supply will follow and supplying chain here is   a critical piece of the puzzle that helps Japan 
build a strong local supply chain. Even ASML,   the company that makes those super advanced EUV 
machines, is now moving some of its research to   Hokkaido. That says a lot. What's interesting, 
Japan isn't just focused on manufacturing. They're   innovating in design, architecture, and novel 
materials. First of all, they are working on a   new chip technology made from synthetic diamonds. 
And these chips are super tough. They can work at   very high temperatures at high radiation and just 
harsh environments. And this diamonds are actually   set to replace silicon as a base material of the 
chip. In fact, it's a very attractive material   because it can handle way more heat than silicon. 
It lets electricity move faster and it's super   tough in harsh environments. Now, that one is 
very important. As we go to space, go to Mars,   build self-driving cars, we need chips that 
are not just fast, but can survive anything.   And it seems Japan might have the material, just 
the right one to power that future. When it comes   to chip innovations, Japanese tech giant Fujitsu, 
known for building supercomputers and advanced   electronics, is now working on a new super 
powerful CPU called Monaca. What's interesting,   it's built using 2 nm technology. 
This chip is built for supercomputers,   the kind used for massive scientific and research 
calculations. This chip combines two tiny 2 nm parts connected to 5 nm memory. You may 
wonder why to mix these two. First of all,   2 nm technology is really expensive. So they 
only use it where it matters in computer logic.   And if you ever heard of this concept of chiplets, 
that's the idea that you can mix and match blocks   in different technology nodes to bring the cost 
down. What's interesting, they are also working   on the software stack and there are special kind 
of memory they design as well as the design tools.   So entire stack so that the whole chip works 
smoothly together and they are not alone. More   and more companies in Japan are jumping in and 
innovating. Some even say that preferred networks   might be Japan's answer to NVIDIA, but I will keep 
it for another episode. Remember to subscribe.   I'm very happy to see what's happening in Japan 
and that's why this episode is so special. And   if you share my excitement, please share this 
video with your friends and on social media.   The real question is, can Japan make a comeback 
or is it too late? And can they ever compete with   TSMC? Japan has something going for it. First of 
all, deep engineering talent, government support,   and the culture of quality and excellence. And 
if they move fast and stay focused, they may not   beat TSMC. But I think they don't have to. They 
just need to build enough chips to power their   industries and reduce overall worlds over reliance 
on a single supplier. Because to be honest, we   cannot risk it. No chips means no cars, no robots, 
no AI. That's why the Rapidus project is such a   big deal. It's not just about one company. It's 
about the future of Japan's entire tech industry.   And now I'm super excited to announce finally the 
launch of my new podcast where we will explore   what is next in technology from next generation 
computing technologies to AI to robotics to any   other form of physical AI and how all of this 
comes together and what it means for the future   and for you. there. I will be also sharing 
conversations with technology leaders and   researchers, something which is typically stays 
behind the scenes of these videos, but are just   too good to keep it to myself. The first episode 
just dropped, so make sure to check it out right   now. The links to Spotify and Apple are in the 
description box, or you can scan the QR code   here. And looking forward to hear what you think. 
Love you guys. See you in the next episode. Ciao

---

## 17. World‘s First 0.2nm Technology
**Channel:** Anastasi In Tech | **Views:** 366K | **Date:** 6 months ago | **Duration:** 23:53 | **ID:** DXgZ3X8z7eE
**Link:** https://youtube.com/watch?v=DXgZ3X8z7eE

### Transcript:
just like rock stars on the tour Moore's law 
has been declared dead more than 20 times and   today I'm here at Stanford in the heart 
of Silicon Valley where it's all started   and Moore's law is very much alive as you 
will see today we already know how to get   computer chips to 2 nm and even beyond that in 
this episode we will take a bold look into the   next 15 years in technology how it will evolve 
step by step what it means for key players like   Google and NVIDIA and what it means for you for 
the last 50 years everything you use your phone   your laptop even AI like Chat GPT has been 
powered by one tiny invention the transistor   these nanoscopic switches turn on and off 
billions of times per second and this is the   main engine behind our entire digital world have 
you ever noticed that every tech giant like NVIDIA   Google or Apple is building their custom computer 
chips and why because the real race is happening   inside the chip and if you're not watching this 
space closely you are missing the bigger picture  just look at NVIDIA their current Blackwell 
GPU features 28 billion transistors but with   their upcoming Rubin platform we are talking about 
1.3 quadrillion transistors packed into a single   server and this is happening right now here 
is what most people miss while AI capabilities   double roughly every 7 months which gives us 
about 3.4 four times a year the performance   of the underlying hardware is only improving 
by 1.4 times a year and that's the problem  just think about this gap now to understand 
why we have to look deeper because in fact   the advancements of computer chips coming from 
many different levels starting from device level   and then architecture level where we can have new 
designs and implement new algorithms and then the   system level including software stack and cooling 
so it all comes together here but the foundation   is still the transistor what's very interesting 
most of us hear about TSMC the giant that   manufactures computer chips at scale but behind 
the scenes there is another key innovator IMEC,   IMEC invents new technologies including 
transistor technologies and then TSMC is   building them for the world now IMEC just 
released their new internal roadmap that   lays out close to the next two decades 
in technology and I got a chance to talk   directly to the team behind these innovations and 
I will unpack all of this for you today and unlike   other tech channels that just report on news I'm 
actually coming from the chip design background I   spent a decade building these technologies so 
this channel is the best place to learn about   it make sure to subscribe not to miss what is next 
in technology well this is a very exciting roadmap   it shows step by step how we are going to scale 
from today's 2 nm down to an astonishing 0.2 nm   by 2037 and even beyond that by 2039 what's 
fascinating it's not just about transistors it   also touches upon all the parts of the ecosystem 
including tools and materials we will have to   adapt along the way right now as of 2025 we are 
at 2 nm generation and right in the middle of   transition from FinFET to the next big thing if we 
take any modern chip like AMD GPU or Apple Silicon they're still built using FinFET technology now
if you look back in time to all the way back   when I was at university these were easy days 
because back then we were using Planar transistors   simple straightforward 2D structures on silicon a 
transistor is basically a tiny switch and the gate   controls it so when we apply a certain voltage 
to the gate it turns on and the current flows   from the source to the drain and then from year to 
year we kept shrinking transistors especially the   channel the part where the current flows and soon 
we start running into big problems at some point   the good old Planar transistor could not keep up 
anymore and we had to flip the entire structure   instead of keeping the structure flat engineers 
raised the channel up as a vertical fin imagine it   like a shark fin sticking out of water it actually 
resembles fish fin that's why it's called FinFET   in fact when I first joined the industry we were 
right in the middle of this transition from Planar   devices to FinFET and this was a huge shift it was 
a huge shift because in transistors what really   counts is how well you can control the current 
in the channel how cleanly you can switch it on   and off and these new devices gave us much better 
control and also let us fit more transistors in   the same space and back then everyone was a huge 
fan of FinFET everyone was talking about it but   you know every device every architecture serves 
us for several generations until it hits a limit   you know just as fastest runner at some point 
will hit physical limit and this is a time when   we are actually right now and this is a time for 
entirely new technology and this is going to be   one of the biggest shifts in the history it turns 
out even transistors need to relax so we laid the   fin down and stacked several of them like floors 
one on top of the other this new design is called   gate-all-around or nanosheet different fabs have 
different names but the idea is the same what's   exciting this technology is arriving very soon 
TSMC is bringing it first to AMD and Apple chips   by the end of this year the genius idea behind 
this device that by laying the fin on its side we   gain now access to all four sides of the channel 
you know in FinFETs the gate wraps around three   sides now with this new device the gate is wrapped 
around all four and that extra contact allows us   to better control it even at smaller scales well 
this new device comes with a whole set of new   manufacturing challenges the biggest challenge 
is that you cannot see the underside of the   nanosheets directly and for these steps Applied 
Materials and ASM own the secret sauce I covered   it in the previous episodes on this channel I 
will drop some links in the description box below   good news this challenge is solved and this 
allowed us to shrink beyond 3 nm just to give   you a sense of what is enabling for example TSMC 
in N3 process node was able to pack 200 million   transistors per square mm and now with N2 with 
2 nm they able to pack 300 million transistors   per square mm that's mind-blowing however the 
most exciting part about this new technology is   not just the new transistor shape as you can see 
on the roadmap it introduces something that has   never been done before backside power delivery 
just imagine until now all the wires for power   and signaling have been crammed on top of the 
chip you can imagine it like trying to bring all   the plumping and electricity through the ceiling 
as you can imagine it gets messy and it takes up   a lot of space and backside power delivery just 
flips that imagine taking all the power signaling   from the top and bringing it to the backside 
to the floor so you can free up a lot of space   on the top for signaling for interconnecting the 
logic gates that are actually doing the computing   this is a genius idea but very hard to do in 
practice because it requires a total redesign   of how chips are powered and right now companies 
like TSMC and Intel are racing to bring this new   architecture and this new power delivery to 
the market and from the next year on this new   technology is going to power everything from your 
phone to the most advanced AI on Earth now we know   just like with any other technology at some point 
it won't scale anymore and according to the IMEC   roadmap it will happen at around 1 nm or here we 
are typically switching to Ångström dimensions   which means we are likely to hit the wall with 
this one at roughly 10 Ångströms you know old ways   won't bring you to new places so here we will 
likely have to reinvent the device once again   you know just like in your life you can't do the 
same thing over and over again and expect a better   outcome you have to constantly reinvent yourself 
think what is next just like me at Stanford   Business School right now I'm overwhelmed but in 
the best way possible according to the roadmap   they're projecting that the next big thing is 
going to be CFET architecture try to imagine what   would happen if we take the gate-all-around device 
we've just discussed and then pile them one on top   of the other now finally we're starting to grow 
vertically just like the skyscrapers behind the   camera in San Francisco and it's intuitive right 
if we want to reduce the footprint and this idea   have been around for a while but it takes a lot 
of time to figure out the recipe and now it's   not just about figuring out the backside power 
delivery it's also now about bringing in the   signal for this bottom device now if we can manage 
to do that and I'm pretty sure we will this will   unlock the next level which will allow us to scale 
to single Ångström dimensions just think about it   this is mind blowing before we dive into the most 
transformative shift coming to technology AI is   already changing how we work today in fact my team 
and I are already using AI in our entire workflow   and it's making a huge difference in saving time 
and staying in budget in 2025 over half of all   companies are already using AI in some form and 
research shows that 40% of people worry AI will   replace them at their job but the reality is that 
people that use AI will be the ones replacing   those who don't and this is happening already 
now Microsoft Google Amazon are currently hiring   people that understand AI those who know how to 
build with AI this isn't just about getting a job   if you're building a startup like me or create 
anything or a working professional AI isn't a   threat to you it's a leverage used right it can 
save you hours of time and thousands of dollars   in cost that's why you need to learn how to use 
it now this is why I highly recommend you joining   this 2-day AI training by Outskill which takes 
you from beginner to advanced AI professional in   just 16 hours it's normally valued at $895 but I 
partnered with Outskill to provide 1,000 free sits   for you this 2-day program offers 16 hours of live 
AI training spread across 2 days happening on this   Saturday and Sunday of the coming week between 
10:00 a.m. and 7:00 p.m. in this training you will   learn more than 20 AI tools prompt engineering 
how to develop AI agents and more and exclusively   for my audience you can join it for free just 
register now with the link below or scan the QR   code here thank you Outskill for sponsoring this 
episode now we approaching the most exciting part   of this video now we will discuss the breakthrough 
materials and tools that will define the next two   decades in technology let's start with lithography 
or how we call it in the industry litho so imagine   as transistors are becoming smaller and smaller 
the little metal wires the interconnects also   have to shrink accordingly and here lithography 
tools play the crucial role as you can see from   the roadmap we've gone from 40 nm metal pitch 
now down to 20 nm and we will scale even beyond   that in CFET nodes and that's quite aggressive 
scaling to achieve that the industry developed   a new generation of lithography tool so-called 
High NA EUV tool with a numerical aperture of   0.55 and this gives us higher resolution basically 
it helps us print tiniest features on wafers more   precisely and the good news ASML has already built 
this machine and it works so from manufacturing   point of view lithography is no longer the risk 
on this roadmap you actually very well see how   the progress in lithography tools allows us to 
scale the metal pitch and unlock new levels in   fact it mostly helps us to scale the metal pitch 
and not so much in the logic side and many people   miss that piece of the puzzle and the numbers 
here 0.33 0.55 0.75 refer to numerical aperture   the bigger number the better because it means 
better resolution and printing even smaller   features on the wafer according to this roadmap 
the older generation of lithography tools enables   us scaling down to 22 nm metal pitch and below 
that we're going to switch to the new generation   0.55 NA EUV tool and at some point this one will 
be no longer enough and we will have to switch   to the next generation of lithography tools 
so-called Hyper Extreme EUV which literally   stands for hyper extreme extreme ultraviolet 
lithography and this will unlock the next big   milestone in semiconductors 2DFET basically 
it's the same vertical structure but with the   2D materials in the channel so now in the channel 
we will have material just one atom thick what's   interesting right now it looks like 2D materials 
is the end game in semiconductors and I talk a   lot about new materials on this channel because 
in the last decades what we've seen the most of   advances were coming from new architectures new 
lithography tools new processes but using the   same silicon technology but in the next decades 
the real breakthroughs will be coming from new   materials those beyond silicon at the moment
it seems like two most promising materials   are molybdenum disulfide (MoS2) and tungsten 
disulfide (WS2) the trick is that building   them at scale is really hard because these are 
2D materials and they are by definition just   one atom thick and that makes them very tricky to 
work with in manufacturing remember a few moments   ago we discussed that we need to wrap the gate 
around the channel which was very nicely done   in gate-all-around technology but when our channel 
becomes one atom thick like a sheet of paper there   is not much material to wrap around and on top of 
this these thin layers are very fragile so even   a tiny misalignment in manufacturing can cause 
them to break and this is one big open challenge   in manufacturing in fact it's not one specific 
step that's causing the problem but it's how all   these steps fit together here we have insanely 
small aspect ratios and trying to contact both   transistors from top and the bottom separately 
and then connecting power from the backside and   you have to do all of this with angstrom level 
precision that's less than a nm imagine building   a skyscraper out of Lego blocks but each of 
your Lego block is the size of a grain of a   dust and then you have to align them perfectly 
in a Ångström precision scale without even   touching them that's how precise advanced chip 
manufacturing has become the transition from   FinFET to gate-all-around was a huge leap but the 
transition from gate-all-around to CFET going to   be even a bigger one especially when it comes 
to manufacturing complexity another promising   material to keep an eye on are CNTs and these 
are being actively explored by IMEC and TSMC   these CNTs are essentially rolled up sheets of 
graphene and if you watch this channel regularly you're already an expert on graphene if not make 
sure to subscribe right now to stay in the loop   graphene is certainly less mature compared to 
all other technologies we've discussed today   but it's very attractive for the post silicon 
era because mostly because of its high speed and   current at low voltages which in practice means 
better power efficiency ideally with graphene we   could go below today's 7 volt down to 0.5 volt or 
even lower power supply and this would drastically   cut power consumption because power scales is a 
square of the voltage but here is a catch while   CNTs turn on very well it's really hard to turn 
them off meaning they leak power when they're   idle and that's a big problem and we will 
have to find a way around it now the most   likely scenario instead of replacing all 
our devices in the chip with CNTs first we   will replace a particular part of the logic on 
the chip and this is the key idea behind this   new concept of CMOS 2.0 a new way of building 
chips in which we divide a chip into different   layers kind of a sandwich where each layer has a 
specific job here different technologies will be   used for different layers or functions instead of 
cramming everything into one flat chip like we've   done for decades we can use the best material and 
technology for each layer for example one for AI   and another for graphics now when we talk about 
scaling chips the most of attention goes towards   compute while in fact memory is now becoming the 
biggest bottleneck in today's systems we mostly   use SRAM for cache DRAM for working memory and 
NAND for storage the tricky part is SRAM because   it sits on the computing die and it's also 
made out of transistors but it doesn't scale   that well with new architectures for example 
with gate-all-around as we move towards 3 nm   and 2 nm all the logic scales except the memory 
and that's frustrating and actually what we see   happening with every generation memory on the 
memory eats up more and more area of the chip   now I've got some great news because actually the 
only architecture that really helps here is CFET   where you stack transistors vertically that one 
actually fits SRAM layout very well and finally   gives us a decent jump in density DRAM on the 
other hand does keep scaling but slowly and now   we are starting to go 3D stacking layers of DRAM 
on top of each other but here is the real issue   as compute becoming better with clever designs 
advanced algorithms and software memory is not   optimized this way and so we are hitting the 
memory wall and if compute performance is keep   improving memory remains slow power hungry part 
especially for AI compute applications and that's   the next frontier we have to address so what all 
of this means for NVIDIA and what it means for you   as chip manufacturing becoming more complex and 
more advanced it will also become more expensive   while the cost of transistor may stay flat thanks 
to better density the total cost of making a   wafer skyrockets due to this complexity it's also 
important that TSMC remains not the only player in   this game and Samsung and Intel are also heavily 
investing in the next gen manufacturing because we   need healthy competition here otherwise progress 
slows down and these companies have to invest   heavily into R&D just to stay competitive that 
means cheap prices will likely go up and so will   the price of devices and the AI services built on 
top of them but if you're an investor these are   actually great news because more complexity means 
more opportunity and right now semiconductors is   some of the high growth spaces out there and my 
startup is actually in this space now if you're   looking at this from investment angle here are a 
few players to keep an eye on first of all TSMC   the manufacturing leader ASML the only company 
that making EUV lithography machines and Apply   Materials providing tools used in pretty much 
every step in the chip manufacturing process   and I don't mention IMEC here because they are 
nonprofit research institution so if you enjoyed   this episode make sure to share it on LinkedIn 
Instagram or X and make sure to tag me so I can   see your posts thank you so much for watching 
love you guys see you in the next one ciao

---

## 18. We're Moving Beyond Electronics
**Channel:** Anastasi In Tech | **Views:** 497K | **Date:** 7 months ago | **Duration:** 19:38 | **ID:** x7w-RwaXjc8
**Link:** https://youtube.com/watch?v=x7w-RwaXjc8

### Transcript:
recently I've been diving into the very 
foundation of modern computing and I've   stumbled into something that feels overlooked by 
far one of the most important ideas and yet almost   no one is talking about it for the last 50 years 
everything you touch your phone your laptop the   entire internet has been powered by transistors 
tiny devices that rely on one fundamental property   of electrons their charge but what if I told 
you that's only scratching the surface and   there is another equally fundamental property 
its spin that most people have never even heard   of if electronics has defined the last 50 years 
today we will explore a new technology that could   spark entirely new chapter advancing everything 
from classical to probabilistic to even quantum   computing this makes my head spin just thinking 
about it despite the name spin doesn't mean that   electron is spinning around it's its quantum 
property kind of a building compass that can   point north or south up or down you can imagine it 
like a tiny magnet that can point north or south   and it turns out the spin state can be used 
to store information just like zeros and ones   in your computer but with an interesting twist 
let me put my spin on that if we take this phone   with A18 chip inside or ChatGPT which is running 
on GPUs pretty much in every modern application   we use the electrons charge to process and store 
data but it takes quite some time and energy to   move this charge and also generates a lot of heat 
the bottom line is what if instead of charge we   could use its spin this would be brilliant because 
unlike charge spin stays in the same place so it   takes way less energy to move it and this is the 
core idea behind spintronics what's interesting   in traditional electronics moving a charge means 
physically pushing electrons through a circuit   and as you can imagine this creates resistance 
friction and heat which is why your laptops get   hot but in spintronics we're using the spin of one 
electron to notch another one into a new direction   and because it's a quantum effect it strongly 
correlates with quantum mechanics and this is   what's making it so powerful in fact it's not an 
entirely new technology it's already been used in   hard drives which allowed us to pack more storage 
in a given area however the recent advancements   in the field shows that we can use this same 
technology for the next gen computing now if we   zoom out and look at the bigger picture demand for 
AI computing is exploding and everyone is looking   for new paradigms to make it more efficiently I've 
already covered the most promising technologies   on this channel so make sure you are subscribed 
so you don't miss what's next in technology and   make sure to watch till the end to enter a very 
exciting giveaway if we look at the bigger picture   one of the biggest bottlenecks in AI computing 
today is that memory and processing are physically   separate this means every time your computer does 
something it has to constantly move data back and   forth between the processor and memory and this 
takes a lot of time it's slow and it burns energy   now if we use this new computing approach if we 
use spin it turns out we can build chips where   memory and computing are combined and that unlocks 
an entirely new way of computing just think about   it If I ask you what is 7 * 8 the answer just pops 
up in your head like this 56 and that's happening   so fast because the data is stored at the same 
place where it's processed in neurons and synapses   in your brain and there is no delay from shuffling 
data back and forth like is happening in a   computer and that's why our brain is so incredible 
in contrast a computer will store this data in   memory and then CPU has to fetch this data process 
it and then sends the result back and this back   and forth take a lot of time and energy especially 
in AI workloads where we deal with massive amounts   of data like trillions of parameters and that's 
why we get inspired by our brain where each neuron   is a processor and a memory at the same time and 
it turns out we could build this kind of system if   we add spin electron spin into the mix now let 
me break down how it actually works and why I   find this approach so fascinating actually there 
are many flavors of this technology but in the   most recent work the most promising technology is 
based on so-called MTJs Magnetic Tunnel Junctions   and those are based on magnetic states and it 
turns out these devices MTJs are already widely   adopted by companies around the world at the 
mass production scale and this is great news   the fundamental device itself consists of two 
layers of a special material separated by a   ultra thin insulating barrier and this 
barrier is typically 1 nm thin or even thinner   an easy way to think about it you imagine a 
flat with two rooms and one door in between   so imagine in each of the rooms there is a spin 
and if spins both of them in two rooms point in   the same direction it means that the door is open 
and the current can flow through it this is our 0   and in case the spins are pointing to opposite 
directions the door is locked and this is our   1 and the cool part is even if you cut the power 
spin stays in the place this device doesn't forget   anything everyone has this kind of friend you know 
who still brings back what you said back in 2010   now why do I say that manipulating a spin is such 
a big deal because now in transistor technology   we are scaling beyond 2 nm and actually entering 
ångström era and here things start to get really   weird because we bump into very strong effects of 
quantum mechanics and one of the wildest effects   here is Quantum Tunneling it's when an electron 
passes through a barrier it shouldn't just imagine   being able to walk through a wall and this is a 
big problem because it causes devices to leak and   makes them very hard to control and this is one 
of the biggest limits as to how far we can keep   scaling the transistor technology but here is a 
twist while shrinking breaks classical transistors   it actually helps spintronic devices because these 
devices are built on this very effect so instead   of fighting Quantum Tunneling they are making use 
of it in this new approach electrons don't need to   move physically they just tunnel through this tiny 
insulating barrier we discussed and whether they   get through or not depends on the spin this makes 
these devices perfect for sub nanoscale operation   because the thinner the barrier the further we 
scale it the better the device performs so it's   not just efficient it's inherently scalable 
let me know your thoughts in the comments and   that's where it gets very interesting because 
when we mix classical computing with quantum   mechanics it turns out that we can write data 
in this devices but at the same time we can do   also computing with them and it turns out if we 
take this device and connect many of them in a   row we can implement with it so-called in-memory 
computing the approach we've just discussed   next we will discuss how it actually works 
and some powerful and unexpected applications   of this technology but first let's discuss the 
chips that powering the progress already right   now if you've been following the updates 
from AMD's recent Advancing AI event which   was beautiful the momentum is hard to ignore 
and it's all about technology whether you're   building a startup like me or leading a global 
enterprise in 2025 the technology your business   runs on matters more than ever and that's where 
AMD comes in laptops powered by AMD Ryzen  Pro processors deliver everything a modern business 
needs efficiency security and AI readiness   at the core of the AMD Ryzen Pro processor is the 
cutting edge architecture that integrates the CPU   GPU and a dedicated NPU Neural Processing Unit 
on a single chip enabling AI powered application   performance up to 1.8 times faster directly on 
your PC without relying on external hardware   it delivers up to 8 times faster speeds in 
AI workloads like stable diffusion and up to   three times higher gains in creative applications 
like DaVinci Resolve compared to Intel's i9 even   in machine learning benchmarks like GeekBench ML 
AMD leads with up to 8 times faster AI processing   and that's kind of speeds that translates 
directly into the real world productivity   these laptops offer extended battery life for 
all day use 6 layers of built-in hardware level   security and full readiness for Windows 11 as you 
may know support for Windows 10 is ending already   this October and sticking with old hardware can 
expose your business to security risks so now is   the perfect time to boost your productivity 
and security with new AMD Ryzen Pro laptops   Right now AMD offering businesses an opportunity 
to see the impact firsthand with their free Loaner   Program just click the link below to get a Ryzen 
Pro laptop put it to test and experience all the   benefits it can bring to a business honestly I'm 
super excited to work with AMD on this campaign   because it's just the best technology the best 
product and the most amazing people behind the   most amazing team so I feel very blessed so make 
sure to check out their offer through the link   below or scan the QR code here and thank you 
AMD for sponsoring this video spintronics is   fascinating and it opens up a whole new frontier 
for computing what makes it so exciting is its   deep overlap with quantum mechanics so now let's 
zoom in and see how the computing actually works   let's say we want to compute two matrices multiply 
two matrices using this technology to do this we   will use a small grid 2 * 2 of these devices these 
devices store weights while inputs comes in the   rows imagine each device acts as a tiny 
switch so what happens when we apply the   input signals the input 1 to the first device 
it lets the current flow that's our multiply   and when we apply the input 0 to the second device 
it doesn't let currents through and that's a 0 at   the end we add up currents at the output and this 
is actually the multiply accumulate operation and   what do we have we have the multiply accumulate 
operation done in spintronics so in analog way   using spins and this is the core operation behind 
all modern AI workloads and the beauty of this   approach that the processing is done in memory 
without any shuffling the data around so it's   very efficient and cool and we can do that we can 
flip this pin state in just picoseconds very fast   very efficient way faster than moving around the 
charge or dealing with resistive memory this what   makes this approach so attractive consider that 
till now one of the most obvious applications   of spintronics was memory just memory because 
instead of using electric charge we can store   bits using spin up for 1 down for 0 that's 
how magnetoresistive memory works it's fast   durable and keeps data even without power it's 
already used in hard drives and being tested in   aircrafts phones and cars but now based on the 
progress from this paper and a bunch of others   I read last week we start to use this technology 
for computing and it doesn't stop there because   researchers are exploring other more radical ways 
to use it for computing one of the most exciting   of this is probabilistic computing this is the 
approach where we instead of fighting noise right   like in case of quantum computers they are very 
sensitive to noise so instead of fighting noise   we harness noise from the environment and use it 
to perform computations fascinating approach it   turns out it's a great match for problems like 
root optimization think about finding the most   optimal route for the Uber or powering generative 
AI models like diffusion based models where you   start by first adding noise to the image 
and then work backwards to create an image   I actually broke down this technology in a full 
episode on the channel so hit the subscribe button   right now to catch up later on and then things 
started to spin out of control it turns out   spintronic advances chaos computing yeah that's 
a real thing and since spin is a quantum property   there is a strong connection to quantum computing 
and I'm especially excited about the spin-qubit   approach that Intel is working on they're actually 
building a quantum computer using quantum dot   technology basically encoding information inside 
the spin of a single electron and the best part   it's built on silicon technology that's why I 
see so much potential in this because this is the   material we already know very well how to build at 
scale this one thing makes it way more promising   from commercial perspective than any other exotic 
quantum hardware so yeah spintronics is not just   a new technology as a whole new way of thinking 
about computing now let me know have you ever   heard of it and are you as excited as I am let 
me know in the comments of course there are still   a lot of challenges related to this technology 
the main ones are related to manufacturing and   reliability as we've discussed these devices 
built from materials just a few atoms thick   and if you have a chip with billions of devices 
even tiny variations in material at this scale   can make switching unpredictable you know this 
tunnel barrier through which electrons tunnel   through needs to be 1 nm thick or even thinner 
for fast switching but that makes it fragile   and limits how many times we can actually use it 
manufacturing is another great challenge because   spintronics materials don't always play well with 
semiconductor manufacturing process and this might   be very tricky to integrate it with the current 
technology and to scale it but when it comes to   classical commercially ready magnetoresistive 
memory we've just touched upon we are already   seeing real progress for example Everspin 
Technologies is producing such devices at scale   even at 28 nm and below in partnership with Global 
Foundries so yes it's not just theoretical anymore   it's manufacturable at scale and it's only getting 
smaller and smaller and I almost forgot about this   one another challenge is of course controlling 
the spin especially at scale right when we're   talking about billions of devices so here there 
have been also exciting progress researchers from   Japan found a way surprising way to do it with 
lasers they found a way to control spin patterns   into a thin semiconductor layers using beams of 
light imagine it like writing magnetic textures   with photons and this is a very promising step 
towards a spin-based transistor though so far it's   working only at very low temperatures so the next 
step would be to make it work at room temperature   now let's talk investment angle not financial 
advice as always just sharing my take we see that   spintronic research is experiencing rapid growth 
and while it's still early in my opinion the first   real impact won't be in logic devices or next 
gen computing first of all the real impact will   show up in 3 main areas memory quantum computing 
and sensors on the public markets a few companies   are already making moves just some companies to 
keep an eye on first of all worth keeping an eye   on Everspin Technologies Everspin Technologies is 
a pure play memory company and their technology   is already used in some IoT chips then NVE 
Corporation focusing on spintronic sensors and   memory and finally Micron and IBM are also doing 
deep research into quantum and spin-based logic   then there is a bunch of startups worth keeping an 
eye on like Spin Memory and Avalanche Technology   it's still very early stage yes but if you're 
tracking the next wave of edge AI hardware and   quantum technologies this is a space to watch and 
of course I'm looking forward to share with you   more on that soon and now I want to announce 
a giveaway where you can win some really cool   presents to enter you need to share this video 
and tag me on any social media you use the more   the better like LinkedIn X Instagram whatever you 
use and then you need to drop it in the Google   Form which is linked in the description below 
and then you have a chance to win this stunning   piece of art 12 inch silicon wafer I will send 
it to you and one of two books by Reid Hoffman   really fantastic read I already gifted it to 
some of my friends yes it's that good it's a   very good one if you're interested in tech and 
investing in tech well now I'm off to Stanford   for a while so make sure to subscribe because in 
next episode I will be recording directly from   Stanford thank you so much for your support Love 
you guys and we'll see you in the next one ciao

---

## 19. Here’s What Comes After Silicon
**Channel:** Anastasi In Tech | **Views:** 402K | **Date:** 8 months ago | **Duration:** 19:18 | **ID:** yJSrX1uOjxs
**Link:** https://youtube.com/watch?v=yJSrX1uOjxs

### Transcript:
what if the future of electronics has nothing to 
do with silicon a startup just built an optical   chip using graphene a material just one atom 
thick and they're not stopping there they're   building a factory to mass-produce it i've spent 
the last decade designing computer chips and I   find this progress incredibly exciting how does 
combining light with graphene actually work and   why to use light at all today's chips move data 
using electrons traveling through tiny metal wires   it's worked for decades it's how we got faster 
phones and most powerful AI chips but we are now   running into a big problem as we cram more and 
more transistors onto chips the wires made of   copper are getting so thin that resistance shoots 
up heat builds up and everything slows down you   can think of it like driving a Porsche 911 GT3 
RS which stands for really serious you know the   one that Lisa Su drives imagine driving this car 
on a muddy mountain trail sure it can move but it   isn't exactly built for that this is copper today 
well it's not just transistors hitting physical   limits the interconnects the wiring between them 
are becoming one of the biggest bottlenecks in   computing what is the solution actually physics 
gives us a clue what instead of moving electrons   we would move photons light after all doesn't lose 
energy the same way copper does it's faster cooler   and it's perfect for zipping data around chips 
and data centers and when it comes to controlling   light at the nanoscale level one name constantly 
keep popping up it's graphene now why graphene   it turns out graphene is really good at this one 
thing controlling light especially on a tiny scale   i've been diving into the graphene research over 
the last few years and it turned out to be one   of the most fascinating materials out there first 
of all it's just one atom thick literally it's a   single layer of carbon atoms arranged in a perfect 
honeycomb pattern imagine like an endless sheet of   hexagons where each corner is a carbon atom this 
structure isn't just beautiful it's powerful the   carbon atoms are bonded so tightly that this 
material ends up being stronger than steel   but at the same time light and flexible just like 
Trump and Elon bromance used to be but not anymore   however the most fascinating part about it it's 
a crystal structure and because of it electrons   or even photons can move through graffine 
extremely fast with almost no resistance electrons   move through graphene act as if they have no 
mass it's electro mobility is off the charts   just to put some numbers on it for graphene it's 
200,000 square cm per second while for silicon   it's 500 the bottom line is it's not just a tiny 
improvement but a major difference you could see   it like the difference between dial-up internet 
and fiber optics this means switching to graphene   for data interconnects we are talking about data 
moving 100 up to thousand times faster than what's   possible today thanks to ultra thin wires and 
high signaling speeds now let's shed some light   on how it actually works whenever we want to use 
light to transmit data or compute data first of   all we need to do encoding we need to encode 
our digital signal into light and for that we   use one fundamental device optical modulator and 
one of the most common types is the Mach-Zehnder   Interferometer it looks like a tiny submarine 
but what it actually does it encodes digital   values zeros and ones into a beam of light first 
light enters at one end and it's split into two   separate paths kind of like a road for photons 
that splits into two lanes normally the light from   both branches recombines at the end interfering 
constructively which means the output light equals   the input light but in case we apply a digital 
signal to one of the paths something changes that   signal shifts the face of the light in this branch 
altering the way it interferes at the output   and that's how we can modulate the light we are 
literally encoding digital bits into the intensity   of light from there we can use this light to 
transmit data over fiber or even use it to do   computations on a photonic chip and this process 
is actually at the core of silicon photonics which   is typically done with silicon but silicon has its 
limits especially when it comes to faster speeds   lower power and smaller footprint and that's where 
graphene comes in the biggest difference is that   silicon works best in the narrow range in the 
infrared range while graphene interacts well with   a wide range of light from visible to infrared and 
even to the THz range what's even more interesting   we can actually control how much light graphene 
absorbs just by applying an electrical pulse   and this makes it a perfect candidate for 
the next generation of optical modulators   now if we look back at our device and we make one 
arm out of graffine and then we apply the voltage   with that we can modulate the optical phase in 
that arm if we compare it to the classical device   it's similar working principle in structure 
right but it's difference in physics in how   this shift happens this means with graphene we 
can build devices that switch faster and can be   much more compact and that's make them much easier 
to scale and that might be the missing piece last   week I was one of the speakers at a conference 
where Black Semiconductor presented their work   well at the moment they don't share much but 
actually they're doing what we've just discussed   they are building graphene based optical fabric 
optical chip for data centers to replace copper   and not just that they're also building a graphene 
manufacturing facility a full scale fab right now   this is a huge step forward and we will talk more 
about it in details towards the end of the video   next we're going to dive into using graphene for 
photonic computing and also I will share with you   an investor angle it's a new segment that I 
want to make a regular thing on the channel   let me know what you think and while we are on 
it I got to know that 70% of you watching this   video are not subscribed to the channel if you 
want me to shed more light on the technologies   of the future consider subscribing this helps a 
lot for the channel to grow and it helps you to   stay up to date with what is next in technology 
speaking of what is next my team and I started to   use AI across our entire workflow and this makes 
a huge difference in saving time and staying on   budget in 2025 over half of the companies are 
already using AI in some form research shows that   40% of people worry that AI will replace them at 
their job but the reality is that people who use   AI will be replacing those who don't and this is 
already happening now Microsoft Google Amazon are   currently hiring people that understand AI those 
who know how to build with AI this isn't about   getting a job if you build a startup like me or 
create anything or a working professional AI isn't   a threat for you it's leverage used right it can 
save you hours and time and thousands of dollars   in cost and you need to learn how to use it now 
this is why I highly recommend you joining this   2-day AI training by Outskill which takes you from 
beginner to advanced AI professional in just 16   hours it's normally valued at $895 but I partnered 
with Outskill to provide 1,000 free seats for you   this 2-day program offers 16 hours of live 
AI training spread across two days happening   on this Saturday and Sunday of the coming week 
between 11:00 a.m and 7:00 p.m in this training   you will learn more than 20 AI tools prompt 
engineering how to develop AI agents and more   and exclusively for my audience you can join it 
for free just register now through the link below   or scan the QR code here and don't forget to join 
the intro call happening this Friday 10:00 a.m EST   and thank you Outskill for sponsoring this episode 
now it turns out that this new technology doesn't   just help to move data faster it opens the door to 
something even bigger computing with light itself   do you remember this device which looks like a 
tiny submarine the Mach-Zehnder Interferometer it turns out that with just a tiny tweaks we can 
use exactly the same device to do computing to be   specific to do multiplication let me illuminate 
this for you we've already seen how applying an   electrical signal to one path let us encode 
digital data into light but if we go one step   further and instead of digital pulses we apply 
analog voltages something fascinating happening   the amount of phase shift in this case changes 
smoothly depending on this voltage and as a result   the intensity of light at the output becomes 
directly proportional to the product of two   values input light and applied voltage in other 
words this device performs analog multiplication   which means if we take this device and scale it to 
a large number of devices we can perform matrix-   -multiply accumulate operation in analog fashion 
and this operation is everywhere in AI it's being   performed billions of times per second every 
second in every AI data center on Earth if you   don't feel fully enlightened yet let's keep going 
each optical modulator encodes a different weight   a beam of light carries input values we multiply 
input light with analog value on the device then   at the output photo detectors convert this light 
into current and then the results can be summed   up electronically now we do that across thousands 
of parallel channels and so we implemented matrix-   -multiply acccommulate operation in analog fashion 
here is the beauty of this approach because light   can carry multiple streams of data at different 
wavelength of light at the same time this means we   are not just doing fast computation we are doing 
also massively parallel computation with minimum   energy loss and with no need to stop the data 
basically computing is happening as the photons   are flying by and this is not to be taken lightly 
this is a very elegant approach and as we've seen   in the previous episodes this is exactly what 
Lightmatter is implementing with their photonic   based computer now if graphene is so good why it's 
yet not in every chip every laptop and every phone   well as with any new breakthrough material there 
is a big challenge of manufacturing and basically   bringing it from lab to mass-production the 
adoption of graphene won't happen unless its   production becomes scalable and affordable to put 
it into the real world chips we need to be able   to grow or transfer high quality graphene on the 
wafers and do it at scale and for a long time this   wasn't possible but now it's finally starting 
to change we see new graphene fabs being built   around the world take Black Semiconductor for 
example they are not just designing graphene based   photonic chips but they are building the entire 
infrastructure to manufacture them at scale their   new fab FabONE is under construction in Germany 
and they plan to begin production in 2026 and   scale up to full volume by 2030 then there is a 
Destination 2D a spin-off from UC Santa Barbara   they are developing not just graphene based 
interconnects but also designing tools and   techniques and figuring out the entire recipe 
to move graphene from lab to fab and they're not   alone there is also a company called NanoXplore 
that developed a special dry exploration process   which allowed them to grow high quality graphene 
without impurities and this is very critical for   electronic devices because in this case any even 
tiny impurity can ruin the whole performance so   now we are talking about wafer scale graphene 
nearly defect-free and this was not possible   even a couple of years ago what's interesting 
now even big players paying attention TSMC   Intel Samsung already exploring how to integrate 
graphene into the next generation interconnects   TSMC for example is testing a hybrid graphene 
metal structures their strategic way to start   replacing copper without the need to reinvent the 
entire fab because let's face it we can't rip out   copper overnight here we more likely to see a 
gradual step-by-step transition and that's how   the most of the new materials are making it into 
real devices not by an instant disruption but a   more strategic roll out making graphene in the 
lab is one thing manufacturing it at scale while   keeping it flawless is completely different story 
the problem is when graphene is produced in large   quantities defects start creeping in tiny grain 
boundaries and impurities they may sound harmless   but in semiconductors this is catastrophic they 
can completely destroy the performance if you   think about silicon silicon manufacturing today 
is basically synonymous with rocket science here   we've spent decades perfecting the progress to 
reach this ultra high purity because that what   it takes to build reliable chips just think about 
the fact that at the state-of-the-art 3 nm and 2   nm only two fabs in the world have the recipe 
to make them for graphene this recipe doesn't   exist yet and even if we get there we are not 
done because in this case graphene has to play   nice with existing fabs that are all built 
around silicon from lithography to etching to   packaging everything is designed for one material 
so switching to graphene would mean retooling fabs   at least partially and that's expensive slow and 
risky and then there is a transfer problem because   graphene is often grown on materials like copper 
or silicon carbide but moving it on a chip ready   surface without cracks defects or contamination 
is still a major challenge and that's just for   graphene used in interconnects now pile on top of 
that one last issue economics so even if we manage   to overcome all this technical challenge we have 
to ask is this economically viable and switching   to new material is not just about making it 
work it's about cost effectiveness too and   today's graphene is definitely not there yet for 
graphene to move beyond the lab we need to work   on three aspects scalability fabrication and cost 
but the progress is finally picking up and we are   no longer asking if graphene will eventually 
reach the market we are asking when now let's   talk investment and here again not investment 
advice just my thoughts something you can look   into looking at the bigger picture we see that AI 
related computing demand is skyrocketing and AI   workloads are unique they need entire data centers 
to function like one massive GPU that creates huge   pressure not just on compute but also on the 
interconnects tying them all together this is   where photonics and graphene enters the picture 
right now we are already witnessing photonics   replacing copper starting from rack to rack server 
to server GPU to GPU and then soon it moves within   the die interconnect and the startups leading this 
shift are Lightmatter and Ayar Labs on the public   side keep an eye on Broadcom Marvell Lumentum they 
are now a part of NVIDIA photonic ecosystem also   potentially POET Technologies and Cisco here 
i would say photonic interconnect is a great   area to invest and worth looking not just into the 
innovation into the product but into the business   model now to graphene before it will be able to 
power the entire computing systems it will first   show up in interconnects and that's where we will 
see the first real impact but this will take quite   some time if this video brightened up your day do 
me a favor share it with your friends colleagues   and on social media i really appreciate it and 
if you want to stay connected and just learn what   is next in technology connect with me on LinkedIn 
and if you're an investor also connect with me on   LinkedIn thank you guys for watching love you guys 
we'll see you in the next episode very soon ciao

---

## 20. AI Has Never Been Able To Do It - Until Now
**Channel:** Anastasi In Tech | **Views:** 142K | **Date:** 8 months ago | **Duration:** 15:54 | **ID:** kucIgsS6wrw
**Link:** https://youtube.com/watch?v=kucIgsS6wrw

### Transcript:
DeepMind's new AI just made a breakthrough in 
math improved the design of Google's chip it's   running on and casually optimized its own code all 
without being explicitly trained for any of it in   fact it simply evolved the skills after a decade 
in chip design R&D and now building my own tech   startup this new AI agent caught my attention 
in the way few things do in this video I will   break down exactly how it works and why this 
might be the most important AI for science yet   over the past decade AI has taken on some of 
the toughest problems in science from protein   folding to quantum physics and even challenges in 
math and computer science on this front DeepMind   has already built some very impressive models 
Alphafold AlphaChip and AlphaTensor each designed   to solve a particular task and actually I covered 
them all on the channel so subscribe now to catch   up later on and stay updated on what is next 
in technology and just now they've introduced   something entirely new AlphaEvolve it's an AI 
agent that is not tackling specific problems   but discovering entirely new algorithms without 
any prior training for this and that's a big deal   now we are no longer using AI to solve specific 
tasks but we are starting to build general agents   that can explore large space and innovate 
on their own across many different domains   AlphaEvolve takes inspiration from the process of 
evolution what's known as evolutionary algorithms   and to be fair it's not something new they've 
been around in machine learning for a while   Google's AutoML is a well-known example these 
kind of algorithms are especially useful when   the search space is huge like when you're tuning 
a neural network or designing a computer chip   where you're dealing with millions of variables 
and endless ways to combine them what's really   fascinating about AlphaEvolve that it combines 
something old with something new evolutionary   algorithms with the state-of-the-art large 
language models think of it like this it's   an evolution on steroids supercharged by LLMs now 
let's have a look at how it actually works because   this is super interesting the process starts 
by giving AlphaEvolve two things an evolution   function and a code template think of this as the 
rules of the environment and the initial genetic   blueprint for example if we optimizing data 
center job scheduling the evaluation function   describes and scores how well each solution uses 
the data center capacity basically here we define   the scoring criteria and a basic starting point 
for the code and from here AlphaEvolve takes   over then it enters so-called evolutionary loop 
where it creates a large population of algorithms   basically a set of offspring for the problem 
inside this loop AlphaEvolve uses a kind of a   teamwork approach where Gemini Flash generates 
a wide variety of algorithm variations while   Gemini Pro contributes fewer more rare and high 
quality suggestions next each version is tested   for how well it works AlphaEvolve checks both 
correctness and performance and then saves the   result into the internal memory this way it learns 
from its mistakes just like nature that keeps what   works and discards what doesn't and over time 
it's keep improving the code then only the best   performing algorithms are used to create the next 
generation and this loop keeps repeating often   millions of times gradually evolving better and 
better solutions over time brand new algorithms   start to emerge just like in nature where it 
takes many generations to evolve useful traits   just think about how whales evolved from land 
to ocean creatures this by the way took over   10 million years or how giraffes evolved these 
long necks the real game changer here is that   this evolution this process this natural selection 
is fully automated so instead of waiting for years   we can now evolve and test new ideas multiple 
times a day just think about it what used to   take a research team in a lab years now can be 
tested in a matter of a few days by AlphaEvolve   through this non-stop experimentation and I 
was lucky to get an opportunity to talk about   it with Pushmeet Kohli who is a Vice President 
of Research at Google DeepMind on how it works   and where all of this might be headed yeah so what 
is the most remarkable thing about AlphaEvolve is   that it is not trained in it at all in some sense
it essentially just leverages the baseline Gemini   large language model and what it does it uses that 
model to orchestrate a whole evolutionary search   system so you start with a given problem the model 
is told that you have to solve this particular   problem and here's a function evaluator and this 
is the type of code that I want to here's the   skeleton of the code and this is the part that 
you need to figure out or evolve the model will   then come up with different hypotheses as to how 
it solves that it might solve the problem and by   evaluating those hypotheses by combining them 
by making changes to them it is able to then   develop a much much better solution so although 
the model itself is not trained it is in some   sense learning through that whole process so we 
like many people call it in context learning where   the model remains the same but what is changing is 
the input that is going to the model what's really   interesting AlphaEvolve has already delivered 
some pretty cool results on the scientific side   it's managed to speed up the matrix multiplication 
operation which is the core operation behind the   Google's Gemini model training itself matrix 
multiplication is one of the most important   operations in the modern AI which is running 
billions of times per second across every AI   model every day for a decade the gold standard has 
been Strassen’s algorithm which has stood unbeaten   since 1969 but AlphaEvolve managed to find a way 
to do matrix multiplication using one fewer step   this may sound as a tiny improvement but 
eventually it led to about 1% speed up in Gemini's   inference and training time and when we're talking 
about such massive models this results in millions   of dollars saved and enough energy saved to power 
a city and that's not it at all AlphaEvolve also   found a way to improve the circuit design and 
eventually the layout of the Google's TPU the   latest generation of Google tensor processing unit 
Gemini and AlphaEvolve is running on this thing   cool huh it managed to optimize a key arithmetic 
circuit inside the matrix multiplication unit by   removing some unnecessary bits and that's 
cool because this reduce both the chip area   and power consumption i'm just wondering why 
EDA Tools didn't catch that and it went even   beyond that it managed to optimize low-level 
GPU instructions at the compiler level and   this little tweak allowed to speed up by 30% the 
FlashAttention kernel which is the key component   in the transformer-based models and this means 
even more saving in energy and compute and it's   so fascinating to see how AlphaEvolve manages 
to optimize basically the entire stack from the   software to low-level instructions to the circuits 
it's running on on the commercial side AlphaEvolve   has discovered a new way to optimize Borg which is 
Google's data center managing system and according   to Google this single optimization led to about a 
1% reduction in Google's cloud computing bill now   I found only the data from 2023 so this would be 
roughly 260GWh which is equivalent to a month of   energy consumed in a whole San Jose now my take 
on AlphaEvolve as I spent more than half of my   life in R&D first as a software developer full 
stack and then 10 years in chip design i know   what it takes to develop something genuinely 
new not every human can do that you know so   from this perspective seeing how AlphaEvolve can 
autonomously discover sophisticated algorithms   frankly incredible and that's crazy because 
this is just the beginning just the hint on   what it can do in other industries and at larger 
scale i would love to hear your thoughts on this   in the comments and just in case I would really 
love an AlphaEvolve update on my cognitive social   and humor functions now one very important thing 
to keep in mind that AlphaEvolve isn't yet fully   self-improving because it doesn't constantly 
upgrade its own core intelligence or learning   algorithms in this direct self-feeding loop 
for that kind of improvement that we see with   Google Gemini releases this take months and 
a lot of human input and this process isn't   fully automated at least not yet AlphaEvolve 
comes not without limitations at the moment it   can only take on problems which solutions can be 
evaluated with a score function which means if the   system cannot understand what a better solution 
looks like AlphaEvolve can't evolve towards it   another consideration that this approach actually 
works the best with a models which can handle   large context because we need this context for 
the model to learn to remember what it tried   before and to learn from its mistakes the funny 
thing is we humans are not so different from AI   we are also constantly chasing energy right in 
different forms and we also constantly trying   to improve our functions our code our cognitive 
and social functions and we are learning from   mistakes from trials just like AlphaEvolve 
but in our case we call it life experience   now looking at the bigger picture and I got this 
opportunity to look at the bigger picture because   I'm just back from Google I/O which was incredible 
experience so looking at the bigger picture it   really drove home this idea that AI isn't just 
the next big thing it will be definitely bigger   than the internet and seeing all the progress 
with large language models image and video   generation for me still applying AI to science 
is the most compelling the most exciting part   of it and seeing all this amazing research Google 
DeepMind is doing it makes me wonder how do they   pick how do they choose the next big scientific 
challenge to tackle so I think for us the most   there are a few different dimensions that and few 
different considerations that we think about when   we do problem selection one being the impact of 
the problem whether that problem is transformative   enough in the sense that it's a root node 
problem which if you can somehow solve it then it   brings about a paradigm change or a transformative 
change in it in our abilities to solve many more  problems downstream problems so that's one 
element second sort of requirement is that   the problem needs to require AI right that there 
is a hard problem where we think AI can have a   transformative difference make a transformative 
difference and thirdly in order for AI to make   this difference it cannot just happen in a vacuum 
it needs experience so the presence of training   data is extremely important as well like whether 
we have the right training data or the right   evaluation methodology for us to make progress on 
that so if you look at all the different AI models   that we have generated for science whether it's 
Alphafold whether it's some of our genomics work   or some of our fusion work and even now our math 
models or AlphaEvolve they have training data or   this evaluation i'm definitely looking forward 
to see how AlphaEvolve will impact scientific   discovery and I am particularly excited that 
this episode is sponsored by 80,000 Hours they   are an incredible nonprofit organization that 
helps people find careers where they can truly   make a difference in the world they are called 
80,000 Hours because you spend roughly 80,000   hours of your life working this is 40 hours 
a week for 50 weeks for 40 years and that's a   lot of time and if you want to make the world a 
better place and make a difference this is your   biggest opportunity 80,000 Hours is a nonprofit 
that helps you find a fulfilling career where you   can make a big impact their advice don't just 
follow your passion in fact 80,000 Hours spent   the last 10 years researching how to do work 
that truly matters and now they've built an   amazing set of resources including guides on how 
to build a high impact career one-on-one career   advising and a created job board with roles they 
believe are especially impactful they even run   a podcast with in-depth interviews with experts 
about the world's most pressing problems and the   best part all of these resources are completely 
free their only goal is to help you make a   difference so now go to 80000hours.org/anastasi 
to get your free career guide check them out   and thank you 80,000 Hours for sponsoring this 
episode i truly admire your work and thank you   guys for watching till the end i will see you 
in the next episode very interesting one ciao

---

## 21. Inside China's New AI Megafactory
**Channel:** Anastasi In Tech | **Views:** 225K | **Date:** 8 months ago | **Duration:** 15:29 | **ID:** r84Y1iXPRgk
**Link:** https://youtube.com/watch?v=r84Y1iXPRgk

### Transcript:
Huawei has been positioning itself as a Chinese 
NVIDIA for quite some time and now they've just   released a new AI GPU that is powering their new 
AI CloudMatrix and this is the most powerful AI   data center solution ever built in China using 
domestic technology it almost doubles the   performance of NVIDIA's own solution think about 
it as the DeepSeek moment for AI data centers i've   spent the last decade designing computer chips and 
I've been wondering how did they manage to pull   this off despite the strict US export controls 
and SMIC's struggles with manufacturing and   what does it mean for the global AI race let me 
explain US China export controls on AI chips and   semiconductor technology are clearly stimulating 
domestic developments in China while NVIDIA   dominates globally Huawei is designing an entirely 
parallel ecosystem for the Chinese market and   honestly what they're doing their solutions and 
their decisions are very interesting and I will   break it down today in fact they're establishing 
their own supply chain starting from securing the   wafer manufacturing to tools to chip design tools 
all the way up to designing their custom silicon   currently the most competitive GPU designed 
in China is Huawei's Ascend 910C GPU in fact   it's their answer to NVIDIA's state-of-the-art 
great Blackwell 200 GPU and now they're already   shipping it to customers let me break down their 
new GPU first before we go all the way up to their   new CloudMatrix 384 looking at the design of the 
new Ascend 910C GPU Huawei has followed a similar   strategy to NVIDIA's they are shifting towards 
larger GPUs one of the key trends in the industry   as AI models are growing exponentially in size 
and the amount of data is processed by AI models   is also increasing we are throwing more and more 
silicon in it here followed NVIDIA's approach with   their Blackwell architecture they've introduced a 
double die design at the high level there are two   GPU dies linked by an interconnect bridge with 
each die surrounded by four memories that's how   they've doubled the amount of compute and memory 
per GPU now according to official specs this new   Huawei GPU delivers 800 tFLOPS of compute at 16 
bit precision just for comparison this is four   times more powerful than NVIDIA's H20 the most 
advanced chip NVIDIA is allowed to sell in China   however it's still three times less powerful than 
the GB200 the chip Huawei's new GPU ultimately   aims to compete with NVIDIA's GPU also features 
this state-of-the-art memory has higher memory   bandwidth and at least twice as efficient in terms 
of performance per watt what's interesting this   new Huawei GPU is reportedly manufactured in 7 nm 
by TSMC and we will talk more about this towards   the end of the video now Huawei didn't just 
build this GPU they used it to power their new   AI CloudMatrix 384 and what's interesting here 
if in raw performance this new GPU is clearly   behind NVIDIA's GPU its system level architecture 
flips the game in fact Huawei did something quite   crazy here they went full optical CloudMatrix 384 
built out of 384 910C GPUs and has been positioned   as China's homegrown alternative to NVIDIA's 
NVL72 well what is the trick here if we look   at NVIDIA's system we have 72 GPUs connected 
via NVLink here they use 36 NVLink switches   to interconnect all GPUs in the flat approach 
allowing multiple GPUs to communicate with each   other and these connections are mostly electrical 
meaning it's copper and altogether the system is   capable of 180 PFLOPS of FP16 compute but when 
we look at Huawei's new CloudMatrix it's built   off 384 GPUs which is five times more GPUs and 
with that they've managed to almost double the   performance of the system and I think there is 
still room to scale it up further now looking   at the power efficiency it doesn't look good at 
the system level the CloudMatrix consumes around   600 kW versus NVIDIA's 145 kW so Huawei solution 
eats up four times more power but why first of   all the silicon itself is way less efficient 
but the key difference comes from the system   level and here did something crazy both NVIDIA 
and Huawei having a flat all to all architecture   meaning every GPU communicates with every other 
GPU but the key difference is that Huawei relies   on the optical links not just between the racks 
but between the GPUs as well while NVIDIA uses   mostly copper here for the NVL72 they have 
1,500 copper cables to interconnect all 72   Blackwell GPUs and NVLink switches within 
the rack which significantly reduces the   complexity and the cost it's actually six times 
cheaper and way more power efficient than using   optics here here they save roughly 20 kW of power 
per rack however Huawei went fully optical here   just imagine each of 384 GPUs optically connected 
to the network with multiple optical transceivers   meaning thousands of transceivers so going 
optical means huge bandwidth so you can send   a lot of data simultaneously but these optical 
transceivers drain a lot of power and it's a   really challenge to maintain them to maintain the 
system it's really failure prone now you get the   idea right why Huawei's solution is so crazy and 
so complicated that's why NVIDIA is now moving   towards silicon photonic so integrated solution 
because it saves a lot of power and if you want   to know more make sure to subscribe to the channel 
right now and then watch this deep dive episode on   this later on now before we continue to break down 
this new Huawei solution some very interesting   decisions they've made let's first talk about 
tariffs Trump recently announced a major tariff   exemption for electronics to protect US consumers 
from price hikes and ease pressure for tech giants   well this sounds like good news go to 
groundnews.com/anastasi to properly understand   how geopolitics shapes the future of technology 
founded by a former NASA engineer Ground News   built the only app and website bringing clarity 
to today's most critical issues by gathering news   from all around the world then breaking down each 
source political lean credibility and ownership we   can understand the biases driving each perspective 
here you can sort through the hundreds of sources   covering this exemption to see how some highly 
factual outlets frame this move as a huge side   of relief for tech giants while others expose 
how destabilizing Trump's tariffs have been   most of you will see only one of these two 
perspectives on your typical news feed yet   both are important on the conversation on how this 
trade war could impact NVIDIA's sales in China the   future of technology is becoming increasingly 
complex and I believe Ground News is the great   tool to find the most actual information on it and 
because they're independent and funded by readers   like us I got for you an exclusive 40% off on 
their Unlimited Vantage plan I've been using just   go to groundnews.com/anastasi or scan this QR code 
or click the link below that's just $5 a month to   see how credible resources report on technology 
trade war and other important aspects that impact   our lives we have moved from a monolithic general 
purpose computing platform to next generation AI   computing platform on CloudMatrix we've already 
discussed that Huawei went fully optical using   thousands of optical transceivers for direct 
connection between GPUs they've explored it in   greater detail in their recent paper but 
there is a catch using that many optical   transceivers exploding the power consumption and 
the complexity of the system so clearly this is   not the direct one to one replacement to NVIDIA's 
state-of-the-art system but for sure good enough   to replace NVIDIA's H20 GPU and they're still 
beating NVIDIA performance at the clusters or   at the system level yes twice less efficient but 
guess what Chinese customers won't care much in   this case about power consumption unlike the US 
and Europe China is much less concerned about   power limitations in fact the cost of energy 
in China is cheaper than in the US and over the   past few years they've managed to greatly extend 
their power grid with renewables like solar hydra   wind and now nuclear unfortunately their energy 
split is still not looking very good with 50% of   energy coming from burning coal and oil and it's 
very polluting eventually in the long term the   cost of intelligence will converge to the cost of 
energy and this is another very important sector   to invest in and I also have it as a part of my 
portfolio and here we're talking not just about   renewables but about infrastructure storage grid 
resilience well not just energy but also water   water supply we'll talk more about this towards 
the end of the video now let me know your thoughts   in the comments this Huawei story this DeepSeek 
moment for data centers is a great illustration   of something we've talked a lot on this channel 
that nowadays is not about just building the best   GPU it's building the infrastructure the system 
NVIDIA's CEO Jensen Huang says that NVIDIA is now   an infrastructure company and in the real world 
systems and infrastructure matters more than chips   we see here that Huawei is clearly years behind in 
silicon but they found a workaround in the system   level in the networking and in the software stack 
and in general China is very strong in software   the CloudMatrix runs on their proprietary CANN 
software stack it is similar to NVIDIA's CUDA   stack but built for their GPUs optimized for their 
NPUs Neural Processing Unit NPU is a specialized   part of silicon design to accelerate AI tasks 
like matrix multiplication or tensor processing   and is built upon Huawei's proprietary 
DA VINCI architecture this CANN software   stack handles everything from compilers to graph 
optimization to workload distribution across the   hardware and it plays a critical role in this 
new CloudMatrix system because when system is   complex and prone to failures this software plays 
a critical role in making everything run smoothly   well at the moment the next generation of Huawei's 
GPU Ascend 910D GPU and 920 GPU are in production   and of course I will share more details on it when 
available so make sure to subscribe to the channel   not to miss this big update still manufacturing 
remains one of the biggest challenges for China   in fact there have been reports that the 
910C GPU dies that we've discussed today   are apparently still manufactured by TSMC at 
7 nm and brought to China well I don't have   any data to prove that what we know for sure 
is that they're still heavily relying on the   US and Europe for the most critical technologies 
and tools and even though they're still figuring   out the right recipe to come to the high yield 
in manufacturing it's just a matter of time   time funding and perseverance which they have no 
shortage of in the long term it all will come down   to the access to energy abundant cheap energy 
and water i wrote a post about it on LinkedIn   if we are not connected yet make sure to connect 
because water is another very critical resource   for the planet as well as for data centers now 
just think about it a typical 100 megawatt data   center consumes roughly 2 million liters per day 
and of course there are some recycling techniques   but it can't be recycled indefinitely in the 
majority of the cases around 70 to 80% is just   evaporated and that's quite harsh just think about 
the consequences of building a 2,000 megawatt data   center in the area with limited water resources 
not looking good and China is exploring different   ways to address it for example they've been 
experimenting with an underwater data center the   idea here of course is to reduce power consumption 
and the resources spent on cooling in March this   year they've launched the first operational 
underwater AI data center of the cost of Sanya   Hainan just think about it placing data centers 
underwater allows for direct water cooling but of   course the maintenance of this is a pure nightmare 
in this case repairs would require retrieving data   center parts from the sea meaning huge downtimes 
and honestly I hope it won't work because this   would have a huge negative effect on the marine 
ecosystem and I don't want this to happen looking   forward to reading your thoughts and feedback 
in the comments and now check out this episode   on NVIDIA going optical or this one on a new 
quantum computer that runs on light please help   this channel to grow by sharing this video with 
your friends and colleagues and on social media   i really appreciate it love you guys now I have to 
run to catch a plane see you in the next one ciao

---

## 22. Quantum Computing Breakthrough
**Channel:** Anastasi In Tech | **Views:** 388K | **Date:** 9 months ago | **Duration:** 17:41 | **ID:** HnsbSdb-9h8
**Link:** https://youtube.com/watch?v=HnsbSdb-9h8

### Transcript:
a new quantum computer by Xanadu has solved in 
under two minutes a problem that would take the   world's fastest supercomputer over 7 million 
years to work out the key it uses light for   quantum computation and since photons don't feel 
heat it can run at room temperature powering the   first quantum data center I've spent the last 
decade designing computer chips get over it and   I'm particularly excited about this milestone 
because this is the beginning of quantum data   centers becoming a reality let me explain over 
the past few years we witnessed an incredible   AI revolution which has been driven by GPUs and 
AI chips in fact the demand for computing power   has never been higher meanwhile the scaling 
of classical computer chips has slowed and its   performance has also grown slowly linearly from 
year to year but how do we get to exponential   improvement while probabilistic computers 
are still in the making quantum computers   are getting closer and closer to prime time and 
they can deliver this exponential improvement   Just to give you a sense of the magnitude 
of what's possible this new quantum chip   from Xanadu that we will break down 
today has already achieved quantum supremacy. Xaa Naaa Duuu. It performed Gaussian Boson Sampling 
in under 2 minutes which would take a classical   supercomputer over 7 million years to complete 
You see the speed-ups that we can achieve with   quantum computing is truly remarkable for 
certain tasks But the potential of this   approach is enormous and the reason behind 
is light This new quantum processor is using   light so photons instead of electrons or trapped 
ions for quantum computation But why light well   we know that there is a plethora of great ways 
to build a qubit One of the most common ways is   superconducting qubit The approach which pursued 
by tech giants like Google IBM and Amazon The main   challenge of this technology that these qubits 
are extremely sensitive to noise Anything heat   vibration cosmic rays literally anything can throw 
their calculations off Its operation requires   temperatures colder than those found in deep 
space And this is how a quantum computer used to   look like Isolated from the rest of the universe 
placed inside a huge refrigerator Now just think   about it If every dozen of qubits requires such a 
massive cooling system scaling it to a data center   with a million qubits becomes nearly impossible 
let alone building pocket-sized quantum devices   This is how it used to look like but not anymore 
Because when we use light for quantum computing   we don't need this bulky cooling systems In 
fact photons don't interact much and they don't   feel heat So this makes them way more stable And 
this first property alone makes photonic quantum   computers way easier to scale Well that's one 
aspect to this But in fact the main advantage   of using light for quantum computing is in 
networking Just think about it If we compute   in light domain we can stay in the same domain and 
use it to link many quantum systems together into   one large quantum cluster And we can do so using 
already existing communication infrastructure you   know fiber optics that brings internet to every 
home This means we can naturally link many quantum   computer clusters together Think about large AI 
data centers currently running on NVIDIA GPUs but   instead running quantum computation This is where 
photonic quantum chips truly shine Now before we   can even begin to talk about applications here 
first of all let's understand the fundamentals   of photonic quantum computation Here we deal 
with photons tiny particles of light It's in   fact the smallest possible unit or if you will 
quantum of electromagnetic energy and photons   have this beautiful feature called wave-particle 
duality On one side they behave like particles   which makes them very quantum On the other 
side their wavelike behavior makes them more   similar with classical so non-quantum systems 
especially when we encode information using waves   Interestingly there are several companies 
pursuing photonic quantum computing And   the classical way to build a photonic qubit 
is based on a single photon In contrast the   Canadian startup Xanadu is using multiple 
photons here And this makes the difference   It turns out if you work with single photons 
it becomes much more quantum more random more   probabilistic On the other hands the more photons 
you use the more it becomes a classical system   while still maintaining its quantum properties 
Why does it matter because when you work with   a classical single photon you get a superposition 
of 0 and 1 So this classical quantum bit right but   when you use multiple photons you can create more 
complex states And this gives you more flexibility   and more power in how you can process quantum 
information The states they work with start as a   superposition of 0 2 4 and so on Only even numbers 
And in theory this can go all the way to infinity   But of course in practice there is a physical 
energy cut off And this approach opens the   door to a whole new class of tasks it can handle 
like Gaussian Boson Sampling and others including   quantum chemistry Now we understood how a photonic 
quantum build is built Now let's understand how a   photonic quantum processor works And here we will 
start with a photonic core all the way up to a   quantum data center It starts with a single laser 
that generates a stream of light pulses where   each pulse represents a qubit Then the light 
goes through this tiny circle called the ring   resonator which creates a quantum state so-called 
squeezed state which is Xanadu's version of the   qubit and then the light travels further passing 
through beam splitters You see here the first two   rows it actually combines the two beams together 
allowing their quantum wave function to interfere   and at this point the qubits interact And now at 
the output we have an entangled state And then   there is a third beam splitter which is now mixing 
rows two and three So essentially we are trying   to get as many combinations as possible by mixing 
all four states together Eventually at the output   we have all four states entangled And you may ask 
well where the computations are performed because   typically it's done using quantum gates But for 
Xanadu chip it happens actually at the end where   the measurements are performed Basically here 
measurements induce the effect of the gates So   at the end they perform a series of measurements 
using photo detectors and these photo detectors   count how many photons arrive usually up to 
seven or eight and they measure all the outputs   except one and it has to be done with a very 
high precision to stay on the bright side of   uncertainty What's interesting here even though 
you know with how many photons you started with   after entanglement and interference you don't 
know where each photon will end up So the final   measurement collapses the quantum state into one 
possible outcome And this is known as projective   measurement And this is not only efficient but 
also highly scalable approach because photonic   quantum computers naturally integrate with 
optical fiber So they can naturally and easily   connect many of quantum processors to solve larger 
more complex tasks together eventually building a   quantum data center And Xanadu did it They proved 
it's possible We will dive deep into details of   this and implications just in a moment But I find 
this progress very exciting Let me know what you   think in the comments And if you enjoy this 
episode make sure to subscribe to the channel   to stay up to date with what is next in technology 
Now before we dive into the quantum data centers   have you noticed something new i finally upgraded 
my chair I moved on from my old chair to a new   ergonomic chair from Sihoo and I love it You 
know I work in sprints sometimes 12+ hours   straight And having a proper setup and posture 
is so important for how you feel your health and   productivity And this chair made a huge difference 
It's very comfortable for the back for your arms   and especially for the lower back It has self- 
adaptive lumbar support that moves with you so   you're always supported The back rest and the wide 
headrest adjust to your posture while 4D armrests   keep your arms relaxed What I personally like the 
most about it is this waterfall shaped seat which   makes you feel weightless kind of floating And 
this is definitely the most advanced and thought   through chair I've ever seen or tried And of 
course you know me I care about aesthetics a   lot And I love the design of this chair because 
it's wellbuilt from top quality materials and   it's a minimalistic design that just fits To be 
honest this chair has just one downside Everyone   in the house wants it So I might need this second 
one If you've been thinking about leveling up   your work setup or home studio highly recommend 
you to check out the Doro C300 chair from Sihoo   Check it out through the link below and use my 
code which you can see now on the screen to get   6% off Thank you Sihoo for sponsoring this episode 
and for making my work days better Now just a few   days ago Xanadu announced their new Aurora quantum 
computer Fun fact the Aurora quantum computer is   powered by the Borealis processor you know Aurora 
Borealis the stunning northern lights which I hope   to get a chance to see one day For now it links 
four photonic server racks in one system using   only fiber optics and running at room temperature 
At the moment it features 84 squeeze-states qubits   across four racks Here one rack handles the lasers 
and the rest handle the quantum processing And   here I was lucky to get a chance to talk to the 
Dr. Christian Weedbrook the founder and CEO at   Xanadu about this huge achievement As the title 
the paper was published in Nature and the team   really did a world first here where they created 
a modular scalable and network quantum computers   So modular because you got individual server 
racks They're just individual quantum computers   scalable because we could go up to thousands of 
server acts today and network You can kind of see   in the picture of the Aurora there's yellow cable 
that's running through and that's fiber optics   where the light is traveling It goes through a 
few different stages from top to bottom But down   the bottom they're also connected to each other 
using the yellow cables as well the photons And   so no one has done that before So very proud 
moment for the team I mentioned that photonic   quantum computers doesn't require cooling However 
in this system they still do cool like 10% of the   components the part where the qubits are measured 
Anticipating your questions there is nothing   fundamental that requires cooling here But those 
photo detectors the most advanced photo detectors   they're using they do require cool temperature to 
operate because the colder you get the better the   accuracy will be For now roughly 10% of this 
quantum data center is cooled while remaining   90% operates at room temperature This means no 
cryogenic no laser cooling nothing And this of   course significantly reduces the complexity and 
the size of it And that's a huge benefit for   scaling it to a larger data center Here one very 
important benefit of computing with light comes   in handy because we are remaining in the light 
domain So we are computing in the light domain   and then here we can share the entanglement across 
the larger system across the data center and this   doesn't require any conversion It's frictionless 
as long as we stay in the light domain While in   other approaches take superconducting qubit for 
example or any other flavor of qubit they use   non-photonic medium for computation so atoms 
or electrons and then they need to converted   to photons to share the information between 
different cryogenic crystals or different trap   ions for example and this is very very hard to 
do while Xanadu has already a distributed quantum   computing cloud up and running Another one is the 
ability to network So the end goal is to have a   large data center that can have smaller quantum 
computers that are worked together most companies   I think will have to have some form of photonics 
in terms of the networking side of things   regardless of how they process their qubits so our 
idea from day one is well if that's the case why   not keep everything photonic and so the ability to 
scale up which is the networking or interconnects   comes more naturally with our photonic based 
approach and this is a huge milestone on the   quantum computing road map and now the future 
of quantum doesn't look cold it looks bright   One of the main challenges is optical loss Loss 
of light during the computation which results in   errors which is very hard to correct As a next 
step Xanadu is focusing on addressing exactly   this problem because like in any quantum 
system the goal is to keep the system as   quantum as possible And when it fails and the 
system decoheres we're losing the advantage   the quantum advantage that gives us speed 
ups Every quantum architecture faces this   but it shows up differently In photonic quantum 
computers photons get absorbed and scattered as   they travel through waveguides or fiber and this 
results in the loss of light And if too many are   lost the system starts to act like a classical 
computer and we don't want that And when they   manage to solve this we are yet to discover 
the most important applications of quantum   computing that we can't yet even foresee Richard 
Feynman famously said "Nature isn't classical,   and if you want to make a simulation of nature, 
you would better make it quantum mechanical,   and it's a wonderful place because it doesn't 
look so easy". Let's be honest in the beginning we   talked about this potential of quantum computing 
to unlock this exponential performance improvement   But to me personally building a practical quantum 
computer is not so much about faster processing   but more about understanding of the fundamentals 
of the universe figuring out things that we   are not aware of yet And this is a very exciting 
journey to see how this will unfold The practical   quantum computer everything you want including 
our investors want true revenue that comes with   a quantum data center - size quantum computer 
So one or two acres of land with thousands of   server racks network together We aim to build that 
in 2029 Where we are now it's loss reduction So we   need to keep reducing the loss in the physical 
components so that's our our big focus In fact   we've called 2025 the year of loss reduction Of 
course other challenges remain that have to do   with error correction right the whole industry is 
working on solving the error correction and then   quantum algorithms This is a big huge challenge 
indeed but it's promising extraordinary rewards   and it's exciting to see that we are getting 
closer and closer to practical quantum computer   operating at room temperature Now let me know 
what you think in the comments I'd love to read   your feedback Let me know if this episode was too 
much technical And now check out this episode and   let this video to see some light Share it with 
your friends colleagues and on social media   This helps this channel to grow a lot Thank you 
guys Love you See you in the next episode Ciao

---

## 23. New Light-Based Computer Takes Over
**Channel:** Anastasi In Tech | **Views:** 379K | **Date:** 9 months ago | **Duration:** 21:43 | **ID:** cUBS5WvL2kk
**Link:** https://youtube.com/watch?v=cUBS5WvL2kk

### Transcript:
Lightmatter have just released a new kind of 
computer one that based on light and this is a   big deal for the entire industry let me explain 
why today computing demand is growing faster   than silicon chips can keep up with to get more 
performance chip makers nowadays just throwing   more silicon at the problem double the area double 
the RAM double the cost and it's been working for   now but there is a catch because the rule of the 
game in semiconductors is that you pay per area   per silicon area used and the costs nowadays are 
skyrocketing nowadays a single GPU costs way more   than your rent one thing is clear we can't double 
down on silicon we have to rethink how we compute   well if we think about it at the data center 
scale it comes down to 3 main aspects first of all   compute interconnect and memory let's start with 
compute for the past decade the main engine behind   AI from transformer models to reasoning models has 
been accelerated matrix math GPUs pushed it TPUs   refined it and then ASICs squeezed out every drop 
of efficiency and now the spotlight is shifting   to computing with light but why in fact we don't 
know much about dark matter but light matters a   lot it's the source of energy growth and time and 
now it's not just powering the life on Earth but   also computing you've likely heard this idea that 
light-based computers are faster because light   travels way faster than electrons well it might be 
partially true but it misses the real point let's   take a regular chip AMD or NVIDIA GPU for example 
it's built off hundreds of billions of transistors   those tiny little switches that are constantly 
turning on and off to perform computation and   it's getting even more interesting here because 
actually in digital chips every time we want to   switch from 0 to 1 or from 1 to 0 we have to stop 
the data take time to either charge or discharge   a capacitor think of it like filling a tiny 
basket with electric charge just to flip a switch   this takes time and now imagine doing it 
billions of times per second this is where   the real slowdown is coming from and this is 
exactly where photonic computers shine because   those are analog chips not digital and this makes 
the whole difference in light-based computers we   are using light waves and light doesn't have 
to stop to charge up there is no capacitance   like with silicon this means we can process data 
on the fly without any delay for switching and   that's why photonic chips are so much faster now 
one very interesting thing to understand about   light-based computers that those are governed by 
Maxwell's Equations and Maxwell's Equations are   linear and this has a huge effect on what these 
kind of computers can actually do it turns out   that at the core of modern AI workloads are 
actually additions and multiplications and   those are linear operations and that's exactly 
what photonic computers excel at now let's put   a spotlight on it and see what happens let's say 
you want to do a matrix multiply accumulate 128 by   128 so if you do it on the Lightmatter photonic 
processor you get result back in roughly 200ps well how this compares to a conventional GPU on a 
conventional GPU for this you would roughly need   100 cycles and if we take 1ns per cycle this 
is roughly 100ns what I'm saying is that the   photonic processor can do the whole job under 
1ns which is roughly very roughly 100-1,000   times faster so you see how much faster we can 
compute when we don't actually have to stop the   data another very interesting property of light is 
that it operates at much higher frequency here we   are in terahertz range compared to the gigahertz 
range in electronics this practically means that   we can compute much more data simultaneously and 
by using different colors of light we can compute   lots of data in parallel and this practically 
means that we can achieve massive parallel   computing without spending more area or more 
power just think about it this is mind-blowing   despite this glowing interest in photonics there 
is a catch or two first of all analog chips are   super efficient but this comes at a cost of 
precision until now analog chips have never   achieved the precision that we actually need you 
don't want your banking transactions to run on   a light-based computer because so far they were 
nowhere near the precision of the digital chips   now Lightmatter finally solved this with their 
new photonic chip in a very elegant way in fact   they managed to achieve a precision that is very 
close to precision of 32bit digital chip and I was   lucky to get an opportunity to discuss it with 
co-founder and CEO of Lightmatter Nick Harris   we've built the first alternative computing system 
that doesn't use transistors that's able to run   economically valuable and useful workloads 
things that you would actually want to run  what we were able to do is we built a photonic 
computer that can play Atari video games it can   run Transformers it can run large language models 
and I think that's a historically significant   milestone you had to prove that an alternative 
form of computer like a photonic computer could   run these workloads accurately as accurately 
as a digital computer and that's what we did   now let's have a closer look at the photonic 
engine it's essentially an accelerator designed   to accelerate linear algebra which boils down to 
adds and multiplies if we break it down this new   photonic computer includes photonic tensor cores 
and electronic chips integrated vertically via   high speed links first of all there are two 
electronic control chips that are on the top   of the chip package their goal is to communicate 
with the photonic tensor cores and then there are   also four photonic engines which are 3D stacked 
underneath you see all nonlinear math is actually   offloaded to the digital chip while all the heavy 
math like multiply accumulate is happening in the   light domain so in total inside there are six 
chips in a single package and overall it's 50   billion transistors that coordinate 1 million 
photonic devices we will dive more into the   details how it works later on but looking at the 
high level a digital chip sends a request to the   photonic engine and then in roughly 200ps gets 
the result back now one picosecond is 1 trillion   of a second so this happening very fast now 
think how of all of this is synchronized it's   a rocket science if we have a closer look into the 
photonic engine here you can see the photonic core   the wave guides through which light propagates 
during the computation and here is a close shot   at the electronic part of the chip which is 
of course a bit less interesting because we   can't see much due to the metal layers which are 
hiding all the beauty of the circuits underneath   now let's get laser focused on how actually 
computing with light works let's say we have   some data an image and it's described by a vector 
which represents pixels in the image and the   values are between 0 and 1 describing how much red 
blue or green it is first we map this vector into   the optical domain then the light travels through 
optical devices and get multiplied by weight using   so-called Mach-Zehnder interferometer (MZI)
and multiplying here actually means turning a   number turning a weight in how bright the light 
actually gets then the light arrives to the end   points which are all connected to a single 
electrical wire so in this way signals get   summed along that wire meaning additions happens 
naturally and this is the true beauty the true   power of light you know no delays no clock cycles 
it's all happening effortlessly just pure speed   let me know what you think in the comments next we 
will explore the performance of this chip and what   it means for the future of computing but before 
that have have you ever wondered how much of your   personal information is circulating around the web 
your name your home address phone number and even   information about your family members could be 
floating around online this happens because data   brokers collect and sell your personal information 
without you ever realizing it and this exposes you   to risks of data breaches and personal security 
and this is where Incogni the sponsor of today's   episode comes in Incogni helps you regain control 
by removing your personal information from the   databases that data brokers rely on i use it 
myself and you will be surprised how simple it is   you sign up authorize Incogni to act on 
your behalf and they send data protection   low compliance requests to these companies 
forcing them to remove your information from   their databases and the best part you can track 
every step of the progress in real time right   from your dashboard as someone who values 
privacy a lot I highly recommend you to try   out Incogni it's a simple way to reduce unwanted 
spam and keep your data off the grid use my code INTECH at the link below to get 60% 
off an annual plan thank you Incogni   for sponsoring this episode analog chips have been long time dismissed as too imprecise of course if 
you can't get math right computer is not useful   and now Lightmatter for the first time got 
it right and I asked Nick to explain their   elegant solution well we have a number format 
called ABFP16 and what we do is we assign   to a block of numbers a scale so we factor out a 
number we save that in the digital processor and   then we query the photonic tensor core to do those 
adds and multiplies we get the result which is a   vector and we multiply it by the scale function 
again but that's just one part of the equation   they're using other tricks as well for example 
they are over amplifying small signals so neural   networks are not losing critical bits in our 
terms it's called LSB's least significant bits   to simplify it think of it like zooming in on the 
most important math numbers close to zero and it   works for the first time light-based chip achieved 
the precision close to digital chips and it's not   just a demo but a real functional chip well what 
we witnessed over the last couple of years that   AI is moving in the other direction from 16 
to 8 bits and now to 4 bits now 4bit format   is becoming a new standard because it's allows us 
to reduce compute and memory requirements and this   shift represents a huge opportunity for photonics 
because it turns out each time we drop precision   efficiency increase exponentially photonic engines 
are crazy efficient at low precision if you look   at just the tensor core itself so just the math 
engine that's operating at a few hundred tops   per watt which is extremely high energy efficiency 
it's also performing at that efficiency at a very   high throughput so that's a tricky point to be at 
when you want to go fast with a digital computer   you spend energy and it's nonlinear so going twice 
as fast costs more than twice the amount of energy   in many cases with this system you're in this 
quadrant of it's very fast and it's efficient   so that's a very interesting spot to be in of 
course real world systems have other components   that eat into efficiency but it turns out there is 
a lot of room how we can further optimize it for   example now Lightmatter is using just one color 
for computation but they can easily increase it   to 16 or 32 and then reuse all the components 
to perform massive parallel computations   just think about it let's say they go from 1 
color to 16 and they immediately have 16 times   higher throughput or higher computational density 
if you will without significantly increasing area   this could power the future of intelligence let me 
know what you think in the comments and if you're   enjoying this episode remember to subscribe to 
the channel this makes me and my team very happy   now all of this sounds brilliant but we know that 
when it comes to exotic computing approaches they   either take decades or even never escape the 
lab take analog computers that are based on some   sort of a resistive device such chips have huge 
potential but are very unflexible and struggle   with running AI models as you can't just run it 
out of the box it requires translation of the   models and even additional training while the new 
Lightmatter processor can already run Deepmind's   Atari and nano GPT which is a reduced version 
with 100 million parameters and it doesn't require   any translation of the models or any additional 
pre-training that's great but remember at the very   beginning of the video we discussed that photonic 
chips are governed by Maxwell's Equations and   there is a second catch because they can easily 
accelerate linear operations but unfortunately   they can't manage logic the challenge with light 
is that photons don't interact beams pass through   each other like ghosts in order to make them 
to feel each other you need exotic nonlinear   materials and deep difficult physics and that 
interaction in fact is the essence of logic   light doesn't know how to play this game that's 
why in the future we are likely to see photonic   engines accelerating linear math and probably 
financial trading but it's unlikely that they   will run Linux or Windows at least not anytime 
soon then there is one more fundamental problem   with photonics as actually one of you pointed 
out in the comments it's really an honor that   such bright smart people are watching my videos 
thank you for your comments so when it comes   to computing let's say you want to invent a new 
computing paradigm from scratch what we need to   do we need to be able to manipulate signals like 
add them multiply them and then we must be able to   remember intermediate results so we can use it for 
the further computations or to act on this result   now when it comes to photonic we can perfectly 
manage the first two but there is no storage   available do you remember we discussed those 
capacitances which slowing down digital signals   this is the way the intermediate results 
stored in digital chips and this does not   exist in photonics what typically happens in a 
photonic chip we will convert this light signal   into a digital one so back to ones and zeros and 
this is a slow part and also it drains a lot of   power this means computations that don't require 
the memory truly shine in photonics but we still   have to figure out the memory part and to be 
honest this is not the problem that everyone   is focusing on right now we are on this channel is 
a couple of steps ahead of the rest of the world   now everyone is figuring out how to efficiently 
link those large GPU clusters together and when   doing so interconnects matter because in modern 
AI workloads no single chip does the job alone   here thousands of GPUs work in parallel and they 
constantly exchange data even nano second delays   in data exchange between GPUs have a huge impact 
on the time it takes to train an AI model if we   manage to solve that we can release new AI 
models way faster and not only that there is   a new class of models so-called reasoning models 
like DeepSeek R1 or so-called Deep Research models   those are very accurate but it takes them 10 
minutes to generate a solution for you so if   we can solve the interconnect bottleneck and 
connect more GPUs together efficiently we can   reduce this response time from 10 minutes 
to let's say 10 seconds this would be cool   the solution is to replace copper that is 
currently being used to link up racks with   photonic interconnect and Lightmatter is solving 
it with their Passage product so this is the big   opportunity for photonics and we're building the 
fastest photonic engines in the world we announced   M1000 at our event a couple weeks ago M1000 is 
114 terabit per second in a single optical engine   we've built platforms for customers that are 
60 TB per second in a single optical engine we   announced L200 which is our standalone general 
purpose IO tile for GPUs and for switches 64 TB per second so Lightmatter is really the bleeding 
edge on how fast these systems can be we're about   8 to 10x faster than any of the companies that 
are out there people are announcing 8 TB and 6 TB   we're at 64 and as soon as this interconnect 
bottleneck is solved everyone will start looking   more into the improving the efficiency of 
computing and here photonics can enable   the next big leap clearly the future is 
optical optics will be everywhere let me   know your opinion in the comments now 
please let this video to see the light   share it with your friends colleagues and on 
social media i really appreciate your support   finally if you're obsessed with light as much as 
I do check out this episode where I explain new   photonic chip from NVIDIA and basically the main 
trend which is happening in the industry right   now must watch thank you for your support 
and I will see you in the next episode ciao

---

## 24. World’s First Silicon-Free Processor
**Channel:** Anastasi In Tech | **Views:** 458K | **Date:** 9 months ago | **Duration:** 19:03 | **ID:** 9XK-fBkWsvs
**Link:** https://youtube.com/watch?v=9XK-fBkWsvs

### Transcript:
researchers have developed a new silicon free 
microchip and some are already calling it the   fastest most efficient microchip technology 
ever i've spent the past decade designing   chips and I am particularly excited about this 
innovation because according to this paper we   could be turning a new page in semiconductors 
let me explain silicon has powered computing   for decades it's the reason why computers have 
become smaller faster and more powerful over   time but will it continue to lead the way well 
after a decade of marvelous engineering it seems   like we are hitting a wall right now transistors 
the building blocks of all modern electronics are   literally becoming quantum devices the problem is 
as the chip dimensions continue to shrink at 3nm   and beyond we bump into the effects of quantum 
mechanics and these quantum effects show up in   a variety of strange behaviors you know it's a bit 
like when you're sick your body doesn't behave it   usually does and you might feel dizzy and just off 
this is exactly what happens when we face quantum   effects the behavior of electronic devices starts 
to change in ways we can't predict or control one   of the main effects that we observe here is 
Quantum Tunneling this is a phenomenon when   electrons are able to cross the barriers which 
they typically should not be able to cross and   this is one of the fundamental challenges of 
scaling beyond 2nm so for a while semiconductor   industry has been looking for new materials in 
fact every measure lip in computing history was   powered by new materials and structures you know 
just like we went from germanium to silicon from   copper interconnect to light from Assembler 
and C to prompting with ChatGPT that's why   the semiconductor industry has been looking into 
replacements for silicon and a new material is   keep popping up bismuth I know it looks like 
a piece of art but in fact it's a heavy metal   and it can actually form this beautiful iridescent 
crystals when we melt it and then slowly cool   down well as you see we have a lot to unpack 
here so let's get down to bismuth today we   are discussing this new paper published in Nature 
very prestigious journal where they developed and   manufactured the first bismuth based chip already 
in Ångström node it turns out it's non-toxic and   it's something you might like to have at home as 
long as you don't know that it's just slightly   radioactive and it turns out that China has more 
of it than any other country it controls over 70%   of the bismuth in the world what makes it highly 
attractive for the next generation of electronics   is its unique properties and there are many but 
among all we are mostly interested how electrons   are arranged around nucleus because it turns out 
that bismuth has some really interesting quantum   properties if we have a look at that one of its 
key advantages it's strong spin orbit coupling   it's a quantum effect where an electron spin is 
tightly linked to its motion around the nucleus   this is a very important property because it 
allows us to control the electron not by its   charge like in silicon but also by its spin 
making it a great candidate for a post silicon   era but of course there is a catch bismuth has no 
natural band gap and without it it behaves more   like a metal than like a semiconductor making 
it actually useless for logic circuits now what   is a band gap imagine electricity as a water 
which is flowing through a pipe in a material   like metal pipe is wide open and electricity 
flows easily however in an insulator imagine   rubber the pipe is completely blocked now a 
semiconductor is like a pipe with a little   wall inside this wall is called band gap if the 
wall is small electricity can jump over it when   you give it a little push but when the wall 
is big it's very hard for electricity to move   and this means that by using the right materials 
with just the right band gap we can build very   efficient and fast chips which switch on 
and off exactly how we want them to now   when it comes to bismuth there is a fundamental 
problem because there is no band gap so it won't   work as a semiconductor of course I would not be 
making this video if there would be no solution   it turns out we can dope it so add some 
additional materials to the recipe to make a   perfect semiconductor out of it by the way all the 
silicon chips are also doped in this work they use   bismuth telluride and by doping it they managed 
to turn it into a perfect semiconductor then out   of this new material they've built a bismuth based 
semiconductor chip and this was for the first time   when this pretty crystal turned into a computing 
device and not just that it can also switch at   terahertz speeds far beyond what silicon can dream 
of here is a sneak peek at the new device i will   break it down in a moment what's interesting 
the entire stack here contains no silicon at all   the transistor device itself is made of bismuth 
and the interconnects are made of graphene by the   way another new episode on graphene technology 
and the recent advances is coming out very soon   subscribe to the channel now to enjoy it later on 
so after many sleepless days and nights in the lab   researchers found that we can use bismuth to build 
transistors and what's even more interesting we   can use it to create very thin layers atomically 
thin nano sheets without sacrificing the   performance exactly what we're looking for for the 
next generation of transistors what's interesting   in this work some of the transistor features are 
just 0.5nm thin so it's five Ångströms and you   know what happens in silicon at these dimensions 
quantum effects causing quantum tunneling and we   are losing control over the transistor so here we 
might need to stick to bismuth according to this   paper published by a team from Peking University 
it turns out that bismuth based transistors have   big advantages over silicon transistors 
and the first one is switching speed it   turned out that bismuth based electronics 
can operate at frequencies around 500GHz or even higher just for comparison today's best 
silicon chips operate at frequencies of up to 5GHz   to 6GHz but very important note here this has 
to do not just with the limitations of silicon   but mostly with interconnect and interestingly 
in this work they are targeting both of these   limitations because they used here graphene 
for interconnect simply put bismuth can enable   new electronic behavior and this goes beyond 
digital chips and most interestingly it may   open the door to new types of quantum devices new 
flavors of quantum bits for example and even more   interestingly devices like spectronics let me know 
what you think in the comments before we dive into   the details of this technology how it works and 
the future of it one thing is clear now whether   you are small business or a large enterprise 
the technology that you choose today matters   more than ever and this is where AMD steps in as I 
mentioned many times on my channel I really admire   AMD for pioneering new approaches they were the 
first to introduce innovations like V-Cache where   they stacked additional cache memory on top of 
CPU die and that gave a huge performance boost to   many applications their new Ryzen Pro chips take 
efficiency to even higher level delivering even   faster performance for AI powered applications 
directly on your laptop imagine your favorite   tools like Adobe Premier Pro or Midjourney running 
noticeably faster you will also see a boost in   AI applications from Hugging Face OpenAI Meta and 
others making your workflow quicker why to upgrade   to a new laptop now apart of efficiency boost AI 
PCs powered by AMD Ryzen Pro series come with six   layers hardware enhanced security and Windows 11 
ready as you may know the support for Windows 10   ends this October means no more security or 
feature updates which may potentially put you   and your company at risk so don't wait to boost 
your productivity and security with AMD Ryzen Pro   laptops right now AMD is offering businesses the 
opportunity to see the impact firsthand with their   free Loaner Program use the link below to get a 
Ryzen Pro laptop put it to test and experience all   the benefits it can bring to your business check 
it out the links are in the description below and   thank you AMD for sponsoring this episode now it's 
time to get back to bismuth let's break down what   exactly they did how they did it and why it's 
important first of all what's interesting from   the first prototype they've built and designed the 
bismuth based chip straight away in the Ångström   node so straight away in the state-of-the-art 
node and that's cool the Ångström node is the   next generation of semiconductor manufacturing 
where feature size are measured in Ångströms and   one Ångström is 1/10th of a nanometer practically 
Ångström node represent manufacturing beyond 2nm   and even further when we start to enter single 
digit Ångström scale the Peking team fabricated   a wafer scale chip based on gate-all-around 
transistor technology you know all modern   chips like AMD's processors or Apple Silicon 
are built with FinFET technology where we have   multiple Fins multiplied horizontally right now 
the industry is transitioning towards the next   big thing gate-all-around transistor technology 
where we turn the Fins on the side so now instead   of placing Fins horizontally the nano sheets are 
multiplied vertically and while in FinFET the gate   is wrapped around the channel on three sides 
this new design allows the gate to fully wrap   around the channel that's why it's actually called 
gate-all-around technology and this new transistor   architecture will enable scaling below 3nm 
what's even more interesting they combined here   bismuth transistors with graphene interconnects 
interconnects are those tiny metal lines that   connect many transistors into logic gates which 
allow them to perform operations like addition   and just to process information in general you 
may have noticed that whenever we talk about the   next gen materials graphene is keep popping up so 
why to use it here for interconnects graphene is a   very interesting material apart of it exceptional 
thermal and electrical conductivity it's also   very thin it consists just of a single layer of 
carbon atoms so it doesn't add much height to the   stack which is crucial for transistor scaling 
especially now when we are starting to build   vertical transistors and then stacking multiple 
chiplets vertically here keeping building blocks   as flat as possible is crucial on top of that 
graphene has high conductivity and provides   extremely stable contact to materials like bismuth 
which means minimum energy lost and interconnects   and if you read me on LinkedIn you know why it 
is important if not let's connect now how did   they manage to manufacture this microchip if we 
have a look at the gate- -all-around transistor   architecture when it comes to manufacturing the 
main challenge is creating this tiny channels and   growing anatomically thin five Ångström thin gate 
oxide around the channel and then wrapping the   gate around it here it's particularly challenging 
because you can't directly see the underside of   the nano sheets here in order to build a vertical 
layer of nano sheets they alternate the bismuth   sheets with ultra thin graphene electrodes 
and at the end we got four of these transistor   layers laid vertically one on top of the other 
on the image you can appreciate how each layer   is fully enclosed in its oxide coating forming 
discrete transistor channels one on top of the   other as the last step devices were mounted on 
top of a silicon wafer for mechanical support so   it doesn't impact the performance of the devices 
i double checked and there was no silicon used in   the active layers of the transistor based on this 
technology researchers manufactured the bismuth   based chip and then did all the measurements 
they measured all the parameters we discussed   like switching speed efficiency and so on and then 
they've tested this new device against transistors   from Intel TSMC and Samsung and according to 
the paper the bismuth device outperformed all   of them in terms of speed leakage and efficiency 
according to the paper the new devices are already   40% faster and three times more energy efficient 
than silicon transistors and this combined with   graphene interconnect already now exceeding the 
speeds of 7GHz to 10 GHz reviving the clock race   of course TSMC the leading chip manufacturer is 
also working on researching new materials beyond   silicon currently their main focus is on 1D and 2D 
materials like transitional metal dichalcogenides   as well as graphene recently collaboration 
between TSMC MIT and Taiwan National University   made headlines because they did a common research 
where they used bismuth as a contact material for   the next generation of transistors so you see 
leading fabs like TSMC is also already looking   into bismuth i'm personally very excited about 
bismuth as a semiconductor i think it has a lot   of potential but of course it's in the early 
stage of development and its success will   depends on overcoming manufacturing challenges 
and also scaling it beyond the lab first of all   making high quality bismuth materials with no 
defects at scale is still tricky it's far away   from the maturity of silicon manufacturing you 
know silicon has a huge optimized global supply   chain while bismuth would require integration with 
existing manufacturing infrastructure and this   would include partially upgrading the equipment 
and processes which will be expensive and slow   this work originated from Peking University and 
of course China would love bismuth to become   widely adopted for electronic devices because they 
control over 70% of bismuth in the world and this   would allow them to ramp up domestic production 
without being too much tied to the silicon   industry what's interesting bismuth highlights 
the general trend in the coming decade mastering   new materials not just improving existing ones 
will enable the next leap in semiconductors AI   and Quantum Computing now I expect the transition 
to the post silicon era to happen in my lifetime   and this is going to be very exciting to watch 
let me know your thoughts in the comments if   you enjoyed this episode please share it with 
your friends colleagues and on social media   i really appreciate it thank you guys for your 
support and I will see you in the next one ciao

---

## 25. NVIDIA’s New Photonic Technology Explained
**Channel:** Anastasi In Tech | **Views:** 295K | **Date:** 10 months ago | **Duration:** 28:44 | **ID:** 7WuLHM8d-ew
**Link:** https://youtube.com/watch?v=7WuLHM8d-ew

### Transcript:
NVIDIA has introduced a new optical chip making 
a huge shift from electricity to light for moving   data in data centers and this is a very important 
technology to understand because it will define   the next decade in AI i've spent the past decade 
designing chips and now building my own startup   but when I was starting out at chip design no 
one cared about chips and finally it's a bright   day for photonics in this video I will break 
down this new optical breakthrough how it works   why it matters what it has to do with the new 
state-of-the-art NVIDIA Rubin GPU and finally   we will discuss why NVIDIA goes quantum let me 
shed some light on it let's start with a problem   it turns out that new reasoning models disrupt 
all previous projections for GPU demand you know   in the early days of AI large language models were 
trained to predict the next word in the sentence   but things have changed we are now seeing a 
rise of new class of models reasoning models   like OpenAI's o1 or DeepSeek R-1 and this don't 
just generate responses they perform multi-step   thinking and it turned out that reasoning is 
expensive it requires at least 20 times more   tokens per inference request which is a result of 
the model talking to itself during the reasoning   these models hold more context and often simulate 
multiple solutions before answering and this   requires about 100 times more compute compared to 
traditional one-shot LLMs and this is exactly what   driving the surge in demand for compute in fact 
it's no longer enough to have fast GPUs you need   a whole infrastructure that can support massive 
computation at scale and now we are coming to   the most interesting part the bottleneck in AI is 
not compute anymore moving the data between chips   is just think about it when you connect thousands 
of GPUs together in a large GPU cluster each GPU   in fact heavily depends on the data which comes 
from its neighbors and it's constantly passing   the results forward so even the smallest delay 
here adds up fast the problem here isn't just   the physical distance between these GPUs it's the 
physics itself because till now the standard was   copper and sending data through copper is like 
running a marathon through sand you know every   electron faces resistance and wastes a lot of 
energy is heat just think about it in big GPU   clusters where thousands of GPUs constantly swap 
data this adds up quickly especially when we are   talking about petabytes of information flowing 
every second this is why modern AI data centers   are not only about the single GPU performance but 
about the network performance and that's why for   a long time we are betting big on photonics 
technology that replaces copper wires with   light speed optical interconnects and this is 
the technology that will define the next decade   in AI in today's data centers network switches 
connect to optical transceivers which are type   of translators translating electrical signals 
into optical ones and sending them across the   data center however inside the rack most of the 
connections are still electrical the brutal truth   is using traditional copper wire is very slow 
and extremely power inefficient because copper   wire resisting the flow of electricity slowing 
data down and generating a lot of heat in fact   if we take a modern data center about 70% of total 
power consumption spent on moving the data so much   more than on the actual compute NVIDIA and TSMC 
are of course aware of this problem and they've   been working to solve it for a while and so now 
finally NVIDIA introduced this new optical chip   Quantum-X is so-called co-packaged optics and the 
idea here in simple terms is to use light instead   of electricity to shuffle data between GPUs now 
just to enlighten you why light is so attractive   because when we use light we can transmit lots of 
data in parallel using different wavelength or if   you like different colors of light simultaneously 
let me explain light operates at extremely high   frequencies 400 up to 750 terahertz for visible 
light extending into the near infrared spectrum   this is so-called bandwidth a range of frequencies 
a signal can occupy and here we are talking about   terascale range bandwidth right which gives us a 
lot of channels much more channels to transmit the   data compared to the electrical signals moreover 
there is no resistance as in the case of copper so   it's just faster and it generates less heat 
and use less power per bit okay so first of   all we're announcing NVIDIA's first co-packaged 
option silicon photonic system it is the world's   first 1.6 terabit per second CPO it is based on a 
technology called Micro Ring Resonator Modulator   it is completely built with this incredible 
process technology at TSMC that we've been   working with for some time and we partnered with 
just a giant ecosystem of technology providers to   invent what I'm about to show you this is really 
crazy technology now let's break down how this   new technology works we start by encoding data 
into tiny beams of light photons these beams are   generated by integrated lasers and then applied to 
the new optical chip inside the new optical chip   there are tiny optical modulators implemented with 
technology called Micro Ring Modulator basically   this is a tiny ring structure that when we apply 
an electric field to it changes its resonant   frequency which in turn changes the intensity of 
the light passing through it and that's how we can   encode the information into the light to simplify 
this concept imagine communicating by changing the   rhythm of a blinking flashlight but billions times 
faster after encoding these photons travel through   microscopic silicon pathways called Wave Guides 
carrying many information simultaneously at the   other end tiny photo detectors grab the light and 
convert it back into electrical signals which is   then read by the GPU now to the most interesting 
part let's have a look at the Quantum-X it's a   photonic package that includes the controlling 
Quantum-X chip with a specialized ASIC Application   Specific Integrated Circuit designed to manage 
signal processing which is supporting network   protocols and basically do control and routing 
in addition there are 18 photonic engines and   then we have a look inside the real breakthrough 
behind this new technology is in how this chips   are actually built and packaged TSMC has 
developed a technology called COUPE Compact   Universal Photonic Engine it combines photonic and 
electronic circuits using advanced 3D packaging by   layering them one on top of the other now with 
this new technology TSMC managed to package it   all in one package but the tricky part here is 
in fact manufacturing here TSMC has developed   the entire foundry process where they integrate 
the photonic chip in a more mature process node   with an electronic chip in this state-of-the-art 
node if we take a closer look at the top we've   got the electronic chip in 6nm featuring 220 
million transistors think of it as a control   center and right on the bottom sits the photonic 
layer a 65nm silicon chip loaded with about 1,000   devices including Micro Ring Modulators Wave 
Guides and photo detectors anticipating your   questions about 65nm it actually doesn't make 
sense to go to a few nanometers when we are   dealing with optical components like Wave Guides 
because as we discussed in many previous episodes   on photonics on this channel photonic elements are 
inherently constrained by wavelength of light they   manipulate so it doesn't make sense to go to a 
few nanometers here so we have a photonic chip   and then the electronic chip that sits on top of 
COWoS Chip On Wafer On Substrate 2.5D interposer   and these two layers are tightly integrated 
just a few micrometers apart so the signals   zip between them very fast with no loss actually 
I was very lucky to get an opportunity to discuss   this huge innovation with amazing Gilad Shainer 
who is a Senior VP of Datacenter Networking at   NVIDIA what does it mean what does it enable so 
first it reduces power there is a 3.5x reduction   in power consumption so now we actually can bring 
more GPUs in the infrastructure and we can drive   more compute and enable more outcome and more 
tokens to be used and all the greatness of what   the GPU can bring and 3.5 is a big reduction in 
power consumption the second thing is now we don't   need to use those transceivers on the scale out 
network so I'm saving millions of transceivers   that I need to install so I can get my data center 
to be fully operated much faster and every months   every day actually on a large data center cost a 
lot of money if I don't use the data center and   months or two months it's even you know it's 
an amazing benefit and this co-packaged optic   technology is very important because we have a 
limited power budget right so we can get more   compute out of it let me know your thoughts in 
the comments section below and if you are among   those 70% of people who are watching this video 
but not subscribed to the channel and in case you   are enjoying it consider subscribing this makes 
me and my team very happy the first generation   of TSMC's COUPE is set for mass production in 
the second half of 2026 and NVIDIA as well as   AMD will be the first adapters in fact the 
new NVIDIA Rubin Ultra GPU which is very   interesting and I will break it down in a moment 
is likely to be the first one to debut with TSMC   COUPE technology and this one is entering mass 
production in the end of 2026 so the future looks   bright literally now before we break down the new 
NVIDIA Rubin Ultra GPU and why NVIDIA goes quantum   have you ever wondered how much of your personal 
information is floating around online your name   home address phone number even information about 
your family members it all gets out there thanks   to data brokers that collect and sell your 
private information without you ever knowing   this exposes you to the risks of data breaches 
and personal security we've all seen headlines   where databases with millions of user records were 
leaked or sold online and sadly this is happening   more and more frequently that's where Incogni the 
sponsor of today's episode comes in Incogni helps   you take control by removing your personal 
data from the databases that brokers rely on   i tried it myself and I was surprised how simple 
it was first you sign up authorize Incogni to act   on your behalf and they send data protection 
low compliance requests to these companies   forcing them to remove your information from their 
databases and the best part you can track every   step of the progress in real time right from 
your dashboard as someone who values privacy   a lot I highly recommend you to try out incogn 
it's a simple way to put an end to unwanted spam   emails robocalls and just keep your data off the 
grid check it out with my link below and use code INTECH thank you Incogni for sponsoring this 
episode now Quantum-X and Spectrum-X chips   are just the beginning and soon co-packaged optics 
will become the new normal and I think in the next   five years this innovation we discussed today will 
enable huge scale out scaling to multi-million   GPUs AI factories and the next potential leap 
can be achieved with new materials for example   replacing silicon in modulators with lithium 
niobate or indium phosphide it's impossible to   remember this stuff and as for where it's all 
headed of course we eventually want to bring   optics within the GPUs themselves for interchiplet 
communication because this will enable the next   big leap in performance and I'm personally a 
little bit obsessed with this topic so when we   had a small group Q&A with Jensen I could not 
let it go I cannot wait to see this happening   in fact many companies like Broadcom and 
startups like Lightmatter and Ayar Labs   are working on bringing this technology to life 
what's even more interesting Lightmatter went one   step further and started working on photonic 
interconnect for 3D packaging this is a topic   for one of the next episodes subscribe 
to the channel to enjoy it in the future   now let's break down the next state-of-the-art AI 
GPU the new Rubin GPU is named after Vera Rubin   the astronomer who found the evidence the key 
evidence for the existence of dark matter and   dark matter as you may know believed to constitute 
over 80% of the universe mass and space is one   more topic which I'm obsessed with the new NVIDIA 
Rubin GPU is a double die design similar to the   Blackwell GPU it will be manufactured by TSMC 
at N3P so 3nm process node and will feature two   compute dies linked by IO chiplets and here we 
expect a huge leap in performance because Rubin   GPU expected to deliver 50 PFLOPs of FP4 compute 
FP4 is a 4-bit floating point precision format   which is becoming so popular and adopted widely 
adopted in AI machine learning workloads because   it allows to reduce memory and power requirements 
and 50 PFLOPs is impressive it's more than triple   the performance of the latest Blackwell B300 GPU 
or five times the performance of the latest AMD MI   accelerator which is roughly 10 PFLOPs now where 
does this boost in performance is coming from   as always part of it comes from the process node 
upgrade as here they moving from N4 to N3 and this   gives a decent improvement in the logic scaling 
and minimal improvement in the memory scaling and   the rest of course comes from the architectural 
upgrades but here NVIDIA hasn't shared enough   details yet i was very privileged to discuss what 
to expect with amazing Shar Narisimhan who is a   Director of Datacenter GPUs at NVIDIA so a lot 
of those improvements we are making architectural   advancements we're not yet at the point to go into 
all of those details some of that benefit comes   from having a much larger NVLink domain so in the 
newest Rubin designs you can see it goes up to 576   GPUs all fully interconnected in a single NVLink 
domain that allows us to have all of these GPUs   talking to each other at very high speeds very low 
latencies so there's innovation on the NVLink side   there's innovation in the silicon design as well 
and you also saw the NVIDIA Dynamo announcement so   we'll continue to make innovation at the libraries 
level and we bring all of this together to deliver   the type of performance improvements that you're 
seeing when it comes to new GPUs Rubin Ultra GPU   was definitely the most interesting announcement 
if we take a look at the Rubin Ultra chip it's   an even larger design here they are moving from 
two GPUs per package to four GPUs per package and   from 144 GPUs per NVLink to 576 GPUs per NVLink 
so they're clearly scaling up before scaling out   the Rubin Ultra features 4 reticle size GPUs 
linked by 2 IO chiplets and co- packaged with   16 high bandwidth memories using COWoS Chip On 
Wafer on Substrate packaging technology from   TSMC and with that they get to well 100 PFLOPs of 
FP4 compute well knowing how much NVIDIA struggled   with Blackwell GPU at the interposer will be very 
interesting to see how NVIDIA and TSMC going to   address all the thermal and power challenges 
that are coming with this Rubin Ultra GPU so   there are many challenges one of the biggest 
challenges that we solved and you first saw   this with the Blackwell architecture is having 
a high bandwidth interface that connects both of   these adjacent die together that interface allows 
us to exchange data at 10 terabytes per second so   it's a very fast movement of data across the die 
and you really want to be in a situation where   that dual die design is actually performing the 
same as a single die so part of that is knowing   intelligently which compute core is going to 
do the processing for the next step in the   calculations of the neural network so we have 
intelligence baked in in our libraries and our   algorithms that allow us to bring data close to 
the adjacent compute cores it's also what we call   cache coherent so you have memory sitting in the 
right data sitting in the right memory location   at the right time just before it's actually 
going to be used in a subsequent calculation   so these present enormous challenges being able to 
have algorithms that allow you to predict what's   the next calculation that's going to take place 
and going and prefetching that data and putting   it in the right spot so that you're wasting very 
little energy in moving that into the appropriate   compute core for that next calculation and 
lastly we also thank our partners at TSMC   who have helped with the manufacturing there 
are obviously significant challenges when it   comes to fabricating and packaging such a large 
die there are many known issues when it comes to   growing dye and they have done an excellent job 
solving all of those so we're very appreciative   of their efforts as well so get ready for huge 
demands for power in fact we've already gotten   used to seeing a massive surge in power densities 
from generation to generation just think about it   one Rubin Ultra rack will consume 600kW of 
power and to cool it down NVIDIA engineered   a special Kyber Rack architecture we are already 
beyond what air cooling can handle and now liquid   cooling is becoming the new standard it's just 
far more efficient and it's directly built into   the rack itself here NVIDIA is using advanced 
cold plates which pull heat directly from the   chip and transfer it to the circulating water 
there are many innovative techniques when it   comes to actually conducting away the heat off 
of the die itself we've now gone to a direct   cooling liquid cooling architecture where we 
have a plate directly on top of the die itself   we've also made a lot of other innovations 
when it comes to liquid cooling that allow   us to bring the entire rack into a very tight 
design like you've already seen in the Blackwell   single rack architecture we're now putting 72 GPUs 
right next to each other in a single rack so it's   innovation in terms of how we pump in the cooling 
mechanism itself bring it being able to bring that   directly on top of the die and removing heat away 
and being very efficient about how we actually   use compute itself in a lot of cases we're 
making more efficient algorithms and processing   for example our transformer engine allows us to 
take calculations that the industry in general   would historically have done in FP8 or FP16 and 
we downcast that all the way down to FP4 that on   its own just saves a lot of memory and compute 
space and so not only are we innovating at the   cooling level where we're introducing liquid 
cooling and making these incredibly dense racks   we're also innovating in terms of the algorithm 
so that you don't have to use the silicon in the   same brute force way as you might have had 
to do before and this is just one of many   upgrades as they're rethinking every layer how 
we build and scale data centers of the future   what's interesting NVIDIA roadmap for the next 
few years is way more than just a list of GPUs   it's a layered plan for building entire AI systems 
at the industrial scale for now there are still   shipping Blackwell GPUs but by the end of 2026 
we will enter Rubin phase and here the GPUs are   also getting the next generation of high band 
memory finally the Feynman generation projected   for 2028 will bring next generation GPU design 
and introduce the eighth generation of NVLink   switch hinting at possible architectural shift 
and here it seems like every layer gets an upgrade   every year so customers have a reason to upgrade 
every year instead of typical 5 year GPU lifespan   AI is becoming a general purpose technology and 
when we talk about the estimate that datacenter CapEx will surpass $1 trillion by 2028 we 
might see that like investing in healthcare   manufacturing finance and energy at the same time 
with the ripple effects touching every aspect of   the economy and society and here companies like 
TSMC NVIDIA Broadcom Marvel Google and OpenAI and   many startups will capture a massive share of this 
outlay what's even more interesting is that NVIDIA   has also turned an eye towards quantum computing 
especially for tasks like simulating molecules or   optimizing complex supply chains where quantum 
approaches may offer a significant edge as a   first step NVIDIA is opening Quantum Research 
Center in Boston and this seems like a long-term   strategy to build a common quantum ecosystem 
and as a first step they will focus on quantum   error correction and working on CUDA libraries 
for quantum algorithms so why are they doing this   quantum computing technology is still in the 
making definitely a couple of breakthroughs   away but their idea is to build an ecosystem 
in advance so when the quantum is ready it can   be seamlessly integrated into existing NVIDIA 
infrastructure without disruption just like   they had it ready right at the beginning of the 
AI boom in my opinion quantum computers will not   replace classical computers but rather complement 
them for particular task and this will require its   tight integration with a GPU based supercomputers 
and this is exactly what NVIDIA is getting ready   for now I want to wrap up this video with some 
of my key takeaways from the GTC conference and   behind the scenes i was lucky to attend GTC in 
person in San Jose and honestly was beyond my   expectations it's one of the most interesting AI 
events I've ever attended and it's very different   from what we used to at technical conferences like 
ISCCC the first thing I want to mention I find it   really beautiful that technology is becoming 
so popular the queue to the keynote was like   seven miles long i love the fact that technology 
is no longer on the background as it's not only   actors and singers but scientists and engineers 
and tech executives like Jensen Huang who are   becoming a new rock stars and inspiring millions 
in fact the GPU business today is not just about   building chips anymore it's about building AI 
infrastructure and the key metric of success   is performance per watt how many tokens you can 
generate per second per watt for your users let   me know your thoughts in the comments and let's 
connect over on LinkedIn I write there two to   three times a week and remember to check out 
the sponsor to support the channel thank you   for watching till the end love you guys very 
tired of talking see you in the next video ciao

---

## 26. The Next Big Thing in Semiconductors
**Channel:** Anastasi In Tech | **Views:** 325K | **Date:** 10 months ago | **Duration:** 24:27 | **ID:** wLLty2GoAuU
**Link:** https://youtube.com/watch?v=wLLty2GoAuU

### Transcript:
modern life runs on semiconductors and TSMC is 
arguably the most important fab in the world it   makes around 90% of the world's most advanced 
chips now TSMC has announced a new technology   that will take us beyond 1nm as a chip designer 
I can tell you this is a big deal for the entire   industry so in this video I will break down the 
genius behind this new technology what is the   next big thing in semiconductors what's going 
on with the TSMC stock price and why we will   rely less on ASML lithography machines in the 
future when TSMC was starting out in 1987 their   first chip was manufactured in 3 micrometers 
technology that's 3,000nm just think about it   and recently they announced that they are ramping 
up the production of 1.6nm technology this means   that over the last 40 years or so they managed 
to make their chips 99.99% smaller and the next   big breakthrough is just around the corner and 
it involves new materials and a cutting-edge  transistor architecture CFET but to truly grasp 
the beauty the genius behind this we must start   with transistors first if we go back up until 
around 2012 the basis for all silicon chips was   so-called Planar transistor and we love Planar 
transistor because this one is very easy to   understand it's just like a tiny electronic switch 
which controls the flow of the current imagine a   pipe with water flowing through it if you place 
a valve in the middle you can turn the water flow   on and off in a similar way transistor controls 
the flow of electric current it has three main   parts source where electric current starts drain 
where the current exits and gate which is used to   control the transistor when you apply voltage to 
the gate it creates an electric field that either   opens or blocks the path between the source and 
the drain so this Planar transistor remained the   state-of-the-art technology for about 50 years but 
when we were approaching the 22nm process scaling   its dimensions further were no longer possible 
what's interesting for a long time we were   reducing the gate length but further reduction 
were causing the channel becoming too thin which   resulted in electron tunneling from the source to 
the drain and that's bad imagine in the example   of the pipe imagine you close the valve but the 
water is still leaking so basically we were not   able to control the transistor anymore and as 
you will see today since then it has become all   about the gate the first step in this evolution 
was to stretch the channel in a kind of Fin and   wrap the gate on three sides of it this new 
architecture was called FinFET and this was a   very elegant solution because the gate wrapped 
around the channel allowed for better control   it which means it could be faster switched on and 
off quickly improving the speed of transistor and   allowing us to pack more of them per silicon area 
these new transistors leaked less power when they   were switched off means devices can run longer 
on a single charge in fact Intel was the first to   manufacture FinFET devices which hit the market in 
2012 at the 22nm process node and one year later   TSMC also moved to FinFET devices in fact today 
almost all high performance electronics including   Apple Silicon NVIDIA and AMD GPUs are manufactured 
in FinFET technology now we are coming to the most   interesting part as of today the limits of FinFET 
architecture has already been reached and now the   industry has to take yet another bold leap in 
transistor architecture now we are entering   the truly 3D era of transistors and remember it's 
all about the gate if you think about it the only   way to shrink the footprint further and get even 
better control of the gate is to control it from   more sides here the genius is in turning the 
channel on its side stacking horizontal nano   sheets instead of standing vertical Fins now 
instead of growing horizontally the nano sheets   are multiplied vertically and this design allows 
the gate to fully wrap around the channel so a   true gate-all-around structure eliminating leakage 
and improving electrostatic control and good news   the first gate-all-around transistors are coming 
in N2 technology is already entering the mass   production and first devices coming to iPhones 
now let's talk tools even though gate-all-around   architecture was an evolutionary step from 
FinFET where TSMC was a decade old leader still   many processes had to be readjusted and here the 
general trend is that from now on EUV lithography machines will be less on the critical path and 
other tools and noble materials will become   more and more increasingly important EUV tools 
essentially create a controlled tiny explosion   inside the machine and use the high energy emitted 
photons to print the finest features on the wafer   and this process is beautiful it's often compared 
to tiny star explosions because there is a similar   process behind it it involves extremely high 
temperature plasma generation similar to what   happens in the Sun if you look at gate-all-around 
architecture the main challenge is to create the   channels and wrap the gate around it especially 
when you can't directly see the underside of the   nano sheets that's where atomic layer deposition 
and epitaxial growth become critical it's crucial   here to precisely deposit gate dielectrics and 
metal gates around these intricate shapes and for   these steps Applied Materials and ASM not ASML 
but ASM own the secret sauce what's more after   the deposition we have to edge away the material 
in between the channels and here lateral etching   tools from LAM research are critical and finally 
we need one more deposition step where the gate   around the channels is formed and here again the 
tools from LAM research and ASM are critical so   this is the elegant solution behind today's 
state-of-the-art gate-all-around transistor   architecture which is mostly about going vertical 
and this will enable shrinking beyond 3nm what's   interesting we had Planar transistor for 50 years 
and then we had FinFET as the state-of-the-art for   a decade how long gate-all-around will last after 
roughly 30 years in the making probably five years   or so just one of many examples where we see 
everything accelerating technological progress   is accelerating as Ray Kurzweil said we won't 
experience 100 years of progress in the 21st   century it will be more like 20,000 years of 
progress at today's rate i totally feel that   do you we all know that AI can help us now to 
create things faster than ever and one of the   most exciting shift is happening in the software 
development what if I tell you that I managed to   create a custom made web app with just one 
click without a single line of code with   Hostinger Horizons you can turn your idea into a 
fully functional web app using AI generated code   no coding no complicated deployment no third-party 
hosting just couple of clicks and you're live here   is how it works simply type your web app concept 
into the AI chat box and watch as the AI instantly   generates the first version of your app and in 
case you need any changes you can quickly tweak   it with AI assistant edits when it's ready you 
can instantly publish your app domain included   what you can do with it in just few clicks 
is mind-blowing so whether you're a founder   an entrepreneur like me or a micro SAS startup 
Hostinger Horizons gives you all-in-one solution   to build and deploy your software on top of this 
Hostinger offers a 30 days money back guarantee   so why not to give it a try use my link in the 
description below and apply my code ANASTASI10   to get 10% off your first month on Hostinger 
Horizons thank you Hostinger for sponsoring   this episode now we discussed the current 
state-of-the-art gate-all-around transistors   and that controlling the gate is crucial and we 
are coming to the most interesting part the next   big thing in semiconductors how can we build even 
smaller and faster transistors what's interesting   TSMC is currently working on two parallel tracks 
horizontal and vertical let's start with a   vertical one so the genius of the new architecture 
lies in details in the new stacking approach   instead of placing transistors side by side the 
new architecture consists of a vertically stacked PMOS transistor on the bottom and NMOS transistor 
on the top and this cuts transistor footprint by   half and keep Moore's Law going and this new 
architecture is called CFET Complimentary FET   Transistor other companies calling it differently 
but the idea is the same the next big thing in   semiconductors is a vertical transistor the bottom 
layer contains a P-type gate-all-around transistor   called PMOS when a negative voltage applied to 
the gate it creates a channel of holes allowing   current flow and the top layer contains 
an N-type nano sheet transistor and here   a positive gate voltage creates an electron 
channel enabling current flow both NMOS and   PMOS nano sheets are surrounded by gate material 
forming a gate-all-around structure the sheets   are typically very thin around few nanometers 
and narrow around 10 to 15 nanometers what's   interesting one of the key persons responsible for 
the CFET development at TSMC is Szuya Liao she is   a director of device architecture pioneering at 
TSMC and she joined TSMC in 2021 after 16 years   working in Intel where she contributed to all the 
latest development from 65nm down to 4nm process   now at TSMC she's pioneering new device 
architectures such as CFET while at the   same time looking into the integration of novel 
materials which we will discuss in a moment her   recent paper describes the first working CFET 
device and it's a pretty remarkable achievement   recently at the latest International Device 
Manufacturing Conference TSMC presented the   first working CFET and they managed to solve the 
interconnect challenge to interconnect the bottom   and upper transistors and it seems that TSMC is 
leading CFET development and being ahead of the   rest of Samsung Intel and even IMEC the main 
challenge with CFET is interconnect complexity   you know interconnect those tiny fine metal lines 
that interconnect all the transistors and other   electronic components on the chip usually it's a 
complex network complex metal network of up to 20   layers that enable data transfer and 
power distribution across a chip and   in modern chips interconnects run mostly in 
horizontal layers across the chip now with   CFET the connections must go vertically which 
again increases the resistance capacitors and   add additional delays slowing the signals down 
and increasing power consumption adding complex   vertical interconnects means more processing 
steps new alignment challenges and potential   defects in wiring and it would probably require 
backside power delivery and potentially even   backside signaling for the PMOS transistor not to 
mention extreme thermal challenges that are coming   with this new architecture already now the high 
performance NVIDIA GPUs generate several hundreds   of W per square cm of silicon and it's projected 
to reach 1 kilowatt per square cm of silicon now   imagine what will happen when we pump 1 kilowatt 
of power into this tiny multi-layer transistor   piece of silicon which is a part of a 3D package 
it's going to be hellishly hot so CFET approach to   scaling is genius but it comes with a whole new 
set of manufacturing challenges more processing   steps higher cost at the moment is expect to 
reach mass production in roughly 2030 and this   will allow us to scale the transistors beyond 
the 1 nanometer node as you saw in the early   days of the transistors innovations were primarily 
focused on geometry but now the focus is shifting   now TSMC is pushing on the development of new 
materials mostly focusing on the 2D materials   with the goal to use them in the channel of the 
transistor you remember early in the video we   discussed the problem which arised when we tried 
to shrink the Planar transistor the gate of the   Planar transistor further this is a limitation of 
silicon that's why researchers are now focused on   other materials to push the performance further 
it turns out that 2D materials are more robust   to the effects causing leakage and much easier to 
control in general TSMC is mostly focusing on TMD   materials i will put them on the screen and these 
materials have the potential to enable atomic thin   channel transistors but those are still mostly 
in the research phase and still quite far from   commercial use and the main reason for that is the 
growing process of 2D materials currently they are   grown on the sapphire wafers and then transferred 
to silicon wafers and this is not scalable for   mass production to enable the mass production we 
have to learn how to grow them directly on silicon   wafers in fact I have about three to four episodes 
on this channel about semiconductor material   innovations covering 2D materials indium selenide 
graphene and other materials so subscribe to the   channel now so you can enjoy them later on another 
big shift worth mentioning in this episode is   towards material innovations and if we look at the 
N2 process node and also all the innovations we   just discussed we see that the trend is that the 
focus is shifting from lithography tools towards   other processes and mostly material innovations 
to be clear EUV lithography tools will be still   important what I mean is they will be less on a 
critical path towards future transistor scaling   over the past few years we talked a lot about EUV 
lithography machines and that's because they were   crucial for transistor scaling and as transistors 
were becoming smaller and smaller the interconnect   which connect all these transistors into 
logic gates all of this had to also scale down   in fact transistor scaling was always outpassing 
the interconnect scaling let's say at 7nm down to   3nm EUV machines were the most critical tool 
for scaling because older DUV machines Deep   Ultraviolet Lithography machines which use longer 
wavelength light compared to EUV machines were   not enough to pattern the finest metal lines 
for the interconnect layers but looking at the   latest process nodes like N2 from TSMC its role is 
decreasing it's decreasing because we are shifting   to CFET architecture which has its own challenges 
and because we are shifting to backside power   delivery which is actually removing the congestion 
of interconnect on the top of the wafer this shift   to backside power delivery is a big change for 
the entire industry because till now all the metal   so signaling and power layers all were placed on 
the top of the wafer now the idea of the backside   power delivery is to offload the power to the 
bottom of the wafer so those metal lines which are   thicker and wider which are used to deliver power 
they will have to go on the other side which will   free up the space on the top of the wafer and 
this means with backside power delivery we can   reduce the number of fine-pitch layers on the top 
of the wafer means fewer exposure steps fewer EUV   masks and lower cost and this is a big advantage 
for going beyond 3nm while EUV tools from ASML   are less on the critical path TSMC remains the 
most critical fab that the entire world depends   on so then what's going on with TSMC stock why it 
has gone about 15% down over the last few months   one of the contributing factors is concerns over 
potential US tariffs on computer chips that could   reach as high as 100% well I think it's a part of 
Trump's strategy to encourage TSMC to build fabs   in the US and this is driving the stock down which 
means shopping time because despite all these   concerns they show strong revenue growth about 43% 
year to year which shows strong robust demand in   silicon chips now consider the high costs required 
to building the cutting edge fabs and also the   costs of constantly upgrading equipment to staying 
on the leading nodes no surprise that more and   more fabs are dropping out from this race you 
know in 2007 we had 12 fabs manufacturing chips   at 45 nanometers and now we have come down to just 
two fabs fabricating silicon in 3 nanometers and   with Samsung and Intel recently struggling with 
yields it's really just TSMC leading the charge   so the role of this company in the modern economy 
is undeniable and a few days ago TSMC announced   their plans to invest another $100 billion dollars 
to expand its semiconductor manufacturing in the   US for once billions are coming in instead 
of other way around that's a change and this   investment will be used to build three additional 
fabs in advanced nodes two packaging facilities   and we know that packaging is so important for the 
advanced GPUs and in general a part of the success   of keeping the Moore's Law going and they will 
also build one R&D lab as you may know they're   already building two advanced chip plants in 
Arizona with the first set to begin production   already this year and the second planned for 2027 
and this is a huge fap it's hard to imagine how   huge it is it's around 1100x in size which is 
roughly equivalent to 650 football fields and   this making this manufacturing facility one of 
the largest semiconductor production sites in   the world anyway I think the costs of TSMC chips 
will go up whether as a results of high tariffs or   higher manufacturing costs in the US let me know 
what you're thinking in the comments as Stephen   Hawking said we are standing on the threshold of 
a brave new world what we do with our discoveries   will shape the future of humanity clearly the next 
decade in technology will be defined by AI and   high performance computing which are demanding 
exponentially more computing power and the key   bottleneck is energy we are currently hitting 
the limits of what our power grids can deliver   and what our cooling systems can handle without 
power efficient transistor technologies our data   centers will hit the power ceiling and clearly 
we need new materials and a breakthrough or two   in semiconductor technology to keep up with AI 
power demands i think it's rather going to be a   complex solution which means noble materials new 
architecture of transistors integrated cooling   technology including also backside power delivery 
chiplet approach with photonic interconnect and   advanced packaging it all has to come together 
let me know what you think in the comments   now check out our sponsors in the description 
below to support the channel and watch this   video where I explain the backside power delivery 
how it works and the secret plan of Intel or this   video where I explain the new photonic chip 
which is on the way to data centers right now   and connect with me on LinkedIn all the links are 
below thank you for watching love you guys ciao

---

## 27. The Truth About Microsoft’s Quantum Breakthrough
**Channel:** Anastasi In Tech | **Views:** 226K | **Date:** 11 months ago | **Duration:** 18:35 | **ID:** di3-i6Z2EIc
**Link:** https://youtube.com/watch?v=di3-i6Z2EIc

### Transcript:
some days ago Microsoft released its new Quantum 
chip Majorana and it has caused a lot of interest   because it's not an average Quantum chip 
Microsoft has created an entirely new state   of matter so-called Topological State that they 
use to perform Quantum computations Microsoft   would rather invent an entirely new state of 
matter than make teams run smoothly in this   video we will break down how this new Quantum chip 
works and is it as big breakthrough as headlines   appear we will also compare it to the recently 
released Google Willow chip and transistor-like   qubit technology from Intel let's have a look 
Microsoft has just introduced Majorana 1 the   first Quantum chip which is powered by a new 
flavor of qubits topological qubits it's called   Majorana because the qubits inside feature these 
special Majorana Particles this exotic Quantum   entities that actually form the foundation 
of Microsoft secret sauce and this is very   interesting because these topological qubits are 
built from a new material topoconductor which is   a combination of a superconductor aluminum and 
a semiconductor indium arsenide and with that   they've created an entirely new state of matter 
called Topological Superconductivity and of course   to achieve this state we need to cool the qubits 
down to near absolute zero and then tune them with   magnetic fields to understand why Microsoft need 
to go to all this hustle we first of all need to   understand the biggest challenge of all modern 
Quantum Computers errors the biggest issue why   the progress with Quantum Computing is relatively 
slow is that unlike classical chips Quantum chips   are extremely sensitive to noise which is why 
we build these huge systems around them that   include cryogenic machine to keep them cool much 
colder than outer space the thing is any noise   any disturbance from the environment like heat 
vibration cosmic rays anything can throw their   calculations off just like me when I used to work 
in an open office space this fragility to noise   often leads to errors in Quantum computations and 
this is one of the biggest challenges preventing   the scaling of Quantum Computers to larger and 
more useful systems currently the largest Quantum   Computing systems run on a few thousand qubits and 
that's still far from making it practical that's   why Microsoft has been working on this new type 
of device topological qubits which are designed   with this scalability in mind and now we at the 
most interesting part let's discuss how this chip   works new topological qubits are made out of super 
conducting nanowires with the quantum information   stored in the two ends of the nanowire first of 
all this new qubit is particularly interesting   because unlike all the other types of qubits 
trapped ions superconducting diamond qubits   photonics they all based on a particle such as 
ion photon or electron while here it's based on a   topological state and the compute is happening 
using this Majorana quasiparticles so here we   have a nanowire and on both sides of it we have 
quantum dots which in practice works as a gate and   a classical transistor it's controlling the flow 
of electrons through the wire when the gate is   open and when we close this gate some of electrons 
are trapped in the wire the number of this trapped   electrons in the wire even or odd define the 
state of the qubit and then we can interconnect   many of such devices together and scale it up 
now these trapped electrons just like in any   other Quantum technology are very sensitive to 
any noise from the environment that's why here   Microsoft is adding special Majorana particles to 
the system because these particles help them to   hide Quantum information because now it stored not 
in a particle but nonlocally in the system look in   this case the information is stored in between two 
ends of a superconducting nanowire which are about   three microns apart and this is exactly what makes 
it resilient this is a simplified explanation of   course just to show the basic idea behind but this 
storage allows qubits to maintain its coherence   over a long period of times and solve the noise 
problem in fact I go more into details on this   Microsoft technology in my older video published 
half a year ago before it became so popular so   if you want to stay ahead of what is next in 
technology subscribe to the channel now this   makes me and my team very happy you I also talked 
to Krysta Svore distinguished engineer and VP at   Microsoft and just brilliant role model of woman 
in tech and she mentioned that topological qubits   promise to be 100 to 1000 times better in terms 
of noise rate with our topological qubits these   are based on a very you know you would say new 
type of physics right so the idea is actually to   create a new phase it's called a Topological Phase 
right when you think of phases of matter you have   you know liquid gas solid we actually engineer a 
new phase of matter in the device it's called a   Topological Phase of matter so this is a very new 
property and really for the first time we were   able to do that and demonstrate that on a number 
of devices last year where we were able to drive   these devices engineer the device and then drive 
it systematically into this new phase of matter so   this Topological Phase and once you're in this 
Topological Phase it's essentially a nanowire   semiconductor superconductor interface but you 
have these nanowires that essentially what you're   doing is controlling these nanowires and driving 
them into this Topological Phase and then what   emerges is the ability to use this as a qubit 
so these topological cubits promise not only   a better starting place in terms of that error 
rate but they also have you know the right speed   of operation so you need qubits that are fast 
enough to do a long computation so speed matters   and then you also need them to be controllable 
right you mentioned noise earlier right qubits   tend to interact with their environment but we 
want them to not do that unless we're interacting   with it right we need to interact and program 
the qubits so we need them to be addressable   in a very efficient manner but we also don't want 
them to interact with the environment and so these   tend to be trade-offs you play with in the qubit 
architecture and the qubit design but topological   qubits have a great property that they only need 
digital control right so we can have a very simple   on/off you know very digital control system for 
topological qubits which makes it a much simpler   task to control say a million at scale Microsoft 
made an impressive progress with Majorana and   according to them this new type of qubits can be 
easily scaled up to millions of qubits I just want   to mention that they haven't done this yet and 
this stunning palm sized chip you see features   8 cubits at the moment and just to give you a 
feeling each device is roughly 10 to 10 microns   in size which if we compare it to the microchip 
world is relatively large later on in the video   we will discuss another transistor like qubit 
technology which is very interesting and which   is in the nanometer range what's interesting 
Microsoft calls this innovation a Transistor   of a Quantum age to showcase the importance like 
the impact the invention of transistors made on   the entire world well to me it's more like the 
transition from bipolar transistors to FETs (Field   Effect Transistors) the idea behind is quite 
similar just slightly different working principle   and might be better scalable let me know your 
thoughts in the comments as you can see Majorana   chip is a fantastic proof of concept that they 
can use and control these new topological qubits   but it's a bit far from turning the world upside 
down and we will have to wait until we see any   commercial benefits of this technology NVIDIA 
is also building a Quantum ecosystem and you   can learn more about it and the future of AI and 
Computing in general at NVIDIA GTC conference if   you never heard of GTC it's one of the biggest and 
most influential AI conferences in the world it's   organized by NVIDIA who is kindly sponsoring this 
episode GTC bringing together leading researchers   and top companies around the world to showcase 
what is next in AI and computing that's why I   will be attending it in person this March and you 
can also join me online for free this year the   GTC program is exceptionally exciting there will 
be sessions held by NVIDIA Meta OpenAI Microsoft   Google and more apart from the keynote of course 
I will be definitely attending this session on   Generative AI Agents held by NVIDIA Microsoft and 
Meta I'm also looking forward to this session on   Physical AI because Physical AI is the next big 
thing and my startup is in this field and of   course you can't miss this session on Quantum 
Computing where NVIDIA CEO Jensen Huang will   host the leading experts from PsiQuantum Alis&Bob 
D-Wave Rigetti and others to discuss the future of   Quantum Computing if you register for GTC right 
now using my link below you get a chance to win   NVIDIA RTX 6000 Ada GPU and to enter you just 
need attend one session except the keynote and   thank you NVIDIA for sponsoring this episode now 
we come to the most fun part Google Willow chip it   was released last December and I remember it very 
well because it was on the day when I was giving   my keynote on the future of computing and I had 
to change my slides last minute because of this   release back then Google had just released their 
105 qubit Quantum chip Willow and this one was   based on a different technology on superconducting 
qubits and I want to briefly discuss it again and   draw some interesting parallels because it also 
got a lot of attention in the media and it was   totally worth it because it solved a 30 years old 
problem in Quantum Computing in error correction   recently I discussed it again with one of my 
friends who is a lead engineer in one of the   top Quantum Computing labs in the world and 
he mentioned that the release of Willow was   a big shake for the entire community because this 
breakthrough in fact benefits the entire industry   with Willow Google showed that as a number 
of qubits increases as we scale it up errors   decrease exponentially and this is a big deal 
for example for 49 qubits they able to achieve   a much lower error rate per cycle than the error 
rate of a single qubit error rates matter because   achieving low error rates is fundamental for 
building practical Quantum Computers and scaling   them up error rate shows us the probability of 
an undesired change in the qubit state typically   caused by noise the best modern Quantum Computing 
systems have error rates down to 0.1% which means   one error occurs every thousand operations just to 
give you the sense of challenge achieving Quantum   supremacy would require the error rate to go down 
to one error per one trillion operations so we   are quite far away and Willow has proved that 
the benefits of error correction outweigh the   additional errors introduced by using more qubits 
just think about it this is huge yeah so it really   can vary right there are many new inventions in 
terms of error correcting codes quantum error   correcting codes and so the numbers continue 
to come down which is great news but right the   challenge here is if you start with a qubit that 
doesn't have as good of physical error rate right   so a physical qubit that doesn't have as good of 
fidelity then you're going to use more physical   qubits to create a good logical qubit and so it's 
quite interesting you know we really do project   that you're going to need upwards of a million 
physical qubits to do a commercially advantageous   if you will right where you you see an improvement 
say in accuracy for a chemistry calculation you're   going to need upwards of a million physical 
qubits which is translating roughly to you   know a thousand or more logical qubits so you're 
looking at you know several thousand physical   qubits in many cases so if you can start at 
a better place meaning say you have one in a   million you only have one fall in a million for 
that physical qubit then you can actually drive   down the cost of error correction and so this 
new type of qubit essentially promises really   great scalability right because it has the right 
speed the right size the right controllability and   its fidelity is much better than other types of 
qubits out there today and so we believe this is   you know a very promising approach to scaling 
up when we talk about the problem of scaling   Quantum Computers to a million qubits or more I 
am the most excited about transistor like qubit   technology or so-called Quantum Dot technology 
pursued by Intel at the moment this qubit   technology is superior to other qubit technologies 
due to its scalability because scalability is   also limited by the size of qubits as discussed 
topological qubits are in the range of 10 microns   which is relatively large while transistor like 
qubits are tiny each qubit is in the range of 15nm  and this is a very exciting approach because 
Intel is building these qubits in our standard   CMOS technology which is also used to manufacture 
NVIDIA GPUs as well as Apple Silicon and I don't   even have to mention the exciting progress 
we were able to achieve with this technology   scaling over the last decades we are now at 
A16 which is 1.6nm equivalent technology it's   already on the way and with this technology we've 
already achieved unbelievable integration fitting   hundreds of billions of transistors into a size of 
a chocolate bar now just think about it if we can   build a Quantum processor based on our standard 
CMOS technology the problem of scaling it to a   million qubits or more is already solved that's 
the beauty of this approach just last week at ICCC   conference Intel shared that they've produced a 
300mm wafer full of transistors like qubits which   is manufactured by Intel in 18a process node when 
you look at Quantum Dot qubit is like a transistor   where you have a gate and you can manipulate its 
potential to isolate a single electron in the   channel and then we encode the quantum information 
in the spin up or down of this electron this is a   very interesting approach because as soon as 
they solve the problem with error correction   and it seems we are getting there they will have a 
million or more qubits in a tiny piece of silicon   beautiful technology at the moment a little bit 
less mature at the system level if we compare it   to the superconducting technology from Google 
and IBM but totally worth keeping an eye on it   as of today it appears that Google and IBM are in 
the lead in Quantum Computing race but Microsoft   is taking a completely different approach here 
at the device level Majorana chip is indeed an   impressive innovation but one may conclude that is 
not as big as headlines make it to appear it looks   still more like a research project but anyway I 
totally enjoy witnessing Quantum Computing field   regaining its momentum again let me know what you 
think in the comments thank you for watching you   know what to do now please share this video with 
your friends and on social media I would really   appreciate it and remember to register for the 
GTC and get a chance to win Ada GPU thank you ciao

---

## 28. DeepSeek: What It Means For The Future Of AI
**Channel:** Anastasi In Tech | **Views:** 404K | **Date:** 11 months ago | **Duration:** 23:04 | **ID:** 2wZng5fqsTo
**Link:** https://youtube.com/watch?v=2wZng5fqsTo

### Transcript:
the release of the Chinese DeepSeek R1 model 
caused a really big splash on the stock market   and this week the discussions around it continued 
meanwhile new models and new Chinese GPUs made   headlines so in this video I want to focus on 
the impact of all of this on the GPU market   and why it's in fact a huge opportunity which may 
not happen again I will also break down some new   very interesting Chinese GPUs that are on the way 
right now so if you want to know where the market   is shifting watch till end in December 2024 the 
Chinese AI company DeepSeek released their V3   based model which was extremely efficient but no 
one paid any attention to it at the end of January   they released the Reasoning Model R1 which they 
claimed achieved comparable performance to Open's   AI 01 and this release just exploded and the first 
reason was due to its Hardware training costs what   many people concluded is that the best NVIDIA GPUs 
may not be needed to make big strides in AI and I   think it's very important to discuss what's going 
on here first of all High-Flyer is a hedge fund   that also founded DeepSeek and High-Flyer used 
to be one of the biggest NVIDIA customers in   the Chinese market purchasing tens of thousands of 
A100 and H100 GPUs so no way they are a threat to   NVIDIA but still this $6 million figure training 
cost made all the headlines because it's very low   compared to Open's AI estimated 100 million for 
a similar model and then we all witnessed how the   media as always messed up the whole story if we 
now look at the bigger picture DeepSeek reportedly   has access to roughly 50,000 GPUs among them are 
older A100 GPUs but mostly different adaptations   of H100 Hopper GPU for the Chinese market among 
them are H800 and H20 versions what's interesting   if we look at the specs H800 GPU almost matches 
the peak performance of H100 GPU you in the most   performance metrics biggest difference is in 
the memory and NVLink bandwidth in practice   this means slower data movement between memory 
and the processing cores as well as in between   GPUs as discussed before by now H800 is also 
not allowed and only H20 is allowed and this   is quite funny because H20 is in fact preferable 
because it has more memory and in 2024 NVIDIA sold   roughly 1 million H20 GPUs to China and the next 
NVIDIA GPU to come to the Chinese market was B20   which is a derivative of B200 Blackwell GPU but 
the exact specs are yet unknown when I saw NVIDIA   stock dropping I was like shopping time because 
long term I think this DeepSeek drama will only   increase the evaluation of NVIDIA straighten 
expert controls and it will all come to the   fact that Chinese companies will have to move to 
the domestic options which are getting better and   better and now we are at the most interesting 
part let's discuss which options do they have   and what is yet to come in fact DeepSeek 
are one reduced requirements on the compute   side open the door to many domestic hardware 
and yes before the restrictions took effect   NVIDIA share on the Chinese market was roughly 
90% but over the last few years Chinese companies   have been working on getting a share of this 
pie including companies like Huawei Alibaba   Moore Threads Biren Tencent Enflame Hygon and 
many more among them the most interesting story   is Huawei their Ascend 910b GPU is the most 
powerful GPU which is designed and manufactured   in China and it's in a very high demand now 
if you look at the official specs its peak   performance at 8bit precision is 512 TeraFLOPs so 
theoretically it has higher FLOPs than NVIDIA H20   GPU and now Huawei is ramping up its R1 model 
on Huawei Cloud which is partially built out of   Ascend 910b GPUs Huawei is challenging Nvidia 
with a new chip for Artificial Intelligence   according to the Wall Street Journal Huawei has 
reportedly told potential clients that the chip   is comparable to NVIDIA's H100 at the same time 
the new Ascend 910c GPU is in development they've   already manufactured the first samples and plan to 
ramp up mass production already this year if you   previously watched this video you know that SMIC 
or SMIC Chinese semiconductor manufacturing giant   is currently struggling with a yield in N+3
process which is roughly at 20% now and this   number is far off from what is typically 
required to bring a product such as this   GPU to mass production if you want to know more 
details on this subscribe to the channel now and   watch this video right after this one now talking 
of 910c GPU is manufactured in N+3 process node   by SMIC which is equivalent to 6nm process by 
TSMC or N6 and it's rumored to be a doubled   die design means doubling the same silicon of 910b 
GPU and this is very interesting for many reasons   first of all because it's following the general 
industry trend of building larger GPUs because   larger chips can handle more data simultaneously 
and it resembles the idea behind the latest NVIDIA   Blackwell GPU where we have two large GPU dies 
which basically contain the core logic and they   are linked by a very fast interconnect bridge and 
through this bridge one die communicates with the  other and every die is surrounded by four memories 
and to package something as complex as this they   are using an advanced Chip on Wafer on Substrate 
L (CoWoS-L Packaging) technology available from   TSMC now manufacturing of this doubled die design 
and this complex packaging is very challenging   because you have to align many many pins and you 
may have heard about NVIDIA delaying the release   and the shipment of their Blackwell GPUs due to 
the manufacturing and thermal challenges now here   the secret sauce is this special packaging and 
huge TSMC experience and they eventually able   to nail it down while this kind of packaging is 
not available at SMIC now this kind of advanced   Packaging Technology is not supported by SMIC in 
fact they are not supporting any of the advanced   Packaging Technologies including CoWoS Packaging 
it will be interesting to see how SMIC going to   handle this or it's done on a single piece of 
silicon so doubled die design on a single piece   of silicon then no doubt they're going to struggle 
with yield as they already struggling with a yield   even for smaller designs let me know what you 
think in the comments in fact Huawei GPUs as well   as many other Chinese Hardware domestic companies 
we will discuss in a moment are all relying on   SMIC fab which first of all has a pretty limited 
capacity often prioritized for Huawei products   and also struggles with yields manufacturing yield 
is a percentage of the chips which is successfully   produced without defects and are usable in the 
final product according to the last available   reports from the end of last here SMIC yield 
in N+2 process node was roughly 30% and this   is a really bad number because this means 70% of 
the produced chips are defective and have to be   scrapped away while the Ascend 910c GPU will be 
done in N+3 process node which means potentially   even lower yield another big challenge for China 
is memory to be self-sufficient they need to   fabricate high bandwidth memory domestically 
and they have no high bandwidth manufacturing   at the moment but ChangXin Memory Technologies and 
Huawei are trying to solve this probably the most   interesting part of Huawei story is that they're 
not just designing their own silicon and building   their own EDA Tools (Electronic Design Automation 
Tools) which support engineers in designing those   chips they are now buying manufacturing equipment 
securing wafer manufacturing memory manufacturing   and basically trying to cover the entire 
supply chain this will help them to achieve   self-sufficiency reduce reliance on SMIC their 
yields their capacity also reduce dependency   on foreign suppliers but we all know that this is 
challenging to achieve because still many critical   technologies and critical tools are relying on 
the foreign suppliers let me know your thought   on this in the comments next we will discuss the 
rest of Chinese domestic GPU market and what's   coming and also tricks which DeepSeek is used and 
why Mark Zuckerberg started it all before this as   you may know I'm building my own startup now so 
I'm traveling a lot meeting investors customers   and when I travel I use public Wi-Fi that 
lacks security controls making it easy for   anyone to access them and potentially steal your 
private data including sensitive information like   login credentials banking details and personal 
messages as we saw recently someone can just   hijack your session and access your accounts 
without needing any credentials and this is   scary that's where Surfshark VPN has been really 
helpful for me it encrypts all the information   sent between your devices and the internet making 
it significantly harder for bad actors to mass   with your personal data the best part Surfshark 
comes with Antivirus and Surfshark Alert which   notifies you immediately if your data has been 
compromised I recommend you to try out Surfshark   VPN it's an easy and affordable way to strengthen 
your online security go to surfshark.com/intech   for 4 extra months of Surfshark thank you 
Surfshark for sponsoring this episode as   you will see now there is no shortage of 
NVIDIA competition in China including many   government-backed startups like Hygon Moore 
Threads Intellifusion a very interesting player   among them is Moore Threads I made quite some 
effort inviting them to the channel not successful   yet but stay tuned Moore Threads is a Chinese 
startup that has been developing gaming and data   center GPUs their latest GPU S4000 is designed 
for AI acceleration in data centers its peak   performance is 200 TeraFLOPs at 8bit precision 
and 100 TeraFLOPs at 16bit precision so it's not   super impressive when we compare it to NVIDIA 
GPUs or Huawei GPUs but it might be just enough   for a model with reduced compute requirements 
by now they've already built multiple computing   clusters with tens of thousands of their GPUs and 
use it for training for example of a 70 billion   parameters Aquila2 model also it supports training 
and fine-tuning of all the mainstream models like   Llama3 and Qwen from Alibaba group and also it 
supports already the distilled version of the   DeepSeek-R1 model now how did DeepSeek manage 
to build a model which requires significantly   less computing resources for both inference and 
training in fact here they implemented several   interesting tricks the main trick is reasoning 
and their clever implementation of the mixture   of experts architecture which allowed to reduce 
GPU computer requirement by 1/3 the idea that the   model is divided into sub-networks so-called 
experts and each of them is trained for the   particular task on the particular data set for 
example one expert focuses on syntax while another   specializes on the semantic meaning just like our 
brain might work in our brain the frontal lobe is   responsible for planning and decision- making 
while the temporal lobe processes auditorial   information and then we have the fusiform face 
area which is great at recognizing faces in a   mixture of expert architecture this is equivalent 
to an expert trained for facial recognition tasks   and then this mixture of experts is connected to 
so-called Gating Network which takes an input and   decides which is the most relevant expert to be 
activated for this particular task and this is   in fact how they manage to significantly reduce 
the computational requirements and this is the   big difference to the Llama3 model which is not 
implementing this mixture of experts architecture   and it's a 405 billion parameters model means 
for each token prediction it activates 405   billion parameters in comparison DeepSeek-V3 has 
roughly 671 billion parameters but for each token   prediction they managed to activate roughly 
40 billion parameters so now just imagine for   each token prediction for each pass forward 
they activate 10 times fewer parameters and   this is where this huge saving in compute is 
coming from this is very clever but it's not   entirely new other AI Labs been implementing it 
as well DeepSeek was just the first to combine   all the tricks and to implement the training 
of this model based on this architecture that   efficiently another trick was training the model 
at 8bit precision from the very beginning when you   use fewer decimals and calculation this helps you 
to reduce training time right computing resources   and memory usage again not entirely new many 
other labs been doing it as well but all these   innovations coming together allowed them to reduce 
GPU resources with that they managed to train a   model which is comparable to Open's AI 01 and 
on many benchmarks similar to Gemini Flash 2.0   which was released just a week before but no one 
put any attention because here are geopolitical aspects play big role the second thing which 
made DeepSeek so attractive is the open source   part they released the open weights which is sort 
of the output of the training data and it's open   source and usable you can download it and modify 
it yourself and the paper is very detailed I will   link it below and this immediately puts pressure 
on OpenAI Claude Google and other AI Labs what I   find interesting here Mark Zuckerberg love him 
or hate him he in fact disrupted the industry   you remember back in 2023 the Llama1 was leaked 
and we all know this sort of leaks right starting   from Llama2 he officially open sourced it and he 
kept doing it ever since what Meta did with Llama   was indeed disruptive and shifted the industry 
and since then DeepSeek was just a matter of time   and Meta's strategy is make LLMs a compliment to 
the Meta's product so Mark basically decided to   make it a commodity and this is a very smart move 
so Meta fully focused on their own core product   keeping users on Instagram and Facebook as long as 
as possible and their products are benefiting from   LLMs while for OpenAI Claude Anthropic LLMs are at 
the core of their main product and business it's a   business strategy whereby you make complements 
of your core business a commodity it appears   counterintuitive but essentially reducing the 
price for a complement typically increases demand   for your core product NVIDIA did exactly the same 
with with CUDA and all the models software around   their core product around GPUs and this driving 
up the value of their core product this whole   story is actually about Google and OpenAI as they 
are clearly in red ocean competing on LLM- -based   products Google released its Deep Research feature 
and AI feature to conduct comprehensive research   on complex topics and weeks later OpenAI released 
Deep Research and called it the same thing so they   directly competing with each other the general 
trend is that LLMs are getting better and better   cheaper and cheaper reducing the gap between 
the free and the paid product and DeepSeek was   inevitable and considering the 6 Tigers Chinese 
Six Tigers there is more to come so where are we   heading with all of this it seems like LLMs are 
are actually becoming a commodity let me know   what you think in the comments if we go back to 
NVIDIA NVIDIA has a pressure but not from DeepSeek   but it's coming from their CUDA mode because it's 
not clear how long it's going to last if you're   not familiar with CUDA CUDA is an entire ecosystem 
that allows AI researchers to program GPU clusters   less as a distributed system and more like one 
giant GPU CUDA is NVIDIA's mode it's something   which is a complement to their Hardware which 
driving the value of Hardware higher and we   don't know how long this mode will last unless 
they reinvent themselves like they're now trying   to do with COSMOS in fact another trick that 
DeepSeek team did is instead of using high level NVIDIA framework for GPU configuration 
they used lower level so assembly like   language PTX (Parallel Thread Execution) to 
reconfigure those GPUs and with that they   managed to improve the data compression and 
decompression and they implemented a bunch of   other tricks with configuration for inter GPU 
communication and this allowed them to further   improve the overall efficiency of the training 
and just remember DeepSeek was highly motivated   to squeeze every bit of performance from those 
GPUs they have access to because long term the   scarce of resources making this maximum GPU 
utilization a necessity in any case longterm   those premium Hardware margins will have to 
go down and it will be getting cheaper and   cheaper and if you believe in this trend of 
throwing more and more compute longterm the   one who can innovate and get access to lots of 
cheap energy will win when we look at China the   cost of energy is lower than in the US about 8 
cents vs 13 cents but looking at their energy   split it's not looking good still like 50% of the 
energy coming from burning coal and oil and it's   very polluting now but looking at this plan 
long-term strategy is to switch to renewables I think long-term this is not about access to 
the semiconductor manufacturing EV tools or   talent it's about access to cheap energy and 
we will need tons of it that's why companies   like Meta are building natural gas plants and the 
next obvious step is nuclear power plants but here   we have to keep in mind how long it takes to build 
one like a decade I'm sure this was just the first   release that got so much attention but there is 
more to come there are many interesting players on   Chinese AI market at the moment the race is 
dominated by Alibaba and ByteDance and then   there are Six Tigers which are considered to be 
leading AI Labs in China and as competition hits   up we can expect more breakthroughs from these 
players as well as strong responses from the   US and EU based AI labs and let's hope for the 
best outcome for the whole world now I'm looking   look forward to reading your comments and if you 
watched that far consider sharing this video with   your friends colleagues and on social media and 
subscribe for more content like this to stay up to   dat with what's next in technology it's free but 
makes me very happy and a little update I'm hiring   a researcher into my team and the description 
is in the description box below have a look and   if you feel like you are a good fit feel free to 
apply thank you see you in the next episode ciao

---

## 29. This Is The Future of AI
**Channel:** Anastasi In Tech | **Views:** 397K | **Date:** 1 year ago | **Duration:** 28:15 | **ID:** 2xE4bopeXhw
**Link:** https://youtube.com/watch?v=2xE4bopeXhw

### Transcript:
over the past few years we witnessed an incredible 
AI Revolution which has been driven by AI chips in   fact the demand for computing power has never 
been higher meanwhile the scaling of classical   computer chips has slowed so what's next while 
Graphine chips Probabilistic Computers and Quantum   Computers are still in the making light based 
computers are already arrived in this episode I will break down a new light-based computer 
chip which is on its way to data center right   now and I can't be more excited about this let 
me shed some light on it Photonic Computers have   been in the making for decades it all started 
60 years ago with the development of optical   fiber for communication and over time we got 
excellent at sending information with light now   if it works so well why not to use light for 
computing in fact researchers have been long   working on building light-based computers 
by now you've likely heard this idea that   light-based computers are faster than digital 
computers because light is traveling way faster   than electrons well it's true and not true at 
the same time let's take any conventional chip   NVIDIA GPU for example during computation there 
is an electron that travels through a copper wire   and this wire acts as a conductor and this is 
how it always works in fact the problem here is   not the speed of electron but the medium itself 
the wire one light travels at 300,000 km/ second   in this case we are talking about mm/ second and 
again here it's not a problem because wire is a   conductor so it's full of electrons so here we can 
reach speeds way faster than mm/ second now you   see we can't simply say that photons are faster 
than electrons it's way more complicated than this   in reality the real reason why digital computers 
are slower than light-based computers because in   digital computers we need to switch from zero to 
one from one and zero and this switching requires   us to charge and discharge a capacitor and this 
takes time and this is where the real slowdown   is coming from I explained this concept much more 
in details in my previous episode on Reversible   Computing a great episode make sure to subscribe 
to the channel right now and watch it right after   this video so by now we understood that the 
real slowdown is coming from this switching   from charging and discharging a capacitor 
which is slow so that's where the light-based   chips save the day because nothing like this is 
happening in the photonic world in photonics we   compute data without stopping it basically we 
are computing as a data is flying by and this   computation on the fly happening in the range of 
femtoseconds which is one quadrillion of a second   so it's very fast the main feature of light is not 
light as itself but the main feature of light is   that you can realize an Analog Computer and this 
is the difference it's not so much the light part  when it comes to the math it's more the analog 
nature of light that you can natively exploit   that's also why we call it Native Computing and 
the main advantage here is that you can carry   out complicated mathematical functions without 
digitalization and that's very interesting in   fact if we want to perform a simple summation on a 
digital chip to add up two numbers we need roughly   200 transistors those tiny devices all the digital 
computer chips are built off so then when we want   to do a square root of this number we need another 
7,000 transistors and then when we want to do a   Fourier transform on this we you need roughly 1 
million transistors so you see the more complex   function you want to implement on a digital chip 
the more devices the more transistors the more   chip area it will take what's so interesting 
when we want to implement a Fourier transform   with light we can do it on a single optical 
device so you get much higher computational   density and you might be wondering how is this 
even possible you know people who are wearing   glasses if you are wearing glasses you are wearing 
every day a Fourier transformator on your nose   and it performs this function using no energy at 
all once you understand this you can use the same   principle to implement such complex operations on 
a light-based chip using special photonic elements   just think about it we can replace 1 million 
devices with just one optical device device   and it's passive so it means light just passing 
through it allowing you to do complex math without   spending any energy at all and the same applies 
for multiply operation where on a digital chip   we need roughly 1,500 transistors on a photonic 
chip we can do it with just one device so we get   much higher computational density that's the 
reason why the interest in light-based chips   is growing at light speed in practice it took many 
decades since this concept of computing with light   emerged till the time when we figured out how to 
actually use it for computing purposes one of the   main challenges is that light is really hard to 
control it tends to spread out and scatter and   it has taken industry really long time but Q.ANT 
has finally built a fully functional commercial   light-based computer their new computer chip 
is called NPU (Native Processing Unit) and   it's powered by light rather than electricity 
we are already shipping first service to high   performance computer centers and we've decided on 
that the first processor generations are coming   on the standard interface of of the CMOS world 
mainly PCI Express and what we actually deliver   to the customer are fully equipped servers 
which are compatible with x86 structures so   in the end you get a server module you plug in the 
ethernet cable you plug in the plug power plug and   the system operates what's even more interesting 
their breakthrough technology relies on a special   material they're using so called lithium niobate 
essentially they deposit a thin layer of lithium   niobate on top of silicon dioxide which sits on 
top of silicon and this particular material is   Q.ANT proprietary technology which is fundamental 
for the success of their computer chip in several   ways first of all it's the only material which 
allowed them to build all the required optical   components in the chip in one material and this 
is fundamental for avoiding losses losses of light   because losses of light results in the drop of 
accuracy in computations so we want to avoid it   at any costs what are the fundamental features 
of lithium niobate well the first thing is that   the modulators so basically whenever you want to 
interact with the light we can realize modulators   that can operate in the gigahertz regime so very 
fast we can realize these modulators that no light   is lost in the modulators and the last thing is 
the switching so in the end at the technological   granularity level what you're doing you're 
changing the refractive index of the material   this can be done only using a voltage and I know 
this sounds super technical but it's elementary   because when you only need to change a voltage 
there is no electricity on the photonic part of   your processor meaning there is no heat there is 
no heat dissipation leing again to a very clean   signal and we already talked about that clean 
signals are fundamental to reach for instance   an 8-bit precision so this is why lithium niobate 
is not just another material it's basically the   fundamental source of success for building 
a Photonic Analog Computer in fact the Q.ANT   chip is the first photonic chip which is able 
to achieve the accuracy of 8-bit precision now   to be honest what striked me the most about Q.ANT 
is that they're having their own fab so they are manufacturing their own chips and basically they 
own the entire pipeline from design to technology   then they manufacture the wafers dice them package 
them write software stack for them that's a lot   of work this is very untypical situation for a 
startup especially owning manufacturing because   this is very assets heavy a question is how this 
upstart start up is managing it all and the most   important why why do they need this fab light 
chips the structure of the light chips are per   physical definition so by the laws of physics 
are pretty large you can't realize a photonic   circuit with a 50 nanometer width because then the 
light would not be guided so in that sense what we   have is we have access to a CMOS foundry an old 
CMOS foundry from the 90s and we repurposed it   with strategic investments of a few tools to 
serve for the production of our own photonic   chips so in that sense yes it's not cheap but in 
comparison to what you need to invest in the CMOS   world it's easy and and this is a big advantage 
to the future as well because think about there   are a lot of outdated CMOS foundries in the 
world which could be repurposed to build high   performing chips for the AI next generation AI 
Supercomputers but using mature technology from   the 90s I mean this on its own is a production 
paradigm shift this is indeed a paradigm shift   very interesting example of turning so to say 
obstacle into opportunity and seeing all the   investments governments are making into the 
photonic technology and into the photonic fabs   and also seeing all tech giants like NVIDIA 
TSMC AMD going all in this fab's might have   bright future let me know your thoughts in the 
comments now before we discuss how this new light-  based chip works what it's capable of and how it 
compares to the state of the art GPUs for example   have you ever wondered how much of your personal 
private data is floating around online your name   address even information about your family members 
unfortunately it all gets out there thanks to the   data brokers that spread this information online 
and this exposes you to risks of data breaches and   of course personal security you've probably heard 
about cases where databases containing information   about millions of users are sold online and sadly 
this is happening more and more frequently that's   where Incogni the sponsor of today's episode comes 
in Incogni helps you remove your personal data   from databases used by data brokers I used Incogni 
to remove my personal data from those databases   and it's surprisingly easy you create an account 
give them permission to act on your your behalf   and they send data protection law compliant 
requests to these companies forcing them to   remove your information from their databases and 
you can even track the progress of these removals   day by day on your dashboard as someone who values 
privacy I highly recommend that you try out and   Incogni and put an end to annoying spam emails 
and calls use my code INTECH at the link below   to get 60% % off an annual plan thank you Incogni 
for sponsoring this episode back to the bright   new world now it's time to discuss applications 
and how it compares to state of the art GPUs and   here honestly I spent quite some time looking into 
specs trying to make apple to apple comparison but   it's really challenging one thing is clear that 
this Analog Photonic approach offers way better   efficiency just think about it there is no wires 
so no resistance no heat generation so these chips   require much less power to operate especially at 
high frequencies and here we are talking roughly   about 30 times better efficiency compared to the 
conventional digital chips now with respect to   scalability I think the fundamental question 
is can we compete with a GPU cluster because   this is in the end what our basically what our 
direct competitor in the present data center is   and to give you a bit outline to the future so 
in two years from now we're going to have Native   Processing Units so processors coming on a PCI 
Express card that have the same performance than   a graphic card in two years on the AI relevant 
functions but on the same side we anticipate that   these systems have a 30x smaller power consumption 
than a graphic card in the future now what does   this mean if you look on a server today you can 
bring eight graphic cards into one server rack and   then you're at the edge of what's being reasonable 
in terms of power consumption we can bring   much more cards into the same space and by that 
increasing the computational density in the server   and since we still have energy budget left we can 
bring much more servers into a server rack and by   this increasing so this is the forecast of today 
and I might be wrong and it's even better tomorrow   but the forecast says that if we equip one of 
those servers and we plug the same electricity   in as they plugin today already we can exceed 
the computational density in the server rack   by a factor of 10 what's even more interesting 
according to Q.ANT their chip is built for both   inference and training of AI models and this is 
very interesting you know typically we distinguish   between two different kind of workloads a more 
simple inference when we have already pre-trained   model we apply new inputs to it and we ask to 
recognize an object an image for example to   recognize a fox and on the hardware level this 
typically reflects into performing many multiply   accumulate operations in parallel and we've 
decided on that we are fully concentrating on the   AI Inference and the AI Training so the layout of 
our chips is always that an a chip can basically   serve both purposes so we can run AI Inferences 
which in the end is fundamentally saying similar   to a vector matrix multiplication and on the AI 
Training we are basically going a different route   because we can in contrast to what training or how 
training is established using a CMOS equivalent   GPU architecture but the chip layout is always 
the same and this is very interesting because in   order to do training we need to constantly update 
the model weights we need to constantly adjust   it to improve its ability to make better more 
accurate predictions and to do this in photonics   might be really challenging as we discussed in the 
beginning of the video in photonics this concept   of capacitance or storing in intermediate results 
does not exist so nothing like in The von Neumann   Architecture where we have this local memory in 
photonics no storage available in fact it works   entirely different here the longer we can make 
the light to propagate through the chip without   stopping it the more we can benefit from the 
properties of light let's say you want to train   a neural network first you encode your weight into 
the phase of light and as the light propagates   through the chip you modify it along the way one 
by one and at the output you get the final value   and only then you convert it back to digital and 
then save it to memory for that the Q.ANT chip   features a small electronic part on top of the 
photonic engine and keep in mind that there is   this special fundamental property of light that 
it can carry a wide range of frequencies within   the electromagnetic spectrum to put it simple 
we can encode many inputs many data at once at   different colors of light and comput it all in 
parallel and this is very attractive when we are   dealing with large data sets like in case of AI 
applications we knew Photonic Computing is new   we know that we very soon understood that this 
technology can really turn the AI world upside   down but on the same side to be allowed to enter 
the ecosystem you need to be compatible with the   electronical interfaces so if we had our own 
proprietary interface there would only be a   minor change that we would be adopted into this 
ecosystem and the second one what was also very   clear from the very moment is that the programmers 
the coders of the world they should not have to   change their source code in order to experience 
the features of our technology at least in the   first instance and this is why we have a whole 
architecture that we call LENA (Light Empowered   Native Arithmetic) and this includes the photonic 
world this includes the electronical world which   in the end is the processor that comes on a PCI 
interface but at the same side we also develop the   drivers the compilers the interpretors that are 
then seamlessly adoptable by the libraries that   are used from all the programmers out there from 
TensorFlor from PyTorch from Keras from ONGs you   name it and in that respect it's the easiest way 
to step into this ecosystem because the customer   doesn't have to change anything to be honest 
I'm really grateful to my channel for this   opportunity to talk to the most visionary people 
out there and this is a very interesting chip and   very interesting startup with a big vision and of 
course there is still a lot of work to be done but   to me it seems like we are closer than ever to the 
light era in computing let me know your thoughts   in the comments and I would love it if you could 
share this video on social media with your friends   and colleagues I would really appreciate it still 
I felt this video wouldn't have been complete   without me mentioning another huge transition 
happening in the industry right now using light   for interconnect and here we are talking about 
interconnecting parts of the chip so chiplets   with photonics as well as moving data between the 
racks in the data center so at the large scale as   we've just discussed light has has a much higher 
bandwidth or if you want a much higher capacity   because here we can access frequencies in the 
terahertz range and that's a lot of course this   attracts a lot of interest from tech giants like 
TSMC NVIDA Intel and AMD recently NVIDIA and TSMC   have announced a collaboration in this space 
they've together developed a silicon photonic-   -based chip prototype interestingly TSMC 
is making this project this innovation a   top priority among all their other R&D projects 
and they call it COUPE which stands for Compact   Universal Photonic Engine this new technology 
will allow TSMC to integrate optical components   closer to the processor course and combine 
multiple electrical chips with with the photonic   engine and fiber optic connections into a 
single package and with these they will come   to more compact and more efficient designs you 
know modern data centers are quite complex and   very generally speaking there are two main parts 
to it computing clusters and networking clusters   so when we train a large neural network we 
need to distribute this workload across the   data center and if we try to fit as much as 
possible into a single cluster and when we   are talking about one of the latest GPT models 
which is roughly two trillion parameters this is   really a challenge the thing is it simply won't 
fit on a single cluster it means we will have   to distribute it across many of them and here 
the efficiency will come down to the wiring   to the wiring between clusters to the networking 
on this channel I talk a lot about computing power   of a single chip or a single GPU but at the scale 
of data center actually networking and wiring   makes a lot of difference for example according 
to Meta about 30 to 50% of a overall elaps time   for AI workload is spent in the network waiting 
for the network just imagine what if we could   replace all this complex networking with photonic 
interconnect startups like Lightmatter and Ayar   Labs are working on solving this problem by 
replacing all these networking switches with   photonics Ayar Labs for example is developing 
a solution that can be applied both to chiplets   and data center networking just last December they 
closed the $155 million funding round that valued   the company at more than 1 billion dollars and 
no surprise that NVIDIA Broadcom AMD and Intel   were among the investors so in summary all we 
discussed today points out to the future where   light will play a pivotal role in computing so 
for the moment we are not focusing on Quantum   Computing if this is the question and it's not 
because I'm not believing in Quantum Computers I believe the future compute ecosystem is going 
to have a multiple chiplet architecture in my   words meaning you're having a CPU you're having 
a GPU you're having NPUs from us and you're also   having QPS Quantum Processing Units but what 
I realized two years ago was that the time to   a commercial product is way faster if we focus 
on these Analog Photonic Computers because we   understood them very well and they're at the 
heart of a Photonic Quantum Computer so the   mathematical operations that we are using on a 
photonic space are not so much different to what   we've been using when we build Quantum Computers 
but for Quantum Computers it's really unclear you   can't predict when you're going to have a system 
that has an economic advantage not a scientific   one we all the time seeing scientific advantages 
with every new system but it's hard to guess when   there's going to be a system on the market 
that has a clear commercial advantage and on   the same side what we realized is that a lot 
of computations that were linked to Quantum   Computers can already very efficiently carry it 
out by using an Analog Computer I think in the   future each of the computing paradigms I cover on 
this channel whether it's Analog Photonic Digital   Probabilistic Quantum or Reversible chips all 
of them will find its own niche application for   example for matrix multiply accumulate operations 
for AI Inference we are likely to use Photonic   engines for Quantum problems we will rely on 
Quantum Computers and for problems that require   high accuracy high precision like banking 
transactions will be still done on our classical   digital chips I hope this video lightened up 
your day let me know and now watch this video   where I explain how computing backwards and 
Reversible Computing works this episode got   a lot of attention and I got a lot of positive 
feedback on this one so check it out or watch   another episode on Probabilistic Computing where 
I explain how we can harness noise for computation   must watch thank you for watching till the end 
and I will see you in the next episode ciao

---

## 30. This New Chip is Defying the Laws of Physics
**Channel:** Anastasi In Tech | **Views:** 307K | **Date:** 1 year ago | **Duration:** 22:02 | **ID:** 2CijJaNEh_Q
**Link:** https://youtube.com/watch?v=2CijJaNEh_Q

### Transcript:
for years we relied on Moore's Law the idea 
that the number of transistors on a chip doubles   approximately every 2 years and it has led to 
exponential growth in computing power powering   the digital revolution up until now however 
this rate is slowing down and we are bumping   into some hard physical limits in this video I 
will break down a new computer chip which will   escape the lab already this year and might break 
through all the limits there are many billions of   personal computers and approximately 100 million 
servers operating worldwide and soon we could   have a cloud for every person with artificial 
intelligence embedded everywhere and this consume   tremendous amount of energy but why physicists 
have been asking this question for a long time   but it wasn't until 1961 when Rolf Landauer at 
IBM discovered a surprising answer information   has a cost each bit of information costs us 
energy and that is tied to the laws of physics   particularly thermodynamics and since then it 
became known as a Landauer Limit which states   that for every operation you perform you need 
to expand a minimum amount of energy in fact   flipping a bit from zero to one costs us 
that much energy at room temperature and   that's an incredibly small number typically 
we should not care but when you're computing   billions or trillions of bits like the latest 
NVIDIA GPU for example it all adds up consuming   lots of energy but what do we get for this energy 
we get information as the output the result of the   operation what's interesting almost 100% of the 
energy in the modern computer chips are dissipated   as heat so essentially wasted now just think for 
a moment what if we could store this energy in   the system and recycle it to reuse it for future 
computations could we build a chip that runs at no   energy at all never heating up and breaking the 
Landauer Limit in the times of Landauer it was   neither possible nor practical however a new chip 
which is coming out this year might break this   limit why do we care about breaking this limit in 
fact for the past 60 years semiconductor industry   was able to exponentially reduce the amount of 
energy spent per bit on each operation because   the transistors we're getting smaller operating 
voltage going down capacitor you need to charge   is getting smaller so you spend less and less 
energy per bit on each operation and that's   beautiful what's happening right now is that 
even though the Landauer Limit is very small   we are getting very close to it right now we are 
just a few orders of magnitude away from it when   you talk to chip designers one of the things that 
you will hear is that oh we are so far away from   Landauer's Limit right and this is true and false 
at the same time because yes we're fairly far away   but with CMOS we're not it's CMOS the problem in 
CMOS we're actually basically we're basically at   the end of the road right and so for us is that 
sure Landauer's Limit is is super far away but   the point is seem it's already finished and so 
what do we do we're going in this gap that is   between 1 Landauer and where we are today right 
and where we can grow reversibly and no one else   can interestingly Landauer himself found that 
actually it's reversibility that places a lower   limit on energy consumption later on my all-time 
favorite Richard Feynman explored this problem in   depth questioning whether it might be possible 
to surpass the Landauer Limit and actually he   concluded that there was no theoretical minimum 
of energy required for computation if in the   process we do not lose the bits of information 
essentially if we don't erase the data and that's   very interesting because for the entire history of 
computing computer chips were built in a way that   we intentionally erase the information when it's 
no longer needed this is the best understood by   an example if we take a simple logic gate which 
all computer chips are constructed from an end   gate for example it's a very simple structure 
that combines two input bits into one output   bit ensuring that multiple conditions are true 
before allowing an action so if both inputs are   true both inputs are one it gives true so one 
and the output if one of the inputs is zero it   gives an output of zero the problem is that all 
modern computers implement so-called irreversible   logic which means once computed you cannot run 
it simply backwards you cannot reproduce the   inputs looking back at the gate if I know that 
I have zero at the output and I try to run the   operation in the reverse I can't reproduce it even 
when I know that the output is zero I'm still not   clear what the input was there are many possible 
combinations of inputs which gives me zero at the   output this kind of logic is irreversible so once 
it's computed it's gone and you can't get it back   and the most important the energy is wasted but 
what if we can build a computer where we don't   waste any information can we then recover this 
energy Landauer himself proved it was possible   he found that the loss of energy was due to the 
destruction of information not from the execution   of operation itself so if we were able to build 
a reversible computer theoretically we could   compute using no energy at all it turns out that 
when you use reversible сomputing you can really   kind of decouple the generation of heat from the 
processing of information and it's difficult to   translate that into kind of terms where we could 
construct logic but when you figure that out it   then allows you to in principle significantly 
reduce the energy dissipation there by the energy   consumption of computing at first it's really hard 
to comprehend just because most of the things we   experience in our lives are irreversible take 
aging for example or when you pour hot coffee in   the mug it spreads heat to the mug right and into 
the air and the coffee is cooling down and it's   irreversible without external intervention and we 
know that from the Second Law of Thermodynamics   which says that the total entropy of the system 
either stays the same or increases never decreases   what is even more interesting that the most 
fundamental laws of physics are reversible   means if you know the state of a closed system 
at some point you can always run it in reverse   and determine its state at any previous moment 
if we take a game of billiards for example if   you film it it would look normal played forward 
or backward because the physics of collisions is   the same so you could easily predict their past or 
their future positions and the same reversibility   holds for Quantum Computing take D-Wave Quantum 
Computer for example Quantum gates are always   reversible couldn't we just apply the same 
principles to Conventional processors 60 years   ago Landauer considered this idea impractical back 
then if we wanted to make computation reversible   we would need to store every input and every 
intermediate result and doing so would quickly   fill up the memory but later on his colleague 
Charles Bennett found another way he thought   what if instead of just storing intermediate 
results in memory once the result is no longer   needed one could just reverse the computation 
this has a huge advantage because in this case   we only need to store the result of the operation 
and one of the inputs and then we can reverse it   back let's get back to our example if we take the 
end gate and add an extra output copying one of   the original inputs then knowing this two values 
we can reverse the operation if I know that the   output is zero and one of the inputs was one 
I'm immediately certain that the second input   was zero with that I can reverse the operation or 
decompute it getting back the energy that was used   in computation of course at the computer level 
it's way more complicated but in principle we   understand now that it is possible to recover 
the operation to reverse the operation but how   does it help us to get back the energy let's have 
a look Vaire is a startup that is building the   first commercial reversible computer this computer 
chip implements reversible logic which we've just   discussed so they took the standard logic gates 
and adjusted them to work in reversible fashion   and typically it's quite a hustle but in this 
case it's good that this is compatible with our   traditional manufacturing process process and of 
course these gates are still take energy to switch   from zero to one but the trick is as long as this 
energy is not dissipated as heat but stored in   the transistor they able to recover it at the 
decomputation step and they're getting close   to it the first prototype is coming out already 
this year it's kind of interesting so normally   reversible computing requires both a forward 
and a backward step this isn't quite necessarily   true so it kind of depends on the paradigm of 
reversible computing you're considering it is the   easiest approach to do reversible computing where 
you compute one step forward and then one step   backwards and this is because you can embed any of 
traditional algorithm that we've already developed   over the last 100 or so years of computing you 
can embed that in a reversible computer by kind   of computing it forwards saving the output and 
then decomputing kind of all of the intermediate   and temporary data that you generated and so kind 
of this allows us to just automatically reversal   anything that we already have and save almost all 
of the energy now let me guess what you thinking   how does computing twice help us to recover the 
energy and it's a good one here they're actually   connecting the logic gates to a resonator through 
the power rails and this is a very interesting   trick yeah we do that by essentially embedding the 
reversible logic circuits in a resonant oscillator   currently it's a lc oscillator consisting of an 
inductor and a capacitor which is a capacitance   of the logic as the energy slashes back and forth 
so to speak between the logic and the resonator   or between different parts of the logic through 
the inductor and the resonator you know only a   small fraction of it is dissipated and so you're 
essentially recovering and recycling most of the   charging energy rather than dissipating it as 
heat so that's kind of the basic principle well   a resonator is a kind of a pendulum that swings 
it oscillates naturally back and forth and it's   just like a swinging pendulum that stars energy 
as it moves in case of this computer chip instead   of a swinging pendulum we have a resonator 
where at the resonance frequency energy is   bouncing back and forth between an inductor 
and a capacitor and if there were no friction   it could bounce there forever on the up swing the 
computation step is performed and the energy goes   to the logic charging the capacitor and on the 
down swing decomputation step is performed and   the energy goes back to the resonator it's 
a very clever way it took me quite some time   to understand this but essentially it comes down 
to basic electronics if your logic gates seem as   a capacitor and you connect an inductor to it 
and you make it to resonate the energy bounce   back and force and if you still haven't gotten it 
just yet yet don't worry just swing through this   part once again of course in reality there will 
be always some energy lost due to the parasitics   the resonator quality device characteristics 
so we will need some energy to make it to   keep going what's interesting there is one more 
trick they're using together with reversibility   they're using so-called Adiabatic Technique 
for bringing the energy to the logic gates   for charging those capacitors this means that 
instead of charging them abruptly they are slowly   ramping up the voltage with controlled current
and this allows to further reduce the energy   consumption it turns out that if you are 
following strictly the rules required for fully   Adiabatic switching it requires the logic to be 
reversible you can't you can't erase information    under that constraint and so when you compute 
some information and then you want to get rid of   it you have to then decompute it by essentially 
doing the opposite of the transformation that   computed that information in the first place and 
so that's the connection to a reversible logic   and with this approach they can theoretically 
achieve energy efficiency gains of more than   three orders of magnitude compared to conventional 
chips eliminate heat dissipation and potentially   break the Landauer Limit and this approach is 
very promising for applications like machine   learning AI inference and in general for building 
low power systems and the most exciting part that   their first prototype is coming out in early 2025 
and I'm looking forward to see the measurement   results of how much energy they're actually able 
to recover in practice and then recycle in the   system and at the same time they are working 
on the next chip which is designed to perform   multiply-accumulate operations for AI influence 
applications right now everyone is recycling zero   right we just need to prove that it's non-zero 
right because the moment that we prove that is   non-zero and that we don't use more energy which 
basically simulation suggest that's the case at   that point we know we open up the entire tech 
tree for rest of computing and then becomes like   an engineering problem right of course when you're 
pioneering a new approach to computing there are   many challenges to solve the first big trade-off 
of this approach is area reversible logic takes   more space on the silicon and the resonator itself 
is quite big it's in micrometer range with so much   effort going into shrinking transistors why would 
we be willing to sacrifice area in this case well   in fact if you take the most powerful NVIDIA GPU 
or an AMD GPU what's happening already now that   the big chunk of logic cannot be computing all 
at once due to the power and thermal constraints   in conventional chips the performance per area 
is not actually limited by the area taken by   individual logic gates it's limited by power 
dissipation constraints right so you know at   least by a factor of 10 or 100 you know you could 
compute much much faster right if it wasn't for   the power dissipation of the gates and there's a 
lot of dark silicon on today's chips  because of   this you can't actually actively run you know 
you can't tile the chip with gates that are   actively switching on every cycle it would just 
overheat and so because of this you know we've   actually got some breathing room to play with you 
know you could afford to spend a little more area   on your gates if you make them more energy 
efficient and you could actually get greater   aggregate throughput per die area and the ongoing 
trends building larger chips vertical integration   stacking chips on top of each other making the 
situation even worse and apart of this of course   many challenges remain the first one has to do 
with the technology and manufacturing building   reversible logic gates and building a high quality 
resonator and then integrating them all together   into a single chip and on top of that they have 
to build the whole software stack for this new   hardware and we know that's a lot of work what's 
making it even more complicated is that typically   reversible computers require reversible algorithms 
and reversible programming but luckily in this   case they manage to hide so to say all the 
reversibility at the circuits level as we get   to more and more advanced reversible computers you 
can generate more reversible algorithms which kind   of do not necessarily require these backward steps 
but for now we can already get a lot of gains just   by adding in this extra backward step without 
really sacrificing performance as I mentioned   in my previous videos I always admire people 
who are pioneering new approaches to computing   because it's a lot of hard work which sometimes 
take a decade but just think about it if we   could build a reversible computer which operates 
adiabatically we could solve the biggest problem   the heat dissipation problem and then we could 
truly go vertical stacking more chiplets on top of   each other building truly 3D chips and this could 
open the whole new era in computing interestingly   there are alternative implementations of 
reversible computers ongoing and one of   the prominent approaches is building reversible 
computers with light and in general computing   with light is a very promising approach and I'm 
working on one big episode about it so make sure   to subscribe not to miss it as the researchers 
are working on a super conducting implementation   of reversible computers and also on the molecular 
implementation using DNA but don't ask me how DNA   Computing works to me the new year is a perfect 
time to develop new skills and take your career   to the next level this video is brought to you 
by Boot.Dev the go-to platform for learning how   to code with Boot.Dev you can master back-end 
development using Python and go in a self-paced   game like manner their platform guides you through 
writing real code combining essential theory with   hands-on projects after all the best way to learn 
programming is by building real world applications   as a computer engineering major I spent years 
coding in C# and C++ but back then I didn't have   an opportunity to learn Python it wasn't until 
I started working as a chip designer I realized   that Python is fundamental essential for scripting 
and beyond and today knowing Python is a must have   skill for anyone in tech so if you're looking to 
take your career to the next level Boot.Dev is   a perfect place to start use my code ANASTASI to 
get 25% off the entire first year if you choose an   annual plan check them out through the link below 
and thank you Boot.Dev for sponsoring this episode

---

## 31. A New Semiconductor That Changes Everything
**Channel:** Anastasi In Tech | **Views:** 294K | **Date:** 1 year ago | **Duration:** 15:45 | **ID:** L3_i-r4Clz4
**Link:** https://youtube.com/watch?v=L3_i-r4Clz4

### Transcript:
researchers have discovered a new type of material 
for the next generation of semiconductors and it   consumes up to a billion times less energy that's 
exciting and I will break it down in this video   for you and I will wrap it up with my list of top 
five technological breakthroughs of 2024 let's see   if this one makes it to the list in 1965 Gordon 
Moore predicted that the number of transistors   per chip will double roughly every 2 years with 
a minimum increase in cost but what's really   been doubling over the last couple of years is the 
number of people saying that Moore's Law is dead   well it's not not by a long shot just a few days 
ago TSMC presented their progress on 2nm devices   that they will be shipping already next year and 
this is one of the most anticipated developments   on the market because it marks a huge milestone 
for the industry which is right now transitioning   from FinFet devices to nanosheet architecture with 
that we get 15% increase in transistor density 30%   improvement in power with a cost per wafer up 
to 50% higher than the wafers in 3nm process   well looking at these numbers Moore's Law is 
not dead but we can definitely see that it's   slowing down with devices reaching its physical 
limits and this is especially the case for memory   technology which is really struggling over the 
last years to make the same leap to overcome   this industry players have been actively looking 
into new materials and new architectures for the   post-silicon era among them are silicon carbide 
graphene gallium nitride carbon nanotubes and of   course other 2D materials like TMD's such 
as molybdenum disulfide at the same time   researchers has been investigating alternative 
technologies like Josephson Junction transistors   for Quantum Computing and Probabilistic Computing 
to photonics to Biological Computing and all of   these technologies I've covered on this channel 
subscribe right now to watch them later on with   all of those promising technologies the 
advancements in materials can give us   huge leaps forward potentially by many orders of 
magnitude and just recently the researchers from   MIT and the University of Pennsylvania School 
of Engineering discovered a new material Indium  Selenide and it turned out to have some very 
interesting properties for semiconductors   it actually has a unique combination of 
ferroelectric and piezoelectric properties   what are those ferroelectric means that it can 
spontaneously polarize so it can generate internal   electrical field without an external charge on the 
opposite side its piezoelectric property allows it   to generate internal charge as a response to 
applied mechanical stress it turns out when   we apply current to it it causes an effect 
similar to what happens during an earthquake   it triggers a chain reaction it begins with 
tiny deformations within the material and then   it spreads further like an avalanche and so the 
combination of these properties it's 2D structure  ferroelectricity and piezoelectricity allows 
us to use this effect for writing information   and storing information in the device one of the 
first applications is in so called phase-change   memory which is considered to be one of the most 
promising memory technologies of the future and   it's called phase-change because it undergoes 
the transition between phases liquid and solid   and it can actually retain the values without 
power supply this memory right now seen as a   potential future replacement for memory that 
can replace both short-term memory RAM as well   as SSD's in your laptops typically such a memory 
device consists of a special glass-like material   which is sandwiched between two electrodes in the 
middle generally it can switch between two states   crystalline where atoms are neatly ordered think 
of the structure of a diamond it makes it strong   and clear and an amorphous state where atoms are 
randomly ordered without a regular pattern which   makes the material more flexible why this memory 
is so interesting because unlike binary memory   which we have nowadays right which you can store 
zeros and ones this memory can record a continuum   values which means it can store any value in 
between zero and one and that's really beneficial   because with that we can do in-memory computing 
basically eliminating the main bottleneck   of the modern computing systems then why this 
technology hasn't reached widespread adaption yet   it turns out so far the way we were recording 
writing values in the memory was sort of heating   and melting techniques which is very energy 
consuming expensive and really hard to scale   that's one of the reasons why this technology 
hasn't reached widespread use yet and guess   what these new devices built of this unique 
material Indium Selenide are solving all these   complications and according to the paper 
require as little as billion times less   power compared to the previous designs we will 
discuss the implications of this in a moment   but before this I want to discuss the technology 
that's already available right now and already   transforming how we work today whether you're a 
small business or a large enterprise AMD Ryzen   PRO processors deliver advanced performance 
to handle your most demanding workloads at the core of the AMD Ryzen PRO processor is 
the cutting edge architecture that integrates   a CPU GPU and the dedicated NPU on a single chip 
enabling up to 1.8 times faster performance for   your favorite AI powered applications and this 
performance is paired with advanced security   features and incredible efficiency AI PCs powered 
by the Ryzen PRO series deliver up to 84% lower   consumption for office workloads giving you the 
freedom to work from anywhere all day long now to   the best part AMD is making it easy right now for 
businesses to see the impact firsthand with their   free loaner program just click the link below to 
test Ryzen PRO laptops for yourself and see the   benefits it can bring to a business now back to 
the innovation these new memory devices based on   this unique material significantly lowering the 
power requirements and could potentially lead to   more efficient universal memory memory which can 
give us the speed of RAM with the storage capacity   of SSD and in general this material opens up 
a possibility of building you more efficient   devices that's all sounds great but there is 
a catch Indium Selenide is a relatively rare   material when we compare it to Silicon because 
Silicon is the second most abundant element on the   Earth after Oxygen and then Indium is relatively 
rare material which will make the production quite   costly and then we actually need to synthesize 
this Indium Selenide and to come to relatively   high yield which is going to be quite complex 
however probably the biggest challenge going to   be its integration with existing systems bringing 
it into the current semiconductor manufacturing   process will be challenging and expensive and 
this will likely take decades of course when   we're talking about new materials sometimes they 
seem too far from hitting the shelves and I get   this comment very often from you why do you 
break down these technologies which will not   end up in my laptop in the next 5 years and I 
don't get that you know for example in case of   Silicon from the time of original experiments in 
the late 40s till the moment when it hit the first   commercially viable more or less useful 
application it took at least two decades   you know great things take a lot of time now 
I'm working in a silicon startup of my own and   it takes a lot of time and I know some people 
who've been working on a particular technology   for like 15 years and no one cared about it for 15 
years just imagine this and eventually they made   it happen and I really admire this perseverance 
because sometimes we are like oh well I tried   for 3 days not working out probably not the best 
idea I believe we can make anything to work unless   you stop that's the mindset that's my message 
to you for 2025 now I want to briefly touch   upon another alternative memory technology which 
can reach adoption in the near future this is so   called Computational Ram (CRAM) very interesting 
innovation it's a memory device that allows us to   perform computations directly inside memory cells 
which dramatically reduce power consumption that's   an in-memory computing approach and it gets its 
efficiency from something called MTJs (Magnetic   Tunnel Junctions) which we touched upon in the 
previous video on Probabilistic Computing make   sure to watch it one of the best episodes on this 
channel this year here an MTJ is a small device   that instead of relying on an electrical charge 
like traditional memory using the spin of its   electrons to store data in one of the recent 
papers researchers demonstrated that when we   use Computational RAM we can perform some of the 
key AI workloads like Matrix Multiplication up to   2500 times more energy efficient and the thing is 
we are already pretty good at manufacturing MTJs   at scale so it's something that we could benefit 
from in the near future for in-memory computing   applications as well as for Probablistic Hardware 
however the efficiency gains here are much lower   compared to the memory technology we discussed in 
the beginning even though this technology may take   decades to get integrated into the real products 
this field is making significant progress and   it's very exciting to watch now I want to wrap up 
this video and this year with my list of top five   most exciting advancements in the semiconductors 
of 2024 first of all of course the first fully   functional Graphene Chip this Graphene chip 
is developed by Georgia Tech and it overcomes   the limitations of transistor technology 
and this development may potentially spark   a new era in electronics second this year we 
saw huge advancements in Photonic Interconnect   and if Photonic chips are still in the early phase 
Photonic interconnect is happening and this is the   next frontier which allows us to build a larger 
GPUs larger ASICs by improving the communication   bandwidth and efficiency between chiplets check 
out Ayar Labs and Lightmatter Solutions third   in 2024 Quantum Computing field seen significant 
progress with a recent release of Google's Quantum   chip Willow which is a big milestone in error 
correction and computational speed I also saw this   reflected in the quantum part of my investment 
portfolio with quantum stocks just skyrocketing   but just keep in mind these are the short-term 
gains and there's a lot of excitement right now   but still Quantum Computing is being useful 
for very specific tasks at the moment next we   saw this year a growing interest in Probabilistic 
Computing it has been really gaining momentum with   the first hardware Platforms in development and 
among startups is Extropic for example this is a   really exciting technology and a very interesting 
computing principle which is very similar to the   idea behind this year's Noble Prize winner in 
physics and I covered this technology as well as   all the other technologies from my list on this 
channel so I will be linking them below in the   description box so you can watch it later finally 
of course AI technology which is penetrating   literally every field out there for example this 
year was huge for physical AI and of course AI   is accelerating the hardware development as well 
as the development of algorithms but at the same   time the progress in hardware right better GPUs 
better ASIC that we are building accelerating the   development of AI interesting cross pollination 
and I bet we're going to see it accelerating even   more next year and it's going to be very exciting 
to watch despite all this progress some aspects   of AI remains not fully understood for example 
we don't know if models like GPT are really able   to understand the meaning behind text and language 
or just mimicking their training data but actually   some of the recent papers published this year 
show that after extensive training models can   really combine and derive a master specific 
knowledge which is not directly derived from the   training data and that's very interesting let me 
know what are your favorite technologies of 2024   in the comments now I want to take a moment to 
thank you for being here this year for watching   my videos for your insightful comments for your 
support for your feedback this community means   the world to me and I try to make today's 
setup a little bit more festive and I want   to wish you a Merry Christmas please try to 
take time for yourself and to recharge over   Christmas period because we all work too much 
and get ready for the next year full of new   exciting technologies which we will be discussing 
on this channel thank you guys love you guys ciao

---

## 32. Next-Gen Computers Are Getting Really Cool
**Channel:** Anastasi In Tech | **Views:** 123K | **Date:** 1 year ago | **Duration:** 11:20 | **ID:** l9Ic0PnJl3c
**Link:** https://youtube.com/watch?v=l9Ic0PnJl3c

### Transcript:
researchers have developed a new type of 
transistor the building block of all modern   electronics this new device is almost 1,000 times 
more energy efficient than classical transistor   and emits almost zero hit personally I'm very 
excited about this innovation because this   new technology could solve some of the biggest 
challenges of the Computing industry today let's   break it down heat is a major problem for all 
modern computer chips whether it's your laptop   or a high performance GPU cluster or a Quantum 
computer heat is a problem since it's limits   the performance and efficiency and efficiency 
is everything the most powerful supercomputer   Frontier achieved the milestone of one exaflop at 
the cost of roughly 21MW of power if we look ahead   in front of us to the next milestone Zettascale 
and assuming that efficiency will roughly double   every 2 years here we would need 500MW of power 
to achieve Zetascale performance now just to give   you a feeling 1GW of power is actually a nuclear 
power plant so every data center would require a   dedicated nuclear power plant it's obvious 
that we need to find the better way here   Quantum Computers face even greater challenge as 
they cannot tolerate heat at all heat destroys the   delicate state of Quantum entanglement this is why 
we built this big intricate systems around them to   keep the Quantum circuits cool so these are big 
complex problems with no easy solution and that's   where this new devices from IBM and SemiQon come 
in SemiQon a Finnish company has developed the   world's first transistor that operates at nearly 
zero heat dissipation it consumes just 0.1% of the   power of traditional transistors and reduces heat 
dissipation by 1,000 times this technology has   implications for more powerful data centers high 
performance сomputing even space grade electronics   and of course in Quantum Computing field and 
what's so interesting here typically when we   talk about orders of magnitude improvement 
and transistor technology it often involves   exotic architecture or exotic materials which is 
actually not the case here these new devices are   based on so-called so SOI CMOS technology 
(Silicon-on-Insulator technology) which is   already widely adapted and used in industries 
like like automotive and wireless this means   these new transistors can be mass produced using 
existing CMOS fabrication plants requiring no new   infrastructure essentially these new devices 
are quite similar to classical transistors   with one key difference they are built using 
an ultra-thin layer of silicon on top of an   insulator whereas traditional transistor 
is constructed on bulk silicon what is so   interesting classical transistors cannot work at 
low temperatures and the biggest problem is that   their performance changes as temperature decreases 
to be specific as temperature goes down we need to   apply higher voltage to switch transistor on 
that's why as temperature changes transistors   cannot function consistently and this is a big 
problem in high performance computing applications   as well as in Quantum devices because in the both 
of these cases having precise control is critical   in their new paper SemiQon team describes how they 
solved this problem with a new cryogenic device   design new transistors can function at extremely 
low temperatures it keeps it cool no matter the   stress before we dive into some exciting research 
from IBM and its impact on the future of computing   I want to discuss the technology that's already 
advancing how we work today AMD Ryzen PRO   processors are already redefining what's possible 
in the modern workplace from small businesses to   enterprise workflows these processors are designed 
to make your workday smoother at the core of the   AMD Ryzen PRO processors is the cutting age 
architecture that integrates the CPU GPU and   a dedicated NPU on a single chip enabling AI 
powered applications performance up to 1.8   times faster directly on your PC without relying 
on external hardware whether you're brainstorming   with your team or using AI powered applications 
editing videos or finalizing your presentation AMD   Ryzen PRO chips deliver an experience that feels 
effortless and this performance is paired with   advanced security features and extreme efficiency 
to put this into perspective AI PC's powered by   the Ryzen PRO series deliver up to 29 hours of 
battery life giving you the freedom to work from   anywhere all day long now to the best part AMD is 
making it easy right now for businesses to see the   impact firsthand with their free loaner program 
just click on the link below to test Ryzen's   PRO laptops for yourself and experience all the 
benefits they can bring to your business now why   does this technology matter and which impact could 
it have first of all as this devices dissipate   almost no heat it means it can dramatically reduce 
the cooling efforts and the cooling costs data   centers worldwide currently spend tens of billions 
of dollars annually on cooling and this figure   continues to rise year to year this technology 
could potentially offer a more sustainable path   forward and eliminate the need for nuclear power 
plants let me know your thoughts in the comments   looking forward to reading it that's actually 
one of the reasons why IBM has been actively   working on cryogenic devices including memory and 
transistors and what they found that that these   devices at lower temperature exhibit better 
features like better performance lower power   consumption and improved reliability recently 
IBM demonstrated the new transistor built for   cryogenic applications they've shown that this new 
device operating at 77K doubled device performance   compared to its performance at room temperature 
this new transistor is built with with nanosheet   architecture which we've touched upon many times 
on this channel here the channel is split into a   stack of thin silicon sheets which are completely 
surrounded by the gate and to make it cryogenic   IBM has integrated dual-metal gates and dipoles 
nanosheet technology is the next step in scaling   down logical devices now when combined with liquid 
nitrogen cooling IBM managed to actually double   the performance if you are enjoying this video as 
much as I do make sure to subscribe to the channel   and turn on notifications not to miss the most 
exciting advancements in the world of technology   thank you of course this device is also a big 
milestone in the development of Quantum computers   these typically operate at very cold temperatures 
close to absolute zero in Quantum computers it's   actually very hard to prevent heat from coming in 
because there is always control electronics which   we use as an interface between the classical 
and Quantum worlds for the communication and   for the control of qubits heat introduced 
by control wires and external electronics   can disrupt the delicate state of qubits and 
throw their calculations off just think about   it as Quantum systems grow larger and larger we 
integrate more qubits means more control wires   so it's getting more challenging to preserve these 
cryogenic temperatures inside these new cryogenic   transistors addressing this challenge because if 
we build control electronics from these cryogenic   transistors we can place it directly inside the 
cryostat which will make it easier to build and   much easier to scale to larger number of qubits 
beyond data centers and Quantum computers these   devices will strive in outer space because they 
will be able to operate reliably at very low cold   temperatures and without any additional heating 
or cooling systems required as exciting as these   developments are they're of course not without a 
challenge first of all it would take quite some   time to bring them from lab to mass production 
and then of course there is a question of   costs because even though these devices are well 
scalable still there are costs involved to build   the cryogenic environment for them in case if it 
goes to Data Centers and then there is adoption   will tech giants be willing to invest in cryogenic 
systems when other energy saving options exist   or maybe they will go on with building nuclear 
power plants this is a complicated tradeoff let me   know your thoughts in the comments despite these 
challenges this is an important milestone and a   glimpse in the future of computing where heat is 
no more a bottleneck for scaling the systems up   and if this technology lives to its promise it 
can transform everything from Quantum computers   to Data Centers if you enjoyed this breakdown 
make sure to give it a like and share it with   your friends colleagues and on social media I 
always see your reposts and this makes me very   happy and I will see you one more time before 
the New Year very soon in the new video ciao

---

## 33. When AI Meets Quantum… Everything Changes
**Channel:** Anastasi In Tech | **Views:** 154K | **Date:** 1 year ago | **Duration:** 15:50 | **ID:** eINcrZGDQD0
**Link:** https://youtube.com/watch?v=eINcrZGDQD0

### Transcript:
as the AI revolution continues to grow and 
reshape our world quantum technology is set   to change everything we know about computing 
now imagine what happens when AI and quantum   join forces as you will see today things are 
getting very accelerated DeepMind recently   proved that they released a new groundbreaking 
AI model that brings practical quantum computers   closer to reality just yesterday I met with a 
DeepMind team to discuss this breakthrough so   in today's video I will explain how it works why 
it's crucial for the future of quantum computing   and 3 potential outcomes of merging these 2 
groundbreaking technologies together quantum   computers have the potential to solve most 
critical computing tasks in just a few hours   or even seconds tasks that would take conventional 
computers billions of years to complete however   unlike classical computers quantum computers 
are extremely sensitive to noise that's why   we build this huge system around it to keep 
them cool even the slightest disturbance from   environment like heat vibration or noise can 
throw their calculations off this often leads   to errors in quantum computations making the 
results of the computations neither reliable   nor useful to address this problem modern 
quantum computing using many different error   correction techniques David Deutsch one of the 
most respected scientists in the field said:   "Without error correction, all information 
processing, and hence all knowledge-creation,   is necessarily bounded. Error correction is the 
beginning of infinity". One of the most popular   methods for error correction is so-called Surface 
Code it's when we use multiple physical qubits   multiple physical quantum bits to encode a value 
of single logical qubit and then these are used   for error detection and error correction and we 
will come back to this in a moment so this method   is very popular and used by tech giants like 
Google and IBM the problem is that even with that   modern state-of-the-art quantum computers roughly 
experiencing 1 error per 1,000 operations but in   order to come to a practical quantum computer that 
can perform complex and long computations we need   to reduce this error rate to just one error in 
one trillion operations as you see we are quite   far away from the goal and it turns out that one 
of the greatest difficulties lies in the decoding   process because noise in the qubits doesn't follow 
any particular patterns but changes dynamically   and unpredictably this is where DeepMind's new AI 
breakthrough AlphaQubit model comes in AlphaQubit   is a neural network that we've trained to act 
as a decoder for these logical qubits and we get   these sort of parity checks that are read out from 
the quantum computer that tell us something about   whether an error has occurred but they occur 
in complex patterns it's like a spell checker   for quantum calculations fixing errors and making 
sure everything adds up to learn general decoding   problem AlphaQubit was first trained on thousands 
of simulated examples from a quantum computer   simulator and then fine-tuned on experimental 
samples from Google's Sycamore quantum computer   which actually once achieved quantum supremacy 
essentially AlphaQubit is addressing one of the   biggest quantum challenges error correction and 
it's used on Google's Sycamore quantum processor   to distinguish whether a qubit when measured at 
the end of the experiment has flipped from the   state it was prepared or not and if yes to fix the 
error essentially what we're doing the analogy in   classical information which is stored in bits is 
we're initializing a bit which is either a zero   or a one and then we're encoding that bit using 
redundancy so maybe instead of just let's say I   was trying to send you a zero or a one I would 
send you three zeros or I send you three ones   and there's some probability that some of those 
bits could flip you receive 001 and now you're   the decoder and you say hey well two of these 
are a zero so I think that Mike was trying to   send me a zero and so you're the decoder in that 
case you're the piece of software that's deciding   what is the bit that I originally sent you I must 
admit I love Mike's explanation because it's very   intuitive that's what I'm trying to do always on 
this channel however from the discussion with the   DeepMind team in reality this decoding process 
for quantum computers is way more complicated   because the code they're used for decoding
here is way more complex than this now how   does it work if the error is actually random as we 
discussed before each logical qubit is represented   by several physical cubits so every microsecond 
we read the states of these physical cubits here   in case of three cubits we read out a 8-bit number 
and feeding it into the neural network the neural   network updates its state to combine these new 
readings with the state that it had before at   each step the state evolves and at the end of the 
experiment the network makes a prediction it will   give you one if it thinks the error occurred 
or zero if it thinks it didn't and on top of   that it gives you the probability of whether the 
error occurred or not let me know your thoughts   in the comments and consider subscribing to 
the channel to stay up to date with the most   exciting and important advancements in the field 
of technology and ideas on how to capitalize on   these advancements before we dive into the results 
of this research and the future of quantum and AI   I want to discuss with you technology that's 
already transforming how we work today AMD Ryzen   Pro processors are redefining of what's possible 
in the modern workplace from small businesses to   enterprise workflows these chips are built to make 
your workday smoother at the core of the AMD Ryzen   Pro processor is a cutting edge architecture that 
integrates the CPU GPU and a dedicated NPU on a   single chip enabling AI powered application 
performance up to 1.8 times faster directly   on your PC without relying on external hardware 
whether you are brainstorming with your team or   using AI powered applications editing videos or 
finalizing a presentation the AMD Ryzen Pro chips   deliver an experience that feels effortless 
and this performance is paired with advanced   security features and extreme efficiency to put 
it into perspective AI PC's powered by the Ryzen   Pro series deliver up to 29 hours of battery life 
giving you the freedom to work from anywhere all   day long now to the best part AMD is making it 
easy right now for businesses to see the impact   firsthand with a free loaner program just click 
the link below to test Ryzen's Pro laptops for   yourself and see the benefits it can bring to your 
business check it out through the link below and   thank you AMD for sponsoring this video now back 
to quantum world according to DeepMind AlphaQubit surpasses all existing decoders in quantum error 
correction they've achieved error correction   accuracy of 98.5% and overall it has reduced 
errors by 30% compared to the best in class   correction methods and that's a critical part 
in enabling quantum computers to perform longer   and more complex computations to enable them to 
tackle most important problems in the fields of   quantum physics quantum chemistry and even quantum 
cryptography these results look fantastic on the   paper however still many challenges remain and 
the first main challenge has to do with speed   typically superconducting quantum processors 
perform millions of consistency checks per   second this means you need to get the data and 
incorporate it into the decoder at this speed   unfortunately at the moment they are still too 
slow for that at least by a factor of 10 despite   the fact that they're already much much faster 
than the best decoders ever invented so that's   their focus at the moment as well as improving 
accuracy to get to as low as one error per one   trillion operations which is essential for the 
next big leap in quantum computing in general   over the last month the field of quantum 
computing is regaining its momentum again   let me know in the comments if you also notice 
this I see that the progress is accelerating and   I think it's happening because of the exchange 
of advancements and ideas between the fields   of AI and quantum computing and this fueling 
advancements in quantum Hardware algorithms   and error correction and here I want to quote 
David Deutsch again because he is brilliant   and I'm a big fan of his work and in general if I 
would have a chance to do fifth degree I would do   physics so here he says: "Quantum computation is 
a distinctively new way of harnessing nature. It   will be the first technology that allows useful 
tasks to be performed in collaboration between   parallel universes". Here he refers to many worlds 
interpretation now what happens when we combine AI   and quantum computing there are three outcomes 
here first of all AI accelerates the progress in   quantum computing which we already see happening 
right now not just with error correction but also   with developing better quantum algorithms like for 
T-Gates for example I see AI and quantum computing   has really complimentary technologies certainly 
AI can enable and assist in the acceleration of   quantum computing which is still a very young 
technology this AlphaQubit is a good example   of this conversely you know quantum computing you 
know one of the major applications is in quantum   chemistry and for quantum chemistry applications 
historically there have always been good classical   methods for handling systems that are kind of 
sufficiently simple for more complicated systems   where you have we call strongly correlated systems 
where like the entanglement is playing a big role   it's a lot harder to study these problems because 
well for the same reason that quantum computers   are hard to simulate now more recently there have 
been advances in AI for these types of quantum   chemistry problems and so things like neural 
network states have really expanded the scope   of what classical AI can do but it's still quite a 
fundamentally hard problem for classical computing   because for some of these strongly correlated 
systems I mean fundamentally they're quantum   mechanical objects and so in order to efficiently 
model a quantum mechanical object some of the most   interesting ones we expect that we will need 
quantum computers and those are the ones that   where you can realize some of this like really 
big real world impact that we expect quantum   computers to have from another perspective we see 
that current AI methods are limited by Hardware   resources and the development in AI is often 
outpacing the advancement in classical Hardware so quantum computing can be a solution to 
this problem and allow us to accelerate the   AI models that will be too large to train on 
a classical Hardware I would say that the two   technologies are very complimentary and there 
are also ways in which quantum computing we   expect to be able to enhance sort of AI as 
well you know some of the people on my team   and with collaborators showed that for certain 
learning tasks about the world around us if you   right the world around us is fundamentally 
quantum mechanical and if you're running   an experiment where you have quantum information
using a quantum computer to learn from that data   can require exponentially fewer samples so it's 
exponentially more efficient than a classical   AI could do at the same time I had a discussion 
with several researchers that it can happen that   AI can potentially take over some of the quantum 
computing applications because AI as we saw it   was brought in folding right it can find certain 
rules and principles and in this way reduce the   scope of the problem to the problem which can 
be solved in a classical machine in my opinion   AI and quantum technologies are definitely 
not in competition but they are synergetic so   when combined then can solve bigger problems 
than either of them can do alone and that's   also supported by big investments from tech 
giants like Google IBM and Amazon and I think   the next big revolution in computing is going 
to be a combination of these two however for   investors these two are sort of in competition 
that's why it's so important to diversify your   portfolio which I discussed in my course now let 
me know your thoughts on mixing AI and quantum   technologies in the comments let's continue 
our discussion there and remember to check out   our sponsor AMD Ryzen Pro processors as you may 
know I'm a big fan of AMD chips so very exciting   partnership for me thank you for your support 
love you guys see you in the next episode ciao

---

## 34. Probabilistic Computers Explained
**Channel:** Anastasi In Tech | **Views:** 297K | **Date:** 1 year ago | **Duration:** 18:45 | **ID:** hJUHrrihzOQ
**Link:** https://youtube.com/watch?v=hJUHrrihzOQ

### Transcript:
analog computers once dominated the world but 
they were complex noisy and inaccurate so in the   early 60s we shifted to digital chips precise 
deterministic and powerful but this technology   is now reaching its physical limits and we are 
actually at the brink of yet another paradigm   shift in computing probabilistic computing or 
some call it thermodynamic computing and this new   technology completely flips the script instead 
of fighting the noise which we've done for the   past 60 years we are now embracing the noise using 
it as a computational resource and this approach   reportedly allows for 100 million times more 
energy efficient computing compared to the best   NVIDIA GPUs as a hardware engineer hearing these 
orders of magnitude make me of course skeptical   at first it seems they've broken something but now 
it all makes sense let me explain modern classical   computers are built out of transistors that are 
deterministic very precise objects they operate   by switching between two states 0 and 1 and 
this binary system powers nearly all modern computational   tasks however the world around us 
is not binary it's governed by probabilistic   rules for example when you want to find the best 
solution out of a large number of solutions like   finding the best route for an Uber or predicting 
weather or financial markets probabilistic   algorithms are far more effective and these are 
very hard and expensive to do on a classical   digital computers also all generative AI tasks 
are probabilistic distributions at the moment we   are trying to solve this probabilistic problems on 
classical computers by forcing a digital computer   to behave as a probabilistic system and to do 
that to simulate this indeterminism requires   a large number of transistors and this is very 
energy draining in addition to being too slow   already in 1982 Richard Feynman suggested that 
rather than forcing traditional computers which   are deterministic to simulate the probabilistic 
nature we need to build a new kind of computer   which itself is probabilistic in which the output 
is not a unique function of the input so about 40   years later researchers from MIT the University 
of California Santa Barbara Stanford and startups   like Normal Computing and Extropic all working 
on building probabilistic computers probabilistic   computing is a very interesting concept first of 
all it brings more uncertainty to our lives like   we don't have enough already but as you will see 
it sort of bridges the gap between classical and   quantum computing because it's able to address a 
subset of quantum problems but at the same same   time working at room temperature and so this tiny 
devices that we will discuss just now they harness   the noise from environment and amplify it and 
this is just mind-blowing to me because with my   experience in first analog and then digital design 
we used all different techniques to fight noise to   get rid of noise and here we are harnessing it 
we embracing it and this actually flips my whole   world around so let me explain how it works the 
foundation of the probabilistic computing is the   Boltzmann law which describes how particles such 
as atoms and molecules distribute themselves in a   system essentially this law states that particles 
are more likely to occupy lower energy states than   higher energy ones it turns out we can harness 
this law to find the most most probable state   for a given system and the answer is found in 
equilibrium the system essentially searches   through many different possible configurations 
similar to how molecules of gas in a box moving   around until they reach the state of equilibrium 
if you don't understand how probabilistic computer   works just yet make sure to stay till the end 
of the video and you will now we all know the   foundation of all modern classical computers 
bits zeros and ones which CPUs and GPUs use   to perform logical operations now on the other 
side of the spectrum is qubit these are quantum   bits which exist in a superposition of 0 and 
1 simultaneously and these are the foundation   of quantum computing in the middle of the 
spectrum is a p-bit so-called probabilistic bit   which is designed to naturally fluctuate between 
two states 0 and 1 in a purely classical non   quanum manner and this oscillation is happening due 
to its thermal energy now the probabilistic bit   and quantum bit are very different but they 
share some similarities you know the p-bit   isn't quantum mechanical but it isn't completely 
classical either because it's this there's this   true randomness and fluctuations built into 
it right so the way the p-bit works is it's   like a coin flip but it changes the probability 
sometimes it will give you all heads sometimes it   will give you 50/50 sometimes it will give you 
all tails so this tunability is very important   because when you connect them you want the system 
to go somewhere here just like quantum bits which   can be built in a different ways p-bit can be 
built in different technologies typically we   are talking about CMOS plus something CMOS plus 
super conductivity CMOS plus magnetism so-called   MGTs and this magnetic memory cells have a 
remarkable property of gathering noise from   environment and very well amplifying this noise so 
they are perfectly naturally unstable from the   very beginning and this allows them to naturally 
fluctuate between 1 and -1 and this is   exactly the property we are looking for for a 
perfect tunable p-bit now how does a probabilistic   computer work here we get a hint from nature from 
physics just like molecules of gas interact in a   box or how our brain works our brain is probably 
the most familiar to you probabilistic machine   which runs 100 trillion parameters neural network 
on just 20W of power this is remarkable and we   would like to get inspiration from here the way 
this computer works is it's you take p-bits and   then you make them you interconnect them so it 
isn't very different from what people might be   familiar from the context of neural networks 
you could view the network of the p-bit as some   kind of a neural network but with usually our 
neural networks are feed forward you know it   goes from left to right like our digital search 
but with p-bits the networks are typically for   most applications there there's feedback I talk to 
Anastasiia Anastasiia talks to me and then this this   network as a whole goes somewhere right it evolves 
it evolves as a function of time a p-bit takes an   input from other p-bits and creates a weighted sum 
which is so common in machine learning based on   the weighted sum we get the probability at the 
output derived from the inputs average and that's   very important property which makes them very 
well-suited for probabilistic algorithms AI and   machine learning tasks what's so interesting this 
computing principle is very similar to the this   year winners of Nobel Prize in physics which 
got it for the Boltzmann machine mathematically   the p-bits model is exactly like this Boltzmann 
machine a neural network that embraces chaos to   solve optimization problems let me know what you 
think about the probabilistic computing in the   comments I love reading your comments and if you 
enjoying this video subscribe to the channel not to   miss the future updates for you it costs nothing 
but for me it means the world now let's dive into   thermodynamic computing it's a new flavor of 
probabilistic computing where where we have   a noisy system that basically harness noise 
as a computational resource to solve problems   this computing approach has been gaining a lot 
of momentum recently you may have heard about   startups Normal Computing and Extropic building a 
thermodynamic computer and many of you messaged me   asking to make a deep dive into this technology so 
enjoy Extropic is a startup building a thermodynamic computer and creating energy-based models 
that perform computation through heat dissipation   as you may have guessed from the name they are 
using the second law of thermodynamics which   states that in a natural process the total entropy 
of an isolated system always increases as we just   discussed before they're using system natural 
tendency to minimize energy as a computer resource   to perform computation as a physical process so 
this is very similar to what we do with   probabilistic systems and like you said you know 
one mode of working is you make the solution of   your problem the equilibrium of some statistical 
system so you started in some non-equilibrium   state as it evolves in time it equilibrates but 
the algorithm designer was clever such that the   equilibrium state is the answer to a problem that 
you wanted to solve in practice Extropic is   using Josephson junctions or so-called JJ's to build 
probabilistic bits that are very fast and these   JJ's consist of two superconductors separated by a 
thin insulating layer and when the energy barrier   is low enough we get fluctuations so with this 
JJ's they create a lot of fast probabilistic bits   they configure it and let it run and it's 
probabilistically explore different states and the   resulting thermodynamic equilibrium is actually 
the solution to the problem it appears that this   computing approach has a whole set of advantages 
for many modern AI computing tasks for example for   diffusion based models like DALL-E 2 which is used 
to generate images by first noising it and then   denoising it and as you may know on a classical 
computer it takes a while you have to wait for it   while according to Extropic they can do it way 
faster on a thermodynamic computer they can even   run transformer models on it Extropic estimates 
that transformers on a thermodynamic computer are   up to 100 million times more energy efficient 
than on a GPU Cloud now understanding this under   understanding the potential of technology and all 
involved technical risks is very challenging that   what I saw working with investors and executives 
over the last year advising them on semiconductor   and AI technologies and now I'm happy to share 
with you the whole strategy in my new course   on semiconductors and AI computing industry which 
is drawing on a decade of my experience there are   7 modules in which I walk you through the 
entire semiconductor value chain how it works in   details we discuss AI chips and alternatives to 
NVIDIA GPUs will it ever be oversupply we will   also discuss exhorting technologies and its 
potential like analog computing neuromorphic   computing probabilistic computing and what 
the future holds beyond silicon if technology   and investing in technology is something you are 
interested in check it out through the link below   the first 50 people to sign up with my code EARLY25 will get 25% off and if you register right now   you get a bonus a guide to AI silicon startups a 
very good one see there of course when I hear 100   million times more energy efficient that's a lot 
but from my discussion with Kerem I understood that   in order to build to emulate one probabilistic bit 
on a classical computer with classical transistors   we need 10,000 transistors for a single bit 
so when we want to get 1 million probabalistic   bits we need 10 billion transistors and then 
there is also energy cost to generating random   numbers so emulating probabilistic bits running 
probabilistic algorithms on a classical computer   is very energy intensive back to Extropic to the 
most interesting part in the video you can see the   cryogenic lap that Extropic uses to fabricate 
and test these devices what's strange at the first   glance this thermodynamic computer resembles a 
lot a quantum computer and of course considering   the background and experience of the founders 
totally makes sense if you want to know what   people are working on check out their experience 
and when you see this footage the first question   which comes to mind is why to cool it down 
if we are harnessing noise right in case of   a quantum computer the reason we have to keep it 
cool because we want to get rid of the thermal   noise which appears at room temperature while in 
a thermodynamic computer we harness noise so why   to cool it down why to make it so complicated if 
theoretically it works at room temperature in this   case it has to do with super conductivity 
which they harness through JJ's for computing   and which occurs only at low temperatures as we 
discussed before there are many ways to build a   probabilistic bed using CMOS technology or magnetic 
memory which is already very well scalable so   choosing here JJ's which rely on super conductivity 
is a hard road to follow especially when when we   think ahead about scaling this system to 1 million 
probabilistic bits in any case I love Extropic's   work I really admire them for pioneering a new 
approach to computing because it's a very hard   job to be the first one you have to solve problems 
no one thought about before like building a whole   software stack for this new hardware ground up we 
discuss these aspects much more in details in my   course what makes me even more thrilled about this 
thermodynamics technology that it seems there is   a way to build this JJ's Josephson junctions in 
CMOS technology which means it's more practical   and more scalable it seems Extropic is also 
looking into this direction and they've already   started working on their new thermo chip here 
an estimation from Extropic of performance of   s such a silicon chip versus the performance 
of a GPU and as you can see they estimate   orders of magnitude less energy consumption 
per sample and time per sample what's very   important clearly probabilistic computers want 
replace our traditional digital computers because   simply there are many applications where we need 
absolute precision like take banking transactions   or heart pacemaker you don't want any uncertainty 
here here we will still rely on traditional   digital computers however for applications where 
probabilistic algorithms have a huge advantage   like in neural networks where the whole set of 
problems have probabilistic nature or simulation   of natural processes for example Monte Carlo 
simulations which is so popular on Wall Street   here I can see that probabilistic computers 
will shine in any case it will take us   quite some time to build the hardware and the 
software stack for it and then to actually in   practice demonstrate probabilistic supremacy 
if you enjoyed this video share it with your   friends colleagues and on social media and if 
you're interested in getting insights into   the semiconductor industry and investing in 
silicon check out my new course and remember   to use the code EARLY25 to get 25% off and to 
get the bonus looking forward to see you ciao

---

## 35. The Secret Plan of IBM
**Channel:** Anastasi In Tech | **Views:** 165K | **Date:** 1 year ago | **Duration:** 15:30 | **ID:** Irmrp-A-W0I
**Link:** https://youtube.com/watch?v=Irmrp-A-W0I

### Transcript:
IBM once dominated the Computing world now clearly something significant is happening as there stock has surged 60% just this year alone and recently IBM announced two new AI chips designed to power the next generation of their mainframe computers in this video we will have a closer look at what's going on at IBM and why this semiconductor chips are are crucial for the company's future IBM is now over 100 years old and it has a legacy of being one of the biggest innovators ever in the history of Technology this company introduced the world to the hard disk drive and then in 1952 to the first commercial mainframe computers IBM reached a new level of innovation with a launch of its first personal computer in 1981 and this IB computer kicked off the mainstream adoption of personal computers sales were better than anyone had expected and IBM PCS quickly dominated the market comprising a market share of 80% but competition was coming other companies started to reverse engineer the original IBM PC and bringing cheaper PCS on the market and all of them were running on Windows over time PC is commoditized and as they commoditized by by 1993 IBM's market share had dropped to just 20% their financial situation was getting worse and worse and eventually IBM gave up on making PCS entirely selling their PC division to Lenova in 2005 one of the reasons why IBM decided to give up the APC business completely is that this is the consumer facing business it means it's highly competitive has got to be low cost so margins are low so this was a huge turning point and IBM decided to shift the focus uh toward their excel at Enterprise Solutions over the years IBM reinvented themselves and now it is a software and consulting company today they are all about Ai and hybrid Cloud Solutions and we will break it down later on in the video because this is super interesting the way to Cloud was not easy again IBM was too late to it while companies like Amazon and Microsoft were building out their Cloud infrastructure in the early 2000s IBM was still heavily focused on its hardware and software businesses as they were clearly too late to make their way into it they acquired red hat in 2019 and back then Red Hat was one of the major players in club Cloud infrastructure this was a very important acquisition because eventually it led IBM to the hybrid Cloud which as we will see doing very well today what's so interesting we all know IBM for their computers but at the moment their main Revenue sources are software and Consulting and this is very interesting because this business model is very different from what Intel for example is focusing on and we will do into that at the end of the video at the same time IBM is putting much of its chips into research more than any other company I had a look and IBM files around 10,000 patents a year which we can break down to about 25 to 30 patents a day they are making lots of research on semiconductors for example and on my channel I discussed many of the recent Innovations for example the 2 nanometer chip which they introduced about a year ago ahead of tsmc and Intel in their fap in Albany New York they've made several breakthroughs in transistor technology including nanet transistors vat transistor which stands for vertical fat transistor these are just a couple of IBM's hundreds of ongoing research projects and I've got videos covering these Innovations make sure to subscribe to the channel right now and turn on notifications not to miss the future updates recently IBM introduced two new chips that also started as a research project but now we'll finally make it into the Mainframe systems you remember at the beginning of the video we talked about IBM's menf frames and they're still making those they call them Z Mainframe platform and these are running transactions for every Bank you can think of in the world now these two new Chips talum 2 and Spire they will be used in the next Generations of IBM's Z mainframe system z17 theum 2 processor is the main processor designed for general purpose Computing and it features dedicated AI course this course enabling additional 24 Australian operations per second to accelerate AI inference tasks this one is particularly useful for cloud-based Ai and we will discuss in a minute why on top of that IBM built a separate AI accelerator chip called Spire this one basically complements the ealum 2 processor giving it additional AI acceleration now before I deep dive into the science behind these chips and what's going on with IBM stock I want to share with you how I keep up with the fast changing events that are happening in the world it can be really overwhelming but it doesn't have to be in a world where media bias is common knowing what's true is more important than ever that's why having access to unbiased reliable news is a GameChanger I've spent countless hours researching and I do get how easy it is to get influenced by bias journalism if you're not careful the sponsor of today's video straight error news is solving this problem they provide unbiased straightforward reporting on the most important National and Global events so you can stay informed with a clear unbiased view of what's really going on their media landscape indicator reveals where news outlets fall on the political Spectrum helping you understand political biases and make more informed decisions about the information you consume and their media M section uncovers stories other sources may have missed and the best part about it it's completely free and easy to use so if you want more control over the information you consume check out straight error news through the link below back to IBM what is so interesting about this fire chip that it's an AI Asic which means basically the entire area of the chip is dedicated for Matrix multiply accumulate operations Essen entally it does just one thing run a pre-trained neural network model and make predictions for tasks like language processing or image recognition why we love a good Asic because if we can build in the algorithm in the circuits level not as a software algorithm but really implemented on Silicon we get a huge gain in speed and efficiency just to give you a feeling if we compare it to a GPU a dedicated AC can boost your speed by a factor of 10 to 100 that's why everyone around is building AI as6 nowadays the SP chip is an AI as6 build of 26 billon transistors it features 32 cores and 2 megab of memory per core both THM 2 Inspire chips are manufactured using Samsung 5 nanometer process technology and they're expected to be available in 2025 this chips will be used as a part of the IBM's Mainframe systems in the hybrid Cloud for inference AI workloads they handle massive transaction volume in the finance sector for example we are talking here about 300 billion AI inference operations per day so essentially this chips are IBM's investment in providing better infrastructure for the clients and now IBM team is looking to move Beyond just inference and to use Mainframe systems for fine-tuning and even eventually training the models so what's been happening with the IBM stock recently this is really tricky because they are now doing so many things that it's really hard to get a grasp on where this is coming from basically IBM operates four business segments software Consulting infrastructure and financing here you can see IBM's Revenue split software accounts for 43% this includes a large software stack for Enterprise which includes hybrid cloud data and AI automation transaction processing and security this IBM segment is the largest and the most profitable it showed strong growth this year and it was up 7% in the last quarter one of their most profitable business divisions is the hybrid Cloud for Enterprises basically it's a Computing environment where you have a combination of both a private Cloud which is exclusive for organization where you can keep your sensitive data and then a public Cloud which is available to everyone and easily extendable and roughly 70% of the entire world's transactions are run exactly through this IBM's hybrid Cloud the second huge part of Revenue 32% comes from consulting services and that's very interesting to get there in 2012 IBM acquired PWC Consulting significantly expanding their Consulting capabilities and Workforce and this acquisition strengthened their position in the Consulting space and today IBM's Consulting segment is doing exceptionally well essentially IBM advis customers on how to improve their business by applying technology and then they are implementing this solution using its own infrastructure and maintaining it at the same time IBM has other customers to whom they provide infrastructure as a service infrastructure Revenue accounted for 24% in 2023 and this year it has been showing strong growth another big focus of IBM right now is on AI they're developing their Watson platform which is using natural language processing to analyze data and make predictions and provide insights so companies can make better decisions and this is something we all need right better decisions and again it's subscription based model so clients can access Watson through the cloud and clients are ranging from Health Care to customer service to finances what we can conclude here looking at the bigger picture if we compare IBM for example to Legacy chip makers like Intel who is focusing on developing Hardware chips transistor technology IBM's revenue streams are more Diversified and when you're working on software and services Visa as Capital intensive and you can get higher margins many of IBM's offerings are subscription based like there software products and cloud services so this means it's reoccurring and predictable Revenue stream compared to situations where you rely on the sales to the customer still at the same time IBM owns the entire technology stack from the hardware the IBM Power Systems and Mainframe systems to the software to the cloud management tools the only thing they don't do they don't manufacture their own chips but also this is Mak sense because it's a very Capital intensive thing IBM is making significant strides in the AI space and their earnings beating estimates all of these factors plus what we discussed before contributed to the recent performance of IBM's stock price let me know know what you think about IBM and the new chips in the comments I love to read your comments I think I going to hold on my couple years old IBM stock for now what's interesting IBM is also invested in Quantum Computing they've launched Quantum system to a Quantum Centric super computer which incorporates classical Computing with Quantum processing the idea is to eventually get the best of both worlds to compensate for the fragility and errors of the quantum world with the error correction on classical machines IBM plans to scale up this system to 100,000 cubits in this decade and use Watson AI to write Quantum algorithms for this system I'm actually looking forward to the moment with such a superc computer with a Quantum processor at the heart will make it to the top 500 superc computers list this would be exciting IBM's research work is beautiful and I believe they will continue Innovations and as a company that once developed the first PC maybe they will be the first to develop the quantum PC let me know what you think and I would really appreciate if you share this video with your friends and on social media if you enjoyed this video and pretty sure you're going to enjoy my recent paper you can download it for free through the link below there on seven pages I explain how the semiconductor value chain works the key players and the key trends for the next decade you can download it for free the links you can find in the description below and connect with me on LinkedIn I will put the QR code here and also the link will be below and I will see you in the next video ciao h

---

## 36. How AI Designs Computer Chips
**Channel:** Anastasi In Tech | **Views:** 117K | **Date:** 1 year ago | **Duration:** 11:37 | **ID:** WeYM3dn_XvM
**Link:** https://youtube.com/watch?v=WeYM3dn_XvM

### Transcript:
AI is gradually making its way into every 
industry and now it's reshaping computer   chip design Google's DeepMind announced the 
major breakthrough in AI driven chip design   with its new AlphaChip according to the paper 
AlphaChip is compressing month of work into hours   and eventually generating better chip designs 
this sounds huge if true let's take a look for   nearly a decade I was deep into designing silicon 
chips picture this billions of transistors placed   on a tiny piece of silicon all connected by 30 
miles of wires literally solving this is like   building a very complex puzzle where every 
single piece has to fit perfectly to make it   work and nowadays it's hard to imagine that 
back in ' 70s this job was done by hand back   then circuits were literally drawn on a piece of 
paper but as designs were getting more complex   featuring more transistors and more 
interconnects chip makers started to   develop software tools to do their job as of 
today no one is placing and interconnecting   billions of cells by hand anymore these days we 
used so-called EDA Electronic Design Automation   Tools for that these tools are really great 
at automating many aspects of the chip design   flow they run lots of math on the background 
to find a way to place billions of transistors and interconnect them in the most efficient 
way and the top players in the EDA market   are Synopsys and Cadence I own their stock and 
they play a critical role in the semiconductor   value chain and you can see that from the 
semiconductor cheat sheet I created for you   you can download it for free it will be linked 
in the description below enjoy it Synopsys and   Cadence tools are essential without these tools 
the most advanced chips today like NVIDIA GPUs   or Apple a A-Silicon would not have been 
possible however as technology scales with   chip makers like NVIDIA and AMD now working on 2nm and even 16-angstrom designs the complexity 
of chip layouts is increasing for the most   advanced process nodes the placement interconnect 
is getting even more complex and we are facing new   thermal challenges power delivery becoming more 
problematic and solving all of these issues takes   a lot of time and iterations and sometimes it can 
take many weeks or even months the main problem   here that when we are talking about placing for 
example 100 million cells on a tiny area first   we need to evaluate a huge number of possible 
placement options to find the optimum one and   when we look at it as at a game chip design game 
is very complex it exceeds 10 in the power of   billions or even trillions possible configurations 
so how we can quickly find the best one to solve   this riddle Google introduced AlphaChip an AI tool 
designed to accelerate and optimize chip layouts   here they are applying reinforcement learning 
to chip design and their new paper highlights   the success of this approach it turns out that 
AlphaChip can explore these huge design spaces   much faster than a human designer can no surprise 
right and even faster than EDA tools now let's   dive deep into how it works similar to AlphaGo and 
AlphaZero that mastered the game of Go and chess   AlphaChip approaches chip floor planning stage as 
a kind of a game essentially chip floor planning   is framed as a sequential decision-making game 
the game starts with an empty grid representing   the chip area during the game the agent places one 
block after another and when it's done placing all   the cells and blocks it then rewarded based 
on the quality of this placement and here it   takes into consideration different metrics like 
the length of the wire interconnect we discussed   before and shorter is better than area performance 
and power and based on this metric the AI is being   rewarded for good layouts and getting penalties 
for the suboptimal ones and it improves through   practice by designing thousands of layouts it's 
been trained on tens of thousands of layouts   and it's getting better at each iterations as we 
humans do and already now it's being used across   different industries from data center chips 
to mobile chips and this helps to reduce time   to market and also costs but before we deep dive 
into the results and the impact of this research   this video is brought to you by Skillshare
Skillshare is the largest online learning   community offering thousands of classes led by 
industry experts these classes range from computer   science programming and electrical engineering 
to AI Innovation and business for me fall is a   season of new beginnings where I feel especially 
motivated to focus on learning and I'm using   Skillshare to work on my business management 
and communication skills as I lead several   companies now I need a better understanding on 
how financial reporting works so I'm taking a   class on accounting led by Matt Cooper CEO of 
Skillshare and it's been really helpful for me   I'm also working on improving my communication 
skills which are so essential for both personal   and professional growth and I'm taking a class on 
communication skills led by professor Alex Lyon   and I love it and I wish everyone could watch it 
he explains how to become a more clear and more   concise communicator and how to develop that crisp 
and confident sound that sets great leaders apart   I will leave a link in the description below make 
sure to check it out the first 500 people to use   my link will receive a one month free trial of 
Skillshare computer chips have fuelled remarkable   progress in artificial intelligence and now AI 
wants to return the favour by making better chips   what's so interesting AlphaChip is already being 
used for many real world designs starting from   Google's AI chip so-called TPU Tensor Processing 
Unit it was used in the last 3 designs and to   their new Axion processor which is data center 
arm-based CPU Mediatek also used AlphaChip to   design their 5G modem chip used in Samsung mobile 
phones so you see it's really penetrating the chip   design industry according to the paper AlphaChip 
can generate better computer chip designs in just   a few hours process that used to take humans 
weeks or even months and it's managed to   reduce wire length by 6% compared to the designs 
done by human experts shorter wire length means   more compact designs smaller form factor and also 
faster signal propagation means faster performing   chips on this graph you can see the overall trend 
that is getting better and better at it through   continual practice it's important to keep in mind 
that AlphaChip focuses on the layout optimization   phase which is critical but very small substep 
in the flow of implementing circuits into layout   this is just to give you a feeling that this 
is just one of the small substeps in the chip   design flow and AlphaChip is not able to design 
a chip from scratch not even close to be honest   we are so far from that that the light from the 
finish line hasn't reached us yet what I can tell   you for sure there is a lot of potential here and 
what's beautiful DeepMind team open sourced this   approach and made it available to everyone across 
the community and this is sparking an entire new   wave of innovation beyond layout in the RTL coding 
synthesis timing sign off all the other stages and   beyond when I attended the Hot Chip conference 
at Stanford University there were talks about   AI chips and then AI in chip design with a looming 
question will AI elevate or replace Hardware   Engineers and the answer is both in general we 
can break it down to 2 main approaches of AI being   used in chip design LLM-based and reinforcement 
learning based the first one LLM-based is   leveraging large language models which are trained 
on a vast amount of design data and documentation   it's basically using natural language processing 
to understand design requirements and constraints   and eventually it's able to generate RTL code 
verification test benches and just assist a   human designer throughout the chip design process 
NVIDIA for example uses LLMs to assist engineers   with answering technical questions debugging 
design issues and more they've also deployed   AI agents for tasks like timing optimization 
report analysis and layout generation and the   second example is reinforcement learning based 
AI the one we discussed today AlphaChip is a   prominent example of it this approach treats chip 
design as a complex optimization problem where   AI agent learns through trial and error the major 
EDA players are already bringing such AI features   to EDA tools Synopsys for example already have 
a tool with similar capabilities to AlphaChip   it's called DSO.ai Design Space Optimization AI 
and from my conversation with Synopsys executives   this tool has already been used in more than 
thousand productive chip design tape-outs and in some cases it helped to shorten design 
cycle from 2 years to just 1 year this is   impressive and when we look at it these both 
methods LLM-based and reinforcement learning   based they kind of serve the same goal either 
speed up time to market speed up the design time   or use the same amount of time but come up with a 
better design and this has significant potential   with time it will penetrate more and more phases 
of chip design and eventually enable end-to-end   co-optimization of hardware software and machine 
learning models it's an exciting time we live in   let me know what you think in the comments I love 
to read your comments and remember to check out   the cheat sheet on the semiconductor value 
chain which I prepared for you to celebrate   200K subscribers on this channel thank you 
very much for being a part of this community   this means the world to me and if you are not 
subscribed yet consider subscribing on this   channel I break down the complexity and showcase 
the beauty of semiconductors and AI and underlying   technologies and if you know someone who is eager 
to stay up to date with the latest advancements in   tech share this channel thank you very much 
and I will see you in the next video ciao

---

## 37. Why the Future Is Glass
**Channel:** Anastasi In Tech | **Views:** 190K | **Date:** 1 year ago | **Duration:** 14:46 | **ID:** eOjmTExBWPE
**Link:** https://youtube.com/watch?v=eOjmTExBWPE

### Transcript:
the next generation of chips will be made 
out of glass and this will spark a new era   in electronics TSMC is already actively working 
on this technology which is driven by demand   from NVIDIA and Apple Intel has already a fully 
functional glass chip prototype and this goes   on top of a lot of exciting research published 
on this topic I'm very excited to see another   semiconductor revolution coming so why glass 
and why now if you take any chip you can't have   one without a substrate for example AMD's MI300 
AI chip is built of certain pieces of silicon   that behave as one single chip and they are 
all integrated on top of this beautiful green   substrate its function is to redistribute the 
signal so chip can communicate electronically   with the motherboard over the last 20 years 
this substrate was primarily made of organic   materials or plastics and it's quite cheap so 
it became an industry standard and the biggest   material shift in the semiconductor industry 
over the next decade or even more is going to   be the replacement of this substrate with glass 
but why glass actually driven by the demand for   AI acceleration and high performance computing 
we are shifting towards larger and larger chips   and stuffing more and more chips in a single 
package today we use 2,5D and 3D packaging   technologies but 4D 5D 5,5D packaging is on the 
way at the current pace the existing technology   is expected to run out of steam already in 
the second half of this decade so all the   key players are already transitioning towards 
glass but why glass actually glass has some   great physical properties first of all because 
glass is rigid we can build a bigger designs   with that we can build a more stable substrate 
for larger chips over 100x100 mm in size and   with glass we avoid distortion or bending of any 
kind so with glass we can package more chiplets together and increase transistor per area ratio 
for example in one of the recent papers Georgia   Tech showed case how the mountain 60 chips on 
a glass substrate and it's about 4 times more   of what's possible with a current TSMC 
CoWoS packaging technology so the first   adopters of glass are going to be of course high 
performance chips those that are AI accelerators   and chips for data servers and there is a lot 
of exciting research ongoing in this field for   example in one of the recent paper researchers 
from Georgia Tech and Meta designed a chip where   they used glass to integrate logic and memory 
chiplets in a 5,5D system so 5,5D packaging that's   interesting right 5,5D is a novel concept that 
combines 2,5d and 3D stacking and this work showed   that using glass instead of silicon or organic 
materials provided huge improvements in area power   and signal integrity and we will talk more about 
this later in the video another big advantage that   we know very well how to handle glass so we can 
manufacture it to be very flat very thin and very   smooth and this is essential for photolithography 
photolithography is one of the key steps in the   cheap manufacturing process and it's used to 
create very tiny patterns on a wafer basically   with that we transfer integrated circuits design 
on a wafer and this requires a very flat substrate   to start with the problem is that an organic 
substrate doesn't have this lattice structure like   semiconductor so if you look very close at it it's 
like this and this non-uniform structure affects   of course a lot the precision of lithography 
and in general the signal propagation so when   we transition to glass we can achieve more precise 
lithography with finer feature patterning because   it's perfectly flat and smooth and this will 
allow us to place components closer together for   any given size and in this case we can uniformly 
expose the entire wafer so it gets less defects   and better costs and this is essential for the 
continuation of the Moore's law if you are not   convinced yet I have another great property 
of glass for you it has a very low dielectric   constant and dielectric constant shows how well 
a material can store electrical energy so the low   electric constant of glass shows that it's not 
good at storing energy and it's perfectly makes   sense right it's a glass but why do we care we 
care because of so-called RC Time Constant which   is essential it has a huge impact on how fast that 
ship can work in the RC Content - C depends on   the material on its dielectric constant so glass 
having a low dielectric constant means that less   energy spent on the parasitics so all in all it 
allows for faster signal propagation and higher   frequencies and we love that now when it comes to 
glass chips those are typically manufactured as   at rectangular wafers 650x650mm in size so quite 
big wafers they come in rectangular shape from the   very beginning because a molten glass is formed 
into thin rectangular sheets and then remained   in this shapes throughout the manufacturing 
process but actually doesn't make really any   to compare these two technologies silicon wafers 
circle in the round shape right and rectangle   wafers but I just wanted to mention that with a 
rectangle wafers we get more chips and less waste   of course transition to glass will require the 
majority of assembly line equipment to be replaced   and this requires substantial investment now when 
we're looking from the perspective of consumers   to us of course the most exciting property is 
transparency finally companies are offering   more transparency to us and the semiconductor 
business is becoming a clear cut of course it   would be very exciting to look at this nanometer 
world through the glass right I definitely say   yes to this I actually tried to open up one of 
the AMD Ryzen chips but it turned out to be a   flip chip so I messed it up which you will see in 
one of the next videos so make sure to subscribe   to the channel not to miss it and leave me a 
comment below what do you think about the Glass   Technology I love reading your comments in reality 
glass wafers doesn't mean that the chip will be   transparent unfortunately but I totally love this 
idea another huge advantage of glass it's thermal   stability it has a very low coefficient of thermal 
expansion at least five times lower than organic   materials it's just better at managing heat and 
it remains stable with temperatures typically up   to 600° C and thermal management is one of the 
biggest challenges for the modern GPUs AI GPUs   and AI chips so glass is a potentially amazing 
solution to this problem you know when a chip is   working when it's processing data a current flows 
through its tiny circuits creating resistance and   this resistance turns some of the electric energy 
into heat so the chip is heating up and the more   data it's processes the hotter gets so this is 
a huge problem for the AI accelerators and GPUs   because it's crunch a lot of data non-stop so when 
it gets too hot the organic substrates start to   degrade and it can wrap and bend and this often 
leads to structural deformation and connection   failures between the parts of the chip in the 
previous video I discussed the problem with the   new NVIDIA Blackwell GPU which is being delayed 
and it seems that it has to do with the thermals   so exactly this issue and because this GPU is a 
relatively large design it shows that we bumped   into the limits of what an organic substrate can 
handle what is so interesting about glass glass   has a (CTE) coefficient of thermal expansion 
similar to the silicon and it kind of makes   sense because those both glass and silicon contain 
silicon atoms but their electrical properties are   very different silicon has a crystalline structure 
and it's a semiconductor while glass typically has   a non-crystalline structure and it's an insulator 
but because the thermal coefficient of glass is   very close to the silicon they expand at high 
temperatures at the same rate so when we combine   glass substrate and silicon chips we can avoid any 
thermal stress or bending on wrapping of any kind   even for the largest designs of the future so this 
technology has a huge promise and I really really   hope that glass won't break it as you can see it's 
a very hot topic in semiconductor industry and so   a lot of research ongoing and in one of the recent 
papers Huawei integrated a diamond-onto-a-glass   chip and this is very interesting combination 
because they use glass as well as a diamond on   top as a combination designed to create better 
thermal management and with that they achieved   this 30% reduction in thermal resistance which 
is in simple words means that it's 30% better at   transferring heat away from the chip so of course 
TSMC is also working on developing glass substrate   it will be used in their Fan-out panel level 
packaging which has been hugely driven by the   demand for AI accelerators this technology will 
be based on the glass and of course NVIDIA will   be one of the first adopters of this technology 
TSMC is targeting 2025-2026 for glass substrates   to hit the market and they are hugely anticipated 
companies like Intel AMD Samsung are all already   working on glass substrate production I've 
already mentioned TSMC and some research   papers but of course Intel is at the forefront 
of this technology they've already established   a dedicated research facility in Arizona for 
this purpose and they even already built a fully   functional glass-core chip they plan to be the 
first to commercialize the glass-core technology   and plan to mass produce glass chips by 2026 and 
they already working on it while I'm working on   some exciting material on Intel for My Weekly 
Newsletter if you want to receive it subscribe   to my newsletter through the link below following 
Intel Samsung already has an R&D division working   on glass substrates AMD is also working on the 
first glass chip prototypes and they are trying   to establish a supplying chain preparing for the 
moment when glass substrate hit mainstream markets   also some new players emerge like Absolics who 
received a substantial investment and now they're   building a dedicated fab for the glass chips and 
at this point not only semiconductor companies but   also equipment suppliers material and chemistry 
suppliers are getting involved so the race is on   of course like any technology innovation this 
development requires a lot of investments and   possess huge risks taking into account how easily 
glass can shatter it requires extra extra careful   handling and some processes have to be adapted for 
it if you remember what happened to a couple of   silicon wafers you know that I should definitely 
not get involved in this in reality these wafers   won't be made of a Pure Glass it will be 
some proprietary mixture to achieve desired   electrical and thermal properties so I guess 
it won't be as fragile as a typical glass of   course establishing a mass production going to be 
a huge challenge because it requires huge shifts   in manufacturing processes and it's going to be 
definitely a costly transition for the industry   which will still take some more years so for 
now Intel and other companies are figuring out   the most effective type of glass to use because 
we need to bring the costs down and we need to   figure out some processes how to prevent edge 
cracking or just breaking during the transport   and handling but once we get processes figured 
out there is so much more that we can do with   glass and we haven't even scratched the surface it 
has high frequency benefits that we haven't even   discussed today it allows for more efficient power 
delivery it also can be seamlessly integrated with   objects so it has a huge promise let's hope it 
doesn't shatter our expectations you know it's   set to make this world better and my friends at 
Planet Wild are already making this world a better   place Planet Wild is a community of people 
who are helping restore our planet 1 mission   at the time I joined them this year and I've been 
really impressed by their work each month they go   on different missions including forest and prairie 
restoration cleaning up oceans and protecting   endangered species like the European lynx little 
owls and blue whales all these projects are   supported by a membership model from people like 
you and me and I really loved their latest mission   to restore America's Wild West North America's 
grasslands were once full of thriving wildlife   but overhunting and farming caused the decline 
of many species taking away its natural beauty   in this mission Planet Wild is helping to restore 
the Prairie unique biome by reintroducing iconic   species like bison and prong horns bringing 
back the wild beauty of America's grasslands   what I really appreciate about Planet Wild is 
their transparency they document every single   mission on their YouTube channel as well as their 
app and honestly each time I'm watching the report   on their mission it makes me infinitely happy 
join us to make the Earth a better place you can   join by scanning the QR code here or join through 
the link below and the first 200 people who will   join with my code ANASTASI29 will get the first 
mons paid by me and the best part he will already   make a real impact in the first months and see the 
first video report in the less than 30 days on the   15th of the following month if you would like to 
learn more about planet wild and their work check   out the latest mission here make sure to connect 
with me on LinkedIn the link is below subscribe   to the newsletter thank you for watching till the 
end love you guys see you in the next video ciao

---

## 38. The Secret Behind Apple's New Silicon
**Channel:** Anastasi In Tech | **Views:** 110K | **Date:** 1 year ago | **Duration:** 15:19 | **ID:** MpHowo0Yvro
**Link:** https://youtube.com/watch?v=MpHowo0Yvro

### Transcript:
the new iPhone is out featuring the new Apple 
A8 and A18 Pro Silicon and from now on it seems   Apple Silicon will be not just inside all of the 
Apple devices but also outside in the data centers   and they mentioned it several times during 
the yesterday's event this is only possible   thanks to our unique integration of Hardware and 
Software it runs on servers we built especially   with Apple Silicon this is very exciting right 
but was it a good idea maybe not so sure let's   have a look Apple is betting hard on silicon 
and we love that by now they're pretty much   a silicon company they're able to come up with 
a new generation of chips every year and most   important they are able to innovate for example 
their Ultra Wideband Technology and guess what for   that they also designed their custom silicon you 
know if you open this phone you will see several   PCB boards and all of them are full of silicon 
chips and many of them are already Apple Silicon,   Apple can now be seriously compared to companies 
like Qualcomm or Broadcom or pretty much any other   silicon company the only difference is that Apple 
makes much more money as they also an OEM so they   sell the final product to us and also they don't 
sell chips outside but we will talk about that   now how did Apple go from designing mobile chips 
to Data Centers to understand that we have to go   over some of the most crucial moments in the 
history of Apple silicon in the first iPhones   Apple featured Samsung chips and the funny fact 
some of them even had an Apple logo so you can   kind of guess what they going to do next as 
a next step replacing this chip with their   own in 2008 they acquired P.A.Semi a chip design 
company and with that Apple started to gradually   transition to design their own chips the first 
Apple Silicon was the A4 application processor   in 2010 which went into the iPhone 4 and the first 
iPad this was an ARM-based chip based on the 45nm  Samsung technology so back then they were 
manufacturing chips at Samsung fab and this   was the beginning of the custom Apple Silicon it 
was followed by the A5 A6 and finally with the   A11 it was given the name Bionic typically Bionic 
refers to a mixture of some biological functions   with electronics and back then it had to do 
with introduction of the neural engine which was   powering some initial AI features like the first 
FaceID but they kept calling it Bionic ever since   because they want to emphasize the importance 
of these features in their custom silicon and   yesterday they presented their new A18 and A8 
Pro silicon and these SoC's are fabricated in   the state-ofthe-art second generation 3nm process 
node and here they are likely referring to TSMC's   updated 3NE process and this are ARM-based chips 
which are likely using ARM extension to enhance   vector and metrix processing capabilities and 
then they proudly announced that this CPU and   GPU as always roughly 30% better than the previous 
generation this new chip features a 16 core neural   engine for running large generative models it's 
twice as fast as before clearly AI features will   become a big selling point for iPhone this year 
and many of them are already Hardware accelerated   basically Apple is now integrating AI at the edge 
and it's quite interesting because now 200 million   people will buy iPhone 16 and start using Apple 
Intelligence at edge but the thing is not all the   processing is happening at the edge so there will 
be communication to the cloud what will happen you   ask something Siri and then Siri sends your prompt 
to the cloud which is running on Apple Silicon and   that's why Apple buying this very fast and very 
expensive 5G chips from Qualcomm which is a very   interesting topic and we're going to discuss it 
later in the video and the whole Apple strategy   is that they will see which AI features are used 
the most by the users and with the next generation   they will build in the hardware acceleration for 
these features because we know that the best way   to accelerate an operation and to make it very 
low power and very fast is to build an ASIC so   Hardware acceleration of this feature just like 
they did with this new Advanced Media in A18 Pro   and the same thing is going to happen with the 
other devices like headphones and the Apple watch   but actually Apple Silicon story is much more 
deeper and much more interesting than just their   A-series chips so yes they started with mobile 
chips and with the bionic but their next strategic   move move was to build a power management system 
in house to do that in 2018 they acquired Dialog   Semiconductor and this is a brilliant strategic 
decision when you're company building mobile   devices because after the SoC the second most 
critical chip in your mobile device is a power   management this chip manages power supply charging 
batteries by designing this chip in house they can   better optimize the entire stack and optimize 
the power efficiency to the maximum on top of   that it makes them less dependent on the external 
suppliers and then we all know they transitioned   their laptops to Apple Silicon people started to 
talk about them as about silicon company before   2006 they were using IBM chips Power PC chips and 
then they transitioned to Intel silicon and this   was actually big it was a huge leap in performance 
and then after almost a decade of Apple experience   in designing silicon in 2020 Apple introduced the 
M1 chip and this was the legendary transition from   x86 to ARM architecture for laptops this was 
important because this allowed Apple to use the   same cheap architecture across all their devices 
and this of course was also a huge heat for Intel   which is still has not unfortunately recovered 
and what's so interesting about Apple that for   pretty much every product they create they now 
build their own chip if you take AirPods for   example inside there, there W-chips which then 
involved to the H-chip series and over the past   few years Apple acquired more than 100 companies 
in the areas of memory controllers AI companies   AR companies AI music companies I actually read 
that Apple acquires a new company once a month or   so on average and it's very interesting to observe 
these acquisitions because you can figure out kind   of figure out what they going to do next another 
very important acquisition was Intel's wireless   business Apple acquired it in 2019 with the idea 
guess what design their own chip 5G modem which   we discussed before which they're now buying 
from Qualcomm and this modem chip is a huge   deal for Apple because of their tension in the 
relationships with Qualcomm but don't look back   in anger so for many years now Apple was trying 
to design their own 5G cheap in house but to   my understanding they're still facing technical 
issues and I read that they're extended the deal   with Qualcomm for a few more years so in the new 
iPhone 16 Pro they still use the Snapdragon x75   chip set which actually consists of 3 chips and 
according to some reports this one may cost more   than $100 if you know how cheap economy works you 
know that $100 for a chip is very expensive and   Apple certainly wants to get rid of this chip as 
soon as possible and they're trying their best to   replace it with their custom silicon and the trick 
is that when they design it on their own they can   then integrate it in the SoC they can integrate 
it in this a processor and this will have benefits   not just from the cost perspective but also 
it will help them to free up some space on   the PCB board and this as we know so form factor 
plays a huge role in the mobile market and as far   as I know they already managed to do Wi-Fi and 
Bluetooth chips so I guess in a couple of years   they will come up with their 5G chip finally 
and then their PCB board will be not anymore   so crowded now to the most interesting aspect of 
Apple silicon business so I checked and they sell   on average 230 million iPhones a year so let's 
say they manage to come up with their 5G chip   and replace the Qualcomm chip this will save them 
about $5 billion a year let me know what you think   in the comments of course they have to maintain 
the R&D team but still it's a lot and this of   course comes on top of other advantages such as 
depending less on the external suppliers better   integration of the whole stack right hardware and 
software stack plus the denser integration inside   the SoC I think it's getting pretty clear why they 
are betting so hard on the custom silicon and you   know what if you're enjoying this video please 
share it with your friends and on social media   I really appreciate your support and consider 
subscribing to the channel for more videos like   this one thank you and so just like every other 
silicon company Apple has proven their ability to   innovate so the next thing they did they designed 
the ultra wideband chip which was crazy because   back then it was something completely new for 
Apple and these chips were used for their AirTag   feature here Ultra White Band technology is 
used to accurately position one device with   respect to another one and to make this feature 
to work we actually need 2 chips so we need one   in the AirTtag and another one in the iPhone so 
they can find the relative position with respect   to one another and actually this technology 
has a lot of potential for many smart home and   smart car applications the beauty of a modern 
smart phone is that there are much more chips   inside than you can even imagine for example in an 
iPhone among others there is a lighter chip from   Sony then there is a gyroscope and accelerometers 
from I think from Bosch and then there are other   chips from broadcom Renesas NXP then there is also 
memory from the Korean company and you know with   each new release of iPhone they're like a plethora 
of jokes that nothing has changed and it's exactly the same but when you realize all the Hardware 
design updates and all the work which goes into   creating this piece of Hardware you kind of 
appreciate it a bit more now to the fun part   during the yesterday presentation Apple mentioned 
Apple service twice and the main goal behind that   I believe is security because clearly I don't 
want my data to be sent to the third party   cloud provider and maybe you don't want it to be 
sent to the Apple either and there are many talks   about Apple building chips for data centers to 
run inference at the cloud for those tasks which   are too massive to handle at age I believe apple 
is really capable of building a silicon for cloud   infrastructure or worst case they can acquire 
someone who is building ARM-based chips for   the cloud like Ampere Computing I talked about 
them a couple of videos ago I will leave a link   in the description below this would be a really 
interesting candidate 2 more things which may make   one suspicious is that they have very low amount 
of orders of NVIDIA GPUs and at the same time   producing a huge amount of their older M2 Ultra 
chips even though they are not coming into any   new products another indication is some of their 
recent hires they hired some really top experts   who was working on the AI infrastructure in Google 
and then in the NVIDIA as well so they're clearly   working on something so we were talking with some 
friends that this might be an indication so one   may concludes that they might be building 
an Apple data server based on the M2 Ultra   chips based on their own silicon and at the same 
time they're ready to build something even more   powerful in the future because they already have 
experiened with some interesting tsmc packaging   for AI accelerators like info packaging the thing 
is that M2 is an edge device and there are very   different requirements for the edge chips and for 
the cloud chips so if I simplify it for the cloud   we need what performance we need many TFLOPS this 
is what NVIDIA GPU is able to deliver and for the   age we need more low power more power efficient 
solution this is the Apple mobile chips right   also Apple laptop chips the M2 Chip is for the 
edge I had a look an M2 Ultra is capable of 30   TFLOPS plus it has a neural engine so a little bit 
more and if we compare it to even older Hopper GPU   it's about 2,000 TFLOPS it's about 70 times 
difference so with that they won't be able to   serve many people millions of people and also I'm 
not sure how it works out economically you know   I have a feeling if they take NVIDIA GPUs and 
build infrastructure based on the NVIDIA GPUs this will be more efficient or another way to 
build their own custom silicon for the cloud   and here I have a feeling and at the same time 
they're discussing potential deals with open   AI Google and even Claude I think with time it 
makes sense to train their own model and here   is the thing if you need to design a chip it's a 
huge investment it's like depending on the size   and complexity it's from $10M to $100M to $500M 
for a chip so it's a huge investment when we're   talking about training AI model you can do this 
with up to $10M to $20M so for Apple it might   be worth investing in it because it comes down to 
the three main factors first of all having control   second is also add potential add Revenue because 
we know that all this AI features and now we'll   be using to serve as better ads and third again 
owing the entire infrastructure let me know what   you think I think I'm going to wrap it up here 
love Apple's silicon efforts if you enjoyed this   video make sure to subscribe to my newsletter 
because I will be writing more about Apple   and also connect with me on LinkedIn because 
there I also now regularly write posts, ciao

---

## 39. Latest NVIDIA GPU: What's Going On?
**Channel:** Anastasi In Tech | **Views:** 91K | **Date:** 1 year ago | **Duration:** 11:08 | **ID:** Rw1ovGfD1uI
**Link:** https://youtube.com/watch?v=Rw1ovGfD1uI

### Transcript:
in this video I will discuss what's going on with 
NVIDIA Blackwell GPU why TSMC is struggling with   manufacturing it and the impact it will have 
on the future NVIDIA has had just their most   important earnings call ever they reported a 
record high revenue of $30B for the quarter and   their data center revenue more than doubled 
over the past year but despite this amazing   drop from NVIDIA and their earnings beating 
estimates NVIDIA's stock dropped more than   8% so what's going on here apparently one of the 
reasons has to do with the concerns over NVIDIA   next generation Blackwell GPU's being delayed 
because TSMC is facing issue with being able   to manufacture it at high volume for me with 
my chip design background was very interesting   to understand the technical details of this 
issue and many reports indicating that it's   coming from the new packaging technology so I've 
dug into this the general trend in the industry   is that we are moving towards larger GPUs because 
AI models are growing exponentially in size and   also the amount of data processed by AI models 
is increasing larger chips can handle more data   simultaneously and this is huge advantage because 
with that you can get higher speeds for training   and inference so following this trend in their 
new Blackwell GPU NVIDIA introduced a double-die   design and that's also one of the root cause 
of their problem this is the high-level floor   plan there are two large GPU dies which basically 
contain the core logic and they're linked by very   fast 10 terabyte per second interconnect bridge 
and through this bridge one die communicates   with the other and every die is surrounded by 
4 memories and to package something as complex   as this they use CoWoS-L packaging technology from 
TSMC which stands for Chip-on-Wafer-on-Substrate-L  packaging and in my understanding this is exactly 
where the problem is coming from so if we look at   the cross-section of NVIDIA Blackwell GPU here 
we have a substrate and an organic interposer   soldered on top of it and then the memory and the 
logic die sit on top of this interposer and this   memories and GPU dies are interconnected through 
tiny bridges so-called local silicon interconnect   so in this new packaging we have local silicon 
interconnect while in the previous packaging   in the Hopper GPU packaging we had the kind of 
global silicon interconnect this is a general   idea I will explain it in details later in the 
video and what's important to understand here   that Blackwell GPU is actually an evolution of 
their previous Hopper GPU which had a single   GPU die talking to 6 memories and the package was 
almost half the size of the Blackwell package now   the Blackwell GPU is a much larger chip so they 
decided to go for CoWoS-L packaging technology and   this one allows to package a bigger design with 
up to 12 memory dies and at lower cost compared   to the CoWoS-S packaging now manufacturing this 
Blackwell GPU is getting very challenging because   you need to assemble all these 10 pieces on top 
of the interposer and then very precisely align   the pins on both sides on the sides of the 
logic and also on the memory side and here   we are talking about micron-level precision 
and there are many thousands of connections   in between so aligning them is not easy but 
the trickiest part is to align these two GPU   dies to align the logic to enable this super 
fast communication 10 terabyte per second this   is the first challenge and now NVIDIA is working 
with TSMC to optimize this assembling process but   there is a second even bigger challenge thermals 
so-called Thermal Management and this topic is   addressed in many scientific publications and 
it's indeed a challenge this problem comes from   the fact that thermal coefficients of various 
materials are different here we have memory   logic dies and interposer bridges all made 
primarily of silicon while the interposer and   substrate are made of melting compounds some sort 
of organic material and the thing is all of these   pieces has its own thermal coefficient silicon 
for example has a much lower coefficient than   the organic substrate so what's happening when 
GPU is working it's heating up and it's getting   pretty hot because it can dissipate somewhere in 
between 700 to 1,200 Watts TDP which shows the   maximum amount of heat a chip can generate so 
it's really hot this temperature changes cause   structural deformations because of the thermal 
mismatch what can happen is that the substrate   may even bend a little bit and create stress in 
different directions an additional issue that   different materials expands at different rates 
which makes the whole thing somehow dynamic and   this can cause relative die shifts and connection 
failures between the dies actually NVIDIA doesn't   disclose the technical details of this issue this 
is my understanding of what's happening with the   most powerful GPU and a part of this problem comes 
from the fact that Blackwell GPU is a relatively   large design so we need to align many of these 
components across big area and now just imagine   that all of them expanding at different rates and 
the contacts are not very well aligned anymore so   it can get really bad very quickly let me know 
what you think in the comments it wasn't a problem   for the Hopper GPU design because it's a smaller 
design and was packaged using CoWoS-S packaging   technology which places logic and memory on top of 
a single silicone interposer which makes it very   robust to thermals but we discussed that the trend 
is going towards having larger chips larger GPUs   and if you have a large design an interesting way 
to overcome this problem of interconnecting and   aligning many dies is to build a single monolithic 
design for example approach which is pursued by   Cerebras they're building a monolithic chip of 
the size of the wafer and they have about 80 or   so dies and these dies are connected by wires 
that just go through the scribe line and it's   manufactured as one single monolithic design this 
is a really beautiful piece of engineering it of   course has it also pros and cons let me know what 
you think in the comments unfortunately I happen   to know that about 60% to 70% of you watching 
this video are not subscribe to the channel   if you ever enjoyed my videos could you please 
subscribe to the channel this helps the channel   more than you know because the bigger the channel 
gets the bigger the guests that I can interview   for you get thank you now why NVIDIA didn't go for 
a single large logic die in case of the Blackwell   GPU this has to do with the complexity and also 
margins basically you have more usable chips per   wafer in case of the smaller designs so it's more 
cost effective but it seems now they have lots of   headache with thermals and also interposer 
issue and what's interesting here I'm pretty   sure they've considered that and they've also 
made many prototypes before but apparently this   issue is more complex and in my opinion you know 
the dynamics of the real load plays a huge role   here because this thing it's like impossible 
to simulate in advance and on top of that we   know that CoWoS-L packaging is a relatively new 
technology and TSMC don't have enough capacity   for this so it's getting very complicated and 
NVIDIA has already realized that the original   plan was to manufacture a million GPUs per quarter 
but this is not happening and NVIDIA is trying   to compensate for this ongoing situation in 2 
ways first of all it's expanding its Hopper GPU   shipment and also introducing the new B200A GPU 
which is a lower-end version of B200 and this one   guess what using more mature CoWoS-S packaging 
technology so it's again a single die design   surrounded by 4 memory dies sitting on top of a 
silicon interposer and we know that TSMC achieved   high yields with CoWoS-S packaging and there 
appear to be no thermal or manufacturing issues   and while I was in the process of recording 
this video NVIDIA reported that they solved   the Blackwell yield issue with a new litography 
photo mask as you may know photo mask defines   the pattern of circuits which are printed on the 
wafer and this likely to address the issue that   has to do with the N4P manufacturing process or 
maybe addressing the interface between the chip   and the package in my opinion it's unlikely that 
you can solve thermal problems with just updating   one single photo mask let me let me know what you 
think in the comments because I think that NVIDIA   with TSMC experts will eventually figure it out 
and despite this situation I remain optimistic   about the long-term prospects of NVIDIA because 
at the moment they have more than 90% share of   AI Data Center Market and according to McKinsey 
computing demand for AI workloads will increase   more than 100 times over the next 5 years because 
more and more people and businesses adopting AI   in their work and if you want to take advantage 
of AI in your work or research you must check   out Poe through Poe you can access models like 
GPT-4o Claud-3.5 Llama-3.1 and Gemini all in   one place and this goes beyond just text bots Poe 
lets you create images with the state-of-the-art   image generators like Ideogram Dall-e-3 Flux-Pro 
and more and this is a huge cost saver because   you don't need to juggle multiple subscriptions 
you can get access to all the best AI products   in one place for the same cost as ChatGPT Pro 
or ClaudePro I've been using Poe for a while   now mostly for writing and research and I love 
having access to multiple models because each of   them has its own strength for example when I'm 
researching a topic I can query Claude-3.5 and   compare its response to the GPT-4o or Mistral 
Large model with one click and that and then pick the best response from them all beyond that 
Poe offers a huge variety of bots that specialize   in a particular task so if you're interested in 
a specific topic such as programming storytelling   or anything else you can find a bot that is 
just right for you check out the Poe platform   for free through the link below and thank you 
for supporting the channel now watch this video   where I explain what is next for AI and AI chips 
in general or this video where explain the new   Huawei AI chip and if they are closing the gap 
or not and I will see you in the next video ciao

---

## 40. China’s Manufacturing Nightmare
**Channel:** Anastasi In Tech | **Views:** 92K | **Date:** 1 year ago | **Duration:** 11:28 | **ID:** D54gX9gTTzY
**Link:** https://youtube.com/watch?v=D54gX9gTTzY

### Transcript:
there are two interesting updates on the AI chip 
market first of all everyone is talking about the   recent progress in Chinese AI chip development 
with their recent photonic chip and their new AI GPUs and as always with my background in chip 
design I'm interested purely in the technological   side of the story so we know that before the US 
restrictions NVIDIA's share of the Chinese AI   chip market was over 90% but now many Chinese 
companies are working on developing AI chips   locally and one of the biggest players is Huawei 
who is about to start shipping their new AI chips   till now the most competitive AI GPU designed in 
China was Huawei's Ascend 910B chip based on the   official specs it falls between NVIDIA A100 and 
H20 GPU it's actually more powerful than NVIDIA's   H20 GPU which is the best NVIDIA chip on Chinese 
market at the moment and closer to the performance   of NVIDIA's A100 GPU but the thing is we know how 
much they've really struggled with chip defects   based on the media reports from the Chinese media 
that I found they're facing really bad yields they   write that 4 out of 5 chips have defects and those 
are really terrible numbers in chip manufacturing   yield refers to the proportion of the functional 
chips compared to the total number of the chips on   the wafer and we love high yields because high 
yield indicates that there is a high number of   defect-free and fully functional chips while low 
yield indicates that many chips are defective like   in case of Huawei chips manufactured by SMIC now 
Huawei is about to start shipping their new 910C   GPUs and the demand for it on the Chinese market 
is huge but I assume that with this new redesign   there will be first targeting to fix the yield 
problem and only then focusing on the boosting   the performance but improving manufacturing yield 
is honestly a rocket science it's a very complex   matter of course a huge part of the Huawei's 
problems with the GPU comes from SMIC struggling   with their 7nm manufacturing process because 
it's a huge challenge to manufacture 7nm chips   without EUV machines so SMIC is trying to push DUV 
machines to the limit and as a work around they   using so-called multi-pattering technique and this 
involves several layers of masking and several   wafer exposures to print just a single transistor 
feature and that's quite a hustle and of course   it's error-prone I've explained how it works in 
the details in this video consider subscribing   to the channel right now to stay up to date with 
the most important trends in technology thank you   very much what's so interesting this is not purely 
about the manufacturing process you can actually   improve the yield from the design perspective you 
can actually take the same design and redesign it   using more relaxed layout design rules so-called 
DRC rules or using a different set of design   libraries and I think they're going to try to do 
that with this design because they've already done   it with their Kirin chip and at the end it worked 
out very well let me know what you think in the   comments so there is a lot of demand for this chip 
based on the numbers that I found I think more   than 100,000 chips have already been ordered and 
fulfilling this demand it will be a huge problem   huge challenge for both SMIC and Huawei I think 
with lots of effort they will eventually be able   to stabilize the production process however the 
future generation of AI chips those that go below   5nm will definitely require lots of innovations 
on the equipment and process control side as well   this will take billions of dollars of investments 
in the chip industry which are already taking   place and also a decade of time or so to make 
it happen let me know what you think about this   in the comments NVIDIA is also struggling with 
producing high volumes of their new Blackwell GPU   and this impacts their targets revenue and stock 
of course but in their case that the design and   packaging that are the main issues if you want 
me to make a video on why TSMC is struggling to   fabricate this particular GPU let me know in the 
comments now the second exciting news I have to   share with you has to do with this startup called 
Ampere Computing they are seen in the media as a   kind of "dark horse" but are there really if you 
never heard of them it's a US based startup that   focusing on chips for the cloud market and they're 
going all in on ARM architecture and we saw how   ARM has been conquering the chip market for a 
while now Qualcomm Apple and Samsung chips are   all ARM chips and I also have it in my investment 
portfolio and it has been a runaway success   I think this startup is particularly interesting 
but a bit of a history first it was founded by   Renee James an ex-president of Intel and back 
in 2017 she had a vision of ARM expanding into   the server and enterprise markets and this 
is the first interesting thing because back   then there were high hopes for ARM chips to 
be used into the servers and there are many   startups popping up and then eventually failing 
or pivoting and even Qualcomm tried to do that   but it didn't work out but Ampere has survived 
till the present day and they've got some very   premier customers like Google Amazon Oracle 
Alibaba and now Qualcomm and till now they've   already shipped many hundreds of thousands CPUs 
to these customers they built cloud-native chips   with a strong focus on energy efficiency and 
they've recently announced their new AmpereOne   chip 256-core chip but the main idea behind this 
multi-core design that they can achieve higher   performance by having higher number of smaller 
cores compared to the Intel and AMD CPUs and if   we look at the reported benchmarks they claim 
50% higher performance per watt compared to   AMD's Epic Genoa GPU and up to 15% higher than 
Bergamo what's interesting Ampere is building   off-the-shelf chips what means off-the-shelf chips 
that any cloud provider can just buy their CPU's and it's like plug and play and it's compatible 
and then we talk about cloud and also data centers   what is the most important is performance 
scalability and power efficiency so this is   a market Ampere is targeting clearly their main 
competitors are Intel and AMD chips Intel has   their Sierra Forest and Clearwater Forest chips 
coming soon AMD has Bergamo CPUs however Ampere   reports a clear advantage in performance per watt 
now to the most interesting part so we see that   many of the initial Ampere clients are now going 
vertical so they are building the complete stack   they are designing their own chips and we see 
this is an overall trend across the industry   what's funny that I noticed that this trend is 
sort of cyclic so most companies go through this   cycle first they integrate everything vertically 
and then the wind change it can happen in many   years of course and they start disintegrated for 
example Philips first it spun off its lithography   business to what we know today as ASML who 
are doing the most advanced EUV lithography   machines and the most advanced semiconductor 
fabs like TSMC can't survive without these   machines they are essential for continuation of 
the Moore's Law and then they spun off NXP so   NXP is actually a former semiconductor business 
operated by Philips so they were very vertically   integrated and now they are sort of back to 
making coffee machines and what's interesting   the mothership Philips is now worth 13 times 
less than ASML and so now the most of the   companies are in this phase of integration 
Amazon has been building their own chips   for quite a while now Microsoft and Google are 
also building their own chips NVIDIA has their   Grace CPU the problem for Ampere is that many of 
their original customers are now building their   own chips and that's not the best situation to 
be in so Ampere chips have to be either orders   of magnitude better or much cheaper and this 
is not easy to achieve at the moment their   main customers are Oracle and Qualcomm and 
they've just announced a collaboration with   Qualcomm to pair their CPU with Qualcomm Cloud 
accelerator and those will be used in Supermicro  servers for AI inference and this is big it will 
be very exciting to watch how this story will   unfold let me know what you think in the comments 
I really hope they can make it to work because   I'm really fond of their mission building power 
efficient chips because now we must strive for   efficiency as never before the power consumption 
in data centers is a really huge problem it's   estimated that by 2030 they could comprise around 
10% of the total US electricity output and data   center CO2 emissions could more than double 
and this of course is driven by power-hungry AI   workloads these numbers are really worrying but it 
will lift your spirit if you see what my friends   at Planet Wild are accomplishing and I know this 
collaboration is a bit unusual for this channel   but I really support their mission Planet Wild 
is a community of people who care deeply about   the planet and they already taking practical 
actions now I've joined them this year and I've   been really impressed by their work each month 
they go on different missions including forest   restoration cleaning up oceans and protecting 
endangered species like the European lynx owls and   blue whales all these projects are supported by a 
membership model by people like you and me and the   best part is that you can already see your impact 
the impact you're making in the first 30 days I   was especially impressed by their mission to save 
blue whales that are threatened with extinction   and no one knows why they are disappearing Planet 
Wild is using technology like drones to collect   data and understand what's happening to help 
the whale population to recover what I really   appreciate about Planet Wild is their transparency 
they document every mission on their YouTube   channel as well as in their app so we can see the 
direct impact of our contributions and watching   this makes me so happy to understand what I mean 
check out their recent mission with owls join us   to help make the earth a better place and there 
is no set price so any contribution helps you can   start with as little as $6 just scan the QR code 
here or join through the link below the first 200   people who will join using my code ANASTASI8 will 
get the first month subscription for free you can   also watch their whale mission I will link it 
here and the owl mission I will also link it   somewhere here check it out and let's restore 
the planet together thank you very much ciao

---

## 41. Where's the AI Boom Going
**Channel:** Anastasi In Tech | **Views:** 67K | **Date:** 1 year ago | **Duration:** 11:08 | **ID:** 59rK-zsTUAk
**Link:** https://youtube.com/watch?v=59rK-zsTUAk

### Transcript:
this video is sponsored by Babbel everyone is 
talking about AI now and there are mostly two   points of view some researchers believe that we 
will achieve Artificial General Intelligence by   2028 well other are skeptical and believe that we 
might be reaching some sort of a plateau very soon   this is the new AI hype cycle created by Gartner 
and when I first looked at it I was like wow this   is really interesting here they basically plot 
the hype around emerging technologies and how it   progresses over time for example some emerging 
technologies like Quantum AI or AGI are still   in this first phase called Innovation Trigger 
one of the biggest trends of the last years   Embodied AI is also here like the new Figure 
O2 robot that gives Open AI language model a   body typically at this phase the excitement 
is rising and the trick is in the beginning   is really easy to generate this "wow effect" but 
what comes after that then there is a point at   which some of the technologies reach a peak of 
expectations when everyone around and the media   is talking about this technology and it receives 
substantial investments for example right now it's   happening with Foundational Models where we have 
top four companies with the most powerful models   like Google Meta Anthropic and Open AI so we can 
say that it's at the peak of expectations and AI   Technologies are moving very fast through this 
cycle and it's giving a huge huge boost to other   technologies like AI hardware and we will talk 
about this trend in more details in a moment   but what often happens afterwards right after 
the peak is that technology enters the valley of   disappointment now if you listen to guys like Sam 
Altman and others according to them we are at this   exponential curve for AI but are we really if we 
take Moore's law for example which is basically an   observation that the number of transistors in 
a silicon chip doubles roughly every 2 years for   the same price we used to see it as a line on 
a logarithmic scale right but when we look at   it on a linear scale we truly start to appreciate 
the power of exponents what's actually happens on   this plot that they getting more computing power 
along the way but when we go back to AI technology   and make a reality check we are not there yet if 
we look at this figure by Anthropic one thing is   obvious here we are reaching a sort of a plateau 
you know the improvement from from GPT3 to GPT4   was huge and it's now getting smaller and smaller 
even though we invest more and more effort money   and GPU Computing there and then if we look at 
it as performance vs computing power it's   almost like we are putting in exponentially more 
computing power and getting linear performance   improvements so that's a really bad sign 
current industry estimates indicate that   the computing power for AI tasks will increase 
100 to 1000 times over the next 5 years we see lots   of new AI chip startups appearing and raising huge 
investment rounds like Groq who just closed a $640   million investment round and Cerebras is also 
doing great but there is one problem so what I   learned from many years in the chip design R&D 
that hardware implementation requires lots of   hard choices especially now because now there are 
two major contradicting trends in the AI Hardware   from one point of view there is a very strong 
drive towards building AI accelerators as general   as possible but from the other point of you there 
is also very strong push for efficiency and the   way to make AI training more efficient is to use 
specialized AI chips socalled AI ASICs Application   Specific Integrated Circuits where the most of the 
Silicon area is devoted to the kind of hardcoded   operations and such designs mostly ignore many 
other operations which are typically done by a   CPU or GPU and this is one of the biggest trends 
in the Silicon space at the moment the problem is   it's really hard to make predictions especially 
about the future and according to Yann LeCun "If   you are interested in building the next generation 
of AI systems don't work on LLMs" and nobody knows   when the next AI algorithm will come out which 
totally change the way we do things so in case   of ASICs there are huge risks that that you might 
be missing the next wave I've talked about this   in depth in my previous videos so if you want to 
stay up to date with the most important trends in   technology subscribe to the channel for example 
this is exactly what happened to the startup   Graphcore which has been recently acquired they 
went all in too early on the wrong technology on   convolutional neural networks and this is exactly 
what Etched startup is doing right now going all in   in transformers but not that type let me know what 
you think in the comments if you've been watching   me for a while you know that my background is in 
engineering I worked in microchip R&D for the last   7-8 years I don't think I've mentioned 
it on the channel yet but this fall I will be   starting an MBA in Italy and at the moment I speak 
fluent German and fluent English but my level of   Italian is like at "Ciao ragazzi!" thanks to today's sponsor 
Babble I've already made quite some progress with   Italian Babbel is one of the top language learning 
apps in the world and what I like about it that   it's designed to prepare you for the real world 
situations for example after using Babbel for 3   weeks I can already manage something like this "Mi chiamo 
Anastasiia. Sono innamorata della tecnologia e del business.  Piacere di conoscerti." so I know many Italians are watching me please let me know how well I did 
with that and also let me know which languages you   would like to learn and why with Babbel you can learn 
14 languages including German Spanish French and   Italian among others click on my link below 
and save up to 60% on your subscription today   thank you Babbel for sponsoring this video so 
Foundational Models and AI Hardware are clearly   at the peak in the second season of Gartner's AI 
cycle but as a chart indicates what often happens   afterwards is disillusionment that's what we all 
notice right now happening with the generative AI so more specialized models which are used 
to create new type of content like images text   and recently videos have you noticed how everyone 
become less and less excited about them recently   the thing is that there was quite a lot of value 
promised and now we hear more and more how there   is little value being generated some researchers 
from MIT estimated that just 5% of all the tasks   will be affected and Gen Ai will improve the 
productivity just by 0.5% and what's interesting   that the technology itself is getting better and 
better every single day but people are getting   even more disappointed because it seems that it 
has little to do with the technology itself it's   more to do with the perception of the technology 
by people and by the market sometime ago Goldman   Sachs estimated that with Generative AI we would 
be able to increase worker productivity by about   9% and could potentially automate as much as 
25% of all occupations over the next decade   now one of the recent more pessimistic outlooks 
suggests that gen AI will improve productivity   by just 1.5% and this reminds me this curve 
so-called Dunning-Kruger Effect and based on   this curve they are now heading right into the 
valley another problem is that people seem to   believe in some sort of AI Scaling Law that 
by doubling the amount of data and computing   power we automatically double the capabilities 
of AI models but when we think about this what   doubling the data can really achieve for example 
if you feed twice much data from their Reddit into   the training yes ChatGPT can eventually write better 
texts but does it really double its capabilities   I think not another big problem is the costs 
involved the costs of compute energy and the   maintenance of this whole thing what happened 
is that over the last couple of years we went   from million dollars computing clusters to billion 
dollars computing clusters and from time to time   another zero is being added and the only thing I 
see we can justify this costs is by focusing more   on global problems like research related to Health 
Care and Drug Discovery basically developing AI in   science models like DeepMind's Alphafold maybe 
finally we can find a pill against aging I would definitely take one or I also love the 
mission of xAI you know to learn more and   understand more about the Universe I would really 
love that but obviously generative AI was not   designed to do that let's go back to the Gartner's 
AI hype cycle so while the technology goes through   this disappointment phase what's happening on 
the background is that lots of hard work goes   into improving it and also expectations become 
more reasonable and eventually it slowly   if ever reaches the plateau of productivity like 
computer vision and cloud computing where we see   real world benefits and a huge impact on business 
you know how much I love technology and in my   opinion I see enormous amount of potential value 
in here as mentioned the first time I saw this   plot I was like Wow but then I realized with time 
that this is just an opinion and technology and   opinions are two different things what you think 
about something is not always what it really is   as with any technology it's very easy to generate 
this wow effect in the beginning but it's getting   harder and harder to keep doing so over time so 
with the upcoming GPT 5 release I don't think we   will get any of this "wow effect" anymore you know 
it's just like with iPhones there is less and   less wow effect with each release every year but 
Apple's share price is now much larger than it was   back during this WOW phase and now nearly 
20% of the world population is using an   iPhone and that's what matters and what I see 
that open AI is also great at productizing AI   so we need another one or two breakthroughs 
to take us back to this exponential curve of   AI Improvement let me know your thoughts in the 
comments and share this video with your friends   and colleagues and on social media and remember 
to check out the sponsor of today's episode   Babble through the link below and save up to 60% 
on the subscription today thank you so much ciao

---

## 42. New Microchip Technology: 90% Efficiency Gains
**Channel:** Anastasi In Tech | **Views:** 119K | **Date:** 1 year ago | **Duration:** 11:39 | **ID:** SN3QWf7Cwvc
**Link:** https://youtube.com/watch?v=SN3QWf7Cwvc

### Transcript:
researchers from UC Santa Barbara in collaboration 
with Intel have developed a new microchip   technology that operates based on the principles 
of quantum mechanics and with this new technology   they've gained an efficiency boost of 90% compared 
to the classical FinFET chips from my many years   in chip design this sounds really interesting 
so let's have a look transistors have given us   so much over the last 70 years just think for 
a moment how the world would look like without   transistors it would probably look similar to what 
it was like in the late 50s first of all we would   have no gadgets no iPhones no GPS or satellites 
you would never have a computer at home because   they would be the size of a warehouse we would 
have never landed on the Moon or sent missions   to explore Mars we would all probably spend much 
more time outdoors than we do now and I can go on   like this for a while but let's just agree that 
we all deeply appreciate transistors since then   we've shrunk transistors at least a thousandfold 
from a centimetre to just a few nanometers today   but now it starts to slow down and I've made my 
master thesis exactly on this topic many years   ago and already back then it was quite clear 
that we need a new transistor technology to   keep Moore's Law going the problem is that as we 
pack more transistors onto a chip their dimensions   continue to shrink and we eventually bump into 
the effects of quantum mechanics and so in the   chip world these quantum effects show up as a 
variety of strange behaviours basically things   that we can't fully control and I particularly 
love this point of intersection between quantum   physics and electronics because if you love 
physics things start to get really interesting   here you know electrons have a key property 
called Duality basically they act like both   particles and waves and at very small scale 
like sub-10 nm these wave properties become   significant and here we step into Quantum 
Domain one of the main effects that we   observe is Quantum Tunnelling it's basically when 
electrons manage to pass through a barrier which   typically would block their flow you know there 
is always a slight chance that an electron will   suddenly disappear and then appear on the 
other side of the door without ever opening   it just imagine walking into a cafe 
and then straight out on the other side so this is somewhat similar to Quantum 
Tunnelling or imagine a ball rolling   over a hill if a ball doesn't have enough 
energy to climb over the hill it will just   roll back that's what happens with classical 
transistors at least what we expect to happen   however in the quantum world things are really 
interesting because here the ball has a chance   of tunnelling through the hill instead 
of going over it and this creates lots of   issues in modern electronics because electrons 
manage to move through barriers that are made   to block them like thin insulators and this is 
a huge problem if you're enjoying this video   and my explanation of Quantum Tunnelling 
and you want to stay up to date with all   the recent advances in technology consider 
subscribing to this channel thank you so much transistors act like switches that turn on 
and off and this switching in a classical way happens by manipulating energy barriers when 
a voltage is applied to the gate it lowers the   energy level between the source and the drain 
allowing current to flow when the gate voltage   is not applied the energy barrier is high so it 
stops current from flowing basically switching   the transistor off all modern electronic devices 
made out of classical transistors take advantage   of this simple principle but this unfortunately 
has its limits because as transistors are becoming   smaller all the layers and all the dimensions 
becoming smaller and also the gate oxide layer   which separates the gate from the channel becomes 
thinner electrons start to tunnel through this   layer right now it's about 1nm thin and it's so 
thin that we can't reduce it any further because   it's already so thin that transistor leaks 
current even when it's switched off and that's a huge problem because it causes huge power 
losses and heat dissipation in all the modern   chips and actually the whole efficiency of all 
the modern chips is constrained by this leakage   current so now how can we improve transistor's 
current situation there is no way how we can   stop electrons from tunnelling at these dimensions 
so why can't we use this effect to our advantage   so exactly with this idea in mind researchers 
designed a new type of transistor so-called   Tunnelling Transistor and it actually has already 
gained quite some momentum before I explained how   this amazing technology works as you know I've 
spent the last 8 years working in tech and this   is one of the most rewarding fields of employment 
the technology sector offers high paying jobs and   also the flexibility to work from anywhere in the 
world and TripleTen help you to get a job in tech   even if you come from a non STEM background 
TripleTen is an online educational platform   offering programs in software engineering data 
science cyber security and more their beginner   friendly online boot camps teach you coding and 
provide real projects for work experience what's   amazing that they help you also with resume 
writing and interview preparation that's one   of the reasons why TripleTen students have amazing 
results with 87% of graduates getting hired within   the first six months some at companies like Apple 
Tesla or Spotify and their median graduate salary   starts at $70,000 annually sign up for free career 
consultation with TripleTen expert via the link   below or by scanning the QR code here and check 
out their programs if you use my code ANASTASI   you get 30% off of all their programs so how we 
can improve the current transistor situation and   use Quantum Tunnelling to our advantage here at 
first just as with classical transistor there is   a large energy barrier between the source and 
the drain as voltage is applied to the gate it   modifies the energy bands in the channel at a 
certain point the conduction band in the source   and the valence band in the channel overlap and 
this creates a very narrow energy barrier that   opens up a tunnelling window the key difference is 
that electrons tunnel through the barrier quantum   mechanically as opposed to going over it do 
you still remember the example with a ball   rolling towards a hill so in the case of tunnel 
transistors the ball is tunnelling through the   hill and the energy required to do that is much 
much lower compared to the classical transistor   of course Tunnel Transistors as technology is not 
completely brand new there was research in the   past but the materials that researchers engineered 
in this work are brand new and that's actually how   they achieved this mind-blowing numbers these new 
transistors are made out of 2D material you might   have heard of 2D materials because there is a lot 
of exciting research being done on them right now   due to their amazing properties one of them 
is Graphene for example it has an exceptional   ability to dissipate heat and I have a very cool 
video about it I will link it below check it out   later but this new transistor is based on a 2D 
material called TDM I will put the full name on   the screen because I can't manage to remember 
it and as for why it's so special it's because   it can operate at very low voltages as low
as 0.1V and this actually means much less   power consumption and much less heat dissipation 
and in this work they compared these new devices   with a classical 7nm FinFET devices and the new 
devices are about 90% more efficient and that   has huge potential it's a fantastic option 
for low power applications like edge AI or   neuromorphic computing and we will talk about 
this in the moment there's also potential for   its application in SRAM memory technology due to 
it's very low leakage current it all sounds great   but it's still a transistor design that has to 
go over a complex manufacturing process but I'm   pretty sure Intel can help them with it because 
they've got it under control the main concern I   had by reading this paper is about the switching 
frequency because you know classical transistors   can switch in a GHz range up to THz range but 
these new transistors at the same voltage will   switch in the MHz range that's similar to what 
we've achieved so far with organic transistors   that we print on shirts obviously this won't work 
for high speed applications like in data centers   for example but actually I found some other 
research papers on also tunnel transistors   where they achieved GHz switching speed also 
with tunnel devices but still at the simulation   level while working on this video I read lots of 
research on Tunnel Transistors and they experiment   with different architecturу and materials 
there is even a gate-all-around implementation   similar to the current state-of-the-art transistor 
architecture and even a vertical tunnel transistor   and actually these are the same architectures 
that we see on TSMC Imec and Intel road maps   for now researchers used this new transistor 
design for a neuromorphic chip which implements   brain-like computing you know the idea behind 
neuromorphic chips like Intel's Loihi 2 chip   and IBM's chip is to mimic the human brain the way 
it operates with spikes consuming very low power   these new devices have a potential for almost 
two orders of magnitude improvement in efficiency   potentially reaching closer to efficiency of 
human brain this paper is done in collaboration   with Intel and Intel is actively looking into 
alternatives to Silicon transistors as well as   Imec and IBM I know that IBM is also researching 
tunnel transistors however this is still research   and transition to mainstream technology will take 
quite some time the main challenge is to integrate   the manufacturing of these 2D materials into our 
conventional semiconductor manufacturing flow just   like 70 years ago we didn't know how much of 
a great success transistors would turn out to   be and how they would change the world it's hard 
to say right now what we will be able to achieve   with this new technology but it's properties look 
really promising what I noticed is that technology   is very often underestimated in the long term and 
overestimated in the short term try to guess which   technology I mean here let me know what you think 
about this new technology in the comments I love   to read your comments and now check out this video 
where I explain the coolest silicon chips ever   and one groundbreaking recent TSMC innovation 
with is just going to keep Moore's Law going I will link this video here 
and also below check it out   thank you so much guys for your support ciao

---

## 43. This New Technology Will Keep Moore’s Law Going
**Channel:** Anastasi In Tech | **Views:** 97K | **Date:** 1 year ago | **Duration:** 19:10 | **ID:** ZXtBK-OsR0Q
**Link:** https://youtube.com/watch?v=ZXtBK-OsR0Q

### Transcript:
welcome back to Anastasi in Tech according to 
a new report by McKinsey computing demand will   increase by a factor of at least 100 over the 
next 5 years and chip makers and semiconductor   fabs are putting in a lot of effort to 
satisfy this demand for semiconductors  this decade is all about vertical integration 
stacking chiplets on top of each other and   stacking transistors and that's great for the 
performance but very problematic for cooling   in this video I will explain how different cooling 
technologies are keeping Moore's law alive and the   most interesting of all I will explain some brand 
new Transistor Level Cooling Technology that will   save the chips of the future from roasting in 
their own heat this cooling technology is so cool   that it has its own fan club current and future 
generation of chips have a fundamental problem   by now we've managed to continuously improve the 
performance by packing more and more transistors   into a size of a chocolate square right now 
the smallest transistors are just 2nm and   3nm allowing us to stuff massive 200 
billion transistors into a tiny piece of silicon   but now there is a problem because now there are 
so many transistors that they cannot be used all   at once without the chip overheating and how much 
heat a chip dissipates measured in so-called TDP's   which stands for Thermal Design Power and it's 
actually based on the maximum heat flux that   we can remove from this chip if we take NVIDIA 
H100 GPU it's about 700W TDP and the latest   NVIDIA Blackwell GPU dissipates about 1,000W
of heat and one of the big problems here of   such a chip that while this chip operates half of 
this area half of the silicon is actually   dark silicon, dark silicon is a phenomenon where a 
significant portion of the transistors on the chip   cannot be computing at the same time due to power 
and thermal constraints what makes it even worse   is ongoing vertical integration because the future 
of the chips is in stacking them on top of each other it's all started by stacking chiplets small 
pieces of silicon that have their own function   on top of each other back in 2022 AMD was the first 
to introduce V-cache technology when they stacked   an additional cache memory on top of a CPU die 
and it's all acted as one single chip and the   same trend is happening with chips building blocks 
transistors we are now at the pivotal moment in   the history of transistors where we simply 
aren't able to achieve more with just FinFET   architecture and now we are transitioning towards 
stacking nano sheets vertically and according to   Imec by 2030 we will be stacking transistors on 
top of each other well what are we going to do   with all this additional heat that is coming as a 
result of this just like the current heat wave in   Europe heat is very disruptive what is heat - heat 
is a waste product of semiconductor usage when   an electric field is applied to the transistor 
electric current flows in the channel from the   source to the drain this results in conventional 
Joule heating due to the energy transfer from   the electrons to the latencies while the chip 
performs operations transistors are switching from   one to zero and back right and the power is being 
dissipated in the transistor devices as well as in   interconnect wires and we have to get rid of this 
heat because heat is ruthless to the transistors   and to the chip degrading its performance heat 
damages chips by accelerating the aging of   components and decreasing their lifetime it also 
causes components side to firmly expand which   causes signal distortion and dysfunction and the 
difficulty of removing the heat means that today's   largest chips cannot use all their transistors at 
once so as not to overheat typically what we used   to do is to conduct this heat out somewhere 
and then dissipate it there are many ways to   keep chips cool by far the most popular solution 
involve cooling with air or liquid cooling with   air works for some desktop chips and some of 
these server processors which dissipate about   280W however somewhere at around 300W TDP we reach 
the limit of what we can cool with air alone and   above that we must switch to liquid cooling which 
can conduct up to 3,000 times more heat that air   can this works for example with NVIDIA GPUs like 
A100 which can dissipate up to 1,000W of heat   now air or liquid cooling is what we typically 
think of when we think of cooling but in reality   things are much more interesting and much more 
complicated more advanced GPUs like AMD's MI300 or H100 employ a mixture of cooling strategies 
from my many years working in chip design I can   tell you that the work on cooling starts already 
during the physical design phase here we have to   keep in mind the switching activity of the blocks 
because some of the blocks will be switching more   than the others some portions of the design might 
be more computationally intensive like a hardware   accelerator and this will create a hot spot on 
the die and then we must place this block in a   way that minimizes the peak temperature and also 
the gradient, temperature gradient across the chip   and here EDA Tools (Electronic Design Automation 
Tools) and Power Analysis Tools are very helpful   but that's usually not enough so for 3D chips 
we have to create heat corridors by placing   TSVs in a particular way to help to spread the 
heat evenly so-called TSVs are through silicon   vias which are copper connections that travel 
through silicon die these are used to connect   chiplets in designs like AMD MI300 which has 13 
chiplets stacked together and acting as one big   chip and a similar technology is used in many 
other designs for example in Intel's Ponto Vecchio GPU   TSVs are great because overall you're able to 
gain in performance and latency and of course   you're also gaining in cooling because with TSVs 
we're providing both vertical and horizontal   pathways for heat dissipation but again those are 
made of copper which is four times more conductive   than silicon so they do help to guide some heat 
away but it's not a silver bullet unfortunately   and unfortunately I happen to know that about 70% 
or even 75% of you watching this video are not   subscribed to the channel so could you please 
do me a favor and consider subscribing to the   channel this helps the channel more than you know 
because the bigger the channel gets the bigger the   guests that I can interview for you get thank 
you eventually we end up guiding as much heat   as we can to heat things or cold plates and some 
of the heat sinks have these bizarre fin shapes   because the goal here is to maximize the area of 
the contact so when water is passing through these   plates we can maximize the area of what we can 
actually cool and what's interesting some of the   companies like Fabric8Labs using generative AI for 
designing these fins shapes in the most efficient   way in any case everything has its limits so even 
heat sinks have their limits so if we want to   cool down something very hot like DOJO training 
tile for example which dissipates about 15,000W   of heat which is huge we clearly need something 
more sophisticated and more advanced here in the   case of DOJO it's a whole new level because here 
the cooling is integrated in the package in one   of my old deep dive videos on DOJO I discussed 
that they're use TSMC's integrated Fan Out Wafer  Scale Packaging Technology in this case the cold 
plate is integrated right into the package and   it's placed right on top of the computing tiles 
which generate all this massive amount of heat and   then many tiny pipes so-called inlets and outlets 
are going through the package and then with water   the heat is being moved away through these channels 
so this is an example of one of the recent TSMC   inventions integrated into the package 
sophisticated power delivery and liquid cooling   in case we need to take care of an extra hot chips 
now it's clear that we will see more powerful   chips and more powerful AI ASICs (Application 
Specific Integrated Circuits) coming in the next   years managing the extra heat is going to be one 
of the biggest problems for the electronics moving   forward already now we have to go for immersion 
cooling and have sunk whole racks into tanks of   liquid and the next step is clearly to bring this 
fluid even closer to the source of this heat just   think for a moment how efficient could it be if 
coolant flew inside the processors this approach   is called Embedded Cooling when they bring the 
liquid to the interior of the silicon super close   to the computing cores that are actually running 
the job this is super efficient this idea goes   back to the '90s when researchers from Stanford 
University suggested that heat could be removed   more effectively if we add tiny micro-channels 
onto the chip itself this looked like a potential   quick wind for cooling but back then this 
idea didn't get too much traction however with   advancement of manufacturing process this solution 
has become more and more practical you know one   of the problems which brought us to this point 
now that for a long time cooling and processing   were developed separately and just a few years ago 
researchers at at my favourite École Polytechnique Fédérale de Lausanne brought this idea to the 
next level they designed the electronics and   the cooling together from the very beginning they 
integrated cooling technology very close to the   transistor themselves right near the channels 
where electrons flow basically they engineered   these three-dimensional cooling channels within 
the chip itself right under the active part of the   transistors this is a perfect spot it's just a few 
micrometers away from where the heat is actually   produced and the idea is that it prevents heat 
from spreading throughout the device so a liquid   coolant is pumped through these microchannels 
and eventually the cooling liquid flows inside an   electronic chip a small comment here it's sounds 
really easy in theory but it's really hard to pull   it off in practice without flooding the entire 
thing the liquid they used is deionized water the   one that doesn't conduct electricity of course 
and with that they can handle huge amounts of   heat up to 1,700W per square cm this is multiple 
times heat flux of today's GPUs according to the   paper it improves the cooling efficiency at least 
by a factor of x50 and this will help to lighten up   those dark parts of silicon we discussed before 
eventually boosting the performance and also we   can reduce the amount of energy spent on cooling 
cool yes those GPUs NVIDIA GPUs that up to 500 to   600 TDP can do without this integrated cooling 
but the chips of the future like a wafer scale   designs of the future will definitely benefit 
from this transistor level integrated cooling of   course TSMC is also one of the front runners here 
they're working on a similar and quite interesting   cooling technology they call it "Direct on cheap 
water cooling" basically they are creating micro channels directly on the silicon you see here 
these tiny trenches are edged directly into the   silicon layer on top of the CPU they've tested 
several flavours of this cooling using different   techniques shapes and liquids and they found that 
square pillar trenches perform the best and with   that they able to dissipate up to 2.6 kilowatt 
of heat let me know your thoughts on this new   technology in the comments great technology I 
believe we eventually will come to that that   I'm pretty sure the biggest problem here 
that we will have to adjust the entire   manufacturing process for that and this 
will drive up the costs and will make the   chips of the future even more expensive 
and this technology will be able to cool   down some of the hottest and most powerful 
chips of the future like one of the next   versions of Cerebras wafer scale engine 
for example which dissipates up to 25,000W of heat if you don't know Cerebras it's a 
US based startup and they are building a large AI   accelerator and they're actually one of the most 
successful AI chip startups to date who generate   more cash than they burn you know their latest 
wafer scale engine three chips that they released   this spring is a single gigantic chip of a size 
of 300mm wafer or a 12in wafer and this single   chip is capable of 125 petaflops of AI compute 
by area it's 57 times larger than NVIDIA H100 so   you can imagine how hot it can get in there when 
you have 900,000 AI cores on a single chip now   try to guess how much heat this one generates and 
let me know in the comments actually it consumes   somewhere from 15,000W up to 25,000W so it's very 
hot and Cerebras themselves said that cooling was   one of the greatest challenges they had to solve 
and the solution is quite interesting the wafer   floats on top of the heat sink plate and the heat 
sink has a labyrinth of micro-fin channels and then   the water is pumped through this micro-fins to 
remove heat from the powered wafer although this   chip is about 20 something cm and very thin its 
housing takes a lot of space and this space is   mostly dedicated to cooling it takes about 1/3 of 
a standard track because it includes tubes pumps   fans and a heat exchanger all of which takes a 
significant amount of space then when we talk of   data centers full of NVIDIA GPUs here we typically 
use a mixture of air and liquid cooling combined   with special data center layout and air flow 
management did you know that cooling of data   centers takes about 40% of the total power this 
is huge and this goes to cooling the air and of   course cooling the water and also a vast amount 
of water is being used for cooling like hundreds   of billions of galloons yearly of course a much 
more efficient alternative is liquid immersion   cooling and there are many different flavours to 
it but the idea is simple you sink your entire   system into some liquid some non-conductive liquid 
like dielectric fluid so that liquid can contact   every part of the system and as the system heats 
up the liquid will boil and evaporate this is   a very efficient way of cooling compared to the 
classical one because it's like 50% more energy   efficient and about 61% more area efficient I 
mean the area which is taken by the cooling system   that's why all the Major servers vendors 
are now offering solution optimized for the   immersion cooling however there is a big problem 
with the immersion cooling because at the moment   we're using so-called PFAS chemicals which are 
super toxic they don't naturally break down they   are contaminating environment and water and now 
the industry is moving away from them by 2025 we   should stop the fabrication of the chemicals and 
we are researching alternative solutions which   are more sustainable because we know, we see how 
efficient is immersion cooling and we need some   alternative options here and of course AI models 
also can help us out here for example Google's Deep Mind built an AI model to optimize Google's 
data center cooling they took a lot of historical   data collected by thousands of sensors like 
temperature power pump speeds and so on and   they used this data to train a neural network to 
optimize for power usage effectiveness they've   managed to find some patterns in the workloads 
and eventually used it to optimize efficiency and   eventually managed to reduce their cooling system 
power consumption by 40% this is brilliant now to   the outlook in my opinion on-die cooling what we 
discussed from EPFL and by TSMC these technologies   are the cooling technologies of the future but 
TSMC's innovation pace is incredible and I'm   pretty sure eventually they will be able to pull 
off something like this however there is also a   tradeoff in that that this will also introduce 
additional challenges for the the power delivery   if you don't know now we are transitioning to the 
backside power delivery I have a whole video about   that I will link it below check it out later and 
this backside power delivery making this cooling   challenge even more challenging let me know your 
thoughts in the comments and while we are talking   about hot chips today the Hot Chip conference 
will take place at Stanford University between   August 25th to 27th it's not sponsored I just 
want to bring your attention to this conference   because it's one of the top conferences in the 
industry and you can attend both online and in   person there will be discussions about AI in chip 
design all the recent advances in Hot Chips and of   course about cooling technologies of the future 
if you would like to check out the speakers and   register the link is in the description below 
and if you enjoyed this video I would really   appreciate if you share this video with your 
friends colleagues or on social media and if   you want to go beyond that you can support the 
channel by joining the patreon the link is in   the description thank you so much for watching 
I will be back very soon with a new video ciao

---

## 44. The Death of Computer Memory
**Channel:** Anastasi In Tech | **Views:** 242K | **Date:** 1 year ago | **Duration:** 18:18 | **ID:** x21QpvUjUTQ
**Link:** https://youtube.com/watch?v=x21QpvUjUTQ

### Transcript:
Hi friends, welcome back to the channel last week 
I conducted the webinar for tech investors and   there was a lot of interest in memory technology 
but let me just tell you straight the memory   is dead. That it's a fact and it will affect 
the entire industry and this is a huge problem   for NVIDIA Intel Apple AMD and pretty much every 
chip maker and startup and this is really bad news   because memory is essential for every CPU and 
GPU and every SoC now for the good news there   is a brand new memory technology which may solve 
this problem and it brings us one step closer to   a measure boost in speed and reduction in cost. 
it's super interesting let me explain ever since   transistors were invented in 1947 we've always 
found ways to shrink them down year after year   and we did great job here because the first 
transistors were in the range of centimeters   then micrometers and now we progressed to 
mass producing chips at 3 and 4 nanometers   for example Qualcomm Snapdragon X Elite chip is 
in 4 nanometer process note and the latest M4   chip is in 3 nm and recently TSMC announced that 
they would be ramping up the production of chips   in the new 1.6nm process node and you know what 
for a long time memory was also following this   beautiful trend but not anymore it's over now 
and this is a huge problem for the the entire   semiconductor industry and here I'm talking about 
the fastest so-called cache memory over the past   60 years SRAM has been the memory of choice for 
applications where we need speed and fast access   time a typical SRAM cell is consists of latches 
which are built of usually four to six transistors   it's basically two inverters connected back to 
back with the idea that one keeps the level of   another alive and this architecture differentiate 
it from DRAM so we love SRAM memory because   it tends to perform better and also drain less 
power especially when it's idle it's the highest   performing memory and it's integrated directly 
alongside with the processing cores it actually   stores the data very close to the processing 
cores and here we still use the gigahertz range   clock so we can access this data in the range 
of 250-500ps you see this memory is essential   and here I wanted to make a memory joke but I 
don't remember which one XD and now it starts   to get even worse because the general trend is 
that the amount of memory per chip is constantly   increasing if we look at the all recent chips 
developed by Intel AMD Nvidia and Apple all of   them are adding more and more memory to their 
chips for example Nvidia is adding more and   more cash into each of their new GPU and they're 
making more and more cash XD the problem is that   cache memory doesn't scale as well as the logic 
so it's keep eating up larger and larger parts of   the chips and this is really catastrophic for the 
future now let's try to understand what exactly   goes wrong here? in comparison to all other types 
of memory SRAM is a part of the chip die itself   and it's fabricated in the same process nude 
as a chip logic the chip logic has more or less   followed Moore's law giving us approximately two 
times the transistor density with each processed   node at the same price.. unfortunately memory 
cells doesn't scale at the same rate it was at   some point a factor of 1.8 scaling and then 1.6 
1.4 and with each process node this number has   gotten lower and lower until the point when TSMC 
announced their N3 process node and at this point   it became crystal clear that SRAM scaling is now 
officially dead the N3 node actually delivered   factor of 1.7 transistor scaling and a factor of 
1.0 scaling of SRAM this means SRAM cells stayed   exactly the same size and as we can see from this 
chart bit cell size has an area of 0.021um2 which   is exactly the same size as it's their N5 node 
and what's really sad with their next improved   N3B process node it's scaled by just amazingly 5% 
and this is actually not just the problem of TSMC   because Intel Samsung Global foundies everyone is 
facing the same challenges.. to illustrate how bad   actually things are... imagine an imaginary TSMC 
chip in 16nm and let's assume that 18% of the chip   area is dedicated to SRAM memory if we fabricate 
the same chip the same design in N3 process node   now SRAM area would occupy more than 30% of 
the chips die that's really bad but now let's   understand why this scaling doesn't work simply 
put these memory cells are very special despite   the fact that these cells are constructed from 
transistors they have unique structure that does   not conform to the normal logic design rules for 
each new process node it must be redesigned using   special rules developed by fundies it's a highly 
sensitive device which is very vulnerable to the   manufacturing process variations for example 
two variations in the cell threshold voltage   or dopant fluctuations and any of such variations 
can render the SRAM cell unstable and unreliable   affecting overall yield this situation will not 
improve but most likely will get even worse when   we now transition from our FinFET transistors 
to a new Gate-all-around transistor architecture   because now we have to replace the fins with the 
nanosheets and this introduces many new technical   challenges so I would say at this point of time 
it's inevitable that with each new process node   SRAM memory consumes more cheap area and driving 
up costs from my experience in chip design I can   tell you that area is everything and engineers are 
ready to go above and beyond.. extra mile to save   every single micrometer square of area because 
area = money you know whenever we fabricate   chips we pay price per area and the major issue 
here is that we actually can't do without SRAM   we cannot survive without enough SRAM because 
if a processor core doesn't have enough SRAM it   has to retrieve data from further away and this 
takes more power it consumes more power and also   slows the speed the performance let me know your 
thoughts on this problem in the comments before we   jump in the new memory technology that may solve 
this problem I want to show you something very   exciting. This is the brand new ASUS Vivobook S 
15 and I was very excited to try it because it's   their first Copilot+PC laptop which is based 
on the new Qualcomm Snapdragon X Elite chip in   4 nm it has a dedicated NPU neural processing 
unit and it's capable of 45 TOPS with this new   chip they're bringing generative AI capabilities 
to the laptop first of all it has a Copilot key   which I find very handy you can instantly access 
the AI assistant which can answer your questions,   generate images and create presentations 
for you. this is definitely the future of   tech! here they've also introduced AI powered 
applications to simplify your daily routine   starting from StoryCube for organizing your 
large multimedia library to Asus Adaptive   Lock that keeps your space safe by locking when 
you're away. it also features Cocreator an AI   tool that allows you to draw images in Paint 
and then enhance them with AI. I've been using   the Asus Vivobook S 15 for more than two weeks 
now and what I can say apart of its sleek design   it's a really capable laptop so you can run LLMs 
with up to 13 billion parameters on the device and   the specs on this laptop are great as mentioned 
it has a Snapdragon X Elite chip which is an Arm   based chip paired with 16 GB of RAM a gorgeous 
3K OLED display and 1 terabyte of SSD and it has   tons of ports like HDMI two USB C ports a Micro 
SD card reader and two USB A ports I've taken it   with me everywhere I go and I'm really enjoying 
it you get up to 18 hours of battery life so I   could even take it to my next transatlantic flight 
and work nonstop. So it's a really beautiful piece   of hardware! Make sure to check check it out using 
the link below. so when we realized that we cannot   scale SRAM memory any further we found another 
option chiplets simply putting memory right on   top of the course it was a huge deal back in 2022 
when AMD introduced their V-cache technology and   this was huge because with that we can managed to 
add much more cash memory and here we must give   a lot of credit to AMD for their forward thinking 
and of course some of the credit goes also to TSMC   because AMD used TSMC's 3D SoIC so-called system 
and integrated chips packaging technology to make   this to work they basically stacked an additional 
64MB of L3 cache right on top of the CPU die and   this additional cache gave a huge performance 
boost to many applications including gaming   in general let's agree on one thing this idea 
of stacking one thing on top of each other is   brilliant because this gives you an opportunity to 
mix and match different dies or different chiplets   in different process nodes for example you can 
build a chip in the most advanced process node   for the logic and on top you stack a memory die 
in one of the older process nodes in this case we   can benefit from the speed and transistor density 
and also power improvements in the core logic and   then use some bigger memory on top and this 
memory can even be in the older process node   which means it will be more reliable and also much 
much cheaper and we see this approach adopted by   more and more companies not only for the cache 
but also for other types of memory as well as   for other blocks for analog circuits for example 
because analog circuits also don't scale where   well at least not as well as digital in this way 
we can combine different chiplets manufactured   at different technologies let's say at 3nm and 
at 16nm and build a chip in the most efficient   way possible the truth is that chiplets are great 
and they may help us to reduce costs and add more   cash but it's not really solving the problem 
that's why for a long time now the industry   been looking for an alternative to current memory 
technology so there are several emerging memory   Technologies including magnetic Ram ferroelectric 
Ram resistive Ram Phase-change-memory and others   I used to work with ream resistive Ram in 
the past but what is so interesting about   all these memory flavours that each of them has 
their pros and cons for example some of them are   more optimised for area or speed some for power 
some have faster access rates and higher band   with than others on top of that we know that each 
CPU or GPU features several types of memory and   each of them have different requirements the main 
differences are in their data storage mechanism   and the speed and speed as we know for SRAM is 
essential because SRAM is the fastest with access   times in the range of a few nanoseconds and it 
has to be low power DRAM of course is slower it's   based on just one transistor and the capacity and 
here the excess time is in the range of tens of   nanoseconds and we all know flash memory flash 
memory is the slowest it takes microseconds to   read the data from it and then we also have to 
distinguish between volatile and non-volatile   memory so for example SRAM and DRAM are volatile 
memory which means they only retain data when the   power is supplied so now it's clear that when 
it comes to SRAM the most critical things are   latency area and Power consumption so in this new 
paper published in nature researchers at Stanford   have developed a new PCM so phase change memory 
material called GST467 that uses chalcogenide   in a superlattice structure and it's a great one 
in terms of the properties we are looking for how   does this phase change memory work it's basically 
a memory cell that consists of a glass material   which is sandwiched between two electrodes and 
when we apply high current pulse to it it switches   between the crystalline and amorphous states and 
the crystalline state represents a digital one   and amorphous state zero and then through the 
data we simply measure the resistance of this   memory cell and this new memory technology has 
really high potential because it checks all our   boxes first of all it has very fast access time 
in the range of a few nanoseconds second it works   at a low operating voltage so it's compatible 
with modern processors and then according to   the paper it has the smallest dimensions to date 
0.016 micrometer square and it's actually denser   than for example TSMC's SRAM cells in 3nm process 
node I've actually made some back of the envelope   calculations and from the area point of view 
it's about 23% more area efficient and this is   brilliant the last important thing we always have 
to check with a new technology is scalability and   in this case these PCM cells are compatible with 
the CMOS manufacturing process so it seems it   could be a contender for the ultimate memory for 
example it can be used for the L3 cache memory in   configuration with 3D stacking let me know your 
thoughts about it in the comments and consider   sharing this video with your friends or colleagues 
who might be interested another important point   here apart of the fact that this memory technology 
is very dense it also a nonvolatile memory which   may be a big plus for many applications and on 
top of that it has this unique property where   each cell each memory cell can store multiple 
bits and this multi-level memory sounds like a   dream like a shortcut you know but not in this 
particular case here we must consider that this   property makes sense for analog in-memory 
computing applications only and I will not   go too much into the details here because I have 
many older videos explaining how this technology   works I just want to mention that we can't use 
this multi-level storage properties when we   talk about cash because then instead of a single 
comparator we need to use ADCs and a lot of ADCs   and this will explode power consumption as well 
as the latency which is so important here now   to the challenges of course this is a brand new 
research and there are many technical challenges   remains until it can reach a widespread adoption 
one of the challenges is integrating it in the   current CMOS manufacturing flow then reducing the 
programming current for the cells and eventually   improving reliability but it's a great progress 
so what I think is there is a clear ongoing trend   that we are putting more and more memory memory 
into chips and this is becoming even more critical   with the rise of AI applications despite the 
fact that SRAM memory is quite an old technology   it became the workhorse memory for AI in fact 
many AI chips rely on SRAM memory placed close   to the course and exactly these types of cheap 
architectures suffer greatly from this problem   I believe that SRAM technology as we know it 
won't go anywhere for L1 L2 caches at least   for the next couple of decades so we will see it 
consuming more and more of cheap area and money   afterward we will see new memory Technologies 
coming first to DRM and then to L3 cache as   soon as they can achieve fast enough access time 
in the range of a few nanoseconds let me know your   thoughts in the comments another way to address 
this issue is to look for different options how   to bypass the cash of course this won't work 
for a CPU for example but for some applications   it might be effective for instance in AI 
training the training data is only used   once while the parameters should be accessible 
on chip so here we could find some tricks to   operate without this classic cash memory as we 
know it I think the current dead end situation   is SRAM will compel us to work on further 
Innovations and it's going to be exciting   very exciting to follow so I hope you will stay 
with this channel to stay up to dat with the most   important and critical trends in the microchip 
technology now to support the channel check out   the new Asus Vivobook S 15 with the link below 
or by scanning the code here thank you so much   for your support and for watching and I will 
see you very soon in the next episode. Ciao !

---

## 45. Big News For Quantum Computing
**Channel:** Anastasi In Tech | **Views:** 124K | **Date:** 1 year ago | **Duration:** 21:25 | **ID:** 2dK3ABl-KWQ
**Link:** https://youtube.com/watch?v=2dK3ABl-KWQ

### Transcript:
hi friends in this video I will discuss new 
scalable Quantum technology huge milestone in   Quantum Teleportation and then some brand new 
Quantum devices that use new phase of matter   very exciting first of all researchers from MIT 
made a breakthrough in Quantum Computing they've   developed a Quantum system on a chip that features 
a special type of qubits that are no bigger than   a single atom and this is really interesting 
because you know there are hundreds of quantum   computers being built all over the world and each 
use different methods for building qubits Qubit   is a quantum analog of a classical bit that 
leverage the principles of quantum mechanics   the most popular and mature Quantum technology 
right now is super conducting Cubit and this has   been pursued by company like Google D-Wave 
and many other startups one of the biggest   problems with this technology is scalability so 
the ability to scale to a larger number of cubits   in a system without compromising the performance 
currently the largest quantum computers run on a   few thousand cubits which is still very far from 
making it practical however scalability is limited   by many many factors and one of them is the size 
of cubits so what's wrong with it you know our   traditional silicon chips that I cover in depth 
on my channel like gpus CPUs AI chips they are   made up of billions of transistors fitting on a 
very tiny piece of silicon the fact is that most   of these chips are much smaller than individual 
superconducting cubits so how can we build the   quantum system with millions of interconnected 
qubits that we can control this is exactly the   problem the researchers from MIT are solving 
with tin vacancy cubits let me explain how it   works let's start with the fact that we all love 
diamonds and what is so beautiful about them is   of course their quantum properties a diamond so 
a pure diamond is made of a repeating crystal   of carbon atoms but those diamonds that shine 
the most they have impurities in them and in   this work the researchers from MIT took a diamond 
and imbued it with teen atoms they were basically   bombarding the diamond with tin ions as a result 
we have a diamond with some implanted tin ions and   many vacancies afterwards the diamond was heated 
and so-called teen vacancy centers were formed   and these act as a single entity that has 
Quantum properties and we can actually   control these properties with electromagnetic 
waves for example so let's say a microwave at   just the right frequency can flip a in vacancy in 
center from zero to up or down so in this way we   get qubits that we can entangle and we can compute 
with them you see these structures are just a size   of a single atom so they have much better scaling 
perspectives than any other type of cubits now let   me know what you think in the comments so in this 
work the team from MIT created the quantum system   on a chip that features 1024 of such teen vacancy 
cubits you know over the last couple of years I   talked a lot about this system on a chip concept 
like Apple's M chips with the latest M4 in 3 nm   system on a chip refers to integrating all the 
components like memory processor and iOS into   a single piece of silicon and now we have a 
Quantum system on a chip of course it doesn't   have a memory in a way classical computers do 
because they use quantum bits for both storing and   computing the information so this quantum system 
in the chip features qubits and interconnects so   we connect many of such chips together together 
to scale it up and in the paper they mentioned   that it's possible to connect a thousand of such 
chips to come to a 1 million Cubit Milestone what   is so important here that we want more than just 1 
million cubits we want 1 million qubits with good   fidelity so that they are accurate and reliable 
and that's what's so hard to achieve we will   talk more about that later in the video another 
aspect I find super interesting about this work   that because these diamond colored centers are 
solid state systems they are actually compatible   with our seamless fabrication process and this is 
the process that we've mastered so very well over   the past couple of decades now it's getting 
very interesting because this 1024 cubits fit   into a 500 Micron by 500 Micron area and what is 
fascinating is that this qubid density is actually   close to the transistor density of the most one 
of the most advanced CMOS process nodes they   write in the paper that it's comparable to TSMC's 
and three note wow it doesn't get any better than   that to give you a feeling of what this is like 
here is an example of an older Quantum chip with   49 cubits that is 4 cm to 4 cm of size only for 49 
measly qubits how does this sound let me know your   thoughts in the comments it's worth mentioning 
that what you saw it was one of the older Intel   Quantum chips and Now intel is working on 
Silicon Quantum dots technology which is   extremely promising technology and there have been 
some very exciting advances so we're going to talk   about it in the second part of the video apart 
of the scaling challenges we've discussed two   critical challenges remain it's cooling and error 
correction the cooling is required because qubits   are quite fragile so any noise or vibrations 
from the environment can destroy the information   contained in the cubits that's why we always try 
to protect them and that's why when you're in the   room with a working quantum computer you have to 
stay quiet joking actually by noise here we don't   mean any loud sound we mean random bits of energy 
which can be in the form of microwaves or heat   most of the time the main problem is thermal noise 
and you can actually very well see it from this   equation you can see that it's proportional to the 
temperature and from this you can understand why   we need to try to keep it cool so actually at 
temperatures closest to absolute zero at which   Quantum systems typically operate the thermal 
noise is very low and this is also the case for   vacancy qubits but these can operate at a 
slightly higher temperatures at 4 Kelvin   which is about 1,000 times better but still far 
from a dream of making a quantum computer working   at room temperature now researchers from MIT are 
focusing on further scaling the system of course   but especially on the error correction algorithms 
because at the moment they're experiencing error   rates of about 10%. 10% error rate is basically 
a probability of undesired change in the state   of the qubit so 10% error rate means that every 
10 out of 100 operations result in an error so   10% error rate is actually disastrous in general 
modern quantum computers have error rates from   1% to .1% and we will talk about it later in 
the video because there have been some very   exciting progress but just to give you a 
feeling achieving Quantum Supremacy requires   us to achieve an error rate of one failure 
per trillion quantum operations so we have   far away moreover you typically need more physical 
cubits to build let's say 100 of logical cubits   those that you then can access with algorithms 
and software you see that's why scaling is so   essential now before we discuss a huge milestone 
in quantum teleportation and the special qubits   that leverage a new phase of matter I think one 
of the big problems we face nowadays is a rapid   spread of information that is hard to verify 
internet algorithms make it even worse most of   the time we don't know where information is coming 
from and if it's reliable Ground News the sponsor   of this video is solving this problem they gather 
articles from all around the world in one place so   you can compare how different media outlets cover 
them they also provide context about the news   sources political bias credibility and ownership 
so readers can see how these factors influence   an article reporting and all of this backed by 
ratings from three Independent News monitoring   organizations you can easily stay up to date on 
issues that matter the most to you that's why   I use ground news to stay informed about what's 
happening in the world including technology and   science I think they're a really powerful tool for 
making sure you see the bigger picture so check   them out for yourself go to ground.news/anastasi 
or scan my QR code here for 40% off the same   Vantage plan I use for for unlimited access to 
all their features ground news is independent   and supported by their subscribers so by signing 
up you directly supporting the development of more   transparent and objective media landscape you 
know in general there are different things we   want to do in Quantum ecosystem first of all we 
want to build cubits and then we want to build   a quantum computer out of it and then we want to 
network these computers think about distributed   computing and there have been huge news recently 
so Photonic in collaboration with Microsoft was   able to transfer Quantum information between 
two distant cubits but before we talk about this   success we have to talk about silicon Quantum dots 
as you know quantum computers use quits to store   and process information and there are multiple 
types of cubits like super conducting qubits,   diamond vacancies that we've just discussed in the 
first part of the video, and then there is silicon   Quantum dots technology I'm keeping an eye on the 
last one because it's very promising and that's   the technology that's based on Silicon now if I 
explain it in a layman terms the idea is to take a   transistor and inside isolate a single electron in 
the channel and then using its pin as a state of a   cubit so this technology is basically leveraging 
our standard CMOS technology to build cubits and   this is something we know very well until now 
have managed to scale it down to 1.6 nm and pack   hundreds of millions of transistors in a tiny tiny 
area of silicon so this technology is scalable   for mass production and exact this technology is 
behind this experiment so what's really neat about   the photonic platform is they have what's called 
T-Center so at the core of their device they have   this T-Center and it has a mixture if you will 
of types of cubits right so it has not only a   what we call a spin qubit but it also can emit a 
photon and because it can emit a photon right a   photon can travel right it's light it can travel 
in a in in fiber optics and so what photon been   able to do is demonstrate this in their in their 
platform right for the first time so they have   two separated cryostats there's about 40m of fiber 
optics uh between them so imagine right a a fiber   uh 40m of fiber connecting these two cryostats and 
inside these cryostats are these t- centers right   a Quantum device in each one and so those Quantum 
devices um you can shine light you know shine a   light to excite and and release a photon so each 
release a photon um and once they are detected at   uh at the same time essentially then you perform 
in each cryostat a series of operations on each T   Center and this actually enables the entanglement 
across uh these two cryostats so we call this   um distributed entanglement or the ability to 
do remote entanglement um and you do it right   without having to interact what's inside those two 
cryostats right they interact via the photons the   light that travels across the fiber you know just 
like classical computers quantum computers perform   operations on logic gates and these logic gates 
convert input into a certain output and one type   of a Quantum logic gate is so-called controlled 
nod gate or C not gate this is a controlled nod   operation so what it means is based on the 
value of one of the bits you want to flip   the other bit now in our case these are qubits 
but still the same same idea right if this bit   is zero then don't flip this C this qubit and if 
this qubit is one we're going to flip this qubit   and so basically that's what's done here is is a 
controlled knot operation between the cryostats   um but done by only locally operating on the 
cubits and so we call this a teleported controlled   knot operation in order to scale quantum 
computers to larger systems we need to achieve   entanglement not only between cubits in 
one chip but between cubits located in a   two separate chips and recently Photonic and 
Microsoft successfully implemented it this is   a significant milestone in quantum entanglement 
so as we have these networked uh machines right   and longer distance connection ultimately will 
look like a Quantum Internet that will you know   essentially run alongside your classical internet 
right it doesn't replace your classical internet   but gives additional capabilities on top of your 
classical internet now there is another technology   which is extremely promising for building 
practical quantum computers I don't know if   you heard about it it's a relatively new flavour 
of qubits so-called topological cubits and it's   very interesting because there have been some 
great breakthroughs recently first of all this   type of cubits is particularly interesting because 
unlike other type of qubits we've just discussed   that are based usually on particles such as ions 
electrons or photons these cubits are based on a   topological state or um face of matter with our 
topological qubits um these are based on a very   you know you you would say new type of physics 
right so the idea is actually to create um a new   phase it's called a topological phase right when 
you think of phases of matter you have you know   liquid gas solid we actually engineer a new phase 
of matter in the device it's called a topological   phase of matter so this is a very new property 
it's it's essentially a nanowire um it's it's   a um a superconducting nanowire essentially what 
you're doing is controlling these nanowires and   driving them into this topological phase and 
then what emerges is the ability to use this   as a cubit to put it simple we have a nano 
wire and on both size of it we have Quantum   dots which practically works like a gate in 
a classical transistor it's controlling the   flow of electrons through this wire and when 
we close this gate some of the electrons are   trapped in the wire and actually the number of 
this trapped electrons defines the state of cubit   and the quantum information in this case is 
stored on both ends let's say it's stored   on both ends of this wire and these ends are 
about three microns apart and this is exactly   what makes it resilient because it's very 
unlikely that this noise particle will hit   at both ends uh of this wire at the same time so 
topological cubits promise to be 100 to thousand   times better in terms of noise and this is huge 
for Quantum Computing the thing here is that the   quantum information in this case is stored in 
the properties of the entire system rather than   in the properties of individual particles or 
atoms so it's inherently more stable now these   electrons are very sensitive to any noise from 
the environment or any radiation or waves or   energy hits from the outside that's why they 
added special Majorana particles to the system   these particles have some very unique properties 
that protect these electrons from the noise I've   simplified it a lot of course but this is the 
basic idea behind so by by having this natural   protection at the hardware level we can start at 
a a better air rate right so that physical Cubit   promises to have say one in 10,000 only one fault 
in 10,000 operations at the physical level or   even one fall in a million which is even better 
right so we call that 10 - 5 or 10 - 6 air rate   so that's several you know orders of magnitude 
better than many of the other uh cubits uh in   existence today this new type of Cubit 
essentially uh promises uh really great   scalability right because it has the right speed 
the right size the right controlability and its   fidelity is much better than other types of cubits 
out there today uh and so we believe this is you   know a very promising approach to scaling up now 
of course they need to work on scaling it to a   larger number of cubits and building logic gates 
out of it and eventually performing millions of   quantum operations per second I'm pretty sure 
that Quantum Computing will bring us a lot of   exciting surprises already in this century and 
this will be definitely fun to follow I hope   you will stay with the channel so please consider 
subscribing not to miss the future episodes about   the advances in Quantum Computing and leave me a 
comment below what you think about it as you may   have noticed I took a very long break I was almost 
one and a half months away from YouTube and I have   to say I missed you guys so badly very much uh 
but I was very busy working on a new project um   I've made a huge change in my career and original 
plan was to share it in this video but I want to   wait a bit until things are completely up and 
fully functional for now let's stay in touch   let's connect on LinkedIn I personally love to 
talk to you on LinkedIn guys because I love to   see who is behind the screen you know to whom I'm 
talking to so now I want to make a small giveaway   of the book which I just read beautiful book one 
of the best reads this year uh it's called I may   be wrong so I want to give it away among those 
who leave a comment under the video and you just   mentioned that you want to win a book because I 
know not Everyone likes to read so uh and then   I will send it to you thank you for watching and 
I will see you in the next video very soon ciao

---

## 46. New Disruptive Microchip Technology and The Secret Plan of Intel
**Channel:** Anastasi In Tech | **Views:** 576K | **Date:** 1 year ago | **Duration:** 19:59 | **ID:** FBz0lUP-A9s
**Link:** https://youtube.com/watch?v=FBz0lUP-A9s

### Transcript:
TSMC has just announced 1.6 nanometer technology 
in this video I will explain how these new   transistors work and why from this moment on we 
have to use both sides of the wafer and why it is   huge for the industry? let me explain! almost all 
of the world's chips supply today about 90% of it   comes from TSMC fabs and it Powers technological 
progress as well as AI boom TSMC started making   three Micron Technology in 1987 and just imagine 
three Micron is like 3,000 nanometers and just   some days ago they've announced new technology 
that can enable chips at 1.6 nanometers now these   new transistors involve two big Innovations first 
of all a Noel transistor architecture and backside   power delivery and this is something that has 
never happened before a separation of power   interconnect from the signalling and as a chip 
designer I can tell you it's a big deal for the   entire industry. this is a Mona Lisa no no this is 
a Rembrandt.. no no no I think it's a Michelangelo   right sculpted in Silicon! but to understand the 
complete picture we have to start with transistors   first all modern chips are made up of transistors 
these tiny electrical switches that can be turned   on and off this is what a classical planner 
transistor looks like this switch is controlled   by the gate and when we apply a certain voltage 
or more specifically a certain electric fill to   the gate it opens the gate and the current flows 
from the source to the drain as transistors were   scaled down we shrunk the size of the transistor 
the size of the channel and here we faced many   problems and excessive leakage current is just 
one of them and eventually the solution was to   completely change the transistor structure so they 
took a planar transistor and stretched the channel   up as a vertical fin while in a plannar transistor 
the conductive channel is only on the surface with   FinFET we have a conductive channel on three sides 
while the gate is wrapped around it allowing us to   better control it and of course compared to the 
plannar transistors FinFET transistors are much   more compact so with that we're able to pack much 
more of them into the same silicon die the first   commercial FinFET devices were introduced by 
Intel in 2011 when I was still at university   and wow we're going to talk a lot about the 
competition between TSMC and Intel today because   it's really heating up! so a few years years 
after the first Intel's FinFET device Samsung   and TSMC started fabricating 16nm and 14nm FinFET 
chips and since then TSMC has led the evolution   of fin fat nowadays all the cutting edge chips are 
built with FinFET t however FinFET technology has   already reached its limits in terms of how much we 
can squeeze it in how much the fin can go up and   how many fins we place in parallel side by side 
and again huge leakage became a problem here so   to further shrink the transistors and drive down 
the costs the whole industry is now moving towards   the new gate-all-around transistors I've talked 
about this technology for maybe some years now but   now it's finally moving to mass production TSMC 
calls their Gate-All-Around transistors Nanosheet   transistors but basically it's the same thing 
just a different name TSMC plans to begin the   production of gate all around transistors in the 
beginning of 2025 with the first ones to appear in   iPhones now how does a gate all around transistor 
actually work basically they took the FinFET   structure and turned it horizontally placing 
several of these sheets on top of each other so   that we can multiply the number of fins vertically 
and the best part about it that now the gate is   completely wrapped around the channel the biggest 
gain with this technology is in power efficiency   gate all around transistors consume up to 35% 
less power compared to FinFET technology now   just a few days ago tsmc debuted A16 technology 
on their road map where a stands for Angstrom and   as we discussed in the previous videos this has 
nothing to do with the real dimensions in the chip   and now we are coming to the most interesting part 
so tsmc's A16 technology will be based on GAA or   so-called Nanosheets transistors with one very 
interesting twist backside power delivery and this   is really groundbreaking and yes Intel is doing 
kind of the same thing and we also will talk about   this later in the video but now let's understand 
what is this backside power delivery and why it's   so crucial? ever since Robert Noyce made the first 
integrated circuit everything has been located   on the top on the front side of the wafer with 
all this signal interconnect and power delivery   coming from the front side so this backside power 
delivery is quite a huge change because we will   move all the power line so power mesh underneath 
the substrate to free additional space for the   signal routing on top you know when it comes to 
Modern chips there are billions and billions of   transistors that are interconnected with each 
other and there are many levels of signal   interconnect coming on top of the transistors and 
then there is also power mesh power network on   the top you can imagine it as a network of power 
and ground lines that distribute power across the   semiconductor chip and provides the power supply 
to transistors now imagine if we can move all   this power to the back side of the wafer this will 
reduce the complexity of the wiring interconnect   a lot letting us to place and route transistors 
much more densely so closer to each other and also   reduce the congestion problems and of course this 
concept of separating power from the signal will   give much more freedom to EDA electronic design 
automation tools which are used at this stage and   this means this change will affect not only the 
manufacturing flow but also the chip design flow   itself and this will require a lot of learning 
from our side when it comes to power mesh and   the heat distribution on the chip for example tsmc 
will start producing chips based on N2P and A16   technology which is its version with a backside 
power delivery in 2026 so I'm really looking look   forward to see how it goes and as mentioned tsmc 
is not the only company working on this Innovation   Intel is doing the same thing actually Intel wants 
to be the first even ahead of tsmc to bring the   new transistor technology and power delivery 
tech into production but before we talk about   Intel's strategy and associated costs and risks 
did you know that the advanced gate all around and   FinFET transistor architectures would not have 
been possible without ASM's equipment and process   technology the process of building the most 
advanced silicon chips nowadays includes thousands   of steps and the most critical among them are 
lithography etching and deposition because these   are repeated over and over again as transistors 
are being built on top of the wafer as we scale   transistors down we need to deposed even thinner 
layers and very precise deposition techniques like   Atomic Layer Deposition (ALD) are essential here 
Atomic layer deposition is a special technique   that allows to deposit different materials in the 
wafer atom by atom and with that we can evenly   build very thin layers that are just one atom 
thick can you imagine that and to do that the most   advanced semiconductor faps like tsmc and Intel 
use Atomic layer deposition machines from ASM   and I'm very excited that ASM is sponsoring this 
part of the video ASM is a Dutch semiconductor   equipment manufacturing company and they are one 
of the pioneers of Al technology with a 55% global   market share in this sector they definitely 
deserve credit for their contribution into the   continuation of Moore's law because without their 
machines the advanced FinFET and gate all around   architectures would not have been possible and 
of course in the future when the next transistor   architecture so-called CFET architecture will 
become commercially available and this will   clearly stimulate the demand for the ALD equipment 
from ASM even more you can learn more about ASM   and their products through the link below thank 
you ASM for sponsoring this video now I want to   spend some time talking about Intel's ambitions 
because there some very interesting aspects to   this story as you may know for the last 5 years 
Intel has lagged behind Samsung and tsmc uh in the   advanced chip manufacturing but now this is their 
chance this is their moonshot to be the first   even ahead of tsmc to bring the new transistor 
architecture and power delivery into production   for Intel gate all around technology is coming 
to together with their backside power delivery in   the 20A process node and don't get confused with 
the terminology because each fab has its own name   for gate round Intel calls it RibbonFET but it's 
kind of the same thing and now they're putting   the final touches on it and this 20A node we have 
to watch because it's going to be very important   for Intel and I personally think it's a super 
risky move for INT to introduce two innovations   at once because you typically want to introduce 
it one by one to understand where the problems   are coming from but you know introducing two 
technologies at once is clearly Intel going all   in! and I see a lot of risk here because you know 
probabilities multiply let me know what you think   in the comments and what's so interesting that in 
the past Intel used to be the conservative one and   TSMC see was risky but this time it's completely 
the other way around we also announced that we're   going to get five nodes in four years we're going 
to do something unheard of in the industry to   return Intel to process technology leadership and 
while we're not finished today we see the end is   soon in front of us on that journey and Intel 7 
shipping and ramping in volume Intel 4 with our   core Ultra launch shipping and ramping and volume 
Intel 3 is production certified and we'll be with   our server products launching in the first half 
of the Year going into volume production so with   this we've gone on an incredible journey but then 
it continues into what we call the angstrom era   and for this Intel 20a and Intel 18a the adoption 
of ribbon FET a new transistor structure of power   via power delivery technology but this time 
they really have to deliver Arrow Lake will be   the first Intel CPU to feature their first ribbon 
fat transistors and backside power delivery which   Intel calls power via and as we just discussed 
before the idea is the same the power will be   placed under transistors on the back side of the 
wafer this is all cool but let's be honest from   the entire Intel's road map the most interesting 
note is 14A a because this is going to be the most   pivotal moment for the Intel Foundry to remind 
you it's planned for 2027 and I'm really really   curious to see how it goes for Intel because it 
involves one huge update to the flow one huge and   very expensive elephant in the room 14A will be 
the first process note where intel is planning on   using the new high numerical aperture EUV 
lithography machine from ASML one of this   reportedly costs about $380 million and this comes 
with a lot of risks a part of the risks associated   with the adoption of the new tooling and the 
updates required to the flow the second risks is   economics which haven't worked so far the reason 
why Intel is switching to this machine is that   it will allow them to print even finer transistor 
features EUV lithography machines can print lines   of up to 13 nanometers in width at Advanced nodes 
beyond 3nm traditional EUV lithography machines   will reach its limit and it will require chip 
makers to move to euv multi-patterning and this   is complex and expensive and that's by the way how 
tsmc is planning on achieving N2 and N 1.6 noes   multi-patterning is a technique which often used 
to overcome the limitations of what is possible   with lithography I've talked about it in the video 
about the Chinese Chips it involves several layers   of masking and several wafe exposures to pattern 
a single transistor feature and these new machines   can enable resolutions up to 8nm and with that 
enable more advanced process nodes and Intel   will be the first fab to adapt these new EUV 
machines in their flow now when we talk about   how Chip Economics work and by the way it's a 
super interesting topic and I want to make a   separate video about it if you don't want to miss 
it subscribe to the channel according to Moore's   law the number of transistors on an integrated 
circuit roughly doubles every two years and many   people misunderstand this law and think that it's 
just about a transistor side or the density but   it's actually about the economics it's about 
transistors getting cheaper and cheaper so now   when we consider the competition between tsmc 
and Intel ... the clash of two giants it comes   down to just one simple question who can produce 
it first at decent yield and the most important at   the minimum cost and here they not only have the 
pressure of time but also the cost pressure and   so far considering the cost of the new EUV tools 
and the process adaptation and flow adaptation   required it turns out that high NA EUV machines 
are simply not economically viable as the price   per wafer in this case will be simply too high 
and according to tsmc that's why they are passing   on this machine for now I was reading another day 
that the reason why the price per wafer appears to   be too high because at the moment the lithography 
process with this new machine takes more time   per wafer and this means the fab can process 
less wafer per day and this limiting the fab   throughput and of course is driving up the costs 
to make economics to work Intel must get creative   here and it seems they have some ideas how to get 
around this and make it faster and cheaper their   intention is to use direct self assembly and this 
is very complex process and to be honest I don't   understand it fully because there is a lot of very 
complex chemistry involved the idea is that you   cover the wafer with a special poly material and 
then bake it for an hour or so and when it's baked   these materials self-organize themselves into tiny 
lines and according to some research which was   previously done on this we can use EUV machines to 
help to guide the way it's organized on the wafer   but the main problem is this this approach was 
in the research phase for a decade or so and it   wasn't adapted because the defect rate was just 
too high but I'm really rooting for Intel here   because for everything they did for the industry 
I really want them to make it to work you know   but by now you're already aware of all the 
different Innovations Intel is trying to pull   together at once over the next couple of years 
and how high the risks are but if they manage to   make it to work especially the 14A node this 
will be the pivotal moment in the history of   Intel and this will surely help their stock to 
recover this video is already getting quite long   but just a couple of words what is coming on next 
following High NA EUV machines we will eventually   get to the hyper NA EUV machines let me know if 
you want a video about this one in the comments   after gate all around architecture all the 
fabs will be moving to the next transistor   architecture so-called CFET complimentary FET 
transistor and this one will help us to further   reduce the footprint and I truly believe in the 
vertical future of transistors the idea of CFET   is to fold two nanosheet transistors on top of 
each other vertically to build a CFET structure   intel was the first company back in 2020 to make 
CFET to work stacking NMOS transistor on top of   PMOS in this way they build this simplest logic 
circuit you can imagine a CFET inverter when   input is applied to such a circuit its output is 
a logical inversion of the input so if we have one   at the input we get zero at the output and the 
other way around and a funny fact that already   back then they had to use the backside power 
delivery here and the reason is that when we   stack devices the complexity of the interconnect 
on top just explodes so it's clear that vertical   transistors together with the backside 
power delivery is the future of transistors   and the future of silicon chips I hope you 
enjoyed this episode and if you loved it please   share this video with your friends colleagues 
and on social media I see all your reposts and   I really appreciate it! and let's connect on 
LinkedIn there will be some serious changes in   my career so if you want to know let's connect on 
LinkedIn you can do that by scanning the code here   thank you so much for watching guys I wish you a 
beautiful day and see you in the next episode ciao

---

## 47. Meet Taichi — The Light-Speed Computer
**Channel:** Anastasi In Tech | **Views:** 268K | **Date:** 1 year ago | **Duration:** 18:14 | **ID:** TJ8vywX9asU
**Link:** https://youtube.com/watch?v=TJ8vywX9asU

### Transcript:
Researchers have developed a new photonic chip 
that uses light for computing I've talked about   many photonic chips on this channel but this 
optical chip is something different today I will   explain how it actually works and how did they 
manage to achieve this 1000 x performance? Let   me shine some light on it! when I think about 
light the first thing that comes to my mind is   a warm... warm yellow sunlight and what is colour 
colour is a wavelength of an electromagnetic wave   now some of these waves we can see but most of 
them we can't but the essence of light is photons   this little packets of energy the main difference 
between photonic and electronic computer chips is   that in photonic we use light instead of electrons 
for computation and as we will understand later on   in the video the main difference is that in 
photonic we can compute the data on the fly   we don't have to stop the data like we do it in 
Classical Computing we actually process the data   while it's traveling and this computation on the 
fly is in the range of femto seconds which is one   quadrillionth of a second so it's very fast 
and also at almost no latency you know when   we switched from vacuum tubs to transistors we 
went from microseconds to now nanoseconds but   photonic computer allows us to reduce it to 
femtoseconds let's understand how researchers   came up with this idea and for that let's go back 
in time the first revolution in photonic computing   was the development of the laser the laser is a 
device that turns random unfocused photons into   a powerful focused beam it was invented over 60 
years ago and Charles Towns who is considered to   be a father of photonic got a Noble Prize for it 
but back then there were no real application for   the laser while nowadays we use it pretty much 
every day several times starting from printers   and scanners to quantum computers and extreme 
ultraviolet lithography machines that are used   to fabricate every single silicon chip today 
you know modern chips like AMD CPUs or Nvidia   GPUs would simply not be possible without these 
machines and without the laser just think about   the laser quest.. this is surely worth a Nobel 
Prize don't you think after the laser the second   huge milestone in photonics was the development 
of optical fiber for communication it was first   developed by Charles Kuen Kao, who was also 
later awarded the Nobel Prize in physics for   his contributions he engineered a special quartz 
glass material and it was transparent enough so   that photons couldn't be sent over huge distance 
distances hundreds and hundreds of kilometres and   information travels at the speed of light through 
the optical fiber and there is nothing faster than   that in the world and then they took it to the 
next level and they managed to send multiple   signals at the same time through this same fiber 
and this was possible due to this beautiful   property of light that it has different colours or 
different wavelength of light that don't interfere   with each other so we can s a great amount of 
information simultaneously and this of course also   applies to Computing so the next huge milestone in 
photonics was the development of silicon photonics   because at this point we've already achieved and 
learned a lot with silicon we've learned how to   manufacture silicon chips on a massive scale and 
then there was this idea to take all we know about   semiconductor design and Manufacturing 
and integrate silicon with photonics and   use photons not just for data transmission but 
for the Computing itself because in this way we   can take advantage of this massive parallelism and 
the speed of light that's a brilliant idea right   and of course apart of this a very promising field 
of photonics quantum Computing had begun evolving   which enables the dream of Quantum Computing 
Quantum Computing at room temperatures let me know   in the comments if you want me to make a separate 
episode about it and make make sure to subscribe   to the channel not to miss it now how does this 
Tai Chi chip work it's a photonic chiplet so   it consists of several chips with different 
functionalities combined in a single package   if we consider all the photonics chips there 
are two main approaches to building them it's   usually uses either light diffraction or light 
interference for computing however this chip takes   it one step further and combines both of these 
approaches in a very interesting way let's start   with light interference of course after the great 
success of me talking about light interference in   the previous video I probably should continue 
to ride this wave jokes aside I hope you have   forgiven me anyway many people inferred what I was 
referring to as you know light is a wave and waves   can interact into interfere or overlap if we go 
to the basic level if I have two sinusoids that   are in the same phase the resting wave will 
be twice the amplitude and we will be able to   better notice it because it will be just brighter 
however when I take two sinusoids that have been   phase shifted 180° we have a phenomenon called 
destructive interference and in this case these   two waves cancel each other out and this leads 
to a drop in light intensity or it can even lead   to a total darkness many photonic chips nowadays 
implement this principle of light interference to   implement linear operations so how does it work 
or simply put how we can Implement simple logic   operations with light logic operations on a chip 
usually implemented with logic gates which are   these tiny switches in electronics these are 
built of transistors and a typical electronic   circuit consists of billions of switches that 
iterate between on and off states and each of   these gate has a logical operation behind them if 
we take an end logic gate for example depending   on the combination of the input values we get an 
output as a result for example when both inputs   are ones so one and one we get one at the output 
when the inputs are one and zero, 0 and 1, one   and zero the output is zero in electronics all 
the zeros and ones are represented by voltages by   voltage level so if the voltage is above certain 
value a certain threshold it's one below at zero   and in photonics it works in a similar way but 
instead of voltages we have light intensity so   we measure this light intensity at the output 
and if it's above a certain value then it's one   otherwise it's zero this thing here is a logic 
end gate it has two inputs and one output the   first thing that we do is here we use interference 
uh in this optical combiner and we make sure that   we have a strong field only when both of the 
input are on and then the next stage that we   have here is this micro-ring and this micro-ring 
allows us to make a strong distinction between the   on and the off level so that the next Gates which 
listen to this Gates can understand the signal and   before we discuss how we can use diffraction for 
computing this light I guess you can imagine how   much research goes into a video like this one it 
usually takes me tens of hours over multiple days   and of course I do a lot of fact checking and 
reading beforehand for this I like using Opera   browser because it has some very cool build-in 
AI features first of all there is their AI Aria   with this you can actually get answers to your 
questions directly in your Opera sidebar I really   like this feature because it speeds up my research 
process a lot whenever I read something online and   I encounter a term or concept that is not familiar 
to me I can highlight it and Aria will give me a   quick explanation which I find very handy and then 
after a few hours I have so many tabs open and at   some point I'm just lost but Opera browser has tab 
islands to deal with it I use it to rearrange tabs   into separate Islands on related topic for example 
all the tabs related to photonic computing are   grouped in the first island then all the research 
papers I'm using are grouped in this second island   and all the resources related to the diffraction 
of light are in this third I highly recommend you   to give it a try you can download Opera for free 
using the link below check it out back to photons   there is a second very interesting way a very 
interesting approach to Computing this light   using light diffraction let's say we have a light 
wave that moves through an opening and as a light   passes through it gets diffracted it we can see it 
as the bending of light when it moves through this   opening it's easier to imagine if you consider 
what waves being diffracted photonic diffraction   is basically light waves bending around the 
obstacles and guess what it can be also used   for performing logical operations let's say we 
code input information into the amplitude of the   light and then it goes from the input layer 
through the diffraction layer to the output   each region of this diffraction layer is a special 
metasurface which is assigned with the particular   logic operation for example here we have an or 
logic gate where we have one and zero at the input   which gives us one as the output it's complicated 
yes but it works works but the main drawback   of this approach are that these operations are 
hardcoded hardcoded into this surface and it can't   be reconfigured why this work is so interesting 
because they decided to take the best of both   methods light interference and light diffraction 
and combine it in a single Tai Chi chip first we   need to encode input data into light and usually 
this coding step is a weak spot in photonic   Computing because this conversion from digital 
to analog so from digital to light is error   prone and it's very hard to make it as accurate 
as Digital Signal processing but in this case   they used light diffraction on a chip to encode 
information into Optical patterns and because it's   a fixed algorithm they can implement it through 
diffraction by using diffraction surfaces so what   happens is that just the light passing through the 
diffraction layers and it's been encoded on the   fly at almost no energy and in a massive parallel 
way so this is as good as it gets then for the   Computing Parts they use light interference you 
know when we talk about any AI related computation   we mostly mean the operation with matrices 
there is also another nonlinear part which is   the activation function and you can't ignore it as 
well but the most of the operations are operations   with matrices in neural networks everything is 
represented by matrices for example if we want   to do image recognition to know what's on it we 
need to multiply matrices together and sum up the   result for this chip to implement this multiply 
accumulate operation with photonics the first   encode the input information into the amplitude 
of light and then this light is passes through   so called Mach-Zehnder interferometer and as you 
may guess from the name this device operates based   on the light interference this device splits light 
into two path then then rejoin and split again and   you can alter the light that passes through one 
of these path to multiply the light with a certain   value so we multiply the input matrix through this 
MZI cells with the weight and then sum it up with   the optical attenuator and finally we decode the 
result through the diffraction layer and the most   interesting thing here is that classical computers 
operate in serial fashion means one operation   being performed after another one and in this case 
to perform many operations in parallel we need to   have many GPUs for example to compute in parallel 
but when it comes to photonic computing by its   nature it can perform many operations in parallel 
because we can compute at multiple wavelength of   light at the same time and that's brilliant now 
what differentiates this chip from photonic chips   that we discussed in the past first of all it can 
perform more advanced Computing tasks if we take   AI application as an example previous Optical 
chips were able to handle hundreds of thousands   of parameters while this new Tai Chi chip can 
handle up to 14 million parameters this means   it can perform much more advanced tasks when it 
comes for example to image classification they've   tested the chip with the data set which contains 
thousands of different handwritten characters from   50 different alphabets and this chip was able to 
perform image classification with 92% accuracy   which is great for a photonic chip because it's 
analog and one of the main problem with analog   is exactly the accuracy for example not that long 
ago I was reading a paper research paper about   the light matter Chip And as far as I remember 
the accuracy was back then about 80% and you see   in this work they achieved already 92% moreover 
researchers tested this Tai Chi chip on generative   AI tasks and this is very interesting because you 
can really see that this photonic stuff actually   works this chip can produce music in the style of 
German composer Bach and it can already draw or   more accurately to say generate landscapes in the 
styles of Vincent can Gogh and Edward Munch who is   well known for his famous painting this cream and 
while this chip was performing these operations   they've measured it and is capable of 16o TOPs 
per watt and if we look at the performance   comparison from the paper it's reportedly more 
than 1,000 times more energy efficient than any   of the latest Nvidia H100 gpus and then when 
they compared it to the previous research it   turned out to be roughly 100 times more energy 
efficient and 10 times more area efficient than   previous photonic chips and you know area is 
one of the biggest problems when it comes to   photonics you know while this chip itself is quite 
compact the entire system is not because they have   used a Laser Source right and this can be the 
size of the whole table and I don't know which   exactly laser they used but in general it can 
consume up to one kilowatt and this crashes all   the efficiency gains we've just discussed you know 
all these Optical components in general are quite   bulky for example this MZI cell we discussed is 
about 50 micrometer dimensions so it's huge when   we compare it to the world of the semiconductor 
chips where we have transistors in the range of   nanometers and quite some cheap logic can fit on 
the area of a single photonic device and of course   many faps and many researchers are working on the 
further miniaturisation of photonic components   but it's still nowhere near the conventional 
computer chips however as we saw earlier this   ability to perform multiple calculations at 
the different wavelength of light is a great   alternative way to scale the computing without 
just scaling the number of components so it can   compensate for that all in all it's a great work 
first of all they've built a chiplet that can   run neural network with millions of parameters 
and from the paper I can see that they have an   idea how to scale this chip further and yes it's 
clear that it's just for inference application   right now and it won't be in your computer at 
home tomorrow but it's a building block to to   to create the next generation of Technology if 
you've ever enjoyed my videos please share it   with your friends and colleagues and on social 
media this helps the channel to grow a lot   now check out my previous video which many of you 
enjoyed a lot where I explain how we can scale  

---

## 48. Scaling Beyond 1nm
**Channel:** Anastasi In Tech | **Views:** 269K | **Date:** 1 year ago | **Duration:** 16:10 | **ID:** Gzkb3Zc8pGE
**Link:** https://youtube.com/watch?v=Gzkb3Zc8pGE

### Transcript:
Researchers have developed a new kind of 
transistor that hardness Quantum effects   and this is very interesting because they 
were able to shrink this device down to the   size of a single molecule which is about 1 to 2 
nanometers and it appears to be a possible way   to scale beyond 1nm technology in the Physical 
Realm not just in the performance metrics. As a   chip designer I'm beyond excited you know because 
the future of transistor is our future. Nowadays   microchips are simply at the heart of every single 
electronic device you can imagine and each of them   is built of transistors the tiny devices that 
are used to build everything from simple logic   gates to CPUs and GPUs for the last 40 years 
we've been shrinking the size of transistors   to be able to fit more computing power into 
a smaller chip right now we are at about 200   million transistors per square mimer of silicon 
and we are at about 200 billion transistors per   GPU at the same time we already have AI chips 
built of 4 trillion transistors can you imagine   that that's an impressive number however lately 
it was getting even harder and more expensive to   pack more transistors into a silicon die. and 
there are several limiting factors here one   of them them is manufacturing process we need to 
engineer more advanced lithography tools as well   as improve other manufacturing steps but I'm 
certain we can solve it however as transistors   are getting smaller and smaller another huge 
problem pops up we bump into the effects of   quantum mechanics and there are actually many 
challenges that pop up in this intersection   between classical electronics and quantum physics 
in dealing with transistors under 7-5nm in size   Quantum effects start to become apparent which 
cause unusual and sometimes unexpected changes   in how electronic devices behave and it's already 
an issue for the devices under 10 nanometers but   this problem becomes huge when we approach 2 to 
3 nanometers one of the main effect that appears   is quantum tunneling this is a phenomenon when 
electrons can pass through barriers which would   usually block their flow in classical physics. 
here is what a classical planner transistor   looks like and when we try to scale it down this 
means in practice the scaling of the gate length   as the gate length is reduced and the gate oxide 
layer becomes thinner electrons can tunnel through   the barrier even when the transistor is switched 
off and that's a big problem because practically   it means you can't switch it off completely it 
still leaks out you you know it's a so-called   leakage current which basically wastes energy 
and degrading the performance and do you know   why this is happening this is happening because of 
the Dual nature of electrons because they exhibit   characteristics of both particles and waves at the 
same time and for the gate length under 1nm their   wave nature becomes prominent and here we step 
into the realm of quantum physics and this part   is super interesting and we will dive deeper into 
that later on in the video but this practically   means that we have this leakage current and we are 
losing power even when the transistor is switched   off but this story is getting worse and worse as 
we continue shrinking transistors because it's an   inevitable effect of miniaturisation and here you 
might think well Anastasia what are you talking   about we already have transistors of 3 nm for 
example from TSMC and Intel already has a road   map towards 20 Angstrom transistors by the way 
an angstrom is 1/10 of a nanometer which means   it's about the size of a single atom you might be 
wondering how is it possible considering all the   challenges which we just discussed and you would 
be right when it comes to nanometers it's really   not that simple today in the today's video we are 
talking about literally shrinking the transistor   so shrinking the classical planner transistor you 
know this Quantum-based transistor we discussed it   really has a the channel of the gate length below 
one nanometer but in general to be honest this   nanometer concept nanometers haven't meant much 
for quite a long time already you know originally   we had this classical planner transistor where 
we have a drain a source and the gate and all   arranged in a single two-dimensional plane and 
when we apply a certain voltage to the gate the   channel becomes conductive and current flows 
through the channel and if we take a planner   3nm transistor its channel length will be around 
32 nanometers but as a planner transistor were   scaled down we had many problems with it and this 
excessive leakage it just one of them for example   instead of being on and off it was bright and 
dim and eventually the solution was to change   the transistor structure completely to move from 
the planner transistor structure to a more complex   3-dimensional structure and as a result of this 
the first FinFET 22 nanometer transistors were   developed by Intel and they called it FinFET 
because the transistors aource drain structure   were stucking out of the wafer like a shark's 
fin ever since then the nm term has increasingly   lost its meaning now in a 7nm FinFET transistor 
you won't find anything that is of actually 7   nanometers it's actually not 7 nanometers across 
that's just a marketing term that indicates that   you would need a planner transistor that small to 
achieve the same performance and logic density as   this 7nm FinFET device but now what happens when 
we shrink the actual transistor gate to 7nm 5nm   2 or 1 nm, so that a single molecule can fit in 
there well so far it didn't work and there were   a lot of researchers working on mitigating this 
Quantum effects but just think for a moment what   if instead of fighting it we can use these Quantum 
effects to our advantage and this is exactly the   idea behind this new transistor the new transistor 
is built from two pieces of graphene connected by   a single molecule and it uses Quantum effects 
to switch between two states on and off and the   most interesting part the fact that they utilize 
here to switch it on and off is called Quantum   inference before I explain how this new transistor 
works and where I see the future of this   technology did you know that every time you go for 
a coffee or travel and connect to a public Wi-Fi   network your personal and your banking data are at 
risk it's a public access with no security control   so everyone nearby can access it and monitor what 
you're doing that's where surfshark VPN comes in   handy it encrypts your personal data and keeps you 
safe on public Wi-Fi networks another cool feature   of surfshark VPN is that you can use it to access 
content that may be restricted in your location   by swapping the IP address for example when you 
travel you can still connect to your home server   and enjoy your streaming collection if you want 
the freedom to access content from anywhere in   the world I highly recommend trying surfshark 
VPN and for you they're currently offering an   exclusive deal go to surfshark.deals/anastasi to 
get three free extra month to the subscription   using the code anastasi check out the link in 
the description below and thank you Surfshark for   sponsoring this video you know as we discussed in 
a very small scale electrons exhibit both particle   and wave properties and when an electron travels 
through a very small 10 nanometers channel its   wave nature dominates and when it acts as a wave 
there is always inference as for what inference is   you know waves can interact and also overlap if I 
try to simplify it to the most basic level imagine   you have two sinusoids and you add them together 
when you add them and both are in phase the   result is twice the amplitude this is so-called 
constructive inference for example imagine you   have a friend who is very motivated and brilliant 
and he or she is an expert in a bit different   domain than you are but together as a team your 
strength are multiplied and that's beautiful on   the other hand if you add two sinusoids that are 
180° phase shifted they will cancel each other   out and this is so-called destructive inference 
what's interesting you don't often hear about   inference when we talk about Quantum Computing 
we mostly talk about entanglement tunneling and   superposition but inference is not there we don't 
talk about it but it's quite easy to comprehend   because we face it in our everyday lives you 
know when someone is using noise cancelling   uh headphones that's exactly how it works because 
it's one wave cancelling another you know in the   headset there is an integrated mic that listen to 
the noise record it invert it and place it back   to your ear so they built a transistor based on 
these two states and the states are controlled by   the voltage applied to the gate and this applied 
voltage changes the phase of the electrons that   behave as waves through the channels how it 
actually works when the transistor is switched   on electrons interfere constructively so they 
can flow from this source to the gate through   this molecule when it's off electrons in the 
channel interfere with each other destructively   meaning that they're canceling each other and 
the transistor is off in this case completely   off and there is no linkage current and actually 
this is one of the main claims of this work that   they were able to develop a device that has almost 
no leakage current and that's a big deal and you   know usually destructive inference is considered 
to be a bad guy but here they managed to turn it   into something really useful so to me this work 
is super interesting and if you know about my love   for transistors and quantum physics no surprise 
right but the surprising fact here is that that   they've managed to build a really good device so 
what do we call a good transistor you see this   curve showing the current versus applied voltage 
is very steep which is not usual for small process   nodes so technically from this perspective it's a 
very good transistor but it comes with the strings   attached first of all at the moment they have 
no clue how to connect these transistors and of   course a single transistor is of no use because 
you can't do much with it you need to connect   many of them into logic gates like AND, XOR, Etc 
and they are figuring this out right now however   there is another huge elephant in the room and at 
first I didn't quite get it I was like wait why do   we need to cool it you know intuitively I thought 
maybe because Quantum effects behave better and   also better absorbed at cool temperature that's 
why they have to cool it down to 30 Kelvin which   is what minus 240° C or about 400 something 
Fahrenheit depending on where are you in the   world however from the paper it seems like this 
limitation comes from the material itself in the   case of graphene at higher temperatures there is 
noise fluctuation and charge trapping happening   at the ages of graphene and deteriorating the 
performance of the trans resist that's why all   the measurements are in the range from 30 to 100 
Kevin another thing that I was very concerned   about is switching frequency because it's quite 
important you know and in this works I mentioned   the switching frequency of 7kHz and that's of 
course not useful modern transistors work at   tens of gigahertz range but as I understood in 
this case this is limited just by the current   setup and these transistors can work up to 
terahertz range which is reasonable number   but in practice this THz switching frequency can 
never be achieved because of the interconnect   parasitics this is the main limitation I talked 
about this in the previous video that's why we   see even in the smaller process nodes like in 7, 
5nm the operating frequency doesn't increase and I   imagine only computing with light can get around 
this all in all it's a very interesting attempt   and as transistors will be getting smaller and 
smaller these Quantum effects will dominate and   this new technology seems like a possible way to 
scale Beyond 1 nm in a physical real dimensions   you know and this is really exciting the future 
of transistors is our future because these   transistors are the most fundamental building 
blocks of the modern electronics and our success   in its continuous Improvement is fundamental for 
the advancement of technology and for the future   of our civilisation let me know what you think 
in the comments and I will leave some links in   the description below so check it out I'm pretty 
confident that we will see more and more research   that tries to take advantage of this Quantum 
effects and using inference in this case is not   a new approach they have been similar works in the 
past this one appears to me like the first real   transistor with decent characteristics those there 
is obviously a long long way to go until they can   enter commercial production another thing I'm not 
entirely sure about the materials they used here   to be specific about this single molecule that 
they trapped between the electrodes honestly I   don't know much about this because I don't have 
a degree in chemistry maybe you guys can help me   to determine if this material is something viable 
or not so if you're an expert please let me know   in the comments so this was quite a geeky video 
right but quantum physics is a fascinating field   that has many implications and you know this idea 
that quantum entanglement can be responsible for   the interconnectedness of all the things including 
the connection between our thoughts and the world   around us and I would love to understand it 
way better than I do now let me know what you   think and if you want let's connect on LinkedIn 
all the links are in the description below ciao

---

## 49. Why GPUs Keep Getting Bigger
**Channel:** Anastasi In Tech | **Views:** 165K | **Date:** 1 year ago | **Duration:** 21:49 | **ID:** zXNUBFoNPX0
**Link:** https://youtube.com/watch?v=zXNUBFoNPX0

### Transcript:
We need bigger GPUs last week was an incredibly 
huge one in tech and as a chip designer I'm beyond   excited so today we will have a look at the three 
hottest headlines of the last week the new Nvidia   Blackwell GPU why is NVIDIA going for larger chips 
and making some serious tradeoffs? then we will   discuss the new 4 trillion transistor chip from 
Cerebras and the new kind of analog chip we were   all waiting for. NVIDIA is now at the top of the 
world we've never seen such a profitability from   a hardware company right that's one of the reasons 
why my Investment Portfolio looks so great and now   they've revealed their new Blackwell GPU. 208 
billion transistors and so so you could see see   you I can see that there's a small line between 
two dies this is the first time two dies have   been like this together in such a way that the two 
chip the two dies think it's one chip this new GPU   providing four times the training performance and 
up to 30 times the inference performance compared   to the previous generation the Hopper GPU first of 
all let's discuss how did they manage to achieve   this fourfold performance. as a first step to 
double the performance Nvidia has to double   the area huh right but that was an expensive 
decision because the price per chip is actually   the price per area which depends of course on the 
technology note and the volume in fact Nvidia had   to keep using the n4p process by TSMC n4p process 
is a refined version of the N4 with a 6% yes just   6% transistor density boost and 22% more energy 
efficiency over the N4 unfortunately Nvidia had   to stay at this process node because TSMC is 
currently struggling with this 3 nm process to   be specific they are struggling to achieve 
the satisfactory yields and this of course   impacts not only Nvidia but also the road maps 
of AMD Intel and other chip makers in a bid to   maintain its competitive advantage Nvidia had to 
introduce use double die design which is packaged   using TSMC's Chip on Wafer on Substrate CoWoS-L 
packaging technology this packaging technology   is used to integrate multiple dyes side by 
side to achieve better interconnect density   and with that you can achieve high speed and 
high bandwidth communication between the chips   compared to conventional packaging methods that's 
how they achieved nearly one single silicon now   if we can see consider the dual die design 
and the packaging the cost of fabrication of   this GPU more than doubles more than doubles in 
comparison to the previous HOA GPU so they will   be definitely not getting to their legendary 
85% margins as they used to and they had to go   for this tradeoff for this painful tradeoff to 
maintain their competitive advantage because as   we will see the competition is hitting up. all 
the hyperscalers are now developing their own   custom silicon like Amazon Google Meta everyone 
is designing their own AI chips and also as you   know AMD and Intel also want to get the piece 
of this pie startups like Cerebras and Groq   also have some solid alternatives so yes Nvidia 
is definitely a leader in AI hardware and making   great efforts to stay so but the competition will 
not let them to rest for a moment. we've seen that   doubling the silicon doubles the performance but 
where the second double fold is coming from? it   definitely doesn't come from the new process 
node but rather from the new numbering format   it's coming from lowering the precision of the 
whole calculations you know we can encode the same   number in let's say 8bit 20 bit or in 4bit just 
what will change is the precision but for the most   calculations within the neural network it's not 
really essential to compute let's say 20 digits   of which number the network can accomplish the 
same task at the same accuracy at a lower level   of precision and that's precisely the trick here 
if we lower the precision of calculation let's   say instead of 8 bit numbers we will be using 
4-bit numbers we can immediately save the half of   the memory because smaller numbers requires less 
energy to compute requires less memory bandwidth   and the logic which is required to do this math 
takes up less silicon in the previous Hopper GPU   they've used floating point numbers up to 8bit 
precision but with Blackwell GPU they've taken it   one step further in the new Blackwell architecture 
the matrix multiplication units doing math with   numbers just 4 bits wide this is another area from 
where the improvement in performance comes from.   honestly 4 bits is quite low and that makes 
me curious to see how well it's going to work   for inference application for example let me know 
what you think in the comments to summarize it the   improvement in performance coming from connecting 
two GPUs together supporting very low Precision   FP4 format a massive amount of high bandwidth 
memory and improved interconnect bandwidth as   simple as that this GPU and the super computer 
DGX Superpod built out of it will be available for   sale later on this year in one of the interviews 
Jensen hang said that they're going to price it   somewhere in between 30 to $40,000 and I have many 
doubts about this first of all since the h100 was   selling for about 40,000 last year so Blackwell 
is likely to be priced higher than that for now   I'm really looking forward to see the real world 
benchmarks we are discussing different AI chips   today but just to give you a feeling of how 
high is demand for AI infrastructure is there   is a recent quote from TSMC's founder Morris Chang 
regarding the demand for AI chips he says we are   not talking about tens or hundreds of thousands of 
wafers but instead building three five or 10 fabs   but we need bigger GPUs now let's discuss the new 
starting 4 trillion transistor chip from Cerebras   this one is pretty unique and they are crashing 
the Moors low you know that since the advent of   microchips in 1972 the semiconductor industry 
has followed Moore's law it states that the   number of transistors on a chip is able to double 
roughly every 2 years as you can see from this   plot Cerebras seems to be outperforming this law 
which many had believed was no longer applicable   their previous chip was fabricated at 7 nm by 
tsmc and the new one the wafer scale engine 3   is at 5 nanometers the number of transistors on 
the chip is more than doubled since the previous   generation thanks to the technology node upgrade 
but as we know a huge success of this chip is a   success by tsmc which is able to fabricate such a 
giant gigantic chip at 5 nm with a high yield one   of the reasons why Cerebras was successful over 
the last years is that they were doing things   differently than others while a silicon wafer can 
typically accommodate many chips and that's what   typically AMD Nvidia and Intel are doing they 
are cutting such a 300 mm wafer or 12in wafer   into let's say 65 gpus while Cerebras takes this 
wafer and makes a single giant chip out of it to   give you a feeling of the scale of this this is 
the new Cerebras chip next to the Nvidia h100 GPU   it's 56 times larger than Nvidia h100. Amidst 
the ongoing AI boom there are many promising   tech startups you may like to invest in such 
as cerebras but the problem is that investing   in private equity generally is not easy however 
Linqto removes these barriers making the access   to private markets simple and open to everyone 
through Linqto platform you can invest in some   of the most promising AI Tech startups I've 
discussed on my channel such as Lightmatter   the photonics AI startup I disc discussed in the 
previous episode in addition you can invest in   SambaNova Spark cognition and others you can 
check out the full list of startups on their   website if you're interested in investing in 
the future of artificial intelligence consider   starting your private equity portfolio today using 
the link below by using the code ANASTASI500 you   will receive a discount $500 off on your first 
investment the code is valid for 30 days only   thank you Linqto for sponsoring this video 
the rate at which we're advancing Computing   is insane and it's still not fast enough so we 
built another chip Hopper is fantastic but we   need bigger GPUs going for larger silicon is 
such a great idea and it totally makes sense   for today's AI workloads and Cerebras was doing 
it before it became mainstream it's beneficial   because many GPUs have to be used for a single AI 
task and interconnecting them and distributing the   load is a complex and expensive task to do but 
by having one giant chip you can significantly   reduce the costs and complexity needed this new 
Cerebras chip features nearly 1 million AI cores   900,000 AI cores and 44 GB of memory and when 
it comes to memory in this case it is on chip   memory that is intertwined between the computing 
cores and this has exactly the same goal that we   discussed in many of my previous videos to keep 
the memory and the computing cores as close as   possible together to reduce the bottleneck and 
that's another architectural difference compared   to Nvidia and AMD gpus which have off chip memory 
this new AI chip is designed to train the Next   Generation of giant large language models with 
up to 24 trillion parameters in size just think   about it it's 10 times larger than open's AI 
GPT4 and Google's Gemini the next step is to   connect 2048 of such chips together to build an 
AI supercomputer and this one will be capable of   reaching one quarter of a zettaflop (10^21) 
performance as one of my colleagues like to   say oh dear such machine for example could train 
a 70 billion parameters llama model from scratch   in one day it's pretty clear that the trend is 
headed towards larger silicon but the thing is   with the larger silicon that whenever I talk 
about cerebras for example you always ask me   about the yield about the defects and you're 
totally right the bigger the Silicon gets the   greater is the yield challenge in especially for 
the small process nodes like sub 10 nm because   then the transistor features become so uh fragile 
and so tiny that a single particle a single Dust   Landing on a chip or a single defect in a chip can 
kill not just a transistor but a large part of the   circuit can you imagine that and obviously you 
cannot get 100% yield and this would mean that   cerebras would have to scrap every single wafer 
this would have been such a disaster anyway   Cerebras manages to sell every single chip that 
they make and whenever defects occur they have   a workaround a defective AI Core can be bypassed 
in the software and then replaced with one of the   Redundant or so-called spare course this way 
you always get a configuration of 900,000 AI   cores with no wafers wasted and of course Nvidia 
is facing the same challenge which is a headache   for tsmc and that's the reason why they didn't 
get to uh three nm process because the yield is   at I don't know 80% so it's quite poor eventually 
they were able to find a tradeoff let me know what   you think in the comments and if you're enjoying 
this video consider subscribing to the channel   and sharing this video with your friends and on 
social media this helps the channel a lot thank   you it's clear that AI is in desperate need for 
a Hardware Revolution and everyone is looking for   a type of architecture that can mimic our human 
brain because our human brain is still the most   efficient engine for non-artificial intelligence 
we've known for decades that analog can be much   more energy efficient and area efficient than 
conventional digital chips if so then why analog   chips haven't become mainstream yet well because 
there are a plethora of problems we've discussed   them in my previous videos we will also talk about 
it today but the new in charge chip addressing the   most of them and also taking analog Computing to 
the whole new level first of all many Computing   tasks and especially generative AI requires 
tons of memory tons of memory to deal with data   and parameters of neural networks these computing 
tasks are dominated by just a few basic operations   that draw on memory the cost of accessing the 
memory can be orders of magnitude higher than   the energy expanded on the computing operation 
itself now what if we could make this memory   intense tasks more efficient and by that make the 
overall thing orders of magnitude more efficient   one of the emerging approaches addressing this 
memory bottleneck is near memory or in-memory   computing and that's usually implemented in analog 
fashion analog means that instead of operating   with digital signals like zeros and ones and 
conventional transistors analog chips are working   with continuous signals and a continuous signal 
can be anything between zero and one and then   we use analog circuits which are consisting of 
for example resistors and capacitors and the new   EnCharge chip is taking this concept to the new 
level actually the main the key operation that is   at the heart of AI programs is so-called matrix 
multiply accumulate operation you may remember   talking about it in many of my previous videos so 
you probably already know it what happens is that   a chip loads input values into the memory and then 
multiplies these values by so-called weights many   such multiplications are performed in parallel 
and then the result the output is added so added   up this is known as accumulate operation and there 
were already many and many attempts in the past to   implement this operation in analog way for example 
the Mythic chip which I previously discussed it   performs multiply accumulate operations in 
an analog circuit using resistors and then   sums up the currents at the output however along 
with this various problems associated with noise   mismatch accuracy cropped up Mythic has really 
struggled really struggled to find solutions to   these issues over the last years and eventually 
they pivoted to a different application well and   charge approach is different their computing 
is carried out using charge-domain computation   with metal capacitors and I think it's a great 
idea let me explain instead of performing the   entire Matrix multiply accumulate operation in 
analog they're performing multiply operation in   digital with transistors and then the accumulated 
operation is implemented in a very interesting way   in analog using capacitors and the trick here is 
that instead of adding up currents at the output   they are adding up the charge in a capacitor so 
they're basically accumulating the charge in the   capacitor which is a great thing to do because 
it's quite easy and precise and moreover they're   using the capacitors which are coming anyway for 
free you know billions of transistors on a chip   they are interconnected with the metal wires 
which can be seen like a multi-level highway   with up to 10 or 20 layers deep and in this chip 
they are utilizing the capacitors which are made   of the parts of this metal interconnects that sit 
on top of the transistors and the best part about   this that these metal capacitors are really easy 
to deal with they don't have any uh temperature   dependency so company mismatch and the size is 
very well controlled with the CMOS technology   so it's a good element in general you know and 
the best part about this that they're performing   analog computing using digital technology which 
is very Advanced which which is easy to deal   with with all the EDA tools that we have now 
and they've already made a first prototype of   this chip which is reportedly showing a striking 
Improvement in energy efficiency it's capable of   150 trillion operations per second per Watt which 
is at least 20 times more energy efficient than   previous analog chips like Mythic for example on 
top of that they've also built a software stack   for it that manages this whole access to the 
memory and their first commercial product is   already coming later on this year looking forward 
to it as a first step they are targeting inference   applications which means taking an already 
pre-trained model and running it locally on   the chip And here the main goal is to make it more 
energy efficient and that's exactly what Analog   Computing is good for and it's such a low power 
you can put it to the age devices for example to   your phone but afterwards according to the end 
charge this approach can also be scaled to the   AI training I really love this approach when 
I read it I was like that's good because the   trick is that in CMOS technology a capacitor 
is the most reliable thing you can really get   and in general this approach takes the Best 
of Both Worlds analog and digital and as it's   based on digital it can also scale quite well 
you know it's been a dark time or you call it   also winter for analog technology I think but now 
it's getting warmer and the spring is coming and   as always I'm looking forward to reading what 
you think about this technology in the comments   I love this decade the decade of technological 
acceleration and I love making the videos about   it you know for you guys and to build the 
community around this channel thank you for   being a part of it and if you want to support the 
channel me creating these videos you can check out   the patreon the link is in the description below 
and also check out the sponsor and if you want   let's connect on LinkedIn honestly I never used 
it but I changed my mind so if you want you can   scan this code and uh let's connect thank you so 
much and I will see you in the next episode ciao

---

## 50. New Photonic Chip: x1000 faster
**Channel:** Anastasi In Tech | **Views:** 291K | **Date:** 1 year ago | **Duration:** 12:24 | **ID:** 8ohh0cdgm_Y
**Link:** https://youtube.com/watch?v=8ohh0cdgm_Y

### Transcript:
There is this new paper in Nature that everyone 
is talking about as a chip designer I became very   curious about it myself it is a new Photonic chip 
that combines two concepts ultra-high frequency   radio waves and light in one single chip and 
according to this paper it's up to 1,000 times   faster at computing while consuming 400 times 
less energy and it's actually a natural step in   the evolution which started from GPUs and then 
custom digital silicon and then custom analog   silicon for AI and the next efficiency milestone 
is likely to be photonics which allows computing   with light and it's relatively new technology so 
by that I don't mean that the idea is new the idea   is quite mature but recently some companies have 
made a great leap forward in new materials and   techniques which we will discuss today photonics 
computing can be tracked back to the 70s it is   this idea of using light for computing why would 
you want to do that well you can't be this speed   of light light is the fastest thing in the 
universe is the fastest possible information   carrier in the complete Universe which makes 
it ideal for quick computing operations and   you know in electronics everything is made of 
transistors with Photonic Computing you need   all sort of different components like different 
pathways to manipulate the light which range   from wave guides to beam splitters to couplers 
and the trick is these Optical components are   passive and essentially drain almost no power 
while in conventional AI accelerators like in   GPUs you have to expand energy each time you 
perform an operation you know in conventional   computer chips the clock speed haven't scaled for 
a while now for a decade or even more do you know   why? in electronic computing the power is spent 
on charging parasitic capacitances of millions   and millions of logic gates each clock cycle can 
you imagine that and the clock speed is limited by   so-called RC time constant and that was preventing 
it from scaling for a decade now but Photonic   Computing overcomes both of these problems in 
Photonics there's not such a thing as an parasitic   capacitor or an RC constant so computations can 
be performed at the speed of light at almost no   power that's where this new chip comes into the 
game and this chip is very interesting because   it's a sort of a new flavour of an analog chip 
it's an Photonic Computing engine that combines   both high frequency radio waves and photonics 
in one chip as you may know both radio waves   and light are electromagnetic waves and they 
exhibit similar wave like properties the main   difference is in their frequency or in photonics 
terms the wav length what's very interesting this   new chip is based on lithium niobate you know 
modern technology has emerged around silicon   the legendary semiconductor that powers all the 
laptops and data centers we have today however   there is not much use of silicon in photonics 
because if you look at it it's black and you   cannot see through it while in photonics they 
work with visible light so silicon can't do it   but lithium niobate can it's actually transparent 
to the visible light and some of the infrared   light as well lithium niobate was discovered many 
decades ago it is grown as a crystal just like   silicon wafers and then sliced and polished into 
many thin and transparent Wafers which are then   placed on top of silicon Wafers photonics circuits 
are printed on top of it lithium niobate is not a   new material but with recent advancements we can 
use it the same way as we use silicon we can use   it to make tiny integrated photonics circuits and 
that's a huge step forward using this material   they've fabricated this new photonic chip which 
is reportedly can make applications like wireless   communication Quantum Computing and artificial 
intelligence run about 1,000 times faster but   before I explain how these huge performance gains 
were achieved and some controversy around this   work let me share with you how AI is already 
making my life easier you know I write a lot   of business emails and I've started to use an AI 
app to help me with it the app is called TypeAI,   a keyboard extension that you can use in every 
app on your phone whether it's messaging apps   or Outlook my favourite feature by far is the 
grammar check you know I always want my emails   to sound professional in the past I used to 
copy paste my messages into ChatGPT to check   grammar and also to rewrite them now it's much 
more efficient with TypeAI because I can check   the grammar in just two seconds directly where 
I write it another feature I like to use is the   tone changing feature for example you can type in 
a reply and then in preferences choose a desired   tone love it if you want to try TypeAI and support 
this channel check the link in the description box   below for a free trial of type AI premium version 
thank you TypeAI for sponsoring this video now how   does this chip work and why do we want to combine 
radio waves with photonics you know if we consider   mobile phones they communicate with radio waves 
at a frequency like 5GHz which means 5 billion   escalations per second while if we take light 
light is at Terahertz range let's say 170THz so   it oscillates much faster and if we compare light 
to microwaves the capacity of how much information   it can carry also scales similarly we can get much 
more information carried by an optical signal than   by an electrical signal and that's the trick in 
this work they generate light by a laser in the   terahertz range and this will be the information 
carrier so that's where the information will be   encoded and then they use a microwave signal to 
actually encode this information into light let's   say you have an image and you want to recognize 
certain objects on it in this case they take the   pixels of the image and then encode them into 
a microwave signal then mix it with a light   carrier after that the computations are carried 
out by light passing through different optical   components to put it simple different roots to 
manipulate the light for example you can perform   math operations for that like addition integration 
or differentiation in the paper of course they   claim that this chip is extremely low power and 
fast and it can solve differential equations   and perform image recognition tasks but the huge 
advantage here that comes from mixing light with   microwave signal is that this chip has Ultra broad 
processing bandwidths of 67 GHz for comparison   the 5G communication the state-of-the-art 5G 
communication has a bandwidth of about 400   megahertz which is what 200 times less which is 
huge and you can actually include a lot of data   in it and process it all at once you see that's 
where these numbers come from.. According to this   table this chip can perform tasks 1,000 times 
faster than an Intel Xeon Gold processor with   400 times the power efficiency so far so good 
right I was very excited up until now but the   closer I was getting to the end of the paper 
that's where they started to slip... let's take   the image detection example from the paper they 
can in fact do the differentiation itself on the   chip with almost no energy spent but in practice 
they ignore various things here for example the   power of the laser that generates light the power 
of the waveform generator that generates a 67 GHz   signal that consumes probably 100 Watts and then 
the readout is also not addressed where they used   the oscilloscope so the whole power estimates in 
this paper they don't hold up I will link this   paper in the description below so you can check 
it out and then let me know what you think in the   comments however you see combining photonics with 
microwaves they can transmit at let's say 60 GHz   bandwidth and with that they achieve crazy data 
rates at 250 giga samples per second that's the   background why they go this extra mile and combine 
and mix these two technologies so as an idea it's   great at the first glance I was thinking wow 
they can do image recognition on this photonics   chip but then I realised that the only thing 
they they can actually do on this chip is the   differentiation of the image and then they send it 
to a conventional computer which runs the ResNet   neural network you see the problem is so far they 
can't do much with this chip they can't multiply   matrixes with it and they also cannot reprogram 
it and if you compare this work with something   like Lightmatter do for example their chip is so 
advanced in the case of lightmatter they're only   using light for computing and their data rates are 
much lower like from 100MHz to probably probably   up to 1 GHz but their photonic AI chip is really 
useful for AI inference they can in fact do matrix   multiplication on the chip and it has been shown 
to be more efficient than conventional chips so I   have mixed feelings about this paper from one 
point of view I'm very excited to see people   mixing different domains to achieve lower power 
and it can be really useful for AI applications   and also Quantum Computing for example so it's 
a nice try but it's still so far away from any   real application that you can build and my overall 
feeling is that this particular technology is more   useful for the let's say data communication than 
for actual Computing but we will see about that   there are other companies and startups that have 
some decent photonic chips and I've mentioned them   in my newsletter some of them like psiquantum 
and xanado are working on all Optical Quantum   Computing these companies use single photons as 
qubits and this approach offers huge advantages   in scalability and also error correction 
compared to other qubit technologies like to   superconducting qubit for example we are on this 
quest of finding new ways of computing and in my   opinion the next efficiency milestone is likely 
to be achieved with Photonics but eventually we   will come to Quantum Computing as an ultimate 
way when we are able to make it to work if you   enjoyed this video please share it with your 
friends or colleagues because this helps this   channel to grow and be discovered and thank you 
so much I will see you in the next episode ciao

---
