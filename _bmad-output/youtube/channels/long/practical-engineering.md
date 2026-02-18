# Practical Engineering Long-Form Transcripts

50 video transcripts.

---

## 1. Do Retention Ponds Actually Work?
**Channel:** Practical Engineering | **Views:** 1.6M | **Date:** 12 days ago | **Duration:** 17:43 | **ID:** xPksDeGoh4E
**Link:** https://youtube.com/watch?v=xPksDeGoh4E

### Transcript:
This is the Historic Fourth Ward Park 
in Atlanta, Georgia. It’s got all the   stuff you could want a park to have: landscaped 
walkways, benches, grassy fields, a playground,   and even a splashpad and amphitheater. The focal 
point is the 5-acre or half-a-hectare pond running   through the middle. But this pond isn’t just 
for looks. In fact, this park would never have   been built at all except for the fact that it 
solves a serious flooding problem. For years,   the Fourth Ward neighborhood struggled with 
drainage and flooding issues. In the 90s, the   city came up with a plan: a massive underground 
tunnel to carry runoff away. Don’t get me wrong.   I love flood tunnels. I have a whole video about 
them. But they’re not always the right call. One   engineer in Atlanta had a better idea - a solution 
that would address the flooding issue for a lower   cost, and significantly beautify the area, a 
rare opportunity to improve form and function. You’ve almost certainly seen a stormwater 
pond, whether you realized that’s what   it was or not. They kind of blend into the 
urban landscape to the point where they’re   basically hiding in plain sight. Some have 
been turned into amenities in places like   parks where the primary purpose is disguised. 
But I think it’s fair to say that no other   single solution has been installed more 
extensively in modern cities or delivered   greater cumulative protection against 
runoff than the humble stormwater pond.   Let me show you how they work with a model 
I built in the garage and some of the ways   these ponds are evolving in the 21st century. 
I’m Grady, and this is Practical Engineering. The problem that stormwater ponds solve is 
pretty easy to understand. Storms bring water,   and that stormwater has to go somewhere. Spray 
a garden hose on some grass and some concrete,   and just watch what happens. How much of that 
water soaks in, and how much runs off the surface?   Depending on the type of soil below the grass (and 
the duration of the experiment), the answers are   pretty different for the two situations. Let’s 
do a little development to make this clearer. Say we buy up this piece of land on the 
edge of the city. Add roads and sidewalks;   some commercial parcels with parking lots; a 
park with a gazebo, tennis and basketball courts;   apartments and homes with roofs, driveways, 
patios, and sheds. Before our project,   this entire area was natural ground - soil 
that could absorb at least some amount of   precipitation, allowing it to infiltrate 
into the earth, recharging aquifers. Now,   it’s covered in all kinds of impervious 
surfaces. Let’s see what happens when it rains. Essentially, two things can happen to rainfall 
when it hits the ground. It either soaks in or   it runs off. How much of each happens depends 
on quite a few factors. For soil, it matters   what kind. Sandy soils with large particles and 
interstitial spaces can absorb a lot. Clays,   with microscopic particles and almost no voids, 
very little. It also matters how much water is   already in the soil. If it’s wet before the 
storm, there’s less room for more water to   flow in. And as soil absorbs water throughout a 
storm, its ability to infiltrate more decreases.   Any water that can’t infiltrate the soil will 
run off into creeks or rivers nearby. But,   for impervious surfaces like asphalt, concrete, 
and roofs, there aren’t really any variables.   Essentially all the water that falls on them 
runs off. When it rains in our new development,   all the runoff still flows to the same place: 
maybe into a channel that runs to a creek that   eventually connects to a larger river. It’s 
just that now, there’s a lot more of it. As I mentioned, depending on the type 
of soil and the size of the storm,   the difference between pre- and post-development 
conditions can be pretty significant. But a   single development usually only represents a small 
portion of the watershed for a creek or river. So,   even with all these new impervious surfaces, 
the marginal increase in water levels during   a storm downstream may be fairly insignificant. 
But zoom out to the scale of an entire city,   and the problem becomes obvious. It’s basically 
all impervious. Development left unchecked   can dramatically increase the frequency and 
severity of flooding because when it rains,   a much greater proportion of that rain runs off 
into creeks and rivers instead of soaking into   the ground. So, most cities don’t let development 
go unchecked, at least from a flooding standpoint. Rules vary a lot among cities and across the 
world, but the most basic requirement you’ll   see in most places is pretty simple: To get a 
building permit to develop a piece of property,   you’re going to have to limit the peak runoff 
from the property to pre-development levels.   That means that for a given storm, on 
a given site, you can’t have a higher   flow rate after development than it would 
have been beforehand. Most development is   going to involve adding impervious surfaces, 
whether they’re roads, buildings, sidewalks,   or parking lots. And that means more runoff. You 
can’t just get rid of the water (in most cases),   so somehow, you’re going to have to store 
it and release it gradually to keep the   peak flow below pre-development levels. 
And the simplest way to do it is a pond. This is my garage-built stormwater pond.  It’s just an acrylic flume I 
use for some of my demos.   But I’ve built this outlet structure that should 
slow down the water, backing it up into the pond. All the acrylic for this structure came from my 
friends at Send Cut Send, this video’s sponsor.   I just love this service. They give anyone with a 
CAD file access to laser cutting, CNC machining,   bending, powder coating, and more. They don’t 
have minimum quantities - each of these parts   was a batch of 1. It’s super fast, super easy, 
made in the USA. They make my life so easy,   and they support the show. If you 
need parts made from metal, acrylic,   or a long list of the other materials they have 
available, give them a try at the link below. I’m measuring flow with a meter 
on the inflow pipe. I also have   a level sensor measuring the volume 
of discharge over time in this tank   below. These are both feeding into an 
Arduino so we can look at the data. I’m going to simulate a storm event using 
this valve. So, this is a hand-crafted,   artisan inflow event. A typical storm has kind 
of a bell-shaped runoff curve. Starts slow,   builds to a peak as more and more of the watershed 
contributes, and then tapers off as the storm   moves away. And you can see that my stormwater 
pond captured some of that peak. Because of the   outlet structure (that just has a small hole at 
the bottom right now), the discharge from the   pond is much lower than the inflow. And, after a 
little post-processing, I can show you the data. This is a plot of flow versus time. 
Inflow is the solid line. Outflow is the   dashed line. The units are arbitrary 
since this is just for comparison,   but I did calibrate the sensors so they 
match as closely as possible. You can   see that the area under both curves is 
the same. Just as much water came out   of the pond as into it. But the peak outflow 
rate was a lot lower. And that’s a big deal. The peak of the flood is everything. That’s what 
determines how high the water rises downstream.   It correlates closely with the total amount of 
damage that occurs. So most drainage rules in   cities don’t really focus on total volume; they 
focus on the peak flow rate leaving the site. And   you can see that the peak coming out of my pond is 
significantly lower than the peak going into it. So great, the pond did its job. Problem 
solved right? But you know this wouldn’t   be an engineering challenge if there wasn’t 
something to balance. You can imagine a pond   with no outlet at all that just fills up with 
runoff. In that case, the peak discharge is   zero. We’ve maximized the performance, right? 
Obviously not, since that storage is expensive,   not only in the construction cost to build it 
but also in the valuable real estate it takes   up on the site. So really, the optimal solution 
is the one that uses the least volume necessary,   while still keeping the peak discharge below what 
it would have been without any development at all. The problem is storms vary in intensity 
and duration. So most of the time,   you’re going to have to show that your design 
works for several different storm events of   varying magnitude. A little hole at the bottom 
of the outlet structure might work for a small   one. However, for a larger storm, you can 
see that my pond fills up pretty quickly   and eventually overflows. Sure, you could 
make the pond bigger to hold more volume,   but we’re just trying to trim the peak off the 
flow rate to match pre-development conditions.   We can release more water from the pond; 
we just have to be careful about how much. When I remove this conspicuous piece of tape 
from my outlet, you can see that I’ve already   built this in. I have a larger hole higher up 
on the structure, so it can release more during   more intense storms. 
Let me simulate that now.  You can see as the 
water reaches that level,   the flows from the two holes combine, and 
we get more water released from the pond,   so it doesn’t overflow. Here’s the graph of the 
small storm again. And here’s the graph for the   big one. You can see that in both cases, we’re 
not completely eliminating the flow. The pond and   outlet structure are just shaving off the peaks 
to reduce the impact of the impervious surfaces.   But that can be a tricky thing to do when you have 
a lot of different storm magnitudes to consider. Take a look at a stormwater ponds in the wild and 
you’ll start to notice the wide variety of outlet   designs. Placing the various orifices or weirs 
is kind of an art as much as it is a science,   because every site is different and 
every city has different rules. An   engineer has to tune the structure to 
balance the amount of storage with the   additional runoff from all the impervious 
surfaces. I added a third hole on top of   my structure so it can handle a really big 
storm. The flow through all three holes in   the outlet combines to create more flow out 
of the pond.  Here’s the graph of that run.  You can see the discharge is much higher, 
but it’s still below the peak inflow. But, this gets quite a bit more complicated, 
because stormwater runoff doesn’t just create   flooding. It also carries pollution. We think 
of rain as cleansing, but the stuff rain washes   off the landscape has to go somewhere. 
That means everything from trash, oil,   dog poop, sediment, road salt, and a whole 
lot more ends up in creeks and waterways.   A lot of the contaminants in stormwater are 
either attached to sediment (or are sediments   themselves). So stormwater ponds can serve 
double duty, reducing flooding and downstream   contamination. You’re not going to get the 
water really clean like at a wastewater plant,   but the treatment for suspended solids can 
be as simple as letting water sit still for   a day or two so bits of stuff can settle to the 
bottom. You may have heard the terms detention   pond or retention pond. We’ve been talking about 
detention ponds that simply slow down runoff,   but they eventually empty out. Retention ponds are 
related, but they keep some of that water stored   permanently, and it makes a big difference when it 
comes to treatment. Let me show you in the model. I added a bunch more mica powder to the water so 
you can easily see how the water flows through the   pond. Contamination is worst during the beginning 
of a storm, sometimes called the “first flush,”   when streets and surfaces are dirtiest. You can 
see in my model, before the pond starts filling,   everything suspended in the water is making it 
through to the outlet. The water is moving pretty   quickly, and it’s relatively turbulent, there’s 
just not enough time for anything to settle out.   But I can put a plug in the bottom outlet of the 
structure and prefill the pond so it acts like   a retention facility. Now when I turn on the 
pump to the same flow rate, you can see a big   difference. There’s a lot of turbulence where the 
water flows in, but things slow way down toward   the outlet. It’s still just a scale model, so most 
of the mica powder is still suspended at the end,   but you can imagine if we scaled this up so 
the water took several hours or more before   reaching the outlet, most of the solids in 
the flow would have enough time to settle out. And retention ponds have other benefits too. 
They help with groundwater recharge by giving   water more time to soak in, and they often look 
nicer, since water features are an amenity,   and these are often landscaped like any other pond 
you might intentionally install on a site. But,   obviously, there’s a tradeoff here. You get 
cleaner water out, but you need a bigger pond,   since some of the volume is already 
taken up before a storm arrives. However,   there is a way to have your 
pond-cake and eat it, too. Outlet structures don’t have to be passive like my 
demo here. Imagine if you could actively control   how much water flows out of the pond based 
on sensors and weather forecasts. You could   hold water in the pond for longer periods 
of time when there isn’t too much rain,   improving the quality of the treatment, and 
then pre-drain the pond ahead of a storm,   freeing up that space for the next runoff 
event. This is known as Continuous Monitoring   and Adaptive Control - it’s basically “smart” 
stormwater management. It’s a pretty cool idea   that’s only just starting to catch on in 
cities, but it has disadvantages too. One   is disease vector control. Because there’s no 
stable pool, you can’t reliably stock fish to   eat mosquito larvae, so there are limits on how 
long you can hold water before you have to drain   the pond. It’s also quite a bit more technically 
sophisticated, so there’s a tradeoff there too.   Usually, these types of systems are operated 
by specialized companies that install, manage,   and maintain them. Some even sell the capacity 
on an open marketplace, allowing developers to   buy credits in lieu of on-site ponds. This 
stuff gets pretty creative - addressing the   lot-level needs of individual developments with 
larger, watershed-scale outcomes. And in fact,   they’re often part of a larger 
idea called regional detention. Even though on-site detention or retention is 
great in theory, it can be messy in practice:   small lots don’t have room for meaningful storage, 
building dozens of tiny basins inevitably leads to   uneven maintenance, the small pipes and outlets 
of minor ponds are more susceptible to clogging,   and in some cases, they can actually make 
flooding worse. You could see on my graphs   that detention lowers the peak at each site, 
but it also delays it. If many basins are   designed with similar outlet controls, their 
attenuated peaks can arrive all at once at a   confluence downstream, spiking the creek level 
worse than if there were no detention at all. Water quality benefits are hit-or-miss, 
too, because performance depends on how   each little system is built and maintained. 
So, there are cases where developers get   together or a city or drainage district 
solves the problem at a regional scale,   building a single, larger facility that can 
handle the runoff from multiple sites. By   routing excess runoff to a shared basin (or a 
network of them), you gain real storage volume,   coordinated release rates that match 
downstream capacity, and professional,   centralized upkeep. It also lets you optimize 
water-quality treatment and pipe sizes across   the area instead of overbuilding each parcel. Keep 
the small storms where they fall for infiltration   and local benefits; send the larger pulses to 
regional detention so the watershed sees a calm,   controlled hydrograph instead of a patchwork of 
ponds releasing a chorus of overlapping peaks. I should make clear that detention and retention 
are far from the only stormwater management tools.   Regional geology and hydrology often drive 
the design. I live near Austin, which has   strict environmental rules because of the Edwards 
Aquifer. Where the limestone reaches the surface,   contaminated runoff can easily enter the 
groundwater. So many sites in Austin require   filtration ponds that actually pass water through 
a layer of sand before it’s discharged downstream,   removing pollutants before they can reach 
the groundwater. I’ve talked about permeable   pavement in a previous video, and there are 
a lot more solutions out there. Many civil   engineers spend their entire careers solving 
urban stormwater puzzles, trying to balance the   important watershed functions with the challenge 
of flooding and pollution. Detention and retention   ponds are just one piece of it. Part park, part 
plumbing, mostly hiding in plain sight, they are   often carefully tuned pieces of infrastructure 
that help keep the city’s head above water.

---

## 2. The Hidden Engineering of Runways
**Channel:** Practical Engineering | **Views:** 1.4M | **Date:** 3 weeks ago | **Duration:** 18:40 | **ID:** ZJqY1WLX4zA
**Link:** https://youtube.com/watch?v=ZJqY1WLX4zA

### Transcript:
September 2025 was an unusually bad month for 
runway overruns in the US. On the night of   September 24th, an Embraer 145 with 53 people 
on board landed long at the Roanoke-Blacksburg   Regional Airport in Virginia, overshooting 
the end of the runway. Just weeks earlier,   on September 3rd, TWO similar 
incidents occurred on the SAME DAY,   one a Gulfstream at Chicago Executive Airport 
and another a Bombardier at Boca Raton. In all   three cases, the surface at the very end of the 
runway crushed under the weight of the planes’ tires.  You look at the photos, and it looks 
like a mess, but these systems worked exactly   as they were intended, preventing fatalities 
and serious injuries in all three cases. We’ve all seen a runway before. At 
first glance, there’s not much to it:   a strip of concrete or tarmac planted on the 
landscape with some extra markings and lights.   It basically looks like a short section of 
highway. But if you look under the surface,   there is a tremendous amount of engineering 
that makes these facilities entirely unique   from anything else we build. I want to 
peel back the layers and show you what   really goes into building a runway. I’m 
Grady, and this is Practical Engineering. A fully loaded semi truck usually weighs on the 
order of 80,000 pounds (or 36 metric tonnes) and,   depending on what state you’re in, legally maxes 
out at 60 to 80 miles per hour. Our highways are   carefully engineered for vehicles in that weight 
and speed regime. Compare that to modern heavy   jets that can weigh more than 500 tonnes or a 
million pounds, with takeoff and landing speeds   around 180 miles per hour. Just like highways, 
the design decisions for runways - from length,   to width, to shape, to materials and beyond - 
all have major implications on public safety.   There is a long list of crashes and incidents 
that could have been avoided by better designs,   and actually, a lot of the reasons we do 
things the way we do is because of lessons   learned through previous tragedies. Maybe 
better than any other industry, the aviation   world strives for continuous improvement through 
the understanding of past failures, and you can   see evidence of that just about everywhere 
you look, including resources like SKYbrary. The thing is, building a runway is an extremely 
costly endeavor.  There’s practically no limit  to the amount of money you can spend making one 
incrementally safer. So there’s always a balancing   act between cost and capability. One of the most 
fundamental decisions that affects both sides is   length. A longer runway can accommodate larger 
aircraft, but it can dramatically increase costs   by requiring more land and more infrastructure. 
It can even affect the siting decisions,   pushing an airport farther outside a city. It’s 
a pretty important choice. So important that FAA   has a 40-page guidance document on length alone. 
Based on what you want to accomplish - whether   it’s basic general aviation at a municipal field, 
air cargo, medevac, or serving as a backup to the   Space Shuttle program - you first have to pick 
a critical aircraft: the one that requires the   longest runway. But it’s more complicated than 
that, since takeoff and landing performance   depends on a lot of factors. High temperatures 
and elevation reduce the density of the air,   requiring more speed for the same amount of 
lift, which results in longer takeoff distances   and landing rollouts. Slopes affect both takeoff 
and landing as well. Uphill takeoffs are harder   because the engines have to fight gravity; 
downhill landings require stronger braking.   The FAA says that for each percent of downhill 
slope, landing distance is increased by 10%.   Manufacturers of aircraft can tell you the runway 
requirements for a specific make and model, or FAA   has developed curves that can help you take these 
factors into account to decide a runway length. When you’re driving on the highway, direction 
isn’t that important. Obviously, you have to get   to where you’re going, but other than that, there 
aren’t many engineering requirements that change   with the direction of the roadway. With runways, 
that’s not true.  Whether taking off or landing, airplanes work best when facing directly into the wind. And in fact,   they might not be able to land or take off at 
all under certain crosswind conditions.  So the direction of a runway is a consequential decision. 
Prevailing winds vary a lot by location. In fact,   one of my favorite types of diagrams, the wind 
rose, is specifically designed to show this at   a glance. And if you look at enough wind roses, 
you’ll notice that, in some places, there’s not a   prevailing wind direction at all. That’s why most 
large airports have perpendicular runways. Again,   this is aircraft-dependent. Every airplane has its 
own crosswind limits. FAA generally expects runway   orientation to provide about 95% wind coverage 
for the airport’s design aircraft, so in places   without a strong prevailing wind direction, 
it takes a second runway to meet that target. Length and direction are easy to notice, but 
there’s more to the geometry of a runway. In 2019,   a Miami Air International Boeing 737 touched down 
in Jacksonville during heavy rain. The aircraft   skidded off the runway and came to a stop in 
the St Johns River. 21 people were injured,   but thankfully, nobody was killed. When 
the NTSB investigated the accident,   one of the main contributors was that 
the runway was ungrooved. The water   on the surface couldn’t squeeze out fast enough,   instead building pressure in the contact patch 
between the tire and runway. It’s hydroplaning:   the tires ride on the water instead of the ground, 
wiping out friction and directional control. Just like in a car, planes need friction to stop. 
Larger jets have the benefit of aerobraking,   using devices that reverse the thrust of 
the engines, but regular-old wheel brakes   still do most of the work. And just like for 
cars, water makes that much more challenging,   so there are a lot of engineering decisions that 
go into maintaining good friction on the runway   surface. Like highways, most runways have a gentle 
crown at the centerline that drops off to the   sides. This cross-slope helps shed rain and stops 
water from pooling on the surface. Larger airports   install grooves in the runway surface that give 
water an escape path from beneath the tires,   reducing the chance of hydroplaning in bad 
weather. And this isn’t just a one-time   decision. Airports use friction-measurement 
equipment to monitor operational conditions.   If the surface gets too polished from use or 
built-up rubber from the countless touchdowns,   they have to clean the surface or even 
retexture with shot blasting to roughen it up. Runways are a bit unusual because, when 
you think about it, they really have two   very different jobs. Taking off and 
landing are pretty similar; one is   essentially the reverse of the other. But 
in some ways, they’re entirely different.   And so they drive the requirements for runway 
engineering in different ways. For example,   it may feel like landing is the most dynamic 
moment in a flight, but it’s actually takeoff   that usually governs runway length and strength. 
That’s mostly because of weight. A big part of   the weight of a fully loaded airliner is fuel. 
An Airbus A380, the largest of commercial jets,   has a max gross takeoff weight of over 
550 metric tonnes. For a long-haul flight,   nearly half of that weight can be in fuel. When 
an airplane touches down, even though the moment   the wheels hit may feel impactful, the plane 
is much lighter. In fact, landings are so much   less damaging to pavement than takeoffs that they 
usually don’t even count in load cycle tracking   for the engineering design. It’s all about 
takeoffs, and to support those enormous loads,   airport runways have some of the most heavily 
engineered pavement systems in the world. This is something that you’ll almost never be 
able to see, but the amount of consideration and   engineering below the surface is incredible. The 
FAA even has its own engineering software package,   complete with a wonderful government acronym: 
the FAA Rigid and Flexible Iterative Elastic   Layered Design or FAARFIELD. Just like highways, 
you basically have two choices for runway pavement   materials. Rigid pavements generally use 
concrete. Flexible pavements use hot-mix   asphalt. Their behavior and performance are pretty 
different, so the engineering is different too.   Asphalt has a small but significant measure 
of give to it, which causes the effective   width of aircraft tires to spread out in a 
cone underneath the surface into the deeper   layers. This contrasts with rigid pavement, where 
a tire's effective width is its actual width. Asphalt is a cheaper material, so it's used 
in the vast majority of paved airfields in   the US. Concrete is stronger and stiffer, 
so most large-scale commercial airports use   rigid surfaces. The tradeoff usually comes with 
volume. A rigid pavement has a longer design life,   so the additional cost is offset 
by reduced maintenance and a longer   interval before replacement. But in both 
cases, there’s a lot under the surface.   It’s basically a layer cake of materials 
that all serve different functions. Everything sits on the subgrade, which 
is the natural soil at the site. The   quality of the subgrade really decides 
everything else. The soil strength,   its potential for shrinkage and 
swelling, the depth of the frost line,   and the depth of the water table will drive 
the design. If it’s really soft and mushy,   the subgrade can be amended with sand, 
lime, cement, or geosynthetic materials. Some pavements put a drainage layer on top of 
the subgrade. This is a permeable material,   like gravel, that lets water get out of the system 
so it doesn’t soak the soils below, which might   lead to softening and weakening over time. A 
runway is one place you don’t want a pothole. Above that, many pavement systems (especially 
flexible ones) use a subbase. This is a layer   of course material (sometimes even crushed 
up bits of an OLD runway). Practically,   the sub-base adds thickness cheaply. Stress 
from wheel loads drops quickly with depth,   so a layer of material that doesn’t have tight 
engineering specifications can accomplish the   depth without driving up the cost too much. 
Plus, the subbase serves as a working platform   so you’re not mucking up the subgrade 
with heavy equipment during construction. Then comes the base course. This is the 
structural workhorse of a pavement system.   It’s usually a mixture of high-quality 
crushed and uncrushed aggregates,   specifically designed to lock together when 
compacted into a high-strength support. The   goal is to distribute the point forces of wheel 
loads into the layers below. Lower stress mean   less movement, which results in less cracking of 
the surface layer and a smoother ride over time. On top of all that is the surface course 
that provides the friction and texture.   Concrete pavements distribute forces, so 
they don’t require quite as much engineering   underneath. For asphalt, friction 
is essentially its only purpose. The   layers below do the heavy lifting. And if the 
surface course degrades, you can often mill   it and overlay it with new material without 
having to rebuild the entire system below. Separating the pavement into all these layers is   about finding the right balance between 
performance, cost, and constructability.   You could just build a 10-foot-thick layer of 
concrete and be done with it, but eventually   those costs flow to the airline tickets, 
and no one would be happy to pay for that! Since runways are essentially a connection 
to the sky, there are some quirks in their   engineering to account for that too. One is 
the use of displaced thresholds. Sometimes,   surrounding obstacles don’t allow 
for a gentle glide slope to the   end of a runway. You don’t want airplanes 
diving steeply into a landing, so instead,   we displace the touchdown point farther down 
the runway, while still allowing takeoffs   to use the full length. Takeoff lengths are 
usually longer than landing lengths anyway,   so this is a compromise worth making to take 
the best advantage of the surrounding airspace. You can only displace a threshold so much, though. 
Sometimes design choices and sacrifices are made   to accommodate unavoidable restrictions caused 
by nearby terrain or buildings. Airports have   to exist in the broader context of developed 
areas. So, airport designers and managers have   to ensure that imaginary zones called “obstruction 
surfaces” are free of buildings, trees, towers,   and anything else you don’t want to get hit 
by a plane. These imaginary surfaces extend   farther than you might think into the air space, 
providing safe approach and departure paths with   comfortable margins of safety. Airports 
don’t usually have land-use authority,   though, so keeping the airspace free 
from obstructions is a collaborative,   and occasionally contentious, process between 
regulators, cities, landowners, and developers. There are also areas of pavement at the ends of 
runways that aren’t intended to have planes on   them at all. For example, larger runways include blast pads. This is one of my favorite elements of runway engineering.  The powerful wakes produced 
by jet engines pick up grit and scour away the   land behind them. If this is just loose soil 
or grass, the endless parade of planes will   eventually dig a huge hole at the back of the 
runway! I’ve spent a lot of time working with   concrete structures meant to curb erosion from 
flowing water, but there just aren’t that many   pieces of infrastructure that are purpose-built 
to mitigate aerodynamic erosion. Blast pads can’t   carry the weight of a jetliner, so they’re painted 
with yellow chevrons to tell pilots ‘stay off!’ Even when a runway is long enough to accommodate 
the air traffic it sees on a regular basis,   accidents happen, and sometimes airplanes 
overshoot the end of the runway on takeoff   or landing. Runways are required to have a certain 
amount of space beyond the pavement on all sides,   called runway safety areas or RSAs. 
Like the clear zones along highways,   RSAs provide an airplane with room to 
safely come to a stop without obstacles.   There are some instances where space is tight, 
though. Urban infrastructure, a body of water,   or other stuff can get in the way, making it 
less feasible to maintain so much open space   around a runway. Luckily, there’s another option: 
Engineered Materials Arresting Systems, or EMAS. These systems are manufactured from crushable 
material like lightweight concrete or foamed   glass. In an emergency situation, they 
can dissipate a plane’s kinetic energy,   quickly slowing it down so it doesn’t 
crash into whatever lies beyond. EMAS   saved the day in all three major overrun 
incidents in September 2025. You can see   just how effective it is in this footage 
from the September incident in Boca Raton.   It’s like a much more sophisticated and carefully 
engineered runaway truck ramp for airplanes. There’s so much more going on in the engineering 
and design of runways than I can possibly cover   in one video. I’ve tried to focus on the hidden 
stuff: construction techniques and requirements   that you don’t really notice when you’re a 
passenger looking through the window and may   not even be familiar with as a pilot. I really 
love knowing how much goes into that stuff that   most of us never have to think about. It makes me 
feel safer as a passenger. It’s a reminder that   smooth and boring is usually the goal, and 
it takes a lot of work to keep it that way. If you’re a fan of airports and runways, I’m sure you know my friend Sam’s channel, Wendover Productions,   which has some of the deepest dives into topics on 
air travel. I love that stuff, but a lot of people   don’t know about one of my favorite of Sam’s side 
projects, the Logistics of X. And honestly, it’s   one of his best. My favorite is The Logistics of 
Search and Rescue. I had no idea that most search   and rescue teams don’t have their own helicopters. 
It’s such a fascinating variety of topics,   from mining to commercial fishing, and if you want 
to check it out, it’s only available on Nebula. You’ve heard me talk about Nebula before. It’s 
a streaming service built by and for independent   creators, including a lot of my favorites like 
Neo, Wendover Productions, the Coding Train,   and Branch Education. I don’t know about you, but 
independently-produced content is most of what I   watch these days. I just like the authenticity 
and thoughtfulness of videos that haven’t been   through a writer's room and ten levels of studio 
executives. Someone told me that Nebula’s like   Netflix for people who love trains. And I like 
that comparison, not just because I love trains. Nebula’s totally ad-free, with tons of 
excellent channels and lots of original   series and specials like the Logistics of X. 
Sign up for a free trial first and see what   it’s all about. After three days, I think you’re 
going to feel like it's worth a subscription,   especially because you can get 50% off the 
regular price if you use the link below.   My videos go live on Nebula before they come out 
on YouTube. If you’re with me that independent   creators are the future of great video, I 
hope you’ll consider subscribing. That’s   go.nebula.tv/Practical-Engineering. Thank you 
for watching, and let me know what you think!

---

## 3. Recreating an Ancient Pump (with no moving parts)
**Channel:** Practical Engineering | **Views:** 1.7M | **Date:** 1 month ago | **Duration:** 13:11 | **ID:** 7OHCOFFUamQ
**Link:** https://youtube.com/watch?v=7OHCOFFUamQ

### Transcript:
On the hill above Granada, Spain, sits the 
Alhambra: a medieval palace and fortress   complex of the historic Islamic world. Built 
and modified over centuries, the Alhambra is   now a UNESCO World Heritage site and stands as 
one of the best-preserved palaces in the world. Every city needs a reliable source of water, 
and that stood as a challenge for the Alhambra,   perched high above the nearby rivers. Medieval 
engineers used a lot of creative solutions to   divert natural sources of water and distribute it 
to the cisterns, baths, and fountains within the   complex. Another YouTube channel, Primal Space, 
has an excellent video on all the ingenious ways   they managed water, and one of the details 
in that video really caught my imagination. Alcazaba is the stone fortress on the western 
tip of the Alhambra that sits higher than most   of the palace city. Apparently, throughout 
the Renaissance (and maybe even starting   in the medieval period), the fortress was 
supplied by water using a pump that had no   moving parts. In 1764, a priest observed the 
device. He couldn’t understand how it worked,   but he did his best to describe it 
anyway. More than a century later,   a Spanish engineering professor, Cáceres, took it 
upon himself to try and recreate the device using   the priest's description. By that time, remnants 
of the device were gone. Historians estimate it   existed until the end of the eighteenth century, 
when a higher canal replaced it. Even so,   the professor got it to work, presenting his 
results at a 1911 scientific congress in Granada. Was it the actual pump design the priest 
described? We’ll never know for sure,   but it seemed likely to that professor, and more 
recent historians have found it plausible. And   that’s pretty fascinating to me. A pump with no 
moving parts, able to lift water above its source,   quietly serving a hillside fortress 
centuries ago. It is clever, effective,   and, all these years later, mostly unknown 
today. You can’t pick one up off the shelf   at your local hardware store, at least not 
yet. So I decided to take after Professor   Cáceres and try to build one myself. I’m 
Grady, and this is Practical Engineering. There’s something really magical about taking 
advantage of flowing water to accomplish work.   I don’t know exactly what it is. Seeing a 
natural force, like the flow of a river,   interacting with human ingenuity to do something 
important - it’s really cool to me. And it’s   especially cool when it’s purely mechanical. 
Don’t get me wrong; I love electronics, circuits,   and sensors. But doing a job with water alone - 
you have to admit that there’s something special   about it. I’ve covered a few devices like this 
before. I built a trompe, which is basically   a water-powered compressor. I also built a 
ram pump, which is a water-powered pump that   uses check valves to harness kinetic energy, 
converting it to pressure. But I have to admit   that Primal Space’s video is the first time I had 
ever heard of what seems to be mostly referred to   nowadays as a pulser pump. And there really 
isn’t much information out there about them,   despite the fact that they’ve been around for 
centuries. The idea isn’t really that complicated,   but the details are a little tricky, so 
I decided I would try to come up with a   design that boils it down as simply as possible. 
And you know we have to break out the acrylic. Actually, most of the parts for this 
demonstration came from my friends at   Send Cut Send, who sponsored this video. I could 
buy sheets of acrylic and cut all this out myself,   and I’ve done so much of that, but just 
look at this. An entire idea from my head   shipped to my door. The quality’s better, the 
cuts are way more precise than I would make,   and I don’t have a day's worth of measuring, 
cutting, and cleaning up to do. I can’t recommend   Send Cut Send enough. If you have projects that 
use sheet goods, give it a try at the link below.   I really appreciate their support.  I just had to tap the holes… then glue   everything together. Now, let’s turn on 
the water so we can see this in action. Step one is this basin up top. Rather 
than connecting directly to the hose,   I wanted a free surface of water 
at the top, just so it’s clear,   from an energy perspective, that this is the 
starting point. This tank provides a simple,   consistent, and obvious input for the 
pulser pump. It’s the equivalent of the   end of a canal in an ancient palace, and the 
goal is to raise the water above this level. From the basin, the water falls down this 
vertical pipe. But if you look carefully,   you can see it’s not just water. The water flows 
into this tee fitting that acts like a vent,   allowing the stream to kind of swirl around 
and draw in air. There are quite a few ways   to intentionally mix air and water. The historical 
description of the pump at the Alhambra was pretty   unclear when it comes to this part. The priest 
didn’t provide much detail about how the air was   entrained in the downward flow. Professor Cáceres 
tried two methods and had the most success using   a whirlpool to draw water and air downward. I 
don’t know if this is exactly what he tried,   but it is dead simple, and it worked 
surprisingly well.  You can see the water   in the pipe is full of bubbles, and it’s moving 
fast enough to carry them into the next tank. The goal in this area is to separate all the 
air from the water. You can see the bubble   float upward while most of the water continues 
onward. The sloped top helps trap the bubbles,   so the flow exiting on the right is just water. So far, this is basically just a trompe. I 
mentioned I built one of these before in my   backyard and made a video about it. It looks a 
little different from this one, but the concept   is basically the same. Entrain bubbles of air 
in a stream of water, carry them downward,   and then separate them out - now under pressure - 
so the air can be used for things like smelting,   powering tools, or in my case, blowing some dry 
grass around. It was just a scale demonstration. Trompes aren’t used much these days. It’s easier 
to buy a compressor than to build a piece of   infrastructure. But it’s still a cool idea, and 
their use is being explored to aerate remote pools   of mine waste to speed up the bacterial reactions 
that can help clean up contamination. There are   probably quite a few edge cases where a source of 
pressurized air is more valuable than a source of   moving water, and a trompe basically lets you make 
that trade with no moving parts or electricity. You can see in my model, there’s a riser on the right, just 
like with the trompe demo. The purpose of this   is to create enough pressure to encourage the 
bubbles upward. You can imagine if there was   no back pressure on the system and I just let 
the water out at the bottom of the separator,   eventually it would just fill up with 
air. That’s not what we want. So the   water has to flow up the riser and then 
out through this hose, keeping the bubbles   under pressure so that they’ll flow out of 
this tube:  the discharge line for the pump. I tried all this in my garage first, but kept 
spraying the ceiling, so I eventually decided   to do this outside. My discharge line runs up 
above the inlet tank. As bubbles move into the   separator, they float upward and out of this 
pipe. But, because the pipe is pretty narrow,   water gets kind of trapped between the bubbles. 
This is a little finnicky, but basically,   the buoyancy of the air mixed with the water 
occasionally creates enough lift for the water   to make it all the way to the top. And now you 
can see why they call this a pulser pump. You   don’t get a very continuous flow. But look at that!  The water is actually going a lot higher than 
where it started in the upper tank.  We are moving water uphill with no moving parts. Actually this part of the pump is a pretty 
ubiquitous design. It’s usually called an air lift   pump. Basically, pump air bubbles to the bottom 
of a pipe, and let them carry water upward. These   are often used in dirty situations where you don’t 
want sand, grit, or plant matter clogging up the   impeller of a more traditional pump. They’re not 
very efficient, but useful in certain situations   like wastewater plants and dredges. And, this 
is also how coffee percolators work. The steam   bubbles carry the liquid water to the top where 
they can percolate downward through the grounds. I’m recirculating the water in this demo 
just using a bucket and pump below the table,   and that drives home a couple of key 
points here. For one, all the water   running through the pump does not actually 
get pumped. In fact, in my little demo here,   I didn’t actually measure it, but I’d guess 
the discharge flow rate is somewhere less   than five percent of the total flow rate 
through the pump. You need a lot of water   to move just a little bit upward. So for two, 
this is not a free energy device in the same   way a hydropower turbine isn’t producing free 
energy. In a practical sense, the pulser pump   is extracting energy from the flowing water 
to push water bubbles downward, temporarily   storing the energy. Then it’s extracted 
again to push some of that water back up. So it really is that simple. A pulser pump 
is basically a combination of two steps:   a trompe to supply the bubbles, and an air lift 
pump that uses those bubbles to carry water   upward. But in some ways, it’s not simple at all. 
Two phase flow, where air and water move together,   is pretty complex. If you thought fluid 
dynamics was tricky with one fluid,   just try using two! You can tell just by 
looking at my demo that there’s not a lot   of stability here. At the down tube, sometimes 
you get a regular stream of small bubbles,   and occasionally you get one big one. At the 
discharge, sometimes you get regular pulses;   sometimes you get big bursts. Every step 
of the process is just so …gurgly.  There are a lot of knobs to turn here, and they 
all affect the system in different ways. Let’s say you have a fixed flow rate, and a fixed 
amount of height between your inlet and outlet.   You still have to select the diameter of your 
down pipe, which will affect the fluid velocity,   and so how much air you can draw in. There are 
probably many different ways to mix the water and   air that are more or less efficient, depending 
on the configuration. And there’s the diameter   of the discharge line. A bigger pipe can move 
more water, but too big and the bubbles don’t   crowd up enough to carry water with them. 
There is quite a bit of engineering guidance   out there for air lift pumps, since they’re 
pretty widely used. Not so much for trompes,   although I did find an interesting paper in 
the Journal of Applied Thermal Engineering.   The author called them “hydraulic air 
compressors” and that’s actually one of   the tricky parts to finding more information on 
devices like this. Since they’re pretty obscure,   there’s not much consistency in terminology. The 
most I could find on pulser pumps was a few old   YouTube videos and college projects. And this 
recent paper on the hydraulic techniques for   water supply at the Alhambra doesn’t even 
venture a name for the device used there. So this is still kind of just trial-and-error 
engineering. I’m sure I could spend hours trying   different configurations and improving this 
demonstration. If you’re a grad student looking   for a thesis idea, I think pulser pumps 
would make a pretty interesting project,   because I can see some applications 
here. In fact, I’m not the only one. Hydraulic ram pumps are pretty popular 
around the internet and in rural areas   that have abundant water but no electricity. 
They were well known by the time Professor   Cáceres did his experiment in 1911. In 
his paper, he said about the pulser pump: “This arrangement will always 
have, over the hydraulic ram,   the advantage of eliminating valves entirely, 
since it contains no moving solid parts. Doing   away with the ram strokes seems to remove 
any source of fatigue in the pipes and,   of course, the very annoying noise that makes 
the ram inapplicable near living quarters.” I can’t help but think back to him in his 
lab, seeing the water spurt out from the top   of the discharge line for the first time. 
You can tell his excitement in the paper: “Beyond its historical appeal, the idea has 
real value for modern engineering. In cases   where efficiency is not critical, reviving 
it could solve practical problems, using a   layout so simple that it is remarkable it has not 
become common knowledge after several centuries.” I wonder if he would be a little disappointed 
that the idea never really did catch on,   despite its novelty. But I still 
think it’s pretty cool. And maybe   someone will see my demo working and try 
it for themselves, carrying the ancient   idea forward for new applications. Thank you 
for watching, and let me know what you think!

---

## 4. Sawing a Dam in Half (on Purpose)
**Channel:** Practical Engineering | **Views:** 920K | **Date:** 1 month ago | **Duration:** 20:31 | **ID:** lnYA0_AzhsM
**Link:** https://youtube.com/watch?v=lnYA0_AzhsM

### Transcript:
Concrete is the second-most-consumed substance 
on our planet. Only water beats it, and actually   water is a major ingredient of concrete anyway. 
Every year, humanity mines, mixes, and places   roughly three metric tons for every person on 
Earth. It’s ubiquitous. Most of us hardly even   think about all the concrete around us. We’ve all 
seen the grey lumpy mixture flowing down chutes   into formwork to become a road, sidewalk, 
footing, pile, patio, or foundation. It’s   easy to think of concrete as a single, uniform 
substance used around the world. But it’s not. The only reason we are able to use so 
much concrete in construction is that it’s   cheap. Of the four main ingredients - sand, 
gravel, cement, and water - two of them come   directly from the ground with little need for 
processing or refinement. One is water. Cement   is the only ingredient that requires a significant 
manufacturing process, but the raw materials for   it are fairly widespread across the globe. Many 
building materials are constrained by geography.   They only grow, occur mineralologically, or are 
manufactured in specific locations. Then they   have to be transported, often at great cost, to 
where they’re needed. It’s not true for concrete.   No matter where you are on earth, there’s a 
pretty decent chance that somewhere nearby   exists a ready source for at least most of 
the raw ingredients you need to make it. That   simple fact has significantly contributed to its 
widespread use, but it’s done something else too. Take a look at any geologic map. If you’re like 
me, you do this in your spare time anyway. You   realize pretty quickly that there is tremendous 
variability in the different kinds of materials   that make up the surface of Earth’s crust. 
And the practical result of that, at least   for the purposes of this discussion, is that every 
batch of concrete is just a little bit different   depending on where you go. In a way, that’s kind 
of special, right? In most cases, the concrete   you see around you represents a particular place 
on Earth. Its strength, durability, appearance,   and essence are highly local characteristics. 
It’s literally made from materials that were   sourced not too far away. But, in some cases, 
we’ve learned too late that local materials had   some hidden problems when used in concrete, and 
the ways we’ve worked to fix those problems have   created some of the most interesting stories. 
I’m Grady, and this is Practical Engineering. This is Fontana Dam on the Little Tennessee 
River in North Carolina. At 150 meters (or   nearly 500 feet) in height, it’s the tallest 
dam east of the Mississippi River. The north   shore of Fontana Reservoir forms the border 
of the Great Smoky Mountains National Park.   And if you’re through-hiking the Appalachian 
Trail, the famed 2200-mile path through the   wildest parts of the eastern United States, you 
have to walk right over the top of it. Built   by the Tennessee Valley Authority (or TVA), 
Fontana was completed in 1944, just in time   to provide hydropower to the Alcoa aluminum 
smelting plant at the end of World War II.   It’s a concrete gravity dam, meaning that it 
derives its stability to hold back Fontana   Reservoir entirely from its own weight. And 
boy does it have a lot of weight. More than   2.1 million cubic meters of concrete went 
into the structure before it was finished.   That’s well over half the volume of Hoover Dam, 
and if you watch the same kinds of videos I do,   you know that putting all that concrete 
in Hoover Dam was a major challenge. Concrete heats up as it hardens, which 
can negatively affect the curing process,   but more importantly, it causes the concrete to 
expand. For a structure like a dam sandwiched   between two rocky abutments, that expansion 
can lead compressive stress to build up in the   concrete. Then, after curing, when the concrete 
starts to cool back down, it shrinks. That   shrinking can lead to cracks, especially in mass 
concrete structures that heat up and cool down   unevenly. And cracks are not ideal for dams. To 
mitigate this issue, pipes were installed within   the concrete at Hoover Dam, and chilled water was 
continuously circulated during construction to   pull heat out of the concrete. The same thing was 
done when they were building Fontana Dam. In fact,   in addition to the cooling lines, the dam was 
built with deliberate expansion joints that   would allow each separate concrete block to 
cool off and shrink. Once the concrete cured,   those joints were grouted to add strength and 
make the dam watertight. It was a pretty robust   and thoughtful plan to avoid the buildup of 
stress in the structure, or so they thought. In 1972, engineers inspecting the drainage 
gallery, a tunnel through the concrete dam   used to collect and redirect drainage, noticed 
unexpected cracks right where the dam curves.   Later investigation revealed that the cracks 
extended through a large part of the structure.   At this point, the dam was still less than 
30 years old. It shouldn’t be deteriorating   this quickly. But the cracks were serious 
enough that something needed to be done. Engineers initially blamed the Tennessee sun. 
Fontana Dam runs almost perfectly east to west,   with its broad downstream facing directly 
south. That means a huge area of concrete   is exposed to sunlight for most of the day. The 
sun heats the concrete, causing it to expand,   and over thousands of cycles, cracks are 
inevitable. The curved section of the dam   was most vulnerable. Reaction forces from the 
abutments align with the axes of the dam. Instead   of pure compressive stress, the expansion 
of the concrete created bending stress (a   combination of expansion and contraction) 
at the corner. In addition to the cracks,   the movement was also causing 
the spillway gates to bind up. After instruments were installed on the dam, 
the scope of the problem became clear. Thermal   movement is cyclical with the seasons. Concrete 
may expand in the summer, but it returns to its   original size in the winter as temperatures 
cool. Fontana had some of that, but underneath   the cyclical changes was a continuous 
one. The concrete was permanently growing. TVA took some cores of the concrete to 
start planning a repair, and sent them out   for testing. When the results came back, 
the reason for the unexpected growth was   discovered. The laboratory that examined 
the concrete under the microscope noticed   that some of the aggregates inside 
had dark rims around them. That is   a classic sign of alkali-silica reaction, 
or ASR, sometimes known as concrete cancer. The fundamental components of concrete 
are aggregates, large and small,   bound together by a paste of cement and 
water. As the cement paste hydrates,   potassium and sodium hydroxides dissolve into the 
water within the tiny pore spaces of the concrete,   creating an alkaline solution. In some cases, 
this is a good thing. The alkaline environment   is great for steel reinforcement, helping to 
prevent rust. But for some types of aggregates,   it causes a serious problem. Specifically, 
if reactive forms of silica are present,   they can more readily dissolve in the high-pH 
water, combining with the alkalis to form a kind   of gel. As that gel absorbs moisture, it swells 
and expands, causing internal stress and cracking. This is an extremely widespread problem that 
has caused structural damage in every state in   the US and many countries around the world. 
You usually don’t have to search far for an   example of a cracked up bridge, broken 
sidewalk, or ruined building foundation   that resulted from an alkali-silica 
reaction in the concrete. Fortunately,   the reaction requires three conditions, so 
there are quite a few ways to deal with it. For one, an alkali-silica reaction requires 
the aggregates to actually contain silica,   also known as silicon dioxide. Well, 90 
percent of the Earth’s crust is made up   of silicate minerals, so this might 
not seem possible to avoid. Luckily,   only certain forms of silica are significantly 
reactive in concrete. We have tests we can   perform ahead of time to identify quarries 
or sources of rock that react with cement,   allowing us to just avoid the issue altogether. 
But like I mentioned before, the cost of concrete   is really sensitive to transportation costs. The 
farther you have to go to get suitable aggregates,   the higher the project’s costs rise, so 
avoiding local materials is not always ideal. The second condition required for an alkali-silica 
reaction is highly alkaline cement. So,   we have ways to control for that too. Cement can 
be manufactured to have lower alkali content,   and we can use what are called “Supplementary 
Cementitious Materials,” like fly ash,   to replace some of the cement in 
concrete. Those solutions only work   if the concrete isn’t already in place, though. The third factor of an alkali-silica reaction is 
excess moisture. You can just keep the concrete   dry with waterproof coatings or membranes. Without 
moisture, the gel can’t expand, so the problem is   solved. But there are some structures where 
waterproofing is a pretty big challenge. So   TVA was in a bind, literally. They were facing the 
possibility of just having to perpetually repair   cracks and equipment as Fontana continued to 
expand. Then they decided to get creative. Kristen   Smith is the Senior Program Manager for Dam Safety 
at TVA, and she explained the thought process: Kristen: You know, the impacts 
on the spillway and powerhouse   equipment. That led to major maintenance 
and repairs [...] Need to move from the   reactive approach - that's not a long-term 
solution - to a more proactive approach. The proactive approach they landed on 
was a fourth option for dealing with ASR:   Rather than trying to stop the reaction, 
TVA decided to just give the concrete more   room to grow. The solid rock abutments at 
each end of the dam had no room to give,   so that space would have to 
be found in the dam itself. In 1976, they embarked on a fairly novel 
operation to cut a relief slot all the way   through Fontana Dam and do it without draining 
the reservoir or causing any disruptions to   the hydropower plant. The idea was pretty 
simple: instead of building up axial stress   as the concrete expands, the dam can expand 
into the newly cut slot. Simple in theory;   pretty challenging in practice. How do you saw a 
dam in half? Luckily, TVA has done this at two of   its other dams in addition to Fontana, and shared 
some footage of that so you could see it happen. These are big dams, so this isn’t sawing with 
blades you find at ahardware store. The tool   used for cutting through the concrete 
looks more like a rope than a saw blade. Kristen: It is diamond wire, and it's really 
neat. It's, if you touch it, you know,   it's 15 millimeters, which is a little 
over half an inch. It's abrasive. I mean,   you know, it would rub your skin 
if you drug it across your skin,   but you can touch it. You can run your hand 
along it and it's not going to cut you. It   can cut through concrete. It can cut through 
steel. [...] It looks like a big necklace. That big diamond necklace runs along pulleys 
strategically installed on the dam to advance   the slot downward. The saw pulls the wire 
in a loop, managing the slack and keeping   constant tension against the bottom of the 
slot. There are a lot of advantages to this,   in addition to the practically unlimited 
depth. It causes very little vibration   or dust, and provides a clean cut 
without breaking the edges. But,   there’s a pretty obvious challenge of cutting a 
slot in a dam: how do you deal with the water? Turns out, it depends on the dam. At Fontana, 
crews installed a cofferdam on the upstream face   of the dam to hold back the reservoir during the 
operations. It’s basically half of a steel pipe   that seals against the concrete face on the sides 
and bottom, just big enough for access to adjust   the pulleys. At Chickamauga Dam, the geometry made 
a cofferdam less feasible. So instead, they broke   the process up into three sections separated by 
boreholes drilled downward into the structure.   One section could be cut by the diamond wire 
while the other borehole was sealed, preventing   water from moving through the slot. That’s 
easier said than done, but you can look to your   feet for inspiration. The seals installed in the 
boreholes are long rubber tubes called sock seals. Kristen: Well, it's like a 
sock you put on your foot,   but a half-inch thick rubber 
and a hundred feet long.” [Grady laughing] Kristen: And I've heard it described as 
kind of like an inside-out fire hose.   Very strong and waterproof, 
but to some degree flexible. The mess is another problem. The dust from 
the fresh cut concrete mixes with lubricating   water to form a slurry that runs out of the slot. 
Concrete slurry isn’t good for the environment.   It mucks up the water and changes the chemistry. 
So the slurry generated by the cutting process   has to be captured and pumped to holding tanks. 
After the concrete particles have settled out,   the water can be recirculated to control the 
dust and lubricate the wire as it cuts. And   this whole process happens essentially 
non-stop. Time is of the essence so that   the internal stress doesn’t close the 
slot while the wire is still inside it.   Slot cutting is relatively low impact on the 
dam operations, but parts of the dam have to be   shut down to avoid an accident like a broken wire 
being pulled into a hydro unit or spillway gate. One of the reasons this is possible at all is 
that TVA’s concrete dams experiencing ASR are   all gravity dams. In essence, that means that 
any vertical slice of the dam is theoretically   stable on its own without lateral support. 
Cutting a slot in an arch dam wouldn’t work,   because they depend on axial 
thrust forces for stability. Before, during, and after the slot cutting 
operation, there’s an intensive monitoring   program to keep an eye on how the dam 
is behaving and methodically measure the   movement and strains to make sure the dam 
responds in the way the engineers predict. Kristen: We have hundreds and hundreds 
of instruments on the concrete portion   of the dam. We measure the slot that we've 
cut. Is it closing? Is it opening? At what   rate is it closing or opening? We 
measure our spillway piers. Are   they moving? We measure expansion joints. 
Everything in every direction we measure. And those measurements are important because the 
slot cutting isn’t a one-time permanent solution.   This doesn’t slow down the alkali-silica 
reaction in the concrete at all. It just   mitigates the stress building up in 
the structure as the concrete expands,   which is basically a non-stop process. Over time,   the slots close. That means that TVA has 
to go through the operation regularly. Kristen: Every approximately five years, 
we update, we use finite element analysis   models on our concrete growth projects. 
So they take all of those years of new   information data from the instruments 
and they recalibrate and they rerun these   models and they can tell us how effective 
the slot cut is. They can tell us when we   need to do it again. Whatever 
we need to do to ensure that we are   maintaining the integrity of our dams and 
the adjacent equipment, that's what we do. I was curious why they don’t just cut 
a big slot to get a longer period of   relief before having to do it again. In 
hindsight, it was kind of a dumb question: Kristen: The simple answer is so 
we don’t leave a big hole in the   dam. The slot cut at Chickamauga 
is approximately a half and inch.   It's a lot easier to stop water from flowing 
through a half an inch slot in a dam than   it would be maybe a six inch wide slot. 
In addition, slot cutting is expensive. In other words, TVA wants to disturb 
their structures as little as possible,   while still mitigating the problems AAR causes. 
It’s a back-and-forth thing. You cut, observe,   wait, and only cut again when it’s 
necessary. It’s good stewardship of   the resources available to take care 
of the structures we’ve already built. Alkali-silica reaction in concrete is a huge 
problem. It’s something engineers have to consider   when designing basically any concrete structure, 
which means it’s something that quarries,   batch plants, testing labs, and contractors 
have to think about as well. Since the 1970s,   we’ve gotten pretty good at avoiding it 
in our structures. But since it’s often   a slow-growing issue, we’re still figuring out 
how to deal with the problems it’s causing on   the stuff we built before we really had a 
handle on it. On mass concrete structures,   like TVA’s dams, it could have been a death 
blow, significantly shortening the lifespans   of these massive projects. But they figured 
out a creative solution to live with it. Kristen: “I mean, it's cool. 
And when you think about a dam,   it's a water barrier. It is 
designed to hold back water.   So the last thing you expect to do is to 
cut a piece out of it.  But we do.  We do.  Reactive aggregates are a hyper-local 
phenomenon. Go a few miles in any direction,   and the composition of rocks can completely 
change. That’s true for a lot of parts of life,   but one thing I never considered was how specific 
a sports stadium is to the city it's based in.   There are huge differences in how they’re 
built, where they’re located within a city,   and how it feels to watch a game. 
One of my favorite channels, Maapify,   produced a 3-part video series called Beyond 
the Bleachers that explores the people,   policies, and priorities that shape the 
differences in stadiums between the US   and Europe. And if you want to check 
it out, it’s only available on Nebula. You probably know about Nebula now, even if 
you’re not subscribed. It’s a streaming service   built by and for independent creators. No studio 
executives deciding what gets the green light, no   advertisements driving the content into a single 
style. It’s just independent creators making stuff   they’re excited about with as few barriers and 
distractions as possible between you and us. My videos go live on Nebula before they come out 
here, and my Practical Construction series was   specifically produced for Nebula viewers who want 
to see deeper dives into specific topics. I know   there are a lot of streaming platforms out there 
right now, and no one wants another monthly cost   to keep track of, but I also know that if you’re 
watching a show like this to end, there is a ton   of other stuff on Nebula that you’re going to 
enjoy as well. So we’ve made it dead simple: click   the link below and sign up for a free trial. Watch 
whatever you want for 3 days totally free. If you   love it, pay just one time for an entire year’s   access at go.nebula.tv/practical-engineering. 
We also have gift cards if you want to get a   subscription for someone you love. Or you can 
get a lifetime membership for 200 dollar off   right now. Pay once and have access for as long 
as you and Nebula last. Hopefully that’s a long   time! If you’re with me that independent 
creators are the future of great video,   I hope you’ll consider subscribing. Thank you 
for watching, and let me know what you think!

---

## 5. Hurricane vs. Tiny Houses
**Channel:** Practical Engineering | **Views:** 926K | **Date:** 2 months ago | **Duration:** 22:04 | **ID:** -2HSFJOzQQ8
**Link:** https://youtube.com/watch?v=-2HSFJOzQQ8

### Transcript:
By the end of this video, one of 
these buildings will be knocked   down by the force of a simulated storm surge,   because there’s a lot we still don’t understand 
about hurricanes and their effects on buildings. In September 2022, Hurricane Ian tore 
across the Caribbean and southeastern U.S.,   leaving a trail of devastation from Cuba to the   Carolinas. It was one of the strongest 
and deadliest storms in modern history.   We often think of hurricanes in terms of wind 
and rain. But in coastal areas, it’s the surge   of seawater driven inland by the storm that causes 
the most catastrophic damage. Homes and buildings   didn’t just get wet. Many were obliterated, 
swept from their foundations entirely. But unlike many storms of the past, Ian came 
with data, and lots of it. Today’s tools for   collecting and analyzing information mean that 
even tragic disasters can lead to really important   insights into how we can build safer and smarter 
in the future. After Hurricane Ian, FEMA analyzed   more than a thousand flood claims, and what they 
found about building performance was remarkable. To dig deeper, I’m here at O.H. Hinsdale 
Wave Research Labratory at Oregon State   University. A team of engineers is running 
a one-of-a-kind experiment to simulate storm   surge and study how buildings actually respond. 
They invited me here to see it firsthand and   share what they're learning with you. I’m 
Grady, and this is Practical Engineering. Everyone knows hurricanes are destructive, 
but storm surge often gets underestimated,   not just by the public, but 
policymakers and planners too.  The damage from high winds is visually dramatic.  We see footage of roofs ripped 
off and trees snapping like twigs. But just a few   feet of storm surge can cause even greater 
damage. And waves amplify the destruction. If you’ve spent time in coastal areas, you’ve 
probably seen homes raised on stilts. Since   the early 2000s, this has become one 
of the most common construction types   in flood-prone coastal zones. The concept is 
straightforward: move the living space above   the reach of storm surge. If a hurricane 
hits, the lower area used for parking,   storage, or access might flood, but the 
critical parts of the building stay dry.   All the devastating power of the waves flows 
through and around the stilts instead of slamming   into walls and destroying the structure. It 
turns out this idea is remarkably effective. After Hurricane Ian, FEMA found that flood 
insurance claims for elevated structures in   Fort Myers averaged about one-third the cost 
of claims for non-elevated buildings. That’s   a staggering difference in performance. But zoom 
in, and things get more complicated. On one hand,   this is pretty obvious stuff. You don’t need 
a massive wave laboratory to figure out that   elevated structures survive storm surge much 
better than buildings at grade. But if you look   at footage from Hurricane Ian, it paints a more 
nuanced picture, because some elevated buildings   didn’t fare well at all. They weren’t all high 
enough to avoid the surge. And that gets to one of   the most difficult questions in the entire field 
of hurricane engineering:  how tall is tall enough? Needless to say, it is expensive to lose your 
home in a storm. The conundrum is that it’s also   expensive to build your home in such a way 
that it can withstand one. If it were easy,   every building in Fort Myers would be a 
hundred feet above sea level. But the reality   is that elevating a structure adds significant 
upfront cost, and the higher you go, the higher   that expense climbs. It’s not just a cost for 
homeowners but also something that’s passed down   to renters. Shifting the actual housing upwards 
shifts the affordability of housing downward for   everyone. And because major hurricanes are 
relatively rare events, the return on that   investment comes with a lot of uncertainty, with 
benefits that are invisible most of the time. That’s one of the biggest challenges for 
engineers and officials. In theory, you can   design a structure that withstands anything. But 
in practice, no one’s building hurricane bunkers   as homes. Codes and policies have to balance 
safety with economic viability and long-term   risks with the upfront cost of resilience. Local 
governments want robust, resilient development,   but they also need development to happen in the 
first place. Overly strict codes can scare off   builders or price out developers. And while the 
National Flood Insurance Program might prefer   fewer claims, stricter floodplain regulations also 
come with tradeoffs: reduced property tax revenue,   limited housing supply, and the burden 
of compliance placed on individuals. These decisions might seem kind of trivial 
at the scale of a single structure,   but when you multiply them out along developed 
coastlines, the implications of each extra foot   of elevation are monumental. So what you 
end up with is a delicate balancing act,   shaped by competing priorities, enormous 
uncertainty, and billions of dollars on the line.   Changing building codes or policies requires 
buy-in from a broad array of stakeholders,   and that kind of consensus demands reliable data. But there’s one more thing that makes this 
even more complicated. Of course, “stuff   getting wet” is a problem with storm surge, but 
it’s more than just typical flood damage you’re   dealing with when it comes to hurricanes. In a 
sense, the surge is a rise in sea level itself,   and once your home is essentially IN the ocean, 
that brings wave action into play. Forces   intensify. Structural systems are tested in ways 
that ordinary flood damage doesn’t account for. You can see why this idea of elevating structures 
is one of those engineering concepts that seems   obvious on the surface, but gets way more 
complicated when you start looking into   the details. And that’s why we’re here. Computer 
models are limited in their capabilities. And you   can’t just call up an actual hurricane to knock 
over a test structure (and even if you could,   it would probably violate the ethics rules). 
So we go to the next best thing: the wave lab. The OH Hinsdale Wave Research Laboratory is one 
of the largest facilities of its kind in the   world. Since the 1970s, this lab has supported 
cutting-edge research into coastal engineering   challenges like sediment movement, tsunami 
behavior, and wave-structure interactions.   It actually has two major test beds. This 
is the Large Wave Flume. It’s used for all   kinds of hydraulic experiments related to waves, 
coastal structures, and erosion. It’s basically   a super-sized version of the flume I use in 
a lot of my garage demos. It can do a lot,   but it has a limitation in that it’s inherently 
two-dimensional. Flow can really only move in the   direction of the flume. That’s why the lab 
also has this: the Directional Wave Basin. Think of it as a wave pool turned up to eleven. 
This enormous tank uses dozens of piston-driven   paddles, each with independent control, to 
generate complex, multi-directional waves.   You can create a single tsunami-like pulse or dial 
in irregular wave trains to match the chaotic sea   states found in real hurricanes. This facility 
is utilized in large-scale research projects on   wave hydrodynamics, floating structures, and 
devices that harness wave energy to generate   electricity. But, of course, it can also 
test coastal structures, like these houses. Dr. Dan Cox is a Coastal Engineer and Civil 
Engineering Professor at Oregon State.   He explained to me why they chose 
the basin for this experiment. “The nice thing about the basin is, you 
can look at kind of a full 3-D picture, rather   than just a slice. And I think for this set of 
tests, we really wanted to do an entire house, not   just a wall, you know, a bit of the foundation. 
And that’s why we chose the basin for this one.” The research team has spent months building 
two incredibly detailed model homes,   each one a near-perfect one-third scale replica of 
a real coastal house. Each foot is equivalent to   three feet in real life. And the only difference 
(besides color) between them is elevation. The   green model is a foot or 30 centimeters higher 
up than the orange one. That corresponds to 3   feet in the real world or roughly one meter. In 
every other way, both structures are identical.   They’ve got interior walls, windows, framing 
details, everything. At this scale, that means I’m   about the size of an 18-foot-tall civil engineer… 
which is actually something I’ve had dreams about. One-third scale is still just a model. 
But this is not a toy experiment. The   researchers have carefully accounted 
for all the physics involved.  The wave periods and velocities have been adjusted 
to simulate full-scale conditions, and the   structures have reduced stiffness to reflect 
the relative rigidity of real-world buildings.   It’s all about maintaining dynamic similarity, 
a fancy term for making sure the test results   actually mean something when translated back 
to full size. And that’s a tough thing to do: “On the structure side, it’s a lot more difficult 
to scale the structural behavior. So, for example,   when we’re doing computer simulations, the 
simulations are primarily at scale - trying to   get that difference in shaking. The forces can 
generally be scaled up as well, so we kind of   know what the forces are. But I think the mode of 
failure - like how this structure failed - I’m not   sure so much as like a quantitative scaling. It’s 
a little bit more like qualitatively, this is what   we would expect to happen under these conditions.”  The experimental design has the waves start   small and build gradually, both in height and 
frequency, simulating the approach of a storm.   The goal is to observe how both buildings 
respond as conditions get worse and worse.  It’s mesmerizing to watch: the wave generators 
churn, sending pulse after pulse across the basin.   Within seconds, the models are surrounded 
by rolling water, with each wave slapping   against walls, flowing around supports, and 
rebounding off the basin walls and shoreline.  Even now, researchers at the lab are measuring the 
behavior of the structures.  If you look carefully,   you’ll notice targets for highly specialized 
cameras and lidar to carefully monitor the   behavior of each structure. Sensors 
placed throughout the experiment are   recording everything—wave height, velocity, 
pressure on the structure, accelerations,   and even internal motion. The goal is to build a 
detailed, physics-based understanding of how each   building absorbs and transfers 
energy from the storm surge.  And that data is incredibly valuable. For one, this expensive and elaborate test is just 
two buildings. And there are a lot more types of   houses in the world than that. So this data can 
be used to calibrate and validate computer models,   making it easier for engineers to get 
reliable answers to questions without   having to build scale buildings and put 
them through huge model tests like this. And some of those questions are big 
ones. When you’re looking at options   for large-scale flood infrastructure, a 
major part of the process is estimating   the differences in damage and loss 
of life between alternatives. Again,   we can’t build infrastructure, call down 
a hurricane, and test it out in real life,   then revise accordingly. Even engineers shouldn’t 
have THAT kind of power. So we have to be able to   make predictions about how any proposal will work 
out. It’s educated guessing, essentially. But the   better we understand the connections between 
all the variables (wave height, surge level,   building elevation, movement, and damage), 
the more educated those guesses become. “I would say the physical model 
is closer to the real world.  It's the best, in a numerical simulation, it's kind of the best we think we can do.  But -  And it always looks pretty,   always looks really cool. But there’s really 
- you have to verify it. You really have to   show that it’s correct, not just looks cool. 
And I think when we get to the laboratory,   like we’re seeing during this test, like 
okay, it’s not as simple as we think.   So there’s a lot more complexity, I 
think, inherent in a physical model.” That’s why even though these tests seem 
pretty straightforward at first, they can   have a profound impact on how we allocate public 
funds, regulate floodplains, and ultimately,   keep people safe. You probably wouldn’t buy 
a car without giving it a test drive first;   it’s too big a financial decision to take a 
risk. Imagine changing the building code or   floodplain regulations without good data to back 
it up. We necessarily make high-stakes decisions   about how to manage flooding in the face of 
equally enormous uncertainties. So, you can   see why information like this would give more 
confidence to engineers and regulators to write   building codes and improve floodplain regulations, 
knowing those decisions are grounded in truth. But it’s not just about the data. You might have 
noticed that these houses aren’t just bare minimum   structures. The team has added details like 
roofing, window frames, and colorful paint jobs   to make them look like real buildings, even though 
they don’t really affect the final results. That’s   because this test is also a communication 
tool. Most people aren’t going to read the   academic papers that get published as a result 
of this study, but this footage tells a story. You don’t need data to understand which of 
these two structures you’d want to live in   when a hurricane comes. And the more 
people who take storm surge seriously,   the better the outcomes we can 
expect when a big storm arrives. Each set of waves is programmed into the 
machine to simulate the variability of a storm,   with the upper limit of wave 
amplitude increasing from one   set to the next. After four sets of 
waves (delivered in about an hour),   they raise the level in the basin using this 
massive bathtub faucet and repeat the process.   It was actually pretty surprising how well 
both models were holding up for a while there. It’s hard to communicate in a video 
just how awe-inspiring it is when   the directional wave basin starts 
really churning. And eventually,   a particularly violent wave comes crashing into 
the lower house, and we see our first damage.   You can see the wall underneath the window give 
way, and now waves start penetrating into the   interior of the structure. In a real house, 
this would already be catastrophic damage. But of course, they don’t stop at the first 
sign of damage, and the team keeps hammering   the models with more intense waves. Over the 
course of the experiment, the sea conditions   just keep getting worse and worse, and 
the damage to the orange house does too.   More and more of the first story of 
the lower house is swept away.  Waves  flow through the structure and knock out 
portions of the wall on the beach side,   and everybody in the room fills with 
eager anticipation of a total failure. And then, something I didn’t quite expect 
happened. The model seemed to almost stabilize.   The walls of the front and back of the structure 
were so totally obliterated that the first floor   almost began to act like another level of stilts! 
Despite the first floor being utterly wrecked,   the second story remained more or less fine for 
quite a while, even as the waves got stronger. Dan told us about a test at half this 
scale (one sixth of real life scale)   that had shown similar progressive damage, 
but that led to collapse much earlier on: “In the previous study, we started to see 
the deterioration and then very quickly,   rapidly, the entire building 
destroyed and I thought, okay,   well we'll see that again at 
larger scale, but we didn't.” That’s one of the cool things about moving up 
in scale and realism: you learn things that   aren’t always expected. If we had cameras 
on every structure during Hurricane Ian,   we likely would have seen similar results - 
damages from storms rarely follow a linear,   progressive trend. It comes in fits and 
starts. For a while, it seemed like it   might be the end of the experiment, since the 
stronger waves weren’t causing more damage. “…It was a tough problem, and I thought I 
knew the answer, and it turns out I didn’t.   Little bit tough to swallow, but it also kind of 
highlights to me, like, okay this is a challenge.   This is a hard problem. So for me, you know, 
I’m trying to put a positive spin on it, but   I feel like that’s a success right there. To say 
hey, this is more complicated than we thought.” Of course, everyone watching (including me) 
and those participating in the experiment   were hoping for that final blow that would 
knock the whole thing over so they could get   the full range of data needed from safe 
to damaged to destroyed.  And eventually, the moment came.  The waves finally 
won, and the lower house collapsed. "Holy moly!" What’s probably more interesting 
than that is the condition of the   other house. Take a look at that. Almost no 
damage whatsoever. This building sat in the   exact same conditions as the other house 
and took almost no damage. And in a way,   that’s kind of remarkable. Because there really 
wasn’t that big of a difference between the   two. I said it’s expensive to elevate a 
structure, but the marginal cost between   the green and orange models is almost negligible 
compared to the overall value of the structures. “In talking to people about flood risk, 
you know, we talk about the 100-year,   500-year. And I think there’s a misperception 
that the 500-year is like 5 times bigger,   5 times worse, I have to elevate 5 times 
greater. And I think just trying to show   people it doesn’t take much. Like, there was not 
much of a difference in elevation between those   two buildings. The one on the right is toast. 
The one on the left had a little bit of damage,   but hardly any, and that was only after we 
really tried to...  take the other one out.” The researchers will be studying the data from 
this experiment for years to come. But the   story's pretty clear. Same surge, same 
waves. A little difference in elevation   can make a huge difference to a structure 
when it comes to surviving a hurricane. You might be watching these buildings get knocked 
about and thinking: “We don’t need more resilient   structures in the floodplain; we just need 
them to not be there in the first place.”   And in many ways, you’d be totally right. 
Often, the most economical way to reduce   flood damage is to avoid building in flood prone 
areas, or if development has already happened,   simply to buy out property, tear it down, and 
leave the land empty as a buffer. But where’s the   line between flood-prone and not, especially when 
it comes to rare events like hurricanes, where the   probabilities of occurring in a year are in the 
range of 1-in-100 or 1-in-500? And if there’s   not a bright line between at-risk of flooding 
and not, what’s appropriate for the fringe? The truth is that there is no catch-all solution 
to flooding. We need options to accommodate the   vast array of situations where development 
occurs, whether those areas are flood-prone,   flood-free, or, most importantly, somewhere 
in the middle. And not just options, but also   the data to determine which of them is truly the 
best path forward. Engineering is a balancing act;   we need structures that are both strong and 
safe, but also affordable, easy to occupy,   and maybe even architecturally pleasing. 
Using knowledge gained from tests like   this helps us get a clearer definition of 
the edges of the problem we’re solving. Huge thanks to Dr. Dan Cox and his team of 
researchers for inviting us to see this happen.   I love talking about the engineering of the built 
world that often goes unseen like this test. I   can’t always travel to university labs, so a lot 
of my videos feature homebuilt demonstrations   I build in my garage. And a lot of those models 
feature parts from today’s sponsor, Send-Cut-Send. Look at this list of materials they can cut for 
you. And this is so easy: design your part in your   favorite CAD software or even Adobe Illustrator. 
Upload it to the platform. Choose any additional   services like bending, countersinking, tapping, or 
even hardware insertion, and get an instant quote.   I love the price transparency, and I even go back 
to the drawing board sometimes to make revisions.   Parts are made in the USA, they’re out the door 
in a day or two, and there’s no minimum quantity,   so the value proposition is hard to beat here: I 
could spend half a day in the shop making a part,   or I could have Send-Cut-Send do it 
for me for a very reasonable price,   freeing up my time for other stuff. I tried this 
once, and since then, it’s just unlocked this   whole new world of possibilities for the stuff I 
build. If you’re in the US or Canada and want to   give it a try click that link below. Thank you 
for watching, and let me know what you think!

---

## 6. The Hidden Engineering Behind the Falkirk Wheel
**Channel:** Practical Engineering | **Views:** 699K | **Date:** 2 months ago | **Duration:** 15:15 | **ID:** sq6ZOVbKQhY
**Link:** https://youtube.com/watch?v=sq6ZOVbKQhY

### Transcript:
This is the Forth and Clyde Canal in 
central Scotland. Completed in 1790,   it was the first canal to cross any part of the 
British Isles. There are a lot of geographical   terms for coastal features where the sea indents 
into the land: sounds, inlets, fjords, lochs,   coves, bays, and so on. They all have subtly 
different meanings that can vary by location,   but in Scotland, a lot of them are called 
“firths,” and they’re pretty important when it   comes to navigation. The Forth and Clyde Canal, as 
its name strongly suggests, connects the Firth of   Forth to the Firth of Clyde. It also has a branch 
into the heart of Glasgow. When it was built,   this canal dramatically shortened the 
transit times for goods in the region,   and it also served as the testing waters 
for the very first steam-powered boats. Not long after the Forth and Clyde opened, 
another important canal was completed in   Scotland. The Union Canal connected 
the cities of Falkirk and Edinburgh,   opening up a route for coal and other minerals 
from the mines and quarries around Lanarkshire to   the capital. Along the way, it passes over some 
pretty impressive aqueducts, including the Avon   Aqueduct near Linlithgow. A connection to the 
Forth and Clyde Canal in Falkirk would provide   a direct waterway link between the two largest 
cities in the country (Edinburgh and Glasgow)   without ships needing to navigate the hazardous 
Firth of Forth. But there is the challenge of   elevation. Union Canal sits about 115 feet or 38 
meters above the level of the Forth and Clyde. Moving people and goods by boat has a lot 
of advantages: it’s cheap, it’s efficient,   it usually takes less infrastructure, and it 
allows for connectivity across the globe. But   there is a major disadvantage: the waterways that 
ships and boats traverse have to be pretty much   level. Boats don’t climb hills like cars, trucks, 
and trains. This is the main purpose of a lock:   raising or lowering a vessel to navigate 
elevation changes in waterways. In fact,   locks are pretty much the only solution to this 
engineering challenge… except in a few rare cases. You’ve seen the title. You know where 
I’m headed with this. But the story of   the Falkirk Wheel - the only rotary boat lift in 
the world - is fascinating, not just because of   the mechanisms, but also how it came to be in the 
first place. It’s not easy to accomplish projects   like this. The Falkirk Wheel is not the passion 
project of some lone eccentric billionaire.   This is public infrastructure, which means a vast 
array of stakeholders had to come together and   agree that this bizarre structure was worth the 
resources that went into building it. It’s got   some very clever engineering under the hood, and 
a lot of lessons in its creation that, I think,   apply to other challenges we face today. I’m 
Grady, and this is Practical Engineering. Of course, the original connection between 
the Forth and Clyde and Union canals did use   locks. A lot of locks. This map from 1898 shows 
the flight of 11 locks required to get boats up   and down between the two. You can imagine 
the time, resources, and effort involved in   navigating this staircase. The process took 
the better part of a day, and not only that,   it used a lot of water from the Union Canal. 
Even though boats can move through locks in   both directions, water only moves through in one. 
Each structure always fills from the upper canal,   and always drains to the lower one. That’s 
just gravity. But, it’s important to realize   that even though most locks don’t use pumps, the 
energy required to raise and lower boats through   isn’t free. Each passage through costs roughly 
one “lock-full” of water from the upper canal. In addition to the inconvenience and water usage, 
other factors eventually drove these canal systems   in Scotland into disrepair and abandonment. The 
canals were small, and as ships got larger, the   narrow and shallow passages became less useful for 
transporting materials and goods. The railroads   also started competing with the canals, offering 
faster connections between major cities. By 1930,   the canals were barely used, and by 1960, they 
were choked with vegetation and debris. Motorway   construction disconnected several segments, and 
authorities decided to close them for good. That   could have been the end of the story, and 
honestly, it wouldn’t be too surprising.   It’s been the fate of many of the world's great 
canals and inland waterways as transportation   technologies and overland shipping have passed 
them by.  But then the year 2000 happened. Maybe you remember this. It was a weird time 
to be alive. There was this strange tension   between excitement about the new century and fear 
that all our computer systems would crash into an   apocalypse. The programmers and IT professionals 
took good care of us on the computer side,   but there were people working hard 
on the celebrations, too. One of   those organizations was the United Kingdom’s 
Millennium Commission. The idea was simple:   take some of the money from the National 
Lottery and direct it toward interesting   and impactful projects that would 
help mark the turn of the century. In Scotland, a large consortium of organizations 
- public, private, and volunteers - got together   and applied for a grant from the Millennium 
Commission. In 1997, funding was awarded to cover   approximately half of the cost of the Millennium 
Link: a massive undertaking to revitalize   and reopen the canals that once connected 
Scotland from coast to coast, restore locks,   build hike-and-bike trails, and rehabilitate 
bridges. The work included The Kelpies,   a sculpture of two huge horse heads that serve as 
the gateway to the Forth and Clyde canal. That was   a pretty fascinating civil engineering project 
in its own right. But of course, the Millennium   Link’s flagship project was reconnecting 
the Forth and Clyde to the Union Canal. But rather than do it with locks, the group wanted 
a 21st-century landmark, or I guess, more of a   watermark. A fast, efficient connection that would 
serve as a capstone to the canal revitalization,   draw tourists from around the world, and serve 
as a symbol of the region that was once a hub   of transportation and commerce in Scotland. 
And, in fact, a hub is a good metaphor for   what they came up with. The Falkirk Wheel 
opened for traffic in May 2002, and now,   more than two decades later, it’s pretty clear 
that they nailed the idea. Here’s how it works: Boats bound for the Union Canal enter a circular 
turning basin at the bottom. The Wheel has two   opposed arms, each with water-filled gondolas (or 
caissons) spanning between them. Those gondolas   are mounted on bearings that ride on circular 
rails. When one goes up, the other comes down,   so traffic can move both ways. The wheel is 
driven at its center using hydraulic motors   that keep the motion smooth and slow. Idler 
pinions mesh between two identical ring gears:   one fixed and centered on the shaft; 
the other surrounding each gondola.   This arrangement enables the gondolas 
to counter-rotate as the wheel moves,   maintaining their perfect upright position 
throughout the full range of motion. The elegance of the Falkirk Wheel hides 
some fairly complicated systems that make   it function. At the top and bottom, each 
gondola has to be able to open and close   to let boats in and out. And the aqueduct at 
the top needs the same capability so water   doesn’t just flow off the edge when the wheel is moving.  The docking and undocking 
procedure is a delicate dance.  When a gondola reaches the top 
position, stow pins extend to lock it in place.   Then an extendable lance connects it to a 
hydraulic power unit. A U-shaped seal extends   to bridge the gap between the two structures, and 
pipes fill the gap between the gates with water,   balancing the pressure. Finally, hydraulic rams 
open the gates on both sides, allowing boats   to enter or leave. The whole process happens in 
reverse, and then the wheel is free to move again. Part of the engineering genius of the Falkirk 
Wheel is that it’s always balanced, whether   there are boats inside the gondolas or not. This 
is one of those confusing things about buoyancy:   a floating vessel always displaces its 
own weight in water. Theoretically,   as long as the water level stays the same, when a 
boat floats over an aqueduct, there is no change   in forces on the columns. The displaced water 
flows away, balancing the new force of the boat.   Same thing for the gondolas. When a boat 
floats in, its weight in water flows out,   maintaining a balance between the two sides. As a 
result, the Falkirk Wheel doesn’t really require a   lot of power to operate. It’s about one-and-a-half 
kilowatt-hours for a half turn of the wheel,   often compared to the power required to 
boil eight kettles of water. Where I live,   that’s less than 25 cents in electricity. 
And unlike the day-long climb of the   industrial-revolution-era locks, the Wheel moves 
boats between levels in about five minutes. The Scottish Canals see almost no commercial 
shipping these days. They’re still too small,   and the road and rail networks are still faster. 
But the canals do see a lot of traffic. There’s   a whole class of vessels specifically designed 
for navigating the unique and historic canals   of the UK. Similar to RV culture in the US, 
narrowboats ply the inland waters across England,   Wales, Scotland, and beyond, used for holidays, 
touring, and even as long-term homes. During the   early Industrial Revolution, boats like 
this were pulled along canals by horses   or donkeys from towpaths that ran alongside 
them. Modern narrowboats are self-propelled   and often equipped with domestic comforts, 
including bathrooms, kitchens, heating,   and internet. The number of boats has been 
steadily increasing over the past decade,   offering the freedom and lower cost 
of a nomadic lifestyle on the canals. Even for those not living on narrowboats, 
cruises and tours along the canals offer   something unique. It’s a totally different way 
to experience the landscape in some of Great   Britain’s most beautiful areas, and it offers 
insights into the history of the region that   you can’t get anywhere else. And of course, you 
also get to see the fascinating infrastructure,   including a boat lift that you won’t 
find anywhere else in the world. But it doesn’t go all the way up. When 
a segment of the canal was relocated   as part of the Millennium Link, it 
needed to cross the Antonine Wall,   a Roman-era defensive perimeter and UNESCO World 
Heritage Site. Rather than disturb it, the new   canal was built into a tunnel below. From the 
aqueduct at the top of the Wheel, two new locks   raise boats the remaining distance once they pass 
underneath the wall to the top of the Union Canal. The Antonine Wall marked the far northern 
border of the Roman Empire. On another edge,   just a handful of decades before it 
was built, Mount Vesuvius erupted,   burying the city of Pompeii in ash. But there’s 
a twist to that story. My friends at the podcast,   RadioLab, are just about to premiere a fantastic 
video about the survivors of Pompeii and how we   discovered that some people actually escaped. This 
simultaneous release is part of a collaboration   with the Independent Media Initiative to highlight 
some of the best educational and artistic creators   on the internet. I’m really thankful for the 
award the channel won this year for my Practical   Construction special, and I’m so excited to hand 
off to one of my favorite shows on the internet,   RadioLab, for the next video in this 
collaboration. Go check it out after this! When I was a kid, my dad used to tell me, 
“If the only reason you want something is   because it’s cool, you probably don’t need 
it.” You can look at me and probably tell   I took that advice to heart. But there are 
situations where it’s worth doing something   just because it’s going to be impressive. The 
Falkirk Wheel is a perfect example. Locks are   a perfectly functional solution to get boats 
up and down to different elevations. There   are thousands of them around the world 
diligently serving our inland waterways.   Scotland wanted something special, something 
that would spark a resurgence in their canal   system and revitalize the sense of pride in 
the communities along them. It took guts to   try something completely different, and it 
paid off. Millions of people have visited to   watch it turn or travel through it. The 
Falkirk Wheel didn’t just reconnect two   canals. It reconnected people with the idea that 
infrastructure can be both useful and pretty cool. Here’s something else that’s pretty cool: 
a homecooked meal that’s seasonal, healthy,   and didn’t require a trip to the grocery 
store. We’ve been using today’s sponsor,   HelloFresh, for years now, even 
before these ones were born. And   now they’re actually old enough 
to help out with dinner… kind of. “Oh, some snail shells. Put them in the pot!” The idea is simple and perfect for us:   pre-portioned ingredients shipped right to 
your door so you have dinners ready to go. “Ahhh! It’s burning!” These helpers can be a bit picky, but 
HelloFresh has expanded their options   and even made them customizable to 
fit the preferences of the week. “Just put the pepper on momma’s 
croutons. I like it spicy.  “Where’s your croutons?”
“These will be mine.” And in fact, HelloFresh has kid-friendly 
choices that are specifically curated   for the little ones that don’t like 
to stray from the staples like I do. “Don’t mind the man saying ‘Oh 
no’ repeatedly in the background.” Even beyond the good food, using Hello 
Fresh is just a great way to spend time   together. Having it as a kit like 
this makes it fun for the kids,   keeps them involved, and (I think) 
makes them more likely to try new foods. “I’m cooking mushrooms on the stove!” Give a second chance to the ‘NEW’ 
HelloFresh by using my code PRACTICALFM   at HelloFresh dot com for 10 Free Meals + 
Free Breakfast for Life. This part’s verbatim:   One free meal per box with active subscription. 
Free meals applied as discount on first box,   new or returning subscribers only, varies by 
plan. Sign up today! Click the link below or   use my code PRACTICALFM at HelloFresh.com. Thank 
you for watching and let me know what you think.

---

## 7. Concrete's Greatest Weakness is Time
**Channel:** Practical Engineering | **Views:** 767K | **Date:** 3 months ago | **Duration:** 17:04 | **ID:** f2uad6LT9fo
**Link:** https://youtube.com/watch?v=f2uad6LT9fo

### Transcript:
On March 2, 1973, the Skyline Plaza tower was 
under construction in a suburb of Washington,   DC. Crews had just placed a portion of the floor 
slab for the 24th story, just two floors short   of the project’s final height. Shortly after 
lunch, workers noticed that the new slab was   deflecting. Suddenly, a portion of the building 
collapsed, killing 14 and injuring many more.   The collapse left a gap in the building 18 meters 
or 60 feet wide, essentially slicing it in two. Investigators later found that workers had removed 
the formwork and shoring for the lower floors too   early. Because of cold weather, the already-placed 
concrete in those lower floors hadn’t gained   strength as quickly as they expected. Without 
the shoring transferring loads into the structure   below, the under-cured concrete was forced to 
bear the weight. And it just wasn’t strong enough. Concrete is an incredible material. I’ve 
covered a lot of concrete topics in previous   videos. There are good reasons why we use 
so much of it in the built environment. But,   and this is hard for me to say, 
it’s not without its flaws.   Even putting aside the environmental 
issues, as a building material,   concrete creates challenges that are unique 
and, in many cases, not that well-understood. Most building materials, after they're fastened 
or put in place, are immediately ready to use.   That’s not true for concrete, and even if 
it seems kind of obvious, it creates some   really interesting challenges for engineers, 
architects, and contractors. So I’ve cast some   concrete cylinders in the garage, and we’re going 
to break them to understand this weird property   of concrete and some of the ways we work around 
it. I’m Grady, and this is Practical Engineering. As soon as water meets the cement in 
concrete mix, the clock starts ticking,   and there’s basically no stopping it. The working 
life of concrete consists of two key phases,   and they demand almost opposite properties. 
Phase one has to be workable and easy to shape.   Concrete placement and finishing is a 
ton of work with a lot of steps that   each have to happen at the right time. 
Of course, the second phase is strength;   no matter how beautifully formed concrete is, it’s 
useless unless it can handle its designed load. The process begins even before the concrete 
arrives on site. Most large jobs rely on ready-mix   batch plants, where ingredients are measured 
and blended according to project specifications,   then loaded into rotating drum trucks for 
delivery. Concrete is relatively cheap by   weight compared to other building materials. At 
its most basic, it’s just sand, gravel, cement,   and water. But placing it is labor-intensive, 
time-sensitive, and expensive, plus many projects   use a lot of it. So it’s important that the right 
stuff makes it to the job. Engineers often put   strict specifications not only the the ingredients 
themselves, but how the concrete is handled on the   way to the job site. Some even put limits on 
the number of drum revolutions allowed before   the concrete is dispensed, helping to prevent 
ingredient breakdown and loss of entrained air. Once on site, the first task is getting 
the concrete into the forms. At this stage,   workability is everything. It doesn’t need 
to flow like water, but it should move easily   enough to be placed quickly and completely. 
You want some flow, especially for complex   shapes or when you have a lot of reinforcement. 
Next is consolidation - usually with vibration   or agitation - to get rid of excess trapped air. 
For slabs, workers screed the surface to level it,   then use floats to push down coarse aggregates and 
prepare for the final finish. This is physically   demanding work, and every step has to be done 
before the mix becomes too stiff to work with. We do have some tools to manage this process. 
Admixtures can adjust the set time and improve   workability without adding extra water, 
which would otherwise weaken the final   product. But the water in concrete isn’t 
a solvent that dries out. Concrete cures   through a chemical reaction called hydration. 
The water becomes a part of the concrete.  And that hydration process can be affected 
by jobsite conditions like temperature,   wind, or delays at the batch plant, 
which are out of your control. That   unpredictability can make a big concrete pour 
extremely stressful. You don’t get do-overs. Depending on conditions, concrete typically 
reaches its initial set in about 2 to 4 hours.   That’s when the mix is firm enough that you can’t 
easily press a finger into it. At this point,   it’s ready for finishing, whether 
that’s troweling for a smooth floor,   brooming for a textured sidewalk, 
or stamping for decorative work.   Each technique has to happen during a short 
window between the initial and final set,   when the concrete is firm enough to support 
workers but still soft enough to shape. On big projects, timing is critical.  Standardized 
tests are often used to measure set times and   guide trial batches so that each task can be 
scheduled precisely. After final set, the next   phase begins: waiting. I cast a bunch of concrete 
cylinders to show you exactly what I mean. It’s 24 hours later, so let’s get these on 
the hydraulic press. I’ve got Brady in the   shop supervising the process. And my scale isn’t 
calibrated, so we’ll do all the comparisons in   arbitrary units of force. Some people suggested 
kilogradys last time I used this, so let’s go   with that. Even without looking at the scale, you 
can tell these samples aren’t very strong. Under   the press, they kind of crumble more than break 
apart, and this is pretty typical.  After a day, concrete’s strong enough to walk on. And, 
depending on the structure, this could be a   good time to strip off the formwork, but you’re 
not going to get away with much more than that.   I broke 3 cylinders, and we’ll plot them on the 
graph like this. Let’s fast forward to 7 days. For large projects, the concrete 
specifications often require a test   at this point. It’s the same idea as what 
I’m doing here, just with more sophisticated   equipment. Samples collected on site are put 
in cylindrical or cubic molds, taken to a lab,   and cured in controlled conditions. Then they’re 
put into a press much more complicated than this,   and the force required to break them is 
measured. The idea behind a 7-day test is that,   if the concrete isn’t going to reach its required 
strength, you want to know as early as possible. Let’s put these test results in on our 
graph. The average was 9300 kilogradys so,   a 3X increase from the 1-day breaks. Strength 
gain usually follows a predictable curve,   so early results can be extrapolated with 
reasonable confidence. If something’s wrong,   you can often tell early and start planning 
accordingly, even if that means tearing out   a pour and resetting the schedule. As costly 
as it sounds, it’s nothing compared to the   consequences of trusting concrete that isn’t 
as strong as the engineer assumed in design. This highlights one of the biggest challenges with 
concrete: you can’t fully test quality until after   installation. Most building materials go through 
inspection before arriving on site. With concrete,   you can test the raw ingredients and even 
make trial batches, but the real test is   whether the mix you placed in the formwork 
meets strength requirements after it cures.   That uncertainty adds risk. To hedge against it, 
suppliers often design mixes with extra strength   margin to make sure that, even with some random 
variation, strength will never come in too low.   Sometimes, waiting longer can help a 
borderline mix catch up. But in some cases,   a failed strength test really does mean 
tearing everything out and starting over. Another complication is where samples are 
cured. Standard lab specimens are kept in   tightly controlled environments. This helps 
verify that the supplier met the required   mix specifications. But it doesn’t always 
reflect conditions in the actual structure,   where temperature, humidity, and weather can vary 
wildly. That’s why many projects also include   testing of field-cured samples, which gives a 
more realistic picture of the in-place strength.   If this had been done at Skyline Plaza, the 
cold-weather delays in curing might have   been caught, preventing a costly and deadly 
failure when shoring was removed too early. On a well-run job, a good 7-day result 
gives confidence that everything is on track.  Even though the concrete hasn’t 
reached its target strength yet,   you have a solid indication that it will. I also broke some 14-day samples, not typically 
required on jobs, but useful for seeing the big picture.  The graph shows that strength continues to rise,   though the rate is already slowing. 
Let’s jump ahead two more weeks. 28 days is a fairly arbitrary, but widely used 
benchmark for when the rate of hydration flattens out.  Usually, when we talk about the compressive 
strength of concrete - 4000 psi or 28 MPa, or  10,000 kilogradys per square smoot, or 
whatever it might be - we’re talking about   the minimum 28-day strength. A significant amount 
of concrete engineering is based on this strength.   The goal is that 28 days after placement, 
you can feel confident that the structure   will perform up to the maximum loads as it 
was designed. My 28-day samples broke at an   average force of about 11,000 kilogradys, about 
20 percent stronger than the 7-day ones. Pretty   close to the rule of thumb that concrete reaches 
around 75% of its final strength after one week. But you see the problem here. A month is a 
long time, and time is money in the world of   construction. There are some things you can do in 
the interim - maybe install anchors or apply light   loads. For a sidewalk or driveway that rarely sees 
heavy vehicles, concrete might be strong enough   at 7 days. But for applications where the margin 
between expected loads and material strength are   tighter, you just have to wait. And this can 
be a real problem in some cases. Think about   concrete roadways. How long are you willing 
to wait to keep a lane closed after a repair?   Tall buildings have a similar problem. If 
you wait 28 days for every floor to cure,   it’s going to be a long and slow project. 
You can see how concrete cure time turns   into a serious bottleneck and can often become 
the critical path on a construction schedule. Luckily, there are a few ways to speed things up. 
One is just to use a stronger mix. The logic here   is simple. Say you need a 4000 psi concrete, but 
you don’t want to wait 28 days. If you use a 5000   psi mix design, theoretically, you’ll hit 4000 psi 
after just over a week. This adds material cost,   but the time savings can make it worthwhile. 
Other strategies include using “high early   strength” cement that’s ground more finely to 
speed up hydration, or altering the mix ratio by   adding more cement or reducing water. Heating the 
mix water or curing under blankets can also help. Chemical accelerators are another tool. Calcium 
chloride is a popular choice because it’s cheap,   but it has drawbacks. Chloride ions can 
speed up corrosion of steel reinforcement,   so lots of engineers won’t allow calcium chloride 
in concrete in their projects. Non-chloride   accelerators (or NCAs) have gotten better 
over the years and may be a safer alternative,   but they still pose challenges. The curing 
of concrete is an exothermic reaction,   so faster hydration generates more heat, which 
can lead to cracking as the concrete cools. And,   of course, it shortens the working 
time for placing and finishing. I hope you can see the complexity in all 
this. There is a lot we ask concrete to do,   and because it hardens relatively slowly, there’s 
a lot riding on how and when concrete gains   strength. It’s not just about stripping forms or 
removing shoring. In many construction projects,   the strength gain of the concrete governs 
every downstream operation. It determines   when floors can support framing, when roads 
can open, and when a project can move forward. And there’s nothing magical about 28 days. It’s 
just four weeks. It’s a number of convenience   that makes it easy to talk about concrete 
strength and compare properties. In fact,   most concrete will continue to gain strength for 
months or even years after that first four weeks,   depending on the mix design and steps 
taken during curing. And many projects   require that it does. Compressive strength 
isn’t everything when it comes to concrete.   There are time- or exposure-dependent 
failure modes like shrinkage, creep,   and long-term degradation from freeze-thaw 
that play an important role in design.   So some projects like dams and bridges often have 
90-day requirements to ensure that the concrete   eventually reaches a strength to resist them, 
even if it doesn’t need to happen right away. But that 28-day convention gives a hint about 
concrete’s greatest weakness: time. Really,   no other structural material requires 
you to wait weeks before knowing whether   it will actually perform as expected. While 
most materials arrive on site ready to use,   concrete requires a leap of 
faith. And then, a long pause. Concrete is strong, durable, and incredibly 
versatile. There’s nothing like it! It’s   a building material worth celebrating in many 
ways, but only on its own terms. You can place   it quickly. You can shape it into nearly 
anything. But you can’t rush what happens   next. That’s the challenge and the art of concrete 
construction: it’s a balancing act between acting   fast and waiting long enough. It’s a material 
that embodies both a sprint and a marathon. A lot of people don’t think about concrete as 
an academic topic, but because of its importance   across the globe, there are a lot of researchers 
who spend their entire careers studying it. I read   a lot of journal articles about concrete as 
research for this video, most of them helpful   if not particularly groundbreaking. But every 
once in a while, an academic paper takes on a   life of its own. That’s the story told by my 
friend Kevin of the “Bobby Broccoli” channel   in the new documentary, 17 Pages. A single 
paper sparked a scandal so big it was called   the “Scientific Watergate. 17 Pages dives deep 
into one of the most controversial science ethics   cases of the 20th century. And if you want to 
check it out, it’s only available on Nebula. Nebula’s a streaming platform built by and for 
independent creators, including channels like   Strange Parts, Integza, Real Engineering, and 
Hacksmith Industries. You get early access,   no ads, and content that’s thoughtful and 
well-researched. Plus, Nebula’s got a lot   of really impressive original content that 
can’t be found anywhere else, like 17 Pages. If you want to give it a try, it’s basically 
a cup of coffee month. If you prefer to avoid   subscriptions, we also have lifetime memberships; 
pay once and keep it forever. It’s normally   $500 but you can save $200 by using the link in 
the description. We also have gift cards if you   want to share a subscription with a friend. Watch 
17 Pages and more only on Nebula and use my link,   go.nebula.tv/practical-engineering, 
for a huge discount. Scan the QR code   or click the link below. Thank you for 
watching, and let me know what you think.

---

## 8. The Hidden Engineering of Niagara Falls
**Channel:** Practical Engineering | **Views:** 1.7M | **Date:** 3 months ago | **Duration:** 15:43 | **ID:** 7mdvEtmo1pM
**Link:** https://youtube.com/watch?v=7mdvEtmo1pM

### Transcript:
Niagara Falls is one of the most spectacular 
waterfalls in the world. With a vertical   drop of more than 50 meters or 164 feet 
and a flow rate that often exceeds 2800   cubic meters per second or 100,000 cubic feet per 
second, it’s one of North America’s crown jewels.   Roughly ten million people visit the falls every 
year just to catch a glimpse of the curtains of   water pouring over the edge and the constant 
clouds of mist at the bottom. But Niagara Falls   isn’t just a tourist attraction. The special 
geology and hydrology of this region, situated   between Lake Erie and Lake Ontario, have resulted 
in some fascinating feats of infrastructure,   from shipping to electricity to water control. 
It’s basically a microcosm of all the things   I love. The falls themselves have required 
quite a bit of engineering over the years,   and they’ve even been shut off for maintenance. 
Let’s take a little tour of the Niagara Peninsula   (even though it’s really an isthmus), 
and I’ll show you some of the things that   aren’t usually listed in a guidebook. I’m 
Grady, and this is Practical Engineering. Let’s get oriented first.  This is a map of the isthmus. 
We’ve got Lake Erie to the south,   Lake Ontario to the north, Buffalo and western 
New York to the East, and Ontario, Canada,   to the west. The Niagara River runs northward, 
connecting the two great lakes. And right in the   middle, it plunges off the Niagara Escarpment, 
creating the famous falls. On the US side,   there are the American Falls and the smaller 
Bridal Veil Falls. And on the Canadian side is   the Horseshoe Falls where a majority of the river 
flows. It’s pretty impressive to see in person,   but it’s actually not entirely a benefit. Because 
these falls pose a major problem for shipping. The Great Lakes form the largest inland freshwater 
transportation system in the world. Since the 19th   century, they’ve served as the backbone for 
moving iron ore, coal, grain, and manufactured   goods between the American heartland and the 
Atlantic Ocean. Ore from Minnesota and grain   from the Midwest can travel by ship all the way to 
steel mills or export terminals on the East Coast.   Barges and freighters are efficient at moving 
bulk cargo in a way rail and trucks can’t match.   For a time, the Niagara Escarpment was a natural 
bottleneck between Lake Erie and Lake Ontario,   preventing goods from moving directly between 
the upper lakes and the Atlantic. Freight had   to be offloaded and portaged around the falls 
before it could continue its journey. The Erie   Canal solved the problem somewhat, starting in 
1825, bypassing Lake Ontario. But it could only   accommodate smaller vessels, and even before the 
Canal opened, another solution was being planned. The Welland Canal runs through the 
peninsula west of the Niagara River,   connecting two massive areas by shipping traffic 
for the first time in 1829. The canal fueled the   early growth of cities along the Great Lakes 
and St. Lawrence River - including Cleveland,   Detroit, Milwaukee, Chicago, Toronto, Montreal, 
and Quebec City - and it’s been rebuilt and moved   several times over its life. The Welland Canal 
is really a titanic engineering achievement and,   were it not positioned next to one of the natural 
wonders of the world, it would probably be famous   in its own right. Because of the huge difference 
in elevation between the two lakes created by the   escarpment, eight separate locks are required 
to allow ships to traverse between them. And   all different kinds do - from personal leisure 
craft to the lakers that stay in fresh water   to the salties that travel between the lakes 
and the ocean through the St. Lawrence Seaway. Starting on the upstream, Lake Erie side of the 
canal, the first lock isn’t really for lifting   or lowering ships so much as for control. The 
level of Lake Erie actually fluctuates throughout   the year, and there are longer-term trends as 
well. Wind storms also raise the level locally   similar to the way storm surge works during 
hurricanes. The control lock does just that:   it controls the level in the downstream 
canal. It prevents excess water from   rushing down the canal when the lake 
is high, kind of like an airlock on a   spaceship keeps air from rushing out when 
astronauts step outside for a spacewalk. Downstream of the control lock, the canal 
splits in two. The original pathway of the   canal flows through the eponymous town of Welland, 
while the larger and newer section of canal,   the Welland Bypass… well, it bypasses 
Welland to the east. If you look carefully,   you’ll also notice a small river, the 
Welland River, which passes underneath   both the original and bypass canals. On the 
way downstream from Lake Erie to Lake Ontario,   shipping traffic passes over aqueducts that pass 
over a natural river. A hydrological wonderland! Continuing downstream from the aqueducts, 
the remaining seven locks are lift locks,   more like what you think of when you imagine 
a lock. Notice how they’re clustered tightly   around the terrain and not distributed evenly 
along the length of the canal. That’s the Niagara   escarpment, the same geological feature 
that the water cascades down at the falls.   This is the elevation diagram of the entire Great 
Lakes and St. Lawrence Seaway system from Lake   Superior to the Atlantic Ocean, and you can see 
that this drop is the biggest one of the whole   thing. And that’s pretty important for another 
part of the infrastructure on the peninsula. The power available from a moving fluid 
is directly proportional to the flow rate   multiplied by the height of the drop. In most 
hydropower applications, that height is created   artificially by a dam. There aren’t that many 
places in the world where you have both a   large volume of flowing water and a significant 
natural drop in elevation. But that combination   made Niagara Falls the birthplace of large-scale 
electric power in North America.  In 1895, the  Niagara Power Company  opened the Edward Dean Adams 
Power Plant, built with Westinghouse AC generators   based on the ideas and patents of Nikola Tesla. 
The plant served as the basis for the modern   electrical grids we have today, and many of the 
fundamental concepts are basically unchanged. But the power infrastructure at Niagara 
Falls definitely has changed. Where the   Adams Power Plant put out about 40 megawatts 
of power in 1895, now the combined capacity   from the region is in the neighborhood 
of 5 gigawatts. But in both cases,   it wasn’t as simple as putting a turbine 
at the base of the falls. While it might   be technically possible to generate power by 
placing a water wheel directly in the stream   of a waterfall like a kid’s bath toy, it’s 
not the most efficient way (plus it would   take away from the beauty). The water used to 
power the hydroelectric plants on both the US   and Canadian sides of the Niagara River is water 
that never actually flows over the falls. Instead,   it’s diverted into five massive tunnels - two 
on the US side and three on the Canadian side. Like most tunnels, you can’t really 
see the extent of the hydro tunnels   at Niagara Falls. There are a few conspicuous 
clues though, like these gigantic buildings.   These interesting protrusions from the landscape 
house enormous steel doors, nearly 60 feet tall,   that can drop down into the tunnels and close 
off the flow for inspections and maintenance.   Both the Ontario and New York sides of 
the river feature similar structures. From the tunnels, water flows into major 
hydropower plants on both sides of the border:   the twin Adam Beck stations on the Canadian 
side and Robert Moses station on the US side.   Then it’s released into the the lower part of 
the river below the falls. When you add them up,   that’s 39 turbines with a combined 
capacity of more than 4000 megawatts.   It’s a tremendous amount of power generation in 
one place. But actually, that’s not all of it. These tunnels divert 50-75% of the flow of the 
Niagara River. That wide range in percentage of   diversion isn’t because we don’t know how much 
is diverted, but because we actually control   how much water is diverted, depending on the 
tourist requirements agreed upon in a treaty   by both nations. During the day in peak tourist 
season, more water is allowed to flow over the   falls to ensure the grandeur of the falls is on 
full display for the huge crowds of tourists that   visit every year. At night and during the winter, 
more of the flow is diverted to generate power.   That’s all managed by this structure upstream 
of the falls: the international control dam. I’ve always thought this is an interesting 
dam, since it doesn’t even go all the way   across the river. But it doesn’t need to. This 
structure’s not meant to create a reservoir;   it just subtly adjusts the level in the river 
to control how much water flows over the falls   versus into the hydropower intakes. The US 
side of the Niagara River is pretty shallow,   so that side acts kind of like an uncontrolled 
spillway. Then, the gates on the Canadian side   can be adjusted to balance the competing 
demands on water between tourism and power. But there’s one big problem with those competing 
needs: they both have the same timing. We want   thunderous cascades of water over the falls 
during the day when tourists are visiting,   but daytime is also when the demand for 
electricity is highest. It’s like if solar   panels only worked at night. To accommodate 
this, both the US and Canada have pumped   storage plants. At night, excess electricity 
is used to pump diverted water into reservoirs,   essentially storing both the power and the 
extra water that’s available during off-peak   hours. Then, during the day, the water is released 
back into the forebay of the power plants. You get   a little extra power from that drop out of the 
reservoir into the forebays, so both sides have   small hydropower facilities to capture that. 
But more importantly, you get a lot more water   during the day than would otherwise be available 
to run through the big plants, making more power   when it’s needed most. And there’s just something 
funny to me that the infrastructure is duplicated   on both sides of the river, like neither country 
was willing to be one-upped by the other. All of this diversion noticeably 
reduces the flow of water over the   falls. Even when they are at ‘full blast’ 
during the day in the tourist season,   only 50% of the flow of the Niagara River makes 
it over the falls. You can imagine how powerful   the falls would be if 100% of the flow were to 
cascade over. It might seem like this diversion   detracts from the majesty of the falls, but 
in another sense, it actually preserves it. All waterfalls undergo some degree 
of erosion as the water and sediment   suspended in it scours away the rocks and 
soil underneath. Without any diversion,   Niagara Falls would be receding towards Lake 
Erie at a rate of about 3 feet every year. At   the end of the last ice age, the falls were 
right at the edge of the Niagara Escarpment,   but thousands of years of erosion have caused them 
to work their way upstream. You can actually see   how far it’s already progressed by looking at this 
elevation map. Over the last 12,000 years or so,   the falls have migrated by erosion to 
their current location. By diverting a   significant portion of the flow, the power 
plants have actually slowed the rate of   erosion to approximately one foot per year, which 
will help preserve the falls for a longer period. While flow on the falls is downregulated by 
diversion for hydropower, the falls are never   ‘turned off’...except for the one time in the 
1960s. The smaller American Falls (and nearby   Bridal Veil Falls) have a pile of loose rocks 
and boulders, called talus, at their base.   This pile of rocky debris actually extends 
a good fraction of the way up the falls, and   officials worried that the falls might ultimately 
transition into a series of rapids cascading down   the slope of talus rather than remaining a 
majestic waterfall. So, in 1969, the Army   Corps of Engineers built a temporary cofferdam 
between the New York shoreline and Goat Island,   diverting the water over the Canadian Horseshoe 
Falls and leaving the American Falls dry(ish)! After the engineers got a chance to inspect the 
situation, they determined that the best course   of action was just to leave the majority of the 
talus in place, since it seemed to be stabilizing   the cliff face. Sometimes, doing mostly 
nothing is a decision you make as an engineer,   even if you have to do a monumental amount 
of work to come to that conclusion. So the   cofferdam was taken out, and water has flowed 
continuously over all the falls since then. It really highlights the complexity 
of Niagara Falls. On the one hand,   you have one of the natural wonders of the world, 
an absolutely enormous set of waterfalls that   inspire awe and wonder in the countless travelers 
who are lucky enough to take in the view. The   same thing that makes it impressive for tourists 
(the big drop) makes it valuable for power and a   major challenge for shipping. And out of that 
comes all kinds of fascinating infrastructure,   not only to facilitate the tourism but the other 
stuff too: a major canal with locks and aqueducts,   the international dam control gates, pumped 
storage reservoirs, epic tunnels, towering gates,   massive hydropower plants, and so much more. It’s 
really a pretty remarkable place for engineering. My wife and  I actually visited the falls back in 2018, and 
even crossed the Rainbow Bridge to the Canadian   side for coffee with a view. Like I always do 
when I’m in unfamiliar territory, I turned on   a VPN at the coffee shop before connecting to 
their WiFi. This is kind of wild, but I’ve been   using today’s sponsor, NordVPN for 7 years now. 
Life’s changed a lot, but my VPN provider hasn’t. Most web traffic is already encrypted these days, 
but not all of it is. Plus, not all my internet   traffic goes through a browser - just about every 
program I use on my computer, not to mention the   apps on my phone, rely on an internet connection, 
and I don’t always know if they’re using encrypted   protocols. In addition, some internet service 
providers can collect your data and sell it   or adjust the speed of your connection based 
on what you’re doing online. You can also be   charged higher prices or blocked entirely from 
sites and services depending on your location. NordVPN helps me avoid all that. I mostly prefer 
an internet where the websites don’t know anything   about me. And a Nord subscription gives you more 
than just the VPN. They monitor the web and notify   you if your credentials show up in hacks or 
leaks. The Threat Protection Pro feature warns   you about fake webstores and phishing links. And 
they provide a dedicated IP address. All of it   works on all major operating systems for phones, 
tablets, and computers. And, they have a 30-day   money-back guarantee if you decide it’s not a 
good fit. That makes it easy to give it a try.   And what makes it easier is the deal they’re 
offering right now. Sign up for a two-year   plan at the link in the description, and you’ll 
get four additional months totally free. That’s   http://www.nordvpn.com/practicalengineering. Thank 
you for watching, and let me know what you think!

---

## 9. The Bizarre Bases of Antenna Towers
**Channel:** Practical Engineering | **Views:** 3.2M | **Date:** 4 months ago | **Duration:** 18:08 | **ID:** 3nDdLiXS5wk
**Link:** https://youtube.com/watch?v=3nDdLiXS5wk

### Transcript:
In 1974, a new world record was set for 
the tallest structure on Earth. Soaring   to 646 meters or 2,120 feet, the Warsaw Radio 
Mast was built to broadcast radio programs to   Polish-speaking audiences across Europe. If 
the atmospheric conditions were just right,   those signals could be picked up from 
nearly anywhere in the world. But   like all big infrastructure projects, 
building it was only half the battle.   Maintaining a structure that tall—and that 
slender—was incredibly expensive. Over time,   the guy wires that held the tower upright 
began to wear out. By 1991, many of them   were frayed and overdue for replacement, a job 
that wasn’t just costly, but also fairly complex. To replace a guy wire, two temporary guys needed 
to be attached to the mast first. Then the old guy   could be removed and swapped out for a new one. 
But on August 8, 1991, the sequence got mixed up.   Reports vary, but it seems that one of the main 
cables was disconnected before the temporary ones   were fully installed. A gust of wind twisted the 
tower, pulling the temporary cables away, and the   unsupported mast collapsed. Incredibly, no one was 
injured in the failure, but it was a catastrophic   loss nonetheless. Usually, the tallest structures 
in the world lose their position because something   else is built taller. In this case, a tower 
in North Dakota regained the lead by default. It’s actually not an unusual story. 
This particular type of structure,   called a guyed mast, has some seemingly bizarre 
structural characteristics that make it possible,   including the sometimes unusual bases that 
seem to defy logic. But they come with risks,   too. At least nine guyed masts taller than 
600 meters have collapsed, mostly in the US,   and hundreds of similar shorter structures around 
the world as well. They’re pretty interesting   structures: cool to look at, incredibly tall, 
just rare enough that seeing one is kind of   special. So this video is an ode to guyed 
masts, and of course, I built a little demo   in the garage to help explain how they work. 
I’m Grady, and this is Practical Engineering. Radio communication is a remarkable technology 
that enables a huge variety of wireless devices,   from garage door openers to cell phones.  If humans could perceive the full spectrum of   electromagnetic radiation, even just the 
human-made stuff, we would be completely   overwhelmed by the volume and variety of 
information moving through the airwaves.   Many of the frequencies used for communication, 
especially those broadcast by radio and television   stations, require a clear line of sight; the 
path between the transmitter and receiver   has to be relatively unobstructed, at least 
by objects that are opaque to radio waves,   like the earth. That’s why many antennas 
are mounted at the tops of hills, mountains,   or (lacking those) gigantic towers. The higher 
they are, the further their signals can extend. Antenna towers are some of the tallest 
human-made structures in the world,   with many topping out above 600 meters 
(roughly 2,000 feet). At that height,   the distance to the horizon is more than 50 
miles (or 80 kilometers). To achieve that   has required some very clever structural 
engineering. Let me show you what I mean. This is my model antenna tower. Pretty basic; 
just a steel welding rod stuck in a plate.   "Whoa!" This isn’t going to match the structural 
behavior of an actual mast, but it’s close   enough for a garage demo. The main load on 
a tower like this, besides its own weight,   is wind. So let’s apply some wind and see what 
happens.  "That's big!" The tower’s still standing - it   didn’t collapse. But structural engineering 
isn’t all about strength. A structure can “not   fall down” but still fail. We also have to address 
the concept of serviceability: does the structure   actually do what it’s meant to? And in this case, 
hopefully it’s clear that the answer is no. Many   antennas are designed to be directional. It takes 
a lot of power to radiate signals, so you don’t   want to waste it sending them where they’re not 
needed. This varies a lot depending on the end   use. Radio and TV broadcasts are less sensitive 
to movement than microwave communications, but in   general, we can’t have antenna towers wobbling 
around like floppy wet noodles in the sky. You can imagine that to adequately stiffen this 
tower, it would have to be a lot wider at the   base. And that’s just what we do with so-called 
self-supporting towers. They’re designed to be   freestanding and stable against the wind entirely 
on their own. Self-supporting towers don't take up   much space, so they are ideal in urban areas where 
land comes at a premium. But, they are expensive   to build because of all the extra material 
required for stiffness and stability against   lateral wind loads. In fact, their cost goes up 
roughly proportional to the height squared. For   guyed masts, it's roughly height to the power of 
1.5. You need more land for a guyed tower since   the guys extend so far out, so there is more 
cost there, but above a certain height (that   depends on those land costs), it becomes the most 
economical option. And for really tall towers,   it’s really the only technically feasible one. 
They are just so structurally efficient, it's   almost unbelievable. To give you an example, at 
324 meters tall (or 1,060 feet) the Eiffel Tower   weighs around 7000 tons. A guyed tower of the same 
height would weigh roughly five percent of that. So let me add some guys to my tower 
and we’ll see how it works. Of course,   you can’t add just one. Wind can come from any 
direction, and don’t forget one of the most   important adages of civil engineering: you can’t 
push a rope. So it takes at least three guys to   get some tension in every direction. Some towers 
use four lanes, but most stick with three. This   seems like a more stable situation, but now we’ve 
got a new problem. Watch what happens when I apply   a lateral load. It's still just not that stiff, 
and actually, the tower buckles. And here’s why: The guys can’t pull horizontally on the 
tower to resist lateral loads directly.   They have to be anchored to the ground, 
which means they meet the tower at an   angle. Any tension in the cable is going to 
necessarily put the tower in compression as   well. And what happens with skinny 
compression members? They buckle. Steel can take a lot of compression. 
Theoretically, this rod is strong   enough to hold my entire weight without 
a material failure. If it were short,   it’d be more than capable of bearing a full 
Grady, but when it’s tall and skinny like this,   it can barely hold its own weight. When the tower 
takes a lateral load, the guy wires transfer that   into compressive force. And unless the structure 
is stiff enough, it buckles.  If I move the guys out so 
they’re at a shallower angle,   you can see it takes a lot more 
wind load to buckle the   structure. Less cable tension is needed for an 
equivalent horizontal force. And this is one of   the many structural tradeoffs with guyed towers. 
You have to balance the land cost of extending   anchors outward against the cost of a stiffer 
tower that can withstand steeply angled guys. But you can see we’re not quite out of the 
woods here. Some shorter guyed towers can   get away with one level of supports, but 
mine is still pretty flimsy in the middle.   Lateral forces can still deflect it quite a bit,   and it’s still prone to buckling under 
compressive loads, like, for example,   the weight of an antenna mounted to the top.  And 
now this is kind of like a bridge on its side. We’ve got supports on both ends and loads trying 
to bend the structure in the center. So we can   do what the bridge engineers do: either stiffen 
the structure or add more intermediate supports.   It’s a little more complicated than that though, 
since every guy adds additional compressive load   on the tower, in addition to providing lateral 
support to reduce the unbraced height. You’re   kind of adding to both sides of the equation. 
Luckily, the lower you go on the tower, the   shallower the angle of the cable. Just as a little 
demonstration of this, let’s compare the loads   my little tower can support as we add more guys.  With just one level, it’s right around 50 grams.   This can barely support its own weight, let alone 
any extra on top. With a second level halfway up,   it’s quite a bit stiffer. I could get 100 grams 
on top with no failure. Adding two more levels,   now this thing feels rock solid. I’m 
not sure if it comes across on camera,   but the change in stiffness is dramatic. 
It passes the wind test with flying colors.   It couldn’t quite hold a kilogram, 
but Brady could sit on it just fine,   even if it made him a bit uneasy (since his 
hard hat is still damaged from the last demo). One of the other tradeoffs with this is 
the pre-tension of the cables. These guys   sag along their length; they’re not perfectly 
straight. Under high wind, they tighten up and add   stiffness. But in calm conditions, that slack can 
cause the tower to wobble. The obvious solution   is to pre-tension the guys to take the sag out, 
but again, that pretension puts extra compression   on the tower, requiring stronger members or 
more guys. So this is a balancing act as well. And then there’s the base. You have essentially 
two choices here. We’re used to seeing large   columns with a rigid attachment to the foundation. 
I did a whole video on base plates diving into   this topic deeper if you want to learn more. You 
can see in my model that, with a fixed connection,   my tower holds itself up just fine without 
loading. Obviously, this rod is solid steel - not   a thin latticework of individual members - 
so the behavior is a little different. But   remember that buckling is a function of the end 
connections of the column. With the bottom fixed,   it takes about 140 grams to buckle the rod. 
When it’s free to rotate at the bottom,   it buckles at around half that. The 
problem in this case is that fixing   such a tall tower rigidly to the foundation 
makes the design a lot more complicated. If you want rigid restraint, you have to have 
a way to transfer the loads into the ground. So   the foundation has to be designed to resist 
rotation and pullout forces, and for not a   lot of structural benefit. So the other option 
is to use a spherical bearing or pin support.   And if you keep your eye out, you’ll see that a 
lot of these masts have these sorts of unusual   bases where they taper down to a narrow 
point. In this way, you can just rely on   the guys to handle almost all the restraint. The 
foundation only has to resist the vertical force,   and maybe a touch of shear. This allows some 
movement or settlement of the foundation   without inducing stress into the structure. 
And it just makes the design process easier.   Removing the restraint simplifies the structural 
response and makes the tower more predictable,   so you don’t have to be super conservative 
or spend tons of engineering effort and   use sophisticated modeling software in the 
design. Finally, some towers aren’t used to   mount antennas; they are the antennas themselves. 
For lower frequency transmissions like AM radio,   you need a big antenna, so the tower 
itself is energized. In those cases,   the base needs to be electrically insulated from 
the ground, which is much easier to do at a single   point. If you look closely at some towers, you’ll 
see they’re actually standing on a ceramic disc. Beyond structural design, these masts come with 
a lot of other engineering challenges. Of course,   there’s the hazard to aircraft.   Aviation regulations often require them to be  painted in alternating orange and white 
bands and equipped with warning lights,   whose color and flash rate 
are carefully prescribed,   and can even be synchronized with nearby 
towers to avoid dazzling pilots at night. Ice is another big one. These towers stretch 
into colder, wetter layers of air where ice   can build up on the mast and guys. That 
adds weight, but it also adds surface area,   sometimes dramatically increasing wind loads. When 
it melts, it can fall and damage anything below,   so often you’ll see protective structures 
over the radio transmission lines. Lightning is another threat. For most towers, 
it’s not a question of IF, but rather HOW OFTEN   they’ll be struck. Towers are often equipped 
with lightning rods or other protection devices   and robust grounding systems to keep stray 
voltage out of the transmission lines and   sensitive equipment on the ground. Obviously, 
those mast radiators I mentioned earlier,   where the entire tower services as the antenna, 
can’t be grounded for lightning protection.   So most use some type of spark gap to keep 
the tower insulated. If lightning strikes,   the air in the gap ionizes, allowing 
the surge to safely reach the ground. Like all infrastructure, antenna towers need 
maintenance - painting, changing light bulbs,   and servicing antenna equipment. Technicians with 
specialized training for heights and electrical   hazards have to do the work. Some tall towers are 
even equipped with elevators to provide access,   but most require some manual climbing. 
Although the frequencies used for radio   communication are non-ionizing (meaning 
the waves can’t break apart molecules),   that doesn’t mean they aren’t dangerous. 
Electromagnetic radiation can generate heat;   it’s the fundamental principle of a microwave 
oven. And if the tower itself is energized,   a person can become part of the circuit. With so much of our telecommunication happening 
through the internet these days, it’s easy to   forget the importance of large-scale radio 
broadcasting and communications. The cells for   cellular communications are small, so we’re used 
to seeing those antennas relatively close to the   ground. But you have to look way up to remember 
how critical the other wireless systems are,   especially in emergency situations where radio 
and television signals can be an essential link   to information. So next time you pass one 
of these towers by, take a closer look,   and I hope you’ll appreciate some of the 
thoughtful engineering that goes into them. Funny behind-the-scenes story about antenna towers:  I plan these 
videos out in advance, and I actually bought   a telephoto lens for my camera about a year ago so 
I could get some of the shots in this video. So,   I went outside to test it out, and the first 
thing I took a picture of was a bird. Of course,   then I wanted to learn what kind of bird 
it was. And that basically snowballed   into a full-on new hobby of birding. I’ve got 
feeders in the backyard, fancy new binoculars,   and the Merlin app on my phone. I try to get 
out at least once a week, and so far I’ve seen   about 160 species. But once you start paying 
attention and learning more about birds, it   can be a little disheartening. For example, I see 
Loggerhead Shrikes pretty regularly here in Texas,   but if you live in the northeastern US, they’ve 
pretty much disappeared. The species has lost   about three-quarters of its population in North 
America since 1966, and that’s just one example. Another is Little Owls - cute little guys who 
have seen major population declines in some   parts of Europe. My friends at Planet Wild have 
been working with conservationists in Germany to   help re-establish the population there. Planet 
Wild is a community-based organization dedicated   to protecting our natural world, including 
wildlife. It’s basically crowdfunding for nature.   Every month, all the members fund a new 
project related to endangered species,   oceans, or forests. And then they produce 
a video documenting the project so you   can see for yourself where your money 
is going and the impact it’s having. I love the idea, which is why I’m a member. 
It makes me feel more connected to the causes   I care about and part of a community who are 
working together to accomplish something bigger   than any individual could do on their own. If 
you’ve been looking for a neat way to give back,   I think Planet Wild is a great way to do it. And 
to prove it, for the first 100 people who sign up,   I’ll cover your first month. Just scan the QR 
code or click the link in the description and   use my code PRACTICAL10 to get your first 
month free. No catches - you can cancel   anytime. If you’re not sure yet, go check 
out their project protecting the Little   Owl in Germany. You can give whatever amount 
- big or small - that feels right to you. Your   money will go towards really cool conservation 
projects that you can watch happen here on   YouTube. I hope you’ll consider joining. Thank 
you for watching, and let me know what you think.

---

## 10. An Engineer's Perspective on the Texas Floods
**Channel:** Practical Engineering | **Views:** 677K | **Date:** 4 months ago | **Duration:** 23:14 | **ID:** 3FfMzWa6LKg
**Link:** https://youtube.com/watch?v=3FfMzWa6LKg

### Transcript:
This is an animation of the weather radar 
in central Texas starting at noon on July 3,   2025. You can see there was torrential rain across 
the state throughout the afternoon from remnants   of Tropical Storm Barry. But focus on this area 
northwest of San Antonio. Around midnight on July   4, a severe storm gets stuck in this area 
and just stays in place for several hours.   When you put it in context with the rest of 
the system, it looks kind of insignificant,   but that little storm dropped enough rain to raise 
the Guadalupe River higher than ever in recorded   history, at least in the upper part of the basin. 
The water quickly rushed through summer camps,   RV parks, and rural communities in 
the middle of the night. And the   result was one of the deadliest inland 
flooding events in the past 50 years. I live not too far from some of the worst-hit 
areas, and although my family wasn’t directly   affected by the weather, it’s been a 
tough situation for me to wrestle with,   personally. I spent the better part of 
my career as an engineer thinking about   flooding and designing projects to cope 
with it. I’ve worked on and played in   the Guadalupe River. And I have kids who are 
getting close to summer camp age. As a dad,   it’s almost impossible to comprehend a tragedy 
like this. As an engineer, I’ve dedicated a large   part of my professional career to understanding 
events exactly like it. So, as I’ve ruminated   about this flood over the past few months, 
I’ve collected some thoughts that might be   worth putting into the world. Let’s take a look 
at this event through an engineering lens, talk   a little bit about how technical and regulatory 
decisions play out in the aftermath of tragedy,   and see if any lessons become apparent. I’m 
Grady, and this is Practical Engineering. One of the fundamental problems we face in 
engineering, and really life in general,   is that we can’t predict the future. That 
sounds like a ridiculous thing to say,   but out of that uncertainty comes the framework 
for how we think about so many things. Because,   we have to make all kinds of decisions - many 
of them with extremely high stakes - in the   face of the unknown. In civil engineering, 
a lot of the loads we account for come from   the most classically volatile and 
unpredictable aspect of the earth:   the weather. Wind, ice, snow, waves, 
and rain - you cannot look ahead 50   or 100 years and know what forces a structure 
will be subjected to. You just have to guess. And that’s a pretty hard thing to do, 
especially because you tend to have two   opposing forces pushing your guess around. On 
the one hand, caution dictates overestimating   forces to leave a wide margin of safety, but on 
the other hand, costs and budget constraints tend   to push the estimate the other way. I can 
make this dam taller or this bridge higher,   but it’s going to cost me a lot more money, and 
maybe it’s not necessary. So how do you draw the   line? The same way we try to predict the future in 
so many other parts of life: we look to the past. Surely past performance is an indicator of future 
results, right? I know that’s a stock line,   but what else do we have? Over the years, we have 
gone to considerable lengths to apply historical   data to predictions of future floods. Of course, 
this gets pretty complicated. One of the resources   widely used in the United States for decades 
is Technical Paper 40, published in 1961. It   represents a monumental effort to compile rainfall 
data across the contiguous United States, find   probability distributions that fit the data, and 
map the results. It’s divided up by duration and   recurrence interval, so you get this big group of 
separate maps. But what is a recurrence interval? I’ve talked about the so-called 100-year 
flood in a few of my videos, but it’s a   concept so widely misunderstood 
that it’s worth explaining again,   especially because it’s so relevant to the 
Guadalupe River flood in July. We can’t   really use historical data to determine 
when a flood might happen in the future,   but we can make an estimation about how probable 
one might be. The bigger the flood, the lower the   probability that it might occur. So there’s a 
relationship between probability and magnitude.   In hydrology, we often express the probability 
as a quote-unquote “return period,” which means,   on average, how many years you would expect 
to pass before you see that magnitude equalled   or exceeded again. But that “on average” is 
doing some heavy lifting in the definition. This terminology is debated endlessly in the 
hydrologic community because saying something like   the 100-year flood has an underlying implication 
that storms are cyclical; that somehow if a   particular magnitude of storm was to occur, 
we might have a period of security before it   happened again, or the flipside: that if a flood 
hadn’t occurred in some time, we might be more   “due” for it. And that’s just not how it works.  Floods are statistically independent events.  Every year, the atmosphere rolls the metaphorical 
dice to see what the biggest one is going to be.   The odds of rolling a two or snake eyes in craps 
are 1 in 36, but if you go 35 rolls without a   snake eyes, the odds of rolling it on the next 
one haven’t changed. The dice don’t remember   what happened before. No one calls snake eyes the 
36-roll throw because we understand it’s possible   to do it twice in a row, and it’s possible to go 
a lot more than 36 rolls without getting one. So   why do we call it the 100-year flood? Probably 
because the only good alternative is the storm   with a 1% annual exceedance probability. Just 
doesn’t roll off the tongue. But it is the   technically correct definition: the 100-year 
rainfall is the depth of precipitation (over a   given duration) that has a one percent probability 
of being equalled or exceeded in a given year.   It’s a tough concept to wrap your head around, 
but it’s fundamental to engineering hydrology. If you take a look at these maps, you can 
see that the 100-year rainfall over a 24-hour   duration in Kerr County, Texas is around 9.5 
inches (or about 240 millimeters). But again,   this is from 1961. And it’s based entirely 
on historical data. So there are decades of   rainfall not included in this analysis, not 
to mention limitations in the statistical   methodology and data processing methods of 
the time. TP 40 wasn’t the only resource for   precipitation frequency data in the US, 
but it was probably the most widely used   until Atlas 14 came along, or is coming 
along (it’s still a work in progress).   NOAA has been working to update this information 
with the entire historical record and more   rigorous statistical methods. For most of the 
US, this is easy to navigate online. Just mark   a spot on the map and you get this table of 
values and confidence intervals for a range   of durations and return periods. And you can 
see that the 100-year, 24-hour precipitation   in Kerr County is 11.5 inches (or nearly 300 
millimeters). That’s a pretty big jump from   the 1961 estimate - an increase of about 
20 percent. What was the 100-year rainfall   in 1961 is now just the 50-year storm AND look 
at those confidence intervals! 8 to 16 inches. I know this is kind of long-winded, but the 
whole point I’m trying to make here is the   tremendous uncertainty we have when it comes 
to hydrology. In some ways, this rainfall data   is extremely rigorous, and I couldn’t even 
begin to explain some of the statistical   methods used to develop it. It serves a really 
important purpose in the world of engineering,   planning, and emergency management. But in 
another sense, it’s almost meaningless. And I   can show you a few of the reasons through 
the lens of the Guadalupe River Flood. Here’s an hourly map of the rainfall 
that hit central Texas on July 4, 2025.   That yellow area is the watershed for the upper 
Guadalupe River. When I loop through it again,   you can see that cell right there caused the 
majority of the flooding you probably read about   on the news. It was there and gone in four hours. 
More rain came in later that morning and the next   few days, but this was a classic flash flood: 
A relatively short burst of heavy rainfall on   a small, steep, rocky basin, where most of it 
runs off into a river within minutes or hours.   Here’s the thing: hourly rainfall records 
weren’t very common until the 1940s. I   counted about 100 rain gauges used by Atlas 
14 within a 50 mile radius of Hunt, Texas,   where most of the fatalities occurred. 
None had hourly records before 1940,   and of the group that did collect hourly data, 
only four had a record longer than 70 years. That   might seem like enough data to understand flooding 
in the area, but let me show you why it’s not. Here’s that loop of rainfall again. What do you 
see on this map? Because I’ll tell you what I see:   enormous spatial variability. If you were 
to pick four random pixels on this map,   how good a picture do you think it would give you 
of what really happened? That’s essentially what   we’re doing with rainfall frequency analysis. 
Compared to modern data collection methods,   like the radar rainfall I showed, our 
historical records are extremely sparse,   especially for data that varies so significantly 
across space. Imagine trying to recreate the Mona   Lisa from scratch with just a dozen random pixels.  Most of the rain gauges we use to   estimate flood probabilities have never 
even seen an event of the magnitude we’re   trying to use them to predict. There’s 
a whole lot of extrapolation going on. To hammer this point home: This is the 
24-hour rainfall totals for the flood,   and you can see that even within this single 
watershed, some areas saw extreme precipitation,   while others just got an inch or 25 
millimeters of rain. And actually,   I mapped the percentage of the 100-year rainfall 
that this storm amounted to, and you can see,   at least in the Upper Guadalupe Basin, only a 
small area got close to the 100-year rainfall.   For most of the watershed, this was 
more like a 2- or a 5-year storm. And here’s what makes this even tougher: 
When we’re talking about flooding, we don’t   actually care too much about rainfall. 
We care about the outcome of rainfall,   specifically the rise in a river or stream. 
Here’s the graph of a stream gage upstream   of Hunt during the flood. You can see that, 
starting around 2:00 on the morning of the 4th,   the river rose by 20 feet or 6 meters in 
three-and-a-half hours. A little further   downstream, similar story. Starting at 2 
AM, the river went up 35 feet or nearly 11   meters in 3 hours before the gage broke. That is a 
staggeringly fast increase. In a hydrologic sense,   it’s practically a wall of water. And the 
results were devastating. In Kerr County,   there just wasn’t enough time to coordinate an 
evacuation. More than 100 people were killed,   many of them children. So a rain gauge here, or 
here, or here would have completely missed the   fact that the watershed it was within 
was experiencing the flood of record. That’s the value of measuring the thing you 
actually care about. Just like precipitation,   you can take historical stream gage data, 
fit it to a probability distribution,   and get a sense of the likelihood of major 
floods in the future. But these gages are even   more sparse in coverage than rain gauges, 
their records often don’t go back as far,   they’re a lot more expensive to install 
and maintain, and, as we saw in one graph,   they can go offline, ironically as a result 
of flooding, completely missing the peak.   Engineers or hydrologists actually often visit the 
affected area and map the high water line after a   flood to validate and confirm the data from stream 
gages (or to fill in the gaps if one breaks). So,   although they serve an extremely important 
role, most of the time when engineers are   trying to predict flooding or its effect 
on infrastructure and the built world,   instead of using stream gages, they’re using 
hydrologic models to convert rainfall into   runoff and flooding, a process that introduces 
a whole new set of uncertainties into the mix. And there’s one more thing. Everything we’ve been 
talking about so far is predicated on a crucial   underlying assumption: temporal stationarity, 
basically, the idea that the distribution of   extreme events doesn’t change over time - or put 
another way - that future precipitation can be   represented by past observations. But, even though 
those past observations are relatively sparse,   in a lot of cases, we can already see that it’s 
probably not a great assumption. I understand this   is a point of pretty strong contention in the 
public discourse. But within the professional   community of hydrologists, engineers, and climate 
scientists, it’s not really a question of “is the   climate changing” but more a question of how much, 
how quickly, and where the effects of that are   most pronounced. For example, in the Texas Volume 
of Atlas 14, the team tested for long-term trends   in the data. They found some scattered weather 
stations that did show an increase in extreme   rainfall over time; most of them didn’t. Other 
studies have found more pronounced increases by   looking at only the past few decades. So there are 
no broad statements that capture the complexity   of the situation as we understand it, and 
importantly, this is a tough thing to figure out. Say you have 100 years of historical data. How 
many 100-year floods happened within that time?   Could be a few. Could be none. So, especially for 
very extreme events on the 1-in-a-century scale,   there’s a lot of uncertainty when it comes to 
teasing out any trends. That said, there is a   strong consensus among the various climate models 
and recorded data that a warming atmosphere has   already resulted in an overall increase in 
the intensity and frequency of rainfall,   a trend that will likely continue. And you can 
see why that poses a problem. Particularly for   infrastructure with a design life of 50 to 100 
years, we need to design not just for the storms   of today but those decades in the future, 
and our current methods of doing that is,   on average, systematically underestimating 
them if we assume a stationary climate. Just to be clear, I’m not trying to blame a 
flood on climate change. Although attribution   studies can estimate the contribution 
of extra energy in the climate system,   there’s no way to ascribe any particular weather 
event to global warming deterministically. For   many places, it might not even be a major source 
of uncertainty compared to all the other factors   I’ve mentioned when it comes to predicting 
the magnitude of future floods. My point   is that it’s just one more confounding 
aspect of estimating flood risks. And   it gets to the heart of the entire issue. 
Because why does any of this even matter? There‘s been a lot of discourse about what 
should have happened before the storm and   what should be done in its wake. But before you 
can take any action to mitigate flood impacts,   you have to know what the actual risks are. On 
the upper Guadalupe, we’ve seen it with our eyes,   but how many similar watersheds just got lucky 
that night, or really, any night? I think you’ll   agree with me that this is complicated stuff. And 
humans are notoriously bad at using probabilities   and risks to make decisions. Almost nothing in 
our biology is optimized for long-term, rational   decision-making about rare and extreme events. 
Almost every day of everyone’s lives, there’s not   a flood. That makes it really tough to consider 
it as a priority and devote resources toward   preparations. And I think part of the problem 
is that we rarely talk about the uncertainties. Even within the field of engineering, where we 
should know better, we have a strong tendency   to treat everything deterministically. It 
sure makes things a lot simpler. Take the   bold number in the table, plug it into 
your equations and computer models,   and just forget that those uncertainty bands even 
exist. In some ways, it makes sense. Ultimately,   you do have to choose a number: how high to 
build a bridge or how large a culvert to install,   or how wide to make a spillway. But, in a lot of 
cases, those decisions get translated into a sort   of confidence that doesn’t actually exist. The 
concept of the floodplain is a perfect example. In the US, a lot of the framework for how we 
think about and prepare for floods comes out   of the National Flood Insurance Program. 
And to participate in this program,   communities are required to regulate what 
happens in the floodplain, or more specifically,   what and how things get built there. And so, a 
fundamental part of regulating the floodplain   is deciding where it actually is and isn’t. We’re 
not going to dive into that process, but billions   of dollars have been invested in making these 
maps and keeping them up to date in the US. If you take a look at one, it’s a lot to parse 
depending on the location. There are quite a few   different hazard areas with different meanings. 
The simplest for riverine locations is the base   flood, essentially the 100-year flood. Some 
maps show the 500-year flood as well. Many   maps show the floodway, which is kind of the 
main part of the channel needed to pass floods,   so it’s usually regulated more strictly. 
But there’s something I notice when I look   at floodplain maps. All of these zones are 
bordered with nice crisp lines. You’re inside   the floodplain here, and you’re outside of 
it here. And property owners often go to   great lengths to refine these maps; to shift the 
line just slightly and reduce their regulatory   responsibilities. But consider everything 
we’ve talked about with estimating flood   risk and ask yourself, what’s the difference 
in the risk profile between here and here?   Is it enough to have a sharp line between 
them? And if not - if the true situation is   more nebulous - is the map doing a good job 
of communicating flood risk to the public? Because, just to be clear, that is one of the 
stated purposes of floodplain maps. Of course   you need to delineate zones clearly to be able 
to regulate where permits are required and where   buildings can be built and so on. But, to me at 
least, it sends a complicated message to have   this binary definition of inside the floodplain or 
outside of it as a way to explain to individuals,   homeowners, renters, and the general public 
about the risks that they’re actually exposed to. You look at these maps and there is 
absolutely no indication about uncertainty,   despite the fact that almost every step of 
the process that goes into creating them has   huge margins of error. And then, when we get 
more historical data, or land uses change,   or our understanding of the floodplain evolves, 
and we try to change the map, that immediately   sows distrust. You hear it all the time (at 
least if you run in similar circles as I do):   “We’ve had two hundred-year floods in the past 
5 years. These engineers don’t know what they’re   talking about…” Part of that, of course, is just 
a misunderstanding about what the hundred-year   flood actually means, but part of it is that 
we don’t do a good job communicating risk and   uncertainty well. The meteorologists get the same 
thing. People get salty when forecasts are wrong   without any acknowledgement at all that the job 
is essentially predicting the future. You know,   it’s wizard stuff. Weather is really 
complicated, and I think we have a   lot of room to grow in how we discuss and 
disseminate the things we don’t know for sure. Because flooding is capricious. If you look 
back at the maps from July 4, you can see a   lot of places where rainfall was more intense than 
in Kerr County and the Guadalupe River. Many areas   of central Texas received more than the 100-year, 
24-hour precipitation from Atlas 14. And there   were severe storms and flooding across the region 
in the days that followed as well. But nearly all   the fatalities happened in this one place. I 
don’t have a good answer for why. Maybe some   combination of timing, warning systems, the rural 
location, differences in floodplain regulations,   and plain bad luck. I think scientists, engineers, 
and emergency planners can probably learn a lot   by simply comparing the flooding between 
Kerr County and some of the other areas   in central Texas hit by this storm system, and 
why the outcomes were so drastically different. My heart goes out to the victims and their 
families who were affected by this flood.   I’ve been thinking so much about it in 
the weeks since, and why these kinds   of risks can go so underappreciated that 
we wouldn’t bat an eye at having such a   large population of people sleeping in 
the floodplain of a flashy watershed. I think there are a lot of lessons to learn here, 
but the one that keeps coming back to me is about   communication. People can’t act to reduce 
their risk unless they can internalize what   it actually is. Professionals think about these 
issues every day; they have technical training,   knowledge, and experience to make informed 
decisions about infrastructure, land use,   and zoning. But most people don’t have the 
same cognizance of the hazards. You can’t   blame them. It’s a crazy world we live 
in, and even individuals who live, work,   and play in areas at risk of flooding might not 
come face-to-face with the danger in their entire   lives. Like I said, weather is complicated, 
and we don’t all have the headspace to try and   understand spatial variability, annual exceedance 
probabilities, climate stationarity, and so on. So I think the professional community 
has a responsibility to improve how we   communicate flood risks to the public, 
not only for accessibility but honesty.   We need to have language that anyone can 
grasp, but we also need to be better about   acknowledging uncertainty. It sounds 
counterintuitive, but I think facing   the limitations of our understanding head-on 
actually instills more trust than pretending   like we have all the answers. And when people 
understand those uncertainties, they get a   deeper appreciation for how flood hazards vary 
across the landscape, giving them more insight,   not less, to prepare for what’s ahead. Thanks 
for watching, and let me know what you think.

---

## 11. The Weirdest Tool in Underwater Construction
**Channel:** Practical Engineering | **Views:** 953K | **Date:** 5 months ago | **Duration:** 17:45 | **ID:** 2nX7Y8ZwShg
**Link:** https://youtube.com/watch?v=2nX7Y8ZwShg

### Transcript:
In 1989, the Loma Prieta earthquake 
shook the central coast of California,   collapsing buildings and damaging infrastructure 
across the Bay Area. Bridges, in particular,   suffered extensive damage. In one case, a 
major section of the eastern span of the   Bay Bridge's deck collapsed, falling onto the 
lower deck like a trapdoor. Sadly, one person   died driving off the upper deck. Crews had the 
bridge repaired within a month, but Caltrans   knew that the next earthquake could be worse and 
started making plans to replace the structure. Knowing that the replacement project would require 
heavy-duty piles, Caltrans developed a testing   program to identify risks and challenges during 
design and minimize the chance of unanticipated   problems cropping up during construction. And 
they found a pretty big one. In October of 2000,   the barge began the pile driving operation, 
dropping a large hammer to drive the 8-foot   (or 2.4 meter) diameter steel pipe deep 
into the seafloor. Almost immediately,   fish began dying in the surrounding area. 
Biologists involved in the project collected   fish and documented injuries to their organs and 
swim bladders. They weren’t being directly hurt by   the hammer itself; it was above the water anyway. 
The damage was coming from the intense sound. That massive steel pipe rang like a humongous 
bell on every hammer blow, radiating sound   pressure through the San Francisco Bay. It even 
had serious impacts on aquatic wildlife up to   a kilometer away, which was a pretty big deal. 
Because San Francisco Bay is home to quite a few   threatened or endangered species of fish. The 
problem was that the replacement bridge would   need more than 250 of these piles. Caltrans 
had to figure out how to install them without   affecting the wildlife in the process, and the way 
they did it, I think, is pretty cool. And I even   built a model in the garage to show you it works. 
I’m Grady, and this is Practical Engineering. If you want to know the answer right away, it's 
bubbles. But I think the most interesting part   is why it works in the first place. And this 
matters. Pile driving isn’t the only thing   that creates excessive noise underwater. We 
do a lot of construction in waterways, oceans,   rivers, and bays. We also occasionally 
have to blow stuff up underwater,   like for demolition of structures or safe 
disposal of old munitions and mines. Any   loud work underwater has the potential 
to disrupt, injure, or even kill aquatic   wildlife. The phenomenon we know as sound is 
just fluctuations in pressure within a medium,   whether it’s air or water (or even concrete). We 
sense those fluctuations mainly through our ears,   but pressure fluctuations can do a lot more than 
just vibrate the thin membranes, tiny bones, and   hairs. Barotrauma is the term used to describe the 
damaging effects of compression and decompression   on wildlife. And it really has only been in 
the past few decades that we’ve really started   to apply the science of hydroacoustics to our 
own activities and try to mitigate the impacts. You’ve probably heard of sound pressure expressed 
in decibels. It’s really just a logarithmic scale   of convenience thing because meaningful pressures 
can range across many orders of magnitude. So the   decibel system just makes the numbers easier 
to compare. The equation for a decibel is just   20 times the base 10 logarithmic function of the 
sound pressure divided by a reference pressure.   Sounds complicated, but it just means 
a 1-decibel increase corresponds to an   increase in sound pressure of about 26 percent. 
The amount of time over which sound pressure is   measured also matters. Look at a waveform 
and you can see there are peaks (both in   compression and rarefaction). But that’s only 
for a split second. So a lot of measurements   use a root mean square of the sound pressure 
over a given time to provide a better estimate.   We don’t have to go into the math of that, 
just think of it as a fancy kind of average. It’s important to point out that, in air, we 
use 20 micropascals as the reference pressure,   which is approximately the limit of human 
hearing. So that’s 0 decibels. Underwater,   we use a reference pressure of 1 micropascal, 
mainly just for standardization purposes,   so just keep in mind that underwater decibels 
aren’t really equivalent to sound pressures you   might have as references in your head like the 
75-decibel vacuum cleaner or the 140-decibel jet engine.  And really, what you think of as sound 
has less meaning underwater because our ears and   brains are calibrated for the physics of sound 
in air. The underwater version of “loudness”   doesn’t translate well to human perception. But 
it matters a lot to fish and marine mammals. Sound behaves a lot differently in water 
than air. Of course, water is denser,   and sound moves through it at roughly 4 times 
the speed it does in air. Sound also carries   a lot further in water, and importantly, the 
acoustic impedance of water is way different   than air. Impedance is basically a 
measure of opposition to sound flow,   kind of like resistance in an electrical circuit. 
It’s a function of the medium’s density and the   speed of sound through it. And at a boundary 
between two media, there are two things that   can happen to sound. It can transmit into the new 
medium or it can reflect back, and the difference   in impedance between the two determines how 
much of each will occur. If impedances match,   more sound will transmit through the boundary. 
If they’re way off, like water and air,   most of the sound is reflected. The practical 
effect of that is a transmission loss between   air and water of about 30 decibels. It’s why stuff 
happening underwater is quiet above the surface,   and we can take advantage of impedance 
mismatch in underwater construction. I built a new acrylic tank for this demo, and 
I’ve got a new helper in the shop.  This is Brady.   I figured since half the internet calls me that 
anyway, we might as well get a Brady in here. He   can wave and nod, and he can probably do a lot of 
other stuff too, but that took me several hours,   so he’s just going to bravely hold the hydrophone 
for now. And on the other end of the tank,   I have this bluetooth speaker. It claims it’s 
underwater rated, so we’ll see if it works out. And here’s the setup; pretty simple. I found a few 
recordings of hammering and pile driving sounds to   play on the speaker. And this is how they come 
across on the hydrophone, which is connected   to a sound recorder.  I also did a frequency sweep 
so we can do a little more scientific comparison.   Now let’s add some air. At this point, one of my glue joints on this tank 
catastrophically failed and flooded my garage with   water. I didn’t catch it on camera, but Brady took 
the brunt of the fall.  Thankfully, he was wearing his hard hat.   I got it all fixed up, and now let’s 
see if we can soften these construction sounds. I have four air stones made for aquariums 
hooked up to an air pump. When I flip these on,   we get a nice curtain of small bubbles between the 
speaker and the hydrophone. And I’ll record those   same sounds again.  Here’s a look at the waveforms 
from the hydrophone with and without the air.   Although it’s not a dramatic difference, 
you can definitely see a difference,   especially for the higher pitched hammering 
sounds toward the end. And here’s a look at   the waveforms without and with the air for 
the frequency sweeps. Even though the sweep   should have had a constant sound pressure 
across the full range of frequencies,   the water and demo itself cause pretty serious 
distortions. You can see a lot of resonance at   low frequencies, and a lot of attenuation 
at high frequencies. That makes it a little   hard to gauge the effectiveness of the bubbles. 
It’s similar to the hammering sounds - not much   difference at the lower frequencies, but a pretty 
substantial reduction at higher frequencies. This is not an ideal setup for one reason: 
even though there’s a big mismatch in acoustic   impedance between air and water, there’s not that 
much difference between acrylic and water. So,   it’s pretty easy for pressure waves to propagate 
into the acrylic, travel past my bubble curtain,   and back into the water on the other side. So 
I’m not getting the kind of sound reduction,   what the pros call attenuation, that 
you might expect in the real world,   for example, by surrounding a pile with 
a circular ring of air pipes. Thankfully,   the researchers studying solutions like this have 
put a lot more resources into figuring out the   right way to do it. The measurements at the Bay 
Bridge compared fairly well with mine. Attenuation   was highest as the higher frequencies. But this is 
not as simple as just blasting air out of a pipe. These bubble curtain systems require a lot of 
logistics. Massive compressors or blowers feed   air sometimes deep below the surface into complex 
plumbing assemblies. They usually have filters to   remove oil from the air to make sure the water 
isn’t being contaminated. The system has to sit   flush with the bottom to make sure sound can’t 
travel underneath the bubble curtain. But also,   there are currents. Any movement of the 
water is going to move the bubbles too,   potentially creating gaps in the curtain 
or dispersing it altogether. So it’s often   necessary to have multiple levels of plumbing 
to keep a continuous screen all the way to the   surface. If that’s not enough, there are ways to 
confine the bubbles around a pile or construction   activity using an outer casing or even a flexible 
membrane. But how do you know it actually works? Maybe the most comprehensive engineering guidance 
on this topic is put out by Caltrans in their   manual on the Hydroacoustic Effects of Pile 
Driving on Fish. Appendix 1 in the report is   a nearly 300-page compendium on pile driving 
sound data. You might not have known this,   but we’ve been measuring a lot of pile-driving 
sounds! If you’re an engineer or environmental   scientist trying to get a permit to build 
something underwater and sound is going   to be an issue, this is kind of your bible. 
It’s got quite a few ways to minimize impacts,   including timing work when important species 
aren’t present, changing designs to reduce   underwater work, using vibratory hammers instead 
of conventional equipment, and bubble curtains   that reduce the propagation of underwater 
sound pressure. Based on all the testing and   real-world case studies so far, they suggest you 
can get about 5 decibels of attenuation this way. Just like my demo, sounds don’t only travel 
through the water. They also move through the   sea floor and even through the barge on the 
surface, bypassing the bubbles. 5 decibels   doesn’t sound like a big reduction, but you 
have to remember that it’s a logarithmic scale.   A 5 decibel reduction means the actual sound 
pressure is nearly cut in half. You also have   to remember that what we care about most is area. 
For any loud construction or demolition activity,   there’s an invisible ring some distance away that 
marks the injury threshold level. Since sound   pressure decreases with distance, eventually 
you’re far enough away from the sound that   it doesn’t result in injury. So every foot or 
meter that you can pull that ring back toward   the activity through attenuation reduces the 
impact area proportional to the distance squared,   dramatically reducing the area in which fish may 
sustain injuries. That’s why bubble curtains are   used in so many underwater construction projects 
these days, but that’s not all they’re used for. What’s that old saying? If your only tool 
is a bubble curtain generation system,   every problem starts to look like a loud 
underwater sound. Something like that. It turns   out that bubbles can do a lot more than create an 
impedance mismatch for sound pressure propagation.   For one, they aerate water, which can be useful 
to prevent algae and other issues with stagnant   pools. For two, they create vertical water 
currents. That can help keep things separated,   like trash. You can see it’s a lot harder for 
me to move this little boat across the barrier   created by the bubbles.  Of course, a 
net or boom or rack can do this too,   but those don’t allow boats to pass through. And 
this doesn’t just work for trash. Bubble curtains   have been used to contain oil spills, and they’re 
often used in underwater construction not just to   control sound but turbidity. We really don’t want 
disturbed sediments clouding up our waterways,   again, primarily for environmental reasons, so 
these can be an important tool when booms aren’t   practical. They’ve also been used to control 
saltwater and keep it from migrating up rivers   in tidal areas. And they’ve even been employed 
to confine herbicides for invasive plants,   allowing for fewer chemicals and less 
non-target damage to nearby flora. I’ll definitely be in trouble with the biology 
folks if I don’t point out that it’s not just   people who use bubbles as a tool. Humpback 
whales cooperate to create bubble curtains   that corral fish to a central point. Then 
they lunge into the center to gulp them down,   a behavior called bubble net feeding.  And we 
use bubbles this way on occasion as well, not   for fishing but to keep fish out of certain areas, 
usually to prevent the spread of invasive species. By 2005, the pile driving operation on the east 
span replacement of the Bay Bridge was complete,   and Caltrans and its consultant 
were awarded the Environmental   Excellence Award by the Federal Highway 
Administration for all the work they did   on minimizing underwater noise impacts 
on endangered fish species. And the   lessons from that project have been applied 
across the world in the two decades since. You know I love heavy construction. The bigger 
and louder the machinery, the better. But I think   that anything we can do to limit the effect we 
have on the other things we share this world   with is a win, especially when it’s something 
as clever and creative as blowing bubbles. My first exposure to this topic was reading 
about how unexploded ordnance is handled in   the Baltic Sea. They use bubble curtains to reduce 
the effects on fish, and I’m curious if any of you   know other cool applications in the industry 
that I didn’t mention here. I’m so fascinated   to see and learn more about the differences in 
techniques and infrastructure across the world.   And there’s probably nowhere you see those 
differences better than in transportation. My friend Mike from the DownieLive channel is 
on an adventure to travel from the Arctic all   the way to Africa, as much as possible, by 
train. The series is called DownieExpress,   and it’s such a cool combination of adventure 
and infrastructure. So many cool trains,   from modern high-speed transit to the most basic 
coach. I first started watching DownieLive when he   was filming this wild quad tandem bike race, 
and this DownieExpress series just   has me hooked. And if you want to watch the 
whole thing, it’s only available on Nebula. You probably know about Nebula now, even if 
you’re not subscribed. It’s a streaming service   built by and for independent creators. No studio 
executives deciding what gets the green light, no   advertisements driving the content into a single 
style. It’s just independent creators making stuff   they’re excited about with as few barriers and 
distractions as possible between you and us. My videos go live on Nebula before they come 
out here, and my Practical Construction series   was specifically produced for Nebula viewers who 
want to see deeper dives into specific topics.   I know there are a lot of streaming platforms 
out there right now, and no one wants another   monthly cost to keep track of, but I also know 
that if you’re watching a show like this to end,   there is a ton of other stuff on Nebula that 
you’re going to enjoy as well. So I’ve made   it dead simple: click the link below and you’ll 
get 40% off an annual plan. Pay just one time,   36 dollars, for an entire year’s access at 
go.nebula.tv/practical-engineering. Or if   you have subscription fatigue, but still want to 
support what I’m doing, you can get a lifetime   membership. Pay once and have access for as long 
as you and Nebula last. Hopefully that’s a long   time! If you’re with me that independent 
creators are the future of great video,   I hope you’ll consider subscribing. Thank you 
for watching, and let me know what you think!

---

## 12. California’s Tallest Bridge Has Nothing Underneath
**Channel:** Practical Engineering | **Views:** 1.6M | **Date:** 5 months ago | **Duration:** 17:07 | **ID:** QOnQORqkHcM
**Link:** https://youtube.com/watch?v=QOnQORqkHcM

### Transcript:
Foresthill Bridge soars across the valley 
of the North Fork of the American River   just outside Auburn, California. At more than 
700 feet or 200 meters above the canyon floor,   it’s the fourth-tallest bridge in the United 
States. When it opened in 1973, crowds cheered   for the impressive new structure. But if you take 
a closer look, it doesn’t really make any sense. This isn’t an interstate highway or even a major 
thoroughfare. The road sees only a few thousand   vehicles a day, connecting Auburn, an exurb of 
Sacramento with a population just shy of 14,000,   to scattered rural communities and 
recreation areas in the western   foothills of the Sierra Nevadas. And while 
the American River does occasionally flood,   it doesn’t flood 700 feet. Before this, the 
crossing was basically a low-water bridge. A structure of this magnitude just looks out 
of place. But it wasn’t just a boondoggle,   at least not at the outset. It 
was built that way for a reason,   and the story behind it is not only pretty 
wild, but it also sits at the hinge point   of a major chapter in American infrastructure. 
I’m Grady, and this is Practical Engineering. California’s Central Valley is one of the world’s 
great agricultural regions: over 400 miles long,   more than 50 miles wide, this remarkably fertile 
area is nearly half the size of England. The   city of Sacramento sits near its center, right 
where the Sacramento and American Rivers meet. To manage and distribute water across this 
enormous landscape, the federal government   launched the Central Valley Project in 1933, a 
sweeping effort by the U.S. Bureau of Reclamation   to store water in the wetter northern part of the 
valley and distribute it to the drier south. In   the process, the system would also generate 
hydropower and reduce flood risk for growing   urban centers. I’m glossing over a lot here. The 
history of California is steeped in water issues,   and even just the Central Valley Project 
is nearly a century of details. But,   critically, Folsom Dam was one of 
the first big components of the plan. Built in 1955 on the American River, the 
concrete gravity dam provided significant   flood protection to the City of Sacramento. 
However, it was constructed relatively early   in our understanding of basin-scale hydrology 
and the uncertainty surrounding the frequency   and magnitude of flooding over long periods 
of time. It became clear pretty quickly that   Folsom Dam didn’t quite offer as much flood 
protection as was originally promised. Plus,   because Folsom had to keep its flood 
pool empty to handle potential inflows,   its ability to store water for irrigation or 
municipal supply purposes was somewhat limited. The answer to these problems, at least according 
to the federal government, was Auburn Dam,   authorized by Congress in 1968. The new structure 
would sit upstream of Folsom and control the   variable flows of the North and Middle Forks of 
the American River. It would be the tallest dam in   California and one of the tallest in the country. 
And work began in earnest in the early 1970s. One of the first steps in the process was 
rerouting the American River. Crews built a large   cofferdam and carved a diversion tunnel through 
the canyon wall. With the water redirected,   they could begin drying out the bend in the river 
where the huge new dam would eventually sit. Once the site was dried out, crews began exploring 
the underlying geology more thoroughly. They   drilled boreholes, excavated tunnels and shafts, 
and surveyed the rock that would serve as the   dam’s foundation. The site’s geology turned out to 
be more complex than expected. Some zones of rock   were more compressible than others, which could 
lead to dangerous stress concentrations in the   dam. And, there were a lot of joints and fissures 
in the rock mass, making it more challenging to   predict how they would behave under extreme loads, 
in addition to creating paths for water. So the   next phase of the project was a major foundation 
treatment program starting in 1974. This mainly   involved pressure grouting fractures to reinforce 
weak zones against the enormous weight of the   structure and to make the geology more watertight, 
preventing seepage from flowing under the dam. With major construction works underway,   anticipation for the reservoir was growing. 
Around the future rim, land values soared,   and developers rushed to stake claims. Lakefront 
homes were planned. Entire communities emerged,   built on the promise of a shining new shoreline. 
Then, in August 1975, a magnitude 5.9 earthquake   struck near Oroville Dam, only about 50 
miles or 80 kilometers away from the site. The quake only caused minor 
damage to structures in the area,   but it rattled confidence in the Auburn project. 
The geology of the western Sierra Nevadas had   long been considered stable. But the Oroville 
earthquake introduced a troubling possibility:   that the loading and filling of large reservoirs 
could trigger seismic events in the area.   This phenomenon, known as reservoir-induced 
seismicity, is still not well understood even   to this day. The pressure of water infiltrating 
bedrock and the weight of a reservoir can   change the balance of forces along faults, 
potentially triggering movement. You know,   when Oroville is full, that’s roughly 10 billion 
pounds of force or 4 billion kilograms of mass.   It’s a staggering amount. You can imagine 
how that might affect the underlying geology. The Auburn Dam, as a thin concrete arch, 
in contrast to the concrete gravity dam at   Folsom or the earthfill embankment at Oroville, 
would be especially vulnerable to earthquakes.   Thin-arch dams rely on the canyon walls to 
resist the thrust of the structure. In fact,   I’ve made a video all about the topic you can 
check out after this! If one side shifts even   a little during a quake, the results could be 
catastrophic. In April 1976, a report by the   Association of Engineering Geologists concluded 
that an earthquake like the one at Oroville could   cause the proposed Auburn Dam to catastrophically 
fail. It was back to the drawing board for the   project, even as the foundation grouting program 
continued. And then the project was shaken again. That same year, the newly completed Teton Dam 
in Idaho collapsed during its first filling,   killing 11 people and causing billions in 
damage. It had been built by the same agency,   the Bureau of Reclamation. Concern continued 
to mount about the safety of Auburn Dam,   which would have catastrophic consequences 
for the thousands of Californians downstream   if it were to fail. It was all enough 
to bring Auburn’s momentum to a halt. While dam construction paused, one aspect 
of the project had already been finished:   Foresthill Bridge. With a cofferdam on the 
river and the diversion tunnel only sized   for smaller floods, there was a risk 
of overtopping the existing bridge,   cutting off access between Auburn and 
the Sierra foothills. So, the Bureau of   Reclamation decided to get a head start on a 
project that would eventually be inevitable:   a new bridge, permanent and high enough to 
span the reservoir once it filled. If they   were going to build a new bridge, they figured 
they might as well build it right the first time. The result was a striking steel cantilever 
bridge with two slender concrete piers soaring   skyward from the canyon floor. [Actually, 
there was another bridge planned over the   Middle Fork of the American River - the 
Ruck-a-Chucky Bridge. It was a wild idea:   a curved cable-stayed bridge where all the cables 
are anchored in the hillsides rather than tall   towers. But while that project was shelved, 
Foresthill made it all the way through design   and construction.] At the time of its opening 
in 1973, it was the second-highest bridge in the   United States. But as time went on, it became 
increasingly clear they had jumped the gun. By 1980, engineers floated two new dam 
designs that could withstand potential   earthquakes. Both would be shifted slightly 
downstream from the original site. But by then,   the tide of public and government 
support for the dam had turned. Construction costs had ballooned, and Auburn Dam 
was looking less feasible every day. As originally   proposed, the structure would be even larger than 
the Hoover Dam size, but store less than 10% of   Lake Mead’s volume. Meanwhile, upgrades to Folsom 
Dam and improved levees around Sacramento offered   far cheaper ways to reduce the flood risk that was 
the major impetus for the dam in the first place.   New hydrologic data also suggested that earlier 
flow estimates had been overly optimistic,   reducing its value for conservation. The 
benefits of Auburn Dam were shrinking as the   costs grew. It was turning into an incredibly 
expensive solution in search of a problem. At the same time, environmental and advocacy 
groups were gaining momentum. The project would   flood canyons used for whitewater rafting 
and kayaking. It would drown ecosystems,   inundate archaeological sites, and 
destroy long segments of the wild   and scenic forks of the American River. 
It became clearer and clearer that the   ends simply couldn’t justify the means. 
And yet, the idea never fully went away. In 1986, a massive flood hit the area. Water 
backed up at the diversion tunnel at Auburn,   overtopped the cofferdam, and caused it 
to fail. Downstream levees were breached,   and much of Sacramento flooded. For a moment, 
the momentum behind Auburn Dam and its promise   of flood protection returned. But, it later 
became clear that the flood wasn’t entirely   a natural disaster. The Bureau hadn’t followed 
the operating guidelines at Folsom Dam, worsening   conditions downstream. And by then, grassroots 
opposition, cost concerns, and shifting priorities   had all but put the Auburn Dam project to bed. 
Various proposals resurfaced over the years,   including the idea of a “dry dam” that would only 
hold water during floods, but none gained much   traction. With its many iterations and proposals, 
the project became known as the dam that wouldn’t die.  But in 2008, the state of California revoked 
the Bureau’s water rights permit for the project,   maybe not sealing its fate completely, but 
at least burying it several feet deeper. This story really gets to the heart of the 
challenge with large-scale public works   projects. No matter how you configure them, 
there are big losers and big winners. There’s   no doubt that a dam across the American River 
upstream of Folsom could provide significant   benefits to the public: flood control, water 
supply, hydropower, recreational opportunities,   or some combination of them all. But those 
benefits have to be weighed against real costs:   environmental damage, staggering capital 
investment, long-term maintenance,   the inherent risk of catastrophic failure, and 
the social toll of displacement and disruption. The mid-20th century was the 
heyday of American dam building,   an era driven by ambition and optimism, but also 
by uncertainty. We didn’t have enough historical   data to fully understand river systems. We 
couldn’t yet grasp the long-term consequences   of altering them. And we couldn’t see into 
the future to know what the true impacts of   these structures would be or what the cost of 
keeping them in good shape might amount to. Since then, we have a lot more experience with 
huge multi-purpose reservoirs. And it seems,   in general, that the more we learn, the more the 
answer to whether they’re worth it seems to be:   maybe not. And that maybe turns into a probably   when you consider that all the 
best sites are already taken. New Melones Dam, completed by the Bureau of 
Reclamation in 1979, not too far from Auburn,   faced a lot of similar controversy 
and pushback. Although the project   was eventually completed, the fight was 
bitter, and its legacy so far is mixed.   The project is widely considered to be 
the last great American dam. At least,   great in size, if not in public sentiment. No 
other reservoir of that scale has been built   in the U.S. since. And with the Auburn Dam project 
mostly dead, it seems doubtful there ever will be. The American River continued flowing 
through the diversion tunnel until 2007,   when a new pump station and restoration project 
returned the river to its original channel.   Kayakers can now navigate downstream, and even 
have some new features at the pump station to   choose from: the artificial rapids on the left 
or the screen channel on the right. After more   than three decades, the river was back in its 
place, tying a bow on a dam that was never built.  And yet, just a few miles upstream, the Foresthill 
Bridge still stands, dramatic, overbuilt,   and strangely out of sync with its surroundings. 
And we’re still kind of stuck taking care of this   bridge, whose scale is so out of proportion with 
its purpose. In the 2010s, the bridge underwent a   major seismic retrofit to improve its safety and 
make future inspections easier. More recently,   it was part of a nationwide program inspecting 
bridges built with T-1 steel, an alloy that,   in some cases, has shown concerning cracking 
at welds. The I-40 bridge crack in Memphis,   which I covered in an earlier video, triggered 
the effort. And there have been quite a few   defects found in bridges since then, so here’s 
hoping that Foresthill doesn’t make the list.  It’s a cool structure in its own right. But 
it stands for more than just an engineering   achievement. Auburn Dam left a lot of scars, both 
on the physical landscape and the political one.   But it also left this bridge that became more 
than just an out-of-place oddity. In a sense,   it’s become a monument to the end of an 
era in US major public works projects,   and, hopefully, a tribute to the caution 
and care that will shape the next one.  One example of this  era’s thought and care around water issues in 
the US is “contaminants of emerging concern”:   stuff that can pollute drinking water that 
hasn’t been historically regulated. Recently,   the EPA rolled back limits on PFAS, the so-called 
“forever chemicals,” in drinking water. The cost   of removing these compounds can be enormous, 
and there are a lot of unknowns around their   impact on human health. So, not everyone 
agrees on what the limits should be. And   you can definitely get a feel for the controversy 
if you read through the reporting on this story. More than 350 sources reported on the rollback, 
with about 30 percent leaning left and 10 percent   leaning right. Today’s sponsor, Ground News, makes 
it easy to see them all in one place. But more   than that, it adds context to help you consider 
any biases in the reporting. You can see ownership   and factuality ratings backed by independent 
news monitoring organizations at a glance.   All this is shown in a nice dashboard, with the 
individual articles organized and linked below. If you compare the headlines, you can see the 
different ways the story is framed. On the left,   the current administration is “undoing” or 
“weaking” standards on “toxic” chemicals.   On the right, you see softer language like 
“easing” limits on “some” of the chemicals.   It starts to become obvious how news outlets can 
slant stories in certain ways, depending on the   narrative they want to get across. In that 
way, journalism has a lot of power over us,   and Ground News hands some of that power back 
to you. If you’d like a more transparent media   landscape, they’re offering a huge discount 
right now at the link in the description:   40 percent off the Vantage subscription, 
which includes unlimited access to all   their features. That’s ground dot news 
slash practicalengineering or just click   the link in the description. Thank you for 
watching, and let me know what you think!

---

## 13. Why Are There No Short Arch Dams?
**Channel:** Practical Engineering | **Views:** 1.0M | **Date:** 6 months ago | **Duration:** 16:40 | **ID:** _R0xPffklXQ
**Link:** https://youtube.com/watch?v=_R0xPffklXQ

### Transcript:
Flaming Gorge Dam rises from the Green River in 
northern Utah like a concrete wedge driven into   the canyon, anchored against the sheer rock 
walls that flank it. It’s quintessential,   in a way. It’s what we picture when we think 
about dams: a hulking, but also somehow graceful,   wall of concrete stretching across a 
narrow rocky valley. But to dam engineers,   there’s nothing quintessential about it. 
So-called arch dams are actually pretty rare.   For reference, the US has about 92,000 
dams listed in the national inventory.   I couldn’t find an exact number, but 
based on a little bit of research,   I estimate that we have maybe around 50 arch 
dams - it’s less than a tenth of a percent. The only reason we think of arch dams as 
archetypal is because they’re so huge.   I counted 11 in the US that have their own 
visitor center. There just aren’t that many   works of infrastructure that double as tourist 
destinations, and the reason for it is, I think,   kind of interesting. Because an arch dam isn’t 
just an engineering solution to holding back   water, and it’s not just a solution to holding 
back a lot of water. It’s all about height,   and I built a little demo to show you what I mean. 
I’m Grady, and this is Practical Engineering. Engineers love categories, and dams are no 
exception. You can group them in a lot of ways,   but mostly, we care about how they handle 
the incredible force of water they hold back.   Embankment dams do it with earth or rock, relying 
on friction between the individual particles that   make up the structure. Gravity dams do it 
with weight. Let me show you an example. I have my tried and trusted acrylic flume with 
a small plastic dam. Once this is all set up,   I can start filling up the reservoir. This 
little dam is a little narrower than the   flume. It doesn’t touch the sides, so it 
leaks a bit. The reason for that will be   clear in a moment. And hopefully you can 
see what’s about to happen. This gravity   dam doesn’t have much gravity in it, so it 
doesn’t take much water at all before you   get a failure. I’m counting failure as 
the first sign of movement, by the way.   That’s when the stabilizing forces are overcome 
by the destabilizing ones. And the little dam   by itself could hold until my reservoir 
was about a quarter of the way to the top. Gravity dams get their stability against 
sliding from… you guessed it…  friction. Bet you thought I was going to say gravity. 
And actually, it kind of is gravity,   since frictional resistance is a function of just 
two variables: the normal force (in other words,   the weight of the structure) and a 
coefficient that depends on the two   materials touching. Engineers analyze the 
stability of gravity dams in cross-section,   essentially taking a small slice of the 
structure. You want every slice to be able   to support itself. That’s why I didn’t want 
the demo touching the sides of the flume;   it would add resistance that doesn’t actually 
exist in a cross-section. The destabilizing   force is hydrostatic pressure from the reservoir, 
which increases with depth. And the stabilizing   force is friction. There are some complexities 
to this that we’ll get into, but very generally,   as long as you have more friction than pressure, 
you’re good; you have a stable structure. So let’s add some normal force to 
the demo and see what happens.  You can see my little reservoir gets 
a little higher before the dam fails,   about halfway to the top.  And we can try 
it again with more weight.  But the result gets a little more interesting…  the dam didn’t 
actually slide this time, but it still failed. Turns out gravity dams have two major failure 
modes: sliding and overturning. Resistance to   sliding comes from friction, which really 
doesn’t depend on how the weight of the dam   is distributed. That’s not true for overturning 
failures. Let’s look back at our cross-section.   For a unit width of dam, the hydrostatic pressure 
from the reservoir looks like this. Pressure   increases with depth. And the area under this line 
is the total force pushing the dam downstream. We   can simplify that distribution and treat it 
like it’s a single force, and it turns out   when you do that, the force acts a third of the 
way up the total depth of water. Most dams want   to rotate about the downstream toe, so you have 
a destabilizing force offset from the point of   rotation. In other words, you have a torque, also 
called a moment. The dam has to create an opposite   moment around that point to remain stable. Moment 
or torque is calculated as the force multiplied by   its perpendicular distance from the point of 
rotation. So, the further the center of mass   is from the downstream toe, the more stable 
the structure is, and the demo shows it too. Here’s where we left the weights the last 
time, and let’s see it happen again.  The reservoir makes it about two-thirds of the way 
up the walls before the dam overturns. Let’s   make a simple shift. Just move the weights further 
upstream and try again.  It’s not a big difference.  The reservoir reaches about three-quarters 
the way up before we see a sliding failure,   but shifting the weights did increase the 
stability. And this is why a lot of gravity   dams have a fairly consistent shape, with most 
of the weight concentrated on the upstream side,   and usually a sloped or stepped downstream face. Interestingly, you can use 
the force of water against   itself in a way. Watch what happens 
when I turn my little model around.   Now the hydrostatic pressure applies both 
a destabilizing and stabilizing force,   so you get more resistance for a given depth. 
A lot of deployable temporary storm barriers   and cofferdam systems take advantage of this 
kind of configuration. You can imagine if I   extended the base even further, I could 
create a structure that was self-stable   just from its geometry alone. The weight of 
the water on the footing would overcome the   lateral pressure. But there’s a catch to 
this. This is fully stable now, but watch   what happens when I give the 
dam just a bit of a tilt.  All of a sudden, it’s no longer stable. This might seem kind of intuitive, but I think 
it’s important to explain what’s actually going   on. Hydrostatic pressure from the reservoir 
doesn’t only act on the face of a dam. With   smooth plastic on smooth plastic, you get a pretty 
nice seal, but as soon as even a tiny gap opens,   water gets underneath. Now there’s upward 
pressure on the bottom of the dam as well. If   you’re depending on the downward force of a dam 
from its weight for stability, it’s easy to see   why an upward force is a bad thing. And it’s so 
dramatic in the example with the upstream footing   specifically. In that case, the downward pressure 
of the reservoir is acting as a stabilizing force,   but if water can get underneath that footing, 
it basically cancels out. The pressure on the   bottom is the same as the pressure on the top. 
But this isn’t only an issue in that case. The ground isn’t waterproof. In 
fact, I’ve done a video all about   the topic. Soil and rock works more 
like a sponge than a solid material,   and water can flow through them. That’s how 
we get aquifers and wells and springs and   such. But it’s a problem for gravity dams, 
because water can seep below the structure   and apply pressure to the bottom, essentially 
counteracting its weight. We call it uplift. Looking back at the cross-section, 
we can estimate this. Of course,   you have the triangular pressure distribution 
along the upstream face. But at this point   you have the full hydrostatic pressure also 
pushing upward. And at the downstream toe,   you have no pressure (it’s exposed to the 
atmosphere). So, now you have a pressure   distribution below the dam that looks like 
this. Of course, this part can get a lot more   complicated since most dams don’t sit flush 
with the ground, and many are equipped with   drains and cutoff walls, so definitely go check 
that other video out if you want to learn more. But let me show you the issue this causes with 
some recreational math on our cross-sectional   slice of the dam. The taller the dam, the greater 
the uplift force. That happens linearly. In other   words, the force is proportional to the depth 
of the reservoir. But look at the lateral force.   Again, remember it’s the area under this 
triangle. Maybe you remember that formula:   one-half times base times height. Well, the height 
is the depth of the water. And the base is also   a function of the depth. More specifically, it’s 
the unit weight of water times depth. Multiply it   together, and you see the challenge: the force 
increases as a function of the depth squared.   So for every unit of additional height you want 
out of a gravity dam, you need significantly more   weight to resist the forces, which means 
more material and thus a lot more cost. Hopefully all this exposition is starting to 
reveal a solution to this rapid divergence   of stability and loads as a reservoir 
increases in height. Dams don’t actually   float in space like my demonstration and 
graphics show. You know, by necessity,   they extend across the entire valley and usually 
key into the abutments on either side. Naturally,   that connection at the sides is going to 
offer some resistance to the forces dams   need to withstand. And if you can count on that 
resistance, you can significantly lower the mass,   and thus the cost, of the structure. But, again, 
this gets complicated. Let’s go back to the demo. Now I’m going to replace my gravity dam 
with something much simpler. Just a sheet   of aluminum flashing, and, to simulate 
that resistance provided by socketing the   structure into the earth, I’ve taped it to 
the bottom and sides… with some difficulty, actually.  When I fill up the reservoir with 
water, it holds just fine. There’s a little   leaking past my subpar tape job, but this 
is a fully stable structure. And I think   the comparison here is pretty stark. When you 
can develop resistance from the sides you can   get away with a lot less dam. But it’s 
harder than you might think to do that. For one, the natural soil or rock at a 
dam site might not be all that strong.   The banks of rivers aren’t generally known for 
their stability, so the prospect of transferring   enormous amounts of force into them rarely makes a 
lot of engineering sense. But the other challenge   is in the dam itself. Take a look back at this 
demo. See how my dam is bending behind the force   of the water. It’s holding there, but, you know, 
we don’t actually build dams out of aluminum   flashing. Resisting loads in this way basically 
treats the dam like a beam, like a sideways bridge   girder. Except, unlike girder bridges that 
usually only span up to a few hundred feet,   dams are often much longer. Even the stiffest 
modern materials, like prestressed concrete boxes,   would just deflect too much under load to 
transfer all the hydrostatic pressure across   a valley into the abutments. Plus we usually 
don’t like to rely on steel too much in dams   because of issues with corrosion and longevity. 
So where a typical beam experiences both tensile   and compressive stress on opposite sides, 
we really need to transfer all that load,   creating only compressive stress in the material. 
I’m sure you see where I’m going with this. How have we been building bridges for ages 
from materials like masonry where tensile   stress isn’t an option? It’s arches! The arch 
is a special shape in engineering because you   can transfer loads by putting the material 
in compression only, allowing for simpler,   cheaper, and longer-lasting materials like 
masonry and concrete. You basically co-opt   the geology for support, reducing the need for 
a massive structure. For completeness’s sake,   let me show you how it works in the demo. 
I’ve formed a little arch from my thin sheet   of aluminum. Now when I fill up the reservoir, 
there’s no deflection like the previous example.   And again, side by side, it’s easy to see the 
benefits here.  You get a lot more efficiency out of your materials  than you do with an earthen 
embankment dam or a gravity structure. Of course, there are some drawbacks here. For 
one, arches create horizontal forces at the   supports called thrusts that have to be resisted. 
Sites that use this design really require strong,   competent rock in the abutments to withstand 
the enormous loads. And just like with bridges,   the span matters. The wider the valley, 
the bigger the arch needs to be,   so these dams generally only make 
sense in deep gorges and steep,   narrow canyons. The engineering is a lot more 
complicated, too. You can’t use a simple 2D   cross-section to demonstrate stability. 
The structural behavior is inherently   three-dimensional, which is tougher 
to characterize, especially when you   consider unusual conditions like earthquakes and 
temperature effects. And since they’re lighter,   arch dams don’t resist uplift forces very 
well, making foundation drainage systems   more critical. All this means that it’s 
really only a solution that makes economic   sense in a narrow range of circumstances, 
one of the most important being height. For smaller dams, the additional complexity and 
expense of designing and building an arch aren’t   justified by the structural efficiency. Gravity 
and embankment dams are much more adaptable to   a wider range of site conditions. And 
there are other types of dams, too,   that blend these ideas. Multiple-arch dams use a 
series of smaller arches supported by buttresses,   dividing the span into more manageable components. 
Even what is perhaps the most famous arch dam   in the world - Hoover Dam - isn’t a pure arch 
structure. Technically, it’s a gravity-arch dam,   meaning it resists part of the water load through 
mass while also distributing the forces into the   canyon through arch action. The proportions 
are carefully balanced to take advantage   of the unique site conditions and relatively 
wider canyon than most arch dams are built in. And so, when you look at the tallest dams on 
Earth, one structural form dominates. By my   estimation, around 40 percent of the tallest 200 
dams in the world incorporate an arch into their   design. There aren’t that many places where it 
makes sense, but when you compare what it takes to   hold a reservoir back in a narrow canyon valley, 
I think the case for arches is pretty clear. I think these models help a lot to explain 
engineering principles, so I have built   quite a few of these acrylic demonstrations 
in the garage to cover interesting topics.   One of my favorite creators, Neo, does the same 
thing, but instead of demos, he uses beautiful 3D   graphics. His video about the construction of the 
World Trade Center towers in New York City is a   fascinating look into how much effort, care, and 
engineering went into these buildings before the   2001 attack brought them down. My favorite part 
was the design of the slurry wall foundation,   and of course, the 3D animations. And 
it was produced as a Nebula original. You’ve heard me talk about Nebula before. It’s 
a streaming service built by and for independent   creators, including a lot of my favorites like 
Neo, Wendover Productions, the Coding Train,   and Branch Education. I don’t know about 
you, but independently-produced content   is most of what I watch these days. I just 
like the authenticity and thoughtfulness of   videos that haven’t been through ten levels of 
studio executives watering the information down   to capture the widest audience possible. 
I just think passionate individuals and   small teams make the most compelling work, 
and Nebula is the perfect place for it. Nebula’s totally ad-free, with tons of excellent 
channels and lots of original series and specials   like Neo’s video on the Twin Towers. It’s also a 
great gift, especially because a yearly membership   is 40% of the link in the description. At 
thirty-six bucks for a year, that’s pretty   tough to beat. My videos go live on Nebula before 
they come out on YouTube. If you’re with me that   independent creators are the future of great 
video, I hope you’ll consider subscribing.   That’s go.nebula.tv/Practical-Engineering. Thank 
you for watching, and let me know what you think!

---

## 14. The Hidden Engineering of Floating Bridges
**Channel:** Practical Engineering | **Views:** 788K | **Date:** 7 months ago | **Duration:** 17:36 | **ID:** nol0_4qxzb0
**Link:** https://youtube.com/watch?v=nol0_4qxzb0

### Transcript:
In the early 1900s, Seattle was a growing city 
hemmed in by geography. To the west was Puget   Sound, a vital link to the Pacific Ocean. 
To the east, Lake Washington stood between   the city and the farmland and logging towns of 
the Cascades. As the population grew, pressure   mounted for a reliable east–west transportation 
route. But Lake Washington wasn’t easy to cross. Carved by glaciers, the lake is deceptively 
deep, over 200 feet or 60 meters in some   places. And under that deep water sits 
an even deeper problem: a hundred-foot   layer of soft clay and mud. Building bridge 
piers all the way to solid ground would have   required staggeringly sized supports. The cost and 
complexity made it infeasible to even consider. But in 1921, an engineer named Homer Hadley 
proposed something radical: a bridge that   didn’t rest on the bottom at all. Instead, it 
would float on massive hollow concrete pontoons,   riding on the surface like a ship. It took 
nearly two decades for his idea to gain traction,   but with the New Deal and Public Works 
Administration, new possibilities for   transportation routes across the country 
began to open up. Federal funds flowed,   and construction finally began on what 
would become the Lacey V. Murrow Bridge. When it opened in 1940, it was the first 
floating concrete highway of its kind,   a marvel of engineering and a symbol of 
ingenuity under constraint. But floating   bridges, by their nature, carry some unique 
vulnerabilities. And fifty years later,   this span would be swallowed 
by the very lake it crossed. Between that time and since, the Seattle 
area has kind of become the floating   concrete highway capital of the world. That’s 
not an official designation, at least not yet,   but there aren’t that many of these structures 
around the globe. And four of the five longest   ones on Earth are clustered in one small area 
of Washington state.  You have Hood Canal,   Evergreen Point, Lacey V Murrow,  and its neighbor, the Homer M. Hadley Memorial   Bridge, named for the engineer who 
floated the idea in the first place. Washington has had some high-profile failures, 
but also some remarkable successes, including a   test for light rail transit over a floating bridge 
just last month in June 2025. It's a niche branch   of engineering, full of creative solutions and 
unexpected stories. So I want to take you on a   little tour of the hidden engineering behind them. 
I’m Grady, and this is Practical Engineering. Floating bridges are basically as old as 
recorded history. It’s not a complicated idea:   place pontoons across a body of water, then 
span them with a deck. For thousands of years,   this straightforward solution has provided a 
fast and efficient way to cross rivers and lakes,   particularly in cases where permanent bridges were 
impractical or when the need for a crossing was   urgent. In fact, floating bridges have been 
most widely used in military applications,   going all the way back to Xerxes crossing the 
Dardanelles in 480 BCE. They can be made portable,   quick to erect, flexible to 
a wide variety of situations,   and they generally don’t require 
a lot of heavy equipment. There   are countless designs that have been used 
worldwide in various military engagements. But most floating bridges, both ancient and 
modern, weren’t meant to last. They’re quick   to put up, but also quick to take out, either 
on purpose or by Mother Nature. They provide the   means to get in, get across, and get out. So they 
aren’t usually designed for extreme conditions.   Transitioning from temporary military crossings 
to permanent infrastructure was a massive leap,   and it brought with it a host 
of engineering challenges. An obvious one is navigation. A bridge that 
floats on the surface of the water is, by default,   a barrier to boats. So, permanent floating 
bridges need to make room for maritime traffic.   Designers have solved this in several ways, and 
Washington State offers a few good case studies. The Evergreen Point Floating Bridge includes 
elevated approach spans on either end,   allowing ships to pass beneath before the road 
descends to water level. The original Lacey V.   Murrow Bridge took a different approach. 
Near its center, a retractable span could   be pulled into a pocket formed by adjacent 
pontoons, opening a navigable channel. But,   not only did the movable span create interruptions 
to vehicle traffic on this busy highway,   it also created awkward roadway curves that 
caused frequent accidents. The mechanism was   eventually removed after the East Channel Bridge 
was replaced to increase its vertical clearance,   providing boats with an alternative route 
between the two sides of Lake Washington. Further west, the Hood Canal Bridge incorporates 
truss spans for smaller craft. And it has   hydraulic lift sections for larger ships. The US 
Naval Base Kitsap is not far away, so sometimes   the bridge even has to open for Navy submarines. 
These movable spans can raise vertically above   the pontoons, while adjacent bridge segments 
slide back underneath. The system is flexible:   one side can be opened for tall but 
narrow vessels, or both for wider ships. But floating bridges don’t just have to make 
room for boats. In a sense, they are boats.   Many historical spans literally floated on boats 
lashed together. And that comes with its own   complications. Unlike fixed structures, floating 
bridges are constantly interacting with water:   waves, currents, and sometimes even tides and 
ice. They’re easiest to implement on calm lakes   or rivers with minimal flooding, but water 
is water, and it’s a totally different type   of engineering when you’re not counting 
on firm ground to keep things in place. We don’t just stretch floating bridges across 
the banks and hope for the best. They’re actually   moored in place, usually by long cables and 
anchors, to keep materials from overstressing   and to prevent movements that would make 
the roadway uncomfortable or dangerous.   Some anchors use massive concrete slabs placed 
on the lakebed. Others are tied to piles driven   deep into the ground. In particularly deep 
water or soft soil, anchors are lowered to   the bottom with water hoses that jet soil away, 
allowing the anchor to sink deep into the mud. These anchoring systems do double duty, 
providing both structural integrity and   day-to-day safety for drivers, but even with them, 
floating bridges have some unique challenges.   They naturally sit low to the water, which means 
that in high winds, waves can crash directly   onto the roadway, obscuring the visibility 
and creating serious risks to road users.   Motion from waves and wind can also cause the 
bridge to flex and shift beneath vehicles,   especially unnerving for drivers unused 
to the sensation. In Washington State,   all the major floating bridges have been 
closed at various times due to weather.   The DOT enforces wind thresholds for each 
bridge; if the wind exceeds the threshold,   the bridge is closed to traffic. Even if the 
bridge is structurally sound, these closures   reflect the reality that in extreme weather, 
the bridge itself becomes part of the storm. But we still haven’t addressed the 
floating elephant in the pool here:   the concrete pontoons themselves. Floating bridges 
have traditionally been made of wood or inflatable   rubber, which makes sense if you’re trying to stay 
light and portable. But permanent infrastructure   demands something more durable. It might seem 
counterintuitive to build a buoyant structure   out of concrete, but it’s not as crazy as it 
sounds. In fact, civil engineering students   compete every year in concrete canoe races hosted 
by the American Society of Civil Engineers. Actually, I was doing a little recreational 
math to find a way to make this intuitive,   and I stumbled upon a fun little fact.  If you want to build a neutrally buoyant,   hollow concrete cube, there’s a neat rule of 
thumb you can use. Just take the wall thickness   in inches, and that’s your outer dimension 
in feet. Want 12-inch-thick concrete walls?   You’ll need a roughly 12-foot cube. This 
is only fun because of the imperial system,   obviously. It’s less exciting to say that 
the two dimensions have a roughly linear   relationship with a factor of 12. And I 
guess it’s not really that useful except   that it helps to visualize just how 
feasible it is to make concrete float. Of course, real pontoons have to do more than just 
barely float themselves. They have to carry the   weight of a deck and whatever crosses it with an 
acceptable margin of safety. That means they’re   built much larger than a neutrally buoyant 
box. But mass isn’t the only issue. Concrete   is a reliable material and if you’ve watched the 
channel for a while, you know that there are a few   things you can count on concrete to do, and one 
of them is to crack. Usually not a big deal for a   lot of structures, but that’s a pretty big problem 
if you’re trying to keep water out of a pontoon. Designers put enormous effort into preventing 
leaks. Modern pontoons are subdivided into   sealed chambers. Watertight doors are 
installed between the chambers so they   can still be accessed and inspected. Leak 
detection systems provide early warnings if   anything goes wrong. And piping is pre-installed 
with pumps on standby, so if a leak develops,   the chambers can be pumped dry before 
disaster strikes. The concrete recipe   itself gets extra attention. Specialized mixes 
reduce shrinkage, improve water resistance,   and resist abrasion. Even temperature control 
during curing matters. For the replacement of   the Evergreen Point Bridge, contractors embedded 
heating pipes in the base slabs of the pontoons,   allowing them to match the temperature of the 
walls as they were cast. This enabled the entire   structure to cool down at a uniform rate, reducing 
thermal stresses that could lead to cracking. There were also errors during construction,   though. A flaw in the post-tensioning system 
led to millions of dollars in change orders   halfway through construction and delayed the 
project significantly while they worked out   a repair. But there’s a good reason why they 
were so careful to get the designs right on   that project. Of the four floating bridges 
in Washington state, two of them have sunk. In February 1979, a severe storm caused the 
western half of the Hood Canal Bridge to   lose its buoyancy. Investigations revealed that 
open hatches allowed rain and waves to blow in,   slowly filling the pontoons and 
ultimately leading to the western   half of the bridge sinking. The DOT 
had to establish a temporary ferry   service across the canal for nearly four 
years while the western span was rebuilt. Then, in 1990, it happened again. This time, 
the failure occurred during rehabilitation   work on the Lacey V. Murrow Bridge while it was 
closed. Contractors were using hydrodemolition,   high-pressure water jets, to remove old 
concrete from the road deck. Because the   water was considered contaminated, it had to be 
stored rather than released into Lake Washington.   Engineers calculated that the pontoon chambers 
could hold the runoff safely. To accommodate that,   they removed the watertight doors that normally 
separated the internal compartments. But,   when a storm hit over Thanksgiving weekend, 
water flooded into the open chambers. The   bridge partially sank, severing cables on 
the adjacent Hadley Bridge and delaying   the project by more than a year - a 
potent reminder that even small design   or operational oversights can have major 
consequences on this type of structure. And we still have a lot to learn. Recently, 
Sound Transit began testing light rail trains   on the Homer Hadley Bridge, introducing 
a whole new set of engineering puzzles. One is electricity. With power running 
through the rails, there was concern about   stray currents damaging the bridge. To prevent 
this, the track is mounted on insulated blocks,   with drip caps to prevent water 
from creating a conductive path. And then there’s the bridge movement. Unlike 
typical bridges, a floating bridge can roll,   pitch, and yaw with weather, lake level, 
and traffic loads. The joints between the   fixed shoreline and the bridge have to be 
able to accommodate movement. It’s usually   not an issue for cars, trucks, bikes, 
or pedestrians, but trains require very   precise track alignment. Engineers had to 
develop an innovative “track bridge” system.   It uses specialized bearings to distribute every 
kind of movement over a longer distance, keeping   tracks aligned even as the floating structure 
shifts beneath it. Testing in June went well,   but there’s more to be done before you can ride 
the Link light rail across a floating highway. If floating bridges are the present, floating 
tunnels might be the future. I talked about   immersed tube tunnels in a previous 
video. They’re used around the world,   made by lowering precast sections to the seafloor 
and connecting them underwater. But what if,   instead of resting on the bottom, those 
tunnels floated in the water column? It should   be possible to suspend a tunnel with negative 
buoyancy using surface pontoons or even tether   one with positive buoyancy to the bottom using 
anchors. In deep water, this could dramatically   shorten tunnel lengths, reduce excavation 
costs, and minimize environmental impacts. Norway has actually proposed such a tunnel across 
a fjord on its western coast, a project that,   if realized, would be the first of its 
kind. Like floating bridges before it,   this tunnel will face a long list of unknowns.  But that’s the essence of engineering:  meeting each challenge with solutions 
tailored to a specific place and need. There aren’t many locations 
where floating infrastructure   makes sense. The conditions have to be 
just right - calm waters, minimal ice,   manageable tides. But where the conditions do 
allow, floating bridges and their hopefully   future descendants open up new possibilities 
for connection, mobility, and engineering. While we’re talking about bridges and 
maritime traffic, I wanted to mention   that the Key Bridge is back in the news. 
NTSB is still working on the investigation,   but they recently released a recommendations 
report. In my video on the collapse,   I described how engineers evaluate a bridge’s 
vulnerability to vessel collisions. NTSB went   through the same math and found that the risk 
to the Key Bridge was about 30 times higher   than the minimum requirements for new bridges. 
They’re recommending that owners of 68 bridges   across the country do this exercise. If you 
want to make headlines, that’s how you do it. When it came out, the story was reported across 
the US by more than 240 news sources with a good   mix of left-, center-, and right-leaning sources. 
Today’s sponsor, Ground News, makes it easy to   see them all in one place. But more than that, 
it adds context to help you consider any biases   in the reporting. You can see ownership and 
factuality ratings backed by independent news   monitoring organizations at a glance, and easily 
look through all the reporting sources in this   easy-to-use dashboard. And this gets interesting 
right? Because how this story is covered depends a   lot on who’s reporting it. On the left, headlines 
like, “Maryland failed to assess the vulnerability   of its Francis Scott Key Bridge long before 
it collapsed.” On the right, headlines like   “Baltimore Key Bridge Collapse Could Have Been 
Prevented.” Same story. Very different framing. This is a complicated story, and if you don’t 
read between the lines, this interim NTSB report   muddies the water because it focuses on bridge 
vulnerabilities and not navigational issues. Plus,   most outlets focused the story on their own 
local bridges, so if you use a single source   for your news, you might not get the whole story. 
These are just small ways that news reporting can   color our interpretations of the facts. In that 
way, journalism has a lot of power over us, and   Ground News hands some of that power back to you. 
If you’d like a more transparent media landscape,   they’re offering a huge discount right now at 
the link in the description: 40 percent off the   Vantage subscription, which includes unlimited 
access to all their features. Click the link in   the description, scan the QR code, or head to 
ground dot news slash practicalengineering to   get 40 percent off before it expires. Thank you 
for watching, and let me know what you think!

---

## 15. How Liquid Dampers in Skyscrapers Work
**Channel:** Practical Engineering | **Views:** 1.3M | **Date:** 7 months ago | **Duration:** 19:10 | **ID:** fudWbvE8ZKw
**Link:** https://youtube.com/watch?v=fudWbvE8ZKw

### Transcript:
There’s a new trend in high-rise building 
design. Maybe you’ve seen this in your city.   The best lots are all taken, so developers are 
stretching the limits to make use of space that   isn’t always ideal for skyscrapers. They’re not 
necessarily taller than buildings of the past,   but they are a lot more slender. “Pencil tower” 
is the term generally used to describe buildings   that have a slenderness ratio of more than 
around 10 to 1, height to width. A lot of   popular discussion around skyscrapers is about how 
tall we can build them. Eventually, you can get   so tall that there are no materials strong enough 
to support the weight. But, pencil towers are the   perfect case study in why strength isn’t the only 
design criterion used in structural engineering. Of course, we don’t want our buildings 
to fall down, but there’s other stuff   we don’t want them to do, too, including 
flex and sway in the wind. In engineering,   this concept is called the serviceability limit 
state, and it’s an entirely separate consideration   from strength. Even if moderate loads don’t 
cause a structure to fail, the movement   they cause can lead to windows breaking, tiles 
cracking, accelerated fatigue of the structure,   and, of course, people on the top floors losing 
their lunch from disorientation and discomfort.   So, limiting wind-induced motions is a major part 
of high-rise design and, in fact, can be such a   driving factor in the engineering of the building 
that strength is a secondary consideration. Making a building stiffer is the obvious solution. 
But adding stiffness requires larger columns and   beams, and those subtract valuable space within 
the building itself. Another option is to augment   a building’s aerodynamic performance, reducing 
the loads that winds impose. But that too can   compromise the expensive floorspace within. 
So many engineers are relying on another   creative way to limit the vibrations of tall 
buildings. And of course, I built a model in   the garage to show you how this works. I’m 
Grady, and this is Practical Engineering. One of the very first topics I ever covered 
on this channel was tuned mass dampers. These   are mechanisms that use a large, solid mass to 
counteract motion in all kinds of structures,   dissipating the energy through friction or 
hydraulics, like the shock absorbers in vehicles.   Probably the most famous of these is in the Taipei 
101 building. At the top of the tower is a massive   steel pendulum, and instead of hiding it away in 
a mechanical floor, they opened it to visitors,   even giving the damper its own mascot. But, mass 
dampers have a major limitation because of those   mechanical parts. The complex springs, dampers, 
and bearings need regular maintenance, and they   are custom-built. That gets pretty expensive. 
So, what if we could simplify the device? This is my garage-built high-rise.   It’s not going 
to hold many conference room meetings, but it does   do a good job swaying from side to side, just 
like an actual skyscraper. And I built a little   tank to go on top here. The technical name for 
this tank is a tuned liquid column damper, and   I can show you how it works. Let’s try it with no 
water first. Using my digitally calibrated finger,   I push the tower over by a prescribed distance, 
and you can see this would not be a very fun ride.   There is some natural damping, but the 
oscillation goes on for quite a while before   the motion stops.  Now, let’s put some water in the tank.  With the power of movie magic,   I can put these side by side so you can 
really get a sense of the difference. By the way, nearly all of the parts 
for this demonstration were provided   by my friends at Send-Cut-Send.   I don’t have a milling machine or laser cutter,  so this is a really nice option for 
getting customized parts made from   basically any material - aluminum, steel, 
acrylic - that are ready to assemble. Instead of complex mechanical devices, 
liquid column dampers dissipate energy   through the movement of water. The liquid 
in the tank is both the mass and the damper.   This works like a pendulum where the fluid 
oscillates between two columns. Normally,   there’s an orifice between the two columns that 
creates the damping through friction loss as   water flows from one side to the other. To make 
this demo a little simpler, I just put lids on   the columns with small holes. I actually bought 
a fancy air valve to make this adjustable, but it   didn’t allow quite enough airflow. So instead, I 
simplified with a piece of tape. Very technical.   Energy transferred to the water through the 
building is dissipated by the friction of the   air as it moves in and out of the columns.  And you can even hear this as it happens. Any supplemental damping system starts with a 
design criterion. This varies around the world,   but in the US, this is probability-based. We 
generally require that peak accelerations with   a 1-in-10 chance of being exceeded in a 
given year be limited to 15-18 milli-gs   in residential buildings and 20-25 
milli-gs in offices. For reference,   the lateral acceleration for highway curve design 
is usually capped at 100 milli-gs, so the design   criteria for buildings is between a fourth and a 
sixth of that. I think that makes intuitive sense.   You don’t want to feel like you’re navigating a 
highway curve while you sit at your desk at work. It’s helpful to think of these systems in 
a simplified way. This is the most basic   representation: a spring, a damper, and mass on 
a cart. We know the mass of the building. We can   estimate its stiffness. And the building itself 
has some intrinsic damping, but usually not much.   If we add the damping system onto the cart, it’s 
basically just the same thing at a smaller scale,   and the design process is really just choosing 
the mass and damping systems for the remaining   pieces of this puzzle to achieve the design goal. 
The mass of liquid dampers is usually somewhere   between half a percent to two percent of the 
building’s total weight. The damping is related   to the water’s ability to dissipate energy. And 
the spring needs to be tuned to the building. All buildings vibrate at a natural frequency 
related to their height and stiffness. Think   of it like a big tuning fork full of offices 
or condos. I can estimate my model’s natural   frequency by timing the number of oscillations 
in a given time interval. It’s about 1.3 hertz   or cycles per second. In an ideal tuned damper, 
the oscillation of the damping system matches that   of the building. So tuning the frequency of the 
damper is an important piece of the puzzle. For   a tuned liquid column damper, the tuning mostly 
comes from the length of the liquid flow path.   A longer path results in a lower frequency. The 
compression of the air above the column in my   demo affects this too, and some types of dampers 
actually take advantage of that phenomenon. I got   the best tuning when the liquid level was about 
halfway up the columns.  The orifice has less of an   effect on frequency and is used mostly to balance 
the amount of damping versus the volume of liquid   that flows through each cycle. In my model, with 
one of the holes completely closed off, you can   see the water doesn’t move, and you get minimal 
damping.  With the tape mostly covering the hole,   you get the most frictional loss, but not all the 
fluid flows from one side to the other each cycle.   When I covered about half of one hole, I got the 
full fluid flow and the best damping performance. The benefit of a tuned column damper is that 
it doesn’t take up a lot of space. And because   the fluid movement is confined, they’re fairly 
predictable in behavior. So, these are used in   quite a few skyscrapers, including the Random 
House Tower in Manhattan, One Wall Center in   Vancouver (which actually has many walls), and 
Comcast Center in Philadelphia. But, tuned column   liquid dampers have a few downsides. One is that 
they really only work for flexible structures,   like my demo. Just like in a pendulum, the 
longer the flow path in a column damper,   the lower the frequency of the oscillation.  For stiffer buildings with higher natural frequencies,   tuning requires a very short liquid column, which 
limits the mass and damping capability to a point   where you don’t get much benefit. The other thing 
is that this is still kind of a complex device   with intricate shapes and a custom orifice between 
the two columns. So, we can get even simpler. This is my model tuned sloshing damper, and 
it’s about as simple as a damper can get.  I put a weight inside the empty tank to make a fair 
comparison, and we can put it side by side with   water in the tank to see how it works. As you 
can see, sloshing dampers dissipate energy by…   sloshing. Again, the water is both the mass 
and the damper.  If you tune it just right,   the sloshing happens perfectly out of phase 
of the motion of the building, reducing the   magnitude of the movement and acceleration. And 
you can see why this might be a little cheaper to   build - it’s basically just a swimming pool - four 
concrete walls, a floor, and some water. There’s   just not that much to it. But the simplicity 
of construction hides the complexity of design. Like a column damper, the frequency 
of a sloshing damper can be tuned,   first by the length of the tank. Just like 
fretting a guitar string further down the   neck makes the note lower, a tank works 
the same way. As the tank gets longer,   its sloshing frequency goes down. That makes 
sense - it takes longer for the wave to get   from one side to the other. But you can 
also adjust the depth. Waves move slower   in shallower water and faster in deeper water. 
Watch what happens when I overfill the tank. The initial wave starts on the left as the 
building goes right. It reaches the right   side just as the building starts 
moving left. That’s what we want;   it’s counteracting the motion. But then 
it makes it back to the left before the   building starts moving right. It’s actually 
kind of amplifying the motion, like pushing   a kid on a swing. Pretty soon after that, the 
wave and the building start moving in phase,   so there’s pretty much no damping at all. 
Compare it to the more properly tuned example   where most of the wave motion is counteracting 
the building motion as it sways back and forth. You can see in my demo that a lot of the energy 
dissipation comes from the breaking waves as   they crash against the sides of the tank. That 
is a pretty complicated phenomenon to predict,   and it’s highly dependent on how big the waves 
are. And even with the level pretty well tuned to   the frequency of the building, you can see there’s 
a lot of complexity in the motion with multiple   modes of waves, and not all of them acting against 
the motion of the building. So, instead of relying   on breaking waves, most sloshing dampers use flow 
obstructions like screens, columns, or baffles. I   got a few different options cut out of acrylic 
so we can try this out. These baffles add drag,   increasing the energy dissipation with the water, 
usually without changing the sloshing frequency. Here’s a side-by-side comparison of the 
performance without a baffle and with one.   You can see that the improvement is pretty 
dramatic. The motion is more controlled and   the behavior is more linear, making this much 
simpler to predict during the design phase.   It’s kind of the best of both worlds since you 
get damping from the sloshing and the drag of   the water passing through the screen. Almost 
all the motion is stopped in this demo after   only three oscillations. I was pretty impressed 
with this.  Here’s all three of the baffle runs side by side.   Actually, the one with the 
smallest holes worked the best in my demo,   but deciding the configuration of these baffles 
is a big challenge in the engineering of these   systems because you can’t really just 
test out a bunch of options at full scale. Devices like this are in service in quite a 
few high-rise buildings, including Princess   Tower in Dubai, and the Museum Tower in Dallas.  With no moving parts and very little maintenance   except occasionally topping it off to keep the 
water at the correct level, you can see how it   would be easy to choose a sloshing damper for 
a new high-rise project. But there are some   disadvantages. One is volumetric efficiency. 
You can see that not all the water in the tank   is mobilized, especially for smaller movements, 
which means not all the water is contributing to   the damping. The other is non-linearity. The 
amount of damping changes depending on the   magnitude of the movement since drag is related 
to velocity squared. And even the frequency of   the damper isn’t constant; it can change with the 
wave amplitude as well because of the breaking   waves. So you might get good performance at the 
design level, but not so much for slower winds. Dampers aren’t just used in buildings. Bridges 
also take advantage of these clever devices,   especially on the decks of pedestrian bridges and 
the towers of long-span bridges. This also happens   at a grand scale between the Earth and moon. 
Tidal bulges in the oceans created by the moon’s   tug on Earth dissipate energy through friction 
and turbulence, which is a big part of why our   planet’s rotation is slowing over time. Days used 
to be a lot shorter when the Earth was young,   but we have a planet-scale liquid damper 
constantly dissipating our rotational energy. But whether it’s bridges or buildings, these 
dampers usually don’t work perfectly right   at the start. Vibrations are complicated. They’re 
very hard to predict, even with modern tools like   simulation software and scale physical models. 
So, all dampers have to go through a commissioning   process. Usually this involves installing 
accelerometers once construction is nearing   completion to measure the structure’s actual 
natural frequency. The tuning of tuned dampers   doesn’t just happen during the design phase; you 
want some adjustability after construction to make   sure they match the structure’s natural frequency 
exactly so you get the most damping possible. For   liquid dampers, that means adjusting the 
levels in the tanks.  And in many cases,   buildings might use multiple dampers tuned to 
slightly different frequencies to improve the   performance over a range of conditions. Even in 
these two basic categories, there is a huge amount   of variability and a lot of ongoing research to 
minimize the tradeoffs these systems come with. The truth is that, relatively speaking, there 
aren’t that many of these systems in use around   the world. Each one is highly customized, and 
even putting them into categories can get a   little tricky. There are even actively controlled 
liquid dampers. My tuning for the column damper   works best for a single magnitude of motion, but 
you can see that once the swaying gets smaller,   the damper isn’t doing a lot to curb it. You can 
imagine if I constantly adjusted the size of the   orifice, I could get better performance 
over a broader range of unwanted motion.   You can do this electronically by having 
sensors feed into a control system that   adjusts a valve position in real-time. 
Active systems and just the flexibility   to tune a damper in general also help deal with 
changes over time. If a building’s use changes,   if new skyscrapers nearby change the wind 
conditions, or if it gets retrofits that   change its natural frequency, the damping 
system can easily accommodate those changes. In the end, a lot of engineering decisions 
come down to economics. In most cases,   damping is less about safety and more about 
comfort, which is often harder to pin down.   Engineers and building owners face a balancing act 
between the cost of supplemental damping and the   value of the space those systems take up. Tuned 
mass dampers are kind of household names when it   comes to damping. A few buildings like Shanghai 
Center and Taipei 101 have made them famous.   They’re usually the most space-efficient (since 
steel and concrete are more dense than water).   But they’re often more costly to install and 
maintain. Liquid dampers are the unsung heroes.   They take up more space, but they’re simple and 
cost-effective, especially if the fire codes   already require you to have a big tank of water 
at the top of your building anyway. Maybe someday,   an architect will build one out of glass or 
acrylic, add some blue dye and mica powder,   and put it on display as a public showcase. Until 
then, we’ll just have to know it’s there by feel. In the world of engineering, vibrations are a 
pretty niche topic. They have broad application,   but there are no tuned liquid damper questions on 
the licensing exams. Most of the research for this   video came not from engineering textbooks but from 
academic papers - researchers looking into really   specific questions. And when I read papers like 
that, I always wonder about the behind-the-scenes.   What mistakes were made, which co-author got 
upset with which grad student? My friend Kevin,   also known as Bobby Broccoli, recently 
released a full-length documentary about   a single paper that sparked a scandal so big 
it was called the 'Scientific Watergate.’   17 Pages dives deep into one of the most 
controversial science ethics cases of the   20th century. And if you want to check 
it out, it’s only available on Nebula. Nebula’s a streaming platform built by and for 
independent creators, including channels like   Strange Parts, Integza, Real Engineering, and 
Hacksmith Industries. You get early access,   no ads, and content that’s thoughtful and 
well-researched. Plus, Nebula’s got a lot   of really impressive original content that 
can’t be found anywhere else, like 17 Pages. If you want to give it a try, it’s basically 
a cup of coffee month. Watch 17 Pages and more   only on Nebula and if you use my link, 
go.nebula.tv/practical-engineering,   you’ll get 40% off—that’s just $36 a year or 
$3 a month. Scan the QR code or click the link   below to start watching now. Thank you for 
watching, and let me know what you think.

---

## 16. How Water Recycling Works
**Channel:** Practical Engineering | **Views:** 789K | **Date:** 7 months ago | **Duration:** 17:21 | **ID:** WhCNpX3s-D8
**Link:** https://youtube.com/watch?v=WhCNpX3s-D8

### Transcript:
Wichita Falls, Texas, went through the worst 
drought in its history in 2011 and 2012. For   two years in a row, the area saw its average 
annual rainfall roughly cut in half, decimating   the levels in the three reservoirs used for the 
city’s water supply. Looking ahead, the city   realized that if the hot, dry weather continued, 
they would be completely out of water by 2015.   Three years sounds like a long runway, but when 
it comes to major public infrastructure projects,   it might as well be overnight. Between 
permitting, funding, design, and construction,   three years barely gets you to the starting 
line. So the city started looking for other   options. And they realized there was one source of 
water nearby that was just being wasted - millions   of gallons per day just being flushed down the 
Wichita River. I’m sure   you can guess where I’m going with this. It was 
the effluent from their sewage treatment plant. The city asked the state regulators if they could 
try something that had never been done before at   such a scale: take the discharge pipe from the 
wastewater treatment plant and run it directly   into the purification plant that produces most of 
the city’s drinking water. And the state said no.   So they did some more research and testing 
and asked again. By then, the situation had   become an emergency. This time, the state said 
yes. And what happened next would completely   change the way cities think about water. 
I’m Grady and this is Practical Engineering. You know what they say, wastewater happens. 
It wasn’t that long ago that raw sewage was   simply routed into rivers, streams, or 
the ocean to be carried away. Thankfully,   environmental regulations put a stop to 
that, or at least significantly curbed   the amount of wastewater being set loose without 
treatment. Wastewater plants across the world do   a pretty good job of removing pollutants these 
days. In fact, I have a series of videos that   go through some of the major processes 
if you want to dive deeper after this.   In most places, the permits that allow these 
plants to discharge set strict limits on   contaminants like organics, suspended solids, 
nutrients, and bacteria. And in most cases,   they’re individualized. The permit limits 
are based on where the effluent will go,   how that water body is used, and how well it can 
tolerate added nutrients or pollutants. And here’s   where you start to see the issue with reusing 
that water: “clean enough” is a sliding scale. Depending on how water is going to be used 
or what or who it’s going to interact with,   our standards for cleanliness vary. If 
you have a dog, you probably know this.   They should drink clean water, but a few 
sips of a mud puddle in a dirty street,   and they’re usually just fine. For you, 
that might be a trip to the hospital.   Natural systems can tolerate a pretty wide range 
of water quality, but when it comes to drinking   water for humans, it should be VERY clean. So 
the easiest way to recycle treated wastewater   is to use it in ways that don’t involve 
people. That idea’s been around for a while. A lot of wastewater treatment plants apply 
effluent to land as a disposal method,   avoiding the need for discharge to a natural 
water body. Water soaks into the ground,   kind of like a giant septic system. But that 
comes with some challenges. It only works if   you’ve got a lot of land with no public 
access, and a way to keep the spray from   drifting into neighboring properties. Easy 
at a small scale, but for larger plants,   it just isn’t practical engineering. Plus, 
the only benefits a utility gets from the   effluent are some groundwater recharge and 
maybe a few hay harvests per season. So,   why not send the effluent to someone else 
who can actually put it to beneficial use? If only it were that simple. As soon as a utility 
starts supplying water to someone else, things get   complicated because you lose a lot of control over 
how the effluent is used. Once it's out of your   hands, so to speak, it’s a lot harder to make 
sure it doesn’t end up somewhere it shouldn’t,   like someone’s mouth. So, naturally, the 
permitting requirements become stricter.   Treatment processes get more complicated 
and expensive. You need regular monitoring,   sampling, and laboratory testing. In many 
places in the world, reclaimed water runs   in purple pipes so that someone doesn’t 
inadvertently connect to the lines thinking   they’re potable water. In many cases, you 
need an agreement in place with the end user,   making sure they’re putting up signs, fences, 
and other means of keeping people from drinking   the water. And then you need to plan for 
emergencies - what to do if a pipe breaks,   if the effluent quality falls below the standards, 
or if a cross-connection is made accidentally. It’s a lot of work - time, effort, and cost 
- to do it safely and follow the rules. And   those costs have to be weighed against 
the savings that reusing water creates.   In places that get a lot of rain or snow, it’s 
usually not worth it. But in many US states,   particularly those in the southwest, this is a 
major strategy to reduce the demand on fresh water   supplies. Think about all the things we use water 
for where its cleanliness isn’t that important.   Irrigation is a big one - crops, pastures, 
parks, highway landscaping, cemeteries - but   that’s not all. Power plants use huge amounts 
of water for cooling. Street sweeping, dust   control. In nearly the entire developed world, 
we use drinking-quality water to flush toilets! You can see where there might be cases where 
it makes good sense to reclaim wastewater,   and despite all the extra challenges, its use 
is fairly widespread. One of the first plants   was built in 1926 at Grand Canyon Village which 
supplied reclaimed water to a power plant and for   use in steam locomotives. Today, these systems can 
be massive, with miles and miles of purple pipes   run entirely separate from the freshwater piping. 
I’ve talked about this a bit on the channel   before. I used to live near a pair of water 
towers in San Antonio that were at two different   heights above ground. That just didn’t make any 
sense until I realized they weren’t connected;   one of them was for the reclaimed water system 
that didn’t need as much pressure in the lines.   Places like Phoenix, Austin, San Antonio, Orange 
County, Irvine, and Tampa all have major water   reclamation programs. And it’s not just a 
US thing. Abu Dhabi, Beijing, and Tel Aviv   all have infrastructure to make beneficial use of 
treated municipal wastewater, just to name a few. Because of the extra treatment and 
requirements, many places put reclaimed   water in categories based on how it gets 
used. The higher the risk of human contact,   the tighter the pollutant limits get. For example, 
if a utility is just selling effluent to farmers,   ranchers, or for use in construction, exposure 
to the public is minimal. Disinfecting the   effluent with UV or chlorine may be enough to 
meet requirements. And often that’s something   that can be added pretty simply to an existing 
plant. But many reclaimed water users are things   like golf courses, schoolyards, sports 
fields, and industrial cooling towers,   where people are more likely to be exposed. 
In those cases, you often need a sewage plant   specifically designed for the purpose or 
at least major upgrades to include what the   pros call tertiary treatment processes - ways to 
target pollutants we usually don’t worry about and   improve the removal rates of the ones we do. These 
can include filters to remove suspended solids,   chemicals that bind to nutrients, and stronger 
disinfection to more effectively kill pathogens. This creates a conundrum, though. In many cases, 
we treat wastewater effluent to higher standards   than we normally would in order to reclaim 
it, but only for nonpotable uses, with strict   regulations about human contact. But if it’s not 
being reclaimed, the quality standards are lower,   and we send it downstream. If you know how rivers 
work, you probably see the inconsistency here.   Because in many places, down the river, is 
the next city with its water purification   plant whose intakes, in effect, reclaim that 
treated sewage from the people upstream. This isn’t theoretical - it’s just the reality 
of how humans interact with the water cycle.   We’ve struggled with the problems it causes for 
ages. In 1906, Missouri sued Illinois in the   Supreme Court when Chicago reversed their 
river, redirecting its water (and all the   city’s sewage) toward the Mississippi River. If 
you live in Houston, I hate to break it to you,   but a big portion of your drinking water comes 
from the flushes and showers in Dallas. There   have been times when wastewater effluent makes 
up half of the flow in the Trinity River. But the question is: if they can do it, why 
can’t we? If our wastewater effluent is already   being reused by the city downstream to purify 
into drinking water, why can’t we just keep   the effluent for ourselves and do the same 
thing? And the answer again is complicated. It starts with what’s called an environmental 
buffer. Natural systems offer time to detect   failures, dilute contaminants, and even 
clean the water a bit—sunlight disinfects,   bacteria consume organic matter. That’s the big 
difference in one city, in effect, reclaiming   water from another upstream. There’s nature in 
between. So a lot of water reclamation systems,   called indirect potable reuse, do the same thing: 
you discharge the effluent into a river, lake,   or aquifer, then pull it out again later for 
purification into drinking water. By then,   it’s been diluted and treated 
somewhat by the natural systems. Direct potable reuse projects skip the buffer 
and pipe straight from one treatment plant   to the next. There’s no margin for error 
provided by the environmental buffer. So,   you have to engineer those same protections 
into the system: real-time monitoring,   alarms, automatic shutdowns, and 
redundant treatment processes. Then there’s the issue of contaminants of emerging 
concern: pharmaceuticals, PFAS [P-FAS], personal   care products - things that pass through people 
or households and end up in wastewater in tiny   amounts. Individually, they’re in parts per 
billion or trillion. But when you close the   loop and reuse water over and over, those 
trace compounds can accumulate. Many of these   aren’t regulated because they’ve never reached 
concentrations high enough to cause concern,   or there just isn’t enough knowledge about 
their effects yet. That’s slowly changing, and   it presents a big challenge for reuse projects. 
They can be dealt with at the source by regulating   consumer products, encouraging proper disposal 
of pharmaceuticals (instead of flushing them),   and imposing pretreatment requirements 
for industries. It can also happen at the   treatment plant with advanced technologies 
like reverse osmosis, activated carbon,   advanced oxidation, and bio-reactors that 
break down micro-contaminants. Either way,   it adds cost and complexity to 
a reuse program. But really,   the biggest problem with wastewater reuse 
isn’t technical - it’s psychological. The so-called “yuck factor” is real. People don’t 
want to drink sewage. Indirect reuse projects   have a big benefit here. With some nature in 
between, it’s not just treated wastewater;   it’s a natural source of water with 
treated wastewater in it. It’s kind   of a story we tell ourselves, but we lose 
the benefit of that with direct reuse:   Knowing your water came from a toilet—even 
if it’s been purified beyond drinking water   standards—makes people uneasy. You might 
not think about it, but turning the tap on,   putting that water in a glass, and taking a drink 
is an enormous act of trust. Most of us don’t   understand water treatment and how it happens 
at a city scale. So that trust that it’s safe   to drink largely comes from seeing other people do 
it and past experience of doing it over and over   and not getting sick. The issue is that, when 
you add one bit of knowledge to that relative   void of understanding - this water came directly 
from sewage - it throws that trust off balance.   It forces you not to rely not on past experience 
but on the people and processes in place,   most of which you don’t understand deeply, and 
generally none of which you can actually see.   It’s not as simple as just revulsion. 
It shakes up your entire belief system. And there’s no engineering fix for that. 
Especially for direct potable reuse,   public trust is critical. So on top of 
the infrastructure, these programs also   involve major public awareness campaigns. 
Utilities have to put themselves out there,   gather feedback, respond to questions, 
be empathetic to a community’s values,   and try to help people understand how we ensure 
water quality, no matter what the source is. But also, like I said, a lot of that trust 
comes from past experience. Not everyone can   be an environmental engineer or licensed treatment 
plant operator. And let’s be honest - utilities   can’t reach everyone. How many public meetings 
about water treatment have you ever attended? So,   in many places, that trust is just going 
to have to be built by doing it right,   doing it well, and doing it for a long 
time. But, someone has to be first. In the U.S., at least on the city scale, that 
drinking water guinea pig was Wichita Falls.   They launched a massive outreach campaign, invited 
experts for tours, and worked to build public   support. But at the end of the day, they didn’t 
really have a choice. The drought really was that   severe. They spent nearly four years under intense 
water restrictions. Usage dropped to a third of   normal demand, but it still wasn’t enough.
So, in collaboration with state regulators,   they designed an emergency direct potable reuse 
system. They literally helped write the rules as   they went, since no one had ever done it before. 
After two months of testing and verification,   they turned on the system in July 
2014. It made national headlines. The project ran for exactly one year. Then, in 
2015, a massive flood ended the drought and filled   the reservoirs in just three weeks. The emergency 
system was always meant to be temporary. Water   essentially went through three treatment plants: 
the wastewater plant, a reverse osmosis plant,   and then the regular water purification 
plant. That’s a lot of treatment,   which is a lot of expense, but they needed to have 
the failsafe and redundancy to get the state on   board with the project. The pipe connecting 
the two plants was above ground and later   repurposed for the city’s indirect potable 
reuse system, which is still in use today. In the end, they reclaimed nearly two billion 
gallons of wastewater as drinking water. And   they did it with 100% compliance with 
the standards. But more importantly,   they showed that it could be done, 
essentially unlocking a new branch   on the skill tree of engineering that 
other cities can emulate and build on. When I was studying in college, I think 
environmental engineering was one of the toughest   subjects I took. But it’s a field where you 
really get to be a jack of all trades, combining   chemistry, biology, public health, and hydraulics 
into solutions that meet fundamental human needs.   And you know what underlies all of it? It’s 
math. What I learned throughout my career as   an engineer was that mathematics isn’t important 
for what it lets you accomplish; it’s important   for what it lets you understand. Grasping the 
underlying math opens the door to an entire   world of practical tools, and today’s sponsor, 
Brilliant, makes bridging that gap effortless. Brilliant’s been sponsoring Practical 
Engineering videos for seven years now.   It’s the longest partnership I’ve had. 
And I think the biggest reason for that   is people watching this channel just keep 
finding value in learning new things in this   interactive way. That and they keep adding 
new lessons every month. The math courses   go from the basics all the way through 
calculus, linear algebra, and beyond. I love learning. I think one of the most 
important things you can do in life is to always   be broadening your horizons. We learn best not by 
reading or hearing but by doing, and that’s why I   love Brilliant. The lessons just stick better when 
you’re actually using the information while you   learn, and learning a little bit every day creates 
a habit that pays off in the long run. You can try   this completely free for 30 days and see if it’s 
something that can help you get ahead in your   career, get better at a hobby, or just enjoy the 
process of learning something new. If you love it,   you’ll get 20% off a premium subscription. 
Go to brilliant.org/PracticalEngineering,   scan the code, or just click the link in the 
description below. I really like their website   and their app and I think you will too. Thank 
you for watching, and let me know what you think.

---

## 17. Why are Smokestacks So Tall?
**Channel:** Practical Engineering | **Views:** 1.1M | **Date:** 8 months ago | **Duration:** 20:20 | **ID:** RnYdt4T76mk
**Link:** https://youtube.com/watch?v=RnYdt4T76mk

### Transcript:
That’s the first line of one 
of my favorite short stories,   written by Kurt Vonnegut in 1955. It paints 
a picture of a dystopian future that,   thankfully, didn’t really come to 
be, in part because of those stacks. In some ways, air pollution is kind of a part 
of life. I’d love to live in a world where the   systems, materials and processes that make my 
life possible didn’t come with any emissions,   but it’s just not the case... From 
the time that humans discovered fire,   we’ve been methodically calculating 
the benefits of warmth, comfort,   and cooking against the disadvantages of carbon 
monoxide exposure and particulate matter less   than 2.5 microns in diameter… Maybe not 
in that exact framework, but basically,   since the dawn of humanity, we’ve had 
to deal with smoke one way or another. Since, we can’t accomplish much without 
putting unwanted stuff into the air,   the next best thing is to manage how and 
where it happens to try and minimize its   impact on public health. Of course, any time you 
have a balancing act between technical issues,   the engineers get involved, not so much 
to help decide where to draw the line,   but to develop systems that can stay below 
it. And that’s where the smokestack comes   in. Its function probably seems obvious; you 
might have a chimney in your house that does   a similar job. But I want to give you a peek 
behind the curtain into the Illium Works of   the Federal Apparatus Corporation of today 
and show you what goes into engineering one   of these stacks at a large industrial facility. 
I’m Grady, and this is Practical Engineering. We put a lot of bad stuff in the air, and in a lot 
of different ways. There are roughly 200 regulated   hazardous air pollutants in the United States, 
many with names I can barely pronounce. In many   cases, the industries that would release these 
contaminants are required to deal with them at the   source. A wide range of control technologies are 
put into place to clean dangerous pollutants from   the air before it’s released into the environment. 
One example is coal-fired power plants. Coal,   in particular, releases a plethora of pollutants 
when combusted, so, in many countries,   modern plants are required to install control 
systems. Catalytic reactors remove nitrous oxides.   Electrostatic precipitators collect particulates. 
Scrubbers use lime (the mineral, not the fruit) to   strip away sulfur dioxide. And I could go on. In 
some cases, emission control systems can represent   a significant proportion of the costs involved in 
building and operating a plant. But these primary   emission controls aren’t always feasible for every 
pollutant, at least not for 100 percent removal. There’s a very old saying that “the solution to 
pollution is dilution.” It’s not really true on   a global scale. Case in point: There’s no 
way to dilute the concentration of carbon   dioxide in the atmosphere, or rather, it’s 
already as dilute as it’s going to get. But,   it can be true on a local scale. Many pollutants 
that affect human health and the environment are   short-lived; they chemically react or 
decompose in the atmosphere over time   instead of accumulating indefinitely. And, for 
a lot of chemicals, there are concentration   thresholds below which the consequences on human 
health are negligible. In those cases, dilution,   or really dispersion, is a sound strategy to 
reduce their negative impacts, and so, in some   cases, that’s what we do, particularly at major 
point sources like factories and power plants. One of the tricks to dispersion is that many 
plumes are naturally buoyant. Naturally,   I’m going to use my pizza oven to demonstrate 
this.  Not all, but most pollutants we care about   are a result of combustion; burning stuff up. So 
the plume is usually hot. We know hot air is less   dense, so it naturally rises. And the hotter 
it is, the faster that happens. You can see   when I first start the fire, there’s not much air 
movement. But as the fire gets hotter in the oven,   the plume speeds up, ultimately rising 
higher into the air.  That’s the whole goal:   get the plume high above populated areas 
where the pollutants can be dispersed to a   minimally-harmful concentration. It sounds like 
a simple solution - just run our boilers and   furnaces super hot to get enough buoyancy 
for the combustion products to disperse. The problem with the solution is that the whole 
reason we combust things is usually to recover the   heat. So if you’re sending a lot of that heat 
out of the system, just because it makes the   plume disperse better, you’re losing thermodynamic 
efficiency. It’s wasteful. That’s where the stack   comes in. Let me put mine on and show you what I 
mean. I took some readings with the anemometers   with the stack on and off. The airspeed with 
the stack on was around double with it off.   About a meter per second compared with two. 
But it’s a little tougher to understand why. It’s intuitive that as you move higher in 
a column of fluid, the pressure goes down   (since there’s less weight of the fluid 
above). The deeper you dive in a pool,   the more pressure you feel. The higher 
you fly in a plane or climb a mountain,   the lower the pressure. The slope of that line 
is proportional to a fluid’s density. You don’t   feel much of a pressure difference climbing a 
set of stairs because air isn’t very dense. If   you travel the same distance in water, you’ll 
definitely notice the difference. So let’s look   at two columns of fluid. One is the ambient 
air and the other is the air inside a stack.   Since it’s hotter, the air inside the stack 
is less dense. Both columns start at the same   pressure at the bottom, but the higher 
you go, the more the pressure diverges. It’s kind of like deep sea diving in reverse. In 
water, the deeper you go into the dense water,   the greater the pressure you feel. In a stack, 
the higher you are in a column of hot air,   the more buoyant you feel compared to 
the outside air. This is the genius of   a smoke stack. It creates this difference in 
pressure between the inside and outside that   drives greater airflow for a given temperature.  Here’s the basic equation for a stack effect.   I like to look at equations like this divided 
into what we can control and what we can’t. We   don’t get to adjust the atmospheric 
pressure, the outside temperature,   and this is just a constant. But you can 
see, with a stack, an engineer now has   two knobs to turn: the temperature of the 
gas inside and the height of the stack. I did my best to keep the temperature constant 
in my pizza oven and took some airspeed readings.   First with no stack. Then with the stock 
stack. Then with a megastack. By the way,   this melted my anemometer; should have seen 
that coming. Thankfully, I got the measurements   before it melted. My megastack nearly doubled 
the airspeed again at around three-and-a-half   meters per second versus the two with just the 
stack that came with the oven. There’s something   really satisfying about this stack effect to me. 
No moving parts or fancy machinery. Just put a   longer pipe and you’ve fundamentally changed 
the physics of the whole situation. And it’s   a really important tool in the environmental 
engineer’s toolbox to increase airflow upward,   allowing contaminants to flow higher into 
the atmosphere where they can disperse. But   this is not particularly revolutionary… unless 
you’re talking about the Industrial Revolution. When you look at all the pictures of the factories 
in the 19th century, those stacks weren’t there   to improve air quality, if you can believe it. 
The increased airflow generated by a stack just   created more efficient combustion for the boilers 
and furnaces. Any benefits to air quality in the   cities were secondary. With the advent of diesel 
and electric motors, we could use forced drafts,   reducing the need for a tall stack to 
increase airflow. That was kind of the   decline of the forests of industrial chimneys 
that marked the landscape in the 19th century.   But they’re obviously not all gone, because 
that secondary benefit of air quality turned   into the primary benefit as environmental 
rules about air pollution became stricter. Of course, there are some practical limits that 
aren’t taken into account by that equation I   showed. The plume cools down as it moves up 
the stack to the outside, so its density isn’t   constant all the way up. I let my fire die down a 
bit so it wouldn’t melt the thermometer (learned   my lesson), and then took readings inside the 
oven and at the top of the stack. You can see   my pizza oven flue gas is around 210 degrees at 
the top of the mega-stack, but it’s roughly 250   inside the oven. After the success of the mega 
stack on my pizza oven, I tried the super-mega   stack with not much improvement in airflow: 
about 4 meters per second. The warm air just   got too cool by the time it reached the top. 
And I suspect that frictional drag in the   longer pipe also contributed to that as well. So, 
really, depending on how insulating your stack is,   our graph of height versus pressure actually 
ends up looking like this. And this can be its   own engineering challenge. Maybe you’ve 
gotten back drafts in your fireplace at   home because the fire wasn’t big or hot enough 
to create that large difference in pressure. You can see there are a lot of factors at play 
in designing these structures, but so far,   all we’ve done is get the air moving faster. But 
that’s not the end goal. The purpose is to reduce   the concentration of pollutants that we’re exposed 
to. So engineers also have to consider what   happens to the plume once it leaves the stack, 
and that’s where things really get complicated. In the US, we have National Ambient Air Quality 
Standards that regulate six so-called “criteria”   pollutants that are relatively widespread: 
carbon monoxide, lead, nitrogen dioxide,   ozone, particulates, and sulfur dioxide. We 
have hard limits on all these compounds with the   intention that they are met at all times, in all 
locations, under all conditions. Unfortunately,   that’s not always the case. You can go on 
EPA’s website and look at the so-called   “non-attainment” areas for the various pollutants. 
But we do strive to meet the standards through a   list of measures that is too long to go into 
here. And that is not an easy thing to do. Not every source of pollution comes out of a big 
stationary smokestack where it’s easy to measure   and control. Cars, buses, planes, trucks, trains, 
and even rockets create lots of contaminants that   vary by location, season, and time of day. And 
there are natural processes that contribute   as well. Forests and soil microbes release 
volatile organic compounds that can lead to   ozone formation. Volcanic eruptions and wildfires 
release carbon monoxide and sulfur dioxide. Even   dust storms put particulates in the air that 
can travel across continents. And hopefully   you’re seeing the challenge of designing a smoke 
stack. The primary controls like scrubbers and   precipitators get most of the pollutants out, and 
hopefully all of the ones that can’t be dispersed.   But what’s left over and released has to avoid 
pushing concentrations above the standards.   That design has to work within the very 
complicated and varying context of air   chemistry and atmospheric conditions 
that a designer has no control over. Let me show you a demo. I have a little fog 
generator set up in my garage with a small   fan simulating the wind. This isn’t a great 
example because the airflow from the fan is   pretty turbulent compared to natural winds. 
You occasionally get some fog at the surface,   but you can see my plume mainly stays above the 
surface, dispersing as it moves with the wind.   But watch what happens when I put a building 
downstream. The structure changes the airflow,   creating a downwash effect and pulling my plume 
with it. Much more frequently you see the fog   at the ground level downstream. And this 
is just a tiny example of how complex the   behavior of these plumes can be. Luckily, there’s 
a whole field of engineering to characterize it. There are really just two major transport 
processes for air pollution. Advection describes   how contaminants are carried along by the wind. 
Diffusion describes how those contaminants spread   out through turbulence. Gravity also affects 
air pollution, but it doesn’t have a significant   effect except on heavier-than-air particulates. 
With some math and simplifications of those two   processes, you can do a reasonable job predicting 
the concentration of any pollutant at any point   in space as it moves and disperses through 
the air. Here’s the basic equation for that,   and if you’ll join me for the next 2 hours, 
we’ll derive this and learn the meaning of   each term… Actually, it might take longer 
than that, so let’s just look at a graphic.   You can see that as the plume gets carried along 
by the wind, it spreads out in what’s basically a   bell curve, or gaussian distribution, in the 
planes perpendicular to the wind direction. But even that is a bit too simplified 
to make any good decisions with,   especially when the consequences of getting it 
wrong are to public health. A big reason for   that is atmospheric stability. And this 
can make things even more complicated,   but I want to explain the basics, because 
the effect on plumes of gas can be really   dramatic. You probably know that air expands as 
it moves upward; there’s less pressure as you go   up because there is less air above you. And as 
any gas expands, it cools down. So there’s this   relationship between height and temperature 
we call the adiabatic lapse rate. It’s about   10 degrees Celsius for every kilometer up 
or about 28 Fahrenheit for every mile up.   But the actual atmosphere doesn’t always follow 
this relationship. For example, rising air parcels   can cool more slowly than the surrounding 
air. This makes them warmer and less dense,   so they keep rising, promoting vertical motion 
in a positive feedback loop called atmospheric   instability. You can even get a temperature 
inversion where you have cooler air below warmer   air, something that can happen in the early 
morning when the ground is cold. And as the   environmental lapse rate varies from the adiabatic 
lapse rate, the plumes from stacks change. In stable conditions, you usually get 
a coning plume, similar to what our   gaussian distribution from before predicts. In 
unstable conditions, you get a lot of mixing,   which leads to a looping plume. And things really 
get weird for temperature inversions because they   basically act like lids for vertical movement. 
You can get a fanning plume that rises to a point,   but then only spreads horizontally. 
You can also get a trapping plume,   where the air gets stuck between two inversions. 
You can have a lofting plume, where the air is   above the inversion with stable conditions below 
and unstable conditions above. And worst of all,   you can have a fumigating plume when there are 
unstable conditions below an inversion, trapping   and mixing the plume toward the ground surface. 
And if you pay attention to smokestacks, fires,   and other types of emissions, you can identify 
these different types of plumes pretty easily. Hopefully you’re seeing now how much goes 
into this. Engineers have to keep track of   the advection and diffusion, wind speed 
and direction, atmospheric stability,   the effects of terrain and buildings on all those 
factors, plus the pre-existing concentrations of   all the criteria pollutants from other 
sources, which vary in time and place.   All that to demonstrate that your new source 
of air pollution is not going to push the   concentrations at any place, at any time, under 
any conditions, beyond what the standards allow.   That’s a tall order, even for someone who loves 
gaussian distributions. And often the answer to   that tall order is an even taller smokestack. 
But to make sure, we use software. The EPA   has developed models that can take all these 
factors into account to simulate, essentially,   what would happen if you put a new source of 
pollution into the world and at what height. So why are smokestacks so tall? I hope you’ll 
agree with me that it turns out to be a pretty   complicated question. And it’s important, 
right? These stacks are expensive to build   and maintain. Those costs trickle down to 
us through the costs of the products and   services we buy. They have a generally negative 
visual impact on the landscape. And they have a   lot of other engineering challenges too, like 
resonance in the wind. And on the other hand,   we have public health, arguably one of the most 
critical design criteria that can exist for an   engineer. It’s really important to get this right. 
I think our air quality regulations do a lot to   make sure we strike a good balance here. There are 
even rules limiting how much credit you can get   for building a stack higher for greater dispersion 
to make sure that we’re not using excessively   tall stacks in lieu of more effective, but often 
more expensive, emission controls and strategies. In a perfect world, none of the materials or 
industrial processes that we rely on would   generate concentrated plumes of hazardous 
gases. We don’t live in that perfect world,   but we are pretty fortunate that, at least in 
many places on Earth, air quality is something   we don’t have to think too much about. And to 
thank for it, we have a relatively small industry   of environmental professionals who do think about 
it, a whole lot. You know, for a lot of people,   this is their whole career; what they ponder from 
9-5 every day. Something most of us would rather   keep out of mind, they face it head-on, developing 
engineering theories, professional consensus,   sensible regulations, modeling software, 
and more - just so we can breathe easy. The engineering of air quality rests 
on a huge body of scientific work,   measurements, modeling, and simulations 
we can use to make important decisions   that affect human health. One of my 
favorite creators, BobbyBroccoli,   just released an hour-and-a-half long documentary 
on the Baltimore Affair, a scandal that took the   scientific world by storm in the 1980s 
and 90s. It is a fascinating, polarizing,   and complex story that is told so beautifully 
through incredible graphics. I was blown away that   the story isn’t more well known. And if you want 
to check it out, it’s only available on Nebula. It’s a streaming service built by and 
for independent creators, including a   lot of my favorites like BobbyBroccoli, 
Wendover Productions, the Coding Train,   and Branch Education. I don’t know about 
you, but independently-produced content   is most of what I watch these days. I just 
like the authenticity and thoughtfulness of   videos that haven’t been through ten levels of 
studio executives watering the information down   to capture the widest audience possible. 
I just think passionate individuals and   small teams make the most compelling work, 
and Nebula is the perfect place for it. Nebula’s totally ad-free, with tons of 
excellent channels and lots of original series   and specials like the 17 Pages documentary 
by Bobby Broccoli. It’s also a great gift,   especially because a yearly membership is 40% 
off at the link in the description. It’s a pretty   cheap deal, even if you just want to avoid 
ads while watching your favorite creators.   My videos go live on Nebula before they 
come out on YouTube. If you’re with me that   independent creators are the future of great 
video, I hope you’ll give it a try. That’s   go.nebula.tv/Practical-Engineering. Thank you 
for watching, and let me know what you think!

---

## 18. The Most Implausible Tunneling Method
**Channel:** Practical Engineering | **Views:** 2.2M | **Date:** 8 months ago | **Duration:** 15:32 | **ID:** jPJCYrxqyT8
**Link:** https://youtube.com/watch?v=jPJCYrxqyT8

### Transcript:
The original plan to get I-95 over the 
Baltimore Harbor was a double-deck bridge   from Fort McHenry to Lazaretto Point. 
The problem with the plan was this:   the bridge would have to be extremely high so that 
large ships could pass underneath, dwarfing and   overshadowing one of the US’s most important 
historical landmarks. Fort McHenry famously   repelled a massive barrage and attack from the 
British Navy in the War of 1812, and inspired   what would later become the national anthem. An 
ugly bridge would detract from its character,   and a beautiful one would compete for it. So 
they took the high road by building a low road   and decided to go underneath the harbor instead. 
Rather than bore a tunnel through the soil and   rock below like the Channel Tunnel, the entire 
thing was prefabricated in sections and installed   from the water surface above - a construction 
technique called immersed tube tunneling. This seems kind of simple at first, but the 
more you think about it, the more you realize   how complicated it actually is to fabricate 
tunnel sections the length of a city block,   move them into place, and attach them 
together so watertight and safe that,   eventually, you can drive or take a train 
from one side to the other. Immersed tube   construction makes tunneling less like drilling 
a hole and more like docking a spacecraft.   Materials and practices vary across the 
world, but I want to try and show you,   at least in a general sense, how this works. 
I’m Grady, and this is Practical Engineering. One of the big problems with bridges 
over navigable waterways is that they   have to be so tall. Building high 
up isn’t necessarily the challenge;   it’s getting up and back down. There are limits 
to how steep a road can be for comfort, safety,   and efficiency, and railroads usually have even 
stricter constraints on grade.  That means the  approaches to high bridges have to be really long, increasing costs and, in dense cities,  taking up more valuable space. This is one of the ways 
that building a tunnel can be a better option;   They greatly reduce the amount of land 
at the surface needed for approaches.   But traditional tunnels built using boring have 
to be installed somewhat deep into the ground,   maintaining significant earth between the roof 
of the tunnel and the water for stability and   safety. Since they’re installed from above, 
immersed tube tunnels don’t have the same   problem. It’s basically a way to get the shortest 
tunnel possible for a given location, which often   means the cheapest tunnel too. That’s a big deal, 
because tunnels are just about the most expensive   way to get from point A to point B. Anything 
you can do to reduce their size goes a long way. And there are other advantages too. 
Tunnel boring machines make one shape:   a circle. It’s not the best shape for a tunnel, 
in a lot of ways. Often there’s underutilized   space at the top and bottom - excavation you 
had to perform because of the machinery that is   mostly just a waste. Immersed tubes can be just 
about any shape you need, making them ideal for   wider tunnels like combined road and rail routes 
where a circular cross-section isn’t a good fit. One of the other benefits of immersed tubes 
is that most of the construction happens on   dry land. I probably don’t have to say this, but 
building stuff while underground or underwater   is complex and difficult work. It requires 
specialty equipment, added safety measures,   and a lot of extra expense. Immersed tube sections 
are built in dry docks or at a shipyard where it's   much easier to deliver materials and accomplish 
the bulk of the actual construction work. Once tunnel sections are fabricated, they 
have to be moved into place, and I think   this is pretty clever. These sections can be 
enormous - upwards of 650 feet or 200 meters   long. But they’re still mostly air. So if you put 
a bulkhead on either side to trap that air inside,   they float. You can just flood the 
dry dock, hook up some tugboats,   and tow them out like a massive barge. 
Interestingly, the transportation method means   that the tunnel segments have to be designed 
to work as a watercraft first. The weight,   buoyancy, and balance of each section are 
engineered to keep them stable in the water   and avoid tipping or rolling before 
they have to be stable as a structure. Once in place, a tunnel segment is handed over to 
the apparatus that will set it into place. In most   cases, this is a catamaran-style behemoth called 
a lay barge. Two working platforms are connected   by girders, creating a huge floating gantry 
crane. Internal tanks are filled with water   to act as ballast, allowing the segment to sink. 
But when it gets to the bottom, it doesn’t just   sit on the sea or channel floor below. And this 
is another benefit of immersed tube construction. Especially in navigable waterways, you need to 
protect a tunnel from damage from strong currents,   curious sea life, and ship anchors. So most 
immersed tube tunnels sit in a shallow trench,   excavated using a clamshell or suction 
dredger. Most waterways have a thick   layer of soft sediment at the surface - not 
exactly ideal as a foundation. This is another   reason most boring machines have to be in deeper 
material. Drilling through soft sediment is prone   to problems. Imagine using a power drill to 
make a nice, clean hole through pudding. But,   at least in part due to being full of buoyant 
air, immersed tubes aren’t that heavy; in fact,   in most cases, they’re lighter than the soil 
that was there in the first place, so the soft   sediment really isn’t a problem. You don’t 
need a complicated foundation.  In many cases,  it’s just a layer of rock or gravel placed at the 
bottom of the trench, usually using a fall pipe   (like a big garden hose for gravel) to control 
the location. This layer is then carefully leveled   using a steel screed that is dragged over the top 
like an underwater bulldozer. Even in deep water,   the process can achieve a remarkably accurate 
surface level for the tunnel segments to rest on. The lowering process is the most delicate and 
important part of construction. The margins are   tight because any type of misalignment may make 
it impossible for the segment to seal against its   neighbor. Normally, you’d really want to take your 
time with this kind of thing, but here, the work   usually has to happen in a narrow window to avoid 
weather, tides, and disruption to ship traffic.   The tunnel section is fitted with rubber seals 
around its face, creating a gasket. Sometimes,   the segment will also have a surveying tower 
that pokes above the water surface, allowing for   measurements and fine adjustments to be made as 
it’s set into place. In some cases, the lowering   equipment can also nudge the segment against its 
neighbor. In other cases, hydraulic jacks are used   to pull the segments together. Divers or remotely 
operated submersibles can hook up the jacks.   Or couplers, just like those used on freight 
trains, can do it without any manual underwater   intervention. The jacks extend to couple the free 
segment to the one already installed, then retract   to pull them together, compressing the gasket 
and sealing the area between the two bulkheads. This joint is the most important part 
of an immersed tunnel design. It has   to be installed blindly and accommodate small 
movements from temperature changes, settlement,   and changes in pressure as water levels go up 
and down. The gasket provides the initial seal,   but there’s more to it. Once in place, valves 
are opened in the bulkheads to drain the water   between them. That actually creates a massive 
pressure difference between one side of the   segment and the other. Hydrostatic force from 
the water pushes against the end of the tunnel,   putting it in even firmer contact with 
its neighbor and creating a stronger   seal. Once in its final place, 
the segment can be backfilled. The tunnel segment connection is not 
like a pipe flange, where the joints   are securely bolted together, completely 
restraining any movement. The joints on   immersed tunnels have some freedom to 
move. Of course, there is a restraint   for axial compression since the segments 
butt up against each other. In addition,   keys or dowels are usually installed along the 
joint so that shear forces can transfer between   segments, keeping the ends from shifting during 
settlement or small sideways movements. However,   the joints aren’t designed to transfer torque, 
called moments. And there’s rarely much mechanical   restraint to axial tension that might pull 
one joint away from the other. So you can see   why the backfill is so important. It locks 
each segment into place. In fact, the first   layer of backfill is called locking fill for that 
exact reason. I don’t think they make underwater   roller compactors, and you wouldn’t want strong 
vibrations disturbing the placement of the tunnel   segments anyway. So this material is made from 
angular rock that self-compacts and is placed   using fall pipes in careful layers to secure 
each segment without shifting or disturbing it. After that, general backfill - maybe even the 
original material if it wasn’t contaminated - can   be used in the rest of the trench, and then a 
layer is placed over the top of everything to   protect the backfill and tunnel against currents 
caused by ships and tides. Sometimes this top   layer includes bands of large rock meant 
to release a ship’s anchor from the bottom,   keeping it from digging in 
and damaging the tunnel. Once a tunnel segment is secured in place, the 
bulkhead in the previous segment can be removed   from the inside, allowing access inside 
the joint. The usual requirement is that   access is only allowed when there are two or more 
bulkheads between workers and the water outside. A   second seal, called an omega seal (because of its 
shape), then gets installed around the perimeter   of the joint. And the process keeps going, adding 
segments to the tunnel until it’s a continuous,   open path from one end to the other. 
When it reaches that point, all the   other normal tunnel stuff can be installed, 
like roadways, railways, lights, ventilation,   drainage, and pumps. By the time it’s ready to 
travel through, there’s really no obvious sign   from inside that immersed tube tunnels are any 
different than those built using other methods. This is a simplification, of course. Every 
one of these steps is immensely complicated,   unique to each jobsite, and can take weeks 
to months, to even years to complete. And as   impressive as the process is, it’s not without 
its downsides. The biggest one is damage to the   sea or river floor during construction. Where 
boring causes little disturbance at the surface,   immersed tube construction requires a 
lot of dredging. That can disrupt and   damage important habitat for wildlife. It also 
kicks up a lot of sediment into suspension,   clouding the water and potentially releasing 
buried contaminants that were laid down back   when environmental laws were less strict. Some of 
these impacts can be mitigated: Sealed clamshell   buckets reduce turbidity and mobilization 
of contaminated sediment. And construction   activities can be scheduled to avoid sensitive 
periods like migration of important species. But   some level of disturbance is inevitable and has 
to be weighed against the benefits of the project. Despite the challenges, around 150 of these 
tunnels have been built around the globe.   Some of the most famous include the 
Øresund Link between Denmark and Sweden,   the Busan-Geoje tunnel in South Korea, the 
Marmaray tunnel crossing the Bosphorus in Turkey,   of course, the Fort McHenry tunnel 
in Baltimore I mentioned earlier,   and the BART Transbay Tube between Oakland and 
San Francisco. And some of the most impressive   projects are under construction now, including 
the Fehmarn Belt between Denmark and Germany,   which will be the world’s longest immersed 
tunnel. My friend Fred produced a really nice   documentary about that project on The B1M 
channel if you want to learn more about it,   and the project team graciously shared a lot 
of very cool clips used in this video too. There’s something about immersed tube tunnels 
that I can’t quite get over. At a glance,   it’s dead simple - basically like assembling 
lego blocks. But the reality is that the process   is so complicated and intricate, more akin to 
building a moon base. Giant concrete and steel   segments floated like ships, carefully sunk 
into enormous trenches, precisely maneuvered   for a perfect fit while completely submerged 
in sometimes high-traffic areas of the sea,   with tides, currents, wildlife, and any number 
of unexpected marine issues that could pop up.   And then you just drive through it like it’s 
any old section of highway. I love that stuff. One of the coolest parts of engineering is using 
our understanding of math and physics to execute   an idea that’s never been tried before. You see 
that a lot in these immersed tube tunnels - there   aren’t that many of them in the world, and each 
one is fairly customized. The joint design is a   great example. It’s restrained in some ways and 
free to move in others. Without some intuition   on how structures behave, that might seem 
counterintuitive, even with an explanation. But   there’s a very cool way to gain intuition about 
math, science, and engineering, and that’s Brilliant. Brilliant’s been sponsoring Practical Engineering 
videos for seven years now. It’s the longest   partnership I’ve had. And I think the biggest 
reason for that is people watching this channel   just keep finding value in learning new things in 
this interactive way. That and they keep adding   new lessons every month. This course on scientific 
thinking has a module all about static structures   and degrees of freedom that helps explain 
why a lot of structures look the way they do. I love learning. I think one of the most 
important things you can do in life is to always   be broadening your horizons. We learn best not by 
reading or hearing but by doing, and that’s why I   love Brilliant. The lessons just stick better when 
you’re actually using the information while you   learn, and learning a little bit every day creates 
a habit that pays off in the long run. You can try   this completely free for 30 days and see if it’s 
something that can help you get ahead in your   career, get better at a hobby, or just enjoy the 
process of learning something new. If you love it,   you’ll get 20% off a premium subscription. 
Go to brilliant.org/PracticalEngineering,   scan the code, or just click the link in the 
description below. I really like their website   and their app and I think you will too. Thank 
you for watching, and let me know what you think.

---

## 19. When Abandoned Mines Collapse
**Channel:** Practical Engineering | **Views:** 2.5M | **Date:** 9 months ago | **Duration:** 17:33 | **ID:** RZg1zOKm5wk
**Link:** https://youtube.com/watch?v=RZg1zOKm5wk

### Transcript:
In December of 2024, a huge sinkhole opened 
up on I-80 near Wharton, New Jersey, creating   massive traffic delays as crews worked to figure 
out what happened and get it fixed. Since then,   it happened again in February 2025 
and then again in March. Each time,   the highway had to be shut down, creating 
a nightmare for commuters who had to find   alternate routes. And it’s a nightmare for the 
DOT, too, trying to make sure this highway is safe   to drive on despite it literally collapsing 
into the earth. From what we know so far,   this is not a natural phenomenon, but one that’s 
human-made. It looks like all these issues were   set in motion more than a century ago when the 
area had numerous underground iron mines. This   is a really complex issue that causes problems 
around the world, and I built a little model   mine in my garage to show you why it’s such a big 
deal. I’m Grady and this is Practical Engineering. We’ve been extracting material and minerals 
from the earth since way before anyone was   writing things down. It’s probably safe to say 
that things started at the surface. You notice   something shiny or differently colored on the 
side of a hill or cliff and you take it out.   Over time, we built up knowledge about what 
materials were valuable, where they existed,   and how to efficiently extract them from the 
earth. But, of course, there’s only so much   earth at the surface. Eventually, you have to 
start digging. Maybe you follow a vein of gold,   silver, copper, coal or sulfur down below the 
surface. And things start to get more complicated   because now you’re in a hole. And holes are kind 
of dangerous. They’re dark, they fill with water,   they can collapse, and they collect dangerous 
gases. So, in many cases, even today,   it makes sense to remove the overburden - the 
soil and rock above the mineral or material   you’re after. Mining on the surface has a lot 
of advantages when it comes to cost and safety. But there are situations where 
surface mining isn’t practical.   Removing overburden is expensive, and it 
gets more expensive the deeper you go.   It also has environmental impacts like 
habitat destruction and pollution of air   and water. So, as technology, safety, and our 
understanding of soil and rock mechanics grew,   so did our ability to go straight to the 
source and extract minerals underground. One of the major materials that drove the move 
to underground mining was coal. It’s usually   found in horizontal formations called seams, that 
formed when vast volumes of paleozoic plants were   buried and then crushed and heated over geologic 
time. At the start of the Industrial Revolution,   coal quickly became a primary source of 
energy for steam engines, steel refining,   and electricity generation. Those 
coal seams vary in thickness,   and they vary in depth below the surface too, 
so many early coal mines were underground. In the early days of underground mining, 
there was not a lot of foresight. Some   might argue that’s still true, but it was a 
lot more so a couple hundred years ago. Coal   mining companies weren’t creating detailed 
maps of their mines, and even if they did,   there was no central archive to send them 
to. And they just weren’t that concerned   about the long-term stability of the mines 
once the resources had been extracted. All   that mattered was getting coal out of the 
ground. Mining companies came and went,   dissolved or were acquired, and over time, a 
lot of information about where mines existed   and their condition was just lost. And even 
though many mines were in rural areas, far away   from major population centers, some weren’t, 
and some of those rural areas became major   population centers without any knowledge about 
what had happened underneath them decades ago. An issue that confounds the problem of 
mine subsidence is that in a lot of places,   property ownership is split into two pieces: 
surface rights and mineral rights. And those   rights can be owned by different people. So 
if you’re a homeowner, you may own the surface   rights to your land, while a company owns the 
right to drill or mine under your property.   That doesn’t give them the right to damage 
your property, but it does make things more   complicated since you don’t always have a 
say in what’s happening beneath the surface. There are myriad ways to build and operate 
underground mines, but especially for soft   rock mining, like coal, the predominant method 
for decades was called “room and pillar”. This is   exactly what it sounds like. You excavate the ore, 
bringing material to the surface. But you leave   columns to support the roof. The size, shape, and 
spacing of columns are dictated by the strength of   the material. This is really important because a 
mine like this has major fixed costs: exploration,   planning, access, ventilation, and haulage. 
It’s important to extract as much as possible,   and every column you leave supporting the roof 
is valuable material you can’t recover. So,   there’s often not a lot of margin in 
these pillars. They’re as small as   the company thought they could get away 
with before they were finished mining. I built a little room and pillar mine in my 
garage.   I’ll be the first to admit that this  little model is not a rigorous reproduction of 
an actual geologic formation. My coal seam is   just made of cardboard, and the bright colors 
are just for fun. But, I’m hoping this can help   illustrate the challenges associated with this 
type of mine. I’ve got a little rainfall simulator set 
up, because water plays a big role in these processes.  This first rainfall isn’t 
necessarily representative of real life,   since it’s really just compacting the loose sand. 
But it does give a nice image of how subsidence   works in general. You can see the surface of the 
ground sinking as the sand compacts into place. But you can also see that as the water reaches 
the mine, things start to deform. In a real mine,   this is true, too. Stresses in 
the surrounding soil and rock   redistribute over time from long-term 
movements, relaxation of stresses that   were already built up in the materials before 
extraction, and from water.  I ran this model for an entire day, turning 
the rainfall on and off to simulate a somewhat   natural progression of time in the subsurface. 
By the end of the day, the mine hadn’t collapsed,   but it was looking a great deal less stable than 
when it started. And that’s one big thing you can   learn from this model - in a lot of cases, these 
issues aren’t linearly progressive. They can   happen in fits and starts, like this small leak 
in the roof of the mine. You get a little bit of   erosion of soil, but eventually, enough sand 
built up that it kind of healed itself, and,   for a while, you can’t see any evidence 
of any of it at the surface. The geology   essentially absorbed the sinkhole by 
redistributing materials and stresses   so there’s no obvious sign at the surface 
that anything wayward is happening below. In the US, there were very few regulations 
on mining until the late 19th century,   and even those focused primarily on 
safety of the workers. There just wasn’t that   much concern about long-term stability. 
So as soon as material was extracted,   mines were abandoned. The already 
iffy columns were just left alone,   and no one wasted resources on additional 
supports or shoring. They just walked away. One thing that happens when mines are abandoned is 
that they flood. Without the need to work inside,   the companies stop pumping out the water. I can 
simulate this on my model by just plugging up   the drain. In a real soft rock mine, there can 
be minerals like gypsum and limestone that are   soluble in water. Repeated cycles of drying and 
wetting can slowly dissolve them away. Water can   also soften certain materials and soils, reducing 
their mechanical strength to withstand heavy   loads, just like my cardboard model. And then, 
of course, water simply causes erosion. It can   literally carry soil particles with it, again, 
causing voids and redistribution of stresses   in the subsurface. This is footage from an old 
video I did demonstrating how sinkholes can form. The ways that mine subsidence propagates to the 
surface can vary a lot, based on the geology and   depth of the mine. For collapses near the surface, 
you often see well-defined sinkholes where the   soil directly above the mine simply falls into the 
void. And this is usually a sudden phenomenon. I   flooded and drained my little mine a few times 
to demonstrate this. Accidentally flooded my   little town a few times in the process, but 
that’s okay. You can see in my model, after   flooding the mine and draining it down, there was 
a partial failure in the roof and a pile of sand   toward the back caved in. And on the surface, you 
see just a small sinkhole.  In 2024, a huge hole   opened right in the center of a sports complex in 
Alton, Illinois. It was quickly determined that   part of an active underground aggregate mine below 
the park had collapsed, leading to the sinkhole.   It’s pretty characteristic of these issues. 
You don’t know where they’re going to happen,   and you don’t know how the surface soils are 
going to react to what’s happening underneath. Subsidence can also look like a generalized and 
broader sinking and settling over a large area.   You can see in my model that most of the surface 
still looks pretty flat, despite the fact that it   started here and is now down here as the mine 
supports have softened and deformed. This can   also be the case when mines are deeper in 
the ground. Even if the collapse is sudden,   the subsidence is less dramatic because the 
geology can shift and move to redistribute   the stresses. And the subsidence happens more 
slowly as the overburden settles into a new   configuration. In all cases, the subsidence can 
extend laterally from the mine, so impacted areas   aren’t always directly above. The deeper 
the mine, the wider the subsidence can be. I ran my little mine demo for quite a few 
cycles of wet and dry just to see how bad   things would get. And I admit 
I used a little percussion at the end   to speed things along. Let’s say this is a 
simulation of an earthquake on an abandoned   mine. You can see that by the end 
of it, this thing has basically collapsed. And take a look at the surface now. You have some 
defined sinkholes for sure. And you also have just   generalized subsidence - sloped and wavy areas 
that were once level. And you can imagine the   problems this can cause. Structures can easily be 
damaged by differential settlement. Pipes break.   Foundations shift and crack. Even water can drain 
differently than before, causing ponding and even   changing the course of rivers and streams for 
large areas. And even if there are no structures,   subsidence can ruin high-value farm land, 
mess up roads, disrupt habitat, and more. In many cases, the company that caused all the 
damage is long gone. Essentially they set a   ticking time bomb deep below the ground with no 
one knowing if or when it would go off. There’s   no one to hold accountable for it, and there’s 
very little recourse for property owners. Typical   property insurance specifically excludes damage 
from mine subsidence. So, in some places where   this is a real threat, government-subsidized 
insurance programs have been put in place.   Eight states in the US, those where coal mining 
was most extensive, have insurance pools set up.   In a few of those states, it is a requirement 
in order to own property. The federal government   in the US also collects a fee from coal 
mines that goes into a fund that helps   cover reclamation costs of mines abandoned 
before 1977 when the law went into effect. That federal mining act also required modern 
mines to use methods to prevent subsidence,   or control its effects, because this isn’t just a 
problem with historic abandoned mines. Some modern   underground soft rock mining doesn’t use the room 
and pillar method but instead a process called   longwall mining. Like everything in mining, there 
are multiple ways to do it. But here’s the basic   method: Hydraulic jacks support the roof of the 
mine in a long line. A machine called a shearer   travels along the face of the seam with cutting 
drums. The cut coal falls onto a conveyor and is   transported to the surface. The roof supports 
move forward into the newly created cavity,   intentionally allowing the roof behind them to 
collapse. It’s an incredibly efficient form of   mining, and you get to take the whole seam, rather 
than leaving pillars behind to support the roof.   But, obviously, in this method, subsidence 
at the surface is practically inevitable. Minimizing the harm that subsidence creates starts 
just by predicting its extent and magnitude. And,   just looking at my model, I think you 
can guess that this isn’t a very easy   problem to solve. Engineers use 
a mix of empirical information,   like data from similar past mining operations, 
geotechnical data, simplified relationships,   and in some cases detailed numerical modeling 
that accounts for geologic and water movement   over time. But you don’t just have to predict 
it. You also have to measure it to see if your   predictions were right. So mining companies use 
instruments like inclinometers and extensometers   above underground mines to track how they 
affect the surface. I have a whole video   about that kind of instrumentation 
if you want to learn more after this. The last part of that is reclamation - to repair 
or mitigate the damage that’s been done. And this   can vary so much depending on where the mine 
is, what’s above it, and how much subsidence   occurs. It can be as simple as filling and 
grading land that has subsided all the way to   extensive structural retrofits to buildings 
above a mine before extraction even starts.   Sinkholes are often repaired by backfilling 
with layers of different-sized materials,   from large at the bottom to small at top. That 
creates a filter to keep soil from continuing to   erode downward into the void. Larger 
voids can be filled with grout or even   polyurethane foam to stabilize the ground above, 
reducing the chance for a future collapse. I know coal - and mining in general - can be a 
sensitive topic. Most of us don’t have a lot of   exposure to everything that goes into obtaining 
the raw resources that make modern life possible.   And the things we do see and hear are usually 
bad things like negative environmental impacts   or subsidence. But I really think the 
story of subsidence isn’t just one of   “mining is bad” but really “mining used 
to be bad, and now it’s a lot better,   but there are still challenges to overcome.” 
I guess that’s the story of so many things   in engineering - addressing the difficulties 
we used to just ignore. And this video isn’t   meant to fearmonger. This is a real 
issue that causes real damages today,   but it’s also an issue that a lot of 
people put a great deal of thought,   effort, and ultimately resources into so that we 
can strike a balance between protection against   damage to property and the environment and 
obtaining the resources that we all depend on. Mining isn’t exactly construction, but it 
is construction adjacent: heavy machinery,   hard work, and lots of consideration of 
geology. It’s a fascinating industry that   forms the backbone of of modern society, and 
we don’t really get to see much about how it   works. My friend Sam from Wendover Productions 
put together this awesome documentary about coal   mining that really gives you a peek behind 
the scenes in his “Logistics of X” series.   These videos are so good - just deep dives into 
various industries and how they actually work.   I had no idea that so much of the 
US coal supply comes from a single   county. And if you want to check it 
out, it’s only available on Nebula. You’ve heard me talk about Nebula before. It’s 
a streaming service built by and for independent   creators, including a lot of my favorites like 
Neo, Wendover Productions, the Coding Train,   and Branch Education. I don’t know about you, but 
independently-produced content is most of what I   watch these days. I just like the authenticity 
and thoughtfulness of videos that haven’t been   through a writer's room and ten levels of studio 
executives. Someone said Nebula’s like Netflix   for people who love trains. And I like that 
comparison, not just because I also love trains. Nebula’s totally ad-free, with tons 
of excellent channels and lots of   original series and specials like the 
Logistics of X. It’s also a great gift,   especially because a yearly membership 
is 40% of the link in the description.   My videos go live on Nebula before they come out 
on YouTube. If you’re with me that independent   creators are the future of great video, I 
hope you’ll consider subscribing. That’s   go.nebula.tv/Practical-Engineering. Thank you 
for watching, and let me know what you think!

---

## 20. When Kitty Litter Caused a Nuclear Catastrophe
**Channel:** Practical Engineering | **Views:** 928K | **Date:** 10 months ago | **Duration:** 17:36 | **ID:** -D5iBAuXxeQ
**Link:** https://youtube.com/watch?v=-D5iBAuXxeQ

### Transcript:
Late in the night of Valentine’s Day 2014, 
air monitors at an underground nuclear   waste repository outside Carlsbad, New Mexico, 
detected the release of radioactive elements,   including americium and plutonium, into the 
environment. Ventilation fans automatically   switched on to exhaust contaminated air up 
through a shaft, through filters, and out to   the environment above ground. When filters were 
checked the following morning, technicians found   that they contained transuranic materials, highly 
radioactive particles that are not naturally found   on Earth. In other words, a container of 
nuclear waste in the repository had been   breached. The site was shut down and employees 
sent home, but it would be more than a year before   the bizarre cause of the incident was released. 
I’m Grady, and this is Practical Engineering. The dangers of the development of nuclear 
weapons aren’t limited to mushroom clouds and   doomsday scenarios. The process of creating the 
exotic, transuranic materials necessary to build   thermonuclear weapons creates a lot of waste, 
which itself is uniquely hazardous. Clothes,   tools, and materials used in the process may 
stay dangerously radioactive for thousands of   years. So, a huge part of working with nuclear 
materials is planning how to manage waste. I try   not to make predictions about the future, but 
I think it’s safe to say that the world will   probably be a bit different in 10,000 years. More 
likely, it will be unimaginably different. So,   ethical disposal of nuclear waste means not 
only protecting ourselves but also protecting   whoever is here long after we are ancient 
memories or even forgotten altogether. It’s   an engineering challenge pretty much unlike any 
other, and it demands some creative solutions. The Waste Isolation Pilot Plant, or WIPP, was 
built in the 1980s in the desert outside Carlsbad,   New Mexico, a site selected for a very specific 
reason: salt. One of the most critical jobs   for long-term permanent storage is to keep 
radioactive waste from entering groundwater   and dispersing into the environment. So, WIPP 
was built inside an enormous and geologically   stable formation of salt, roughly 2000 
feet or 600 meters below the surface. The   presence of ancient salt is an indication that 
groundwater doesn’t reach this area since the   water would dissolve it. And the salt has 
another beneficial behavior: it’s mobile. Over time, the walls and ceilings of mined-out 
salt tend to act in a plastic manner,   slowly creeping inwards to fill the void. This is 
ideal in the long term because it will ultimately   entomb the waste at WIPP in a permanent manner. It 
does make things more complicated in the meantime,   though, since they have to constantly work to 
keep the underground open during operation.   This process, called “ground control,” involves 
techniques like drilling and installing roof   bolts in epoxy to hold up the ceilings. I have an 
older video on that process if you want to learn   more after this. The challenge in this case is 
that, eventually, we want the roof bolts to fail,   allowing a gentle collapse of salt to fill 
the void because it does an important job. The salt, and just being deep underground in 
general, acts to shield the environment from   radiation. In fact, a deep salt mine is such a 
well-shielded area that there’s an experimental   laboratory located in WIPP across on the other 
side of the underground from the waste panels   where various universities do cutting-edge 
physics experiments precisely because of   the low radiation levels. The thousands of 
feet of material above the lab shield it from   cosmic and solar radiation, and the salt has 
much lower levels of inherent radioactivity   than other kinds of rock. Imagine that: a 
low-radiation lab inside a nuclear waste dump. Four shafts extend from the surface into the 
underground repository for moving people,   waste, and air into and out of the facility. 
Room-and-pillar mining is used to excavate   horizontal drifts or panels where waste is stored. 
Investigators were eventually able to re-enter   the repository and search for the cause of the 
breach. They found the source in Panel 7, Room 7,   the area of active disposal at the time. Pressure 
and heat had burst a drum, starting a fire,   damaging nearby containers, and ultimately 
releasing radioactive materials into the air. On activation of the radiation alarm, 
the underground ventilation system   automatically switched to filtration mode, 
sending air through massive HEPA filters.   Interestingly, although they’re a 
pretty common consumer good now,   High Efficiency Particulate Air, or HEPA, 
filters actually got their start during the   Manhattan Project specifically to 
filter radionuclides from the air. The ventilation system at WIPP performed well, 
although there was some leakage past the filters,   allowing a small percentage of radioactive 
material to bypass the filters and release   directly into the atmosphere at the surface. 21 
workers tested positive for low-level exposure   to radioactive contamination but, thankfully, 
were unharmed. Both WIPP and independent testing   organizations confirmed that detected levels 
were very low, the particles did not spread far,   and were extremely unlikely to result 
in radiation-related health effects to   workers or the public. Thankfully, the 
safety features at the facility worked,   but it would take investigators much longer to 
understand what went wrong in the first place,   and that involved tracing that 
waste barrel back to its source. It all started at the Los Alamos National 
Laboratory, one of the labs created as part of   the 1940s Manhattan Project that first developed 
atomic bombs in the desert of New Mexico. The   1970s brought a renewed interest in cleaning 
up various Department of Energy sites. Los   Alamos was tasked with recovering plutonium from 
residue materials left over from previous wartime   and research efforts. That process involved 
using nitric acid to separate plutonium from   uranium. Once plutonium is extracted, you’re 
left with nitrate solutions that get neutralized   or evaporated, creating a solid waste stream 
that contains residual radioactive isotopes. In 1985, a volume of this waste was placed in a 
lead-lined 55-gallon drum along with an absorbent   to soak up any moisture and put into temporary 
storage at Los Alamos, where it sat for years.   But in the summer of 2011, the Las Conchas 
wildfire threatened the Los Alamos facility,   coming within just a few miles of the storage 
area. This actual fire lit a metaphorical fire   under various officials, and wheels were 
set into motion to get the transuranic   waste safely into a long-term storage facility. 
In other words, ship it down the road to WIPP. Transporting transuranic wastes on the road 
from one facility to another is quite an ordeal,   even when they’re only going through 
the New Mexican desert. There are   rules preventing the transportation of 
ignitable, corrosive, or reactive waste,   and special casks are required to minimize the 
risk of radiological release in the unlikely   event of a crash. WIPP also had rules about how 
waste can be packaged in order to be placed for   long-term disposal called the Waste Acceptance 
Criteria, which included limits on free liquids.   Los Alamos concluded that barrel didn’t meet 
the requirements and needed to be repackaged   before shipping to WIPP. But, there were 
concerns about which absorbent to use. Los Alamos used various absorbent materials 
within waste barrels over the years to minimize   the amount of moisture and free liquid 
inside. Any time you’re mixing nuclear   waste with another material, you have to be 
sure there won’t be any unexpected reactions.   The procedure for repackaging nitrate salts 
required that a superabsorbent polymer be used,   similar to the beads I’ve used in some of 
my demos, but concerns about reactivity led   to meetings and investigations about whether it 
was the right material for the job. Ultimately,   Los Alamos and their contractors concluded that 
the materials were incompatible and decided to   make a switch. In May 2012, Los Alamos published 
a white paper titled “Amount of Zeolite Required   to Meet the Constraints Established by the 
EMRTC Report RF 10-13: Application of LANL   Evaporator Nitrate Salts.” In other words, “How 
much kitty litter should be added to radioactive   waste?” The answer was about 1.2 to 1, inorganic 
zeolite clay to nitrate salt waste, by volume. That guidance was then translated into the 
actual procedures that technicians would   use to repackage the waste in gloveboxes at Los 
Alamos. But something got lost in translation. As   far as investigators could determine, here’s 
what happened: In a meeting in May 2012, the   manager responsible for glovebox operations took 
personal notes about this switch in materials.   Those notes were sent in an email and eventually 
incorporated into the written procedures: “Ensure an organic absorbent is 
added to the waste material at   a minimum of 1.5 absorbent to 1 part waste ratio.” Did you hear that? The white paper’s requirement 
to use an inorganic absorbent became “...an   organic absorbent” in the procedures. We’ll never 
know where the confusion came from, but it could   have been as simple as mishearing the word in the 
meeting. Nonetheless, that’s what the procedure   became. Contractors at Los Alamos procured a large 
quantity of Swheat Scoop, an organic, wheat-based   cat litter, and started using it to repackage the 
nitrate salt wastes. Our barrel first packaged in   1985 was repackaged in December 2013 with the 
new kitty litter. It was tested and certified   in January 2014, shipped to WIPP later that month, 
and placed underground. And then it blew up. The   unthinkable had happened; the wrong kind of 
kitty litter had caused a nuclear disaster. While the nitrates are relatively unreactive with 
inorganic, mineral-based zeolite kitty litter   that should have been used, the organic, 
carbon-based wheat material could undergo   oxidation reactions with nitrate wastes. I think 
it’s also interesting to note here that the issue   is a reaction that was totally unrelated to the 
presence of transuranic waste. It was a chemical   reaction - not a nuclear reaction - that caused 
the problem.  Ultimately, the direct cause of   the incident was determined to be “an exothermic 
reaction of incompatible materials in LANL waste   drum 68660 that led to thermal runaway, which 
resulted in over-pressurization of the drum,   breach of the drum, and release of a portion of 
the drum’s contents (combustible gases, waste, and   wheat-based absorbent) into the WIPP underground.” 
Of course, the root cause is deeper than that and   has to do with systemic issues at Los Alamos and 
how they handled the repackaging of the material. The investigation report identified 12 
contributing causes that, while individually did   not cause the accident, increased the likelihood 
or severity of it. These are written in a way that   is pretty difficult for a non-DOE expert to parse: 
take a stab at digesting contributing cause number   5: “Failure of Los Alamos Field Office (NA-LA) and 
the National Transuranic (TRU) Program/Carlsbad   Field Office (CBFO) to ensure that the CCP 
[that is, the Central Characterization Program]   and LANS [that is, that is the contractor, Los 
Alamos National Security] complied with Resource   Conservation and Recovery Act (RCRA) requirements 
in the WIPP Hazardous Waste Facility Permit (HWFP)   and the LANL HWFP, as well as the 
WIPP Waste Acceptance Criteria (WAC).” Still, as bad as it all seems, it really could 
have been a lot worse. In a sense, WIPP performed   precisely how you’d want it to in such an event, 
and it’s a really good thing the barrel was in   the underground when it burst. Had the same 
happened at Los Alamos or on the way to WIPP,   things could have been much worse. Thankfully, 
none of the other barrels packaged in the same   way experienced a thermal runaway, and they were 
later collected and sealed in larger containers. Regardless, the consequences of the 
“cat-astrophe” were severe and very   expensive. The cleanup involved shutting down 
the WIPP facility for several years and entirely   replacing the ventilation system.  WIPP itself didn’t formally reopen 
until January of 2017, nearly three full years after the incident, with 
the cleanup costing about half a billion dollars. Today, WIPP remains controversial, not 
least because of shifting timelines and   public communication. Early estimates once 
projected closure by 2024. Now, that date is   sometime between 2050 and 2085. And events like 
this only add fuel to the fire. Setting aside   broader debates on nuclear weapons themselves, the 
wastes these weapons generate are dangerous now,   and they will remain dangerous for generations. 
WIPP has even explored ideas on how to mark the   site post-closure, making sure that future 
generations clearly understand the enduring   danger. Radioactive hazards persist long 
after languages and societies may have changed   beyond recognition, making it essential but 
challenging to communicate clearly about risks. Sometimes, it’s easy to forget - amidst all 
the technical complexity and bureaucratic   red tape that surrounds anything nuclear - 
that it’s just people doing the work. It’s   almost unbelievable that we entrust ourselves - 
squishy, sometimes hapless bags of water, meat,   and bones - to navigate protocols of such profound 
complexity needed to safely take advantage of   radioactive materials. I don’t tell this story 
because I think we should be paralyzed by the idea   of using nuclear materials - there are enormous 
benefits to be had in many areas of science,   engineering, and medicine. But there are enormous 
costs as well, many of which we might not be aware   of if we don’t make it a habit to read obscure 
government investigation reports. This event is   a reminder that the extent of our vigilance has 
to match the permanence of the hazards we create. I talk a lot about news stories related 
to engineering, and I get a lot of email   from journalists wanting to interview me for 
stories they’re working on. About a year ago,   one of those requests landed in 
my personal email. Not a big deal,   but I try to keep that inbox separate, so 
I asked how they got the address, thinking   I had accidentally posted it somewhere. The 
answer was, I think, kind of brazen. They said,   “We just bought your information from a 
data broker.” I knew that was a thing,   but it was surprising to see it admitted so 
openly. At the time, Incogni had recently   reached out to sponsor a video. I told them, 
let me give it a shot, and then I’ll decide. We all get junk mail, spam emails, and 
telemarketing calls. You kind of think   that stuff is unavoidable, but those lists have to 
come from somewhere. And robocalls are annoying,   but data brokers can have more insidious 
effects, making it easier to steal your identity,   take out loans in your name, stalk 
you, and more. Plus, algorithms can   use personal info to decide what ads to show 
you and even the prices you pay for products.   Many of these services offer a way to remove 
your information, but there are hundreds of   these sites, all with their own specific form 
to fill out. That’s where Incogni comes in. You authorize them to act on your behalf 
for this one specific purpose of removing   your information from online databases. 
And then you’re done. You can log on to   see all of the websites that have taken 
your info down, and Incogni just keeps   working on it behind the scenes. I’ve 
been using it for an entire year now,   and they estimate that if I were to do all 
this myself, it would have taken me 300 hours. It’s tough to correlate this directly to a 
reduction in spam, but it definitely seems   like I’ve gotten fewer unwanted phone calls since 
I signed up and all the interview requests use my   work address now. But what’s more important to 
me is the proactive part of it. It just helps   make it harder for individuals and companies 
to use my and my family’s personal information   in unwanted ways. And if you’d like the same 
peace of mind, they’re offering 60 percent off   an annual plan at the link in the description. 
Take back control of your personal information   at incogni.com/practicalengineering. Thank you 
for watching, and let me know what you think.

---

## 21. Why Are Beach Holes So Deadly?
**Channel:** Practical Engineering | **Views:** 6.1M | **Date:** 10 months ago | **Duration:** 16:11 | **ID:** 0kQXOTcEB_E
**Link:** https://youtube.com/watch?v=0kQXOTcEB_E

### Transcript:
Even though it’s a favorite vacation destination, 
the beach is surprisingly dangerous. Consider the   lifeguard: There aren’t that many recreational 
activities in our lives that have explicit staff   whose only job is to keep an eye on us, make 
sure we stay safe, and rescue us if we get into   trouble. There are just a lot of hazards on the 
beach. Heavy waves, rip currents, heat stress,   sunburn, jellyfish stings, sharks, and even 
algae can threaten the safety of beachgoers.   But there’s a whole other hazard, this one usually 
self-inflicted, that usually doesn’t make the list   of warnings, even though it takes, on average, 2-3 
lives per year just in the United States. If you   know me, you know I would never discourage that 
act of playing with soil and sand. It’s basically   what I was put on this earth to do. But I do have 
one exception. Because just about every year,   the news reports that someone was buried when 
a hole they dug collapsed on top of them.   There’s no central database of sandhole collapse 
incidents, but from the numbers we do have,   about twice as many people die this 
way than from shark attacks in the US. It might seem like common sense not to 
dig a big, unsupported hole at the beach   and then go inside it, but sand has 
some really interesting geotechnical   properties that can provide a false sense of 
security. So, let’s use some engineering and   garage demonstrations to explain why. I’m 
Grady and this is Practical Engineering. In some ways, geotechnical engineering 
might as well be called slope engineering,   because it’s a huge part of what they do. 
So many aspects of our built environment   rely on the stability of sloped earth. Many 
dams are built from soil or rock fill using   embankments. Roads, highways, and bridges rely 
on embankments to ascend or descend smoothly.   Excavations for foundations, tunnels, and 
other structures have to be stable for the   people working inside. Mines carefully monitor 
slopes to make sure their workers are safe. Even   protecting against natural hazards like landslides 
requires a strong understanding of geotechnical   engineering. Because of all that, the science 
of slope stability is really deeply understood.   There’s a well-developed professional consensus 
around the science of soil, how it behaves,   and how to design around its limitations as a 
construction material. And I think a peek into   that world will really help us understand 
this hazard of digging holes on the beach. Like many parts of engineering, analyzing 
the stability of a slope has two basic parts:   the strengths and the loads. The job of a 
geotechnical engineer is to compare the two.   The load, in this case, is kind of obvious: 
it’s just the weight of the soil itself. We   can complicate that a bit by adding loads at the 
top of a slope, called surcharges, and no doubt   surcharge loads have contributed to at least 
a few of these dangerous collapses from people   standing at the edge of a hole. But for now, let’s 
keep it simple with just the soil’s own weight. On a flat surface, soils are generally 
stable. But when you introduce a slope,   the weight of the soil above can create a 
shear failure. These failures often happen   along a circular arc, because an arc minimizes 
the resisting forces in the soil while maximizing   the driving forces. We can manually solve for 
the shear forces at any point in a soil mass,   but that would be a fairly tedious engineering 
exercise, so most slope stability analyses use   software. One of the simplest methods is 
just to let the software draw hundreds of   circular arcs that represent failure planes, 
compute the stresses along each plane based   on the weight of the soil, and then figure 
out if the strength of the soil is enough   to withstand the stress. But what does it 
really mean for a soil to have strength? If you can imagine a sample of soil floating 
in space, and you apply a shear stress,   those particles are going to slide apart from 
each other in the direction of the stress. The   amount of force required to do it is usually 
expressed as an angle, and I can show you   why. You may have done this simple experiment in 
high school physics where you drag a block along   a flat surface and measure the force required 
to overcome the friction. If you add weight,   you increase the force between the surfaces, 
called the normal force, which creates additional   friction. The same is true with soils. The 
harder you press the particles of soil together,   the better they are at resisting a shear 
force. In a simplified force diagram,   we can draw a normal force and the resulting 
friction, or shear strength, that results. And the   angle that hypotenuse makes with the normal force 
is what we call the friction angle. Under certain   conditions, it’s equal to the angle of repose, the 
steepest angle that a soil will naturally stand. If I let sand pour out of this funnel onto the 
table, you can see, even as the pile gets higher,   the angle of the slope of the sides never 
really changes. And this illustrates the   complexity of slope stability really nicely. 
Gravity is what holds the particles together,   creating friction, but it’s also what pulls 
them apart. And the angle of repose is kind   of a line between gravity’s stabilizing 
and destabilizing effects on the soil.   But things get more complicated 
when you add water to the mix. Soil particles, like all things that take 
up space, have buoyancy. Just like lifting a   weight under water is easier, soil particles 
seem to weigh less when they’re saturated,   so they have less friction between them. I can 
demonstrate this pretty easily by just moving   my angle of repose setup to a water tank. It’s 
a subtle difference, but the angle of repose   has gone down underwater. It’s just because 
the particle’s effective weight goes down,   so the shear strength of the soil mass goes down 
too. And this doesn’t just happen under lakes   and oceans. Soil holds water - I’ve covered 
a lot of topics on groundwater if you want to   learn more. There’s this concept of the “water 
table” below which, the soils are saturated,   and they behave in the same way as my little 
demonstration. The water between the particles,   called “pore water” exerts pressure, pushing them 
away from one another and reducing the friction   between them. Shear strength usually goes down for 
saturated soils. But, if you’ve played with sand,   you might be thinking: “This doesn’t really track 
with my intuitions.” When you build a sand castle,   you know, the dry sand falls apart, 
and the wet sand holds together. So let’s dive a little deeper. Friction 
actually isn’t the only factor that   contributes to shear strength in a soil. 
For example, I can try to shear this clay,   and there’s some resistance there, even 
though there is no confining force pushing   the particles together. In finer-grained 
soils like clay, the particles themselves   have molecular-level attractions that make 
them, basically, sticky. The geotechnical   engineers call this cohesion. And 
it’s where sand gets a little sneaky. Water pressure in the pores between particles can 
push them away from each other, but it can also   do the opposite. In this demo, I have some dry 
sand in a container with a riser pipe to show the   water table connected to the side. And I’ve dyed 
my water black to make it easier to see. When I   pour the water into the riser, what do you think 
is going to happen? Will the water table in the   soil be higher, lower, or exactly the same as the 
level in the riser? Let’s try it out.  Pretty much right away, you can see what happens. The sand 
essentially sucks the water out of the riser,   lifting it higher than the level outside the 
sand. If I let this settle out for a while,   you can see that there’s a pretty big difference 
in levels, and this is largely due to capillary   action. Just like a paper towel, water wicks 
up into the sand against the force of gravity. This capillary action actually creates 
negative pressure within the soil (compared   to the ambient air pressure). In other words, 
it pulls the particles against each other,   increasing the strength of the soil. 
It basically gives the sand cohesion,   additional shear strength that doesn’t 
require any confining pressure. And again,   if you’ve played with sand, you know there’s 
a sweet spot when it comes to water.  Too dry, and it won’t hold together.  Too wet, same thing.  But if there’s just enough water, 
you get this strengthening effect.  However, unlike clay that has real cohesion, that   suction pressure can be temporary. And it’s 
not the only factor that makes sand tricky. The shear strength of sand also depends on 
how well-packed those particles are. Beach   sand is usually well-consolidated because of the 
constant crashing waves. Let’s zoom in on that   a bit. If the particles are packed together, 
they essentially lock together. You can see   that to shear them apart doesn’t just look like 
a sliding motion, but also a slight expansion   in volume. Engineers call this dilatancy, and 
you don’t need a microscope to see it. In fact,   you’ve probably noticed this walking around on 
the beach, especially when the water table is   close to the surface. Even a small amount 
of movement causes the sand to expand,   and it’s easy to see like this because it 
expands above the surface of the water. The   practical result of this dilatant property 
is that sand gets stronger as it moves,   but only up to a point. Once the sand 
expands enough that the particles are no   longer interlocked together, there’s a lot less 
friction between them. If you plot movement,   called strain, against shear strength, you 
get a peak and then a sudden loss of strength. Hopefully you’re starting to see how all 
this material science adds up to a real   problem. The shear strength of a soil, 
basically its ability to avoid collapse,   is not an inherent property: 
It depends on a lot of factors;   It can change pretty quickly; And this behavior 
is not really intuitive. Most of us don’t have a   ton of experience with excavations. That’s part 
of the reason it’s so fun to go on the beach and   dig a hole in the first place. We just don’t get 
to excavate that much in our everyday lives. So,   at least for a lot of us, it’s just a natural 
instinct to do some recreational digging. You   excavate a small hole. It’s fun. It’s interesting. 
The wet sand is holding up around the edges,   so you dig deeper. Some people give up after the 
novelty wears off. Some get their friends or their   kids involved to keep going. Eventually, the hole 
gets big enough that you have to get inside it to   keep digging. With the suction pressure from 
the water and the shear strengthening through   dilatancy, the walls have been holding the 
entire time, so there’s no reason to assume   that they won’t just keep holding. But inside 
the surrounding sand, things are changing. Sand is permeable to water, meaning water moves 
through it pretty freely. It doesn’t take a big   change to upset that delicate balance of wetness 
that gives sand its stability. The tide could   be going out, lowering the water table and thus 
drying the soil at the surface out. Alternatively,   a wave or the tide could add water to the 
surface sand, reducing the suction pressure.   At the same time, tiny movements within the 
slopes are strengthening the sand as it tries   to dilate in volume. But each little movement 
pushes toward that peak strength, after which   it suddenly goes away. We call this a brittle 
failure because there’s little deformation to   warn you that there’s going to be a collapse.  It happens suddenly, and if you happen to be   inside a deep hole when it does, you might be just 
fine, like our little friend here, but if a bigger   section of the wall collapses, your chance of 
surviving is slim. Soil is heavy. Sand has about   two-and-a-half times the density of water. It just 
doesn’t take that much of it to trap a person. This is not just something that happens to people 
on vacations, by the way. Collapsing trenches and   excavations are one of the most common causes 
of fatal construction incidents. In fact,   if you live in a country with workplace 
health and safety laws, it’s pretty much   guaranteed that within those laws are rules about 
working in trenches and excavations. In the US,   OSHA has a detailed set of guidelines on how to 
stay safe when working at the bottom of a hole,   including how steep slopes can be 
depending on the types of soil,   and the devices used to shore up an excavation to 
keep it from collapsing while people are inside.   And for certain circumstances where the risks 
get high enough or the excavation doesn’t fit   neatly into these simplified categories, they 
require a professional engineer be involved. So does all this mean that anyone who’s not an 
engineer just shouldn’t dig holes at the beach.   If you know me, you know I would never agree with 
that. I don’t want to come off too earnest here,   but we learn through interaction. Soil and rock 
mechanics are incredibly important to every part   of the built environment, and I think everyone 
should have a chance to play with sand, to get   muddy and dirty, to engage and connect and commune 
with the stuff on which everything gets built. So,   by all means, dig holes at the beach. Just don’t 
dig them so deep.  The typical recommendation I see is to avoid going in a hole deeper than your knees.  That’s pretty conservative. If you have kids with you,  it’s really not much 
at all. If you want to follow OSHA guidelines,   you can go a little bigger: up to 20 feet (or 
6 meters) in depth, as long as you slope the   sides of your hole by one-and-a-half to one or 
about 34 degrees above horizontal. You know,   ultimately you have to decide what’s safe 
for you and your family. My point is that   this doesn’t have to be a hazard if you use 
a little engineering prudence. And I hope   understanding some of the sneaky behaviors 
of beach sand can help you delight in the   primitive joy of digging a big hole without 
putting your life at risk in the process. I was impressed to learn that the training for 
many lifeguards and emergency responders now   includes ways to safely and quickly excavate a 
victim from a collapsed sand hole. The general   procedure is to form two rings of responders 
around the collapse, moving sand outward from   the center. There is a lot of complexity 
in rescuing people from unusual situations,   and actually, my friend Sam at Wendover 
Productions produced a video all about The   Logistics of Search and Rescue. This is part 
of the Logistics of X series that dives into   the little details of systems that you never 
considered before. It’s a really fascinating   peek behind the curtain, and if you want to 
check it out, it’s only available on Nebula. You’ve heard me talk about Nebula before. It’s 
a streaming service built by and for independent   creators, including a lot of my favorites like 
Neo, Wendover Productions, the Coding Train,   and Branch Education. I don’t know about you, 
but independently-produced content is most of   what I watch these days. I just like the 
authenticity and thoughtfulness of videos   that haven’t been through ten levels of studio 
executives watering the information down to   capture the widest audience possible. I just 
think passionate individuals and small teams   make the most compelling work, and 
Nebula is the perfect place for it. Nebula’s totally ad-free, with tons of excellent 
channels and lots of original series and specials   like the Logistics of X. It’s also a great gift, 
especially because a yearly membership is 40%   of the link in the description. At thirty-six 
bucks for a year, that’s pretty tough to beat.   My videos go live on Nebula before they come out 
on YouTube. If you’re with me that independent   creators are the future of great video, I 
hope you’ll consider subscribing. That’s   go.nebula.tv/Practical-Engineering. Thank you 
for watching, and let me know what you think!

---

## 22. This Bridge’s Bizarre Design Nearly Caused It To Collapse
**Channel:** Practical Engineering | **Views:** 1.6M | **Date:** 10 months ago | **Duration:** 20:04 | **ID:** pL5NCUuOkTM
**Link:** https://youtube.com/watch?v=pL5NCUuOkTM

### Transcript:
This is the Washington Bridge that carries 
I-195 over the Seekonk River in Providence,   Rhode Island… or at least, it was the 
Washington Bridge. You can see that the   westbound span is just about completely gone. 
In July of 2023, that part of the bridge,   although marked as being in poor condition, 
received a passing inspection. Six months later,   the bridge was abruptly closed to traffic because 
it was in imminent danger of collapse. Now,   the whole thing has nearly been torn down as 
part of an emergency replacement project. Rhode   Islanders who need to travel between Providence 
and East Providence have suffered through more   than a year of traffic delays from the loss of 
this important link, and business owners have   seen major downturns. If you live in the area, 
you’re probably tired of seeing it in the news.   But it hasn’t had a lot of coverage outside the 
state. And I think it’s a really fascinating case   study in the complexities of designing, building, 
and taking care of bridges, including some lessons   that apply to designing just about anything. 
I’m Grady, and this is Practical Engineering. The original bridge over the Seekonk 
River was finished in 1930. Part of   that old bridge now serves as a pedestrian 
crossing and bike link. It’s a nice bridge:   concrete and stone multiple arch spans give 
it a graceful look over the river. In 1959,   when I-195 expanded to include this road, it 
quickly filled with traffic. The old bridge   just wasn’t big enough, at least according to 
the standards of the time. So, a new bridge to   carry the westbound lanes was planned, with the 
federal government picking up most of the bill. Since the feds were paying, they wanted a 
simple, inexpensive steel girder bridge. But   Rhode Island refused. The state didn’t want 
a plain, stark, utilitarian structure right   next to their historic and elegant multi-arch 
bridge. It took years to come to an agreement,   but eventually, they met in the middle 
with the Federal Bureau of Roads agreeing   to include false concrete arch facades between 
each of the exterior piers, matching the style   of the eastbound bridge. But by that time, 
the field of bridge engineering had shifted. The Interstate Highway system in the US started 
in 1956 with the idea of an interconnected freeway   system with no at-grade intersections. Every 
road and rail crossing required grade separation,   and that meant we started building a lot of 
bridges. We’re up to around 55,000 today,   and that’s just on the interstates. With steel 
in short supply, a new kind of bridge girder was   coming into vogue made from pre-stressed concrete. 
In simple reinforced concrete structures,   the rebar is just cast inside. It takes some 
deflection of the concrete before the steel   can take on any of the internal stress within the 
member. For beams, the amount of deflection needed   to develop the strength of the steel often leads 
to cracks, which eventually lead to corrosion as   water reaches the steel. But if you can load up 
the steel before the beam is put into service,   in other words, “prestress” it, you can stiffen 
the beam, making it less likely to crack under   load. I have a whole video going into more detail 
about prestressed concrete if you want to learn   more after this. If you’ve already seen it, 
then you know there are two main ways to do it. In some structures, the reinforcing steel 
is tensioned before the concrete is cast.   This “pre-tensioning” is usually done in 
facilities with specialized equipment that   can apply and hold those extreme forces 
while the concrete cures. Alternatively,   you can do it on-site by running steel tendons 
through hollow tubes in the concrete. Once   it’s cured, jacks are used to stress the 
tendons, a process called post-tensioning. The engineers for the westbound lanes of 
the Washington Bridge took advantage of   this relatively new construction method, using 
both post-tensioned and pre-tensioned beams.   While most of the grade separation bridges on 
interstate highways were rigidly standardized,   this was a bridge unlike practically any other 
in the United States. It had 18 spans of varying   structural types. Except for the navigation 
span for boats that used steel girders,   the rest of the bridge passing over 
the water used cantilever beams. Rather than having the end of the beam 
sit on the pier like most beam bridges do,   called simply supported, the primary beams in the 
Washington Bridge were supported at their center,   cantilevering out in both directions. The 
pre-tensioned drop-in concrete girders were   suspended between the cantilever arms. Those 
cantilever beams were post-tensioned structural   members. Five steel cables were run in 
hollow ducts from one end to the other,   then tensioned to roughly 200,000 
pounds (nearly a meganewton each),   and locked off at anchorages on both ends. 
Then the ducts were filled with grout to   bond the strands to the rest of the concrete 
member and protect them against corrosion. Most of the cantilever beams in the Washington 
Bridge were balanced, meaning they had roughly the   same load on either side. But at the west abutment 
and navigation span, that wasn’t true. You can see   that these beams support a drop-in girder on one 
end, but the steel girders over the navigation   span are simply-supported on their piers. 
Since the cantilever beams weren’t balanced,   designers needed an alternative way to keep 
them from rotating atop the pier. So steel   rods called tie-downs were installed 
on each of the unbalanced cantilevers. In December 2023, the now 57-year-old westbound 
bridge was in the middle of a 64-million-dollar   construction project to repair damaged concrete, 
widen the deck for another lane of traffic,   and add a new off-ramp, with the goal of 
extending the bridge’s life by 25 years.   One of the engineers involved in that project 
was on site and noticed something unusual under   the navigation span. Some of the tie-down rods on 
the unbalanced cantilevers were completely broken. The finding was serious, so three days 
later, a more detailed inspection of the   structure was carried out, discovering 
that half of the unbalanced cantilevers   at piers 6 and 7 - the piers on either side 
of the navigation span - were not performing   as designed. The Rhode Island Department of 
Transportation closed the bridge to traffic   that day while the state could investigate 
the issue and come up with a solution. The closure snarled traffic on a crossing that was 
already regularly congested. Westbound traffic was   eventually rerouted onto the eastbound bridge, 
with the lanes narrowed to fit more vehicles.   The state put up an interactive dashboard where 
you can look at travel times by route and time   of day and view live webcams to try and help 
travelers and commuters decide how and when to   get across the Seekonk River. Still, the closure 
has had an enormous impact on the Providence area,   impacting travel times and economic activity for more than a year now. The state was fully expecting to implement some 
kind of emergency repair project, essentially a   retrofit that would replace the broken tie-downs 
on the unbalanced cantilevers. The project was   designed, and the contractor started installing 
work platforms below the bridge in January 2024.   As they got access to the underside of 
the bridge, things started looking worse.   Deteriorating concrete on the beams threatened to 
complicate the installation of the new tie-downs,   so the state decided to do a more detailed 
investigation. They tested concrete in the   beams, used ground penetrating radar and 
ultrasound to inspect the tendons inside,   and even drilled into the beams to observe 
the actual condition of the post-tensioned   cables. What they uncovered was 
a laundry list of serious issues. In addition to the failed tie-down rods, 
there were major problems with the beams   themselves. The concrete was soft and damaged, 
in part because of freeze-thaw action. Like   most concrete from the 1960s, there was 
no air entrainment in the concrete beams.   This requirement in most modern concrete 
mixes, especially in northern climates,   introduces tiny air bubbles that act like cushions 
to reduce damage when water freezes. Without air,   concrete exposed to water and freezing conditions 
will spall, crack, and deteriorate over time. The post-tensioning system was also in bad 
condition. The anchorages at the end of the   beams were corroded, and voids and soft 
grout were found within the cable ducts.   When the inspectors drilled into the beams 
to reach one of the cables, they saw that the   poor grout job had allowed water inside 
the duct, corroding the cable itself. Most of the damage was related to the condition 
and location of the joints in the bridge deck,   which allowed water and salty snow melt to leak 
down onto the structure below. If you saw my video   on the Fern Hollow Bridge collapse in Pittsburgh, 
it was a similar situation. When the engineers   analyzed the strength of the bridge, considering 
its actual condition, the results weren’t good. With no traffic, the beams met the minimum 
requirements in the bridge code. When traffic   loads were applied, it was a totally different 
story. The code does not allow any tension to   occur in a post-tensioned member, but 
you can see in the graph that the top   of the beam is in tension across a large 
portion of its length. Worse than that,   the engineers found that the beams were in a 
condition where failure would happen before you   could see significant cracking in the concrete. 
In other words, if the beam was in structural   distress, it likely wouldn’t be caught during an 
inspection. There could be no warning before a   potential failure. In short, this was not a bridge 
worth widening. It wasn’t even safe to drive on. A big question here is: Why didn’t any 
of this get caught in inspections? And   that mostly has to do with access. Only some of 
these tie-downs were visible to inspectors. The   rest were embedded in concrete diaphragms 
that ran laterally between the beams. But   it’s not clear if any special attention 
was paid to them, given their structural   importance in the bridge. Looking through 
all the past inspection reports, there’s very   little mention of the tie-down rods at all, and 
only a few pictures of them. The state actually   used this photo from the July 2023 inspection, 5 
months prior to when it was observed to be broken,   to show that this tie-down wasn’t broken then, 
suggesting that maybe a large truck had caused   the damage in a single event. But you can clearly 
see that, if it were fractured at that time,   that break would be obscured by the pier 
in the photo. Same thing with this one;   the fracture is at the very top of the rod, so 
it’s impossible to see if it was there in July.   There’s no easy way to know how long this had been 
an issue. At least for these outside tie-rods,   you have bare steel, exposed and mostly uncoated, 
directly beneath a leaky joint in the road deck.   This is easy to say in hindsight, but if I’m an 
inspector and I understand the configuration of   this bridge, I’m making sure to put eyes on 
every one of these visible tie-downs, or at   least state clearly and explicitly that the access 
wasn’t enough to fully document their condition. And it’s even worse for the post-tensioned 
anchorages in the beams. Those drop-in girders   sat essentially flush with the ends of the beams, 
making it impossible to inspect their condition,   let alone perform maintenance or repairs. 
Seismic retrofits installed in 1996 made   access and visibility even tougher. And this is 
a perfect case study in the risks that hidden   elements can pose. If you’ve ever done a 
renovation project on an older house, you   know exactly how this goes. You start to change a 
light fixture, and next thing you know there’s a   backhoe in your front yard. The bridge widening 
project uncovered the situation with the tie   rods. The repairs to the tie rods revealed 
issues with the post-tension system in the   beams. Investigation into that problem revealed 
further structural issues, and pretty quickly,   you have a much bigger problem on your hands 
than you set out to fix in the first place.   You’re trying to keep the public informed about 
what’s going on and predict how long the bridge   is going to be closed at the same time that 
the situation is unraveling before your eyes. The engineers looked at a bunch of options to 
repair all these issues, but the complexity of   implementing any fixes just made it infeasible. 
Just to get to the beams, you’d have to demo the   entire road deck and remove the drop-in girders. 
Since things have shifted, there was no way to   know how the load had redistributed, so even 
taking the deck would come with risks. Then,   with the state of the concrete in the beams, it 
wasn’t a sure bet that they could even support any   external strengthening. And even if you did get it 
repaired, you would still have all the same issues   with access and visibility. The report put it in 
plain words: the options for repair were “limited,   complex, and [did] not completely mitigate 
the identified risks with the structure.” So,   eventually, the state decided to 
demolish the entire thing and start over. And that’s where it stands (or doesn’t stand) 
right now. Demolition is well underway,   but that’s not the end of the mess. The state 
put out a request for proposals to design and   build the replacement project in April 2024 with 
an aggressive schedule to finish construction by   August 2026. Not a single contractor bid on the 
job, likely due to the difficult schedule and   the inherent risks. The state planned to leave 
the substructure of the bridge (the piers and   piles) intact, giving the replacement contractor 
the option to reuse it as a part of their design.   It seems that no one could get comfortable 
with that idea, and I don’t blame them,   considering how each milestone in this saga has 
only revealed new bad news about the condition   of the bridge. In October, the state decided to 
just demo the substructure, too, adding it to the   existing contract. They started a new solicitation 
process, this time with two stages, to try and   find a contractor willing to take on this project. 
The two finalists were announced in December,   and they expect to award a contract this summer of 
2025. But, in the midst of just trying to figure   out what to do with the bridge, the fight over 
who’s responsible for all this chaos started. In August of 2024, the state filed a lawsuit 
against 13 companies, including firms that did   the bridge inspections, alleging that they should 
have identified these structural issues earlier.   At one point the attorney general stopped the 
demolition work to preserve evidence for the   lawsuit, extending the timeline for a month. 
Then in January, the US Department of Justice   disclosed that they’re investigating the state 
of Rhode Island under the False Claims Act,   which comes into play when federal funds 
are misused or fraudulently obtained. The   dual legal battles—one against the engineering 
firms and another potentially implicating the   state—turned what was already a logistical and 
financial nightmare into a high-stakes showdown,   with millions of dollars and public trust 
hanging in the balance. Then in February,   this video came out showing the demolition 
contractor dropping huge pieces of the   cantilever beams onto the barges below, sparking 
a workplace safety investigation from OSHA. A fellow YouTube engineer, Casey Jones, 
has been covering a lot of the more   detailed aspects of the situation if 
you want to keep up with the story,   and I also have to shout out the local journalists 
who have done some fantastic work to keep the   public apprised of the situation where maybe the 
State has faltered. This saga is far from over,   and we’re probably going to learn a lot 
more in the coming months and years. Maybe   the inspectors really did neglect their duties to 
identify major problems. Maybe the state has some   issues with its inspection and review program. 
Probably there’s a little bit of both. But also,   this bridge had some bizarre design decisions 
that made a lot of these problems inevitable. Putting critical structural elements, like 
tie-downs and post-tension anchorages,   where they can’t be inspected or repaired 
is essentially like planting a time bomb.   We’re fortunate it was caught before it blew 
up. And a lot of those design decisions were   driven by a roughly five-million-dollar 
(adjusted for inflation) battle between   Rhode Island and the federal government over the 
visual appearance of the bridge in 1965. Now, it   will cost roughly 20 times that just to tear the 
bridge down, and who knows how much to rebuild. This situation is a mess! It’s 
an embarrassment for the state,   a nightmare for the engineers and contractors 
who have worked on the bridge in the past,   and a major problem for all the residents 
of Rhode Island who depend on this bridge.   Every time I talk about failures, I get so much 
feedback about how bad US infrastructure is.   And I don’t want to sugarcoat this situation, 
but I do want to put it in context. This is   one of roughly 617,000 bridges in the US, 
and in some ways, it’s a success story:   A serious problem was identified before it became 
a disaster, and the final outcome should be what   was needed all along - replacing a bridge 
that had reached the end of its design life. It’s not a bizarre situation that an old 
bridge was old. It happens all the time,   and although sometimes the roadwork is 
frustrating, we generally understand   that structures don’t last forever and 
eventually need to be replaced. But just   like engineers design structures to be 
ductile, to fail with grace and warning,   we want and need projects like this to happen in 
an orderly fashion. We should be able to recognize   when replacement is necessary, plan ahead for 
the project, do a good job informing the public,   and execute the job on a timeline that doesn’t 
require panic, chaos, and emergency contracts,   and the Washington Bridge is a perfect 
case study in why that’s so important. I am an avid news reader when it comes to 
stories about infrastructure. I’ve been   following the story of the Washington Bridge for 
more than a year now until I felt there was enough   information to make this video. And I have an 
update from another video I did when the Francis   Scott Key Bridge was hit by a container ship last 
year. Maryland just unveiled the concept for the   replacement. What do you think of the rendering? I 
knew it was going to be a cable-stayed structure. With news like this, you know a lot of people 
are going to have things to say. This story was   covered by more than 30 sources with a good mix 
of left-, center-, and right-leaning sources.   Today’s sponsor, Ground News, makes it easy to 
see them all in one place. But more than that,   it adds context to help you consider any biases 
in the reporting. You can see ownership and   factuality ratings backed by independent 
news monitoring organizations at a glance,   and a summary of the story based on all the 
articles with an AI-powered comparison tool. There’s a lot to this story, including the tragedy 
of the construction workers who lost their lives,   the lawsuits, and the enormous amount of 
money the project is going to require. And   news sources can slant the importance of those 
issues one way or another. It can be really   frustrating trying to follow the news just to 
get the facts, especially for controversial   subjects like those that involve politics, 
environmental issues, or ongoing conflicts,   where there’s more motivation to get a 
particular narrative across. In that way,   journalism has a lot of power over us, and 
Ground News hands some of that power back to   you. If you’d like a more transparent media 
landscape, they’re offering a huge discount   right now at the link in the description: 40 
percent off the Vantage subscription, which   includes unlimited access to all their features. 
That’s ground dot news slash practicalengineering   or just click the link in the description. Thank 
you for watching, and let me know what you think!

---

## 23. All Dams Are Temporary
**Channel:** Practical Engineering | **Views:** 5.7M | **Date:** 11 months ago | **Duration:** 16:29 | **ID:** XiUOBdEUqjY
**Link:** https://youtube.com/watch?v=XiUOBdEUqjY

### Transcript:
Lewis and Clark Lake, on the border 
between Nebraska and South Dakota,   might not be a lake for much longer. Together 
with the dam that holds it back, the reservoir   provides hydropower, flood control, and supports 
a robust recreational economy through fishing,   boating, camping, birdwatching, hunting, 
swimming, and biking. All of that faces an   existential threat from a seemingly innocuous 
menace: dirt. Around 5 million tons of   it flows down this stretch of the Missouri 
River every year until it reaches the lake,   where it falls out of suspension. Since the 1950s, 
when the dam was built, the sand and silt have   built up a massive delta where the river comes in. 
The reservoir has already lost about 30 percent of   its storage capacity, and one study estimated 
that, by 2045, it will be half full of sediment. On the surface, this seems like a silly 
problem, almost elementary. It’s just dirt! But   I want to show you why it’s a slow-moving 
catastrophe with implications that span   the globe. And I want you to think of a few 
solutions to it off the top of your head,   because I think you’ll be surprised to 
learn why none of the ones we’ve come   up with so far are easy. I’m Grady, 
and this is Practical Engineering. I want to clarify that the impacts dams have 
on sediment movement happen on both sides.   Downstream, the impacts are mostly environmental. 
We think of rivers as carriers of water;   it’s right there in the definition. But if 
you’ve ever seen a river that looks like   chocolate milk after a storm, you already know 
that they are also major movers of sediment. And   the natural flow of sediment has important 
functions in a river system. It transports   nutrients throughout the watershed. It 
creates habitat in riverbeds for fish,   amphibians, mammals, reptiles, birds, and a whole 
host of invertebrates.  It fertilizes floodplains,  stabilizes river banks, and creates deltas and beaches on the coastline that buffer   against waves and storms. Robbing the supply of 
sediment from a river can completely alter the   ecosystem downstream from a dam. But if a river 
is more than just a water carrier, a reservoir   is more than just a water collector. And, of 
course, I built a model to show how this works. This is my acrylic flume.  If you’re familiar 
with the channel, you’ve probably seen it in   action before. I have it tilted up so 
we get two types of flow. On the right,   we have a stream of fast-moving water to simulate 
a river, and on the left, I’ve built up a little   dam. These stoplogs raise the level of the water, 
slowing it down to a gentle crawl. And there’s   some mica power in the water, so you can really 
see the difference in velocity. Now let’s add some   sediment. I bought these bags of colored sand, 
and I’m just going to dump them in the sump where   my pump is recirculating this water through the 
flume. And watch what happens in the time lapse. The swift flow of the river 
carries the sand downstream,   but as soon as it transitions into the slow 
flow of the reservoir, it starts to fall out   of suspension. It’s a messy process at first. The 
sand kind of goes all over the place. But slowly,   you can see it start to form a delta right 
where the river meets the reservoir. Of course,   the river speeds up as it climbs over the delta, 
so the next batch of sediment doesn’t fall out   until it’s on the downstream end. And each 
batch of sand that I dump into the pump just   adds to it. The mass of sediment just slowly 
fills the reservoir, marching toward the dam. This looks super cool. In fact, I thought it 
was such a nice representation that I worked   with an illustrator to help me make a print of it. 
We’re only going to print a limited run of these,   so there's a link to the store down 
below if you want to pick one up. But,   even though it looks cool, I want to be 
clear that it’s not a good thing. Some dams   are built intentionally to hold sediment 
back, but in the vast majority of cases,   this is an unwanted side effect of impounding 
water within a river valley. For most reservoirs,   the whole point is to store water - for 
controlling floods, generating electricity,   drinking, irrigation, cooling power plants, etc. 
So, as sediment displaces more and more of the   reservoir volume, the value that reservoir 
provides goes down. And that’s not the only   problem it causes. Making reservoirs shallower 
limits their use for recreation by reducing the   navigable areas and fostering more unwanted 
algal blooms. Silt and sand can clog up gates   and outlets to the structure and damage equipment 
like turbines. Sediment can even add forces to a   dam that might not have been anticipated during 
design. Dirt is heavier than water.  Let me prove that to you real quick.  It’s a hard enough job  to build massive structures that can hold back 
water, and sediment only adds to the difficulty. But I think the biggest challenge of this issue 
is that it’s inevitable, right? There are no   natural rivers or streams that don’t carry some 
sediments along with them.  The magnitude does vary by location. The world’s a big place, 
and for better or worse, we’ve built a lot   of dams across rivers. There are a lot of 
factors that affect how quickly this truly   becomes an issue at a reservoir, mostly things 
that influence water-driven erosion on the land   upstream. Soil type is a big one; sandy soils 
erode faster than silts and clays (that’s why I   used sand in the model). Land use is another big 
one. Vegetated areas like forests and grasslands   hold onto their soil better than agricultural 
land or areas affected by wildfires. But in   nearly all cases, without intervention, 
every reservoir will eventually fill up. Of course, that’s not good, but I don’t think 
there’s a lot of appreciation outside of a small   community of industry professionals and activists 
for just how bad it is. Dams are among the most   capital-intensive projects that we humans build. 
We literally pour billions of dollars into them,   sometimes just for individual projects. 
This is kind of its own can of worms,   but I’m just speaking generally that society 
often accepts pretty significant downsides in   addition to the monetary costs, like environmental 
impacts and the risk of failure to downstream   people and property in return for the enormous 
benefits dams can provide. And sedimentation   is one of those problems that happens over a 
lifetime, so it’s easy at the beginning of a   project to push it off to the next generation 
to fix. Well, the heyday of dam construction   was roughly the 1930s through the 70s. So 
here we are starting to reckon with it,   while being more dependent than ever on those 
dams. And there aren’t a lot of easy answers. To some extent, we consider sediment during 
design. Modern dams are built to withstand   the forces, and the reservoir usually has 
what’s called a “dead pool,” basically a   volume that is set aside for sediment 
from the beginning. Low-level gates   sit above the dead pool so they don’t 
get clogged. But that’s not so much a   solution as a temporary accommodation since 
THIS kind of deadpool doesn’t live forever. I think for most, the simplest idea 
is this: if there’s dirt in the lake,   just take it out. Dredging soil is really 
not that complicated. We’ve been doing it   for basically all of human history. And in some 
cases, it really is the only feasible solution.   You can put an excavator on a barge, or a crane 
with a clamshell bucket, and just dig. Suction   dredgers do it like an enormous vacuum cleaner, 
pumping the slurry to a barge or onto shore. But   that word feasible is the key. The whole secret 
of building a dam across a valley is that you only   have to move and place a comparatively small 
amount of material to get a lot of storage.   Depending on the topography and design, every unit 
of volume of earth or concrete that makes up the   dam itself might result in hundreds up to tens 
of thousands of times that volume of storage in   the reservoir. But for dredging, it’s one-to-one. 
For every cubic meter of storage you want back,   you have to remove it as soil from the reservoir. 
At that point, it’s just hard for the benefits   to outweigh the costs. There’s a reason we 
don’t usually dig enormous holes to store   large volumes of water. I mean, there are a 
lot of reasons, but the biggest one is just   cost. Those 5 million tons of sediment that flow 
into Lewis and Clark Reservoir would fill around   200,000 end-dump semi-trailers. That’s every 
year, and it’s assuming you dry it out first,   which, by the way, is another challenge of 
dredging: the spoils aren’t like regular soil. For one, they’re wet. That water adds volume 
to the spoils, meaning you have more material   to haul away or dispose of. It also makes the 
spoils difficult to handle and move around.   There are a lot of ways to dry them out or 
“dewater” them as the pros say. One of the   most common is to pump spoils into geotubes, 
large fabric bags that hold the soil inside   while letting the water slowly flow out. But 
it’s still extra work. And for two, sometimes   sediments can be contaminated with materials that 
have washed off the land upstream. In that case,   they require special handling and disposal. Many 
countries have pretty strict environmental rules   about dredging and disposal of spoils, so 
you can see how it really isn’t a simple   solution to sedimentation, and for most 
cases, it often just isn’t worth the cost. Another option for getting rid of sediment is 
just letting it flow through the dam. This is   ideal because, as I mentioned before, sediment 
serves a lot of important functions in a river   system. If you can let it continue on 
its journey downstream, in many ways,   you’ve solved two problems in one, and there 
are a lot of ways to do this. Some dams have   a low-level outlet that consistently 
releases turbid water that reaches the   dam. But if you remember back to the model, 
not all of it does. In fact, in most cases,   the majority of sediment deposits furthest 
from the dam, and most of it doesn’t reach   the dam until the reservoir is pretty much full. 
Of course, my model doesn’t tell the whole story;   it’s basically a 2D example with only one type of 
soil. As with all sediment transport phenomena,   things are always changing. In fact, I decided 
to leave the model running with a time-lapse   just to see what would happen.  You can really get 
a sense of how dynamic this process can be. Again,   it’s a very cool demonstration. But in most cases, 
much of the sediment that deposits in a reservoir   is pretty much going to stay where it falls or 
take years and years before it reaches the dam. So, another option is to flush the reservoir. Just 
set the gates to wide open to get the velocity of   water fast enough to loosen and scour the 
sediment, resuspending it so it can move   downstream. I tried this in the model, 
and it worked pretty well. But again,   this is just a 2D representation. In a real 
reservoir that has width, flushing usually   just creates a narrow channel, leaving most 
of the sediment in place. And, inevitably,   this requires drawing down the reservoir, 
essentially wasting all the water. And more   importantly than that, it sends a massive plume 
of sediment laden water downstream. I’ve harped   on the fact that we want sediment downstream 
of dams and that’s where it naturally belongs,   but you can overdo it. Sediment can be considered 
a pollutant, and in fact, it’s regulated in the   US as one. That’s why you see silt fences 
around construction sites. So the challenge   of releasing sediment from a dam is to match the 
rate and quantity to what it would be if the dam   wasn’t there. And that’s a very tough thing to 
do because of how variable those rates can be,   because sediment doesn’t flow the same in a 
reservoir as it would in a river, because of   the constraints it puts on operations (like the 
need to draw reservoirs down) and because of the   complicated regulatory environment surrounding 
the release of sediments into natural waterways. The third major option for dealing with the 
problem is just reducing the amount of sediment   that makes it to a reservoir in the first place. 
There are some innovations in capturing sediment   upstream, like bedload interceptors that 
sit in streams and remove sediment over   time. You can fight fire with fire by building 
check dams to trap sediment, but then you’ve just   solved reservoir sedimentation by creating 
reservoir sedimentation. As I mentioned,   those sediment loads depend a lot not only on the 
soil types in the watershed, but also on the land   use or cover. Soil conservation is a huge field, 
and has played a big role in how we manage land   in the US since the Dust Bowl of the 1930s. We 
have a whole government agency dedicated to the   problem and a litany of strategies that reduce 
erosion, and many other countries have similar   resources. A lot of those strategies involve 
maintaining good vegetation, preventing wildfires,   good agricultural practices, and reforestation. 
But you have to consider the scale. Watersheds   for major reservoirs can be huge. Lewis and 
Clark Reservoir’s catchment is about 16,000   square miles (41,000 square kilometers). That’s 
larger than all of Maryland! Management of an   area that size is a complicated endeavor, 
especially considering that you have to do   it over a long duration. So in many cases, there’s 
only so much you can do to keep sediment at bay. And really, that’s just an overview. I use 
Lewis and Clark Reservoir as an example,   but like I said, this problem extends to 
essentially every on-channel reservoir across the   globe. And the scope of the problem has created 
a huge variety of solutions I could spend hours   talking about. And I think that’s encouraging. 
Even though most of the solutions aren’t easy,   it doesn’t mean we can’t have infrastructure 
that’s sustainable over the long term,   and the engineering lessons learned from 
past shortsightedness have given us a lot   of new tools to make the best use of our 
existing infrastructure in the future. I think the challenges around how we manage 
water at a large scale are some of the most   interesting issues we have to grapple with. 
Obviously, I focus on the engineering side,   but it gets far more complicated than just 
technical decisions. Probably the best case study   that I know of is the Colorado River system in the 
American southwest. And if you want to see how the   interplay between politics, growth, drought, 
and engineering play out at a grand scale,   the team at Wendover Productions released 
this awesome, full-length documentary called   The Colorado Problem: A River in the Red. It’s 
basically an hour-and-a-half Wendover Productions   video with excellent graphics and interviews.  And if you 
want to watch it, it’s only available on Nebula. You probably know about Nebula now, even if 
you’re not subscribed. It’s a streaming service   built by and for independent creators. No studio 
executives deciding what gets the green light,   and no advertisements either. It’s 
just independent creators making stuff   they're excited about with as few barriers and 
distractions as possible between you and us. My videos go live on Nebula before they come out 
here, and my Practical Construction series was   specifically produced for Nebula viewers who want 
to see deeper dives into specific topics. I know   there are a lot of streaming platforms out there 
right now, and no one wants another monthly cost   to keep track of, but I also know that if you’re 
watching a show like this to end, there is a ton   of other stuff on Nebula that you’re going to 
enjoy as well. So I’ve made it dead simple:   click the link below and you’ll get 40% off an 
annual plan. Or if you have subscription fatigue,   but still want to support what I’m doing, 
you can get a lifetime membership. Pay once   and have access for as long as you and 
Nebula lasts. Hopefully that’s a long   time! If you’re with me that independent 
creators are the future of great video,   I hope you’ll consider subscribing. Thank you 
for watching, and let me know what you think!

---

## 24. A Love Letter to Cable-Stayed Bridges
**Channel:** Practical Engineering | **Views:** 425K | **Date:** 1 year ago | **Duration:** 20:19 | **ID:** YSQhtlyfPtU
**Link:** https://youtube.com/watch?v=YSQhtlyfPtU

### Transcript:
Hello! I’m Grady, and this is Practical Engineering. 
You know, every once in a while, all the   science, technology, economic factors, and 
stylistic tastes converge into a singular,   beautiful idea of absolute perfection. Am I 
being superfluous? I don’t think so.  Destin’s got laminar flow.  Grey thinks hexagons are 
the bestagons. Matt loves the number 3,  for whatever reason.  Vi prefers 6. 
Alec loves the refrigeration cycle.   I am not going to mince words here; they’re just 
wrong. I’m not trying to say that cable-stayed   bridges are the best kind of bridge. I’m 
saying they’re the best, period. So, on this   day dedicated to the people and things that we love, 
let me tell you why I adore cable-stayed bridges. Spanning a gap is a hard thing to do, in general 
- to provide support with nothing underneath. Even   kids recognize there’s some inherent mystery and 
intrigue to the idea. Almost all bridges rely,   to some extent, on girders - beams running along 
their length - to gather structural forces from   the deck and move them to the supports. This 
action results in bending, known as moments   to engineers, and those moments create internal 
stress. Too much stress and the material fails.   You can increase the size of the beam to reduce 
the stress, but that creates more weight that   creates a higher moment that results in more 
stress, and you’re back to where you started.   For any material you choose as a girder, there is 
a practical limit in span because the self-weight   of the beam grows faster than its ability to 
withstand the internal stress that weight causes. The easiest way to deal with a moment that 
might stress a beam too much is to simply   support it from below; build another column 
or pier there. And in old-fashioned viaducts,   this is precisely what you’ll see. But 
there are a lot of places we want to   cross where it’s just not that simple. 
Putting piers in areas where the water   is deep or the soil is crummy can 
be cost-prohibitive. And sometimes,   we just don’t want more supports to ruin the view. 
Fortunately, “push” has an opposite. Cables can be   used to pull a bridge upward toward tall 
towers, supporting the deck from above. There was a time when a suspension bridge was 
practically the only way to cross a long span.   Huge main cables drape across the towers, and 
suspenders attach them to the deck below. You   get that continuous support, reducing the demand 
on the girders and allowing for a much lighter,   more efficient structure. But you get some 
other stuff too. All those forces transfer   to the cables and to the tops of the towers. 
But the cables don’t just pull on the towers   vertically. There’s some horizontal pulling 
too, and I’m sure you know what happens when   you put a horizontal force at the top of 
something very tall. So the cables have   to continue to the other side, balancing the 
lateral component. And that’s just kicking the   force-can down the road; ultimately they have 
to go somewhere. In most suspension bridges,   it’s the anchorage - a usually enormous 
concrete behemoth that attaches the main   cables to the ground. The anchorages on the 
Golden Gate Bridge weigh 60,000 tons each. Compare that to a cable-stayed span.  Get rid of 
the main cables and just run the suspenders - now   called stays - diagonally straight to the tower. 
You have balanced horizontal forces on the tower   without the need for a massive anchorage that 
can be expensive or, in places with poor soils,   completely infeasible. Instead, those horizontal 
forces transfer into the bridge deck and girders,   but because they’re balanced, there’s no net 
horizontal force on the deck either. Of course,   with traffic and wind loads, you 
can get slight imbalances in forces,   but those can be taken care of with the 
stiffness of the tower and the anchor   piers at the end of each backspan, which 
are much simpler than massive anchorages. I should note that some suspension bridges do 
this too. So-called self-anchored suspension   bridges also put the deck in compression in lieu 
of anchorages. In that case, the entire bridge   deck has to withstand the full compression force 
from the main cables attached at its ends. In a   cable-stayed bridge, the maximum compressive 
force in the deck is localized near the towers   and diminishes as you get further from them, 
allowing you to be more efficient with materials. This tension management also means 
cable-stayed bridges work well in   multi-span arrangements. Consider 
the Western side of the Bay Bridge,   an admittedly impressive multi-span bridge 
connecting traffic from San Francisco to   Oakland. This is two suspension spans connected 
to one another, but look what’s in between them.   This manmade mountain of a concrete anchorage is 
an unavoidable cost of this kind of construction. Compare that to the sleek multi-span wonder of the 
French Millau(MEE-oh) Viaduct with eight spans,   six of which are longer than a thousand 
feet or three hundred meters. While there   certainly is a significant volume of concrete 
in the viaduct, it’s all in the deck and eight   elegant pylons. No hulking anchorages to be 
seen; just gently curving spans above the   French countryside. It also happens to be the 
tallest bridge in the world, with its tallest   pylon surpassing the Eiffel tower! If that 
doesn’t make your heart flutter, nothing will. And speaking of flutter, suspension bridges have 
another downside. You’ve probably seen this video   before. Gravity loads aren’t the only forces for 
long-span bridges to withstand. The lightness of   a suspension bridge is actually a disadvantage 
when it comes to the wind. Because of the droopy,   parabolic shape of the main cables, suspension 
bridges are susceptible to relatively small forces   causing outsized deflections of the structure. 
This is true laterally. But it’s also true for   vertical forces. Since the main cables reach very 
shallow angles, even horizontal in the center of   the span, huge tensions are required just to 
withstand moderate vertical loads, and those   tensions come with large deflections as the cables 
straighten. Put another way, it’s a lot easier to   straighten a sagging cable than to stretch 
one that’s taut. For a cable-stayed bridge,   they’re already straight. There’s very little 
sag in the stays, so any deflections require   the actual steel to stretch along its length. That 
makes cable-stayed bridges generally much stiffer   than suspension bridges, giving them aerodynamic 
stability and allowing the decks to be lighter. The thing about a bridge is that you can design 
pretty much anything on paper, or in CAD, but at   some point, it has to be built. You have to get 
the structure into place above the area it spans,   and that can be a tricky thing. Consider an arch 
bridge. That arch can’t do its arch thing until   it’s a continuous structure member. Before 
that, forces have to be diverted through some   other temporary structure or falsework, 
usually something underneath. For one,   that requires engineers to design, essentially, 
several different versions of the same bridge,   where (in some cases) the construction loads 
actually govern the size and shape members   rather than the final configuration. For two, 
if building extra vertical supports was easy,   then we would just design the 
bridge that way in the first place. Check out this timelapse of the construction of 
the I-11 bridge over the Colorado River downstream   of the Hoover Dam. If you look carefully, 
you can see that before the arch is complete,   it is supported by cable stays! And this is where 
you see the huge advantage that cable-stayed   bridges have: constructability. The flow of 
forces during construction is the same as when   the bridge is complete. But it’s not just that; 
the construction itself also is much simpler. Look at a conventionally anchored suspension 
bridge. You have to build the towers and   anchorages first. Only when they’re complete 
can you hang the main cables. That’s a process   in itself. Main cables are too heavy and unwieldy 
to be prefabricated and hoisted across the span,   so they are generally built in place, wire by 
wire, in a process called spinning. Then you   have to attach the suspenders, and only then 
can you start building the road deck. It’s   an intricate process where each major step can’t 
start until the one before it is totally finished.   Self-anchored suspension bridges are even 
more complicated, because you have to have   the entire deck built before the cable can be 
anchored, but you have to have the cable to   suspend the deck. It’s a chicken and egg problem 
that you have to solve with temporary supports. None of this is true with cable-stayed bridges. 
You can have your chicken and egg, and eat it too!  You start with the pylons, and then as you 
build out the bridge deck, you add cable stays   along the way, slowly cantilevering out from 
the towers. Since they’re usually symmetrical,   the forces balance out the whole time. The 
loading is the same during construction and after,   and there’s no need for falsework or temporary 
supports, dramatically lowering the cost to   build them. Some bridges can even begin work 
on the deck before the tower is even finished,   speeding up the construction timeline and reducing 
costs even more. This constructability also has   a positive feedback loop when it comes to 
contractors and manufacturers as well. As   the popularity of cable-stayed bridges has 
exploded since the second half of the twentieth   century, more and more contractors 
have recent and relevant experience,   and more and more manufacturers can produce the 
necessary materials, reducing the costs even   further and making them more and more 
likely to be chosen for new projects. But once you put up a bridge, you also have 
to keep it up. Maintenance is another place   cable-stayed bridges shine. Besides the stays 
themselves, most of their parts are easily   accessible for inspection. Most structures don’t 
rely heavily on coatings to protect the steel,   so you don’t have to contract with specialized, 
high-access professionals for maintenance. And   just using more concrete instead of steel means 
fewer problems with corrosion. With more rigidity,   you get less fatigue on materials. And they’re 
redundant. Suspension bridges rely on the two   massive main cables for all their structural 
support. You can’t take one cable out of   service for repair or replacement without 
very complicated structural retrofits. With   cable-stayed bridges, it’s no problem. The 
stays are designed to be highly redundant,   so if one breaks or you need to replace them, 
the remaining cables can still effectively   support the bridge's load. And each cable can 
be tensioned individually, so the structure   can be “tuned” to match the design requirements 
just like a piano, and adjusted later if needed. You might be looking at all these examples 
and thinking, this is kind of obvious. But   there are a lot of reasons why cable-stayed 
bridges only started becoming popular in   the last few decades. Part of that is in the 
field of engineering itself. Where the deck,   tower, and main cables of a suspension bridge 
behave fairly independently, a cable-stayed   structure is much more interdependent. 
Each stay is tensioned independently,   meaning you have lots of different forces on 
the deck and towers that depend on each other,   and they have to be calculated for each loading 
condition. Solving for all the forces in the   bridge is a complicated task to do by hand, so 
it took the advent of modern structural analysis   software before engineers could gain enough 
confidence in designs to push the envelope. And that brings me to a deeper point 
about structural elements resisting   forces. Cable-stayed bridges just 
make such efficient use of materials,   many of which have existed for centuries, but 
have been refined and improved over time. A lot   of engineering sometimes feels like designing 
around the weaknesses of various materials,   but cable-stayed bridges take full advantage 
of materials’ strengths. We put the towers   and deck in compression and make them out of 
high-strength concrete, a material that loves   compressive stress. We put the stays in tension 
and make them out of high-strength steel. They   love tension. We’ve slowly gained confidence in 
the innovations that make these bridges possible,   like parallel wire strands, concrete-to-cable 
anchoring systems, segmental construction,   and prestressed concrete. And all these gradual 
improvements in various aspects of construction   and material science added up to create 
the pinnacle of engineering technology. You want to know the other reason why cable-stayed 
bridges are becoming more popular? It’s taste.   Bridges are highly visible structures. They 
are tremendous investments of public resources,   and the public has a say in how they look. I hate 
to even say the word outloud, but sometimes,   there are architects involved in 
their design. The swooping shapes   of suspension structures were in vogue during the 
heyday of long-span bridge design, but no more! One of the huge benefits of cable-stayed 
bridges is that they’re flexible. Not   structurally flexible of course, but 
architecturally. Most bridges do have   a few rules of thumb - the tower height is 
usually about a fifth of the main span length,   and the side spans about two fifths of 
the main span. However the number of   variations on the theme is practically 
endless. Let me show you some examples. For short spans, you’ll typically see single cable 
planes. Each of the masts of the Millau viaduct   has a single cable plane, connecting the cables 
along a central line of the bridge deck. Go a   little bigger and you’ll see double cable planes. 
This is the Russky Bridge in Russia, the current   world record holder with a main span of 1,100 
meters or 3,600 feet. The two cable planes give   the structure extra stiffness. Double planes can 
be parallel like you see in the Øresund bridge in   Denmark. Or, cable planes can be inclined towards 
one another, like in the Charilaos Trikoupis   bridge in Greece. They can use the radial or “fan” 
style, where the stays originate from the pylons   near a single point at the top, like the Pasco 
Kennewick bridge. Or they can use the harp style,   where the stays are more or less parallel. Lots of 
structures use a style somewhere between the two. If the pylons get tall enough, they might 
get connected by a cross member, giving   H pylons. Continuing in the alphabetical trend, 
another option is A-frames with inclined cable   planes. If an A-frame gets too tall, though, 
you end up requiring two foundations per pylon,   which can quickly get pricey or just too 
challenging to construct. In that case,   tuck the legs back in towards each other, 
and you’ve got stunning diamond frames. You might see asymmetrical designs like Malaysia’s   famous Seri Wawasan bridge or 
Spain’s Puente del Alamillo.   You’ve got Sao Paolo’s Octávio Frias de Oliveira 
Bridge with its iconic X-shaped pylon holding two   curved roadways, each with double cable planes 
inclined and crossing each other. Even my home   state of Texas boasts some impressive cable-stayed 
bridges. Corpus Christi’s Harbor Bridge will be   finished soon, now that they got the construction 
issues worked out. Houston has the double   diamond-framed Fred Hartman bridge. And Dallas 
has the iconic Margaret Hunt Hill Bridge with its   high arched single pylon gracefully twisting its 
single cable plane through the third dimension. You can see how these simple structural 
principles work together to allow architects   to really get creative while still allowing 
the engineers and contractors to bring it   into reality. I mean, just look at this.  There’s 
nothing extraneous. Nothing extravagant. This is   the highest form of utility meets beauty. 
Have you ever seen something like this? I hope you can see why we’re in the heyday 
of cable-stayed bridge construction. This   is my opinion, and maybe I’m a little bit 
biased, but I don’t think there’s a better   example in history where all the various 
factors of a technical problem converged   into a singular solution in this way. Many 
consider the Strömsund Bridge in Sweden,   completed in 1956, to be the first modern 
cable-stayed bridge. But it’s only been   over the past three or four decades 
that things really took off. Now,   there are more than 15 with spans greater 
than 800 meters or 2600 feet, not including   the Gordie Howe Bridge, which will soon be the 
longest cable-stayed bridge in North America. Even the famously hard-hearted US 
Federal Highway Administration declared   their affection for the design, stating, 
“Today, cable-stayed bridges have firmly   established their unrivaled position as 
the most efficient and cost-effective   structural form in the 150-m to 460-m span 
range.” And that range is only growing. We humans built a lot of long bridges in the 20th 
century, and a lot of them are reaching the end   of their design lives. I can tell you what kind of 
bridge most of them are going to be replaced with.   And I can tell you that any time a new bridge 
that needs a span less than 1000 meters or 3,300   feet goes into the alternatives analysis phase, 
it’s going to get harder and harder not to choose   a cable-stayed structure. They’re structurally 
efficient, cost-effective, easy to build, easy to   take care of, and easy to love. The very longest 
spans in the world are still suspension bridges,   but I would argue: we don’t really need to connect 
such long distances anyway. Doctors don’t tell   you this, but engineers don’t actually have 
heartstrings; they have pre-fabricated parallel   wire heart strands, and nothing tugs on them quite 
like a cable-stayed bridge.  Happy Valentine's Day!  One thing I really like to think about when it 
comes to long-span bridges is that there just   aren’t that many of them in the world, compared 
to other works of engineering like buildings   or water systems. In many ways, every large 
bridge is a full-scale experiment, and for me,   that’s one of the coolest parts of engineering: 
using our understanding of math and physics to   execute an idea that’s never been tried before. 
For example, how do you calculate the forces in   the stays that angle from the deck up to the 
tower? A big part of the math is trigonometry,   a subject that seems a little daunting until 
you realize how it can be applied to just about   anything. And my favorite way to learn new 
topics in math and science is on Brilliant. Brilliant’s been sponsoring Practical 
Engineering videos for seven years now.   It’s the longest partnership I’ve had. And I 
think the biggest reason for that is people   watching this channel just keep finding value in 
learning new things in this interactive way. That   and they keep adding new lessons every month. 
I feel like I know trigonometry pretty well,   but I couldn’t help myself from brushing up when 
I jumped back into the course to show it here. I love learning. I think one of the most 
important things you can do in life is to always   be broadening your horizons. We learn best not by 
reading or hearing but by doing, and that’s why I   love Brilliant. The lessons just stick better when 
you’re actually using the information while you   learn, and learning a little bit every day creates 
a habit that pays off in the long run. You can try   this completely free for 30 days and see if it’s 
something that can help you get ahead in your   career, get better at a hobby, or just enjoy the 
process of learning something new. If you love it,   you’ll get 20% off a premium subscription. 
Go to brilliant.org/PracticalEngineering,   scan the code, or just click the link in the 
description below. I really like their website   and their app and I think you will too. Thank 
you for watching, and let me know what you think.

---

## 25. What’s Inside a Manhole?
**Channel:** Practical Engineering | **Views:** 2.1M | **Date:** 1 year ago | **Duration:** 13:10 | **ID:** 1ztGpGjO60o
**Link:** https://youtube.com/watch?v=1ztGpGjO60o

### Transcript:
For as straightforward as they are, there’s a lot 
of mystery to sewers. They’re mostly out of sight,   out of mind, and ideally out of smell too. 
But there’s one familiar place you can get   a hint of what’s happening below your 
feet, and that’s the manhole. Sanitary   engineers know that there’s actually a lot 
of complexity in this humble hallmark of   our least-glorified type of infrastructure. 
So, I set up a see through sewer system so   you can see what’s happening inside. I’m 
Grady, and this is Practical Engineering. There are a lot of kinds of manholes. If it’s a 
utility of any kind and you put it underground,   there’s a good chance you’ll need some access 
to it at some point in time. But I figure if you   picture a manhole in your head, it probably 
leads to a sewer system: either a sanitary   sewer that connects to your drains and toilets, 
a storm sewer that connects to storm drains,   or a combined system that carries it all. Unlike 
what you see in movies, most sewer systems aren’t   huge tunnels full of totally tubular turtles 
and their giant rodent mentor. They’re mostly   just simple pipes sized according to the 
amount of flow expected during peak periods. Sewer networks have a tributary 
structure. Gravity carries waste   along downward sloping pipes that converge 
and concentrate into larger and larger lines,   like a big underground river system…but grosser. 
Terminology varies place to place, but in general,   it goes like this. Pipes that service individual 
buildings are usually called laterals, and those   servicing particular streets are branches. Larger 
pipes that collect wastewater from multiple   branches are called mains or trunk sewers. And the 
most significant lines furthest downstream in the   system are usually called interceptors. 
And connecting each one is a manhole. This is my model sewer system.  I’m just 
pumping water into an upper manhole and   letting it flow through the system by gravity. 
I chose to do this with nice blue water for   anyone watching while having lunch. In real 
life, the color in a sewer isn’t quite this   nice. Unlike regular plumbing, where you use 
“fittings” to connect lengths of pipes together,   sewers lines are connected with manholes. 
Any change in size, direction, alignment,   or elevation is a place where debris can get 
caught or turbulence can affect the flow. So   instead of elbows or tees in the pipe, 
we just put a manhole instead. In fact,   unlike many underground utilities, you can usually 
trace the paths of a sewer network pretty easily,   because it’s all straight lines between 
manholes. They provide a controlled environment   where the flow can change direction, and more 
importantly, a place where technicians can get   inside to inspect the lines, remove clogs, 
or perform maintenance (hence the name). Unlike fresh water distribution systems that can 
usually go a long time without any intervention,   sewers are a little… more hands-on (just make 
sure you wash your hands afterwards). There’s   just no end to the type of things that can 
find their way into the pipes. Fibrous objects   are particularly prone to causing clogs, which 
is why so many sewer utilities have campaigns   encouraging people not to flush wipes, even if 
they say “flushable” on the package. Fats, oil,   and grease (or FOG, in the industry) are also 
a major problem because they can congeal and   harden into blockages sometimes not-so-lovingly 
known as “fatbergs”. Of course, a lot of people   aren’t aware of what’s safe to flush or wash 
down the drain, and even for people who know,   it’s easy to let something slide when it’s 
not your problem anymore. And in most cases,   the rules aren’t very strictly enforced outside 
of large commercial and industrial users of the   system. But if you use a sewage system, in 
a way, obstructions really ARE your problem   because a portion of your taxes or fees that 
pay for the sewer system go toward sending   people - not always men (despite the name) - into 
manholes to keep things flowing. And the more   often things clog up, the higher the rates that 
everyone pays to cover the cost of maintenance. There’s quite a lot of sophistication in keeping 
sewers in service these days. It’s not unusual for   a city or sewer district to regularly send cameras 
through the lines for inspection. Technology has   made it a lot easier to be proactive. In fact, 
there’s a whole field of engineering called   infrastructure asset management that just focuses 
on keeping track of physical assets like sewer   lines, monitoring their condition, and planning 
ahead for repairs, maintenance, and replacement   over the long term. A lot of the unclogging and 
cleaning these days is done by hydro jetting:   basically a pressure washer scaled up. Rotating 
nozzles blast away debris and propel the hose down   the line. In fact, one of the benefits of manholes 
is that, if a sewer line does need maintenance,   it can be easily taken out of service. You can 
just run a bypass pump from one manhole to another   and keep the system running. But maintenance 
isn’t the only thing a manhole helps with. You can see a few more things in this demo.  For one, manholes provide ventilation.  Along with the solids and liquids you expect, gases 
can end up flowing through sewer pipes too. You   can see the bubbles moving through the system. Air 
bubbles can restrict the flow of fluid in a pipe,   and air pressure can cause wacky problems 
like backflow. Along with regular air, toxic,   corrosive, or even explosive gases can also build 
up in a sewer if there’s no source of fresh air,   so ventilation from manholes is an important 
aspect of the system. Sometimes you’ll even   notice condensed water vapor flowing up 
from a manhole cover. In a few cities,   like New York, that might be related to an 
actual steam distribution system running   underground. But it can also happen in 
sewers when the wastewater from sources   like showers and dishwashers is warmer than 
the outside air, especially in the winter. I added a third manhole to my model so you can see 
how a junction might look. It just provides a nice   way to confluence two streams into one pipe, 
which is an important job in a sewer system,   since a “sewershed” all has to flow to one 
place. The manhole acts kind of like a buffer,   smoothing out flows through the system. At 
normal flows, that’s not a super important   job. It’s basically just a connection between 
two pipes. But the peak flows for most sewers,   even if they’re not storm sewers, happen during 
storms. Drains may be improperly connected to   sanitary sewers, plus surface water often finds a 
way in through manhole covers and other means. In   fact, a lot of places require sealed and bolted 
covers if the top of the manhole is below the   floodplain. That’s why you sometimes see these 
air vents sticking up out of the ground. Many   older cities use combined systems where stormwater 
runs in the same pipes. So rainwater in sewers can   be a major challenge. And you can see when you 
get a big surge of water, the manhole can store   some of it, smoothing out the flow downstream.
These storm flows are actually a pretty big   problem of the constructed environment. You may 
have heard about the trouble with holding swimming   events in the Seine River in Paris during the 
2024 summer olympics. Same problem. Wastewater   treatment plants can only handle so much flow, 
so many places have to divert wastewater during   storms, often just discharging raw, if somewhat 
diluted, sewage directly into rivers or streams.   In fact some of the most impressive feats of 
engineering in progress right now are ways to   store excess wastewater during storms so it can 
be processed through a treatment plant at a more   manageable rate. But overflows can also happen 
way upstream of a treatment plant if the pipes   are too small. Sometimes that storage available 
through manholes isn’t enough. I can plug up   the pipe in my demo to simulate this. If the 
sewer lines themselves can’t handle the flow,   you can get wastewater flowing backwards 
in pipes, and if things get bad enough,   you can get releases out of top of manholes. And 
of course, this doesn’t have to be the result of   a storm. Even a blockage or clog in the line can 
cause wastewater to back up like this. Obviously,   having raw sewage spilling to the surface is 
not optimal, and many cities in the US pay   millions of dollars in fines and settlements to 
the EPA for the contamination caused by backups. Another thing this model shows is that not all 
pipes have to come in at the bottom. They call   this a drop manhole when one of the inlets is 
a lot higher than the outlet. The slope of a   sewer line is pretty important. I’ve covered that 
topic in another video.  There’s a minimum slope to   get good flow, but you don’t want too much slope 
either. Wastewater often carries rocks and grit,   so if it gets going too quickly, it can wear 
away or otherwise damage the pipes. So if   you’re running a line along a steep slope, 
sometimes it’s a better design to let some   of that fall happen in a manhole, rather than 
along the pipe. It’s not normally done this   way where my pipe just juts in. You usually 
don’t want a lot of splashing and turbulence   in a manhole, again to avoid damage, but 
also to avoid smells. So most drop manholes   use pipes or other structures to gently 
transition inlet flow down to the bottom. I hope it’s clear how useful manholes are 
by now. Doing it this way - by making the   plumbing junctions into access points - just 
provides a lot of flexibility, while also kind   of standardizing the system so anyone involved, 
whether its a contractor building one or a crew   doing maintenance, kind of knows what to expect. 
In fact, if you live in a big city, there’s a good   chance that the sewer authority has standardized 
drawings and details for manholes so they don’t   have to be reinvented for each new project. 
In many cases, they’re just precast concrete   cylinders placed into the bottom of an excavation. 
Those cylinders sit on temporary risers, and then   concrete is used to place the bottom, often with 
rounded channels to smooth the transition into   and out of the manhole. I did a video series 
on the construction of a sewage lift station   and showed how a few of these are built if you 
want to check that out after this and learn more. Constructing manholes reminds of that famous 
interview riddle about why manhole covers   are round. There’s a lot of good answers: a 
round object can’t fall down into the hole,   it can be replaced in any orientation, it’s easy 
to roll so workers don’t have to lift the entire   weight to move it out of the way. A professor of 
mine had an answer that I don’t think I’ve heard   before. Manhole covers are round because manholes 
are round. It’s almost like asking why pringles   lids are round. And manholes are round for a 
lot of good reasons: it’s the best shape for   resisting horizontal soil loads. It’s easier to 
manufacture a round shape than a rectangular one.   For those reasons, manholes are usually made of 
pipes, and pipes are round because it’s the most   efficient hydraulic section. It’s one of those 
questions, like the airplane on a treadmill,   that can spawn unending online debate. But 
I like pipes, so that’s my favorite answer. I love learning about what’s happening below the 
surface, especially when you can see the stuff   that’s normally hidden. I do my best to show that 
with models, but one of my favorite creators, neo,   does it with beautiful 3D graphics. He recently 
finished a video about the construction of the   World Trade Center towers in New York City. It’s 
a fascinating look into how much effort, care,   and engineering went into these buildings 
before the 2001 attack brought them down.   My favorite part was the design of the 
slurry wall foundation, and of course,   the 3D animations. And if you want to check 
it out, it’s only available on Nebula. You’ve heard me talk about Nebula before. It’s 
a streaming service built by and for independent   creators, including a lot of my favorites like 
Neo, Wendover Productions, the Coding Train,   and Branch Education. I don’t know about 
you, but independently-produced content   is most of what I watch these days. I just 
like the authenticity and thoughtfulness of   videos that haven’t been through ten levels of 
studio executives watering the information down   to capture the widest audience possible. 
I just think passionate individuals and   small teams make the most compelling work, 
and Nebula is the perfect place for it. Nebula’s totally ad-free, with tons of excellent 
channels and lots of original series and specials   like Neo’s video on the Twin Towers. It’s also a 
great gift, especially because a yearly membership   is 40% of the link in the description. At 
thirty-six bucks for a year, that’s pretty   tough to beat. My videos go live on Nebula before 
they come out on YouTube. If you’re with me that   independent creators are the future of great 
video, I hope you’ll consider subscribing.   That’s go.nebula.tv/Practical-Engineering. Thank 
you for watching, and let me know what you think!

---

## 26. Why are the Dutch So Good at Waterworks?
**Channel:** Practical Engineering | **Views:** 3.1M | **Date:** 1 year ago | **Duration:** 22:20 | **ID:** qQCB3N8Vaxk
**Link:** https://youtube.com/watch?v=qQCB3N8Vaxk

### Transcript:
This is the Veluwemeer Aqueduct 
in Harderwijk, Netherlands. It   solves a pretty simple problem. If you put a 
bridge for vehicles over a navigable waterway,   you often have to make it either very high up with 
long approaches so the boats can pass underneath   or make it moveable, which is both complicated 
and interrupts the flow of traffic, wet and dry.   But if you put the cars below the water, both 
streams of traffic can flow uninterrupted with   a fairly modest bridge. Elevated aqueducts aren’t 
that unusual, but this one is just so striking to   see, I think, because it looks just like a 
regular highway bridge, except…the opposite. When I was a little kid, I read this book, The 
Hole in the Dike, about a Dutch boy who plugged   a leak with his finger to save his town from 
a flood. And ever since then, as this little   kid grew up into a civil engineer with a career 
working on dams and hydraulic structures, I’ve   been kind of constantly exposed to this idea that 
the Netherlands is this magical country full of   fascinating feats of civil engineering, like Willy 
Wonka’s chocolate factory but for infrastructure.   I’m not necessarily proud to say this, but I think 
it’s true for a lot of people (especially here in   the US) that my primary cultural touchpoint with 
the Netherlands is just that they’re really good   at dealing with water. You know, you don’t have 
to browse the internet for very long to find   viral (and sometimes dubious) posts about Dutch 
infrastructure projects. Sometimes, it feels like   half of my comment section on YouTube is just 
people telling me that the Dutch do it better. I’m naturally skeptical of things that seem 
larger-than-life, especially when it comes   to engineering. And without context, I think 
it’s hard to separate myth from facts (this   TikTok video being a myth, by the way.) Here’s 
the actual scale of a cruise ship compared to   the aqueduct. So let’s take a look at a few 
of these projects and find out if the Dutch   really have the rest of the world outclassed 
when it comes to waterworks. And I’ll do my   best to pronounce the Dutch words right too. 
Ik ben Grady, en dit is Practical Engineering. The first hint that the Dutch really do lead the 
world in water infrastructure is in the name of   the country itself: The Netherlands 
translates literally to the lowlands,   and that’s a pretty good description. A large 
portion of the country sits on the delta of   three major rivers - the Rhine, the Maas, and the Scheldt - that drain   a big part of central Europe into the North Sea. 
Those rivers branch and meander through the delta,   forming a maze of waterways, islands, inlets, 
and estuaries along the coast. About a quarter of   the country sits below sea level, which creates a 
big challenge because it’s right next to the sea! As early as the Iron Age, settlers were involved 
in managing water. Large areas of marshland were   drained with canals and ditches to convert them 
into land that could be used for agriculture.   These plots of land, which, through human 
intervention, were hydrologically separated   from the landscape, became known as polders. And 
the tradition of their engineering would continue   for centuries to the present day. Unfortunately, 
that marshland, being full of organic material,   decomposed over time. That, combined 
with the drainage of groundwater,   caused the polders to sink and subside, 
increasing their vulnerability to floods. And that is kind of the heart of it. 
The Netherlands is a really valuable and   strategic area for a lot of reasons: it’s flat; 
it has great access to the sea and major rivers   providing for fishing and trade; it has prime 
conditions for farming and pastures, making   it the second largest exporter of agricultural 
products in the world. The problem is that all   those factors come with the downside of making the 
country extremely susceptible to floods, both from   the North Sea and the major rivers that flow into 
it. So for basically all of its history, people   were building dikes, embankments of compacted 
soil meant to keep water out of low-lying   areas. Over the centuries, huge portions of the 
sinuous Dutch coastline became lined with dikes,   and the individual polders were often ringed with 
dikes as well to keep the interior areas dry. Of course, you still get rain inside a polder, 
plus irrigation runoff and sometimes groundwater,   so they have to be continuously pumped out. And 
before the widespread use of electric motors and   combustion engines, the Dutch used the source of 
power they’re famous for: the wind. Windmills - or   more accurately windpumps, since they weren’t 
milling anything in this context - could be   used to turn paddle wheels or Archimedes 
screws to move water up and over dikes,   keeping canals and ditches within the polders from 
overflowing. Over time, poldering dry-ish land,   the Dutch realized they could use exactly the same 
technique to reclaim land from lakes. Typically   land reclamation is done by using fill - soil and 
rock brought in from elsewhere to raise the area   above the water. But it’s not the only way to 
do it, and it’s not that useful if you want to   use that area for agriculture since the good 
soil is under the fill. Another option is to   enclose an area below the water level, and 
then just get rid of the water. In this way,   you can create arable land just for the cost of a 
dike and a pump. If you love cheese, you might be   interested to learn that one of the first polders 
in the Netherlands reclaimed from a lake was   Beemster. The soil of the ancient marsh provides 
a unique flavor of the famous Beemster cheese. One glaring issue with reclaiming land by drawing 
down the water instead of building up is that the   low-lying polders are still vulnerable to 
floods. In 1916, a huge storm in the North   Sea coincided with high flows in several 
rivers, flooding the Zuiderzee,   a large, shallow bay between North Holland 
and Friesland. The flood broke   through several of the dikes, leading 
to catastrophic damage and casualties.   Although the idea had been in discussion 
for years, the event provided the impetus   for what would become one of the grandest 
hydraulic engineering projects in the world. One of the major issues with the Zuiderzee flooding from a surge in the   level of the North Sea is the sheer length 
of the coastline that has to be protected.   Building adequately large and strong enough 
dikes to protect it all would be prohibitively   expensive and just plain unrealistic. So Dutch 
engineers devised a deceptively simple solution:   just shorten the coastline. If the effective 
coast of the Zuiderzee could be   substantially shorter, resources could 
go a lot further toward protecting the   area against floods. So that’s just what they did. Between the late 1920s and early 1930s, a 
20-mile (or 32-kilometer) dam and causeway   called the Afsluitdijk was built across the Zuiderzee,   cutting it off from the North Sea. 
Construction spread outward from four points,   the coast on either side, and two small 
artificial islands built specifically   for the project. The original dam was built 
from stones, sand, glacial till, stabilizing   “mattresses” of brushwood, and thousands 
upon thousands of hand-laid cobblestones. Cutting off the Zuiderzee
from the ocean turned it into a large,   and ultimately freshwater lake called the 
IJsselmeer, named for the river that   empties into it. But that inflow is an engineering 
challenge. Without a way for it to reach the sea,   the lake would just overflow. So, these sluices 
are like gigantic outflow valves that allow   excess freshwater constantly building up in the 
Ijsselmeer to be discharged into   the sea, as it would have been back when it was 
still the Zuiderzee. The sluices,   which are titanic hydraulic engineering structures 
themselves, typically use gravity to drain water   during low tide. When that passive discharge 
isn’t enough, new high-volume pumps can be   used to make sure the level of the Ijsselmeer 
stays within the ideal range. Over the last few years, the Afsluitdijk 
has been undergoing a   major facelift. With sea levels rising and the 
frequency of extreme weather events rising with   it, the Dutch have completed a major overhaul, 
raising the crest of the dam by about 2 meters,   adding thousands of huge concrete blocks to 
break waves and strengthen the structure.   The larger blocks that are always in 
contact with the sea are truly gigantic,   over 70,000 of them weighing 
six and a half metric tons EACH! The project also included upgrades to the lock 
complexes and sluices. And the highway that runs   along the top is also getting upgrades (including, 
in true Dutch fashion, the bike lanes too). And   human passage isn’t the only consideration 
for the project either. The Fish Migration   River will allow fish to swim between the North 
Sea and the IJsselmeer and river   ecosystems upstream. The stark contrast between 
freshwater and saltwater is hazardous to fish,   so the migration river spreads out the salinity 
gradient into something more manageable. It’s like   a fish ladder, but on top of having an elevation 
gradient, it also is a ramp of saltiness. With the shallow Zuiderzee
protected from the North Sea,   the Netherlands saw an opportunity to increase 
its food supply by creating new land. Over the   middle decades of the 20th century, the Dutch 
built four gigantic polders in areas that   were once the seafloor. These polders were 
built using the same principles as before,   just with scaled-up 20th-century technology. 
There are even examples of our old friends,   Archimedes screws being used, albeit with modern 
electric motors. Wieringermeer   and Noordoostpolder were built 
first, but the Dutch faced a problem. With such   large areas of land dried up, the groundwater in 
adjacent areas flowed out and into the polders,   causing subsidence and loss of freshwater 
needed for agriculture. The following polders,   a pair of adjacent tracts called Eastern 
and Southern Flevoland,   avoided this by retaining a small series 
of connected lakes. These bordering lakes   keep the polders hydrologically isolated from the 
mainland, and this is also where you’ll find the   Veluwemeer aqueduct. The later three 
polders became Flevoland, a totally   new province of dry land reclaimed from the sea. 
A succession of carefully selected crops were   grown to rehabilitate the salty soil, making it 
fertile enough to farm. All you need to do to see   how well it worked is look at these aerial photos 
of all the farmland in Flevoland! There were plans for a fifth polder called 
the Markerwaard, and a huge   dike was actually constructed for it. Hangups 
going as far back as the German Occupation of   the Netherlands in the Second World War, to 
later environmental concerns, stopped the   polder from being completed. The dike did create 
another freshwater reservoir, the Markermeer,   and only recently, an artificial archipelago 
called the Marker Wadden was   built as a nature conservation project and host 
to migratory birds, fish, and ecotourists alike. Even as the Zuiderzee Works 
protected parts of the Netherlands,   many parts of the country were still facing 
threats from flooding. In the winter of 1953,   an enormous storm in the North Sea raised a 
major storm surge, crashing into the delta,   causing floodwaters to overwhelm much of the 
already existing and extensive flood control   structures of the Netherlands. A staggering 9% 
of all of the farmland in the whole country was   flooded, 187,000 farm animals drowned, nearly 
50,000 buildings were damaged or destroyed,   and over 1,800 people perished. It was one of the 
worst disasters in the history of the country. Just as with the Zuiderzee, the 
extraordinary length of the coastline of this area   meant that adequately strengthening all the dikes 
in response to the storm wasn’t feasible. So,   an incredibly intricate plan called the 
Deltawerken or Delta Works was put into   motion to effectively shorten the coastline 
with a series of 14 major engineering projects,   including dams, dikes, locks, sluices, and more. 
Unlike with the Zuiderzee Works,   fully enclosing the area and cutting off the 
sea wasn’t an option. Firstly, the Rhine and   Meuse/Maas have gigantic flows. The 
Rhine is one of the largest rivers in Europe,   and that can’t just be walled off. There are also 
concerns about environmental impacts and ensuring   the easy movement of the huge amount of shipping 
that uses this waterway. So, many of these   structures have to be functionally non-existent 
until they’re needed. The resulting projects,   along with the Zuiderzee works, have 
shortened the Dutch coast by more than half since   the 19th century. These feats are so impressive 
they are on the American Society of Civil   Engineering’s list of wonders of the modern world. 
And it’s easy to see why when you take a look.  This is the Oosterscheldekering, the largest of all the Delta Works.   It was initially designed 
to be a closed dam, similar in some ways to   the Afsluitdijk. If constructed 
as initially conceived, it would create another   large freshwater lake. But, by the time it was 
under construction in the 1970s, environmental   impacts were much more appreciated than they were 
in the 20s and 30s. So the dam was designed to   include huge sluice gates to allow massive tidal 
flows during normal conditions while retaining the   ability to fully close off the inland portion of 
the Delta from the sea during storm conditions. The Oosterscheldekering
comprises two artificial islands and three storm   surge barrier dams connecting them. The 
larger of the islands also contains a lock,   allowing for ships to pass through. 
The floodgates are staggering in scale;   there are 62 steel doors, each 138 feet 
(or 42 meters) wide and weighing up to 480   metric tons! Even the piers between them were 
a monumental effort. They were built offsite,   maneuvered into place with custom-built ships, 
then filled with sand and rock to sink them   into place. Special ships also had to compact the 
seabed with vibration before placing the pillars. Another notable structure in the Delta Works is the  Stormvloedkering Hollandse IJssel, 
a storm surge barrier protecting Europe’s   largest seaport. The project has it all: 
a lock to allow for the passage of ships,   a bridge for road traffic with a fixed truss and 
a moveable bascule portion crossing the lock,   and two gigantic, moveable storm surge barriers 
crossing the main sluice. Each of these barriers   is strengthened by a truss arch which makes them 
look like sideways bridges when viewed from above. And then, there’s the Maeslantkering.  This is 
probably the most impressive storm surge barrier   on the planet. Those tiktoks showing out-of-scale 
cruise ships crossing Veluwemeer  should have just shown actual gigantic ships 
cruising through the huge ship canal safeguarded   by the Maeslantkering. It’s hard to communicate 
the scale of the two gates; they’re considered   one of the largest moving structures on earth. And 
moving them is a process. The gates normally sit   in dry docks. When it’s time to close them, the 
dry docks are flooded, and the hollow gates float   in place. Then they’re pivoted around gigantic 
ball-and-socket joints at the ends of the truss arm.  Each door is 690 feet (or 210 meters) wide, 
and once in place, they are flooded with water,   so they sink to the bottom, completely 
blocking even the fiercest storm surge. In the   event that the doors remain closed long enough for 
the flow of the Rhine to build up dangerously high   on the inland side, they can be partially floated, 
allowing for excess river water to run out to sea. Since its completion in 1997, aside from annual 
testing, the Maeslantkering  has only been closed twice: once in 2007 
and again in 2023. And to me, that tells   the story of Dutch waterworks more than anything 
else. It’s all a huge exercise in cost-benefit   analysis. Look at two alternate realities: 
one where the Delta Works weren’t built and   one where they were. And then just compare the 
costs. In one case, the costs are human lives,   property damage, agriculture losses from 
saltwater, and all the disaster relief efforts   associated with, so far at least, just 
two big storms. And in the other case,   the costs are associated with designing, building, 
and maintaining an infrastructure program that   rivals anything else on the globe. The question 
is simple: which one costs more? Look at many   other places in the world, and the answer would 
probably be the Delta Works.  Just the capital cost was around $13 billion dollars, and that 
doesn’t include the operation and maintenance,   or environmental impacts of such massive 
projects. But in the Netherlands,   where a quarter of the country sits below sea 
level, it’s a fraction of the cost of inaction. In the United States, most flood control 
projects are designed to protect up to the   1-in-100 probability storm. In other words, 
in a given year, there’s a 99% chance that   a storm of that magnitude doesn’t happen. In the 
Netherlands, those levels of protection are much   higher. River structures go from the 1-in-250 
all the way to 1-in-1,250 and flood protection   from the North Sea goes up to 1 in 10,000-year 
event. It only makes sense because practically   the entire country is a floodplain; massive 
investment in protection from flooding is the   only way to exist. And those projects come with 
other costs too. The Zuiderzee Works  cost the entire area’s fishing industry their 
livelihoods, and some consider converting such   a large estuary into a freshwater lake one of 
the country’s greatest ecological disasters.  So there are no easy answers, and the Netherland's 
battle against the sea will never really be over.   Major waterworks are just the reality of the 
country, and they keep evolving their methods.   One example is the Room for Rivers program which 
is restoring the natural floodplain along rivers   in the delta. Another is the sand engine, an 
innovative beach nourishment project that relies   on natural shoreline processes to distribute sand 
along the coast. The Dutch government expects the   North Sea to rise 1 to 2 meters (or 3 to 7 feet) 
by the end of this century, meaning they’ll have   to spend upwards of 150 billion dollars just 
to maintain the current level of protection. That sounds like a staggering cost, and it is, but 
consider this: that investment in protection for a   major part of the country over three-quarters of 
a century is approximately equal to the economic   impact of Hurricane Katrina, a single storm 
event in the US. Of course, the damage during   Katrina was amplified by engineering errors, and 
we’re far from comparing apples-to-apples, but I   think it’s helpful to look at the scale of things. 
Decisions of this magnitude are difficult to make,   and even harder to execute, because we can’t visit 
those alternate realities to see how they play   out. But what we can do is look at the past to see 
how decisions have played out historically, and   there’s no place on Earth with a longer history of 
major public water projects than the Netherlands.   In fact, the US Army Corps of Engineers and 
the Dutch government agency in charge of   water, the Rijkswaterstaat, 
have had a memorandum of agreement since 2004 to   share technical information and resources about 
water control projects. And in the aftermath of   Hurricane Katrina, the Army Corps consulted 
with the Rijkswaterstaat to help decide how to rebuild New 
Orleans’s flood defense system. In 2021, those systems were put to the test when 
the region was pummeled by Hurricane Ida. It was   an extremely powerful storm, and the torrential 
rains and violent winds did enormous damage.   But the storm surge was repelled by the levees, 
barriers, and floodgates built with the assistance   of Dutch waterworks engineers. Many signs point to 
storms getting stronger and surges getting higher,   which means that practically the whole world 
is in an uphill battle with floods. So we all   benefit from that relatively small country 
with its low-lying delta lands, buttressed   against the sea, and the expertise and knowledge 
gained by Dutch engineers through the centuries. All those barriers along the Dutch coast 
were designed to keep out storm surge,   but I doubt the engineers considered the 
possibility that they could be used for   national defense against international 
thieves. In his recently released memoir,   former British Prime Minister, Boris Johnson, 
revealed a plan he hatched to steal COVID-19   vaccines from the Netherlands in an 
“aquatic raid” after facing hurdles   importing them legally. You could hardly make 
up a story this divisive; it’s got politics,   the pandemic, and covert operations against 
allied countries. But that means you have to   be thoughtful about where you read about it. 
That’s why I use today’s sponsor, Ground News. I’ve talked about Ground News before - it’s a 
really interesting platform that puts news stories   like this in context, providing information 
about each outlet, who they’re owned by,   and how they lean politically, backed by rankings 
for independent news monitoring organizations. You   get these visual breakdowns that help see all this 
context at a glance, but my favorite part is just   having all the article headlines and summaries in 
one place so I can click through to a few of them   from various outlets and compare them myself. You 
can see this story is a headline writer’s dream;   it can be slanted in a lot of different ways. 
They also have a feature called the Blind Spot   that shows you stories mainly covered 
by one side of the political spectrum:   stuff you might totally miss if you only 
follow a few main sources for your news. It can be really frustrating trying to 
follow the news just to get the facts,   especially for controversial subjects like those 
that involve politics, environmental issues, or   ongoing conflicts, where there’s more motivation 
to get a particular narrative across. In that way,   journalism has a lot of power over us, and 
Ground News hands some of that power back to   you. If you’d like a more transparent media 
landscape, they’re offering a huge discount   right now at the link in the description: 50 
percent off the Vantage subscription, which   includes unlimited access to all their features. 
That’s ground dot news slash practicalengineering   or just click the link in the description. Thank 
you for watching, and let me know what you think!

---

## 27. The Hidden Engineering Behind Texas's Top Tourist Attraction
**Channel:** Practical Engineering | **Views:** 1.6M | **Date:** 1 year ago | **Duration:** 20:48 | **ID:** MNexLKROHmY
**Link:** https://youtube.com/watch?v=MNexLKROHmY

### Transcript:
I am on location in downtown San Antonio, Texas, 
where crews have just finished setting up this   massive 650-ton crane. The counterweights are on. 
The outriggers are down. And the jib, an extension   for the crane's telescoping boom, is being rigged 
up. This is the famous San Antonio River Walk,   a city park below street level that winds around 
the downtown district. It’s one of the biggest   tourist attractions in the state, connecting 
shops, restaurants, theaters, and Spanish missions   (the most famous of them being the Alamo). Every 
year, millions of people come to see the sights,   learn some history, and maybe even take a tour 
boat on the water. It’s easy to enjoy the scenery   without considering how it all works. But, how 
many rivers do you know that stay at an ideal,   constant level, just below the banks year-round? 
One of the critical structures that make it all   possible is due for some new gates, and it’s 
going to be a pretty interesting challenge to   replace them without draining the whole river in 
the process. I’ve partnered up with the City of   San Antonio and the San Antonio River Authority 
to document the entire process so you can see   behind the scenes of one of my favorite places. 
I’m Grady, and this is Practical Construction. After a catastrophic flood in 1921 took more than 
50 lives in San Antonio, the city took drastic   measures to try and protect the downtown area from 
future storms. Back when my first book came out, I   took a little tour of some of those measures, one 
historical - Olmos Dam - and one more modern - the   flood diversion tunnel that runs below the city. 
But another of those projects eventually turned   into one of San Antonio’s crown jewels. A major 
bend in the river, right in the heart of downtown,   was cut off, creating a more direct path for 
floodwaters to drain out. But rather than fill   in the old meander, the city decided to keep 
it, recognizing its value as a park. Gates were   installed at both connections, allowing the bend 
to be isolated from the rest of the river. Later   a dam was built downstream on the San Antonio 
River with two floodgates. During normal flows,   these gates control the level upstream on the 
river, maintaining a constant elevation for   the Great Bend and the cutoff. If a flood 
comes, these gates can be shut to maintain   a constant level in the bend, and these gates can 
be opened to let the floodwaters pass downstream. Essentially, this pair of floodgates are pivotal 
parts of the San Antonio River Walk. They hold   back flow during sunny weather to keep water 
levels up, and they lower to release water   during storms to keep downtown from being flooded. 
They were installed way back in 1983 and already   planned for replacement. Then this happened. 
One of the floodgates’ gearboxes had a nut   with threads that had worn down, and eventually 
stripped out. It caused one side of the gate to   drop, damaging several components and rendering 
the floodgate inoperable. The City of San Antonio   immediately installed stop logs upstream of the 
gate to block the flow and prevent the water level   in the River Walk from dropping. But the gate is 
still unable to lower in the event of a flood,   halving the capacity of this important dam. So 
they sprung into action to design replacements   for these old gates. It’s been a long road finding 
a modern solution that fits within this existing   structure. But it’s finally time to remove the old 
gates and bring this dam into the 21st century. There’s a lot of work to do before the broken 
gate can come out. The first job is just to   get the water out. This dam has a place 
for stoplogs, both upstream and downstream   of each gate. Historically, they’d be wood, hence 
the name, but modern stoplogs are heavy steel   beams that stack together to create a relatively 
watertight bulkhead on either side. Those stoplogs   have been installed since the gate went out of 
service, and while they hold back a whole lot,   they aren’t completely watertight. Inevitably, 
some water gets through to fill up the area   between them, making it challenging to work in 
this area. The contractor has brought in a large   diesel pump and perched it on the bank next to 
the broken gate. They get it running, and it’s not   long at all before the area between the upstream 
and downstream stoplogs is dry enough to work. The first thing to go is the drive shaft between 
the two gate operator gearboxes. When these gates   are functioning, this shaft delivers power to 
the opposite side of the gate and keeps both   sides raising or lowering at the same rate. But 
now it’s just in the way and needs to come out.   It is disconnected, and the crane lowers it to 
the ground. The next piece is the support beam   between the two operators. Same as before: it 
is detached by the crew, rigged to the crane,   and lifted away from the dam. It’s flown 
across the site to the staging area and set   down. All this equipment will eventually 
be hauled away and recycled for scrap. It might be obvious, but even though it’s 
broken, this gate is still attached to the   rest of the dam, at the bottom with hinges, and 
at the top, with the two stems that would raise   and lower the leaf when it was working. Before 
the crew can detach the gate, it will need some   additional support. The crane lowers its hook. 
And the crew wraps two massive chain slings   around it. Then the crane cables up to provide 
support for the gate while it gets detached. It’s not easy doing big projects like this 
in the downtown core of a major city. The   River Authority has had to lease the parking lot 
next door for a place to put the crane and other   equipment. There are strict rules about when 
they can work to make sure the project doesn’t   cause too much disturbance to all the neighbors. 
And, this is part of the River Walk, which means   it's a heavily trafficked pedestrian route. The 
contractor has to set up barricades during work   hours and then take them down at the end of each 
day. They also have safety spotters who make   sure there are no wayward pedestrians or workers 
within the swing of the crane during heavy lifts. If you’ve worked on a device or turned a wrench, 
you’ve probably been faced with a stuck bolt   before. But what do you do if the bolt is as 
big around as your arm? Pretty much the same   thing you’d do at a smaller scale. Apply some 
penetrating oil… Beat it with a hammer… Bring out a hydraulic 
press… And then you just decide to cut the whole   thing off. This gate’s being scrapped anyway so 
there’s no use treating it with kid gloves.  The crew gets out the oxyacetylene torch to cut the 
ears off the top.  First one.  And then the other. Next come the hinge pins that connect the gate 
at the bottom.  A few come out pretty easy.  A few take a little extra effort.  With a chain 
hoist pulling, the hydraulic toe jack pushing,   and a little percussive persuasion, 
this crew eventually gets them all out. Just cutting and hammering and pushing and pulling 
all the connections this gate has to the dam is an   entire day’s work. These are big, heavy items 
in awkward positions, so each time they move,   disconnect, or lift something out of the work 
area, they have to do it thoughtfully and   carefully to ensure it's done safely. By the end 
of the day, the gate is finally free, but the crew   decides to set it down and wait until tomorrow 
for the critical operation of lifting it out. The next morning, it’s time for the big lift. 
The chain slings are re-secured around the gate,   and the crane reaches over the trees and river to 
slowly remove it from the dam. It’s a big moment,   so the whole crew gathers around to watch. 
Safety spotters coordinate with the crane   operator to pull the gate free from the dam, 
then hoist it up and over. Safety personnel   are making sure no one wanders into the area, 
but just in case, a horn sounds when the load   is over the sidewalk.  Eventually, the gate makes 
it to the staging area in the parking lot - on   dry ground for the first time in 40 years. It 
did its job admirably, it was a great gate,   but it’s easy to see from its condition 
that it was definitely time for retirement. With the gate out, a boom lift is lowered 
into the area to help remove some of the   remaining pieces. Most of the day is 
spent cutting and removing pieces of   the gate and attachment hardware. At 
this point, the area will mostly sit   idle while the new gate is being fabricated. 
But there’s more work to do in the meantime. Another part of this project is the nearby pump 
room. The flows in the San Antonio River often   drop to a mere trickle, and this is something 
the city designed for when these gates were   installed back in the 80s. With these gates 
keeping the water up at a constant level,   the River Walk works kind of like a bathtub; it 
takes a big volume of water to fill up the channel   that snakes around downtown. But, if water leaves 
the River Walk faster than it can be replenished,   that level will drop, kind of like trying to 
fill a bathtub without stopping up the drain.   So this dam was designed with a pump to lift water 
from downstream into the channel above if needed. This is a screw pump, one of the oldest and 
simplest hydraulic machines, sometimes called   an Archimedes Screw. A motor turns a steel 
cylinder with a screw inside. As the screw   rotates, water is lifted upwards until 
it spills out at the top. In this case,   it falls into a flume that flows out to the river 
above the dam. It’s ingenious in its simplicity,   and apparently worked great when it was 
first installed. But, not long afterward,   San Antonio built its landmark flood control 
tunnel that allows floodwaters to bypass   downtown. It’s an incredible project of its own, 
and it included the means to recirculate water   in the San Antonio River from downstream to up. 
That keeps the river flowing during dry times,   maintaining the level in the River Walk 
downtown, and rendering the old screw pump   obsolete. So it never got turned on again and 
has been sitting here unused for many years. This new project is going to repurpose 
the area to create a bypass for the two   gates. It will add a bit more capacity, but more 
importantly, it will help create some circulation   in the stagnant area downstream of the dam. 
Still water allows sediment to build up,   collects debris, and grows algae and mosquitoes. 
With the screw pump not running, this area just   doesn’t quite see enough water movement, so the 
bypass will allow it to be easily flushed out   when needed. But first, the screw pump has to 
come out. This is the same story as the gate:   oxyacetylene torches and hammers.  Piece by piece, 
the pump is cut away and hauled off as scrap. With the pump out, the room gets some 
modifications. Some concrete is taken   out… And new concrete is installed to create 
a chute for the water.  And then it gets its   own new gate to control the flow. Luckily 
this small pump room has an overhead crane,   because getting this gate 
into place was a tight fit. Back outside, crews start working 
on the retrofits to the dam to   get ready for the new gate. Unlike the 
electric motors used for the old gates,   the new ones will use hydraulics. These piers 
that flank the gates have to be modified to   fit the new system. The tops of the piers 
get some careful demolition to accommodate   the hydraulic cylinders. And the hinges from 
the old gate still need to be removed. This   area will also have some concrete modifications 
so the new gate fits perfectly in the old slot. Nearly a year after the old gate was cut 
out, the new gate finally arrives on site.   It sounds like a long time, but this project was 
specifically scheduled around the fabrication of   these gates. They aren’t just parts you can pick 
up at the local hardware store. A lot of design,   construction, testing, and finishing touches 
went into each one. And they’re so big, they   have to be delivered in two parts. Today’s job is 
to connect them into a single gate. The halves get   a layer of sealant to prevent leaks, and then 
a whole bunch of bolts to attach them together. And finally, this gate is ready to install. 
You know I love crane day. And it’s even   better when there’s a small crane to assemble 
the big crane. This 650-ton capacity monster   is configured with a luffing jib to reach out 
over the trees and water. But the first step   is to get the gate off the stands. It has to 
be lifted horizontally from these saw horses,   but it will be installed vertically. So 
the gate is rigged for the first lift,   moved to the ground,  and then 
rerigged for the main event. I’m a sucker for heavy lifts so this was 
a pretty fun thing to see in person. It’s   incredible how much work and setup went into 
a milestone that only took less than an hour   to complete. It’s a much slower civil engineering 
equivalent of a rocket launch. The crane   swings the gate up and over the trees and down 
to the dam. As it gets closer, the movements   are slower and more deliberate. Each time the 
crane moves, the crew waits for the massive   gate to stabilize before calling for the next 
step. They carefully move it into position, and   when everything is lined up just right, it sits 
down on the base plates, ready to be connected. While it’s held by the crane, the crews begin 
installing the bolts that attach the gate to the   concrete. This is allowed by safety regulations, 
but only under a set of rigid guidelines,   so safety is at the top of everyone’s mind. A 
detailed lift plan, a pre-work safety briefing,   and several spotters make sure that there 
are no wrong moves. These bolts are torqued   to the specifications one by one, on both 
the upstream and downstream side of the gate.  And once it’s firmly attached, 
the crane lowers it to the ground. The next day, the beam across the top of the piers 
and the hydraulic cylinders are flown into place.   These cylinders will lift and lower the gate, 
working against the immense water pressure   pushing on the upstream face. They’ll attach to 
these beefy hinge points on the side of each gate.   The cylinders are attached to a new hydraulic 
power unit installed in the pump room. This unit   has the valves, pressure regulators, pump, and 
oil reservoir to make these gates operate more   efficiently and reliably than the old electric 
motors did. Everything is operated from the City’s   tower that overlooks the dam. From here, operators 
can control all the city’s flood infrastructure,   including the dams and gates on the river and the 
flood bypass tunnels that run below ground. And   I have to say, it’s a pretty nice view from 
the top. And in fact, some of the timelapse   clips I’ve shown are from a camera mounted 
on top of this structure. This is run by the   US Geological Survey, and I’ll put a link below 
where you can go check out the dam in real-time. Once everything is hooked up, 
it’s time to test this gate out.   Unfortunately, you can’t schedule a flood. Since 
there are just ordinary flows at the moment, the   crews have to be careful not to drain the entire 
River Walk while they do it. The gate gets lowered   just a bit to make sure nothing is binding and 
that the hydraulic system is working. Of course,   it’s a big day to see it all working for the 
first time, so everyone involved in the project   is on-site to see it happen. And the test went 
flawlessly. But it’s not the end of the project. These stop logs were installed in early 2021, 
and it’s finally time to pull them out nearly   four years later. You can see they grew some 
nice foliage during their service. This process   requires a professional diver to rig each one 
for the crane. It’s just one of the many steps   made much more complicated because this structure 
still has to serve its purpose during the entirety   of the project, and more importantly, the River 
Walk can’t be drained. The stop logs get lifted   out of the slots. Then they’re moved directly 
next door to get ready for the next gate. I didn’t document as much of the second 
gate, because it was pretty much identical   to the first one, although it went a lot 
faster since the gate was already ready. The area was pumped out, the old gate removed, 
and the new one lifted into place. And pretty   soon this old dam had two new gates, plus 
a bypass, ready to serve the city for the   next several decades. If you visited the River 
Walk during construction, you wouldn’t have even   known it was happening, and that was the entire 
goal of the project: to revitalize a critical part   of the city’s flood control infrastructure 
without causing any negative impacts on one   of its crown jewels. And being on site to 
see it happen in real time was a lot of fun. I have to give a huge thanks to the City of 
San Antonio, the San Antonio River Authority,   the engineer, Freese and Nichols, 
the general contractor, Guido,   and all their subcontractors for inviting me 
to be a part of this project and document it   for you. It was a pretty incredible experience, 
and I hope it gives you some new appreciation for   all the thought, care, and engineering 
that goes into making our cities run. I am fascinated by heavy construction - I’m sure 
that’s obvious by now. I just think it’s really   interesting to see the creative solutions 
to problems created by scale. One of my   favorite channels, Neo, recently released 
a video about the failed attempt to salvage   a huge piece of the Titanic from the bottom 
of the ocean and the fascinating engineering   involved in the project. It’s a really 
interesting story because of the issues   surrounding the commercialization of a disaster, 
but of course, my favorite part of every Neo video   is the beautiful 3D graphics. And if you want 
to check it out, it’s only available on Nebula. You’ve heard me talk about Nebula before. It’s 
a streaming service built by and for independent   creators, including a lot of my favorites like 
Neo, Wendover Productions, the Coding Train,   and Branch Education. I don’t know about you, but 
independently-produced content is most of what I   watch these days. I just like the authenticity 
and thoughtfulness of videos that haven’t been   through a writer's room and ten levels of studio 
executives. Someone said Nebula’s like Netflix   for people who love trains. And I like that 
comparison, not just because I also love trains. Nebula’s totally ad-free, with tons of 
excellent channels and lots of original   series and specials like Neo’s video 
on the Titanic. It’s also a great gift,   especially because a yearly membership 
is 40% of the link in the description.   My videos go live on Nebula before they 
come out on YouTube. If you’re with me that   independent creators are the future of great 
video, I hope you’ll consider subscribing.   That’s go.nebula.tv/Practical-Engineering. 
Thank you for watching, and let me know what you think! 

---

## 28. The Hidden Engineering of Wildlife Crossings
**Channel:** Practical Engineering | **Views:** 1.4M | **Date:** 1 year ago | **Duration:** 16:56 | **ID:** 5mYpQWPtfpo
**Link:** https://youtube.com/watch?v=5mYpQWPtfpo

### Transcript:
This is the Wallis Annenberg Wildlife Crossing 
under construction over the 101 just outside   Los Angeles, California. When it’s finished in 
a few years, it will be the largest wildlife   crossing on the planet. The bridge is 210 feet 
(64 meters) long and 174 feet (53 meters) wide,   roughly the same breadth as the ten-lane 
superhighway it crosses. Needless to say,   a crossing like this isn’t cheap. The project is 
estimated to cost about $92 million dollars; it’s   a major infrastructure project on par with similar 
investments in highway work. And it’s not the   only example. The Federal Highway Administration 
recently set aside $350 million federal dollar to   fund projects like this. The reasons we’re willing 
to invest so much into wildlife crossings aren’t   as obvious as you might think, and there are 
some really interesting technical challenges   when you’re designing infrastructure for animals. 
I’m Grady, and this is Practical Engineering. Roads fundamentally change the environments 
they cross through. And while on its face,   it might seem that it’s always a 
disaster for wildlife, there are   actually some winners amongst the losers. For 
vultures, crows, coyotes, raccoons, insects,   and other decomposers, roads provide a 
buffet for nature’s scavengers. And they   sometimes make for pretty good housing too, at 
least if you’re a swallow or a bat. In fact,   cliff swallows are now so famous for nesting on 
the underside of highway overpasses that they’re   often referred to as bridge swallows. The sides of 
highways have clear zones kept free from trees and   similar obstacles for vehicle safety, but the 
lack of shade allows tender greens to thrive,   creating a salad bar for species from monarch 
butterfly caterpillars to white-tailed deer. Of course, especially in the case of deer, 
this can attract animals into spending time   eating dinner in danger. And the truth is that 
roads mostly range from a mild inconvenience   to totally catastrophic for wildlife. In the 
battle between the two, wildlife usually loses,   and in more ways than just getting squished. 
The ecological impacts of roads extend beyond   the guardrails. Habitat loss and fragmentation, 
noise pollution, runoff, and of course, injecting   humans into otherwise wild places are all elements 
of the environmental challenges caused by roads.   It’s actually a pretty complicated subject, 
and there are even road ecologists whose   entire careers are dedicated to the problem. 
And it’s not just wildlife that’s affected. According to the Federal Highway Administration, 
there are over 1,000,000 wildlife-vehicle   collisions annually on US roadways. That 
results in tens of thousands of injuries,   about 200 human fatalities, and over 8 billion 
dollars of damages per year. Even if you haven’t   personally been involved in a collision like 
this, there’s a good chance that you know   somebody who has. Along with the astronomical 
numbers reported by the FHA, it’s likely that a   huge portion of wildlife collisions go unreported. 
There are lots cases that just don’t get counted,   like if an animal is too small to notice, 
or if it survives the impact and escapes,   or is collected by somebody practicing 
the dubious art of roadkill cuisine   (yes, that’s a real thing and there are 
multiple cookbooks out there for it). There’s a wide range of consequences from 
animal collisions, from minor vehicle   damage to human fatalities. When you average 
them out, researchers estimate that in 2021,   the average cost of hitting a deer was 
$9,100. Of course, the bigger the animal,   the bigger the economic loss. For a moose, that 
number is over $40,000 per collision. Regardless   of how you might feel about environmental 
issues and wildlife, the economic impacts   alone can justify the sometimes enormous costs 
required to let them safely cross our roadways. Luckily for the animal and human populations 
alike, there’s been increasing interest in   reducing the negative impacts roads have on 
wildlife over the past few decades.   I’m no stranger to infrastructure built for animals. It 
is fairly unusual for fish to get hit by cars,   but they have their own manmade barriers to 
overcome, and I released a series of videos   on fish passage facilities for dams you 
can check out after this if you want to   learn more. Like aquatic species, there is 
a lot of engineering involved in getting   terrestrial animals across a barrier. But 
fortunately, a lot of that research and   guidance has been summarized in a detailed 
manual. I may not be a road ecologist,   but I am an engineer, and I love a good 
Federal Highway Administration handbook! One of the most important decisions about building 
a wildlife crossing is where to put one. You might   imagine that the busiest roads are where most 
of the collisions occur. And it’s true up to a   point. As the number of cars on a road increases, 
the percentage of wildlife crossing attempts that   end in a safe critter on the other side drops, 
and the fraction that are killed grows. But,   if we keep increasing the daily traffic 
numbers, something unexpected happens:   the number of “killed” animals declines! 
Eagle-eyed viewers may realize that so far,   this graph is incomplete; these percentages don’t 
add up to 100%. That’s because there’s a third   category: “repelled” animals. As highway 
traffic increases, you reach a point where   the vehicles form a kind of moving fence, and 
all but the most brazen bucks will turn away. Road ecologists sometimes struggle to drum up 
support for wildlife crossings at high-traffic   freeways (like the Annenberg crossing in LA) 
because of this effect. For some people, if they   don’t see actual road kills on the shoulder, they 
struggle to accept the greater impact on wildlife   populations. Habitat fragmentation caused 
by roads can be difficult for any species,   but it’s especially hard-hitting for migratory 
species who HAVE to cross in order to survive   and reproduce. For example, following the 
opening of I-84 in Idaho, biologists recorded   the starvation of hundreds of mule deer mired 
in the snow, unable to cross to food sources. And it’s not quite as simple as the graph makes 
it seem. A study by Sandra Jacobsen breaks down   animals into four categories of crossing style.  Some animals, like frogs, are non-responders   who cross roads as if they aren’t there at all. 
Their wild instincts compel these animals to cross   without regard for their own safety, and they’re 
often too small for most motorists to notice. Next, you have the pausers, like turtles. These 
creatures, when spooked on the road or elsewhere,   instinctively hunker down and stay put. While the 
shell of a box turtle might be impenetrable to a   curious coyote, it is, sadly, no match for a box 
truck. Then you’ve got avoiders. This group often   includes the most intelligent members of the 
local fauna. Grizzly bears, cougars, and other   carnivores often fall into this category. For 
them, even low-traffic rural backroads can cause   significant issues with habitat fragmentation, 
leading to poor genetic diversity. The small gene   pool of a number of southern California cougars 
is one of the major drivers of the construction   of the Annenberg bridge. Deer fall into the last 
category, speeders. As the name implies, these are   fast, alert animals who, given the chance, will 
burst across a road to get to the other side. But even these categories have their exceptions. 
The poster-cat of the US-101 project,   a cougar called P-22, famously crossed the 
10-lane highway and took up residence in the   shadow of the Hollywood sign. There just is no 
one-size-fits-all approach for getting animals   across roads. Engineers and ecologists use a wide 
variety of mapping, including aerial photography,   land cover, topography, habitat, plus ecological 
field data and even roadkill statistics to choose   the most appropriate locations for new 
wildlife crossings. And in many cases,   what works for one species may be completely 
ineffective for another. So most designs are   made for a so-called “focal species,” with 
the hope that it works well for others too. But before you have a crossing, you have 
to get the animals to it. In most cases,   that means fences, and even that is complicated. 
Do the focal species have a habit of digging under   fences like badgers or bears? Well, then 
you’ll want to bury a few feet of fence   to maintain its integrity. And where do they 
start and stop? Ideally, fences will terminate   in areas that are intentionally hard to cross 
so animals don’t end up in a concentrated path   across roadways. Sometimes boulders will 
be placed at the end of a wildlife fence   to make it less likely that animals will 
choose to wander on the wrong side. But,   inevitably, it happens. You don’t want to 
trap animals on the highway side of a fence,   so many feature ramps or “jumpouts” that act 
almost like one-way valves for animals. There are   even hinged doors for moderate-sized animals that 
allow wayward creatures to escape through fences. Once you’ve got a site selected, the next big 
choice is over or under. It turns out that   going under a road is often the easiest option. 
In fact, in many cases, existing bridges and   viaducts can naturally create opportunities 
for wildlife to get across our roadways.   Sometimes it’s as simple as building fencing 
to funnel animals into existing underpasses. Another option for small animals is to use 
culverts as crossings. The engineering and   materials for culverts are pretty well established 
since they’re used so much for getting drainage   across roadways, so it’s not a big leap to do it 
with animals too. But it can be tricky getting   them to use it. Since amphibians are also pretty 
lousy at walking long distances, it’s common to   have many small tunnels installed near one another 
with special fencing to maximize survival. In some   cases, they’re combined with buried collection 
buckets. During peak migration periods,   the buckets are checked, and collected amphibians 
are manually transported across the road! Larger animals won’t fit in a culvert (or a 
bucket), but there are some special considerations   to getting them to travel beneath a highway 
bridge. Many animals are hesitant about dark areas   during the daytime, so it's important to get as 
much natural light in as possible. Lighting also   affects the vegetation that grows under a bridge. 
More light means more natural-feeling areas, which   means more animals will be willing to cross under. 
And of course, keeping people out is important   too. Disturbance from the public can really affect 
animals' willingness to incorporate a new, unusual   route into their routine. Many crossings are 
designed with cover objects like logs, rocks, and   brush that can help encourage a wider variety of 
wildlife to take advantage of the intended path. But, for some species, underpasses just don’t 
work at all. You can’t FORCE a moose to do   anything really, especially something like 
walking through a tunnel it doesn’t trust.   In certain instances, the only effective 
way to allow safe passage across a road   is over the top.  For some particular 
focal species, an overpass might not   need to be that grand. Canopy bridges just 
connect trees on either side of a road so   primates and other tree-living creatures 
can get across. In Longview, Washington,   there’s even a series of tiny bridges for 
squirrels, like the famous “Nutty Narrows” bridge. Of course, the most impressive, usually the most 
effective, and often the most expensive wildlife   crossings are designed as overpass bridges. 
Examples include the famous ecoducts of the   Netherlands, overpasses of the Canadian Rockies 
in Banff National Park, and American structures   like the Wallis Annenberg Wildlife Crossing. I 
actually have one of these nearby. Opened in 2020,   the Robert LB Tobin Land Bridge crosses the 
six-lane Wurzbach Parkway in San Antonio,   Texas. These are full-on bridges designed 
specifically for the use of animals. Structures like these have all the same 
design issues as regular bridges for humans,   plus their own engineering challenges 
as well. They have to hold up their own   weight with a significant margin of safety, be 
designed to weather the elements for decades,   and be inspected just like other bridges. They 
ALSO have to be engineered to be covered in   thick layers of soil and vegetation (sometimes 
including trees), and be sized appropriately   to accommodate focal species that might travel 
in huge herds or be wary of tight spaces. They   have to be built to provide appropriate lines of 
sight for nervous crossers and often have walls   that shield wildlife from the noise and light 
of the traffic below. One fun upside is that,   at least in mountainous areas, the approaches 
can be a lot steeper than you might use for   a vehicular bridge. An elk is pretty 
well suited for off-roading after all. As for the design of the bridges themselves, 
they’re built a lot like highway bridges, usually   beam bridges or arches, just with dirt instead of 
concrete for the deck. While the distance across   a highway is long for a wandering moose, it’s 
not generally enough to require a structure of   more heroic engineering like cable-stayed or 
suspension bridges. Unlike vehicular bridges,   the approaches often flare out when viewed from 
above, making it easier for animals to locate the   bridge and for better sight lines across it. This, 
plus the fact that they are usually covered in   native vegetation, means that wildlife overpasses 
are among the most striking bridges you can see.   It also means that from the perspective of the 
wildlife crossing them, these bridges can blend   into the scenery. Ideally, a herd of pronghorn 
wouldn’t even realize they’re on a bridge at all. It’s hard to think of any humanmade structures 
that have transformed the landscape more than   modern roadways. They have an enormous 
impact on so many aspects of our lives,   and it's easy to forget the impact they have 
on everything else that we share the landscape   with. Sometimes when it comes to mitigating 
the negative impacts of roads on wildlife,   the best thing is to just be more careful 
about where or IF we build a road at all.   But for many of the roads we already have 
and the ones we might build in the future,   it just makes sense - for safety, the economic 
benefits, and just being good stewards of the   earth - to make sure that our engineering 
lets animals get around as easily as we can. I really like diving into topics like wildlife 
crossings because of their relevance to our   particular point in time. With the new 
federal funding and engineering guidance,   I think we’re going to start seeing a lot 
more of them in the near future. I do my best   to stay up to date with what’s happening with 
infrastructure around the world. For example,   recently, two undersea communication 
cables in the Baltic Sea were damaged,   causing disruptions between European countries. 
It might not seem like a controversial topic   until you look at how different news agencies 
covered the story. Some offer a neutral tone,   given that the cause of the damage is 
still unknown. Others frame the story   around who might be responsible. This is 
why I use today’s Sponsor, Ground News. Ground News aggregates major news stories and adds 
context to make reading the news easier and more   effective. This story on the fiber optic cables 
was covered by more than 75 outlets; you can see   how just reading a single one might not give you 
a comprehensive viewpoint. Every story comes with   quick visual breakdowns and tags for political 
bias, factuality, and ownership of the sources   backed by ratings from independent news monitoring 
organizations. For this story, you can see that   the reporting is pretty equal across the political 
spectrum. Half are media conglomerates and a   quarter of the outlets have been rated low or 
mixed factuality. They also have a feature called   the Blind Spot that shows you stories mainly 
covered by one side of the political spectrum:   stuff you might totally miss if you only 
follow a few main sources for your news. It can be really frustrating trying to 
follow the news just to get the facts,   especially for controversial subjects like those 
that involve politics, environmental issues, or   ongoing conflicts, where there’s more motivation 
to get a particular narrative across. In that way,   journalism has a lot of power over us, and Ground 
News hands some of that power back to you. If   you’d like a more transparent media landscape, 
they’re offering a huge discount right now for   the holiday season at the link in the description: 
50 percent off the Vantage subscription, which   includes unlimited access to all their features. 
That’s ground dot news slash practicalengineering   or just click the link in the description. Thank 
you for watching, and let me know what you think!

---

## 29. What’s the Deal with Base Plates?
**Channel:** Practical Engineering | **Views:** 3.6M | **Date:** 1 year ago | **Duration:** 13:31 | **ID:** nGa1244hK9Y
**Link:** https://youtube.com/watch?v=nGa1244hK9Y

### Transcript:
A lot of engineering focuses on structural 
members. How wide is this beam? How tall   is this column? But some of the most important 
engineering decisions are in how to connect those   members together. Take a column, for example. 
You can’t just set it directly on a foundation,   at least not if you want it to stay up. 
It needs a way to physically attach to   the foundation. This may seem self-evident, 
maybe even completely obvious to most. But   in that humble connection that’s so 
ubiquitous you rarely even notice it,   there is so much complexity. Baseplates are the 
structural shoreline of the built environment:   where superstructure meets substructure. 
And even understanding just a little bit   of the engineering behind them can tell 
you a lot of interesting things about   the structures you see in your everyday life. 
I’m Grady, and this is Practical Engineering. Let me start us out with a little demonstration. 
If you’re a regular viewer, you know how much you   can learn from our old friends: some concrete 
and a benchtop hydraulic press. I cast two   cylinders of concrete about a week ago, and now 
it’s time to break them for science. These were   cast from the exact same batch of concrete 
at the exact same time. For this first one,   I’m pushing with a fairly narrow tool. I slowly 
ramp up the force until eventually… it breaks.  I had a load cell below the cylinder, so we can 
see the force required to break this concrete.   This scale isn’t calibrated, so let’s say it 
broke at 1400 arbitrary Practical Engineering   units of force. Practicanewtons? KiloGradys? What 
would you call them? Now let’s do the same thing   with a wider tool. At that same loading, this 
concrete cylinder is holding steady. In fact,   it didn’t break until 3100 units.  Here’s 
a trick question. Was the second cylinder  stronger than the first one? Hopefully 
it’s obvious that the answer is no. Most materials don’t care about 
force. I mean, in the strictest sense,   most materials don’t care about anything. 
But what I mean is that the performance of   a material against a loading condition 
usually depends not on the total force,   but how that force is distributed over an area. 
It’s pressure; force divided by area. Increase   the area, lower the pressure. And pressure 
is what breaks stuff. So that’s what a lot of   baseplates do. They transfer the vertical forces 
of a column to the foundation over a larger area,   reducing the pressure to a level 
that the concrete can withstand. And that’s the first engineering decision when 
designing a baseplate. How big does it need to   be? If you know the force in the column and 
the allowable pressure on the foundation,   you can just divide them to get the minimum area 
of the plate. That’s the easy part. Because steel   isn’t infinitely stiff. If I put this column on 
a sheet of paper, I think it’s clear that there’s   no real load distribution happening here. The 
outside edges of the paper aren’t applying any   of the column’s force into the table; I can just 
lift them. But this can be true for steel too. I   filled up an acrylic box with layers of sand to 
make this clearer. If I use a thin base plate,   the forces from my column don’t distribute 
evenly into the foundation. You can see that the   baseplate flexes and the sand directly below the 
column displaces a lot more. I can try this with   a thicker, more rigid baseplate, and the results 
are a lot different. Much more even distribution   of pressure. So the second engineering decision 
when designing a baseplate is the stiffness of   the plate, usually determined by the thickness 
of the steel, based on the loads you expect and   how far the plate extends beyond the edges of 
the column. And in heavy-duty applications like   steel bridge supports, vertical stiffeners can be 
included to make the connection even more rigid. So far, though, the baseplate isn’t really much of 
a connection. That’s the thing about compressive   loads: gravity holds them together automatically. 
There are no bolts in the Great Pyramid of Giza.   The blocks just sit on top of each other. And 
that could be true for some columns too. The   main load they see is axial, along their 
length, pressing the plate to the ground.   But we know there are other loading conditions 
too. A perfect example is a sign. Billboards   and highway signs are essentially gigantic wind 
sails. They don’t actually weigh all that much,   so the compressive force on their base 
isn’t a lot, but the horizontal forces   from the wind can be significantly higher than 
that. Those horizontal forces can increase the   compression force on one side of the base plate, 
so you have to account for that in the design.   But they also can result in shear and tension 
forces between the baseplate and foundation,   so you’ve got to have something in place to resist 
those forces too. That’s where anchors come in. There are a lot of ways to attach stuff to 
concrete. There are anchors that epoxy into holes,   screw into place, or use wedges to expand into the 
hole. And of course, if you’re extra careful and   precise, you can even embed anchor rods or bolts 
into the concrete while it’s still wet. There’s a   huge variety of styles and materials that offer 
different advantages depending on your needs.   Here’s just one manufacturer’s selection guide 
for the anchors and epoxies they provide. But   like third year engineering students, all of 
those anchors can fail if they’re overloaded.   And they can fail in a lot of different ways 
under tension or shear forces. The anchor rod   itself can fracture or deform. It can lose its 
bond with the concrete and pull out. It can break   out the surrounding concrete. Or if it’s too 
close to the edge, it can blow out the side.   Calculating the strength of the anchor bolt 
and concrete connection against each of these   failure modes is a lot more complicated than just 
dividing a force by a pressure to determine the   baseplate area. So most engineers use software 
that can do the calculations automatically. But, there’s another challenge about 
baseplates I haven’t mentioned yet,   and it has to do with tolerances.  Concrete 
foundations can be pretty precise. As long as you set the forms accurately and make 
them strong enough to avoid deflection   while the concrete is being placed, you can feel 
confident in the dimensions of the structure that   comes out of them. But there’s usually one 
surface that isn’t formed: the top. Instead,   we use screeds and trowels and floats to put a 
nice finish on the top surface of a concrete slab   or pier. But it’s rarely perfect enough to put 
a column directly on top. That’s not to say it   can’t be done. I’ve seen concrete finishing crews 
do amazing work. But it’s usually not worth the   effort to get a concrete surface perfectly level 
at the exact elevation needed for every column,   especially when you have the time pressure 
of concrete setting up. And those tolerances   matter. Just one degree off of level will put a 
16-foot or 5-meter column out of plumb by more   than 3 inches or 80 millimeters. Unless you’re 
in certain parts of Tuscany, that’s not gonna   work. It’s more than enough to misalign some 
bolt holes. And that only magnifies for taller   columns like signpoles. So, we usually need some 
adjustability between the plate and the concrete. Sometimes that means shimming the baseplate to 
get it perfectly level. And the other primary   option is to use leveling nuts underneath 
the plate. I welded up a custom-branded   column and and baseplate that was laser-cut 
by my friends at Send-Cut-Send to show you   how this works. These parts turned out so 
nice. By adjusting these nuts up or down,   I can get the column to point in the exact 
direction required. And I can get it to the   exact right elevation too. But maybe you see the 
problem here. All the work we did to make sure   the baseplate distributes the vertical load even 
across its area is lost. Now the vertical loads   are just being transferred through some shims or 
through the bolts directly into the anchors. So,   in a lot of cases, we add grout between the 
plate and the concrete to bridge the gap. Grout   is basically concrete without the large aggregate, 
mixed with a low viscosity so it flows more easily   into gaps. And it often includes additives to 
prevent it from shrinking as it cures, making   sure it doesn’t pull away from the surfaces above 
and below. When it hardens, the grout can transfer   and distribute the loads into the foundation. 
So if you pay attention to baseplates you see   out in the built environment, you’ll notice 
it’s pretty common that they sit on a little   pedestal of grout and not directly on the concrete 
below. But even this comes with a few problems. First is load transfer. Even with the grout, 
some of the vertical loads are still going   into the anchor bolts that might not have been 
designed for compression. So now we’ve added a few   more new potential failure modes to the laundry 
list: punching through the bottom of a slab, and   buckling of the rod itself. Sometimes contractors 
will use plastic leveling nuts that can hold the   column during construction, but will yield after 
the column’s loaded so the grout supports all   the weight. Second is fatigue. Especially for 
outdoor structures that see wind and vibrations,   the grout under the baseplate might not hold up 
to repeated cycles of loading. Third is moisture.   Grout can trap water, leading to problems with 
corrosion, especially for hollow columns like   sign poles where condensation needs a way out. 
And the grout can hide that corrosion, making it   difficult to inspect the structure. And fourth, 
adding grout below a baseplate is just an extra   step. It’s kind of fiddly work to do it right, and 
it costs time and resources that might otherwise   be spent somewhere else. In fact, there are a lot 
of cases where it’s an extra step worth skipping. You can design anchor bolts strong enough to 
withstand all the forces a column will apply,   including the compressive forces downward. 
And you can design a base plate stiff enough   that those forces don’t have to be distributed 
evenly across the entire area. And if you do,   you have a standoff base plate. It just floats 
above the concrete with only the anchors in   between. It looks like a counterintuitive design. 
We think of a baseplate as kind of a shoe, so it   should be sitting on the ground. And a lot of them 
are designed that way. But for other structures,   a baseplate is really just a way to connect 
a foundation to a column through an anchor.   So if you pay attention, you’ll see these 
standoff baseplates everywhere. A lot of   state highway departments have moved away 
from using grout to make signs and light   poles easier to inspect. And they often install 
wire mesh to keep animals out from hollow masts. Clearly there’s a lot more to baseplates than 
meets the eye, and that means there’s also a   few myths going around grout there. A common 
misconception is that standoff baseplates are   meant to break away in the event of a collision. 
And I totally understand why. If an errant vehicle   hits a signpost, a relatively minor deviation 
from the road can turn into a deadly crash.   Smaller signs installed near roadways often do 
use breakaway hardware or features. You’ll often   see holes drilled in wooden posts, bolts 
with narrow necks meant to snap easily,   or slip bases like this one to make sure a 
sign gives way. But for larger structures like   overhead signs and light poles, that’s generally 
not the case. Having one of these break away   and fall across a highway could create an even 
bigger danger than having it stay upright. So,   even though they might look similar, standoff 
baseplates are distinct from sign mounts   designed to break loose in a collision. 
Instead, larger structures installed in   the clear zones of highways are protected from 
crashes using a guardrail, barrier, or cushion. Baseplates are like bass parts in music, 
it’s easy to overlook them at first,   but once you notice them, you can’t stop paying 
attention to how important a role they play.   And just like bass lines, they 
might seem simple at first,   but the deeper you dig, the more you 
realize how complex they really are. I like that analogy because there are a lot 
of similarities between music and engineering,   and even though I’m not a musician myself, I 
follow a lot of creators who are. One of my   favorite channels, Polyphonic, has a series called 
Polyphonic Magazine, which are short, super visual   profiles of interesting musicians working in the 
field. I love biographies; I have since I was a   kid. I’ve always been fascinated with the paths 
different people take through life, so these   really cool animated interviews are just right up 
my alley. And they’re only available on Nebula. I talk about Nebula a lot. It’s a streaming 
service built by and for independent creators,   like Adam Neely, Mary Spender, and Minute Physics. 
After the major overhaul of the home page, making   it easier to find new stuff to love, we’ve leaned 
into producing really good original content,   like Polyphonic Magazine; basically allowing your 
favorite creators to make bigger budget videos   without the fear of having it flop on YouTube’s 
algorithm. That means you get more creative,   interesting, and thoughtful videos. My videos 
go live on Nebula before they come out here,   and right now, a subscription is 40% 
off at the link in the description. Plus if you already have a subscription, it also 
makes a great gift. Give someone you love a year’s   worth of thoughtful videos, podcasts, and classes 
from their favorite creators. It’s 40 percent off   either way at nebula.tv/practicalengineering for 
yourself or gift.nebula.tv/practical-engineering   for a friend. Thank you for watching, 
and let me know what you think!

---

## 30. Which Power Plant Does My Electricity Come From?
**Channel:** Practical Engineering | **Views:** 798K | **Date:** 1 year ago | **Duration:** 23:17 | **ID:** sH1PVVJuBtE
**Link:** https://youtube.com/watch?v=sH1PVVJuBtE

### Transcript:
In June of 2000, the power shut off across 
much of the San Francisco Bay area. There   simply wasn’t enough electricity to meet demands, 
so more than a million customers were disconnected   in California's largest load shed event 
since World War II. It was just one of the   many rolling blackouts that hit the state in the 
early 2000s. Known as the Western Energy Crisis,   the shortages resulted in blackouts, soaring 
electricity prices, and ultimately around 40   billion dollars in economic losses. But this time, 
the major cause of the issues had nothing to do   with engineering. There were some outages and a 
lack of capacity from hydroelectric plants due   to drought, but the primary cause of the disaster 
was economic. Power brokers (mainly Enron) were   manipulating the newly de-regulated market for 
bulk electricity, forcing prices to skyrocket.   Utilities were having to buy electricity 
at crazy prices, but there was a cap on how   much they could charge their customers for the 
power. One utility, PG&E, lost so much money,   it had to file for bankruptcy. And Southern 
California Edison almost met the same fate. Most of us pay an electric bill every month. It’s 
usually full of cryptic line items that have no   meaning to us. The grid is not only mechanically 
and electrically complicated; it’s financially   complicated, too. We don’t really participate 
in all that complexity - we just pay our bill   at the end of every month. But it does affect us 
in big ways, so I think it’s important at least   to understand the basics, especially because, 
if you’re like me, it’s really interesting   stuff. I’m an engineer, I’m not an economist 
or finance expert. But, at least in the US,   if you really want to understand how the power 
grid works, you can’t just focus on the volts   and watts. You have to look at the dollars too. 
I’m Grady, and this is Practical Engineering. Electricity is not like any normal commodity we 
buy and sell. You can’t really go to the store and   pick up a case of kilowatt-hours. It can’t really 
be stored or stockpiled on an industrial scale,   which means it has to be created at essentially 
the exact instant it's needed. And the demand is   fairly inelastic. We want our lights, stoves, 
air conditioners, and devices to turn on no   matter the time of day. That requires the supply 
side to handle incredible volatility, ramping up   or down to meet demands in real-time. And the 
whole business is incredibly capital-intensive:   you need very expensive infrastructure for 
pretty much every step of the process. The   only reason it can work is that we all 
share that infrastructure, spreading out   the costs. Call me a nerd, but I think all 
of this creates some fascinating challenges,   both on the technical side for engineers and 
the organizational side for the policymakers,   regulators, and all the companies that 
participate in the electric power industry. It wasn’t that long ago that the electric 
utilities did it all. As the pros say,   they were “vertically integrated.” 
Each utility owned and controlled the   three major pieces of the grid within their 
service areas: generation (or power plants),   transmission lines (which carry electricity 
at high voltage across long distances), and   a distribution system (which delivers electricity 
to most customers at lower voltages). That meant   they had a monopoly. Customers couldn’t choose 
where their power came from or how they got it.   And that meant that electric utilities had 
to be carefully regulated to make sure that,   without any competition, they were still 
offering customers a reasonable price for power. Over time, utilities realized the value 
of interconnecting so they could help   each other in times of need. Electricity is a true 
commodity, even if it has some unusual properties.   For the job it does, it mostly doesn’t really 
matter who made it - a kilowatt is a kilowatt,   no matter where it came from. If one utility’s 
power plant went down or bad weather hit,   they could work out a deal to share power 
with a neighbor and keep demand satisfied.   As the practice grew more common, power 
pools developed where multiple utilities   would interconnect and agree to share power. Every 
system is different; subject to different risks,   different weather conditions, and outages at 
different times. It just made economic sense   to spread out that variability and risk. 
Eventually, huge parts of North America   were interconnected by transmission lines, 
creating the “grids” we know today. The   major interconnections in the US and Canada 
are the Western, Eastern, Quebec, and Texas. Historically, the wholesale price one utility 
would pay another for power was regulated just   like the rates utilities charged their 
retail customers. It was usually based   on the actual cost of generating that power, so 
the big utilities couldn’t price gouge smaller   companies. But a lot of that changed in the 1990s 
when the federal government opened the door for   deregulation. The idea is simple on the surface: 
if power can move fairly freely on the grid,   there’s no need for major utilities 
to be the only ones producing it,   and there’s no need to regulate the 
prices for which it’s bought and sold.   Let’s let market forces drive the decisions. 
It will increase competition and efficiency,   driving down prices, and the investment risks 
will fall to the investors, not the customers. Quite a few states took the opportunity to 
deregulate the production of power, and quite   a few didn’t. In fact, right now, it’s roughly 
half and half, but there’s a lot of variety   between states when it comes to who produces power 
and how it’s bought and sold between utilities   and other companies, and even big differences 
within individual states. In truth, the process   of deregulation has been anything but simple, and 
actually created a whole new set of interesting   challenges. Companies trying to game the system, 
like what happened in California, is only part   of it. In fact, power professionals often say 
that certain states aren’t deregulated; they’re   just differently regulated. But how does all this 
really work in practice? Let’s set up an analogy. Say I live on one side of a big lake. The water 
isn’t mine, but there is a water company on the   other side. If I want to buy some water, they 
could load it on a truck and haul it to me. Or   they could just put it in the lake, and I could 
take out the same amount. It’s probably not the   same water, but it doesn’t really matter. In this 
analogy, water is water. Let’s scale it up. Now,   hundreds of people need water, and hundreds 
of companies are selling it. Each person can   hire any company they want to provide their 
water. The distance between buyer and seller   doesn’t really matter. Every seller puts the 
amount of water they’ve sold in the lake,   and each buyer takes as much out as they’ve 
bought. As long as everyone keeps track of   how much they buy and sell, the lake stays full, 
and basic laws of physics will sort out how the   actual water flows. In one way, you know exactly 
where you get your water: the company you paid to   provide it. But in another way, you have no idea. 
All the water from all the companies is comingled   in the lake. This is what happens on the grid. 
In a way, the power coming to your house comes   from the power plant or plants that your utility 
paid to create it. But the electrons themselves   probably didn’t. Just like the water in the lake, 
electricity flows according to the laws of physics   from high potential to low, sloshing and flowing 
according to what everyone on the system is doing. This is a lot like how a deregulated grid 
works. Utilities that supply electricity   to their customers don’t generate the power 
themselves. They enter contracts to get it   from wholesale power providers, separate companies 
who only generate electricity. But you can see a   challenge here. If I’m on my big lake wanting some 
water, I may not want to coordinate with every   water company to see who’s got the best price, 
especially if my need for water varies day by day   or even second by second, and honestly, I’m not 
even sure exactly how thirsty I’m going to be. And   if I’m a water company on the lake, it’s a lot of 
overhead work to deal with all these customers and   their different needs. It makes a lot more sense 
if there’s a marketplace. So it is on the grid. Like I mentioned, this varies quite a bit 
depending on where you are, so I’ll try   to be as general as possible. Outside of those 
direct contracts between one buyer and one seller,   most wholesale electricity in deregulated areas is 
bought and sold on the day-ahead market. Wholesale   purchasers like utilities submit bids with 
estimates of how much electricity they’ll   need for each hour of the next day. And generators 
submit their offers to sell a specific amount of   electricity for a given price that’s based on 
their production costs, availability of fuel,   and operational constraints. The facilitator 
of each wholesale market takes all the bids   for every hour and matches the supply and demand 
to get the right amount of energy on the grid at   the right times for the lowest cost. Here’s a 
basic example of a single hour of the auction: Let’s say four generators submit bids to provide 
electricity during this hour: A nuclear plant bids   1200 MW for a price of $20/MWh. A natural gas 
peaker plant bids 400 MW for $100/MWh. A coal   plant bids 500 MW for $30/MWh. And a wind farm 
bids 400 MW for $0. Wind and solar can submit   very low bids because they have no fuel 
costs. There’s pretty much no way for them   to lose money if they’re connected to the grid, 
especially because many get outside incentives   for every megawatt-hour they generate. They 
even submit negative bids in some cases,   meaning they’re willing to pay money to stay 
connected to the grid. In any case, electricity   generators in our hypothetical hour have 
offered 2,500 megawatts of power to the market. Let’s say purchasers submitted 2,000 
megawatts of demand for this hour. We   arrange the generation bids in order of least 
cost to satisfy demand. This concept is known   as economic dispatch. We buy power at the 
lowest cost possible. We’re going to dispatch   the wind farm and nuclear plant, dispatch the 
coal plant at 80% of the capacity they bid,   and we don’t need the peaker plant at 
all. The clearing price is the cost of   the last unit of supply to be dispatched. 
In this case, it’s $30 per megawatt-hour.   Every producer gets paid that price for the 
power they put on the grid for that hour,   even if they bid lower, and every buyer pays that 
price for wholesale electricity. This is why wind   and solar are incentivized to bid 0 dollars. They 
essentially guarantee that they’ll make the cut. It seems like a simple process in our hypothetical 
hour, but in reality there’s a lot more to it. For one, many types of power plants can’t just be 
toggled on and off with the flip of a switch.   They need significant lead time to start up and 
shut down. They have minimum and maximum output   levels. And their costs can vary a lot depending 
on how long they run. So the market has to take   those factors into consideration. Also, we can’t 
perfectly predict the future, even for the next   day. There are always going to be differences in 
the day-ahead forecasts. Demand varies, equipment   has problems, and other unforeseen events like 
sabotage or solar storms happen all the time. So another market runs in real-time, 
sometimes with auctions every 5 minutes,   to make up those differences and keep the supply 
in check with demand. For example, if a wind farm   overproduces what they bid into the day-ahead 
market, they can sell the extra on the real-time   market. And if they underproduce, they may need 
to buy power in the real-time market to make up   for the shortfall. And if things really get tight 
with not enough reserves, the real-time markets   usually include a way to boost prices upward, 
even beyond what the clearing price would be,   to make sure they’re more closely reflecting 
the actual value of electricity. That includes   the cost to society if people lose power, or put 
another way, the cost they would be willing to   pay to avoid a disruption in electrical service. 
This concept is called the value of lost load,   and it’s something that the generators usually 
aren’t taking into account in their bids. But that’s not all the markets. Many areas have 
a capacity market intended to make sure there are   enough generators available to meet demands over 
the long term. These auctions happen only once a   year or so, and generators bid to create 
new capacity within three years. All the   generators that win in the auction are rewarded 
for adding capacity to the grid, no matter how   much of that capacity actually gets used in the 
future. This doesn’t happen everywhere though.   Texas doesn’t use a capacity market and instead 
relies on prices in the day-ahead and real-time   markets to encourage generating companies 
to make long-term investments in capacity Many areas also have markets for 
so-called ancillary services,   basically services needed to keep the grid stable 
and reliable. There are auctions for regulation,   which accounts for very short-term fluctuations 
in supply and demand to keep the frequency   stable. There are also auctions for reserves 
that can keep plants ready to get on the grid   quickly if another resource trips offline. 
Other services to keep the grid stable are   often contracted directly instead of using 
auctions. Reliability-must-run contracts   pay for power plants that are on the verge 
of retirement to stay in service until the   capacity is replaced. Inertia services pay to 
keep a certain amount of rotating mass connected   to the system. I have a video on that topic if 
you want to learn more. Black start contracts   pay for some generators to have the ability to 
go from a total shutdown to operational without   assistance from the grid. I also have a video 
on that topic. And reactive power contracts   help maintain the stability of the voltage on 
the grid. And, I have a video on that one too. A potentially surprising thing about many of 
these markets is that it doesn’t just have to   be generation resources bidding into them. The 
overall goal is just to get the supply to meet   demand, and there are two ways to do that. You 
can increase the supply or decrease the demand.   I said earlier that electricity demand is fairly 
inelastic, but there are a lot of situations where   customers can reduce demand, especially if they’re 
compensated for doing it. Large industrial power   users like refineries can shift schedules around 
or even turn on their own generators if resources   on the grid are getting scarce. This is how you 
get wacky news stories about cryptocurrency miners   making more money participating in electricity 
markets than in Bitcoin. There are even companies   that will gather up a bunch of smaller power 
users who have some flexibility in their demands,   package them up, and sell that demand reduction 
as a service in the wholesale electricity   market. And some utilities coordinate similar 
demand response programs with their customers,   offering credits on your bill if you have a 
smart thermostat. Deregulation of wholesale   electricity markets just opens up this world 
of possibilities in how we manage the grid. But there is one big way my lake analogy from 
earlier breaks down. Because that lake symbolizes   the transmission and distribution lines that 
carry power between the buyers and sellers.   And in reality, they’re not really like a lake, 
but more like a series of interconnected canals.   And they didn’t just appear. Someone has to build 
them and maintain them, often at great cost,   so those costs need to be covered by the rates we 
pay for electricity on top of the generation. In   this case, there’s really no way to deregulate 
those costs. It doesn’t make sense to build   parallel, competing networks of transmission 
and distribution lines. It would cost too much,   and we’d just have too many wires across the 
landscape. So regulators oversee the rates that   transmission and distribution companies charge 
utilities to use their wires to move power between   users and generators. And of course, there’s 
a whole host of complex financial systems in   place to make this happen. Wholesale purchasers 
not only have to buy power they need and the   power that will be lost along the way, but also 
reserve capacity on the transmission system for   that power to travel, and pay the transmission and 
distribution system operators for the privilege. Confusingly, the flow of power isn’t really 
controlled on a line-by-line basis or sometimes   even on a system-by-system basis. Power flows 
where it flows once it’s released on the grid,   and there’s no simple way to keep track of who 
made it or who bought it at individual points on   the network. Transmission reservations 
and tariffs are the law of the land,   but the actual electrical power follows 
the laws of physics. So unlike at your   house where you pay one-to-one for the 
actual power that flows through your meter,   payments to transmission operators aren’t always 
a perfect reflection of how each buyer’s power   moves through their system. Still, it’s the best 
mechanism we have to ensure electricity moves   reliably across the grid and that the owners of 
the transmission assets are fairly compensated. The other thing is that those canals don’t 
have infinite capacity. They can only move   so much water, just like the transmission 
system can only move so much power. So in   managing the wholesale electricity market, 
you don’t only have to consider what’s the   next cheapest source of power, but 
also whether you can actually get   that power to where it needs to go. Grid 
operators have to account for congestion,   like rush hour for electrons. They usually do this 
by allowing prices to vary from place to place,   an idea called Locational Marginal Pricing. You 
can see on this map of Texas how significantly   prices can vary across the state, reflecting a 
difference in where the demand is versus where   the generators are and the congestion on the 
transmission system that results. And hopefully   at this point you’re seeing how complicated all 
this really is.   Grid operators have to take into  consideration all these details - power flows, 
weather, limitations of every kind of generator,   second-by-second changes in the system - in order 
to match supply with demand at the lowest cost   possible. And it gets even more complicated 
when you add distributed generation sources,   like home solar installations, that put energy 
on the grid from the other side of the meter. And this is only on the wholesale side 
of the grid. Even though most of those   dollars moving around came out of our 
pockets, the end-users of the electricity,   you and I really don’t participate in 
this segment of the grid. For many of us,   the company we pay for electricity (the retail 
provider) didn’t generate that electricity,   and in many cases, doesn’t own the infrastructure 
that it traveled along to reach our house or place   of work. And for around a quarter of the US, the 
retail market is deregulated to the point where   you can choose which company you buy your 
power from. So what do they actually do? In essence, retail providers just buy power 
on the wholesale market and sell it to you.   They’re middlemen, the car dealerships of 
electricity. They navigate all that complexity   we just discussed so you don’t have to. Retail 
providers all provide essentially the same thing,   but they can differentiate themselves by 
offering different kinds of rates that   suit their customers better. One provider in 
Texas, Griddy Energy, famously offered their   customers the real-time wholesale price, 
exposing them to the incredible volatility   of the market. Unsurprisingly, Griddy filed for 
bankruptcy after the winter storm in Texas when   their customers couldn’t pay the exorbitant 
bills. The other thing retail providers can   do is connect your dollars to specific 
sources of generation like renewables.   Instead of buying power in the auction, 
where you have no control over the sources,   they contract directly with wind, solar, and other 
generators to purchase it directly on your behalf. So next time you get your power bill, take 
a look at those line items. Maybe there’s a   base rate set by your provider that covers all 
the various costs of operating the grid from   generation to transmission to distribution. Or 
maybe they’re broken out according to all the   various costs that it actually takes to run 
the bulk power system. Do you pay a separate   rate for the distribution service? Does your 
bill have an adjustment for the variability   in the wholesale market? Is there a charge 
for the Public Utility Commission or whatever   agency oversees this whole financial web of 
complexity? Every bill looks a little different,   but I hope this video clears up 
some misconceptions and encourages   you to think about what the price you pay for 
electricity actually accomplishes on the grid. Electricity is just one of the many costs in life that, when you look below the surface, things can be surprising. Another   example: razors. You can pick up a cheap razor 
from the store thinking you’re being thrifty,   and then spend many multiples of the original cost 
over its lifetime replacing the blades. Today’s   sponsor Henson takes the opposite approach: bite 
the bullet at first for a nice handle, and then   the safety blades cost pennies. It doesn’t 
take long for the decision to pay itself off. Obviously I’m a little less clean shaven than I 
have been in the past. This is actually the first   time I’ve ever had a beard. I’ve gotten plenty 
of comments about it - some good, some REALLY   good. But one thing I learned pretty quickly is 
that having a beard doesn’t mean you get to skip   shaving, and in fact, it’s actually a bit more 
effort because you have to have some precision. Henson offered to sponsor a video about 
two years ago now. I said send me a razor,   I’ll try it out, and then decide. And I 
never switched back. I’ve actually been   keeping track of how many blades I use. 
So far, in those two years, I’ve spent $4. A new razor’s probably not going to change your 
life. But, shaving’s one of those mundane but   necessary parts of life for a lot of us, and using 
a precision tool makes it feel less like a chore,   and instead a part of my day that I actually 
enjoy. I had never used a safety razor and   figured they were old technology. Totally 
not true - these are made in an aerospace   machine shop. I also figured there would be 
a learning curve compared to my old razor,   but that also wasn’t true. The Henson is so easy 
to use, I don’t think I could ever go back to a   cartridge razor with their flexible blades and 
difficulty in rinsing out. If you’ve ever been on   the market for a tool and splurged on the nicest 
brand, this is that, except, it's not really a   splurge. The blades for the Henson razor are so 
cheap you could probably put a new one on for   every shave and still save money. And in fact, if 
you use my code PRACTICALENGINEERING at checkout,   you can get a 100-pack of blades on me. Just 
make sure both the razor and the blades are in   your cart, enter the code, and the discount will 
be applied right away. There’s no subscription   service or a monthly fee, it’s just a cool 
razor that I’ve been using for a long time now,   and I think you’ll like it too. Thank you 
for watching and let me know what you think.

---

## 31. Why Are Cooling Towers Shaped Like That?
**Channel:** Practical Engineering | **Views:** 8.5M | **Date:** 1 year ago | **Duration:** 19:48 | **ID:** tmbZVmXyOXM
**Link:** https://youtube.com/watch?v=tmbZVmXyOXM

### Transcript:
This is not smoke. And this isn’t a smoke stack 
(at least not the kind we normally think of). It   serves a totally different purpose at a power 
plant than smoke stacks whose job is moving   combustion products high into the air, allowing 
them to disperse away from populated spaces. Maybe   you already knew that, or at least suspected it. 
After all, you saw the title of the video. Plus,   this kind of tower is commonly associated with 
nuclear plants that don’t combust anything at all   to create the heat that drives their generators. 
But that heat is the key. The largest class of   power plants, called thermal power stations, 
use steam turbines (or tur-bines, depending   on how you say it). But once that steam makes it 
through the turbine, it needs to be condensed back   into liquid water. It’s kind of frustrating. You 
spend all those resources heating the water up,   and then you spend even more resources to cool it 
back down. And a power plant isn’t much good if   all the electricity it generates gets used up 
just trying to cool that steam back down. So,   engineers have come up with some pretty 
creative ways to cool huge amounts of water,   like millions of gallons or tens of 
thousands of cubic meters per hour,   and do it relatively efficiently. Not all 
cooling towers look like this, but there   are some really clever reasons for that iconic 
shape we all recognize, and I’m going to build   one in the garage to show you how they work. 
I’m Grady, and this is Practical Engineering. Power plants could just vent steam 
into the atmosphere, but generally,   they don’t do that. For one, it wouldn’t be good 
for the environment. The heat, moisture, and noise   would affect wildlife and the weather. For two, 
it would waste a lot of water. The feedwater   for a boiler is often carefully treated to avoid 
corrosion and mineral buildup in the machinery.   It’s expensive water, so it doesn’t make sense 
to set it free. And for three, it would waste   a lot of energy. It’s generally less expensive 
to cool the steam down just enough to condense   it back into liquid water so it can be reused as 
feedwater. But even that is an enormous challenge. I talked a little bit about how power plants 
actually consume a lot of energy in a previous   video. It’s a net positive, of course. But 
any energy you spend on all the industrial   processes required to produce electricity at 
scale is energy not being sent out to the grid,   and that includes cooling. So engineers want to 
do it efficiently. One simple option is to use a   cooler stream of water that already exists, like a 
river, lake, or sea. And in fact, there are a lot   of power plants near me that do exactly that. This 
plant draws water from the lake on the south side,   sends it through condensers, and then releases 
it into a channel where it flows to the north   side of the lake. The slow circulation gives 
that water time to cool down before it reaches   the plant again. But it’s not feasible to have a 
lake or river for cooling water at every thermal   power plant, and there are environmental 
impacts with the heat and intakes that   require careful consideration. So instead, 
lots of power plants use cooling towers. You might be familiar with the various machines 
humans have devised for cooling stuff down.   You might even be enjoying the comfort of 
such a device right this very minute. But,   like I mentioned, the simplest way to 
cool something is to simply let natural   physical processes do the work, just wait 
for entropy to do its thing. After all,   the temperature is usually less than boiling 
outside, so the heat from steam will naturally   transfer to the ambient air if you let it. So 
that’s what many cooling towers do…  kind of. I designed a cooling tower in my garage so 
I can show you exactly how this works.  This is made from laser-cut strips of acrylic 
with a carefully selected shape. And when   I carefully tape these carefully sized strips 
together, I get a nice (somewhat transparent)   cooling tower. This is a model of a natural draft 
tower. It’s not the most common type out there,   but it is one of the simplest, and 
also the most iconic and recognizable,   so it’s perfect for this demonstration. You 
may have noticed the holes I drilled in the   bottom of each acrylic strip. This tower 
needs a way for air to get inside at the   bottom. If you look closely at the real 
thing, you’ll see something similar. They   aren’t continuous all the way down 
but actually open around the bottom. Steam from the turbines doesn’t go to the cooling 
tower directly. Instead, there’s a separate stream   of water, aptly called the cooling water. 
The steam is condensed into liquid water in a   condenser that is cooled by cooling water, which 
then flows between the condenser and the tower.   I’m simulating that here with a bucket of hot 
water and a beer brewing pump. That hot water gets   pumped to sprayers inside the tower. If you know 
a little bit about thermodynamics, you know that   we can only get this water as cool as the ambient 
air temperature. Heat naturally flows from hot to   cold, so you can’t get any more heat transfer once 
the water reaches the outside temperature. But if   you know a little more about thermodynamics, 
you know there’s a trick that can improve   the performance of a system like this. And this 
layer of material below the sprayers is the key. This is called fill. I’m just using 
a dehumidifier pad, but in an actual   cooling tower, the fill is usually a layer 
of plastic, carefully designed to maximize   the surface area of the water in the system. 
It does this by forcing the water to either   splash into tiny drops or form thin sheets as 
it falls downward. The goal is to expose as much   surface area of the hot water as possible 
to the air flowing through the tower. Water   drips down. Air flows up. The pros call this 
counter-flow. And it’s the trick to this whole   process. (Actually you can use cross-flow as well, 
but let’s jump over that rabbit hole for now.) You might think that the outside air has just 
one temperature, but to cooling professionals,   it has two. One we call the dry bulb temperature 
is what you normally encounter. That’s what shows   up in the weather report. It’s what’s on 
the thermometer. But air also has a wet   bulb temperature. If you soak the end of 
a thermometer and pass it through the air,   that water will evaporate. The drier the air, 
the more easily water evaporates. This is why   it feels so much hotter when it is also humid 
outside. It takes energy, called latent heat,   to convert water from a liquid to a gas, and 
that energy is absorbed from the liquid water,   cooling it down. So, as long as the ambient air 
isn’t already saturated (100% relative humidity),   you can actually cool water below the 
dry bulb temperature using evaporation.   And the lower the humidity of the air, 
the more evaporation can take place,   so the bigger the difference in 
wet and dry bulb temperatures. This isn’t anything revolutionary. Nature 
figured out evaporative cooling millions   of years ago. It’s why we sweat when it’s hot. 
But using it at this scale is really impressive.   And it’s not the only innovation in a natural 
draft cooling tower. For that, I need to show   you a cool graph. This is a psychrometric chart. 
It looks pretty intimidating. You could spend an   entire college course learning about this stuff, 
and there are probably a few HVAC professionals   groaning at the screen right now. But I just want 
to use it to explain a few important things about   the physical and thermal properties of air. 
First, as the temperature of air goes up,   its capacity to hold water goes up too. Kind of 
like hot tea can dissolve more sugar than cold   tea, hot air can hold more water than cold air. 
Next, as air temperature goes up, its density   goes down. Confusingly, the psychrometric chart 
actually shows specific volume, which is the   inverse of air density. So as you move up in 
temperature, these lines slope downward. Hot   air rises. Most of us know that. But maybe less 
intuitively, it’s also true for humidity. If you   hold the temperature constant, and just increase 
the amount of water in the air, its density goes   down. Water molecules actually weigh less than 
the nitrogen or oxygen molecules in air. So,   humid air is more buoyant than dry air. And this 
is the second key to a cooling tower: convection. The hot water transfers its heat to the air. 
The warm air becomes buoyant, flowing upward   in the tower and drawing fresh air in through 
the intakes. But some of that hot water is also   evaporated, removing more heat from the water, and 
making the air even more buoyant. The process both   cools the water down and creates a natural draft 
up through the tower, drawing in even more fresh,   drier air as it does. Ignoring the pumps 
and minor control features, there are no   moving parts. So for just the cost of spraying 
the water, you create this enormous natural   convection in the tower, moving huge volumes 
of air into the bottom, up past the fill, and   out at the top to reject large amounts of heat to 
the atmosphere. This is the “smoke” you sometimes   see rising from a cooling tower. It’s not actual 
smoke; it’s just water vapor condensing into tiny   droplets as the now-saturated air mixes with the 
cooler outside air at the top of the stack. It’s   basically a cloud machine. That’s why the plume 
is usually more visible during the winter months. I was really surprised at how well my little model 
tower worked. I was pumping water at about 120 F   (50 C) and the water coming out was dropping by 
around 30 degrees F (17 degrees C). That’s like   a perfect cup of coffee down to a lukewarm shower. 
The air coming out at the top was shockingly warm,   and there was a lot of it. I was really 
surprised at how much airflow this thing   could create just by spraying some hot water 
inside. I guess I just figured these processes   wouldn’t scale well because of turbulence, but 
I was wrong. It was both pretty good at cooling   the water down and looking cool on camera. 
And part of the reason this looks so cool,   the shape of the tower itself, 
is also crucial to its function. Natural draft cooling towers often feature this 
curved, swooping shape. The mathematicians call   it a hyperboloid. You can actually make one 
yourself pretty easily. Put some sticks evenly   spaced and connected in a circle around the 
top and bottom. Then twist. Actually the fact   that it can be made from straight lines makes 
these easier to construct. But that’s not the   only reason they’re built this way. After all, a 
cylinder has straight lines too. There are some   aerodynamic benefits to using a hyperboloid as 
a chimney. The wide base provides more area for   air to flow in at the bottom. The constricted 
center accelerates the flow upward. And the   wider top helps promote mixing of the hot 
humid air with the cooler air outside. But,   really, these are secondary benefits. The 
main reason for the shape is structural. These towers are big. To get enough natural 
convection, you need a tall stack. The taller   the tower, the more warm, humid air is contained 
inside, generating more buoyancy and more airflow.   The largest natural draft towers are more than 650 
feet or 200 meters tall, and more than 400 feet or   120 meters in diameter. And you want the walls to 
be as thin as possible. Less material means less   cost and more area for airflow. But a really 
tall cylinder made of thin walls is not very   strong. It’s basically a big empty coke can. But 
the double curvature of a hyperboloid stiffens the   shell against vertical loads like the structure’s 
own weight and horizontal loads like wind. You can   also try this yourself. A thin piece of paper has 
almost no stiffness. As soon as you put a curve   in it, it’s much harder to bend perpendicular to 
the curve. And two curves are better than one.   It’s the Pringle factor. My model shows this 
pretty well too. I started out with thin,   floppy strips of acrylic. But even just taped 
together, this tower is really strong. Using a   hyperboloid can cut the structural stresses 
in half compared to a cylindrical tower,   making structures like this much more economical 
to build. So that’s why natural draft towers   use that shape. But that definitely doesn’t 
mean this is the only kind of cooling tower. In fact, hyperboloid natural draft towers 
are actually pretty rare in the same way   that thermal power plants are pretty rare 
compared to large office buildings, hospitals,   and schools that also often use cooling towers 
as part of the HVAC system. Those towers often   use mechanical draft systems, basically using 
fans to create airflow instead of tall stacks.   I talk a little bit more about this in my 
book. We still call them cooling towers,   even though they usually aren’t too towery. 
And, in fact, lots of power plants, refineries,   and chemical plants use mechanical draft 
cooling towers as well. They’re less   dependent on ambient conditions to create 
the necessary airflow, they’re smaller,   usually less expensive to build, and offer 
some flexibility if heat loads fluctuate. And not all cooling towers use evaporative 
methods. Dry cooling towers just use heat   exchangers inside, with the cooling water 
flowing in a closed loop. In dry systems,   you’re limited by the higher dry 
bulb temperature instead of wet bulb,   but you don’t lose any water to evaporation, 
and you don’t have to deal with the buildup of   minerals that happens in wet systems 
as cooling water evaporates away. The reason you see big natural draft towers at 
power plants has everything to do with scale.   The long-term savings of not having to run big 
fans and maintain all the associated equipment   outweigh the higher initial costs. Particularly 
at nuclear plants built with design lives of 50   years or more, you can amortize the cost over 
a longer duration. Also these facilities are   usually already built in more remote locations 
where land is cheaper and height restrictions are   less stringent, making it feasible to build such 
massive structures just for cooling. And they’re   particularly common at nuclear plants for two 
reasons. Number one is reliability. Cooling is   an essential part of safety at a nuclear plant. 
The fewer parts of a cooling system, like fans,   that can go wrong in an emergency, the better. 
Number two is variability, or the lack of it.   Nuclear facilities are usually baseload plants. 
Most of them run nearly nonstop at a constant   output. So they can get away with a system 
that’s designed for a single heat load rather   than mechanical cooling required to ramp up and 
down. But, even if the heat load doesn’t change at   large baseload plants, the weather does, and not 
every climate is ideal for natural draft towers. If you live in a dry place, you might be 
familiar with evaporative appliances that   can cool and humidify the air. We called them 
swamp boxes when I was growing up. It makes   sense that these work better in dry climates; 
there’s less moisture in the ambient air,   so you get more evaporation, and 
thus more cooling potential. So,   you might assume that natural draft towers 
work best in areas with low relative humidity,   but that’s not necessarily the case. And this took 
me a little bit to wrap my head around.   Let’s look back at that psychrometric chart. Say we’re in an 
area with a wet bulb temperature of 20 celsius,   70 fahrenheit. The water from our condenser comes 
in at 40 C, 100 F, so the air leaving the tower   will be saturated at that temperature. And we’re 
trying to cool that water down to 30 C, 85 F. If the ambient relative humidity is say, 20 
percent, our air is starting here and going   here. But it doesn’t go in a straight line. 
Since the air is coming in from the bottom,   it’s not coming into contact with the warm water, 
but the coldest water first. So it actually heads   toward the outlet temperature and gradually 
veers toward the water inlet temperature as   it rises through the fill. If you look at 
the lines for specific volume you might see   the problem. In the first part of the curve, the 
state of the air is moving parallel to the lines.   In other words, it’s not gaining 
any buoyancy. It’s not going to   rise up the stack. It might work right 
at startup, but as the water cools down,   the airflow in the tower will slow down and stall, 
and you won’t be able to cool the water enough. But watch what happens if you increase the 
relative humidity of the ambient air to   50 percent. The line still curves initially toward 
the outlet temperature before heading to the inlet   temperature as it moves through the fill, but it 
decreases in density consistently along its entire   path through the fill. So, cooling engineers 
say that, for a given wet bulb temperature,   you get a better draft as relative humidity goes 
up. It seems counterintuitive, but another way to   look at it makes more sense. Natural draft cooling 
towers just don’t work that well in hot climates.   Even if the air is dry enough to evaporate 
a lot of water and create a lot of cooling,   you just can’t get it to rise up a tower 
on its own. So if you pay attention,   you’ll notice different types of cooling 
depending on where you are. There are two   nuclear plants in Texas and both use reservoirs 
for cooling. That gives you a sense of the cost   involved in cooling feedwater at a power plant. 
In both cases, it was cheaper to build and   maintain a dam and huge lake than a cooling 
tower that would work well in our climate. I know that’s a little in the weeds, 
but I think it’s so fascinating how much   engineering goes into things like this, and 
I’ve just barely scratched the surface here.   The economics of building large facilities 
like thermal power stations requires that we   know for sure that each design is going 
to work before any construction starts,   and that has driven a huge variety of types 
and styles of cooling towers. Engineers mix   and match designs and styles according to what 
will work most efficiently for each application,   so there’s practically no end to the designs you 
can spot if you keep an eye out. And actually,   some newer cooling towers do put flue gas into 
the air stream, making the tower do double   duty. So I kind of lied at the beginning of the 
video. Depending on the tower you’re looking at,   there really might be some smoke in that plume 
coming from the top. But mostly, it’s just   water. And in a world full of straight lines and 
right angles, I love that every once in a while,   it just makes good engineering sense to use curvy 
shapes to accomplish a really important job. Another place where engineering meets nice smooth 
shapes is underwater. If you’ve watched this   channel, you know how much I love to learn about 
the various ways we interact with water. One of   my favorite channels, Neo, recently released 
a video about the failed attempt to salvage   a huge piece of the Titanic from the bottom 
of the ocean and the fascinating engineering   involved in the project. As always, the 3D graphic 
recreations are beautiful. But maybe my favorite   part is the way he addresses the complicated 
issues surrounding the commercialization of   a disaster. And if you want to check it 
out, it’s available right now on Nebula. You’ve heard me talk about Nebula before. It’s 
a streaming service built by and for independent   creators, including a lot of my favorites like 
Neo, Wendover Productions, the Coding Train,   and Branch Education. I don’t know about you, but 
independently-produced content is most of what I   watch these days. I just like the authenticity 
and thoughtfulness of videos that haven’t been   through a writers room and ten levels of studio 
executives. Someone said Nebula’s like Netflix   for people who love trains. And I like that 
comparison, not just because I love trains. Nebula’s totally ad-free, with tons of 
excellent channels and lots of original   series and specials like Neo’s video 
on the Titanic. It’s also a great gift,   especially because a yearly membership 
is 40% of the link in the description.   My videos go live on Nebula before they come out 
on YouTube. If you’re with me that independent   creators are the future of great video, I 
hope you’ll consider subscribing. That’s   go.nebula.tv/Practical-Engineering. Thank you 
for watching, and let me know what you think!

---

## 32. 1.5 Years of Heavy Construction in 1.5 Hours
**Channel:** Practical Engineering | **Views:** 1.2M | **Date:** 1 year ago | **Duration:** 1:36:35 | **ID:** goWsVAE-JF0
**Link:** https://youtube.com/watch?v=goWsVAE-JF0

### Transcript:
I’m on location outside San Antonio, Texas where 
a construction crew is getting started unloading   equipment to begin work on a new sewage 
lift station.  This area may look rural now,   but it’s one of the fastest developing parts 
of Texas. New homes and new businesses require   new utilities, including sewers, to keep up 
with demand. And in this particular location,   those new sewers need a new pumping station to get 
the wastewater where it needs to go.   Most people probably couldn’t guess the path their dishwater 
or flushes take once they’re down the drain,   but I’ve teamed up with the San Antonio River 
Authority to give you an up close view of one   of the most important steps of the process. Come 
nerd out about construction with me and follow   along the project from the very first scoop of 
dirt to starting up the pumps for the first time.   I’m your host, Grady Hillhouse, 
and this is Practical Construction. The excavator is already breaking ground for 
the construction of this new lift station.   Sewers normally work by gravity. They 
rely on sloped underground pipes to carry   wastewater away from homes and businesses 
toward the plants that clean it up.  But, wastewater treatment plants are major capital 
projects, and we don’t build them everywhere. So,   there’s not always a treatment plant located 
downhill from populated areas. In some places,   it’s necessary to pump sewage up to a higher 
elevation. That’s the dirty but critical job   of a wastewater lift station. This particular 
project is an expansion of an existing facility.   When it’s done, the new lift station will operate 
together with its neighbor here, increasing the   capacity of the sewage system as the surrounding 
area grows. It will also create some redundancy   by allowing either station to be temporarily shut 
down for maintenance during periods of low flow. Because sewers work by gravity, they’re 
always sloping downward. So, the end of   a sewer pipe is usually deep underground. And 
that means this lift station starts with a hole,   a big hole.  The bottom of this facility will 
sit about 30 feet or 9 meters below the ground,   so this crew has a lot of work ahead of them. This soil is mostly clay, meaning it won’t work 
well as backfill. Clay is difficult to compact,   it shrinks and swells with changes in moisture 
content, and it tends to settle over time. So,   the engineers on this project specified a 
more suitable backfill material that will   have to be brought in when the time comes. For 
now, the native soil from this excavation will   have to be hauled away in trucks.  These end dump 
trailers can hold more than 20 tons of soil each,   and it’s going to take a lot of them to 
carry all this clay to dispose of off site. One thing to notice about the hole: the sides 
aren’t vertical. Safety regulations require   that the sides of deep excavations be sloped to 
reduce the chance of a collapse while people are   working inside. But that presents a problem, 
especially on a narrow construction site like   this one. The deeper you dig, the less room you 
have to work at the bottom of the hole, since the   slopes take up valuable space. On this site, 
there just wouldn’t be enough area to get the   vehicles and materials around the excavation if it 
were to go the full depth with sloped sides. So,   this hole has two parts. The first stage goes down 
10 feet (or 3 meters) and uses sloped sides to   avoid a collapse. The rest of the excavation will 
have to be supported using structural shoring.   These blue parts being unloaded from trucks are 
part of a slide rail system that will hold the   walls of the hole open as the crew continues 
excavating downward. The system includes steel   plates called panels and vertical rails that make 
up the four corners of the box. The outer panels   stay put, while the inner panels will eventually 
slide downward as the hole gets deeper and deeper. The first step of installing the shoring is to 
position the first outside panel. The location   of this first panel is critical, because the 
rest of the system will use it as a reference   point. First the crew puts a narrow bucket 
on the excavator and digs a trench for the   plate to slide into.  Then the first panel is carried 
into the excavation to be placed in the trench.  It takes some trial and error to get 
the plate positioned in exactly the right spot.   Once it’s close, they use the excavator bucket 
to push the plate into the ground. And finally,   the trench is backfilled to hold the panel in   place with a few final adjustments from 
the excavator to get it plumb and true. The loader continues removing soil as needed, 
and the crew works to stage more pieces of   the slide rail system.  The next step is to install the first corner rail.  Once secure,  the second outer panel is next. These steel 
plates snap into the rail by starting at a   45 degree angle and rotating into place. That’s 
easier than trying to lift each one all the way   up and over the corner rails.  In between installing each component of the system,   the excavator and loader work together 
to remove more soil from the area. The crew hooks up the next corner rail to the 
excavator’s arm and lifts it into place. (Try   to ignore your lazy host eating lunch in 
the background there.)  Once it drops in,  the excavator again works to remove more soil 
from the hole. And now the third outer panel   can be snapped into place.  It’s critical that this 
system be set up perfectly square, so the workers   take the time to measure everything carefully.  Then the third corner rail can go into place,   quickly followed by the final outer panel  and the final corner rail.   Now the system is locked together, but 
it’s not ready for excavation just yet. Once all four rails and outer panels are in place, 
the sliding inner panels go in next. Where the   outer panels will stay put to hold everything 
together, the inner panels will slide down   the rails as the hole is excavated downward, 
providing support for the excavation and   keeping it from collapsing. The crew has to work 
through a little rain to get these installed. It’s a lot of work to install this shoring, 
especially when you consider how it’s all   going to be taken right back out. But, when 
space is constrained like it is on this site,   there just aren’t many options 
to manage deep excavations,   and there’s no room for error when it comes to 
protecting workers in dangerous environments. Once the shoring system is in place, the crew 
can continue digging downward.  The process is for the excavator to remove soil from inside 
the box while the wheel loader carries the soil   up and out of the way. As the bottom of the 
hole gets lower, the crew uses the excavator   to push the panels and the corner rails of the 
shoring system downward to maintain support and   keep the walls of the hole from collapsing.  Sometimes all it takes is a little push,   and sometimes advancing the slide rails 
requires something a bit more percussive. As the hole gets deeper, the excavator 
operator can no longer see what they’re doing,   so another member of the crew uses hand signals to 
guide the operation. Every so often, the excavator   hammers on the inner panels to slide them farther 
downward toward the final depth of the excavation. When the hole has reached its final depth, 
surveyors descend to the bottom to do one last   check of the elevation. A mistake here would 
affect every part of the project, so the crew   makes sure their measurements are correct.  Once confirmed, it’s time to compact the subgrade. To make sure the underlying soil will serve as a 
strong foundation for the lift station wet well,   it needs to be compacted in place. There’s not 
a lot of room for heavy equipment in this deep   excavation, so the crew lowers a miniature roller 
compactor down using the excavator. This machine   uses vibrating drums with padfeet to densify and 
compact the soil.  It’s also remote-controlled so the operator can stay out of the hole 
while it runs, keeping him free from   diesel fumes that could build up in the small 
confined area. It’s not the fastest machine,   but it doesn’t take long at all to 
compact the entire bottom of the hole. The next step in the project is to place a working 
slab at the bottom of the excavation. This slab   doesn’t need forms at its edges, but it does 
need to be set at the exact right elevation. So,   the crew sets boards inside the excavation 
that will serve as a reference during placement   of the concrete. They use a measurement 
rod to get the elevation exactly right. This concrete pump truck arrives first to get set 
up. It extends its outriggers for added stability.   And then it extends the boom.  Before long, the 
first concrete truck arrives at the site. But,   before the concrete goes into the hopper of 
the pump truck, the pump has to be primed. A   lubricant is run through the pump truck to coat 
the inside of the pipes and hose. The prime   is discharged into the bucket of the loader for 
disposal, and now they’re ready to place concrete. Rather than trying to drop the concrete 
into place from above using a chute,   this pump truck makes it easy to put the 
concrete exactly where it needs to go.  The operator communicates with the finishing crew 
and controls the position of the boom.  Each new truck unloads concrete into the pump’s hopper 
where it is pushed through the boom and the hose. Also known as a mud slab, the purpose of this 
working slab is to protect the soil at the bottom   of the excavation during construction. Without 
it, this clay would turn into a muddy mess in   the rain, making it unsuitable for supporting the 
lift station before the excavation is backfilled.   Since it’s only job is to serve as a working 
platform during construction, it doesn’t need any   steel reinforcement or a perfect surface finish. 
It just needs to have the minimum thickness as   required in the plans, and most importantly, to 
have the correct elevation for what comes next. The three-person finishing crew works 
together until they can’t fit into the   corner. One worker leaves, then two, until 
the last one is left to finish the job. Once the working slab is cured, 
everything is ready for the next   step of the project. And that next 
step is going to require a crane,   a big crane. This 300-ton-capacity behemoth 
just showed up on site. It’s an all-terrain   crane barely small enough to travel on roads 
and highways. Check out that all-wheel steering.  To reduce its traveling weight,   the crane comes with an entourage of flatbed semi 
trucks carrying outrigger pads and counterweights. Rather than sit on its squishy 
rubber tires during operation,   this crane uses outriggers to create a 
stable base and keep it from tipping.   These steel plates distribute the 
load from the outriggers so that the   underlying concrete doesn’t crack or break, 
and the soil below doesn’t compress too much. This crane also uses counterweights to balance 
the forces on the slewing ring. It lifts each   plate and stacks them behind the cab. Once 
the pile of counterweights is complete,   they are pulled into place using a hydraulic 
mechanism. Now this crane is ready for action. The primary component of this lift 
station is called the wet well. It’s   essentially a large concrete cylinder. 
Rather than cast the wet well in place,   this project calls for precast segments that can 
be stacked together like Lego. And the first one   of those segments has just arrived at the site.  Crane day is a big day, not just because of the 
size of the equipment on site. There’s a lot   that can go wrong when lifting and moving heavy 
loads, so there are a lot of people on site to   make sure things run smoothly. It might seem like 
overkill, and it might seem like a lot of folks   just standing around, but some days you have to 
hope for the best and plan for the worst. And,   spoiler alert, the only problem that happened this 
day was a flatbed truck carrying counterweights   getting high centered in the driveway.  That’s why the contractor decided to bring in another crane.  This way, delivery trucks can stay 
on the road, get offloaded, and be on their   way without any difficult maneuvering that 
might put a kink in the day’s busy schedule. The first piece of the lift station’s wet well 
is, naturally, the bottom. The rest of the wet   well will sit on this concrete base. The crew 
takes it off the truck with the first crane. But,   before it’s picked up by the big crane and set 
into place, it needs a little work. These concrete   segments are designed to easily stack on top of 
each other. However, a concrete-to-concrete seal   held together by gravity is not very watertight. 
And trust me, for large containers full of raw   sewage, it’s best that they don’t leak. So the 
crew is installing compressible gasket material   anywhere concrete surfaces will mate together. 
And, to make sure that everything slides together   just right, they’re also applying lubricant to 
the rubber gaskets. Once it’s ready, the bottom   segment is attached to the crane with chain slings 
and slowly swung around to the excavated area. Workers keep the heavy concrete slab 
under control using attached ropes   called tag lines as it's lowered toward 
the hole. Spotters keep a watchful eye   on everything and everyone on site to 
maintain safety. The signal person is   the eyes and ears of the operator. They use 
a combination of a radio and sometimes hand   signals to guide the motions and directions 
of the crane. Slow is the name of the game,   because sudden movements can cause the load to 
swing or crash into the side of the shoring.   And even a little crash can be a big deal when 
you have as much momentum as this concrete slab. Once the bottom of the wet well is just above 
the mud slab, workers take measurements and   communicate with the signal person to make tiny 
adjustments and get the slab in just the right   place. When it’s perfect, they make the call 
to set it down.  Crews disconnect the slings,   so that the crane can move on to its next 
load. It’s not the next wet well segment,   but actually some heavy-duty tools to help workers 
guide each segment into place. These scissor lifts   just barely fit into the corners of the excavation 
around the edges of the wet well, but they’ll help   the crew reach the higher joints and keep an 
eye on each segment as it’s lowered into place. The next segment of the wet well is the first   actual ring that will sit on the base.   Just like the base, it arrives on a flatbed truck  that needs to be offloaded by the small crane. 
And just like the base, it needs gaskets and   lubricant to seal perfectly with the precast 
segments above and below it in the stack. Attaching the ring segments directly to the 
crane hook using chain slings would put too   much horizontal force on the concrete, potentially 
causing cracks or breaks. Instead, the crew uses   a spreader bar between the segment and the 
hook. This spreader keeps the forces in the   chain slings vertical so they don’t squeeze the 
concrete and cause undue stress during the lift. Once the segment is off the ground, the crew 
can lubricate the recess where it will slide   onto the bottom slab. You can see smaller precast 
concrete manhole segments in the background there. Just like before, the segment is swung around to 
the excavation, then carefully lowered into the hole.  The crew in the hole tells the signal person 
what they need, and he tells the crane operator   what to do. Before long, the second segment 
is in place, resting comfortably on the base. Each following segment goes through essentially 
the same process. First, offload from the truck.   Next, gaskets and lube it up.  Then, hand off to 
the big crane, and lower it into place.  Disconnect   and send the crane back for the next one. Oh, 
and don’t forget the pizza break for lunch. Each one of these segments weigh about 15 
tons, roughly the weight of an average city   bus. That’s nothing to sneeze at, especially if 
it’s hanging above your head. As the day wears on,   the work starts to click into a predictable 
pace. Everyone has a job to do and they   anticipate the needs of others.   The worksite 
gets quieter as everyone settles into the rhythm.  And, slowly but surely these massive 
pieces are installed one-by-one. When the penultimate segment goes into place, 
the scissor lifts can’t reach any higher. So   the mobile boom lifts come out to help the 
crew lower the final segment into place.   This one is a little smaller than the others 
to make up the final height of the wet well.   Eventually this segment will be attached to the 
surface concrete slab and given an access hatch,   but we’re still quite a ways 
from then.  And just like that, we have a wet well installed. It’s a relatively 
minor milestone in the project, but a major   accomplishment for the day to have everything 
go so smoothly and be able to be home by dinner. Even though the wet well is in place, that doesn’t 
mean it’s ready for the dirty job of holding raw   wastewater. A crew lowers a scissor lift into 
the wet well to make it easier to access the   inside walls. They install grout by hand into 
each of the joints between the precast segments   to protect any exposed gaskets and help seal any 
potential leakage paths. Once the grout cures,   it is painted with a waterproof coating. This 
isn’t the final protective coating that will   go on the inside walls of the wet well, but it 
will work together with the grout at the joints   to reduce the chance of leaks. To prove it, the 
wet well is required to go through a leak test   before it’s backfilled to make sure it is water 
tight. That’s as simple as filling it to the brim   with water and leaving it for several days. At 
the end of the test, if there’s still water at   the rim (minus an allowance for evaporation) and 
no visible leakage on the outside, the wet well   is good to go. The crew did a little bit of epoxy 
injection into some small cracks as a precaution   during the leak test. That’s the source of the 
foam you can see floating on top of the water.   After the required test period, the wet well 
was certified leak free and ready for backfill. Backfilling this wet well isn’t as simple 
as dumping dirt into the hole. It has to   be carefully coordinated with the removal 
of the shoring system. Crews fight the rain   getting ready to start this process. And 
they make sure to clean up the muck and   mud in the bottom of the excavation, because 
this hole won’t actually be filled with soil,   as you’ll see. Since this shoring system was 
installed, the ground has had time to settle   and shift, increasing the pressure on the 
panels holding it back. That means getting   these panels out is going to be a little 
bit harder than it was to get them in. The contractor first uses the excavator to bump   and push the shoring system around to 
loosen the panels and free them up. A hydraulic puller is connected to the inner 
plates to lift them up. But even that wasn’t   enough in some instances. The reaction forces 
required to pull these plates up along the guides,   with the friction of the soil they’re 
holding back, are tremendous. A few times,   rather than lift the inner panel up, the hydraulic 
puller instead forced the outer shoring panel   deeper into the ground… or bent the reaction beam.  With a lot of persistence (and a big excavator),   they got the panels lifted enough and 
ready for the first layer of backfill. Rather than trying to compact soil in this tight 
area, the plans call for Controlled Low Strength Material,  also known as flowable fill.  This is 
a slurry of cement, fine aggregate, and water   that sets up like concrete although with a lot 
less strength. It might sound strange, at first,   to intentionally use a material with low strength, 
but it has an advantage, because the contractor   is going to have to trench through this backfill 
later in the project when the pipes are installed.   It also saves a lot on cost. Conventional 
earthwork would be nearly impossible to   do well in this narrow excavation, but 
flowable fill is considered self-compacting,   and it won’t settle over time.   It’s used 
in all kinds of irregular excavations or   voids like this where compacting earthen material 
would be difficult to impossible. In this case,   they can pour the flowable fill directly 
into the excavated area using a wooden chute,   and even the irregular areas behind 
the shoring panels are filled with   material that will harden within a 
few hours and never settle over time. The backfill comes up in batches that 
equal a few feet or around a meter each   so that the shoring can maintain support 
of the excavation as the level comes up.   The next batch of backfill follows a few days 
afterward. Now that the shoring system panels   are loosened up, they can be lifted up with some 
gentle but persistent tugs of the excavator arm. This batch of flowable fill is being placed with 
a pump truck to make it easier to get all the way   around the wet well, and the pump truck operator 
is already getting it set up. The panels are being   lifted up just in time, as mixer trucks are 
starting to arrive. Each truck unloads into   the hopper of the pump and takes off right away 
to make room for the next one. The pump truck boom   moves the hose to each corner of the excavation 
to place the flowable fill. There’s a little bit   of water in the hole, but it’s not enough to 
cause any issues with this backfill operation.   The controlled low strength material 
continues to backfill the excavation,   and all the while, the crew continues working 
on removing the shoring system for the hole. Over the next couple of days, the crew continues 
to remove elements of the shoring system from the   excavation so that they can continue backfilling.  Before the flowable fill trucks show up,   the crew works to get the final panels pulled 
out. Rather than pull them all the way out   before the previous layers of backfill set, some 
of these panels were left in the ground while the   flowable fill cured. That balanced the earth 
pressure on the other side, making them easier   to pull out. Getting them out last also makes 
the access a lot easier.   They work on cleaning up the shoring system so it can be sent back. 
And they also clean up the excavation to remove   loose soil so they can continue to backfill 
using flowable fill. And they’re just in time   for the trucks to start showing up.  Mixer truck 
after mixer truck arrive to continue filling   this hole up to the top of the second stage of 
excavation. Almost looks good enough to drink! Once that layer of fill has cured, it’s time 
to start backfilling with soil. First, any   uncompacted soil is removed from the excavation 
to make sure there are no loose pockets of dirt.   The backfill soil is brought into the hole, 
spread out in an even layer called a lift,   and then compacted into place. Every once 
in a while, a technician checks the backfill   with a density gauge to make sure it meets the 
specifications. A lot of important parts of the   project will eventually sit on top of this fill, 
so it’s important that it won’t settle over time. A surveyor comes out the next day to mark out 
the next step of the project. Even if it won’t   settle much, the compacted soil might settle 
a little bit, so the most important parts of   the project will sit on flowable fill all the 
way up. It’s just easier to backfill the entire   area with soil and only carve out the spots 
that need to be flowable fill afterwards. An   excavator carefully cuts away the areas that will 
eventually be backfilled with flowable material. The next day, it’s more flowable 
fill. Truck after truck arrive to   backfill this excavated area just like a bathtub.   It’s almost hypnotic. All in all it took 11 truckloads 
of flowable fill to finish out this part of the job. And the San Antonio 
River Authority’s newest wet well is backfilled not far from where the 
ground surface will eventually be. There’s still no sewer pipes yet. Right now, it’s 
just a big concrete tank sitting in the ground. We   still need to connect it to the sewage system. 
And the pipes that will make those connections   possible were just delivered to the site. But, 
they’re not quite ready to install just yet. This wet well was backfilled using a material 
called flowable fill. It’s a mixture of sand,   cement, and water that acts kind of like 
a low strength concrete. And here’s why:   even though this material has to be 
strong enough to avoid settling over time,   it also has to be soft enough to be 
excavated with machinery so that the   pipes can be installed. It might seem odd to 
backfill the area before installing pipes,   but it's much simpler to excavate narrow 
trenches for the pipes afterward rather   than try to keep those areas open during backfill 
of the rest of the site. Three lines will connect   this wet well to the surrounding sewer system, 
which means three trenches need to be cut out. These trenches will need people working 
inside them to install the pipes. You can probably guess what they’ll be using to 
keep those workers safe from a collapse   or cave-in. Shoring will be installed 
where the depth or stability of the hole   necessitates. These steel boxes arriving 
at the site will brace the walls of the trenches. They get put into place with the 
excavator before anyone can enter the hole. Since sewer pipes are often buried well below 
the ground, especially at lift stations where   they terminate at the bottom of a slope, they have 
to withstand considerable pressure from the weight   of the soil above. To make sure the pipe can carry 
these loads, the design calls for select backfill   around the envelope of the pipe. This gravel 
being delivered to the site will be used as   the bedding material. It’s called bedding because 
it conforms around the pipe to provide support.   The bottom of each trench gets a layer of gravel 
bedding where the sewer pipes will eventually sit. But, before the pipes go into the trenches, 
they need a way into the wet well. You may have noticed there are no holes in the tank just yet.  That’s because the location of the pipes is critical.  They work by gravity, so it’s essential 
that they be installed at the right elevation to slope into the wet well  exactly as required in 
the design. If the holes came pre-installed,   there’s a chance that a subtle shift or twist 
of one of the segments would cause them to be   misaligned. It’s just easier to drill them 
in the exact right spot once the wet well is   installed and backfilled in its final place. 
The pipeline crew takes their time to confirm   the measurements with surveying equipment 
and double-check each of the connections.   You know the old saying: measure twice, 
core through a foot of solid concrete once. This is the core drill that will be used to 
create the penetrations. First a small hole   is drilled into the wet well, and a concrete 
anchor is installed. This allows the frame of the core drill to be temporarily bolted to the 
wall to keep it in the correct location.  The drill is assembled on the frame.  And before long, 
it’s running.  It’s basically an overgrown version of the hole saws you might have used on wood 
or drywall. The core drill uses water from a   hose to lubricate and cool the hole saw and keep 
the concrete dust down. The saw is advanced by   hand slowly but surely through the concrete 
wall.  Eventually, it breaks through on the inside of the wet well. All that’s left is 
a heavy chunk of the concrete core.  That’s hole number one finished. Two more to go. The 
drill is assembled in the next location and put   to work. It’s not long before the second hole 
is done. The third penetration goes just as   smoothly as the previous two, and by the end of 
the day, the wet well is ready to be plumbed in. The gravel bedding in the first trench gets its 
finishing touches to make sure it’s at the right   elevation and there are no protruding rocks that 
could damage the pipe. Then the line is lowered   into the trench. To create a watertight joint 
between the pipe and the concrete wet well,   a link seal is installed around its perimeter. 
This device uses rubber links surrounded by   plastic to seal the annular space between 
pipe and concrete. Tightening the screws   compresses the rubber material, creating 
a long-lasting watertight connection. A second length of pipe is lowered into the trench 
to connect to the first one. These plastic sewer   pipes attach together using a bell-and-spigot 
design. The spigot end slides into the bell,   which has a gasket that provides a watertight 
seal. First the spigot has to be lubricated so   that it doesn’t damage the gasket as it slides 
in.  The two sections of pipe are pulled together   using a chain hoist, and eventually the backfill 
will keep them from sliding apart over time. This first sewer line actually won’t connect 
to anything at all, at least for the time   being. As this area continues to develop, 
there will likely come a time when a third   lift station is needed to deliver all the 
wastewater uphill to the nearby treatment   plant. The San Antonio River Authority and their 
engineer knew how quickly this area would grow,   so they made sure to proactively upsize this 
wet well compared to its neighbor. When more   capacity is inevitably needed in a few years, 
all they have to do is install some new pumps   instead of a completely new wet well. But 
eventually, Phase 3 will come, and this   pipe will allow the new lift station to connect 
to the one under construction right now. Until then this one gets capped off. The solid PVC cap 
is pulled into place at the end of the pipe, and it’s almost ready to be buried. That’s the first 
pipe in, and it’s time to move on to number two. Since this trench isn’t as deep, it doesn't 
require shoring. Just like the first line,   gravel is spread into the trench to 
act as bedding for the pipe. A laser   level is used to make sure the slope of 
this pipe matches what’s required in the   plans. Once the bedding is in place, 
the pipe is swung into the trench. That big black bulge in the middle of the pipe 
is a flexible coupling. Although this wet well   has been designed not to move, even slight 
shifts from settlement, temperature changes,   or structural loads could put stress on 
the connected pipes buried in the ground.   These flexible couplings give each sewer 
line some freedom to move independently   of the wet well like a gross bendy straw, 
reducing stress on the pipe and the chance   of a break. It’s covered in plastic to 
protect it from the backfill material. A second length of pipe is added to the line.  Then the whole 
string is bumped into position using the excavator.  You can get a good look at that link 
seal here. Once it’s connected to the wet well,   the loader brings bucketfuls of bedding material 
and dumps them on top to hold everything in place   until they’re ready to backfill the rest of the 
site. This pipe will eventually tie into a manhole that will 
connect it to the rest of the sewer system, so we’ll be back here in a minute.  The third line running to the new wet 
well will connect it to the system of   the existing pumping station already 
installed on this site. These two   facilities will work together to move raw 
wastewater to the nearby treatment plant.   This third line needs to pass under the 
concrete of the existing lift station,   and that’s going to require a saw. This crew has 
a walk-behind saw with a diamond blade that can   cut through this slab like butter. It connects 
to the water supply to lubricate and cool the   blade and to minimize the amount of concrete 
dust in the air. They follow the lines marked   by the surveyor. Then they break the concrete 
up into sections to make them easier to remove. Once the concrete is up, the crew can 
trench the third line. As the trench is cut,   bedding gravel is added to the bottom 
just like the other two. And the shoring   is dropped in to protect workers from a 
cave-in before they can enter the trench. Thick steel plates are used on top of 
this concrete when the trench isn’t   actively being worked on to allow vehicles 
to drive over when needed and keep someone   from accidentally falling in. Now that it’s time 
to install the pipe, these plates get removed. The first pipe is lowered into the trench 
with the excavator. It is inserted into the last hole of the wet well. And then bedded 
down with gravel to hold the pipe in place. Once the plumbing is complete, the trench boxes 
can be removed. All three pipes get completely   covered with the gravel bedding material that will 
provide even support. Since it’s basically rock,   the bedding material doesn’t need to be compacted 
around the pipe, a process that might damage the   plastic lines. Once the bedding is in place, shiny 
green warning tape is placed in the trenches.   In the rare event that someone is 
excavating this area in the future,   they should uncover the tape first to let them 
know there’s an active sewer line not far below.  Finally, the trenches get backfilled with soil 
to cover and protect the new sewer lines. Our old   friend, the vibratory, remote-controlled, trench 
roller is back in action. It is kind of cute, but this roller compactor packs a 
strong punch, and it’s the perfect   size for working inside these trenches. A layer of backfill is added to the trench, 
and then it gets compacted into place. Every once in a while, a technician checks the 
density and moisture content of the backfill  using a nuclear 
density gauge as a quality control measure.  If the density were to be too low, the backfill 
would get another few passes from the compactor. Around the outside of the wet well where a 
concrete slab will eventually sit, the engineer   has specified that, instead of compacted soil, the 
area be backfilled with flowable fill. but now,   where it was trenched out for the sewer lines, it 
needs to be placed again. This site is a little   bit of a mess at the moment, so instead of trying 
to get the mixer truck around the entire wet well,   the crew instead just uses the excavator bucket 
to get to the spots where the chute can’t reach.   Where it can, the flowable fill is placed 
right into the hole.  Watching flowable fill go in is one of my favorite things. And the 
excavator bucket pats the backfill into place, just for good measure. Just like that, this project’s sewer lines are 
connected to the wet well and backfilled.  Now it’s time to 
connect them to the rest of the sewer system. The crew starts excavating for the 
manholes where the new pipes will   connect to the existing system. But take a look 
at this. That’s not a leak in the sewer line.   It’s groundwater traveling through the soil and 
right into the newly excavated area. From there,   it’s moving into the new sewer line and right 
into the wet well. You never know what you’ll   find when digging deep holes in the ground. But, 
at least it’s a good test that the new sewer line   is working correctly!  The crew installs a pump to 
keep the site dry while the new manholes go in. The first manhole will connect the new 
lift station to the sewer that runs into   the existing facility. First the concrete is 
removed and the area is excavated down.  The excavator works carefully to avoid damaging the 
line below. Every once in a while a worker checks for the pipe.  Once it’s exposed and visible, 
the rest of the excavation goes smoothly. The   shoring is the last piece before the manhole 
can be installed. This is a doghouse manhole,   named because of the U-shaped holes that 
allow it to fit over existing wastewater   pipes. That line is in service right now, 
carrying sewage to the existing lift station,   so it can’t be disturbed. The manhole 
fits over the new line and the existing   sewer. The crew lowers it into place 
and checks to make sure it’s level. But,   the manhole doesn’t have a bottom… yet. It 
will have to be cast in place with concrete. Concrete forms, called falsework, installed by the 
crew plug up areas where the concrete shouldn’t   flow, keeping the inside of the manhole tidy while 
the outside can be a little lumpy. Concrete is   dumped into the manhole and around the outside. An 
immersion vibrator is used to get the air bubbles   out and mobilize the concrete past the sewer 
pipes. It’s hard to see the work going on inside,   but this concrete will be smoothed and shaped to 
create a gentle path for the wastewater to flow.   Here’s a peek into one of the other manholes on 
site so you can see what it will look like when   completed. While one crew works on this manhole, 
another continues backfilling the trench. Each   layer of backfill gets compacted into place 
with the remote-controlled trench roller. Manhole number two also connects the lift station 
to an existing wastewater line. The crew carefully   excavates downward to the line to avoid 
hitting and breaking it. A worker with   a shovel checks every so often until they 
find the pipe.  Once the old line is exposed,  they can excavate for the last segment of new 
pipe and the final manhole of the project. Both lines that connect to the new wet well also 
have a plug valve installed. This will allow the   River Authority to divert wastewater to the 
other lift station when needed for repairs   and maintenance. I’ll show you how it all 
works once this manhole is installed. The   last segment of pipe going to the new wet 
well gets lowered into place, measured,   then cut to length. Finally it is pushed into 
the bell to connect it to the rest of the line. Just like the previous one, this is a doghouse 
manhole that drops over the top of the sewer   lines that it will connect. The crew works to 
install the falsework to hold back the concrete   that will form the bottom of the manhole. You can 
also see the plug valve installed on the existing   wastewater line. Once everything is ready, 
concrete is placed into the manhole and around   the outsides to form the bottom. An immersion 
vibrator helps the concrete flow around the pipes. Again, this doesn’t have to look pretty 
on the outside. It just has to form a   stable bottom for the manhole 
and seal the areas around each of the sewer lines.  Once the manhole bottoms are cured, each one gets 
a precast top segment that will eventually have an   iron lid. And sealant tape is applied around 
the perimeter of each joint in the precast   segments to prevent leaks. Those blue pipes 
hold the stems for the plug valves. Finally the manhole bottoms and pipe segments get a 
leak test. Plugs are installed in the pipes   where they terminate at the wet well. These 
get inflated to create a seal at the end of   the line. Then each manhole is filled with water 
and left to make sure there are no leaks. Later,   the pipes in the manholes will be cut 
so wastewater flows into each one,   but for now the pipes are left continuous so 
the manholes are bypassed during construction. Finally I can show you how all this plumbing fits 
together. There’s an existing wastewater line   here that runs into this existing manhole. And 
there’s another existing line that comes in from   the opposite direction. Right now, they all flow 
into the wet well of this single existing lift   station. But now, the San Antonio River Authority 
has options. The new line and manhole here, plus   the two valves, means that all the wastewater from 
this line can be diverted into the new wet well.   And the new line and manhole here, means that all 
the wastewater from the other line can be diverted   into the new wet well too. There’s just one 
piece missing, and it just showed up in a truck. This monster plug valve is the last one 
needed to make these lift stations fully   redundant. It will go on the 24” (or 
600 millimeter) diameter sewer line   flowing into the existing lift station on 
this site. But you can’t just turn off a   functioning sewer line to install a valve. 
All the houses connected to this pipe are   still using it 24/7. So how do you do a job 
like this and keep the wastewater flowing? A crew uses a diamond saw to cut out the concrete 
above where the line will be excavated. Then an   excavator begins work to remove the soil above the 
line. Like all the trenches on this job, this one will need shoring to keep the soil from collapsing 
while crews are working inside. Eventually,   the crew gets the line uncovered, but it can’t 
be cut just yet. Remember that all the wastewater   from the surrounding area has been collected 
and concentrated into a single pipe (this   one!). Before the valve is installed, all that 
sewage will need to be temporarily redirected. This bypass pump is just the right piece of 
equipment for the job. The crew lays out the hoses   for the pump between an upstream manhole and the 
downstream lift station. Then they build a ramp so vehicles can get over the top. An inflatable 
plug will keep wastewater from flowing into the 24” or 600  millimeter diameter sewer line while 
the valve gets installed. The pump will divert   the wastewater straight into the lift station, 
bypassing the sewer line. A worker monitors the   level of sewage in the manhole and regulates the 
bypass pumping to keep up with the wastewater   flow. Meanwhile, a crew works to cut the existing 
line. Once a section of pipe has been removed, 
the valve can be lowered into place. This valve 
uses a mechanical joint to connect to the existing plastic pipe. Bolts connect a gland to the 
valve and compress a gasket between the two,   pressing it tightly against the pipe to 
make a watertight seal. The crew finishes installing the valve with haste, 
and then they use gravel bedding   to backfill the trench just like the rest 
of the underground piping on the project. At the new lift station across the site, it’s 
time for more backfill. It might be hard to tell, but all of this work is still happening under what 
will be the final grade. Now that all the pipes are installed, the site needs to be brought 
up to its designed elevation. Anywhere that   will eventually get concrete is backfilled with 
this select material. It’s basically road base:   crushed rock that interlocks and compacts into an 
extremely stable subgrade. The other parts of the   site that won’t be used to support any structures 
can be backfilled with the native clay. First,   the material is spread out in an even layer called 
a lift. Then the roller compacts it into place.  An inspector checks the density of the backfill as a 
quality control measure. A hole is hammered into   the new compacted soil using a metal pin. Then the 
tester pushes a source rod into the hole. This rod has a radioactive source on the tip. It actually 
requires a license to operate one of these gauges,   but backfill is important. A lot of expensive 
stuff is going to sit on this material, and we   don’t want it setting over time. The nuclear gauge 
can calculate the density and water content of the   soil based on how much of the source radioactivity 
makes it through to the sensor above the surface. Most of the underground work is done by now, but 
not all of it. This lift station will use some   pretty big pumps, which means it needs robust 
electrical connections. The conductors between   the pumps will run in underground conduits. 
First the trenches are shored for safety.   Then the bedding gravel goes in to provide 
even support to the conduits once they’re buried.  With the conduits installed, a layer of 
red concrete goes in. The red color is an extra   precaution to warn anyone digging in the future 
that there are electrified lines below. Finally,   the trenches are backfilled with select fill 
and compacted to prepare for construction of   the controls shelter. They use a vibratory plate 
compactor around the larger areas, and a tamping rammer (also known as a jumping jack compactor) 
to get into the tighter spaces.  At this point, there’s a lot happening all at once on site, so 
don’t mind if I show a few things out of order to   keep the story clear. Construction schedules are 
rarely designed with narrative structure in mind. This area will eventually get a concrete 
slab and a steel shelter to protect the lift   station’s electrical equipment and controls. The shelter will be supported by three posts 
concreted into these holes in the ground. The crew works to install the 
concrete forms that will make up the posts’ foundations and compact 
the surrounding soil to create a firm base. Each   form tube is checked for level and elevation 
before it’s secured into place with backfill.   Each hole will also get steel reinforcement 
before the concrete is placed. This rebar   helps the concrete foundation resist forces like 
wind loads that the shelter will be subject to. Once the posts have been installed and concreted 
into place, the crew works on forming the rest   of the shelter pad. They install formwork around 
the edges, tie reinforcing steel to be embedded   in the slab, and form around locations where 
electrical conduit comes up from underground. And,   before long, it’s time for the concrete trucks. 
Concrete is placed into the forms using the chute on the truck.  It’s spread roughly into place 
with shovels.  Then a screed board sets the top surface.  Once all the concrete is in, a magnesium 
float is used to smooth the surface and embed the   large aggregate in the concrete. The bull float 
has a tilting mechanism that makes it easy to   smooth the concrete in both directions, pushing 
and pulling. Then the slab is left to cure. It’s a little hard to see with the concrete 
in, but the entire perimeter of formwork is   lined with these little wooden triangles called 
chamfer strips. When the formwork is removed   from this slab, you can see the nice 45-degree 
corners, or chamfers, these strips create. The   chamfers not only improve the appearance of the 
slabs, but they reduce the chances of the corners   chipping or breaking over time, extending the 
lifespan of the pad. Once the slab is complete,   the rest of the shelter can be installed. Steel 
sheets are attached all along the roof and the   back wall. These sheets will eventually 
protect the electrical equipment panels   from sun and weather. We’ll come back 
to this shelter when the electricians   have made some progress on those panels. 
Right now there’s more concrete to place. The area between the wet well and the new shelter 
will eventually have all the discharge piping from   the pumps and other equipment aboveground. But 
first it needs a concrete slab. The crew finishes   compacting the subgrade below the slab and checks 
the level using a laser. Just like the electrical   shelter, this equipment slab starts 
with formwork around the perimeter   and a mat of reinforcing steel. The 
concrete arrives on site.  However,  before it goes into the forms, a little 
bit goes into a wagon for the testing lab. How do we know that the concrete delivered 
to a construction site actually meets the   specifications required by the engineer? 
We have to do quality control tests,   or at least a technician on the site does. 
First, the technician performs a test to   check the workability or consistency of the mix 
called a slump test. A cone is filled with the concrete and rodded to remove air bubbles. Then the cone is lifted, 
allowing the concrete to slump.  The distance from the top of the cone 
to the top of the concrete is measured, and   this must be within the allowable guidelines. Too 
little slump and the concrete won’t flow easily   into the forms. Too much slump may be a sign 
that the concrete has been improperly mixed.   This test also helps verify that the concrete 
across multiple trucks has similar properties. Next the technician checks the air content of 
the concrete. The air meter applies pressure   to the concrete sample, compressing the bubbles 
within the mix so that the change in volume can   be measured. Not enough air entrained in the 
concrete can make it brittle and subject to   flaking, especially under freezing conditions. 
Too much air can make the concrete difficult to   finish and create surface defects. Finally, the technician uses plastic 
molds to form concrete cylinders. These cylinders will 
eventually undergo compression testing   after they’ve had time to cure to make sure 
that the concrete is as strong as required by   the engineer. If the concrete company made 
an error in a batch they sent to the site,   it would be caught by one of these tests, and 
the slab would have to be taken out and redone.   Luckily, all the concrete on this project 
passed quality control with flying colors. This equipment slab is placed just like the one at 
the electrical shelter. Just before the concrete   is too stiff, a broom is run along the surface 
to provide a non-slip texture to the slab. That’s   another one done on this project, but we’re still 
far from finished with concrete. The next task is   the light pole. Like the shelter, this pole will 
be supported using a drilled concrete shaft. And   the drill just arrived in a pickup truck. Skid 
steers are versatile little machines, and this   one has been equipped with a miniature drill rig. 
The surveyor has already marked the centerpoint of   the hole, and now it’s time to drill out the soil 
so the concrete can be installed. The process is   simple: spin the auger until the soil is broken 
up in the hole; pull it out and shake it off;   then do it again; and again. It doesn’t take 
long at all to reach the final depth of the hole, almost as deep as this little auger 
can reach. Then a trench is dug to run   the power lines through conduit to the light. 
Reinforcing steel is placed inside the hole and   a cardboard tube is used to form the pier above 
the ground. This will get concrete in a moment. Meanwhile, workers are making progress forming 
the slab over the top of the wet well. First,   scaffolding will have to be assembled 
within the wet well. Something has to   support the underside of the concrete 
slab while it is cast in place,   so scaffolding is erected inside the wet 
well to provide this support. All this   scaffolding will have to be removed through 
the access hatch once the concrete is cured,   so all of this has to be easy to disassemble when 
the time comes. Finally, the carpenters install a   plywood false cover over the top of the wet well 
that will form the bottom of the concrete slab. Unlike the equipment slab that is essentially a 
continuous area of concrete, the wet well cover   slab has a lot of embedded items. In addition to 
the formwork, it gets blockouts for the vent pipe,   the stilling well, each of the three discharge 
lines for the pumps, a suction line for the backup   diesel pump, and vent line for the air release 
valve. Don’t worry if all this equipment means   nothing to you right now. I’ll show you what 
all of it does when it’s installed. Of course,   the biggest blockout is the access hatch that will 
allow people and equipment to get into and out of   the wet well once the project is finished. The 
access hatch is placed where it will be embedded   in the concrete slab. Then it’s secured into place 
so that it doesn’t shift during the concrete pour. One challenge with the concrete slab above the 
wet well is that it needs to stay attached to   that structure no matter what. If the heavy 
concrete wet well settles over time, we don’t   want the slab on top being separated from the 
rest of the structure. The project’s structural   engineer developed a pretty cool way to make sure 
these two components of the project act as one,   and it involves a lot of cardboard. These are 
void forms designed to fit perfectly within the   space of the wet well cover slab. Well, perfectly 
with a bit of excavation. This shot is a perfect   reminder of how strong this select backfill can 
be. That angular crushed rock compacts so tightly   you need a hammer drill to break it loose. The 
void forms were manufactured and delivered to   the site already built, so it’s kind of like 
a puzzle getting them all to fit just right. These cardboard forms are strong enough 
to hold up the concrete while it cures,   but they will quickly deteriorate, 
leaving an empty space below the slab.   The concrete is designed to only be supported 
by the perimeter of the wet well itself. That   ensures that, if the wet well settles 
over time, the slab will settle too   without experiencing undue stress from the 
underlying subgrade pushing back upward. If you had a careful eye, you may have caught 
these retaining blocks being cast onsite using   some simple carpentry for molds. We called 
them pavers, since they look like stepping   stones you might buy at the hardware store. Once 
they’re cured, the retaining blocks get placed   all around the formwork for the wet well cover 
slab. After the cardboard void forms deteriorate,   they leave an empty space between the concrete 
slab and the subgrade, which is an issue around   the edges. We don’t want soil collapsing into 
the void that’s left behind, or any animals   getting in there either. So, the project requires 
these precast concrete retainers be installed all   around the perimeter of the wet well slab. When 
the cardboard dissolves, these will keep soil from   filling the void while still allowing the slab 
some freedom to move up or down with the wet well. The reinforcing steel is installed inside 
the forms. That gets an inspection to make   sure it conforms to the engineered plans. And 
finally, it’s time to place the concrete. All   that reinforcing steel is needed to make sure 
this slab can cantilever out past the wet well,   since it won’t be supported from underneath (once 
the cardboard dissolves). And all the blockouts,   electrical conduits, and the access hatch are 
secured in place. The concrete is spread into place with rakes. And, it’s vibrated to help 
it consolidate and flow around the dense mesh of rebar. You can see the air bubbles coming 
up out of the concrete as it’s vibrated into place. The finishing crew carefully floats 
the surface all around the penetrations. The foundation for the light pole gets concrete 
in the drilled hole. And then it gets more   concrete in the trench carrying the electrical 
conduit that will deliver power to the light.   This is a perfect example of the pace of heavy 
construction. It’s taken days and weeks of hard   work to get this light pole and wet well cover 
slab formed and ready for concrete. And then,   the trucks and finishing crews arrive and 
are done with the pour before lunch time. A few more structures need to be 
installed before the concrete on   this job is mostly over. One is the slab 
that will hold a diesel pump that can be   turned on in the event of an emergency or 
power outage when the main pumps are out   of service. The subgrade below the slab 
gets backfilled and compacted. Electrical   conduits are installed that will carry the 
control cables. Then the concrete can go in. The wet well also gets an electrical rack to 
hold all the connections between the panels,   sensors, and pumps. There will also be 
an outlet here for any equipment needed   to service the wet well when it’s complete. 
The conduits stub up from their underground   trenches and the wet well cover slab here. The carpenters assemble the formwork. And, the fresh concrete is placed inside. Once the concrete is cured, 
the forms are stripped off these slabs and they get compacted 
backfill around the sides. Before long,   the electricians have the rack and junction 
boxes installed at the wet well. And while   they're backfilling, the crews finish 
installing those concrete retainers. You   can really see how soil might collapse into 
the void forms below the wet well lid without   them. Another concrete placement is for a 
curb that surrounds the diesel pump slab.   If the pump ever leaks fuel, this curb will keep 
the diesel from contaminating the adjacent soil.   A pipe with a valve makes it possible to 
drain the containment area of rainwater. The last place we need some concrete, for now, 
is at the new manholes. The cast iron covers   have already been installed on the concrete 
manholes, and now they need concrete around   the rim and valve box covers. This area is 
backfilled with select material; compacted,   and formed. Then the concrete is 
placed as required in the plans. Remember that these manholes aren’t doing 
anything yet. The active sewer lines are   still running straight through them with no 
connection. One thing that’s needed before   those lines can be cut is on its way. 
But they need to be cleaned out first.   A crew power washes the inside of both manholes 
and the wet well in preparation for what’s next.   That’s the job of this box truck pulling into 
the site. If sewage decomposes without a good   supply of fresh air, it can generate hydrogen 
sulfide gas. This gas is not only poisonous, but   also extremely corrosive to steel and concrete. To 
protect these new structures from the challenging   environment in a wastewater system, the walls and 
floor of the manholes and lift station wet well   will get a spray-on epoxy liner. The worker dons 
a protective suit and respirator before descending   into each manhole to apply the coating. The gun 
mixes the two part epoxy right before it exits the nozzle. Touch ups are applied topside. Next, another worker uses a trowel to 
smooth the lining and ensure consistent coverage. It only takes a 
few hours for the epoxy to fully cure and harden. The parts of the wet well that won’t be lined 
are masked off first. Then the spray lining is   applied to the inside walls. The worker checks 
the thickness of the wet epoxy to make sure he’s   applying the right amount. The manholes and wet 
well are now considered “confined spaces,” so   there are special safety precautions about 
working inside them. The crew uses a gas   meter to check for a hazardous atmosphere. They 
use ventilation fans to keep fresh air flowing.   They have a rescue winch installed to lift 
the worker out of the hole if anything were to   happen. And they have a spotter whose only job is 
to keep an eye on the worker inside to make sure   they’re staying safe. Before long, the entire wet 
well walls are lined with the protective coating.   The masking is removed from the access hatch. And,   this team will be back once the bottom of 
the wet well is finished to complete the job. The concrete slabs are almost all complete. 
The manholes are ready for wastewater;   The electrical shelter is ready for equipment; and 
the wet well is ready for pumps. It seems like a   lot is left to be done, but these last steps 
of the project will happen before you know it. Pipes are arriving on site to the San Antonio 
River Authority’s newest wastewater lift station.   Now that most of the underground work is 
done, it’s time to start installing the   equipment that will connect the wet well to the 
uphill treatment plant. The pipes arrive with a   protective coating that, in most cases, needs 
to be removed. The sand blasting rig is here,   and so is the sand that will be used to 
clean these pipes and get them ready for   paint. The process of sand blasting, 
also called abrasive media blasting,   uses compressed air to fire media through 
a hose. (In this case the media is sand,   but there are lots of other materials that 
can be sent through a hose with compressed   air.) All the steel pipes for the project 
are blasted clean of the protective factory   coating. This gives the flanges fresh surfaces 
so that they will seal together correctly,   and it cleans and roughens the outside of the 
pipes to prepare them for the final coating. Once blasted clean, the pipes are ready to be 
painted, but you rarely hear it called that   in the field. Paint used to protect metal 
surfaces is mostly just called “coating” by   the pros. This spray painting rig also 
uses a pressurized air supply from a   trailer-mounted compressor to deliver paint to 
the nozzle. All of the pipes and fittings are   masked off to make sure none of the coating 
gets on the flanges or inside. Then they’re   set up on saw horses and coated. All the 
fittings and reducers get coated as well. But we don’t just hope the coating 
meets the project specifications;   we double-check. This is a dry film thickness 
gauge that uses a magnet to measure how much   paint is built up around the pipe. Turn the wheel 
until the indicator pops up, and it tells you the   coating thickness in mils which are thousandths 
of an inch or about 25 microns. Once confirmed   that the coating meets specifications, it’s 
almost time to start installing the pipes. The very first lines will go into the wet well, 
but the scaffolding inside has to be removed   before that. This assembly has been useful to hold 
up the form work while the concrete top was cast   and for the spray liners to stand on while they 
did their work, but now it’s in the way. It gets   dismantled inside the wet well, and each piece 
is lifted out one by one. While one crew gets the last few pieces of scaffolding out, another 
starts laying out the locations for all the pipes   using string lines. The strings make it easier 
to get nice straight lines as pipes, fittings,   and valves are moved into position. And plumb 
lines mark the locations at the bottom of the   wet well directly below each of the three 
blockouts in the concrete lid at the top. A lot of these pipes are quite heavy, so the 
mobile crane is brought back to the site one   more time to help lift them into place. It gets into position, 
and then the operator puts down the outriggers to help create a stable 
base. And finally it’s time to start installing   pipes. The first discharge line is lowered into 
the wet well through the hatch. It’s attached   to a special quick-release connection system 
already installed at the bottom of the wet well. The next section of the first discharge line is 
lowered into the wet well through the hatch. It’s   set at the bottom of the wet well, then re-rigged 
through the concrete blockout at the top, and   lifted into place. Once positioned correctly, the 
flanges are bolted together. This gets repeated   for the other two discharge lines. The first pipe is lowered into the wet 
well and attached to the pump discharge quick release, then the 
second line is put in, disconnected, re-attached   through the blockout, and lifted into place. The 
space between each of the discharge lines and the   concrete blockout are filled with link seals just 
like the sewer lines coming into the wet well. Before long, it’s time to start connecting 
the above-ground sections of pipe. These   pipes will sit on supports that are bolted 
into the concrete pad. Holes are drilled,   and then anchors get epoxied into the holes. 
Once cured, the anchors will hold each pipe   support rigidly to the slab. Most of 
the above-ground piping and fittings   come together using flanges. A gasket between 
the flanges creates a pressure-rated seal,   and the ring of nuts and bolts holds each 
pipe section tightly to its neighbor.   All these pipes and fittings come together 
pretty quickly, but it will be easiest to   understand them if we go in order. I’ll walk 
you through the whole assembly in a minute,   but I want to start with the pumps, and they 
haven’t been installed in the wet well just yet. Before they go in, the bottom needs a little 
work. Since the pumps will be installed near   the center of the wet well, the outside 
corners could be an area where solids   accumulate. The engineer specified that the 
bottom of the wet well be sloped toward the   pumps in a bowl shape to make sure there are 
no stagnant areas where solids might settle out   of suspension. And that’s going to take some 
more concrete. A concrete pump arrives to the   site and gets set up by extending its boom. 
The truck lowers a hose into the wet well,   and a finishing crew works to get the new 
bottom perfectly sloped toward where the   pumps will eventually sit. Once this concrete 
cures, the coating crew returns to finish up the   epoxy liner at the bottom of the wet well. 
And finally it’s time to put in the pumps. Each of these pumps is rated to use 50 kilowatts 
or 67 horsepower of electricity to move around 800   gallons or 3000 liters per minute to an elevation 
of around 200 feet or 60 meters above this lift   station. And there will be three of them in the 
wet well. These pumps are specifically designed   for sewage applications. The San Antonio River 
Authority hopes that no one would put anything   except water, human waste, and toilet paper into 
the sewage system (and especially not wipes). But,   in the case that something larger or more fibrous 
finds its way to this lift station, the impellers   in the pumps have a special shape to avoid getting 
caught on stringy debris. And if a pump does get   clogged, each one can be disconnected from the 
discharge line and lifted with a chain out of the   wet well for service. That means installing the 
pumps for the first time is a pretty simple job. Each pump has a knuckle that fits into vertical 
guides that run along the discharge pipes. A   hoist or a crane simply lowers the pump along 
the guides. When the pump reaches the bottom,   it seals against the discharge line with 
its own weight, providing a pressure-rated   connection without having to send someone to 
the bottom of the wet well to tighten bolts.   Each of the pumps’ chains is hooked at the 
top of the hatch to make it easy to remove   a pump from the wet well for inspection 
or service. And the electrical cables are   securely attached there as well. Those electrical 
connections run in conduits through the concrete   and up to the junction boxes where they are 
attached to the rest of the control system. Part of the job of the control system 
is to know when to turn the pumps on,   so this wet well needs a liquid level sensor. 
The sensor is installed inside a stilling well,   a length of pipe inside the wet well meant to 
isolate the sensor from any splashing or waves   that happen from the wastewater flow. This is 
really just a length of PVC pipe that extends   almost the entire height of the wet well. You 
can see the stilling well at the top right in   this shot as crews start to fill the wet well 
with water for its first test. And you can see   the float switches installed as well. If the level 
sensor stops working or something else goes wrong,   these simple float switches will set off an alarm 
and flash a light at the top of the controls   shelter to let operators know that the level is 
too low (which could cause the pumps to run dry   and overheat) or too high (which could cause 
a backup in one or more of the sewer lines or   an overflow). The wet well also gets a gooseneck 
vent to equalize the air pressure inside and out. This water is just for testing the pumps, but 
before long, wastewater will start flowing into   this wet well from the surrounding sewer lines. 
When the liquid reaches a prescribed level, it   will trigger the control system to automatically 
turn on one of the pumps, called the lead pump.   And if the level keeps going up, a second pump 
(called the lag pump) will turn on too. This   lead-lag configuration helps the station account 
for variable flow rates, and the third pump acts   as a standby. The lead pump, lag pump, and standby 
alternate so that they wear down evenly over time. Each pump has its own discharge line, we saw be 
installed, that comes up through the concrete   to an aboveground manifold. First the lines 
are each equipped with a pressure gauge that   makes it easy to see if the pump is running 
and (if so) at the right pressure. Then each   line gets a check valve that only allows flow 
in one direction. This valve prevents one pump   from simply backflowing wastewater into the wet 
well through another pump’s discharge line. Next,   the lines each have plug valves so they 
can be isolated for maintenance. Pipes   and valves don’t last forever, so 
everything in this facility has been   designed to make it easy to service 
parts and keep things up and running. After the isolation valves, all the individual 
lines come together into a single pipe that   passes through an automatic air release valve. 
Air bubbles that get into the line can get stuck   at this high point and constrict the flow. This 
valve uses weights and a float to automatically   release air from the line without letting any 
of the wastewater out. As you might imagine,   air bleeding from a pipe full of raw 
sewage isn’t exactly pleasant to smell,   so the air bleed line runs right back to 
the wet well. This also keeps wastewater   from leaking onto the ground if 
this valve were to malfunction. And, just like this facility is designed for 
ease of maintenance, it’s also designed with   lots of redundancy. The three pumps are 
just the start. Sewage keeps flowing, even during emergencies and power 
outages, so this pump station is   designed with contingencies. A fourth pump, 
this one powered by diesel, can keep the   wastewater flowing if this facility loses grid 
power. And now it’s time to put the pump in place. The diesel pump has a suction line 
installed in the wet well you can   see here. And it’s discharge line runs 
to the aboveground manifold with a check   valve and plug valve like the others. But 
even if all four pumps are out of service,   the manifold also includes an emergency bypass 
so that the San Antonio River Authority could   bring in another mobile pump, hook it up 
quickly, and avoid a backup or overflow. All 5 pump discharge lines come together ahead 
of the flow meter that keeps an accurate record   of how much fluid passes through the pipes each 
day. Operators can compare the readings on this   meter to the ones at the end of the line to 
make sure there are no leaks or equipment   malfunctions between the two. One last plug 
valve makes it possible to isolate the entire   facility for maintenance. And then wastewater 
leaves the pump station into the force main. This is a pressure-rated sewer line that 
was installed during construction of the   original lift station, and now it’s time 
to connect it to the new facility. Crews   extended this line toward the new pump station 
earlier in the project but waited for the final   pieces until the discharge manifold was finalized. 
They install the elbows to turn the corner. Each   connection is attached with a compression fitting 
called a mechanical joint. The final length of   underground pipe is installed. Then, concrete is 
placed at each of the bends to create structures   called thrust blocks that will distribute the 
pressure into the soil and keep the pipe from   moving over time. The metal pipe is wrapped in 
plastic. All the underground piping is backfilled.  And now this lift station has a direct connection 
to the wastewater treatment plant nearby. In many ways, a wet-well type lift 
station is just like a sump pump in   your basement. The water level comes up, it 
triggers a float switch, the pump comes on,   and the water level drops back down. But in many ways this facility is 
not anything like a basement sump pump, and most of those ways 
are electrical. Let’s take a look at the power   and control systems of the pump station. Both 
the original lift station on this site and the   new one are fed power from the grid through 
these new 480-volt transformers installed by   the electric utility. Each of the three phases 
runs through a disconnect switch, allowing the   entire facility to be isolated from the grid, a 
meter so the utility can bill for power usage,   and then a fused switch that will protect the 
equipment in the event of a short circuit. Each   of these monster fuses is rated for 350 
amps at 500 volts. That’s a lot of power. From there, power heads to the control shelter and 
its panels. Another disconnect switch allows the   new pump station to be isolated for maintenance. 
And then a transfer switch is installed. Again,   it’s all about redundancy. If the power goes 
out, the San Antonio River Authority can bring   in a mobile generator and connect 
it directly to the equipment here,   flip the transfer switch, and power the 
lift station off-grid. And, a transformer   converts the 480-volt service to 120-volts 
for the lights, outlets, and other controls. Of course, a high-voltage facility like this 
needs a robust connection to the ground to   protect workers and make sure that a fault can be 
identified quickly. Copper rods are hammered deep   into the ground and welded to the conductors to 
create a good bond. The entire grounding system   gets tested to make sure it’s well connected 
to the earth. A small current is run between   the ground rods and a test electrode on 
the other side of the construction site,   and the resistance between the two is 
recorded. If the resistance were too high,   more ground rods would have to be installed, 
but this system passed the test just fine. This panel houses the remote terminal unit for the 
San Antonio River Authority’s Supervisory Control   and Data Acquisition or SCADA system. Rather 
than send someone to this lift station to   record data or change the controls, it’s easier 
to pipe everything to a centralized location.   SCADA is a type of industrial network 
that interconnects sensors, controls,   and databases to keep accurate records and 
enable remote control of facilities like   this one. An antenna at the top of the shelter 
gives the lift station a wireless connection,   and the remote terminal unit provides an 
interface for an operator at the lift station. But that doesn’t mean there aren’t manual 
controls. This is the pump control panel   that allows an operator to start and stop each 
of the three pumps. It includes circuitry to   soft start each one to avoid huge power surges, 
cycle through the pumps so they wear evenly,   and error systems to shut down a pump if 
it overheats or loses a seal. The panel   next to it has the circuit breakers for each 
pump to protect them against short circuits.   These panels connect to the pumps through 
underground conduits. The electricians had a   pretty clever way to run the cables through. First 
they tie a plastic bag on a string, and suck it   to the other side with a vacuum. Then the cables 
can be tied to the string and pulled through each conduit. Once all the electrical work is done, 
this project is getting close to wrapping up. The contractor starts cleaning up the site 
to prepare for the last items. One of those   items is installing bollards to protect the 
lift station from an errant vehicle. They   attach to drilled concrete piles to create 
a strong and sturdy foundation. Then the   last concrete of the job goes in. This slab 
connects the new lift station to the old one, creating a driveable area for maintenance 
personnel and operators. They also replace   the concrete that was removed to trench in one of 
the sewer lines below the original pump station. The bollards are installed, and concrete is 
complete. Now all that’s left is to get this facility in operation. The first test of the 
pumps won’t be sewage, but water from the city   distribution system. If something goes wrong, it’s 
a lot easier to fix it before the sewage hits the   proverbial fan. The hose goes into the wet well 
and it slowly starts to fill up for the test. On testing day, the plan is simple: turn on 
each of the pumps to confirm it’s operating   as designed. The pump manufacturer has a 
representative on site to help with the process.   Each pump is turned on. They check the pressure 
on the gauge to make sure it's right.  And, they check the flow meter to ensure the pump 
is moving the right amount of fluid out of the   wet well. You can easily see the level in the wet 
well dropping as each pump is turned on. Finally,   they run the emergency diesel pump to confirm it’s 
working as well. It sounds easier than it really   is to check everything in this sophisticated 
facility and confirm it’s working properly for   the very first time, but before long, all the 
equipment passes the checks with flying colors. It’s been almost an entire year of work to get the 
San Antonio River Authority’s newest lift station   built and running. We’ve followed the process from 
the first scoop of dirt until now. And if you look closely, you can see how much the surrounding area 
grew just during that time.  Those new developments and new houses will depend on this pumping 
station to carry wastewater away to the uphill   treatment plant. All the people who live and work 
in this area might not ever even know its there,   and that’s kind of the point. We want our sewage 
to be out of mind and out of sight. But, I hope   you’ve enjoyed getting an up-close look at what it 
really takes to keep our modern world running and   all the hard work that goes into even the most 
hidden parts of our constructed environment. Huge thanks to the San Antonio River 
Authority for inviting us onto their project,   their engineer UEG for fielding all our questions 
about the design, and their contractor MGC (and   all their subs) for putting up with us on the 
job site to document the process. It really is   not a small thing to have a film crew watching you 
work, especially when your job is hard enough as   it is. Thanks to our streaming partner Nebula, 
where you can watch the whole series ad-free at   the link below. And huge thanks to the Practical 
Engineering team who made this series possible. There’s a relatively new term in Italian, 
umarell (I’m sure I’m pronouncing that wrong),   but it refers to retired people who spend their 
days watching construction sites. I really believe   we all deserve to be those old pensioners, 
seeing how the world gets built around us   first hand. And documenting the construction 
of heavy civil infrastructure has been a dream   of mine for a long time. It took a ton of work 
from everyone involved to make it happen. But,   hopefully we made it look effortless! What do you 
think? I really do want to hear your feedback, so   shoot me an email or leave a comment below. Thank you for watching, 
and let me know what you think!

---

## 33. The Wild Story of the Taum Sauk Dam Failure
**Channel:** Practical Engineering | **Views:** 10.6M | **Date:** 1 year ago | **Duration:** 20:10 | **ID:** zRM2AnwNY20
**Link:** https://youtube.com/watch?v=zRM2AnwNY20

### Transcript:
Early in the morning of December 14, 2005, pumps 
were nearly finished filling the upper reservoir   at the Taum Sauk power station, marking the 
end of the daily cycle. Water rose to the top   of the rockfill embankment, reaching the concrete 
parapet wall that ran along the top of the dam.   But the water didn’t stop. One of the two pumps 
shut off, but the other kept running, and soon,   the water was lapping over the wall. Within 
minutes, those splashes turned into a steady   stream cascading over the parapet, pouring against 
the embankment on the other side. The rockfill   eroded slowly at first, but the hole grew deeper 
and wider. The pump finally shut off, but it   was too late—the footing of the parapet wall had 
already been undermined. The wall tipped over, and   a massive surge of water was unleashed down the 
mountainside headed directly toward a state park. This award-winning pumped storage facility, 
considered a model of modern engineering,   immediately became the center of intense scrutiny. 
And what the investigations found would change   a lot about the field of dam safety. I’m 
Grady, and this is Practical Engineering. When it was built in the 1960s, the Taum Sauk 
pumped storage plant was unlike really any other   power plant in the world, at least in terms of 
size. South of St. Louis in the Ozark Mountains,   it was designed to meet a very specific need. I’ve 
talked about pumped storage on the channel before,   and Taum Sauk was one of the largest facilities 
of its time. Built by Union Electric,   which eventually merged with Ameren, the 
whole plant is basically a battery. It’s   actually a net consumer of electricity, 
which is normally not a good thing for a   power plant. But managing the power grid isn’t 
only about how much electricity you can produce,   but also when you can produce it. Large 
coal plants in the Missouri area could   make lots of power, but they couldn’t ramp 
that production up and down to accommodate   fluctuating demands throughout the day. So, 
Union Electric proposed a clever solution,   one that’s pretty common today, but was innovative 
for its time. Two reservoirs were constructed:   one low on the east fork of the Black River 
and another near the top of Proffitt Mountain,   Missouri’s sixth-highest peak. Between them, a 
hydroelectric plant with two reversible turbines. When electrical demands are low, rather than 
reducing the output of thermal power plants,   that energy can go toward pumping water from the 
lower to the upper reservoir, usually overnight.   Then when demand spikes during the day, all 
that stored potential energy created from   cheap electricity can be harvested and put back 
on the grid by reversing the system to generate   hydropower. Of course, you don’t get all the 
power out that you put in. Some of that water   evaporates or leaks out, and there are losses of 
energy in the pumping and generation. But, with an   overall efficiency of around 70%, it was more than 
enough to justify the enormous cost of building   and operating two reservoirs and a power plant 
that doesn’t produce any of its own electricity. The most striking part of the whole facility is 
the upper reservoir. It’s just such an unusual   sight: a circular dam, sometimes called 
a ring dike or ring levee, perched on top   of a mountain. This is not usually an efficient 
way to build a dam. We typically construct them   across valleys so that the natural topography 
can form the sides and back of the reservoir.   With a so-called “off-channel reservoir” you have 
to build the dam all the way around, increasing   the costs and the engineering complexity. But 
there are no valleys at the tops of mountains,   and that height is an essential part of a 
pumped storage facility. The power available   from falling water is really simple to calculate: 
multiply gravitational acceleration, the density   of the fluid, the volumetric flow rate, and the 
difference in height, called head. We can really   only change two of these. So for a specific power 
output needed for a specific duration, you can   trade height for flow. The greater the difference 
in height between the two reservoirs in a pumped   storage facility, the less water you need to move, 
which reduces the size of all the infrastructure,   and thus saves costs. The mountains in southeast 
Missouri provided a perfect location for the   project, creating about 750 feet or 230 meters 
of height between the upper and lower reservoirs. Actually the whole facility is named after 
the highest mountain in Missouri, Taum Sauk,   which was the original site for the upper 
reservoir until there was too much pushback   about building a project there, so they moved 
it to a slightly lower peak nearby. And they   encountered some challenging conditions during 
construction, forcing the engineers to realign   the dam to avoid an area of weak geology, giving 
it that unique kidney bean shape. The original dam   was built as a rockfill embankment - basically 
just dumping a long pile of rocks around the   perimeter of the reservoir. Rockfill usually works 
well as an embankment if you have a good source   of material nearby. It’s really strong, doesn’t 
require a lot of compaction, and it doesn’t settle   much over time like soil fills do. One thing 
rockfill doesn’t do well is hold back water.   Too many spaces between the rocks. So concrete 
panels were installed all along the inside of   the reservoir to make the embankment water-tight. 
A tunnel connected a morning glory inlet through   the mountain to the generating plant. The inlet 
was set into a basin 20 feet or 6 meters below the   bottom of the reservoir to suppress the potential 
for a vortex to form as it was drained each day.   The whole project was designed to be operated 
remotely with no on-site technicians required,   another innovation for the time, but one of 
the many decisions that would prove disastrous. For most of its life, the Taum Sauk station 
operated on average around 100 days per year,   usually during the hot summer months when 
electricity demands were more variable between   night and day. Deregulation of electric power 
markets in the 1990s opened up the possibility   of selling power to other utilities. 
Those 100 days per year went up to 300,   meaning the upper reservoir cycled up and down, 
often twice per day, nearly every day of the year.   And that was starting to cause some problems. The 
upper reservoir had dealt with leaks essentially   since it started operating in the 1960s. Several 
projects were implemented throughout its life to   deal with the issue, but the increased cycles 
of filling and draining were only making things   worse. At one point, small ponds were built 
beside the reservoir to capture some of the   leakage and pump it back inside. In the fall 
of 2004, Ameren decided to bring out the big   guns and spent more than two million dollars 
to install a geomembrane liner to cover the   entire reservoir. That essentially fixed the 
problem, but it caused a few new ones too. About a year later, in September 2005, the 
Institute of Electrical and Electronics   Engineers, or “I-triple-E” declared 
the plant an “Engineering Milestone”   for its innovations in the world of electrical 
infrastructure. On the day before the ceremony,   some of the participants took a tour of the 
upper reservoir and witnessed water pouring   over the parapet wall on one side of the 
dam. The operators quickly switched from   pumping mode to generation to get the water 
back down. They chalked up the issue to high   winds from a remnant tropical storm that 
caused the overtopping, but just to be safe,   they hired a dive inspection team to check on the 
level sensors. And what they saw was concerning. When that geomembrane liner was installed in 
the reservoir, there was a valid concern that   any penetrations might cause leaks in the future. 
But the reservoir needed level sensors installed   for the control system to be operated remotely. 
So, instead of mounting those sensors directly   to the concrete through the liner along their 
length, the engineers tried something different.   Two cables were run between anchors at the 
top and bottom of the embankment slope. The   conduits for the sensors were attached to those 
cables, minimizing the number of penetrations   needed. Unfortunately, the mounting system was 
underdesigned. Those conduits were buoyant,   and also subject to strong currents as 
the reservoir filled and emptied each   day. Sometime after the spring of 2004, 
they had become dislodged and deflected,   so the sensors inside were providing readings 
that were lower than the actual water level. Based on those findings, the operators 
decided to reprogram the control system   to subtract two feet from the upper set point 
on the pumps. The original design called for   two feet or 600 millimeters of freeboard 
between the top of the wall and the maximum   water surface. They figured that doubling that 
distance would be enough to avoid issues until   permanent repairs could be made during 
the annual maintenance period when the   reservoir was drained. Unfortunately, 
they would never get the chance. Less than three months after that first time 
someone observed the reservoir overflowing,   on December 14, it happened again, this time 
in the early dawn when no one was around to notice.  Once the parapet wall collapsed, the 
water quickly eroded down through the dam,   emptying roughly 6 billion liters or 200 million 
cubic feet of water down the steep mountainside   straight toward Johnson’s Shut-Ins State Park, 
stripping away trees and rocks as it surged.   By pure luck, the failure happened in the winter 
when the park was practically empty, but the park   superintendent, his wife, and three kids (one of 
whom was only seven months old) were swept away   when the water demolished their house. Incredibly, 
the entire family survived the event, but not   without suffering from injuries and hypothermia. 
The wave of water flowed into the lower reservoir,   where it would have gone anyway later that 
day, so there were no major downstream impacts. The event was investigated by the 
Federal Energy Regulatory Commission,   and the conclusions were surprising. Like most 
events of this kind, a series of small oversights,   which on their own wouldn’t have resulted in a 
disaster, combined to cause hundreds of millions   of dollars in damage, plus the effects on the 
family I mentioned. First was the embankment.   That rockfill it was supposed to be built from 
wasn’t quite as rocky as the engineers who   designed it intended. There was a lot more soil 
mixed into the fill, resulting in more settlement   of the embankment over time. Unsound areas of 
soil in the embankment’s foundation were also   not properly cleaned out, making the settlement 
even worse. From construction to failure,   some parts of the parapet wall were a full 
two feet or 600 millimeters lower than where   they started. That settlement wasn’t taken into 
consideration when the level sensors were replaced   after the lining project in 2004. And with the 
sensors unattached and free to move around, there   was no way for the logic controllers to know the 
actual elevation of the water in the reservoir. Failsafe probes were installed on the parapet wall 
to provide a backup that would automatically shut   off the pumps if the level got too high, but they 
were installed in a location that was actually   higher than the top of settled parts of the 
embankment wall. If the water hit those sensors,   it was already overtopping parts of the wall. 
And they were incorrectly programmed in a way   that required both sensors to be activated before 
the pumps shut off. That first site visit when   water was running over the wall didn’t trigger 
those failsafe sensors, but no one thought to   check them. And rather than ground truth the 
important elevations like the top of wall and   all sensor levels, they just decided to add a 
couple feet of margin and postpone a permanent   fix. It would have been so easy to have someone 
on-site during those last few minutes of   filling the reservoir each day to verify the 
levels against the electronic measurements,   or even a closed circuit camera, especially 
after the enormous red flag of seeing it   happen a few months earlier, but no one knew it 
was overtopping. And the owner hadn’t notified   the regulator the first time it happened, so 
there was no oversight for how Ameren responded. Probably the most significant error of 
all happened well before the facility   was ever built. The design had no spillway. As 
an off-channel reservoir, there were only two   ways water could get in: rain falling on top or 
water being pumped in. With enough freeboard for   a rainstorm and the redundancies built into the 
control system, the designers never envisioned a   need for a way to let water safely run over the 
top. Unfortunately, when you rely on complicated   systems for safety, the likelihood for things to 
go wrong goes way up. These types of events are   sometimes called “normal accidents,” a term 
coined by Charles Perrow. The idea is that,   when systems are complicated, and especially 
when the safety measures themselves add to   a project’s complexity, failures are much 
more likely, even expected. In other words,   failure becomes normal. Compared to an industrial 
control system, a spillway is dead simple. Once   the water gets to the crest, it just goes out. 
They’re not failproof - I’ve talked about several   spillway failures in previous videos - but there 
are a lot fewer ways that things can go wrong. FERC fined the owner 15 million dollars for 
the failure, the largest penalty they’ve   ever issued. Five million of that went into a 
fund to improve the area around the project,   although some recent reporting has alleged 
that those funds have been mismanaged. The   State of Missouri also sued, and agreed 
to a 177 million dollar settlement, much   of which went toward restorations at the state 
park, which held a reopening ceremony in 2010. At the same time as Johnson’s Shut-Ins State 
Park was undergoing renovation, crews were   working on rebuilding the upper reservoir at 
Taum Sauk. To avoid a relicensing process,   the dam was built on the same alignment and to 
the same size as the original project. Rather   than trying to repair the flawed rockfill 
embankment, Ameren and their consultants   went with an innovative design. The new dam 
was built using roller-compacted concrete,   a dry concrete mix that’s handled using 
earth-moving equipment and compacted into   place using rollers. The new design would 
address both the settlement and leakage   issues the original structure struggled with while 
still taking advantage of the material from the   original embankment. That rock fill was crushed 
and processed into aggregate for the concrete,   reducing the amount of material hauled into 
the remote site. Maybe most importantly,   they included a spillway this time. The structure 
is the largest roller-compacted concrete dam   in the United States. The plant reopened in 
2010, was rededicated as an IEEE milestone,   and the project won the US Society on Dams’ 
award of Excellence in the Constructed Project. The failure at Taum Sauk was a wake-up call for 
the professional community. The regulator, FERC,   implemented some big changes to its oversight of 
dam safety in the wake of the collapse. They put   together a task force that issued a technical 
guidance document specifically addressing the   challenges of pumped storage facilities 
that was circulated to the owners. They   also updated rules for owners, requiring them 
to have an internal dam safety program and a   Chief Dam Safety Engineer who is responsible 
for overseeing it, a role Ameren didn’t have   at the time. The event triggered states as 
far as Hawaii to bolster their dam safety   programs. And most importantly, the failure 
demonstrated the need for overflow spillways,   even for off-channel reservoirs with redundant 
control systems meant to avoid overfilling. If you’re paying attention to issues related to 
the electrical grid, you know the importance of   storage. Particularly as intermittent sources 
of power become a large part of our portfolio,   ways to balance out those mismatches in 
supply and demand are only becoming more   important. Pumped storage has traditionally been 
the only large-scale way to do this economically,   but obviously, it comes with a tradeoff. Dams 
are among the riskiest structures that humans   build. They don’t fail very often, but when 
they do, those failures usually come with   serious consequences to people, property, 
and the environment. And because they don’t   fail that often, those lessons come slowly and 
tragically. But, with battery storage becoming   cheaper and much more widespread, it will be 
interesting to see how the economics of pumped   storage change. By 2030, some are predicting 
the US will have more than 400 gigawatt hours   of battery storage on the grid; that’s more than 
100 Taum Sauks. We’re right at the beginning of   some major changes in how energy is stored. Those 
batteries have a lot of technical differences in   how they interact with the grid, and they come 
with their own environmental challenges and   safety considerations, but the risk profile is a 
lot different than building a major reservoir at   the top of a mountain. As energy infrastructure 
keeps evolving, those differences in risks are   probably going to shape the future of 
how we store power, and at what cost. A big lesson from Taum Sauk that we learn over and 
over again is the destructive power of water. It’s   something I care a lot about - it’s defined my 
education and my career, and so I pay a lot of   attention to the news about floods and disasters. 
For example, major flooding recently hit parts of   Central Europe. There’s no such thing as a purely 
natural disaster when it comes to flooding,   and I’m always trying to understand how 
infrastructure is helping or hurting,   like the dam that failed in Poland. There’s always 
a push to control the narrative after a disaster,   and by focusing on different details of the 
story - the casualties, preventive measures,   and response - different outlets 
can subtly, or not-so-subtly,   change how you interpret the facts. That’s why 
I like to use Ground News, today’s sponsor. Ground News aggregates major news stories 
and adds context to make reading the news   easier and more effective. This one update 
on the flooding was covered by 230 outlets;   you can see how just reading a single one might 
not give you a comprehensive viewpoint. Every   story comes with quick visual breakdowns and tags 
for political bias, factuality, and ownership of   the sources backed by ratings from independent 
news monitoring organizations. For this story,   you can see that 43 percent of the reporting 
outlets lean left, 40 percent are center,   and only 17 percent lean right. 50 percent are 
media conglomerates 73 percent of the outlets   have been rated “High Factuality.” They 
also have a feature called the Blind Spot   that shows you stories mainly covered 
by one side of the political spectrum:   stuff you might totally miss if you only 
follow a few main sources for your news. Maybe more than anything else, disasters shape 
the field of engineering. They’re how we learn   to do better in the future, so it’s important 
to me to get a broad perspective on issues   like what happened in central Europe. In that 
way, journalism has a lot of power over us,   and Ground News hands some of that power back 
to you. If you’d like a more transparent media   landscape, they’re offering a huge discount 
right now at the link in the description:   40 percent off the Vantage subscription, 
which includes unlimited access to all   their features. That’s ground dot news 
slash practicalengineering or just click   the link in the description. Thank you for 
watching, and let me know what you think!

---

## 34. Is the World Really Running Out of Sand?
**Channel:** Practical Engineering | **Views:** 1.6M | **Date:** 1 year ago | **Duration:** 19:38 | **ID:** SB0qDQFTyE8
**Link:** https://youtube.com/watch?v=SB0qDQFTyE8

### Transcript:
If you have to know the answer right away, it’s 
no; or at least, my goal with this video is to   convince you that the world is not running 
out of sand. But if it were that simple,   I wouldn’t be here (right?) and you 
probably wouldn’t be either. In fact,   I was really surprised by some of the 
things I didn’t know as I dug deeper into   the topic further, and how some of the most 
widely spread sand “facts” are dead wrong. The wide world of sand is complicated, and 
not in a boring, pedantic kind of way. This   simple material touches nearly every part of our 
lives, and the science and engineering behind it   is rich and deep, and to me at least, hard not to 
become obsessed with. There’s a good chance you’ve   seen articles or videos over the past few years 
with essentially the same story about sand. The   “Sand Wars” documentary kind of kicked off the 
modern discussion, and then Vince Beiser wrote   an excellent book on the topic, “The World in 
a Grain.” Of course, a lot of the book’s best   reviews focus on the fact that sand is kind of a 
topic that’s “taken for granted” or “neglected.”   But, at least in civil engineering, it is one of 
the most glected materials out there. And I’d like   to give you a peek behind the curtain and show 
you how we think about this seemingly unlimited   resource and why it’s worth knowing a little 
more about it. But first, I need to head out   to the garage and put some sand in a rock tumbler, 
because I want to do a material property shootout,   and this is going to take a little while. I 
have something really cool in the other barrel,   and I’ll show it to you later on in the video. 
I’m Grady, and this is Practical Engineering. What the heck is sand anyway? It’s kind of a 
“know it when you see it”-type material. If   we use the US Department of Agriculture’s soil 
textural triangle, sand is any granular material   that is at least 85% sand… So, what the heck is 
sand? For a better answer, we have the Unified   Soil Classification System. Geotechnical engineers 
sometimes say that “dirt” is a four-letter word.   Maybe because it undermines the importance 
of soil (which is also a four-letter word,   by the way), but I like to think it’s because 
we have better names for all the dirts around   the world, and here they are. In fact, 
there are four specific kinds of sand,   but they all fit this one criterion, and it’s all 
about the size of the particles. At least half of   those particles have to make it through a Number 
4 sieve (about 5 millimeters), but no more than   half can go through a Number 200 sieve (less than 
a tenth of a millimeter, or about 75 microns).   That is a pretty wide range of materials, but 
I think when you picture sand in your mind, you   probably imagine what the USCS would call “clean 
sand” where less than 12% pass the 200 sieve. So,   just to make it simple, let’s say that sand is 
a material where the particles fit through this,   but they don’t fit through this. But still, that 
encompasses a huge range of different dirts. And I   hope, at this point, you’re asking, “Who Cares?” 
because I would love to answer that question. In his book, Beiser calls sand “the most 
important solid substance on earth…the   literal foundation of modern civilization…” 
We use it to make glass, semiconductors,   fiber optics, filters, and abrasives, use it 
to texture surfaces, to play in, for beauty,   and more. But, probably more than anything else, 
sand is an essential ingredient in concrete. And,   you know, I’m a civil engineer; this is 
a channel about the built environment;   so I wanna talk about concrete. And, in fact, if 
this video sparks your curiosity about one of my   favorite materials, I have a whole playlist of 
topics I’ve covered in the past so you can learn   more after this. You can’t really overstate how 
important concrete is and how much of it we use.   There’s a bigger conversation to be had about 
its environmental impacts, but when compared to   alternative building materials, it just has so 
much going for it. It is an extremely low-cost,   durable substance that can be made into just 
about any shape you can imagine. Concrete has   enabled us to build structures that last for 
generations from some very simple ingredients   that are (mostly) available across the 
world: water, cement, gravel, and sand. Most of those ingredients are mined and used 
directly as raw materials. And they’re usually   mined close by. Transportation makes up a big 
part of the cost associated with sands used   for construction, so the distance between where 
they’re found and where they need to go is highly   correlated with how economical they can be. 
And that often leads to environmental impacts,   some worse than others, depending on local 
regulations. It turns out that the best sand   for concrete often comes from rivers, and mining 
in rivers can be particularly destructive because   the impacts can spread upstream and downstream 
through changes in the nature of the channel.   (I have a series of videos on that topic, 
too, by the way). Sand isn’t spread evenly   throughout the world, and it’s a non-renewable 
resource. Geologic processes produce it a lot   slower than we can use it. So, it makes some 
intuitive sense to say that we could eventually   run out. But here’s a fact that is often 
overlooked in the discussion: we can make sand. And it’s not that complicated, either. I talked 
about the definition of sand a little earlier,   but here’s another one: it’s just very small 
rocks. And we have engineered machines that   can transform big rocks into small ones. In 
fact, I have such a machine in my garage.   It’s called a hammer.  Some might argue that this 
isn’t the best use of my time, but I spent about   an hour to artisanally manufacture a batch of 
sand just to hammer this point home. First,   you crush the rocks. Then you put them 
through the sieves to remove the stuff that’s   too big or too small. It takes a little extra 
processing, but this is not grain surgery. And   this has a lot of benefits compared to sourcing 
natural sand. Hard rock quarries and crushing   operations are already out there producing 
coarse aggregates like gravel, so sometimes   the smaller stuff is a waste product anyway. 
It opens up possibilities when natural deposits   aren’t available and can move mining operations 
upland, away from rivers, where the environmental   impacts are less severe. And, it can make the 
concrete stronger. Let me show you what I mean. I took some sand out of my kids’ sandbox and 
put it in a rock tumbler for a week to try and   simulate the erosion it might see over years 
in windswept dunes of a desert. Obviously,   this erosion reduced the overall size of the 
particles. So, I classified both materials   with the sieves to make them a closer 
match for a fair comparison. And both   batches are within the spec for concrete 
sand in the US. Looking in the microscope,   you can clearly see the differences. The 
tumbled sand is rounded with roughly spherical,   smooth grains. The manufactured sand is jagged 
with sharp, angular corners. And watch what   happens when I pile them up. I filled up two 
pieces of pipe with the same amount of sand,   and then pulled the pipe away. It’s not a huge 
difference, but you can see the rounded sand   spreads out a little further because the particles 
have less friction. It makes intuitive sense that   concrete made from this sand would be weaker 
than with this sand. Let’s see if that’s true. I mixed up a simple batch of concrete from the 
crushed sand, and the tumbled sand keeping the weights of all the ingredients   equal. Here’s my recipe if you want to try this 
experiment yourself. Then I molded some concrete   cylinders and let them cure for a week. Most 
concrete mixes are meant to reach their design   strength after 28 days, but concrete strength gain 
is fairly predictable, so the relative difference   between the samples should be consistent in time. 
Most importantly, my little benchtop hydraulic   press would not be able to break these samples 
if I waited that long. And this load cell is not   calibrated, so I’m doing this test in arbitrary 
Practical Engineering units of force. The tumbled   sand cylinder broke at around 2500 units. And the 
manufactured sand concrete broke at 7500 units.   You can easily see the difference in the results. “Goodnight!” It was 3 times as strong. Of course,   this is my garage, not a testing lab, and I 
only did one sample because my arm got tired   of hammering rocks. Luckily, people much smarter 
than me have tested this out, and the results are   pretty conclusive that, if you keep everything the 
same, the angularity of fine aggregate increases   the strength of concrete. And that’s the story 
you probably know if you’ve read anything on   this topic. It’s the common explanation for 
why we don’t use dune sand, the most visible   of earth’s sand resources, in concrete. It’s 
intuitive. Rounded grains don’t lock together.   Beiser makes the claim not once but three 
times in his book. But it turns out it’s   not that simple, because strength isn’t the 
only property of concrete that we care about. Before concrete has to be strong, it has to be 
placed. Ask anyone who’s done this kind of work,   and they’ll tell you it’s hard. Well, it’s 
liquid at first, but it’s hard to work with.   Concrete is about two-and-a-half times 
the density of water. It’s heavy stuff,   and to get it into the forms often can require 
a lot of different tools: wheelbarrows, buggies,   chutes, pumps, hoses, and more. The better the 
concrete flows, the easier it is to do a good   job of placing it. And that matters. If a mix is 
too stiff, it can clog up hoses, trap air bubbles,   and ultimately lead to poor quality in the 
installed product. This property of concrete   is usually called workability. It’s often measured 
using a slump test. Fill up a cone of concrete,   pull the cone away, and see how far the concrete 
slumps. But the problem with workability is that,   in one big way, it works against 
strength. And it all has to do with water. What happens when the concrete truck shows up to 
your job site and the mix is too stiff? Depends   on if the engineer is there or not, but in 
a lot of cases, you just tell the driver to   add a few gallons of water to the mix. More 
water; better flow; easier to place. It’s   pretty straightforward, but there’s a reason you 
don’t want the engineer to know: water decreases concrete strength.   I’ve done a whole video 
about this with some garage demos, so again,   check that out if you want to learn more. The gist 
is that the ratio of water to cement is one of the   most important factors determining concrete's 
strength when it cures. Cement isn’t like some   types of glue that harden as the water or solvent 
evaporates. It goes through a chemical reaction,   incorporating the water into the final product. 
That’s why we say concrete “cures” instead of   “dries”. But, cement can only react with around 
35 percent of its weight in water, so any more   than that is just taking up volume in the mix 
that could be used by the stronger ingredients.   More water; less strong. And here’s where 
the shape of the sand grains comes into play. I did a little garage slump test to gauge 
the workability of those two mixes I made   for the earlier demonstration. Here’s the 
rounded sand mix… and here’s the manufactured sand.    “No slump at all.”   Honestly I expected this to be a subtle difference,   but it was like night and day. They weren’t 
even close. So I wondered, what would happen if,   instead of holding ingredient ratios constant, I 
used the workability as the controlled variable?   Let’s find out. First I used the manufactured sand 
with enough water to get it to a workable level.   100 milliliters got it to here, which is a bit 
better than the first one. Then I did a second   mix with the tumbled sand, slowly adding water and 
running the slump test until it was pretty close.   It took only 70 ml of water to make them match, 
30% less than the first batch. After a week,   I tested the samples. The tumbled sand sample 
broke at 4,800 units. And the manufactured sand   broke at only 4,300 units. The tumbled sand 
with the rounder grains was stronger this   time (by about ten percent), and it’s all 
due to the lower water content in the mix. So yes, if you use the same amount of water, more 
angular sand like you might find from a river or   manufactured sand is better, but that’s not what 
happens in real construction. I say this with   many, many caveats, but very generally, you only 
add as much water as you need for workability.   Rounded sand gives you better workability, so 
you can add less water, and thus get stronger   concrete. This idea that we can’t use wind-blown 
sands in concrete because of their shape is a   myth. In fact, the American Concrete Institute 
has a bulletin that says it better than I can: “The influence of fine aggregate shape and 
texture on the strength of hardened concrete   is almost entirely related to the resulting 
water-to-cement ratio of the concrete…” I tried to track down the original source of this 
idea that we can’t use rounded grains in concrete,   but got nowhere. Beiser cites an article from the 
UN, which itself cites a 2006 paper about using   two types of desert sand from China in concrete. 
But that paper doesn’t mention the roundness   of the particles at all. They didn’t include any 
measure of the shape of the grains in their study,   and they didn’t make any suggestions about 
how that particular property of the desert   sand may have affected the results of 
their tests. In fact, the conclusion   of that paper includes saying that desert sand 
is a feasible alternative to other types of fine   aggregates used in concrete. And the whole 
reason it was a subject of scientific study   at all has to do with size, not shape. This is 
a widely used specification for the distribution   of particle sizes of fine aggregate for 
concrete. Any sand in this area meets the   spec. And here’s the soil used in that paper. 
Even if the conclusion was that it doesn’t work,   I think this would have a lot more to do with 
the results than the shape of the particles. And that really gets to the heart of 
this whole discussion. Fine aggregates   are found throughout the world. We can even 
make our own. And concrete is like baking;   different ingredients can change the 
end results. But just like regional   bread recipes evolved based on the 
availability of local ingredients,   the construction industry has developed a lot of 
ways to use different local materials to achieve   good structural properties. The real challenge, 
like many things in engineering, is cost. It can be more expensive to manufacture sand 
compared to mining raw materials that can be put   directly in a mix, especially when you factor in 
the other ingredients, like chemical admixtures,   that might be required to make it more workable 
without adding too much water. It’s expensive to   transport better quality sand from far away, 
rather than finding it close to a job site   or batch plant. It’s expensive to mine sand in 
adherence to environmental regulations that are   becoming stricter worldwide. It’s catchy to say 
there’s a scarcity of fine aggregates on earth,   but I think it’s misleading. “Sand is getting 
a lot more expensive than it used to be” just   doesn’t make as nice of a headline. And the tricky 
part is that, in many ways, those costs have   always been there; we’ve just externalized 
them onto the environment and our future. All the ingredients in concrete are mined or 
harvested just like other natural resources.   It’s just that concrete is made on a scale 
that blows most other materials out of the   water. It’s a huge business, and there’s 
lots of money flowing, which means a lot   of potential environmental harm and social 
conflict as a result. That’s especially true   in places that don’t have robust oversight 
and enforcement of how sand is extracted.   And I think it’s important to point out that the 
low-cost of sand, because of its simplicity as   a material and its abundance, is a big part of 
why we use so much concrete in the first place,   even in situations where it’s not necessarily 
the best material choice in other respects.   Everything in engineering is a tradeoff, 
and if the economics around sand change,   the engineering and construction industries can 
change with them. Look at other examples of this. Diamond used to be exclusively a mined 
material, but now we can make it in a lab.   Synthetic diamond gemstones used in jewelry 
are now less expensive than mined diamonds,   but, admittedly, there’s a lot more to that 
economy than the costs to make them. What I   think is more interesting is that 99 
percent of diamond used in the world   for industrial purposes is synthetic. It used 
to be a rare mineral, but now you can pick up   a diamond drill bit or saw blade from the 
hardware store for a fairly small premium. Timber is another example. Natural forests used 
to be the only source, but now plantations,   trees planted specifically for harvest, now 
make up more than a third of the wood we use   globally. And engineered lumber like plywood, 
OSB, and structural composites can make more   efficient use of raw materials. I’m pointing 
out these examples, not to say they’re good or   bad - there are pros and cons in both cases - but 
just to illustrate how our demand for materials   in the construction industry changes with the 
supply, and how technology can have a huge impact   on that. And there’s another parallel between 
timber and sand: they both can be renewable. I had another barrel in the rock tumbler not going 
to use, so I broke up some chunks of concrete and   threw them in. I ran these through the grits, 
just like you would with any other rock in a   tumbler. Concrete is pretty soft compared to most 
natural rocks, so it didn’t polish up that nicely,   but the result is still pretty cool. You can 
really see the constituent materials of the   concrete after it spent so long rolling around 
in there: the small and large aggregates and the   cement paste locking them together. But the point 
of this demo is that concrete is pretty much just   rock, that’s mostly what it’s made of in the first 
place. And just like the rocks I crushed to create   manufactured sand, concrete can be recycled into 
aggregates that get reused in the construction   industry, either in new concrete or other 
materials, reducing demand for virgin sources. There’s a lot changing in the construction 
industry, and a lot of growth in the need for   materials like sand and gravel. But I don’t 
think it’s fair to say the world is running   out of those materials. We’re just more aware 
of all the costs involved in procuring them,   and hopefully taking more account for how 
they affect our future and the environment. I love diving into the nitty gritty details of 
stuff we normally don’t think about. Of course,   as an engineer I focus on the built environment, 
but there are topics like sand in just about   every field, a lot of them covered by my friend 
Sam from Wendover Productions in his series,   the Logistics of X. From coal mining to search and 
rescue to ski resorts, these videos just scratch a   particular itch to learn about underappreciated 
parts of the world. This one on the logistics   of Hajj covers all the complicated details 
of hosting 2 million visitors from all over   the world in Mecca every year. And if you want to 
check it out, it’s available to watch on Nebula. I talk about Nebula a lot. It’s a streaming 
service built by and for independent creators,   and it’s growing super fast. After the major 
overhaul of the home page, making it easier to   find new stuff to love, we’ve leaned into 
producing really good original content,   like The Logistics of X; basically allowing your 
favorite creators to make bigger budget videos   with more resources and without the pressure 
from advertisers or sponsors. That means you   get more creative, interesting, and thoughtful 
videos. My videos go live on Nebula before they   come out here, and right now, a subscription 
is 40% off at the link in the description. Plus if you already have a subscription, now you   gift one to a friend. Give yourself or someone 
you love a year’s worth of thoughtful videos,   podcasts, and classes from their favorite 
creators. It’s 40 percent off either way   at nebula.tv/practicalengineering. Thank you 
for watching, and let me know what you think!

---

## 35. When Infrastructure Gets Hacked
**Channel:** Practical Engineering | **Views:** 700K | **Date:** 1 year ago | **Duration:** 15:08 | **ID:** VE1wM4oIh8Y
**Link:** https://youtube.com/watch?v=VE1wM4oIh8Y

### Transcript:
This is a water tower, or as the pros would say, 
an elevated storage tank. Pretty common here in   the US, especially in flatter areas where there’s 
no nearby hillside to build a ground-level tank.   I have a whole video about how these work. In 
the most basic sense, a water tower is a buffer   between the ever-changing demands for fresh water 
in a distribution system and the high-service   pumps at the treatment plant that like to run 
at a constant rate. The level in the tank is   a key measure of performance. If it’s high, 
pressure in the system is good, and the pumps   can shut off… unless someone has messed with the 
computer system that controls that relationship. In early 2024, that’s exactly what happened in 
Muleshoe, a small town in the Texas panhandle.   A citizen noticed water spilling out of the 
elevated tank and reported it. When the city   went to investigate the problem, they didn’t 
find a stuck valve, malfunctioning sensor,   or broken pump contactor. The water 
tank was overflowing because of a   deliberate attack by a hacking 
group linked to the Russian military Some water was wasted, but ultimately, no 
one was hurt, and nothing was damaged in the   attack. Muleshoe was probably just a victim 
of opportunity. Having grown up in the Texas   panhandle, I think I’m safe saying that most 
towns there aren’t necessarily considered high   value targets for international criminal 
campaigns. But that’s the thing with cyber   security these days. It’s not just for the 
organizations with big secrets and lots of   money. Even in tiny west Texas towns, critical 
pieces of infrastructure are run by computers,   and a lot of them are connected to a network, 
making them vulnerable to bad actors. I’m not   a security expert; I’m just a civil engineer. 
But, I’ve worked on a lot of projects where   digital systems interact with infrastructure, 
and I’ve collected some really interesting   stories about how that can go wrong that I 
thought would be fun to share. So let’s peek   behind the control panel and talk about them. 
I’m Grady, and this is Practical Engineering. Once upon a time, everything from the power 
grid…   to drinking water distribution systems..  industrial manufacturing… to oil and gas…, dam operations, and more was run without the aid of   computers. Calculations were done manually, 
and engineers carried slide rules. Decisions   were made by skilled operators, valves were 
opened and closed by hand, wear and tear was   measured by human eyes, and so on. It’s easy to 
see the opportunities for digitization. If you’re   not relying on a person for everything, you can 
be more efficient, reduce the chance of error,   and improve safety by not requiring workers to 
be so hands-on. And there are quite a few ways to   computerize the control of industrial processes 
like operating a pipeline or a water system. One of the most widely used is called SCADA or 
Supervisory Control and Data Acquisition. This is   a fairly standardized architecture used in a wide 
variety of industries like manufacturing, oil and   gas refining, and most of the utility systems we 
rely on like electricity, water, sewer, traffic   lights, and more. Let’s look at an example of a 
basic municipal water system to see how it works. Getting fresh water distributed to a 
city is a big undertaking that requires   a lot of equipment, including valves, 
tanks, pipes, pumps, chemical systems,   and more. Some of these will include 
sensors to take some kind of measurement,   such as the water level inside a tank or the 
flow rate within a main line. Others will include   actuators, devices that can do something like turn 
on a pump or open a valve. All the devices connect   to one or more remote terminal units or RTUs. 
All the RTUs are then networked to a central   supervisory computer that sends control commands 
and collects the data. This computer normally   includes the Human Machine Interface or HMI. This 
is where an operator interacts with the system,   and they’re usually set up as simplified 
diagrams of whatever’s being controlled. Systems like this can be programmed to maintain 
certain conditions and automatically adjust   equipment to keep everything running smoothly 
and as expected. Automated systems never get   bored of doing the same thing over and 
over again, they don’t need to sleep,   and they don’t mind being exposed to hazardous 
chemicals. For example, let’s look at the high   service pumps and water tower. These are often 
configured in a lead-lag system with multiple   pumps for redundancy and reliability. When 
the level in the tank drops below a set point,   the lead pump turns on. With smaller demands, 
this will fill the tank to the upper set point,   at which point the lead pump turns 
off. But under higher demands,   the lead pump might not be enough. If the level 
continues dropping while the lead pump is running,   a lag pump with a lower set point will kick on. 
With both pumps running, the tank will fill,   eventually reaching the upper set point 
and kicking both pumps off. If you want to   see an example of this in action, check out my 
Practical Construction series where I embedded   on a construction site of a sewage pump station 
and documented the process from start to finish. That’s a basic example, but you get a sense of 
how useful a SCADA system can be. You don’t have   to manually control the pumps or be on site to 
check the tank level. And you can change those   set points. Maybe during seasons when demand is 
low, you don’t want the tank full all the time,   because the water spends too much time in 
there where its quality can degrade. You   don’t have to hire an electrician to reconfigure 
a control panel or put a technician in a dangerous   spot to adjust floats in the tank. Any trained 
operator can just change the values in the HMI.   They’re designed for simplicity, and in fact, 
I’ve always thought they often look a lot like old   video games. There’s something really nostalgic 
about the basic graphics HMI’s are often designed   with. It’s easy to forget that they’re connected 
to real systems, often large and complex systems,   where the stakes are high if something goes 
wrong, which is exactly what happened in Muleshoe. According to security researchers, Muleshoe’s 
SCADA system was breached by a group called the   Cyber Army of Russia Reborn with a portal set up 
so the city could have remote access. On January   18th, they posted this video supposedly showing 
them manipulating the HMI’s of two small Texas   water systems. Judging by the haphazard clicking 
around, it seems that the hackers know a lot more   about gaining access than they do about how 
water systems work. Most of the video seems   to be someone clumsily navigating screens 
and changing values at random. Nevertheless,   they managed to change a setpoint 
on one of Muleshoe’s booster pumps,   leading it to stay on even after the water tower 
was full, and eventually causing it to overflow. Ultimately the attack was pretty harmless, 
but it could have been worse. A similar   event happened in Oldsmar, Florida in 2021 
when a hacker reportedly changed the sodium   hydroxide feed in the water treatment plant 
from 100 parts per million to 11,000. The   event brought huge national attention 
to the issue of information security   for critical infrastructure. Two years later, 
the FBI concluded it probably was an employee   mistake and not an actual intrusion, but 
it was still a strong reminder of the type   of havoc that could result from a SCADA 
system with poorly secured remote access. Even further back than that, a SCADA system 
controlling sewer works in Maroochy Shire,   Australia was hacked by a disgruntled 
ex-contractor, releasing thousands of   gallons of untreated sewage into parks and 
waterways in 2001. And really, there’s no telling   how many similar attacks have happened across 
the world. A lot of them don’t make the news,   and even though they’re often investigated 
by authorities, the details aren’t released   for fear of sharing potential vulnerabilities 
that aren’t patched up in other systems. It’s   a constant arms race happening mostly behind 
the scenes. Hackers are constantly probing   systems for vulnerabilities, especially ones 
that are previously unknown (called zero-days,   because that’s how long they’ve been 
known about when exploited). But access   to industrial control systems isn’t the 
only digital threat to infrastructure. In May of 2021, the Colonial Pipeline 
Company, owners of the largest refined   petroleum pipeline in the US, was attacked 
by another Russian group called Darkside.   They didn’t gain access to any pumping or 
control systems. Instead, they installed   ransomware on the billing computers, locking the 
company out, and stole sensitive information,   threatening to release it if the company didn’t 
pay. Not knowing the extent of the threat,   the company shut the pipeline down. Over the next 
six days, a gasoline panic struck the eastern US,   with gas hoarding emptying out more than 12,000 
filling stations. A state of emergency was   declared, and rules governing tanker trucks were 
relaxed to allow for more fuel to travel by road. With FBI oversight, Colonial paid the ransom, 
75 bitcoins, or about 4.4 million dollars at   the time, within hours of the attack. But the tool 
provided by the group to unlock the system was so   slow, that they ended up using mostly their own 
backups to get the billing system back online.   Some of that ransom was eventually 
recovered, but it took six days to get   the pipeline started up again, and there’s 
still a ten million dollar reward out for   information leading to key leaders 
of the group. So how did they do it? Really it wasn’t very sophisticated. An employee 
was reusing a password that had been leaked in a   database from a prior breach. They just logged 
into Colonial’s VPN with purchased credentials.   That’s all it took to take down one of the US’s 
most important pipelines for six days. Again,   with that kind of access, it could have been a lot 
worse. And one thing you’re probably thinking is,   “why would you have the ability for remote 
access to critical systems like this at   all?” Is it really worth exposing yourself 
to the entire world of nefarious actors,   just to save a commute to the HMI? And, actually, 
a lot of critical systems don’t have an outside   connection. They’re air-gapped. But 
even that’s not a foolproof system. One of the first, and maybe well known, examples 
of infrastructure hacking, especially an example   designed to cause permanent physical damage, is 
STUXNET. Although the details are pretty murky,   STUXNET seems to have been developed by the US 
and Israel as a military-grade cyber weapon. It   was a worm, first reported in 2010, that 
specifically targeted SCADA software on   Windows computers. Stuxnet famously exploited four 
zero-day vulnerabilities to spread and interact   with SCADA systems. If a computer didn’t have the 
target software, it would just do nothing except   replicate. But when it found a computer with 
SCADA software and some very specific motor drives   connected, it would send a command to rapidly 
speed up and slow down the motors while faking   sensor data so that the SCADA system wouldn’t shut 
down or throw an alarm that something was awry.   Those specific motor drives were pretty much only 
used in gas centrifuges used to enrich uranium so   it could be used in nuclear weapons. It’s pretty 
clear what the worm was designed to target,   and it did work. STUXNET reportedly destroyed 
around a fifth of Iran’s nuclear centrifuges,   and probably shortened the lifespans of many more. 
And it was introduced to the facilities’ networks   not through a remote connection (the system 
was airgapped) but from an infected USB drive. And that really is the key to all this. Your 
cybersecurity is only as strong as one employee’s   willingness to plug in a USB drive or reuse a 
personal password at work or click a deceptive   link in an email or hold the door open for someone 
following behind them. And most of us are guilty   of doing these things. At least, every once in a 
while… But, these days, no matter who you are or   what you do, you probably use some kind of digital 
device in your life. And so whether you’re the   operator of a tiny water system in rural Texas or 
manage the largest gasoline pipeline in the US,   you also kind of have to be a cybersecurity 
expert too. The stakes are high. Digital systems   interact with every aspect of our daily lives 
and basic needs: water, electricity, sanitation,   public health, transportation, and more can all 
be seriously disrupted by someone or some group,   anywhere in the world, if we let our guard 
down. With great computer power comes great   computer responsibility. And just because many of 
these industrial control systems are only used or   understood by a small group of people, security 
through obscurity just isn’t realistic anymore. It’s funny, we don’t really notice a lot of this 
infrastructure or put that much thought into how   it affects us until it breaks down. That’s 
definitely true for water systems. Earlier   this summer, a major water line in Calgary 
broke, resulting in a month’s long water   crisis while they try to figure out not only the 
repairs on that line, but also the implications   the break has on the rest of their water 
infrastructure. And, to complicate matters,   the repairs have resulted in injuries and delays 
even while water consumption continues to grow. This story was reported on by over 25 news 
outlets, with most of the reporting coming   from the left. And if you look at the headlines, 
you’ll notice that most are pretty similar to   each other, regardless of political lean. 
But if you dig deeper into the articles,   you’ll see that framing changes considerably. 
Left-leaning outlets tended to focus on the   urgency and severity of the water crisis 
as well as the impact on local communities,   while right-leaning outlets focused on the 
logistics, repair process, and technical details. This level of insight is only 
possible thanks to today’s sponsor,   Ground News. Ground News is a website and 
app that aggregates major news stories and   adds context to make reading the news 
easier and more effective. Every story   comes with a quick visual breakdown of the 
political bias, factuality, and ownership   of the sources, all backed by ratings from 
independent news monitoring organizations. One of my favorite features 
is their Blindspot Feed,   which shows you stories mainly covered 
by one side of the political spectrum:   stuff you might totally miss if you only 
follow a few main sources for your news. Obviously, infrastructure is important to me, and 
what I read about in the news shapes the way I   share information with you and the way I look at 
the world. Journalism has a lot of power over us,   and Ground News hands some of that power 
back to you. Reading the news this way   just pulls you back a little bit, helps 
you remember that there are limitations   and biases in all media, and gives you 
the best chance to get all the facts. If you’d like a more transparent media landscape, 
they’re offering a huge discount right now at the   link in the description: 40 percent off the 
Vantage subscription, which includes unlimited   access to all their features. That’s ground 
dot news slash practicalengineering or just   click the link in the description. Thank you 
for watching, and let me know what you think!

---

## 36. The Hidden Engineering of Landfills
**Channel:** Practical Engineering | **Views:** 11.2M | **Date:** 1 year ago | **Duration:** 17:04 | **ID:** HRx_dZawN44
**Link:** https://youtube.com/watch?v=HRx_dZawN44

### Transcript:
This is the Puente Hills Landfill outside of 
Los Angeles, California. The first truckload of   trash was dumped here in 1957, and the trucks 
just kept coming. For more than five decades,   if you threw something away in LA County, there’s 
a good chance it’s buried somewhere inside this   mountain of waste. At its peak, Puente Hills was 
accepting around four million tons of trash every   year, making it one of the largest landfills in 
the country. It closed in 2013, creating a time   capsule of everyday life and consumption patterns 
over a span of 56 years. But Puente Hills is also   a time capsule of landfill engineering itself. 
In 1976, right in the middle of its lifespan,   sweeping federal regulations changed 
how we deal with solid waste forever. You probably don’t think too much about where 
your trash goes, and that’s kind of the whole   point of the solid waste industry: to make sure 
you have the ability to throw something away   without it having a serious negative consequence 
on the environment or public health. There’s a   larger conversation to be had about the amount 
of waste we generate and how much of it can be   recycled or reused, but there is always going 
to be stuff that just doesn’t hold enough value   to be kept. Trash is an inescapable element of 
the human condition. And, I think you’re going   to be surprised how complicated that really is. 
When Puente Hills opened in the 50s, a landfill   was pretty much just a hole in the ground where 
trash was dumped. By the time it closed, landfills   were highly engineered holes where trash gets 
dumped. And I have a scale model of a landfill   in the garage to show you how it all works. 
I’m Grady, and this is Practical Engineering. There are lots of kinds of waste in this crazy 
world, but one of the biggest sources is just   you and me throwing stuff in the trash. The 
technical term is municipal solid waste,   since its collection is usually coordinated 
at the city level. There are a lot of ways   to manage it once collected, but the most 
common by far is disposal in a landfill. And,   one of the biggest parts of landfill 
engineering is just deciding where to   put one in the first place. The main goal of 
a landfill is to maximize the volume of waste   that can be stored there while minimizing 
the cost and the environmental impacts too,   which turns choosing a suitable 
site into a giant geometry problem. Digging a hole sounds like an obvious choice, 
but consider this: digging a hole is expensive,   and not digging a hole is free. There are costs 
of excavating tons and tons of soil just to get   it out of the way so it can be replaced with 
trash and costs of hauling away all that soil   (since your goal is to maximize the volume on the 
site). Plus, you have to avoid the water table,   any unsuitable geology, and the challenges of 
building and working deep below the surface of the   earth. That’s why most landfills mostly build up 
into what sanitation professionals call the “air   space.” Looking upward, it may seem like the sky 
is the limit, but anyone who’s built a tower of   anything, let alone trash, knows better. The waste 
pile gets less stable as its height increases,   requiring shallower slopes. And the pressures 
at the bottom go up too, which can lead to   settlement and damage of facilities. Plus, there 
are visual impacts. The bigger the garbage heap,   the bigger the eyesore, and people are 
only willing to look at a landfill so tall. They can’t be too close to airports, because 
they attract birds that can interfere with   planes. And they can’t be too close to homes, 
parks, playgrounds, and other places people   congregate for obvious reasons. Of course, 
there’s floodplains and wildlife habitat to   avoid as well. And you don’t just need a place 
to put the trash. You also need a scale house   to weigh the trucks coming in and out, a shop and 
storage for the equipment, and sometimes a place   for ordinary citizens to drop stuff off. Finally, 
you need a spot that can handle the huge increase   in truck traffic coming and going, practically 
nonstop. Pretty much, if you can get a college   degree in it, it’s going to come into play when 
siting a landfill: geology, geography, politics,   archaeology, public relations, biology, 
every kind of engineering, and lot more. But once you have your landfill, you can’t 
just start dumping trash.  Let me show you why with a demonstration. And I have some help from my shop assistants. I have my hole dug, and we’ll start   adding some trash. So far, no major problems. 
But eventually, it’s going to rain. And you can’t   immediately see the issue. Granted, this is more 
of a flood than a drizzle, but it gets the point   across. All that water is going to filter through 
the garbage to the bottom of the hole, and,   eventually, into the underlying soil. It might go 
without saying, but I’m going to say it anyway:   We really don’t want garbage juice percolating 
into our soils. Mainly because it can contaminate   sources of groundwater, but also because it can 
migrate well beyond the limits of the landfill,   causing all sorts of environmental troubles. 
So, modern landfills use a bottom liner to   keep waste separate from the underlying soils. 
Often this consists of a thick sheet of plastic,   carefully tested and welded together into an 
impermeable membrane. Even the area between the   plastic welds is tested using air pressure to make 
sure there are no leaks. Another option is thick   clay soil compacted to create a watertight layer. 
In many cases, the two options are combined,   so you end up with this intricate structure of 
different impermeable layers stacked together. Maybe you still see a problem with this 
solution on its own. Now when it rains,   the landfill just fills up with water. This causes 
issues with stability and settlement. It causes   garbage to decompose more quickly, leading to odor 
and temperature problems. Plus, you just can’t   work on top. There’s no way for trucks to unload 
trash on top of a garbage swamp. So we need a   way to get the garbage juice out, without letting 
it flow into the soil below. By the way, garbage   juice isn’t a technical term. It’s actually 
called leachate, so I’ll use that from here on   out. And all modern landfills have sophisticated 
leachate collection systems to keep the waste as   dry as possible and avoid the issues I mentioned. 
Usually, this consists of a system of perforated   pipes covered in a layer of sand, draining to 
sumps, and eventually leading out of the waste. I built a little leachate collection system 
in my model landfill using a small tube   so you can see this in action.  Now my clay bathtub has a drain.   When the rain comes, the water that makes its 
way into the waste is able to flow out of the   landfill, keeping it from becoming a swampy 
mess. This is a little simplified compared to   a real landfill. I’ve made a video all about 
French Drains, which is much closer to what   a leachate collection system consists of if 
you want to learn more after this. Obviously,   in my example, the leachate system 
has to penetrate the bottom liner,   which can be a potential source of leaks. 
So these penetrations are sealed really   carefully in the real world, or the collection 
system just uses pumps and risers that run up   the slope of the landfill to the top, 
so no penetration system is necessary. Of course, now you have a stream of leachate 
you have to deal with. Actually, leachate   management is one of the biggest costs of running 
a facility like this. Some landfills send it off   to a treatment plant that can clean it up. Some 
have ways to treat it on-site with settling ponds,   evaporation, biological treatment, and even 
plants that can consume and convert landfill   leachate into waste that’s easier to dispose 
of (maybe even back into the landfill itself). Finally, the bottom of our landfill has all 
the necessary pieces, but the work doesn’t   stop there. Remember that volume is everything in 
a landfill. For as much effort goes into finding   a location and building the infrastructure, it’s 
essential that we get the most trash in here as   possible. You probably know this, but municipal 
garbage just isn’t that dense. Maybe you’ve had   to smash a few more bags in the can because 
you missed the collection one week. If so,   you know there’s usually a lot of room for 
densification. The trucks that collect garbage   usually have a way to compact it to make more 
room in the box before needing to be emptied.   But once the trash is at the landfill, there’s 
still an opportunity for compaction. Landfills   often use massive roller compactors with 
enormous teeth and giant blades to grade out   and compress waste and get as much as possible 
into the site. It saves money, and it’s good   stewardship of the space. But density isn’t 
the only challenge with day-to-day operations. Despite what you’ve heard, landfills are 
kind of gross. I mean, that’s their whole   point is to accept the stuff we don’t want to 
put anywhere else. But putting it all in one   place creates a lot of problems: pests, 
odors, windblown waste, fires, birds,   and more. So to mitigate some of that, most 
places require that the garbage be covered up   at the end of every day. This “daily cover” 
can take a lot of forms.  The basic approach is just to put a layer of soil over the top 
of the working face at the end of the day. When I do this in my model, you get a sense of 
the problem.   All that clean daily cover is taking up precious space 
in the landfill. One option is to trim   it back off each morning before trucks start 
arriving, but that’s a sisyphean task of just   moving tons and tons of soil around each day. 
Other alternatives for daily cover are tarps,   or just holding back certain types of waste 
that are more inert like foundry sand, foam,   paper, and shredded tires. They’re going in 
anyway, so you might as well use them on top   to cover the more disagreeable stuff overnight. 
Those alternatives can also help avoid leachate   getting perched within the waste, encouraging it 
to continue downward to the collection system. Ideally, a landfill will last for decades, 
slowly filling up by packing as much waste   as possible. Throughout the course of operating a 
landfill, there’s constant testing of groundwater,   surface water, leachate, air quality and more 
to make sure they’re not exceeding limits.   Landfills are usually built in smaller cells 
so you don’t have to manage this huge area of   waste all at once. A cell fills up, you put 
soil over the top (called interim cover),   and start a new one within the landfill. But 
eventually, you reach the top of the airspace,   and the landfill reaches the end of its useful 
life. And closing a landfill is not an easy job.   Of course, you have to cover all that waste 
up, creating a mountainous sealed tomb of   garbage. That final cover has to keep water 
out, to reduce the volume of leachate you’re   having to collect and treat over time. 
But it also has to keep the garbage in,   and not just the garbage itself, but anything 
else that comes with it like smells and leachate   and pests. And it has to do it basically forever. 
So, just like the bottom liner, the final cover   over a landfill is usually a system of multiple 
layers, including compacted soil, membranes,   and fabrics. And then you have to get the grass to 
grow, to protect the soil from erosion and damage   over time. I don’t have time to wait for grass 
to grow in my demo, so I’m cheating a little bit. But the fun isn’t quite over yet. The waste may 
be sealed up, but that doesn’t mean it’s inert.   In fact, there’s a lot of chemistry and biology 
happening inside a landfill, and a lot of those   reactions generate gases like methane and hydrogen 
sulfide that can create pressure, heat, smells,   greenhouse effects in the atmosphere, and the 
potential for explosions. So, one of the steps   in landfill closure is to install wells that 
can collect the gases from the waste. Usually,   these consist of vertical pipes connected to a 
blower that constantly draws air to a collection   point. There’s a lot that goes into these 
systems too. You can’t pull too hard, or you   might draw oxygen into the landfill, changing 
the reactions and microbiological processes,   and creating a potential for a fire within the 
waste. Plus the gas includes a lot of humidity,   so managing condensation creates another 
liquid stream that has to be collected   and treated. Once it’s collected, 
the landfill gas can be flared,   combusting it into less environmentally 
harmful constituents. Another option is   to put it to beneficial use to create heat or 
even electricity. The Puente Hills landfill   I showed earlier has a gas-to-energy facility 
that’s been running since 1987, and even though   the landfill is now closed, it currently provides 
enough electricity to power around 70,000 homes. Once a landfill is closed, there’s not a lot you 
can do with it after that. It’s a big, sealed up,   mountain of trash, after all. Owners are generally 
required to look after a closed landfill for   at least 30 years afterwards, inspecting 
for leaks, monitoring the air and water,   and repairing any damage. Those costs have 
to be built into the rates they charge,   since there’s not a lot of benefit (or revenue) 
after closure. But, with all that open space and   carefully-maintained landscaping, one option that 
many landfill operators are trying out is parks.   And I love this idea. They say, “We’re willing 
to put our money where our mouth is and invite   the public to spend time here, to enjoy this 
place that used to be, you know, one of the   least enjoyable places you can imagine.” Puente 
Hills in California has big plans, including   trails on the slopes, biking, slides, gardens 
and more. It looks like it will be a really nice   place to visit when it’s done. And it also puts 
the whole concept of landfills in perspective. Of course, we have a lot of room for 
improvement in how we think about and   manage solid waste in this world. Landfills 
seem like an environmental blight, but really,   properly designed ones play a huge role in making 
sure waste products don’t end up in our soil or   air or water. It’s not possible to landfill waste 
everywhere. Many places are too densely populated   or just don’t have enough space. But where they 
are, the environmental impacts are relatively   small. Just consider the resources that go 
into them. I pay about 20 dollars a month,   probably a little on the low end of the national 
average, and that buys me 64 gallons (about a   quarter of a cubic meter) of space in a municipal 
landfill per week. Of course, I don’t fill the   can every week, and that trash gets compacted. 
But still, do that for a decade, and your 20   bucks a month has paid for the volume of a modest 
apartment. It’s covered the cost of building the   lining and collection systems, the environmental 
monitoring, the daily operations, the closure,   the gas collection, and the maintenance for 
at least three decades afterwards and for your   trash to stay there effectively forever. It’s 
(almost) free real estate, not that you’d want   to live there. But my point is: landfills are 
a surprisingly low-impact way to manage solid   waste in a lot of cases. I hope the future is 
a utopia where all the stuff we make maintains   its beneficial value forever, but for now, I am 
thankful for the sanitary engineers and the other   professions involved in safely and economically 
dealing with our trash so we don’t have to. I could spend hours talking about the engineering 
that goes into landfills. There are so many   practical challenges that you just really don’t 
face anywhere else in engineering. And it’s kind   of a small club of people who work on them and 
know a lot about them. I love that kind of stuff,   and I have to assume you probably do too, 
which is why I want to recommend another   video series that I think you’ll find really 
interesting: The Logistics of X. This was   produced by my friend Sam from the Wendover 
Productions channel. It’s a series that takes   a peek behind the curtain of stuff that we kind 
of take for granted. This episode on coal mining   is so good. It covers all the things I would 
naturally wonder about: the heavy equipment,   surface and underground methods, processing, 
transportation, and the major shifts happening   in the industry. The graphics they use  remind me of the old History and Discovery   Network shows I used to love. And if you want to 
check it out, it’s available to watch on Nebula. You’ve probably heard of Nebula. It’s a streaming 
service built by and for independent creators. I   don’t know about you, but that’s most of 
what I watch these days. I just like the   authenticity and thoughtfulness of videos 
that haven’t been through a writers room   and ten levels of studio executives. Someone 
said Nebula’s like Netflix for people who love   trains. And I like that comparison, 
not just because I also love trains. Nebula’s totally ad-free, with tons 
of excellent channels and lots of   original series and specials like the 
Logistics of X. It’s also a great gift,   especially because a yearly membership 
is 40% of the link in the description.   My videos go live on Nebula before they come out 
on YouTube. If you’re with me that independent   creators are the future of great video, I 
hope you’ll consider subscribing. That’s   go.nebula.tv/Practical-Engineering. Thank you 
for watching, and let me know what you think!

---

## 37. Why Are Texas Interchanges So Tall?
**Channel:** Practical Engineering | **Views:** 2.5M | **Date:** 1 year ago | **Duration:** 13:18 | **ID:** -16RFXr44fY
**Link:** https://youtube.com/watch?v=-16RFXr44fY

### Transcript:
This is the Dallas High Five, one of 
the tallest highway interchanges in the   world. It gets its name from the fact that 
there are five different levels of roadways   crossing each other in this one spot. 
In some ways, it’s kind of atrocious,   right? It’s this enormous area of land dedicated 
to a complex spaghetti of concrete and steel;   like the worst symbol of our car-obsessed 
culture. But in another way, it really is   an impressive feat of engineering. 37 bridges 
and more than 700 columns are crammed into this   one spot to keep the roughly half a million 
vehicles flowing in every direction each day. They say everything’s bigger in Texas, but 
that’s not always true when it comes to   engineering projects in the US. The tallest 
concrete dam is split between Arizona and   Nevada. The longest bridge span is in New 
York. The longest road tunnel is in Alaska,   and the longest water tunnel, not 
only in the US but the whole world,   is the Delaware Aqueduct in New York. The 
largest hydroelectric plant is the Grand   Coulee Dam in Washington, while the 
largest nuclear plant is in Georgia. But one thing that Texas really does do bigger 
is highway interchanges. If you’ve driven from   one major Texan highway onto or over another, 
you may have been astonished to find yourself   and your vehicle well over a hundred feet or 30 
meters above the ground. There’s no clearinghouse   of data for flyover ramp heights, as far as I can 
find. Plus there’s the complexity of what a true   height really means since many interchanges use 
excavation below grade for the lower level. Still,   even the most conservative estimate puts 
the High Five taller than the Statue of   Liberty from her feet to the top of her 
head. And if you do a little digging,   you’ll find that many, if not most, of the tallest 
highway interchanges in the world are right here   in the Lone Star State. Let’s talk about why. 
I’m Grady, and this is Practical Engineering. The idea of a freeway really started in the 
1920s with what’s now the Autostrada A8 in Italy:   an automobile-only road with controlled 
access. Freeways are separated from local   roads with limited ways to get on and off. And 
if you’ve driven a vehicle in the past century,   the idea of a controlled-access freeway is 
pretty much taken for granted. Smooth curves   and limited chances to enter or exit mean more 
speed and more capacity. But eventually, those   big roads intersect other roads (sometimes other 
big roads) and that creates an obvious challenge. Unlike most roads that cross at the same level 
on the ground, or as engineers say, “at grade,”   freeways use grade separation at intersections. 
Roads go over or under one another. No traffic   signals, stopping, or interruptions. Again, this 
is nothing groundbreaking. But what if you want to   turn from one road onto the other? Just like that, 
we’ve gone from an intersection to an interchange.   And this is where things get a lot more 
complicated. But we have to build up to it. The diamond interchange is probably the simplest 
way to get grade separation because it kind of   half doesn’t. Through traffic on the freeway 
flows right by, in most cases without any   need to slow down. But that’s not true at the 
crossroad. Ramps enter and leave the highway   at gentle angles and meet the crossroad 
nearly at right angles. Viewed from above,   the ramps form a rough diamond shape, giving 
the interchange its name. The intersections   of the ramps and the crossroad are just that: 
intersections. They are usually controlled by stop   signs or traffic signals. Diamond interchanges 
can often get away with having just one bridge,   a relatively small one carrying the crossroad 
over the highway. So, this can be the cheapest   and easiest to build type of interchange to build. 
But, those intersections create limitations on   how much traffic it can handle, so it’s really 
only used when the cross road is a minor one. This kind of interchange is sometimes called 
a service interchange, in contrast to a system   interchange, where two controlled access 
highways cross. As traffic increases,   the only way to increase capacity is to 
eliminate at-grade intersections. So,   the largest interchanges implement 
grade separation for every lane.   The classic system interchange is the 
cloverleaf. Four ramps form a diamond,   usually for the right-hand turns. These are 
directional ramps, that is, they curve toward   the ultimate direction a traveler is trying to go. 
You exit right and end up driving to the right.   The OTHER four ramps give the cloverleaf its name. 
The loop ramps, usually used for left-hand turns,   curve around while ascending or descending 
so they can cross over themselves. So,   you can get traffic flowing in any direction with 
no at-grade intersections and just one bridge. The loop ramps make the whole thing 
look like a four-leafed clover,   but finding yourself on this type of interchange 
doesn’t usually feel very lucky. For one,   the loops are often pretty tight, requiring 
motorists to slow way down. And for two,   there’s the weave. Consider traffic entering 
the highway from one of the loops. In the same   place vehicles are trying to get back up to 
speed and merge left onto the freeway, drivers   trying to exit the highway are slowing down and 
moving right. This inevitably creates traffic as   people struggle to merge and cross paths with one 
another. Along with suboptimal traffic conditions,   cloverleaf interchanges eat up a lot of of land. 
When cloverleafs were at their height   of popularity in the mid-20th century, land 
was plentiful, and there were fewer cars,   but as the volume of traffic increased AND the 
cost of land went up, engineers had to come up   with new solutions to build better grade-separated 
highway crossings. And so they did. Now, there’s such a huge variety of freeway 
interchange designs that it would be impossible   to cover them all. The turbine, the windmill, the 
braided interchange, the ITL, mixes of various   designs, and more. Each of these balances the 
constraints of a project like this in a different   way: land requirements, cost, capacity, safety, 
et cetera. And the design that generally provides   the most capacity, on the smallest footprint, 
(often for the highest cost), is the stack. Like the cloverleaf, a stack has the four 
directional ramps, usually for the right-hand   turns. But we move the exit for the left-hand turn 
off the main highway to avoid the weaving problem,   and fly them over the middle of the intersection 
where they meet up with the opposite directional   ramp. These ramps are often called flyovers, 
and it’s easy to see why. The gentle curves and   elevation changes of the stack mean that drivers 
can safely maintain speed whether they’re going   straight through the interchange or changing 
direction. The curved ramps often bank to the   inside of the curve, called superelevation, making 
it even easier to maintain speed through the turn.   This conventional configuration is called 
a four-level stack. There’s one level for   the freeway, another for the crossing freeway to 
pass over, and two levels for the flyovers. It’s   bridges on bridges, each one providing enough 
clearance underneath for large trucks. So these   upper ramps end up pretty high off the ground. 
Four-level stacks are actually fairly ubiquitous   in the US these days. These are impressive 
structures in their own right, but this is where   Texas takes it to another level, literally. And 
it mostly has to do with feeder or frontage roads. Lots of highways use frontage roads running 
parallel to connect areas alongside that would   otherwise be cut off from the roadway network. 
They allow businesses to develop right up to and   facing the freeway with easy access to those 
coming on and off it, basically keeping areas   attached to the roadway network. Texas took the 
idea and ran with it. Apparently, they started   as a way to reduce the cost of acquiring land for 
road projects. If you could promise the landowner   access to a new highway along a frontage road, 
you're making their property more valuable, so   they’re willing to sell a portion for the highway 
at a much lower cost. Now, Texas has over 6,400   miles (or 10,300 kilometers) of frontage roads. 
That’s almost the circumference of the moon,   and as far as I can tell, way more than any other 
state in the US. I won’t go into the pros and   cons of this approach here. Some research has 
shown pretty conclusively that the money saved   on acquisition costs doesn’t make up for their 
many disadvantages. And Texas has since changed   its policy to only include frontage roads on new 
freeways where necessary and justified. Although,   from what I can tell seeing new construction these 
days, there don’t seem to be many projects where   they’ve been left out. And one major effect of 
putting frontage roads alongside every highway   happens at interchanges. Because these are more 
roads that need grade separation from all the   others. So, at stack interchanges around the 
state, there aren’t just four levels but five. In fact, this kind of interchange is often 
referred to as the Texas stack because it's   so popular here. In a typical configuration, 
one freeway goes below grade at the bottom   level. The frontage roads sit at grade. The 
crossing freeway is elevated. Then there   are the two layers of flyovers. With a minimum 
vertical clearance of 16 feet or about 5 meters,   plus the thickness of each bridge, vehicles 
on the highest flyovers are often more than   a hundred feet or 30 meters above the 
ground. It’s a nice way to get a good   look at the city, even if you only 
get to enjoy the view for a moment. The Dallas High Five is probably the most famous 
interchange in Texas with its cool nickname,   but it doesn’t stand alone. There are quite a 
few five-level stacks around the state and even   a couple that qualify as six-level stacks with 
flyovers connecting to other highways. My friend   Brian, better known as the Texas Highway Man, 
documents a lot of new construction in Texas,   including this replacement of an old cloverleaf 
crossing with a five-level stack in San Antonio.   These flyovers will be higher than a twelve-story 
building when they’re done. The frontage roads for   this new interchange use a pretty innovative 
concept. Four partial roundabouts morph into   one funny-shaped roundabout that’s been 
lovingly nicknamed the “fidget spinner.” Of course, Texas stacks don’t exist only in the 
Lone Star State. The Big I is another famous   interchange in Albuquerque decorated with 
a tumbleweed snowman each winter. The Judge   Harry Pregerson Interchange in Los Angeles 
gets its fifth level not for frontage roads   but the high occupancy lane. Plus, it has a 
railroad at the lowest level, which I always   appreciate. Not just because I like trains, 
but also because it’s a reminder that these   artfully sculpted ribbons of concrete carefully 
woven together represent a tremendous investment   of public money, our money, into a way 
of getting people from A to B that has   a lot of downsides. Everyone has different 
thoughts about what a city should look like,   but there’s a growing recognition that the way 
we prioritize motor vehicle traffic in the US   may not have been the best path forward. 
And so, I admit that my ideal city has a   lot fewer of these towering interchanges that 
kind of stand as a testament to a transportation   network that doesn’t necessarily reflect 
our highest values and aspirations. But,   I still find them pretty impressive in their own 
right, and whenever I’m in a new city, I try to   plan my driving to hit those tallest ramps at the 
top of the stack to get a bigger, if momentary,   perspective on the built environment. It’s 
always a nice reminder of our capacity for   grand designs and ambitious projects, even if 
they might not always be the best solutions. Some of the most interesting interchanges I’ve 
ever seen were in Beijing, China. I visited   my now wife there when she was working as a 
teacher, and I loved seeing how different all   their infrastructure is. But planning that trip 
was an enormous challenge. China blocks a lot   of US websites, including some of the services we 
used to stay in touch. We used VPNs to get around   the censorship, but back then, but they were 
unreliable, slow, and expensive. So when I first   tried out Nord VPN, today’s sponsor, I really was 
blown away by how far the technology has come. I don’t travel internationally very often, 
but, in a small way, I owe my marriage to VPNs,   and I still find a lot of uses for them. Some 
internet service providers can collect your   data and sell it or adjust the speed of your 
connection based on what you’re doing online.   You can also be charged higher prices or blocked 
entirely from some sites and services depending on   your location. NordVPN helps me avoid all that. I 
mostly prefer an internet where the websites don’t   know anything about me. And a Nord subscription 
gives you more than just the VPN. They monitor   the web and notify you if your credentials show 
up in hacks or leaks. They provide a dedicated IP   address. All of it works on all major operating 
systems for phones, tablets, and computers. And,   they have a 30-day money back guarantee if you 
decide it’s not a good fit. That makes it easy   to give it a try. And what makes it easier is the 
deal they’re offering right now. Sign up for a   two-year plan at the link in the description, 
and you’ll get four additional months totally   free. That link is in the description. Thank you 
for watching, and let me know what you think!

---

## 38. How French Drains Work
**Channel:** Practical Engineering | **Views:** 3.9M | **Date:** 1 year ago | **Duration:** 16:41 | **ID:** aFZM_BY6jBw
**Link:** https://youtube.com/watch?v=aFZM_BY6jBw

### Transcript:
In February of 2017, one of the 
largest spillways in the world,   the one at Oroville Dam in northern California, 
was severely damaged during releases from heavy   rain. You might remember this. I made a 
video about it, and then another one about   the impressive feat of rebuilding the structure. 
In the forensic report following the incident,   one of the contributing causes identified in 
the failure was the drainage system below the   spillway. Rather than being installed below 
the concrete, each drain protruded into it,   reducing the thickness of the concrete and making 
it more prone to cracking. But why do you need   drains below a spillway in the first place? Put 
simply: water doesn’t just flow on the surface   of earth. It also flows through the soil and rock 
below it. Water that gets underneath a structure   creates pressure that can lift and move it. That’s 
especially true when the water is flowing. Dam   Engineers deal with the challenge in two ways: 
make concrete structures like spillways massive   (so gravity holds them in place) and use drains to 
relieve that pressure, giving the water a way out. Even though we depend on it to live, water is 
the enemy of all kinds of structures. Pressure   is far from the only problem it causes. Most 
of us have come face to face with it in some   way or other. Water causes some soils to expand 
and contract. It freezes, promotes rot, erodes,   and corrodes, wreaking all kinds of havoc 
on the things we build. On the surface,   water is relatively easy to manage through 
channels and curbs and slopes. Below the ground,   things get much more challenging.  Subsurface 
drainage is a really interesting challenge, and   it applies to everything from simple landscaping 
at your house to the biggest structures on Earth,   and there are a lot of things that can go wrong 
if they’re not designed correctly. I’m Grady,   and this is Practical Engineering. 
Today, we’re talking about French Drains. The idea of a subsurface drain is really 
pretty simple. And I built a model here in   the garage to show you how they work. This is 
just an acrylic box with a hole at the bottom.   I filled the box with sand to simulate soil. 
And I left a small area of gravel in front of   the hole. A few strategically-placed dye tablets 
will help with the visualization. When I turn on   the rainfall simulator, watch what happens. Water 
percolating into the subsurface continues flowing   within the sand. It moves toward the gravel, 
eventually flowing into the holes between the   stones and out of the model. (Don’t pay attention 
to those dye traces on the left. Turns out there   was a small leak in the box that was acting 
as a… secondary outlet to my drain). When the   rain is over, the subsurface water continues 
to flow until the soil is mostly dries out. This is a very simple model of what’s often 
referred to as a French drain. It’s not from   France but named after an American farmer, 
lawyer, politician, and inventor Henry French   whose 1846 book on Farm Drainage cataloged 
and described many of the practices being   used around the world. Funny enough, he was 
explicit that he didn’t invent these drains,   claiming “no great praise of originality in 
what is here offered to the public.” Still,   I have to admit, after reading his book, 
I understand why he became the namesake   of the drains he made famous. 
The man had a way with words: “The art of removing superfluous water from land 
must be as ancient as the art of cultivation;   and from the time when Noah and his family 
anxiously watched the subsiding of the   waters into their appropriate channels 
to the present, men must have felt the   ill effects of too much water, and adopted 
means, more or less effective, to remove it.” Well before we worried about draining subsurface 
water to protect buildings and structures,   farmers were doing it in one way or another 
to keep their fields from sogginess that   affects the growth of crops and bogs 
down agricultural equipment. In fact,   “tile drain” is another common term for 
subsurface drains because clay tiles were   used to hold the drains open. And there 
are plenty of fields still drained using   clay tiles today. But French pointed out 
that rocks sometimes work just as well: “Providence has so liberally supplied the 
greater part of New England with stones,   that it seems to the most inexperienced 
person to be a work of supererogation,   almost, to manufacture tiles or any 
other draining material for our farms.” He was mostly right, and gravel-filled trenches 
are used all over the place for simple and   non-critical applications. The problem with rocks 
is that they clog up. You can kind of see how sand   migrated into the spaces between the gravel in my 
demo. Since it’s sand, it’s not really a problem,   but if this were a finer-grained soil, it 
would eventually reduce the drain’s ability   to transport water, slowing down the drainage 
process. Tiles provided the benefit of holding   open a clear space for water to flow. Over time, 
perforated or slotted pipes began to replace tiles   for use in drains. You’ve probably seen these 
before; there are a hundred different styles and   materials. Rather than flowing in through the 
joints between the tiles, the water just comes   into the holes in the pipe. But which way should 
the holes face? Turns out it’s a debate as old as   pipes themselves among engineers and contractors, 
and there are strong opinions on both sides. If the holes are on the top, water has to fill the 
gravel to the top of the pipe before it can get   in and be carried away. If the holes are on the 
bottom, the flow path isn’t smooth, so the water   flows slower and is less likely to wash away any 
soil or debris that gets inside. From my research,   it seems like most of the manufacturers recommend 
holes down so the gravel envelope doesn’t have to   be completely saturated before water can enter the 
pipe. I think, in practice, it’s really not too   important, and actually, a lot of perforated pipes 
you can buy for drainage have holes all the way   around so you don’t even have to think about it. 
That’s the best kind of decision, in my book. But,   if it seems counterintuitive to you to orient the 
holes downward, I can demonstrate it in my model. With a pipe in the middle of the gravel layer, 
I can turn on the rain again.  Just like before, water makes its way through the soil toward 
the drain, and eventually out of the model.   Let’s watch that sped up. When the rain is 
off, the soil continues draining out until   it’s no longer saturated. Hopefully it’s clear how 
beneficial this is. Without that drain, water will   eventually dry out of the soil by flowing away or 
evaporating over time. But getting it out quickly,   with a drain, gives it less opportunity to 
apply pressure to basement walls, freeze   against a structure creating long-term movement, 
swell the soils, or cause rot and corrosion. I’m using sand in my model to speed up these 
simulations, so this envelope of small gravel   with a pipe inside is working pretty well to keep 
the soil in place. But, somewhat inconveniently,   most places we want to drain aren’t overlain by 
playground sand. They have finer-grained soils,   including silt and clay. These small 
stones are holding back the sand,   but tinier particles would just flow right through 
the cracks. That can lead to erosion over time as   water dislodges and carries soil particles away 
through the drain. Watch what happens when I try   my French Drain model with large stones between 
the sand and the outlet.  You can see the turbid   water coming through the drain, indicating that 
soil particles are making their way out. And if   you watch closely on the right side, you can see 
where they’re coming from. Eventually, enough sand   washes through the rocks to create a sinkhole, 
and the rest of the water bursts through.   Made a HECK of a mess (pardon my French drain).   I’ve talked about internal erosion and sinkholes in   a previous video, so check that one out if you 
want more details. This erosion can also result   in clogging if the soil particles move into the 
gravel and pipe. In fact, clogging is the biggest   problem with subsurface drains, so properly 
designed ones usually have some kind of filter. The design you’re probably most familiar with if 
you’ve seen or installed a french drain yourself   uses geotextile fabric. These are permeable 
sheets that have a wide variety of applications:   separating different layers of soil 
or rock, protecting against erosion,   adding reinforcement to backfill, and filtering 
soil particles out of flowing water. A typical   french drain design uses geotextile fabric 
around the gravel envelope to keep the fines   from migrating in. It’s sometimes known as 
a pipe-within-a-pipe. But geotextile has   some limitations. It’s easy to damage during 
installation. It’s pretty much impossible to   repair or replace once it’s in place. And it also 
gets clogged up. It’s just a thin mesh of fibers,   after all, so once soil particles get stuck, they 
can quickly lead to a decrease in permeability   and efficiency. But there is another option for 
filtration, and it’s most commonly used on dams. It is hard to overstate the importance of properly 
filtered drains for dams. If you don’t believe me,   take it from the Federal Emergency 
Management Agency in their 360-page report,   Filters for Embankment Dams: Best Practices for 
Design and Construction. If that’s not enough,   try the Bureau of Reclamation in their 400-page 
report, Drainage for Dams and Associated   Structures. A civil engineer could spend an entire 
career just thinking about subsurface drains,   and for good reason. Lots of high-profile 
dam failures have directly resulted from   a lack of drains or ones that weren’t designed 
well, including the Oroville Spillway incident I mentioned.   For embankment dams that are built 
from compacted soil, any movement of those soil   particles can spell demise. And if you think 
about all the ways that water is terrible for   structures, you can imagine how hard it is 
to design a structure whose literal job is   to hold it back. That’s why they use filters 
of a different design. You can see it in bold   right here in this FEMA status report: “It’s the 
policy of the National Dam Safety Review Board   that geotextiles should not be used in locations 
that are critical to the safety of the dam.” Instead, they use sand.  Just like the gravel 
in my demonstration lets the water through   while holding back the sand particles, sand can 
hold back smaller particles of silt and clay,   acting as a filter. But it’s a little more 
complicated than that. Every soil consists   of a variety of sizes of particles. I can 
show that pretty easily, again using sand as   an example. I have a collection of sieves with 
different sizes of holes, each one finer than   the one above. I put my sand in at the top. Then 
give it a little shake.   (a little razzle-dazzle) And when I open it back up, the sand is all sorted 
out.  If you weigh out the fraction that got caught   in each sieve and plot that on a graph, you get 
something like this: a grain size distribution   curve, also called the soil’s gradation. Soils can 
have a wide variety of gradations. And it’s super   important to understand in this case, because 
before you can design a filter, you have to know   what you’re trying to filter out. Once you know 
the base soil’s grain size distribution, there are   a number of engineering methods to find a material 
that will both allow water to flow while still   holding the soil back. And in a lot of cases, 
that just happens to end up being some variation   on the sand we’re used to using in concrete and 
sandboxes and demonstrations about french drains. Actually, for dams, you often can get either the 
filtration you need or the capacity to let water   through, but not both in the same material. 
So lots of dams use two-stage filters. The   first stage filters the base soil material. 
The second stage filters the first stage,   but lets water flow more freely. And then, 
you put a perforated pipe in the middle to   get the water out of the drain as quickly as 
possible. So they look basically identical   to the demonstration I built: 
sand, then gravel, then pipe. As for dealing with the water once it’s out 
of the ground, there are really just two   options. The easiest is to simply release it 
by gravity to the surface at some low point.   But if you don’t have a low point on the 
surface nearby, the other alternative is   to pump it. If you have a basement at your 
house, there’s a good chance you have a sump,   which is just a low spot for drainage to 
collect, and if you have a sump, it’s a   REALLY GOOD idea to have a sump pump, to move 
that water out and somewhere outside your house. Of course, there’s a lot more to this. Dams have 
all kinds of drainage features depending on their   design. Concrete dams often include a gallery or 
tunnel with vertical drains into the foundation.   Embankment dams often feature a large internal 
drain called a chimney filter to keep water   moving through cracks or pores from carrying soil 
along with it. And it’s not just dams. Plenty of   structures, like retaining walls, rely on good 
subsurface drainage for protection against all   the bad things that water does, not to mention 
their widespread use in agriculture. There are   lots of interesting designs and maybe even more 
proprietary products on the market all trying   to accomplish those two main tasks: get the water 
out without getting the soil out too. In the end,   it’s all the same engineering whether you’re 
trying to protect a multi-million dollar   structure or just keep your basement 
dry. I think Mr. French put it best: “Indeed, the importance of 
this subject of drainage,   seems all at once to have found universal 
acknowledgement throughout our country,   not only from agriculturists, but from 
philosophers and men of general science.” I don’t think anyone could reasonably call 
me a philosopher, but I do love drains,   and I hope you agree that, from dams to fields to 
foundations of houses, they are pretty important. French drains are one of those topics 
that be hard to sell in a pitch meeting,   right? No studio executive would be like, “Yes, 
this is a million dollar idea!” But the thing I   love about this channel is that it’s created a 
passionate community around seemingly mundane   things like subsurface drains. TV used to 
be like that too: something for everyone.   I loved the old History and Discovery 
channel shows. Now it’s all converged   into reality shows and reruns, and I’ve found 
that pretty much everything I watch these   days is done by passionate independent 
producers. If you feel the same way,   I have a recommendation for you: The Getaway 
by my friend Sam at Wendover Productions. It’s a gameshow with a hilarious premise, 
which is that all of the contestants (who   are all big YouTubers, by the way) are snitches, 
but each one thinks they’re the only one. And it   just leads to all these very funny situations 
where everyone is trying to secretly sabotage   the contests. Plus the behind-the-scene 
cuts to the producers trying to keep all   the confusion under control are wonderful. 
It’s such a great twist on a game show,   and it’s one of those creative experiments that 
only works because it’s independently produced.   The chaos of it is what makes it great, and 
that’s why it’s only available on Nebula. I talk about Nebula a lot. It’s a streaming 
service built by and for independent creators,   and it’s growing super fast. After the major 
overhaul of the home page, making it easier to   find new stuff to love, we’ve leaned into 
producing really good original content,   like The Getaway; basically allowing your 
favorite creators to make bigger budget videos   without the fear of having it flop on YouTube’s 
algorithm. That means you get more creative,   interesting, and thoughtful videos. My videos 
go live on Nebula before they come out here,   and right now, a subscription is 40% 
off at the link in the description. Plus if you already have a subscription, now 
you gift one to a friend. We have annual gift   cards now. Give someone you love a 
year’s worth of thoughtful videos,   podcasts, and classes from their favorite 
creators. It’s 40 percent off either way at   nebula.tv/practicalengineering for yourself 
or gift.nebula.tv/practical-engineering for   a friend. Thank you for watching, 
and let me know what you think!

---

## 39. When Natural Gas Had No Smell
**Channel:** Practical Engineering | **Views:** 968K | **Date:** 1 year ago | **Duration:** 16:27 | **ID:** pR486zloao0
**Link:** https://youtube.com/watch?v=pR486zloao0

### Transcript:
Excitement and hope permeated the crowds gathered 
in a dusty farm carved from the piney woods in   east Texas. The rumor was that Columbus Joiner had 
struck oil. At 70 years old, Joiner had already   won and lost several fortunes in the oil business, 
but it seemed like, on that October afternoon in   1930, he might just have one more in him. As the 
congregation grew, Joiner and his crew slowly   swabbed the water and mud up and out of the well, 
relieving the pressure at the bottom. Eventually,   the ramshackle derrick began to rumble and shake. 
Suddenly, the Daisy Bradford No. 3 erupted,   showering black oil on the cheering crowd. It was the “discovery” well for what would quickly   become the largest and most prolific oil field 
in the continental United States at the time.   Joiner would lose that fortune too, but the boom 
he kicked off would change the state forever. The sudden inrush of oil workers and 
their families inundated the area,   including the unincorporated town of New 
London. New families needed a new school,   so one was built in 1932. But no one could 
have imagined that what created the town in   the first place would ultimately rob it of 
a generation only a few years later in one   of the worst school disasters in US history. 
I’m Grady, and this is Practical Engineering. With all of the extra population and tax revenue 
pouring in, New London quickly became one of the   wealthiest rural school districts in America, and 
its new school was correspondingly designed. The   building sat on a gentle slope with a footprint 
shaped like a large capital letter E. Both the   north and south wings projected out from the 
hillside, creating space for classrooms below   the main floor. But the main part of the school 
had a mostly unused crawlspace below its first   level. This crawlspace had just two doors into the 
basement wings and four small vents to the outside   for circulation. The school was originally 
designed to be heated by a large central boiler,   but the school board changed the plan 
during construction to install cheaper,   individual gas-fired radiators throughout the 
building. Gas was supplied by a local utility   company for the following years until 
an opportunity arose in January 1937. The Parade Gasoline Company had constructed a 
condensate extraction plant not far from the   school. Natural gas is an incredibly important 
resource today, but at the time, it was mostly   considered a byproduct of oil drilling. The supply 
was just so much higher than the demand because   gas was difficult to transport at large scales. 
Networks of long-distance natural gas pipelines   wouldn’t arrive until after World War II. But 
it was possible to extract liquids from raw   natural gas by cooling the vapor. The resulting 
condensate (often known as “drip gas”) had many   uses and could even be used as a low-quality 
substitute for gasoline in older engines. Parade’s plant was a simple operation. It accepted 
raw natural gas from nearby wells, extracted the   condensates, and then sent the “residue” gas 
back to the oil fields in another pipeline,   where it was mostly burned off in flares. 
Since it was already a kind of garbage gas,   it was common practice at the time for homes, 
businesses, and public institutions within easy   reach of the residue pipe to tap a line without 
explicit permission to get the free gas. Since   the company was already getting rid of it, 
they were usually happy to look the other way. This might seem like an outrageous and dangerous 
practice today, but it’s not hard to become   accustomed to risk, especially when lots of people 
are doing the same thing and the benefit is so   immediate and obvious. In New London, the school 
board saw an easy opportunity to save about $250   per month on their heating bill (several thousand 
dollars in today’s money). In January of 1937, the   connection was made by two bus drivers, a janitor, 
and a local welder. A radiator salesman inspected   the new line. They installed a regulator to reduce 
the sometimes erratic pressure from the residue   pipe. From there, the gas would flow into the 
school building’s crawlspace along a 2-inch line   suspended by straps. 96 individual connections 
tied the main gas line to the heaters and burners   throughout the school. But the district would 
never get to see the savings of the supply switch. On Thursday, March 18, 1937, near the end of 
the day, the school was full of students and   teachers eager to be let out for a long weekend. 
In the basement wood shop, near the crawlspace,   a teacher powered on an electric sander, 
flipping a rudimentary knife switch to   complete the circuit. Unbeknownst to the shop 
teacher and everybody else in the building,   the crawlspace had filled with an explosive 
mixture of residue gas and air. The spark from   the knife switch was all it took to ignite 
the gas and set off a terrible explosion. Except for the two doors and four small vents, 
the crawlspace was practically a sealed chamber of   concrete. With nowhere to escape, the pressure of 
combustion lifted the first floor of the building   upward, buckling the walls, and then collapsing 
the roof into the school. A large chunk of a   concrete slab was blown over 200 feet from the 
building, crushing a car in the nearby parking   lot. There were over 500 students, faculty and 
staff in the building at the time. Chaos ensued   as many parents, who had been at the PTA meeting 
at an adjacent building, reacted to the thunderous   sound and ran to the scene. Soon, the school was 
overwhelmed by residents, oil field workers, and   emergency personnel, all doing whatever they could 
to rescue victims within the collapsed building. The Texas Inspection Bureau report 
described the effort involved: The story broke across the US, and was reported on 
by journalists from across the country, including   a very young Walter Cronkite, working for the 
United Press in Dallas at the time. Later in life,   he recounted:  Mother Frances Hospital had just 
finished construction in Tyler,   about 25 miles east of New London. An all-day 
ceremony, including a ribbon cutting and banquet,   had been planned for Friday, March 19. 
But, when the staff received word of   the explosion that Thursday afternoon they 
decided to open the hospital early. Medical   facilities in the surrounding area were 
overwhelmed with victims, but also with   donations and offers to help. In the end, the 
explosion killed 270 students and 24 adults. The governor of Texas declared martial law in 
New London and appointed a team of officials   to form a military court of inquiry, and 
investigators from the state and federal   governments got involved as well. Their first 
job was to rule out potential causes of the   explosion. There were rumors that the blast was 
a result of dynamite. Apparently, workers had   been using it to construct a running track at the 
nearby athletic field. Eighteen sticks of dynamite   were stored below the auditorium on the day of the 
explosion, but they were found intact afterward. Investigators were confident that gas caused 
the explosion but were not yet sure of its   source. They tested the school’s sewer system 
for combustible gases but found none. They also   drilled more than 70 holes into the soil below 
and around the school to determine whether gases   were seeping up from the ground. Their detectors 
found no meaningful traces of hydrocarbons. The   only possible source was also the most obvious: 
the natural gas line traversing the crawlspace. Looking back, there may very well have been 
warning signs. Students and teachers had been   complaining about headaches in the week leading up 
to the explosion. The superintendent and several   board members had, in fact, met the day of the 
explosion to search for potential sources of the   complaints. A school janitor even searched the 
crawlspace that morning and, struggling to see,   lit a match to get a better view. Either 
the leak didn’t start until later that day,   or it hadn’t reached an explosive mixture yet. 
The residue gas was tested in a lab after the   event and found to explode when mixed with air 
at proportions between around 4 and 13 percent. All the investigation reports suggested that 
switching sources from the utility gas to the   extraction plant residue line didn’t directly 
contribute to the explosion. Even though the   gas's chemical composition was different, it 
wasn’t significantly more explosive than the   previous supply. And, the regulator should have 
been able to manage the less reliable pressures   coming from the residue line. The Bureau of 
Mines report concluded that “no appreciable   difficulty should have resulted from its use.” 
But, all the work involved in changing the gas   supply was performed by an unqualified 
crew rather than professional plumbers. The Texas Inspection Bureau report noted 
that the school janitors were often “jacks   of all trades and probably masters of none” 
and that they might not have tested for   leaks or tightened joints, or they may have just 
knocked something loose while they were working.  We’ll never know for sure what caused the leak 
because all the plumbing was destroyed in the   explosion. But, the investigations did cite a 
bunch of factors that magnified the likelihood   and severity of the disaster. The crawlspace was 
large, spanning the entire length of the school,   creating a huge volume for natural gas to 
accumulate. The robust concrete foundation   and limited sources of ventilation left no easy 
paths for the pressure of combustion to escape,   making the explosion extra powerful. And 
most importantly, natural gas is mostly   odorless. There was no way to detect a leak. 
And even the smell of the less-refined residue   gas from the extraction plant would have 
been nearly impossible to notice in a town   surrounded by oil wells where the smell of 
petroleum was just a constant part of life. But, ultimately, the inquiry found 
no grounds to charge anyone involved   in the disaster. Although the dangers of 
natural gas were well-known by that time,   safety regulations just hadn’t kept pace with 
its growing use in buildings. The explosion   resulted from a number of profound misjudgments, 
but no laws were broken. Instead of charges,   the court issued recommendations to lawmakers to 
prevent a similar tragedy in the future, many of   which were echoed by the other investigative 
reports. And several of those proposals would   forever affect the fields of engineering, 
plumbing, petroleum production, and more. Within a few months, Texas passed two 
sweeping new laws. First, they joined   the growing ranks of states requiring the 
registration of engineers. At the time,   anyone could call themselves an engineer and 
offer services to the public, regardless of   their experience or qualifications. The 
new law created a regulatory board to   oversee the licensing process, helping build 
public trust in the profession and limiting   the possibility of unqualified engineers 
being involved in decisions that affect   public safety. Similar laws and licensing would 
come for the plumbing industry a decade later. The second major law that resulted from 
the explosion established regulations for   the odorization of natural gas. Many utilities 
across the country (and elsewhere in the world)   were voluntarily adding chemicals to their 
gas to make it more detectable by smell,   but the new law in Texas created standards 
that would quickly spread through the rest   of the US. Only a few months after that law 
came into effect, Peerless Manufacturing began   shipping an odorizer invented by two Texans, 
one of whom helped in the rescue effort at New   London. The Type “M” Oderizer could precisely 
dispense liquid odorant into a gas stream,   accounting for any changes in flow rate 
and pressure. The device was designated a   Mechanical Engineering Landmark by the American 
Society of Mechanical Engineers in 1992,   and odorizers of its kind have likely saved 
countless lives by making natural gas leaks   easily detectable by smell. Odorization got its 
federal mandate with the passage of the Natural   Gas Pipeline Safety Act of 1968, and is now a 
widely accepted and implemented safety measure   across the world. Natural gas is so closely 
associated with the smell of ethanethiol   (commonly known as ethyl mercaptan) that many 
never know that it is added artificially. It’s interesting to look back on an event 
like this with a modern lens and see just   how different our world is now. There are so 
many parts of the story that would have played   out so differently within the current system of 
building codes and licensure and safety measures   that we largely take for granted. And that’s 
a good thing, right? It means that, whether   directly like those new laws, or indirectly 
in a wide variety of ways, we’ve learned from   our mistakes. In the face of such a horrific 
tragedy, countless lives have been saved and   accidents have been averted by our ability to 
reckon with errors and work hard to correct   them. It gives me some comfort at least. Natural 
gas is one of the most important resources on the   planet right now. That’s not to say there are no 
consequences that come with it, and hopefully,   we’ll grow less dependent on it over time, but 
it’s driven countless innovations that benefit   nearly everyone in a huge variety of ways. And 
so, even if you had never heard of New London,   Texas before now, you can feel fairly 
confident that, all these decades later,   you’ve also benefited in some way from 
the hard lessons learned there in 1937. A few months ago I got an email about 
a podcast interview, but it was to my   personal email. Not a big deal, but I try to keep 
that inbox separate, so I asked how he got it,   thinking I had accidentally posted it somewhere, 
they said “We just bought it from a data broker.”   I knew that was a thing, but it was surprising 
to see it admitted so openly. And it just got   me thinking about the implications of personal 
information databases, especially because Incogni   had recently reached out to sponsor a video. I 
said, let me give it a shot, and then I’ll decide. We all get junk mail, spam emails, and 
telemarketing calls. You kind of think   that stuff is unavoidable, but those lists have to 
come from somewhere. And robocalls are annoying,   but data brokers can have more insidious 
effects, making it easier to steal your identity,   take out loans in your name, stalk you, and 
more. Plus algorithms can use personal info to   decide what ads to show you and even the prices 
you pay for products. Many of these services   offer a way to remove your information, 
but there are hundreds of these sites,   all with their own specific form to 
fill out. That’s where Incogni comes in. You authorize them to act on your behalf for this 
one specific purpose of removing your information   from online databases. And then you’re done. 
You can log on to see all of the websites that   have taken your info down, and Incogni just keeps 
working on it behind the scenes. Right now they   estimate that, if I were to do all this myself, 
it would have taken me more than two work weeks. It’s tough to correlate this to a reduction 
in spam. It definitely seems like I’ve gotten   a lot fewer unwanted phone calls since I 
signed up. But what’s more important to   me is the proactive part of it. It just 
helps make it harder for individuals and   companies to use my and my family’s personal 
information in unwanted ways. And if you’d   like the same peace of mind, they’re 
offering 60 percent off an annual plan   at the link in the description. Take back 
control of your personal information at   incogni.com/practicalengineering. Thank you 
for watching, and let me know what you think.

---

## 40. Why Bridges Don't Sink
**Channel:** Practical Engineering | **Views:** 4.1M | **Date:** 1 year ago | **Duration:** 17:30 | **ID:** XpTs1V2NQ24
**Link:** https://youtube.com/watch?v=XpTs1V2NQ24

### Transcript:
The essence of a bridge is not 
just that it goes over something,   but that there’s clear space underneath 
for a river, railway, or road. Maybe this   is already obvious to you, but bridges present a 
unique structural challenge. In a regular road,   the forces are transferred directly into 
the ground. On a bridge, all those forces   on the span get concentrated into the piers 
or abutments on either side. Because of that,   bridge substructures are among the strongest 
engineered systems on the planet. And yet, bridge   foundations are built in some of the least ideal 
places for heavy loading. Rivers and oceans have   soft, mucky soils that can’t hold much weight. 
Plus, obviously, a lot of them are underwater. What happens when you overload soil with a weight 
it can’t handle? In engineering-speak, it’s called   a bearing failure, but it’s as simple as stepping 
in the mud. The foundation just sinks into the   ground. But, what if you just keep loading 
it and causing it to sink deeper and deeper?   Congratulations! You just invented one of the 
most widely used structural members on earth: the   humble foundation pile. How do they work, and how 
can you install them underwater? I’m Grady, and   this is Practical Engineering. Today we’re having 
piles of fun talking about deep foundations. I did a video all about the different 
types of foundations used in engineering,   but I didn’t go too deep into piles. A 
pile is a fairly simple structural member,   just a long pole driven or drilled into the 
ground. But, behind that simplicity is a lot   of terrifically complex engineering. Volume 1 
of the Federal Highway Administration’s manual   on the Design and Construction of Driven Pile 
Foundations is over 500 pages long. There are   11 pages of symbols, 2 pages of acronyms, and 
you don’t even get to the introduction until   page 46. And just a little further than that, 
you get some history of driven piles. Namely   that the history has been lost to time. Humans 
have been hammering sticks into the ground since   way before we knew how to write about it. 
And that’s pretty much all a driven pile is. The first piles were made from timber, and wood 
is still used all these years around the world.   Timber piles are cheap, resilient to driving 
forces, and easy to install. But, wood rots,   it has an upper limit on length from the size of 
the tree, and it’s not that strong compared to   the alternatives. Concrete piles solve a lot 
of those problems. They come in a variety of   sizes and shapes, and again, are widely used for 
deep foundations. One disadvantage of concrete   piles is that they have to be pretty big to 
withstand the force required to drive them   into ground. Some concrete piles can be upwards 
of 30 inches or 75 centimeters wide. It is hard   to hit something that big hard enough to drive 
it downward into soil, and a lot of ground has   to either get out of the way or compress in place 
to make room. Steel piles solve that problem since   they can be a lot more slender. Pipe piles are 
just what they sound like, and the other major   alternative is an H-pile. Your guess is as good as 
mine why the same steel shape is an I-beam but an   H-pile. But, no matter the material, all driven 
piles are installed in basically the same way. Newton’s third law applies to piles like 
everything else. To push one deep into the   ground creates an equal and opposite reaction. 
You would need either an enormous weight to take   advantage of gravity or some other strong 
structure attached to the ground to react   against and develop the pushing force required to 
drive it downward. Instead of those two options,   we usually just use a hammer. By dropping 
a comparatively small weight from a height,   we convert the potential energy of the weight 
at that height into kinetic energy. The force   required to stop the hammer as it falls gets 
transferred into the pile. Hopefully this is   intuitive. It’s pretty hard to push a nail 
into wood, but it’s pretty easy to hammer it in ... well, it’s a little bit easier to hammer it 
in.  "Perfect!" There are quite a few types of pile drivers, but most of them use a large hammer or vibratory head to create the forces required. Maybe it goes without saying, but the main goal 
of a foundation is to not move. When you apply   a load, you want it to stay put. Luckily, piles 
have two ways to do that (at least for vertical   loads). The first is end-bearing. The end, or 
toe, of a pile can be driven down to a layer   of strong soil or hard rock, making it able 
to withstand greater loads. But there’s not   always a firm stratum at a reasonable depth 
below the ground. Quote-unquote “bedrock” is   a simple idea, but in practice, geology 
is more complicated than that. Luckily,   piles have a second type of resistance: skin 
friction, also known as shaft resistance.   When you drive a pile, it compacts 
and densifies the surrounding soil,   not only adding strength to the soil itself, but 
creating friction along the walls of the pile that   hold it in place. The deeper you go, the more 
friction you get. Let me show you what I mean. I have my own pipe pile in the backyard that 
I’ve marked with an arbitrary scale. When I   drop the hammer at a prescribed height, the pile 
is driven a certain distance into the ground. Do   this enough times, and eventually, you reach a 
point where the pile kind of stops moving with   each successive hammer blow. In technical terms, 
the pile has reached refusal.   I can graph the blow count required to drive the pile to each 
depth, and you get a pretty nice curve. It’s   easy to see how it got stronger against vertical 
loads the deeper I drove it in. Toward the end,   it barely moved with each hit. This is a really 
nice aspect of driven piles, you install them in a   similar way to how they’ll be loaded by the final 
design. Of course, bridges and buildings don’t   hammer on their foundations, but they do impose 
vertical loads. The tagline of the Pile Driving   Contractors Association is “A Driven Pile is a 
Tested Pile” because, just by installing them,   you’ve verified that they can withstand 
a certain amount of force. After all,   you had to overcome that force to get 
them in the ground. And if you’re not   seeing enough resistance, in most cases, you 
can just keep driving downward until you do! But piles don’t just resist downward forces. 
Structures experience loads in other directions   too. Buildings have horizontal, or lateral, loads 
from wind. Bridges see lateral loads from flowing   water, and even ice or boats contacting the piers. 
Both can experience uplift forces that counteract   gravity from floods due to buoyancy or strong 
winds. If you’ve ever hammered in a tent stake,   you know that piles can withstand loading from 
all kinds of directions. And then there’s scour.   The soil along a bridge might look like this right 
after the bridge is built, but after a few floods,   it can look completely different. Engineers 
have to try and predict how the soil around   a bridge will scour over time, from natural 
changes in the streambed and those created by   the bridge itself. Then they make sure to design 
foundations that can accommodate those changes   and stay strong over the long term. This is why 
bridge foundations sometimes look kind of funny.   Loads transfer from the superstructure down 
into the piers. The piers sit on a pile cap   that transfers and distributes loads into the 
piles themselves. Those piles can be vertical,   but if the engineer is expecting serious lateral 
loads, some of the piles are often inclined,   also called battered piles. Inclined 
piles take better advantage of the shaft   resistance to make the foundation 
stronger against horizontal loads. As important and beneficial as they are, driven 
piles have some limitations too. For one,   they’re noisy and disruptive to install. Just 
last year, I had two friends on separate trips   to Seattle who sent me a video of the exact same 
pile-driving operation. It’s good to have friends   who know how much you like construction. But my 
point is, this type of construction is pretty   much impossible to ignore. In dense urban areas, 
most people are just not willing to put up with   the constant banging. Plus the vibrations 
from installing them can disrupt surrounding   infrastructure. Pile driving is crude; in many 
cases, the piles aren’t designed to withstand   the forces of the structure they’ll support but 
rather the forces they’ll have to experience   during installation which are much higher. They 
can’t easily go through hard geological layers,   cobbles, or boulders; they can wander off path, 
since you can’t really see where you’re going,   and they can cause the ground to heave because 
you’re not removing any soil while you force   them into the subsurface. The second major 
category of piles solves a lot of these problems. And, wouldn’t you know it? There’s an FHWA manual 
that has all the juicy details - Drilled Shafts:   Construction Procedures and Design Methods. 
This one a whopping 747 pages long. A drilled   shaft is also exactly what it sounds like. 
The basic process is pretty simple. Drill a   long hole into the ground. Place reinforcing 
steel in the hole. Then fill the whole thing   with concrete. But, bridge piers 
are often, as you probably know,   installed underwater. Pouring concrete 
underwater is a little tricky. Imagine   trying to pour a smoothie at the bottom 
of a pool! Let me show you what I mean. This is my garage-special bridge foundation 
simulator.  It has transparent soil in the form   of superabsorbent polymer beads… and you know we 
have to add some blue water too. You can probably   imagine how easy it might be to drill a hole 
in this soil. It’s just going to collapse in on   itself. We need a way to keep the hole open so the 
rebar and concrete can be installed.   "Oh, it's making a huge mess." So, drilled shafts installed in soft soils or wet conditions 
usually rely on a casing to support the walls.   Installing a casing usually happens while the hole 
is drilled, following the auger downward. I tried   that myself, but I only have two hands, and it 
was pretty unwieldy. So, just for the sake of the   demo, I’m advancing the casing into the soil ahead 
of time. Now I can drill out the soil to open the   shaft. And now I’m realizing the limitations of 
my soil simulant. It was still pretty hard to do,   even with the casing in place. It took a few 
tries, but I managed to get most of it out. So now I have an open hole, but it’s still full 
of water. Even if your casing runs above the   water surface, and you try to pump it out, you 
can still have water leaking in from the bottom.   In ideal conditions, you can get a nice seal 
between the bottom of the casing and the soil,   but even then, it’s pretty hard to keep water 
out of the hole, and luckily it doesn’t matter. Instead of concrete, I’m using bentonite clay 
as a substitute. It’s got a similar density,   and it’s perfect for this demo because you can 
push it through a small tube…  if you get the proportions right.  This is me pondering the life decisions that led   up to me holding a gigantic syringe full of 
bentonite slurry in my garage. You can’t just   drop this stuff through the water. It mixes 
and dilutes, just turning into a mess. Same   is true for concrete. The ratio of water to 
cement in a concrete mix is essential to its   strength and performance, so you can’t do 
anything that would add water to the mix.   The trick is a little device called a tremie. 
Even though it has a funny name, it’s nothing   more than a pipe that runs to the bottom of the 
hole. As long as you keep the end of the tremie   below the surface of the concrete that you’re 
pumping in, or concrete simulant in my case,   there’s no chance for it to mix with the water 
and dilute. I’m just pushing the clay into the   casing with a big syringe, making sure to 
keep the end of the tube buried. Because   concrete is a lot more dense than water, it 
just displaces it upward, out of the hole. In underwater installations, the casing is 
often left in place. One advantage is that   you can build a floating pile cap. Instead 
of building a big cofferdam and drying out   the work area to construct a big concrete 
structure, sometimes you can raise the pile   cap into or above the water surface, reducing 
the complexity of its construction. These “high   rise” pile caps are used a lot in offshore wind 
turbines. But, not all casings are permanent. In some situations, it’s possible to pull 
the casing once the hole is full of concrete,   saving the sometimes enormous cost of each 
gigantic steel tube. I tried to show this   in my demo. It’s not beautiful, but it 
did work. Again, the concrete is dense,   so the pressure it exerts on the walls of the 
hole is enough to keep the soil from collapsing.   And because drilled shafts can be much larger 
than driven piles, sometimes you don’t even   need a group of them. Lots of structures, 
including wind turbines, highway signs,   and more, are built on mono-pile foundations. 
Just a single drilled shaft deep in the ground,   eliminating the need for a pile cap altogether. 
Another interesting aspect of drilled shafts is   that you can ream out the bottom, creating an 
enlarged base that increases the surface area   at the toe. This helps reduce a pile’s tendency to 
sink, and it can help with uplift resistance too. Driven piles and drilled shafts are far from the 
only types of deep foundation systems. There are   tons of variations on the idea that have been 
developed over the years to solve specific   challenges: Continuous flight auger piles do the 
drilling and concreting in essentially one step,   using a hollow-stem auger to fill the hole as it’s 
removed. Then reinforcement is lowered into the   wet concrete. You can fill a hole with compacted 
aggregate instead of concrete, called a stone   column or tradename Geopier if you’re only worried 
about compressive loads. Helical or screw piles   twist into the ground, instead of being hammered, 
reducing vibrations and disturbance. Micropiles   are like tiny drilled shafts used when there 
are access restrictions or geologic constraints.   And of course, there are sheet piles that aren’t 
really used for foundations but are driven piles   meant to create a wall or barrier. Let me know if 
I forgot to mention your favorite flavor of pile. Even though they’re usually much stronger 
than shallow foundations, piles can and   do fail. We’ve talked about San Francisco’s 
famous Millennium Tower in a previous video.   That’s a skyscraper on a pile foundation that 
sank into the ground, causing the building to   tilt. It seems like they mostly have it fixed 
now, but it’s still in the news every so often,   so only time will tell. In 2004, a bridge pier 
on the Lee Roy Selmon Expressway in Tampa,   Florida sank 11 feet (more than 3 meters) while 
it was still under construction because of the   complicated geology. It cost 90 million dollars 
to fix and delayed the project’s completion by a   year. These case studies highlight the 
complexity of geotechnical engineering   when we ask the ground to hold up heavier and 
heavier loads. The science and technology that   goes into designing deep foundations are 
enough to spend an entire career studying,   but hopefully, this video gives you 
a little insight into how they work. It’s a little hard to see a bridge’s foundation 
than its other parts, but if you look closely,   you can often get hints about how 
they’re secured to the ground. In fact,   one of my main goals with these videos 
is to connect ideas in engineering to   things you can see for yourself out in the 
world… like, for example, on a road trip. Bearded Grady here. It’s easy to tell that this 
was shot after the main video, and there’s a good   reason for that! Today’s sponsor Nebula adds new 
features and original content so often that I want   to make sure I have something fresh to recommend 
to you, and it turns out that my friends behind   Wendover Productions and Jet Lag have a brand new 
game show, The Getaway, based around a road trip   with a very hilarious twist. All the contestants 
are creators, including Patch from Tier Zoo. I   got a sneak preview, and it’s just so well done. 
The trailer’s out now, and the series starts next   week. Just in time to pick up a subscription 
to the only place you can watch it: Nebula. Nebula’s a streaming service built 
by and for independent creators. No   studio executives deciding what gets 
the green light, no advertisements,   and no algorithm driving the content into 
a single style. Just independent creators   making stuff they're excited about with as 
few barriers and distractions as possible   between you and us. My videos go live 
on Nebula before they come out here,   and right now, a subscription is 40% 
off at the link in the description. Plus if you already have a subscription, 
now you gift one to a friend. We have   annual gift cards now. Give someone you love 
a year’s worth of thoughtful videos, podcasts,   and classes from their favorite creators. Or 
just write it down in your list of ideas for   future birthdays and holidays. You have a 
list right? It’s only 30 dollars a year at   nebula.tv/practicalengineering for yourself 
or gift.nebula.tv/practical-engineering for   a friend. Thank you for watching, 
and let me know what you think!

---

## 41. This Bridge Should Have Been Closed Years Before It Collapsed
**Channel:** Practical Engineering | **Views:** 2.1M | **Date:** 1 year ago | **Duration:** 22:11 | **ID:** 4mn0mC0cbi8
**Link:** https://youtube.com/watch?v=4mn0mC0cbi8

### Transcript:
On January 28, 2022, about an hour before dawn, 
the four-lane Fern Hollow Bridge in Pittsburgh,   Pennsylvania, collapsed without warning. 
Five vehicles, including an articulating bus,   fell with the bridge, and another car 
drove off the abutment after the collapse,   not realizing the bridge was gone. 
Although there were no fatalities,   several people in the vehicles were seriously 
injured. And this bridge had been listed as being   in ‘poor condition’ for over a decade. Anyone 
who walked by the supports in the park below   would have had reason to question its safety, 
as seen in this sadly prophetic tweet from 2018,   four years before the collapse. So, 
why was it left open in this state? While some initial findings were released 
earlier, the official NTSB report was   delivered to the public this year in February, 
more than two years after the collapse and over   a year after the replacement bridge was 
built and open. The report included the   use of some really cool technology for the 
forensic study of structures and revealed   systemic flaws in how we inspect, analyze, 
and prioritize repairs for bridges. In fact,   the NTSB issued recommendations to basically 
every organization involved in this bridge   from the bottom to the top, and they referenced 
that tweet that got so much attention. This is   a crazy case study of how common sense can 
fall through the cracks of strained budgets   and rigid oversight from federal, state, and city 
staff. And the lessons that came out of it aren’t   just relevant to people who work on bridges. 
It's a story of how numerous small mistakes by   individuals can collectively lead to a tragedy. 
I’m Grady, and this is Practical Engineering. The Fern Hollow Bridge was opened in 1973, 
replacing an aging arch bridge built at the   beginning of the 20th century, crossing Frick 
Park and Fern Hollow Creek. The 1973 bridge used   a K-Frame design with continuous steel girders 
supporting the deck, each with two angled steel   legs supported on concrete thrust blocks. At 
the time, the bridge’s design was celebrated   because it blended well into its settings. It 
was featured on the cover of the 1974 edition   of Prize Bridges by the American Institute 
of Steel Construction. And a big part of why   it looked so harmonious with the park below 
was the type of steel used for the design. The Fern Hollow bridge was fabricated from 
weathering steel, sometimes referred to by   its genericized trademark, COR-TEN. And it was 
developed commercially right there in Pittsburgh   by US Steel in the 1930s. Unlike most types of 
steel, whose rust can continually flake away,   exposing more material to corrosion, the oxide 
layer on weathering steel (called its patina)   is more stable and protective, shielding 
the underlying material against exposure to   the elements. In that way, weathering steel acts 
kind of like aluminum, which protects itself from   corrosion in a similar way. And, architecturally, 
it’s a nice material. You get this rustic look   that can give structures a more comfortable and 
less obtrusive appearance. But weathering steel   has a limitation: For a stable patina to form, the 
material has to stay mostly dry. If water pools or   the steel is kept damp for extended periods, 
that patina of rust isn’t enough to protect   the underlying steel, and it will continue 
to corrode. Corrosion of structural steel   is called section loss by engineers, and it's 
easy to see why in these photos of the bridge. What’s more alarming than what’s in those photos 
is where they came from: inspection reports of the bridge.  It’s not that this deterioration somehow 
went unnoticed. The bridge supports were clearly   visible from a popular walking trail. Between 
2005 and 2021, this bridge was inspected a total   of 14 times! In those reports, you get a clear 
and vivid story of its decline. First were the   drainage problems. You can see in these images 
from multiple previous bridge inspections there   were drainage grates on the roadway that were 
100 percent clogged. Rainwater, and even worse,   salty meltwater from the frequent snow that 
Pittsburgh sees each winter couldn’t follow   the prescribed drainage paths off the deck and 
into the creek below. Instead, that water would   leak through the bridge deck, dribbling over 
the structural steel, and pooling in portions   of the legs where webbing and tie-plates could 
catch puddles of water, leaves, and debris. The City was aware of the section loss 
due to these drainage problems for many   years before the collapse. Nearly every 
inspection report noted problems with the   drains and the accelerating corrosion that was 
resulting. In fact, in 2009, the cross-braces   connecting each pair of legs were found to be 
failing, and steel cables were installed as a   temporary retrofit until the framing could be 
replaced. These cables were lightly tensioned   to add structural integrity to the bridge but 
were never meant to be a permanent solution. You can see the ends of two of these cables in 
this now-infamous tweet from 2018. Of course,   the more notable feature of this image is the 
fully separated steel cross-brace! That photo   was taken about nine years after the temporary 
cables were installed. And they remained in   place for the rest of the bridge's life, which 
ended up being only four more years. But the   cross-bracing between the legs wasn’t the only 
place where corrosion was an issue. The legs   themselves were also fabricated from weathering 
steel, and that steel was suffering, too. Since   2005, inspection reports marked them in 
fair to poor condition with areas where   the steel had completely rusted through. 
By 2019, all four legs were given the worst   assessment possible for an individual 
bridge element. According to the code,   that should trigger a structural review to 
check whether the integrity is affected by   the poor condition of a structural element, 
but it was never done. And that’s not all. An important part of inspecting steel bridges is 
identifying members that are “fracture critical.”   That’s engineering jargon, but the idea is 
actually pretty straightforward. It’s any piece   of steel under tension that lacks redundancy. If 
it breaks, the bridge collapses. And these types   of members get special attention because of their 
importance, so inspection teams identify them   ahead of time to make sure they get a proper look. 
This drawing shows in green which elements of the   bridge were considered to be fracture-critical. 
Notice that while the girders crossing the span   are identified, the legs are not. And, at first 
glance, that might match your intuitions. Bridge   piers, columns, and vertical supports usually 
don’t experience tension forces, right? They’re   in compression. So if there’s a crack or 
break, the forces just squeeze it together,   generally not that big a deal. But K-frame bridges 
are different. By splaying out the legs, there   are loading conditions that can apply bending 
forces, putting part of each beam in tension. And,   this particular bridge had another feature that 
was absolutely essential to its performance. Each leg of the bridge was essentially an I-beam: 
a central web with a top and bottom flange. To   simplify the foundation design, each leg had 
a “shoe”: a tapered end that would connect   to the concrete block. It’s clear that the 
narrower section would have less strength,   so larger stiffeners were added to each shoe 
to strengthen that portion of the leg. These   are just steel plates welded to the web and 
flanges to increase the leg’s rigidity. And I   built a little cardboard model to clarify 
this point. This particular stiffener,   called the transverse tie plate, bridges the two 
flanges right where they taper down. And if I   apply a compressive force on the leg, it’s easy to 
see what kind of force that tie plate experiences   as a result. It’s tension. These tie plates 
were fracture-critical members of the bridge,   but never identified as such, and so, even 
though it was clear they were deteriorating   quickly over time, the inspectors never elevated 
the concerns to a priority level that might have   spurred a more immediate response. But there 
was another opportunity to catch the problem. In 2013, an inspector was concerned enough 
about the bridge's safety to recommend that it   be reviewed for a load rating. Most bridges are 
designed to allow any legal load to pass over,   but sometimes, either because of an old 
design or poor structural conditions,   it's necessary to limit the weight of vehicles 
allowed. Engineers analyzed the bridge in 2014   and decided it could only handle 26 tons 
per vehicle, just over half of its previous   rating. When NTSB reviewed that decision in 
hindsight, they found some pretty serious errors. For one, the load rating for the bridge was 
based on a layer of about 3 inches of asphalt   paving on top of the concrete road deck. In 
reality, the bridge had about double that   amount. The City’s records of the removal 
and addition of pavement were poorly kept,   so the engineering firm doing the load rating had 
no idea there was so much extra weight. For two,   the engineers didn’t fully account for all 
the corrosion on the legs. This was partly   because inspectors hadn’t cleaned off the rust 
to measure and report the actual thickness of   the remaining steel. Even so, the engineers 
used a method that distributed the section   loss from corrosion evenly along the entire leg, 
instead of applying it where it actually was,   at the shoes and tie plates. That’s a pretty 
commonly-used simplification that usually   generates conservative results (since the 
worst corrosion is rarely located at the   most critical part of a structure), but 
again, that wasn’t the case for the Fern   Hollow Bridge, and no one had recognized 
how important those tie plates really were. And for three, those engineers made 
an incorrect assumption about how the   bridge’s legs would buckle. A structural member 
under compression will buckle at different loads   depending on how much restraint it has at 
the ends. This is something you learn in   year one of engineering. If you keep a column 
from rotating at its ends, you substantially   increase the amount of force it can withstand, and 
with the original cross-bracing between the legs,   that would have been the case. But I’m sure I 
don’t have to tell you that steel cables don’t   provide the same support as rigid members. Again, 
this is engineering 101: “You can’t push a rope.”   The cables provided some restraint, but not in 
the same way that the original bracing could,   so the load rating applied to the bridge ended up 
significantly overestimating its actual capacity.   In fact, when NTSB updated the load rating 
with these errors fixed, they found that the   bridge should have been limited to 3 tons, 
basically nothing for a bridge. In effect,   this load rating exercise should have closed 
the bridge to traffic entirely. These structural   issues were exactly what the process was meant to 
identify. But instead, the bridge stayed open to   everyone except the largest of trucks,and here’s 
what happened, courtesy of NTSB’s animation team. The transverse tie plate on the southwest leg, 
weakened by corrosion, failed first under tension,   separating the flanges on the leg, and ultimately 
causing it to buckle. With no redundancy in the   supports, the loads had nowhere to go, 
and so the rest of the bridge fell into   the valley below. The articulated bus had both 
rear-facing and forward-facing cameras on it,   which captured some truly harrowing footage of 
the event. Looking at the rear-facing camera,   you can see the western portion of the bridge 
begin to fail. Keep an eye on the railing,   and you can see the exact moment 
it starts. Once it started,   there was no stopping it. Within two seconds, 
the front-facing camera shows that the collapse   had propagated all the way to the eastern 
abutment, and the bridge fully failed. Thankfully, the collapse happened during 
particularly inclement weather. School delays and   generally poor conditions meant that traffic was 
lighter than normal, and the weather also likely   kept folks away from the trail underneath. 
On a fair weather day during rush hour,   it wouldn’t be uncommon for the eastbound lanes of 
the bridge to be fully occupied by heavy traffic,   and the trail underneath to be populated with dog 
walkers, families, or even classes on field trips   from nearby schools. The bridge also carried 
a large gas line, which was severed during   the collapse, leading to a major leak and some 
evacuations, but they got it shut off in time.   It really is remarkable that nobody was killed in 
a failure of this magnitude. But there were still   multiple victims needlessly affected for the rest 
of their lives by the collapse, not to mention the   overall erosion of trust in the organizations and 
engineering systems meant to keep the public safe. By pure happenstance, President Biden was 
set to arrive in Pittsburgh on the very   day of the collapse to speak in support of 
the Infrastructure Investment and Jobs Act,   so he rearranged his trip to make some remarks at 
the site. One of the entities supported by the act   is the National Highway Performance Program, which 
ultimately funded the replacement of the collapsed   bridge. But at that time, no one understood 
the full scope of neglect and bad assumptions   that led to the gradual, and then sudden, demise 
of the bridge. In those two years after Fern   Hollow Bridge fell, the NTSB conducted 
numerous interviews with those involved,   from the paving contractors to the inspectors to 
the bridge rating engineers. They performed 3D   laser scanning of the bridge components to compare 
them to as-built conditions. They tested sections   of steel for strength and durability. They 
reviewed all the previous records of the design,   construction, and repairs. And they 
built a detailed finite-element model   of the bridge to confirm that the gradual 
corrosion of one small structural element,   the transverse tie plate on the southwest 
leg, initiated the collapse. And then they   documented why it got to that point: the 
City of Pittsburgh just didn’t fix it. This figure in the NTSB report tells the story as 
clearly as I think is possible. From 2005 onward,   recommendations from inspection reports to repair 
parts of the bridge didn’t fall off the list. They   just kept being repeated by each new inspection, 
year after year. Since 2007, every single   inspection report that included recommendations 
said to repair the stiffener plates in the legs   that were heavily corroded. These were Priority 
2 recommendations, which means the timeframe to   complete them is before the next inspection. But 
it was never done. They didn’t fix the drainage   problems that were accelerating the corrosion, 
they didn’t apply the protective coatings   that might have slowed it down, and they never 
analyzed the capacity of the legs after they were   rated the worst possible condition a structural 
element can have. And, apparently, there was no   mechanism to follow up on those recommendations 
by the state charged with overseeing the bridge   inspection program. When there was finally a 
chance to recognize how deficient the structure   really was through a new load rating, 
the engineers made a few bad assumptions,   missed it by a mile, and left the bridge open, a 
ticking time bomb, for years. (Years, by the way,   in which the City still didn’t address the 
recommendations from inspection reports.) Due to the nature of the emergency, the site 
was cleaned up quickly, with a huge crane   brought in to remove the bus, and building of 
the replacement bridge happened on a fast-track   schedule. The new bridge uses a more conventional 
design:  pre-stressed concrete girders on vertical piers.  The formed stone texture on the columns 
certainly doesn’t blend into the park as well   as the graceful and patinaed K-frame once did, 
but I doubt anyone involved in the project could   stomach another structure built from weathering 
steel, given the circumstances. The new bridge   might not win any awards for beauty, but it 
could win some for speed. After a colossal   effort from the design and construction teams, 
it opened to limited traffic less than a year   after the collapse in December of 2022, and by 
July the next year, it was fully operational. It   would be almost a year later before the NTSB 
concluded why the previous bridge collapsed,   not for the purpose of blame, but to issue 
recommendations to prevent something like   this from recurring in the future. And unlike the 
recommendations from those inspection reports,   many of the NTSB recommendations 
have already been put into practice. They published a special report on weathering 
steel bridges to highlight the specific challenges   of keeping them in good condition, and they 
identified several similar bridges that needed   a closer look. The City of Pittsburgh 
quadrupled their spending on inspection,   maintenance, and repairs. And they redid the 
load ratings on all the bridges they owned,   resulting in one bridge being closed until it 
can be rehabilitated and two more having lane   restrictions imposed. PennDOT released 
a technical bulletin to shore up their   bridge inspection program. And even the federal 
government has implemented a process to identify,   prioritize, and follow up on recommendations 
related to weathering steel bridges. But as I read through those recommendations 
from the NTSB, one thing struck me: They all   add up to more paperwork. And this is just my own 
personal opinion as someone who did this kind of   work for nearly a decade (not on bridges, 
but other large infrastructure projects).   We have these national inspection standards 
and procedures - huge documents that you could   spend an entire career understanding. We have 
the Federal Highway Administration overseeing   the program, state DOTs charged with carrying it 
out, individual bridge owners, like Pittsburgh,   responsible for inspecting their own bridges, 
and then the private contractors who do most of   the actual work. We have this huge machine 
with thousands of people, federal, state,   and local involvement, and millions of 
dollars meant to keep the traveling public   safe. And what did it do for us 
when a photo like this is all it   would take any reasonable person to 
say: “This bridge needs to be fixed”? This big machine, in a lot of cases, has all the 
work sectionalized out. The inspectors see the   bridge up close, but they have no autonomy to do 
anything but document and give recommendations.   It’s not their bridge. But the owners who are 
charged with the safety of their bridges just   see a piece of paper. Each recommendation is just 
another one on the list of sometimes hundreds of   action items, to sort and prioritize and 
try to find the budget to cover. All the   NTSB recommendations feel a little bit like 
bandaids if the real source of the problem   was that no one person in this whole machine 
had both a full appreciation of the bridge's   condition and the authority to do something 
about it. And if that’s the case, I’m not   sure any of those recommendations really fixes 
that problem. I don’t know what the answer is,   and I’m still wrestling with trying to understand 
how something like this can fall through the   cracks of the enormous system we’ve built 
for the sole purpose of trying to prevent it. If you take a walk on the Tranquil Trail through 
Frick Park beside Fern Hollow Creek and look   carefully, you can still see remnants of the 
old bridge. And I’m glad the City left them,   because they’re a good reminder that design 
and construction are two parts of a three-part   system for keeping people safe. Maintaining 
infrastructure is thankless work. Don’t get   me wrong, it can be a really rewarding career. 
Inspections involve a lot of time out in the   field seeing cool structures up close. And repair 
projects are often interesting challenges for   contractors. But they’re not rewarding in the 
same way that designing and building new stuff   can be. No one holds a press conference and cuts 
a big ribbon at the end of a bridge inspection or   structural retrofit. Building a new structure is 
not just an achievement in its own right; it’s a   commitment to take good care of it for its entire 
design life, and then to rehabilitate, or replace,   or even close it when it’s no longer safe for 
the public. And I think this is the perfect case   study to show that there’s more we could do to 
encourage and celebrate that kind of work as well. Maintenance is a big part of budgeting for large 
infrastructure, because it’s a major part of the   lifecycle of a project. You see construction 
costs in the news all the time (this is an X   million-dollar job), but you rarely see what 
the owners are setting aside for inspections,   repairs, and upkeep for the decades that follow. 
And the same thing is true for razors. You can   pick up a cheap razor from the store and 
then spend many multiples of the original   cost over its lifetime for blades. Today’s 
sponsor Henson takes the opposite approach:   bite the bullet at first for a nice handle, and 
then the safety blades cost pennies. It doesn’t   take long for the decision to pay itself off. 
Obviously, I’ve been skipping razor day for a few   weeks now, but I usually stay pretty clean-shaven. 
I don’t know how long I’ll keep this, but I do   know how I’ll get rid of it when I do. Henson 
offered to sponsor a video about a year and a half   ago. I said send me a razor, I’ll try it out, and 
then decide. And I never switched back. I actually   went and counted, and, in that year and a half, 
I’ve used just under 30 blades. That’s 3 bucks,   unless you use my discount code that 
gives you 100 blades completely free. A new razor’s probably not going to change your 
life. But, shaving’s a chore (at least to me),   and using a precision tool makes it feel 
less like a chore, and instead a part of   my day that I actually enjoy. I had never 
used a safety razor and figured they were   old technology. Totally not true - these are 
made in an aerospace machine shop. I also   figured there would be a learning curve, but that 
also wasn’t true. The Henson is so easy to use,   I don’t think I could ever go back to a cartridge 
razor with their flexible blades and difficulty in   rinsing out. If you’ve ever been on the market 
for a tool and splurged on the nicest brand,   this is that, except, it's not really a splurge. 
The blades for the Henson razor are so cheap you   could probably put a new one on for every shave 
and still save money. And in fact, if you use my   code PRACTICALENGINEERING at checkout, you can 
get a 100-pack of blades on me. Just make sure   both the razor and the blades are in your cart, 
enter the code, and the discount will be applied   right away. There’s no subscription service or 
a monthly fee, it’s just a cool razor that I   really like and I think you will too. Thank you 
for watching and let me know what you think.

---

## 42. The Most Confusing Part of the Power Grid
**Channel:** Practical Engineering | **Views:** 2.9M | **Date:** 1 year ago | **Duration:** 22:07 | **ID:** ZwkNTwWJP5k
**Link:** https://youtube.com/watch?v=ZwkNTwWJP5k

### Transcript:
In March of 1989, Earth experienced one of 
its strongest geomagnetic storms in modern   history. It all started when scientists 
observed a cluster of sunspots—active,   magnetic areas on the sun's surface—emerging 
on its horizon. Over the next few days,   the sun slowly rotated until the region began 
to point directly at Earth. Just as it did,   two solar flares erupted from the sunspots. 
Accompanying the flares were coronal   mass ejections: huge bursts of solar wind, 
essentially charged particles from the sun.   The coronal mass ejections eventually 
crashed into the earth’s magnetic field,   causing it to squish and compress and ultimately 
induce electric currents at the surface. In Quebec, Canada, the rapid changes in magnetic 
fields would have mostly gone unnoticed by people,   but they didn’t go unnoticed by the 
power grid. The region’s unique geology,   a shield of hard rock that is a poor conductor 
of electricity, kept these induced currents from   dissipating into the ground. So they found 
another path: the electrical transmission   lines. The geomagnetic storm ended up blacking 
out a large part of the Hydro-Quebec power   grid for nine hours. And the first domino of the 
collapse (or rather the first seven) were pieces   of equipment known as static compensators. But 
to understand how static compensators work and   why a solar flare could trip them offline, 
you kind of have to start with the basics. You might know that most parts of all modern power 
grids use alternating current or AC. The voltage   and current on the lines slosh back and forth, 
50 or 60 cycles per second, depending on where   you live. If you love power electronics, that 
low, dull, AC hum might be music to your ears.   But if this is kind of new to you, alternating 
current can be a little bit mysterious. What’s   even weirder is that, even though the current 
constantly alternates its polarity, electrical   power only moves in one direction… under ideal 
conditions. And geomagnetic storms aren’t the only   thing that can make the grid behave in funny ways. 
There are devices even in your own home that force   the grid to produce power and move it through the 
system, even though they aren’t even consuming it.   Let’s go out to the garage, and I can show you 
what I mean. I’m Grady, and this is Practical   Engineering. In today’s episode, we’re talking 
about how power actually flows on the grid. I’ve built a model power grid here in the 
shop. (Not the first time I’ve said that,   and it probably won’t be the last.) I’ll 
keep it simple at first and build up the   complexity as I explain these concepts. And Zap 
McBody slam is back in the shop to help out.   My grid has one power source, right now just a 
battery, a transmission line to carry the power,   and a load (in this case, an incandescent light 
bulb). It’s probably not the most interesting   circuit you’ve ever seen. But like I said, 
understanding the basics of power flow is   essential to understanding the more complicated, 
and I think, the more interesting aspects of   how it works on a huge scale. So, here’s a 
one-minute refresher on electrical circuits: There are really only four numbers 
that matter the most in a circuit.   First is voltage, the difference in electric 
potential between two locations. In the classic   pipe analogy, voltage is the pressure that 
drives water to flow from one side to the   other. In my circuit, the battery is supplying 
about 10 volts across the bulb. Next is current,   the flow of electric charge. In the pipe analogy, 
this is the flow rate of the water. In my circuit,   I can measure the current as 1.2 amps. Third is 
resistance, the opposition to the flow of current.   It’s the size of the pipe. Incandescent bulbs 
actually change their resistance depending on   voltage, so it can’t be measured directly with 
a meter. That’s okay, though, because all three   of these values are related to each other. That 
relationship, called Ohm’s law, is about as simple   as it gets. Voltage is equal to current times 
resistance. If you know two, you can find the   other one with some basic math. For example, 10.1 
volts flowing at 1.2 amps means the resistance of   my lightbulb is around 8 ohms. The final number we 
care about is power, the transfer of energy. Power   does the actual work, in this case, creating 
light and heat in the bulb. Calculating power   is as simple as multiplying the voltage and the 
current together. 10 volts times 1.2 amps tells   me that this bulb is dissipating 12 watts. 
That’s electrical engineering in a nutshell,   and it’s relatively straightforward for a 
circuit like this that uses direct current or DC,   because none of our important numbers change. 
But, as I mentioned, that’s not true on the grid. Let me swap out the battery with a transformer 
plugged into an outlet and see what happens.    At first glance, there’s no change. The bulb is still 
lighting, just like it did with the battery. I can   measure the voltage by switching my meter to AC: 
8.4 volts, not too far from the DC circuit. I can   measure the current with this clamp over meter: 
1.2 amps, same as before. But those are just   simplifications of what’s really happening on the 
lines. To see that, we need a different piece of   equipment. This oscilloscope measures voltage over 
time and plots it as a graph on the screen. And   I can insert a resistor into the circuit and 
use a second probe to plot the voltage across   that resistor as a simple way of measuring 
current. “So the yellow will be the voltage,   and the green will be the current.” You can 
see that neither the voltage nor the current   are constant… unless you trip over all the 
cords. They’re switching directions over   and over again. This might not be too 
surprising to you yet, but watch what   happens if I switch out the lightbulb with a 
different kind of load. Let’s try a capacitor. This is a device that stores energy in an electric 
field between two plates. You see them everywhere   in electrical circuits, and they do a funny 
thing on the grid. When I insert the capacitor   to my circuit, the graph of voltage and current 
looks different because they’re no longer in   phase. “Hey… that worked perfectly.” The current 
waveform is leading the voltage; the current peaks   happen before the voltage ones. That’s because the 
current has to flow into the capacitor before the   voltage between the plates rises. It takes time 
for the capacitor to charge and discharge, which   results in a delayed response in the voltage. Now, 
let’s try another type of load called an inductor. An inductor is basically a coil of wire. 
Like a capacitor, an inductor stores energy,   but instead of an electric field, it stores 
that energy in a magnetic field. This is just an   electromagnet like you might see in a scrapyard. 
If I swap in an air-core inductor, you can hear   the screwdriver rattle against the table as the 
magnetic field rapidly changes direction.   And, we get the opposite effect of the capacitor when 
the inductor is inserted into the circuit. This   time, the current waveform is lagging the voltage. 
That magnetic field resists changes in current,   so it creates a delay, this time in the current 
waveform. I can even vary this inductance and   thus the lag in the current by moving this 
ferrite rod in and out of the core. All this   is interesting on its own, but these little shifts 
in a graph have serious implications on the grid,   and have even resulted in numerous 
blackouts across the world. Here’s why: Remember, that the power consumed by an electrical 
load is just the voltage multiplied by the   current. We can do that for any point in time 
across this graph. For a purely resistive load,   like the lightbulb, the current and voltage 
are in sync. When one is positive, the other   is positive. When one is negative, the other 
is too. So when you multiply them together at   any point along the graph, you always get 
a positive number. The power fluctuates,   but it’s always moving in one direction. For a 
reactive load (the term used for inductors and   capacitors), that’s no longer the 
case. There are times in the cycle   when the current and voltage are opposite 
polarity, meaning, instead of being consumed,   power is actually flowing out of the load. In 
fact, for a purely capacitive or inductive load,   there’s no power consumption at all - no work 
being done. It’s just stored in a magnetic or   electric field and returned. But there’s 
still current flowing, and that matters. Of course, most things connected to the 
power grid aren’t purely reactive. But   lots of devices that we plug in 
have some amount of inductance.   Look around your home for any big motors. 
Air conditioners, refrigerators, washers,   dryers, large power tools, and more primarily use 
induction motors because they’re cheap, simple,   and last a long time. And inside an induction 
motor is a series of wire coils used to create   magnetic fields that spin the rotor, just like 
the inductor I used in the demo. Part of the   power that flows into those coils just gets sent 
back out onto the grid. You might be thinking,   “So What? Nothing wrong with storing a little 
bit of energy, as long as I give it back in   less than a sixtieth of a second afterwards.” 
But, the grid still had to produce that power,   and more importantly, deliver that power 
to your home and carry it back away. The electric meter at your home, in most cases, 
only tracks the power you actually consume. So,   you don’t pay for the reactive power that flows 
into your devices and back out again. But that   doesn’t mean it doesn’t come at a cost. It 
still has to flow through the power network,   where some gets lost as heat from resistance 
in the lines. So, the generators have to make,   and the transmission lines have to move, more 
power, in some cases a lot more power, than is   actually being used in the system. Reactive power 
can make up a big part of the total load on the   system, even though it’s not doing any work. Just 
having the infrastructure in place to handle it   is also costly. The conductors, transformers, 
and generators on the grid have to be sized   for the total current that needs to move through 
the system, not just the current that does work.   And that stuff is expensive.  It’s like if you were a photographer and bought a bunch of props   for a shoot from a company with a generous 
return policy. After you take your photos,   you return everything back to the store. Those 
props were useful, even necessary to you, but only   for a period of time. And there was a real cost 
to warehousing, transporting, and restocking them,   even if you didn’t bear it. Imagine if there were 
a hundred photographers that did the same thing.   It wouldn’t be long before such a store wasn’t 
very profitable. But unlike at your home, where   the utility is generous in their return policy, 
lots of industrial and commercial customers   do get charged for reactive power that uses up 
capacity on the grid without doing any real work. Even though the oscilloscope graphs just show 
a shift between the two waveforms, with some   clever math, you can actually separate the real 
power actually being used from the reactive power   that oscillates on the grid into two parts, 
and treat them like they flow through the   grid independently. I’m going to do my best to 
avoid that math here partly because it involves   imaginary numbers but mostly because it’s not 
needed to understand the practical impacts.   (This is already a lot to wrap your head around.) 
But out of that math comes this visualization:   the power triangle. This leg is the 
real power that actually gets consumed,   measured in watts or kilowatts that you’re 
probably used to. This leg is the reactive   power that is returned instead of used, measured 
in volt-amps-reactive or VAR. By convention,   we usually say that inductive devices “consume” 
reactive power and capacitive devices “supply”   it. The hypotenuse of the triangle is the 
apparent power, the total amount of power that   flows through the grid, measured in volt-amps. If 
you divide the real power by the apparent power,   you get this ratio, called the power factor, 
a number that will be important in a minute. Take a look at the distribution transformer that 
connects your home to the grid, and you might see   a rating on the side. That number is not in watts 
or kilowatts like what you might see on a toaster   or microwave, but in kilovolt-amps because it 
includes the flow of real and reactive power.   Large users of electricity, like factories and 
refineries, usually have a low power factor   because they use lots of big induction motors. 
They need comparatively robust and high-capacity   connections to the grid, even if they actually 
consume only a portion of the energy that flows   through. So the electric utility installs a meter 
that can track power factor, or they just come out   every once in a while to measure it, so they can 
put it on the bill. Instead of free returns on   reactive power, like we usually get at our homes, 
those customers have to pay a rental charge on   the power they store, even though it goes right 
back out. But, it’s not just a matter of keeping   track of costs. The stability of the entire grid 
depends on managing the flow of reactive power. If you’ve watched some of my other videos on 
the power grid, you know how important it is to   closely match power generation with demands as 
they go up and down. If not managed carefully,   the frequency of the grid, which needs to stay 
within a very tight tolerance, can deviate. And   if it goes too far, the whole thing can collapse. 
That’s what almost happened to Texas during the   winter storm in 2021. But, it’s possible for the 
grid to collapse even if there’s enough generation   to meet the demand because you still have to move 
that power to where it’s needed over transmission   lines. Engineers use a PV curve to keep an eye 
on this challenge. It relates the power flowing   to a load on the system to the voltage it sees. 
As you would expect, the more power that flows,   the more the voltage drops, since more power 
is lost on the transmission lines on the way   to the load. It’s the same reason the lights dim 
in old houses when the air conditioner kicks on:   current goes up, voltage goes down. If you 
combine Ohm’s law and the power equation,   you can see that the power lost on a transmission 
line is related to the current squared. Double the   amps; quadruple the power lost as heat. But the 
further along this curve that the system operates,   the more dangerous things get. There is a point, 
the nose of the curve, beyond which greater demand   on the system actually reduces the amount of 
power that can be delivered, all while the   voltage continues dropping. The generators may 
have the capacity to supply more power, but it   can’t reach the load because of the limitations of 
the system. Operating below the nose is unstable   because generators lose control of their speed, 
like a rubber tire losing its grip on a road. Infrastructure is expensive, and building new 
power plants and transmission lines always comes   with legal and environmental challenges too, so 
we’re often forced to use the grid to the very   limits of its capacity. But, grid managers 
need to make sure to operate with enough   margin that any contingency, like a generator 
going offline or a transmission line faulting,   doesn’t push the system over the electrical 
cliff. Here’s where power factor comes in.   Loads with lower power factor shift the nose 
of the PV curve down and to the left. That   reduces the margin and lowers the voltages 
in the system for a given power demand,   making a voltage collapse more likely if some 
part of the system goes down. So we use several   ways to supply reactive power to provide 
voltage support and shift the curve back up. Power plants can adjust their operating 
parameters to supply reactive power,   but transmission lines have their own inductance 
that consumes the reactive power as it travels   through. So, it is usually more efficient 
to address the problem on the load side,   and there are several types of infrastructure that 
make this possible. Synchronous condensers are big   motors that aren’t attached to anything. 
Instead of converting electrical power   to mechanical power, they basically spin freely, 
but with some clever circuitry, they can generate   or absorb reactive power from the grid. They 
can also help stabilize fluctuations in the grid   with the inertia of their heavy rotating mass, 
something that is becoming increasingly important   as we transition more to renewable sources 
that use inverters to connect to the network. Another option, and one you’re more likely 
to spot, are shunt capacitor banks connected   across the lines. Sometimes you can see them 
in substations, but many capacitor banks are   installed on poles out in the open for anyone 
to have a look. Like the capacitor in my demo,   they increase the power factor and boost the 
PV curve up. That can actually become a problem   during off-peak hours by boosting the voltage 
above where it should be, so many capacitor banks   are switched on or off depending on system 
conditions. Looking back at the PV curve,   you can see how leaving the capacitors off during 
periods of low demand keeps voltage within limits,   and having them on when demand is high 
provides more margin and more voltage.   Some run on timers to come on during the highest 
demands of the day, and many are operated at a   utility’s discretion to accommodate the varying 
conditions on the grid. They’re usually either   all the way on or all the way off, so deciding 
when to throw the switch is an important one. A third option for reactive power supply, 
called a static VAR compensator or SVC,   addresses that challenge. These use electronics 
to rapidly switch inductors and capacitors on or   off to constantly adjust to conditions in the 
system. That switching happens automatically   and quickly, making them much better suited to 
the dynamic changes that happen on the grid. That’s why Hydro-Quebec had them installed on 
their system in 1989. The long transmission   lines between the hydroelectric power plants in 
the north and the load centers, like Montreal,   in the south require careful control of 
the voltage to avoid instability. But the   geomagnetic storm threw a wrench in the works.  The induced currents in the transformers and along   those transmission lines seriously increased the 
reactive power demand of the system. The resulting   distortions in the voltage and current waveforms 
hadn’t been considered when the equipment was   installed. The SVCs weren’t configured to handle 
the dynamic conditions affecting the system, so   relays designed to protect them tripped, pulling 
the equipment out of service. Without the SVCs,   the voltage on the grid dropped, the frequency 
increased, and chaos ensued. The grid operators   couldn’t disconnect customers fast enough 
to keep things stable, and within seconds,   the rest of the system collapsed. Lots 
of equipment was permanently damaged,   and millions woke up that frigid morning with no 
real power, reactive power, or apparent power,   shutting down basically the entire province for 
half-a-day and requiring costly and expensive   repairs. They learned a lot of lessons that 
day, and adjusted a lot of relay settings   since then. It’s just one of many case studies 
on the importance of understanding and managing   this hopefully a little-less-perplexing 
idea of reactive power on the grid. One of the biggest challenges as renewables become 
a much more significant proportion of electricity   sources is controlling swings in voltage 
that can happen when the sun or wind suddenly   change. And one of the countries preparing 
to meet, at least for short periods of time,   100 percent of electrical demands using renewable 
sources is Australia. One idea they’re exploring I   thought was really cool is repurposing old fossil 
fuel generators into synchronous condensers that   can stabilize those swings, keeping reactive 
power flowing. Pretty creative solution, pretty   cool country. And if you want to see some of the 
coolest parts of it, my friend Sam of Wendover   Productions just kicked off the next season of 
Jet Lag, a travel-based game show. They’re going   across the entire country trying to claim as many 
regions as possible by winning challenges. It’s a   super creative concept in its tenth season, and 
every episode gets released early on Nebula. You probably know about Nebula now. It’s a 
streaming service built by and for independent   creators. There are no studio executives deciding 
what gets the green light, no advertisements,   and no algorithm driving the content into a 
single style. It’s just independent creators   making stuff they're excited about with as 
few barriers and distractions as possible   between you and us. The website just got a huge 
update that completely redesigned the home page,   making it easier to find new stuff 
in addition to your favorites. My videos go live on Nebula before they come 
out here, and my Practical Construction series   was specifically produced for Nebula viewers who 
want to see deeper dives into specific topics. I   know there are a lot of streaming platforms 
out there right now, but there aren’t many   this cheap or where you know your money is 
going to support your favorite creators. And   we have a 40% off deal right now. Pay just 
one time, 30 dollars, for an entire year’s   access at nebula.tv/practical-engineering. 
Or if you have subscription fatigue,   but still want to support what I’m doing, 
you can get a lifetime membership. Pay   once have access to everything Nebula will ever 
offer, including a bunch of very cool originals   coming soon. If you’re with me that independent 
creators are the future of great video,   I hope you’ll consider subscribing. Thank you 
for watching, and let me know what you think!

---

## 43. Every Kind of Bridge Explained in 15 Minutes
**Channel:** Practical Engineering | **Views:** 2.3M | **Date:** 1 year ago | **Duration:** 17:36 | **ID:** DX_zkaK5PaI
**Link:** https://youtube.com/watch?v=DX_zkaK5PaI

### Transcript:
The Earth is pretty cool and all, but many of 
its most magnificent features make it tough   for us to get around. When the topography is too 
wet, steep, treacherous, or prone to disaster,   sometimes the only way forward is up: our 
roadways and walkways and railways break   free from the surface using bridges. A lot of 
the infrastructure we rely on day to day isn’t   necessarily picturesque. It’s not that we can’t 
build exquisite electrical transmission lines   or stunning sanitary sewers. It’s just that we 
rarely want to bear the cost. But bridges are   different. To an enthusiast of constructed works, 
many are downright breathtaking. There are so many   ways to cross a gap, all kindred in function 
but contrary in form. And the typical way that   engineers classify and name them is in how each 
design manages the incredible forces involved.   Like everything in engineering, terminology 
and categories vary. As Alfred Korzybski   said, “The map is not the territory.” But, 
trying to list them all is at least a chance   to learn some new words and see some cool 
bridges. And honestly, I can hardly think   of anything more worthwhile than that. I’m 
Grady, and this is Practical Engineering. One of the simplest structural crossings is the 
beam bridge: just a horizontal member across two  supports. That member can take a variety of forms, 
including a rolled steel beam (sometimes called   a stringer) or a larger steel member fabricated 
from plates (often called a plate girder). Most   modern bridges built as overpasses for grade 
separation between traffic are beam bridges   that use concrete girders. And instead of a group 
of individual beams, many bridges use box girders,   which are essentially closed structural tubes 
that use material more efficiently (but can be   more complicated to construct). Beam bridges 
usually can’t span great distances because   the girders required would be too large. At a 
certain distance, the beams become so heavy,   they can hardly support their own weight, 
let alone the roadway and traffic on top. One way around the challenge of the structural 
members’ self-weight is to use a truss instead   of a girder. A truss is an assembly of smaller 
elements that creates a rigid and lightweight   structure. Unlike a beam, the members of a truss 
don’t typically experience bending forces. The   connections usually aren’t actual hinges that 
permit free rotation, but they are close enough.   So, all the load is axial (along their length) 
in compression or tension. That simplifies the   design process because it’s easier to predict 
the forces within each structural member. The   weight reduction allows trusses to span greater 
distances than solid beams, and there are a wide   variety of arrangements, many with their own 
specific names. In general, a through truss puts   the deck on the bottom level, and a deck truss 
puts it on top, hiding the structural members   below the road. A particularly photogenic 
type of truss is a lenticular truss bridge,   named because they resemble lenses, which 
themselves are named because they resemble   lentils! A Bailey bridge is a kind of temporary 
truss bridge that is designed to be portable   and easy to assemble. They were designed during 
World War II, but Bailey bridges are still used   today as temporary crossings when a bridge fails 
or gets closed for construction. Most covered   bridges are timber truss bridges. Since wood is 
more susceptible to damage from exposure to the   elements, the roof and siding are placed to keep 
the structural elements truss-worthy.  A trestle  bridge is superficially similar to a truss: a 
framework of smaller members. Trestle bridges   don’t have long spans, but rather a continuous 
series of short spans with frequent supports which   are individually called trestles, but sometimes 
the whole bridge is just called a trestle,   so like so many other instances of structural 
terminology, it can be a little confusing. This next bridge type uses a structural feature 
that’s been a favorite of builders for millennia:   the arch. Instead of beams loaded perpendicularly 
or trusses that experience both compressive and   tensile forces, arch bridges use a curved element 
to transfer the bridge’s weight to supports using   compression forces alone. Many of the oldest 
bridges used arches because it was the only   way to span a gap with materials available 
at the time (stone and mortar). Even now,   with the convenience of modern steel and 
concrete, arches are a popular choice for   bridges. They make efficient use of materials 
but can be challenging to construct because   the arch can’t provide its support until it is 
complete. Temporary supports are often required   during construction until the arch is connected 
at its apex from both sides. In stone arches,   the topmost stone is key to keeping the whole 
thing standing, and, of course, it’s called   the keystone. When the arch is below the roadway, 
we call it a deck arch bridge. Vertical supports   transfer the load of the deck onto the arch. The 
area between the deck and arch has a great name:   the spandrel. Open-spandrel bridges use columns 
to transfer loads, and closed-spandrel bridges   use continuous walls. If part of the arch extends 
above the roadway with the deck suspended below,   it’s called a through arch bridge. A moon bridge 
is kind of an exaggerated arch bridge, usually   reserved for pedestrians over narrow canals where 
there’s not enough room for long approaches.   They’re steep, so sometimes you have to use steps 
or ladders to get up to the top and back down. One result of compressing an arch is that it 
creates horizontal forces called thrusts. Arch   bridges usually need strong abutments at either 
side to push against that can withstand the extra   horizontal loads. Alternatively, a tied arch 
bridge uses a chord to connect both sides of   the arch like a bowstring, so it can resist 
the thrust forces. That means a tied arch is   structurally more of a truss than an arch, 
and that provides a lot of opportunities for   creativity. For just one example, a network 
arch bridge uses the tied arch design,   plus criss-crossed suspension cables, to support 
the deck. To tell an arch from a tied arch by eye,   it’s usually enough to look at the supports. If 
the end of each arch sits atop a spindly pier   or some other structure that seems 
insubstantial against horizontal forces,   you can probably bet that they are tied together 
and it’s not a true arch bridge. Similarly,   a rigid-frame bridge integrates the superstructure 
and substructure (in other words, the deck,   supports, and everything else) into a single 
unit. They don’t have to be arched, but many are. Another way to increase the span of a beam bridge 
is to move the supports so that sections of the   deck balance on their center instead of being 
supported at each end. A cantilever bridge   uses beams or trusses that project horizontally, 
balancing most of the structure’s weight above   the supports rather than in the center of the 
span. This is such an effective technique that   the Forth Bridge crossing the Firth of Forth in 
Scotland took the title of longest span in the   world away from the Brooklyn Bridge in 1890 
and held the record for decades. This famous   photograph demonstrates the principle of that 
bridge perfectly: The two central piers bear   the compression loads from the bridge. And, the 
outer-most supports are anchors to provide the   balancing force for each arm. This way, 
you can suspend a load in the middle. The longest bridges take advantage of steel’s 
ability to withstand incredible tension forces   using cable supports. Cable-stayed bridges 
support the deck from above through cables   attached to tall towers or spars. The cables 
(also called stays) form a fan pattern,   giving this type of bridge its unique 
appearance. Depending on the span,   cable-stayed bridges can have one central 
tower or more. Their simplicity allows for   a wide variety of configurations, giving rise 
to some dramatic (and often asymmetric) shapes. For shorter spans, you can combine the benefits 
of a cable-stayed structure with girders to get   an extradosed bridge. Imagine a concrete girder 
bridge that uses internal tendons to keep the   concrete in compression, then just pull those 
tendons out of the girder and attach them to   a short tower. Rather than holding the deck up 
vertically like a cable-stayed bridge, they’re   acting more horizontally to hold the girders in 
compression, giving them the stiffness needed   to support the deck. It’s a relatively new idea 
compared to most of the other designs I’ve listed,   but there are quite a few cool examples 
of extradosed bridges across the globe. Where a cable-stayed bridge attaches the 
deck directly to each tower, a suspension   bridge uses cables or chains to dangle the 
deck below. In a simple suspension bridge,   the cables follow the curve of the deck. 
This is your classic rope bridge. They’re   not very stiff or strong, so simple suspension 
bridges are usually only for pedestrians. A   stressed ribbon bridge takes the concept 
a step further by integrating the cables   into the deck. The cables pull the deck 
into compression, providing stiffness and   stability so it doesn’t sway and bounce. 
This design is also primarily used for   smaller pedestrian bridges because it can’t span 
long distances and the deck sags in the middle. Then you have the suspended deck bridge, the 
design we most associate with the category   with the longest spans in the world. Massive main 
cables or chains dangle the road deck below with   vertical hangers. Suspension bridges are iconic 
structures because of their enormous spans and   slender, graceful appearance. Towers on either 
side prop up the main cables like broomsticks in   a blanket fort. Most of the bridge’s weight 
is transferred into the foundation through   these towers. The rest is transferred into the 
bridge’s abutments through immense anchorages   keeping the cables from pulling out of the ground. 
Alternatively, self-anchored suspension bridges   connect the main cables to the deck on either 
side, compressing it to resist the tension forces.   Because they are so slender and lightweight, 
most suspension bridges require stiffening with   girders or trusses along the deck to reduce 
movement from wind and traffic loads. These   bridges are expensive to build and maintain, so 
they’re really only used when no other structure   will suffice. But you can hardly look at a 
suspended deck bridge without being impressed. Bridges have to support the vehicles and people 
that cross over the deck, but they often have to   accommodate boats and ships passing underneath as 
well. If it’s not feasible to build the bridge and   its approaches high enough, another option is 
just to have it get out of the way when a ship   needs to pass. Moveable bridges come in all shapes 
and sizes. A lot of people call them drawbridges   after their medieval brethren over castle moats. 
A bascule bridge is hinged so the deck can rotate upward.   A swing bridge rotates horizontally 
so a ship can pass on either side.   A vertical lift bridge raises the entire deck upward, keeping 
it horizontal like a table. A transporter bridge   just has a small length of deck that is shuttled 
back and forth across a river. That’s just a few,   and in fact, every moveable bridge is unique 
and customized for a specific location,   so there are some truly interesting 
structures if you keep an eye out. On the other hand, sometimes there’s no need for 
ship passage or a lot of space below, and in that   case, you can just float the bridge right on the 
water. Floating bridges use buoyant supports,   eliminating the need for a foundation. 
These are used in military applications,   but there are permanent examples too. Many use 
hollow concrete structures as pontoons, with   pumps inside to make sure they don’t fill up with 
water and sink. And actually, a lot of bridges   take advantage of buoyancy in their design, 
even if it’s not the main source of support.   A design like this presents a lot of interesting 
engineering challenges, so there aren’t too many   of them. Similarly, the pedestrian bridge at 
Fort de Roovere in the Netherlands (probably   pronounced that wrong) has its deck below the 
water, giving it the nickname of the Moses Bridge. If space or funding is really tight, 
one option to span a small stream is   a low-water crossing. Unlike bridges 
built above the typical flood level,   low-water crossings are designed to be submerged 
when water levels rise. They are most common   in areas prone to flash floods, where runoff 
in streams rises and falls quickly. Ideally,   a crossing would be inaccessible only a few 
times per year during heavy rainstorms. However,   low-water crossings have some disadvantages. For 
one, they can block the passage of fish just like   a dam. And then there’s safety. A significant 
proportion of flood-related fatalities occur when   someone tries to drive a car or truck through 
water overtopping a roadway. Water is heavy.   It takes only a small but swift flow to push a 
vehicle down into a river or creek, which means at   least some of the resources saved by avoiding the 
cost of a higher bridge are often spent to erect   barricades during storms, install automatic 
flood warning systems, and run advertisement   campaigns encouraging motorists never to 
drive through water overtopping a roadway. You may have heard the term viaduct before. 
It’s not so much a specific type of bridge,   but really about the length. Bridges that span a 
wide valley need multiple intermediate supports.   So, a viaduct is really just a long bridge 
with multiple spans that are mostly above   land. There’s really not a lot of agreement on 
what is one and what isn’t. Some are singular   and impressive structures. But many modern cities 
have viaducts that are, although equally amazing   from an engineering standpoint, a little less 
beautiful. So, you’re more likely to hear them   called elevated expressways. And that gets to the 
heart of a topic like this: without listing every   bridge, there’s no true way to list every type 
of bridge. There’s too much nuance, creativity,   and mixing and matching designs. The Phyllis J. 
Tilly bridge in Fort Worth, Texas combines an arch   and stressed ribbons. The Third Millennium Bridge 
in Spain uses a concrete tied arch with suspension   cables holding up the deck which is stiffened 
with box girders. The Yavuz Sultan Selim Bridge   in Turkey combines a cable-stayed and suspension 
design. In some parts of India and Indonesia,   living tree roots are used as simple suspension 
bridges over rivers. There are bridges for   pipelines, bridges for water, bridges for animals, 
and I could go on. But that’s part of the joy of   paying attention to bridges. Once you understand 
the basics, you can start to puzzle out the more   interesting details. Eventually, you’ll see 
the Akashi Kaikyo Bridge on a calendar in   your accountant’s office, and let him know 
it’s a twin-hinged, three-span continuous,   stiffened truss girder suspension bridge with 
a double-tower system.  Or maybe that’s just me. We care a lot about bridges. My previous video 
covered the engineering that goes into vessel   collision design for bridges, focusing on the 
recent collapse of the Francis Scott Key Bridge   in Baltimore that was a huge story in the news 
covered by nearly every major outlet across the   globe. Over 400 sources reported the even from 
every side of the political spectrum. Since it   was so widely reported, there’s a pretty even mix 
between left-leaning, center, and right-leaning   outlets, but if you look at the headlines, you’ll 
see all kinds of ways the story was painted with   political and ideological biases from both sides 
of the aisle. By focusing on different details of   the story - the victims' nationalities, the DEI 
policies of the ship operator, the response by   prominent politicians - the framing can subtly, or 
not-so-subtly, change how you interpret the facts. Seeing all this in one place is possible thanks 
to my sponsor, Ground News. They aggregate major   news stories and add context to make reading the 
news easier and more effective. Every story comes   with a quick visual breakdowns and tags for 
political bias, factuality, and ownership of   the sources backed by ratings from independent 
news monitoring organizations. For this story,   you can see that nearly half of the reporting 
outlets are media conglomerates and just over   half of those outlets have been rated “High 
Factuality.” They also have a feature called   the Blind Spot that shows you stories mainly 
covered by one side of the political spectrum:   stuff you might totally miss if you only 
follow a few main sources for your news. I don’t necessarily agree with how every 
story on the Key Bridge is painted,   but it’s important to me to get a broad 
perspective on issues like this. It’s   not just because I was trying to find 
the right way to tell the story myself,   but because stories like this are how we shape 
our view of the world around us. In that way,   journalism has a lot of power over us, and 
Ground News hands some of that power back to   you. If you’d like a more transparent media 
landscape, they’re offering a huge discount   right now at the link in the description: 40 
percent off the Vantage subscription, which   includes unlimited access to all their features. 
That’s ground dot news slash practicalengineering   or just click the link in the description. Thank 
you for watching, and let me know what you think!

---

## 44. How Bridge Engineers Design Against Ship Collisions
**Channel:** Practical Engineering | **Views:** 1.5M | **Date:** 1 year ago | **Duration:** 28:45 | **ID:** zLOVv09n46g
**Link:** https://youtube.com/watch?v=zLOVv09n46g

### Transcript:
On March 26, 2024 (just a few weeks ago, if you're 
watching this as it comes out), a large container   ship struck one of the main support piers of 
the Francis Scott Key Bridge in Baltimore,   Maryland, collapsing the bridge, killing 
six construction workers, injuring one more,   and seriously disrupting both road and marine 
traffic in the area. There’s a good chance you   saw this in the news, and hopefully you’ve seen 
some of the excellent content already released by   independent creators providing additional context. 
I got a lot of requests to talk about the event,   and I usually prefer to wait to discuss events 
like this until there are more details available   from investigations, but I think it might 
be helpful to provide some context from an   engineering perspective about how we consider 
vessel collisions in the design of bridges   like this one, and why the Francis Scott 
Key bridge may have collapsed. I’m Grady,   and this is Practical Engineering. Today we’re 
talking about vessel collision design for bridges. The Francis Scott Key Bridge was a steel 
arch-shaped continuous through truss bridge.   I’m working on a video that goes into a lot more 
detail about the different kinds of bridges and   how they’re classified, but this bridge had kind 
of a medley of structural styles, so let me hand   it off to our special guest correspondent, 
Road Guy Rob, to break that terminology down. Well, Grady, I'm in Long Beach, California 
today, standing on top of this brand new   bridge that replaced an old arch/truss 
bridge that used to be right there. It   kind of looked like a baby Key Bridge, and the 
Port of Long Beach is happy that it's gone. The Gerald Desmond Bridge was a truss 
bridge. Instead of having one big large beam,   a truss has lots of smaller connected 
structural members all attached together. This creates a rigid structure that's 
much lighter weight than a big heavy beam,   and that makes trusses efficient and clever when 
they work. Both the Key bridge and the old bridge   that used to be here were “through-truss” 
bridges. It's a sort of arch shape,   and the driving deck is suspended below the 
truss, so you sort of drive through the arch,   but it's not an actual arch with like a keystone 
and all the pieces pushing horizontally to hold   each other together. No, this through-truss bridge 
has no hinges or joints at the main supports,   nothing that breaks it up into sections. So 
that's why engineers called the Key bridge a   continuous truss bridge. It's all one big piece, 
and it's all bolted and welded into a single rigid   truss across its entire length. And then that load 
distributes across all three spans of the bridge. Now, the approach roads on each side are 
entirely separate bridges, even though they   link together. They just look like concrete 
roads sitting on top of simple girder spans. Well, you ask, what happened to that baby Key 
bridge in Long Beach? Well, the only way you're   going to see it now is to turn on Grand Theft 
Auto five and look at the fictionalized version   of it immortalized in Los Santos for all time. 
Because when this bridge opened, the port of Long   Beach demolished the old bridge and the last 
scraps of it got all the way back in October. In its place, this new, fancier 
looking cable-stayed bridge,   the Long Beach International Gateway. And what 
the Port of Long Beach did in studying to build   this bridge and the list of improvements they 
came up with might give us some clues what   Baltimore might want to end up doing when 
they replace the Key bridge down the line. And we'll talk about that in just a moment. When the Dali container ship lost power 
and drifted into the southwest pier,   the support collapsed, and most of the truss 
and deck fell with it. Both the southwest and   central spans fell roughly vertically with the 
loss of support from the damaged pier. Part of   the truss on the northwest side separated 
from the unsupported section and rotated   toward the northeast span, taking several 
of the approach spans with it. Thankfully,   the ship had put out a mayday call before 
the impact, allowing police officers at   either end of the bridge to close it to traffic. 
Tragically, it wasn’t enough time to get the crew   of eight construction workers off the structure 
before it fell, six of whom lost their lives. Just dealing with the salvage and removal of 
the steel and concrete debris left over from the   collapse has been a massive undertaking. Within 
a week, engineering teams were on-site measuring,   cutting, lifting, and floating away huge chunks 
of the wreckage in separate salvage operations for   the main bridge, approaches, and the vessel. As of 
this writing, they’re still working hard on it. At   least seven floating cranes were involved, 
including the famous Weeks 533 that pulled   US Airways Flight 1549 from the Hudson River in 
2009. This was essentially a massive Jenga tower:   the order of operations and the precision of 
each cut and each lift mattered. With so much   debris underwater, they had to map it out to 
understand how everything was stacked together.   Access was a major challenge, and the stresses 
in the wreckage were hard to characterize,   so it’s been a slow and deliberate process 
requiring careful planning and tons of skill   to do safely. Fortunately for Baltimore, there 
are large industrial facilities in the port that   can process the thousands of tons of material 
that will ultimately be removed. Of course,   reopening the port to shipping traffic is a huge 
priority. A small channel was marked out under   one of the approach bridges for smaller vessels 
like tug and barges traffic, and the Army Corps   of Engineers is making good progress on opening 
up the main channel, but it isn’t clear when   full-scale operations at the port will be able to 
resume. Shipping traffic isn’t the only traffic   affected either, the bridge carried thousands 
of road vehicles per day that now have to be   re-routed. There is a tunnel under the harbor that 
provides a decent alternate route, but trucks with   hazardous materials aren’t allowed through, 
requiring an enormous detour around the city. It’s been more than a month since the event, 
but it will likely be a year or more before   we get an official report documenting the 
probable cause of the failure. In the US,   events like this are investigated by 
the National Transportation Safety   Board or NTSB. This independent government 
agency is extremely diligent. And often,   diligent also means slow. But events like this 
are how the field of engineering evolves. Human   imagination isn’t limited to past experiences, 
but in many senses, engineering is. We just don’t   have the resources to answer the millions of 
“what ifs” that might coalesce into a tragedy,   so we lean on the hard lessons learned from 
past failures.  When something terrible happens, it’s really important that we collectively get 
to the bottom of why and then make whatever   changes are appropriate to our engineering 
systems to prevent it from happening again. But, at the risk of stating the 
obvious, the failure mode in this   case is pretty clear. You probably don’t need an 
engineer to explain why a massive ship slamming   into a bridge pier would cause that bridge to 
collapse. I think what’s less obvious is how   engineers characterize situations like this so 
that bridges can be designed to withstand them.   Collisions with bridges by barges and ships 
are not a modern problem. Technically they’re   called “allisions” since a bridge isn’t 
moving, but that term is used more in the   maritime industry than by bridge engineers. 
Between 1960 and 2014, there were 35 major   bridge collapses resulting from vessel impacts. 
And, 18 of those were in the US. We just have   such a big network of inland waterways, 
and that means we have a lot of bridges. Two spans of the Queen Isabella Causeway Bridge 
in Texas collapsed in 2001 when barges collided   with one of the piers. A year later, a bridge 
carrying I-40 over the Arkansas River in Oklahoma   was hit by barges when the captain lost control, 
collapsing a major portion of the structure. In   2009, Popp’s Ferry Bridge in Mississippi collapsed 
after being struck by a group of barges. In 2012,   the Eggner’s Ferry Bridge in Kentucky fell 
when a cargo ship tried to go through the   wrong channel. Before any of those, though, 
the Sunshine Skyway Bridge in Florida put a   major focus on the problem. In 1980, a bulk 
carrier ship lost control because of a storm,   crashing into one of the piers and collapsing the 
entire main span of the southbound bridge, killing   35. The event brought a lot of new awareness and 
concern about the safety of bridges over navigable   waterways. But piers aren’t the only parts of a 
bridge at risk from ships. I’ll let Rob explain. The Key bridge got into trouble because 
of a horizontal allision. That's where a   ship moves side to side in the wrong way 
and hits something it's not supposed to. Here in Long Beach, that really wasn't 
their concern, primarily because the old   bridge columns were way inland here, so there 
was no way for a ship to exit the waterway   and hit the column because the column was in 
lots of dirt. And the new replacement bridge   takes no chances at all. Look how much 
farther onshore those columns are now! Now, the Port of Long Beach were far 
more worried of the old Gerald Desmond Bridge   getting hit vertically. The old bridge was 155ft 
tall. That's like a 15 story building. And if that   sounds pretty tall to you, it sounded pretty tall 
to them back in 1968 when they built the bridge.   But as we now know, ships are getting bigger and 
fatter and taller and 155ft wasn't cutting it for   some of the modern ships that were trying to get 
into the back part of the port, where there's a   lot of cranes and action happening over there. 
So the new bridge adds another 50ft, takes it   over 200ft. That's like a 20 story building to 
get up from the waterline to that new bridge. And this new, taller, Long Beach International 
Gateway helps the port scratch off one designation   they didn't want - having the shortest bridge 
over a port in the United States. Well,   that's gone now, and thankfully in a less tragic 
manner than what's happening on the East Coast. In the aftermath of the Sunshine Skyway collapse, 
the federal government and the professional   community, both from the engineering and maritime 
sides, invested a serious amount of time and   investigation into the issue. One culmination was 
updated bridge codes that included requirements   for consideration of vessel collisions. For 
highway bridges in the US, those specifications   are put out by an organization called the American 
Association of State Highway and Transportation   Officials (or AASHTO), but there are similar 
requirements worldwide, including in the Eurocode. A lot of infrastructure is designed for 
worst-case scenarios, but at a certain point,   it just isn’t feasible. This is something 
I’ve talked a lot about in previous videos:   you have to draw a line somewhere that 
balances the benefits and the costs. If   the code required us to design bridges with 
Armageddon meteorite or Godzilla protection,   we just wouldn’t build any bridges. It would be 
too expensive. And that’s kind of true for ship   collisions too. The mass and kinetic energy 
of the cargo vessels today is tough to even   wrap your head around. We just couldn’t afford 
to build bridges if they all had to be capable   of withstanding a worst-case collision. Instead, 
for what engineers call “high consequence, low   probability” events, codes often set the standard 
as some acceptable amount of risk. There’s always   going to be some possibility of an event like 
this, but how much risk are we as a society   willing to bear for the benefit of having easy 
access across navigable waterways? In the U.S.,   that answer, at least according to AASHTO for 
critical structures like the Key Bridge, is   0.01 percent probability in a given year. For some 
perspective, it’s roughly the chance of rolling a   Yahtzee (five-of-a-kind) in a single throw. But 
it’s an annual probability, so you have to roll   the dice once every year. If you did it forever, 
it would average out to once every 10,000 years,   but that doesn’t mean it couldn’t happen twice 
in a row. So an engineer’s job is to design   the structure not to survive in a worst-case 
scenario but to have a very low probability of   collapsing from a vessel impact. And there’s 
a lot that goes into figuring that out. This is the general formula for the annual 
probability of bridge collapse due to a ship   collision. You have all these factors that get 
multiplied together. The first one is just the   number of ships that pass under the bridge in a 
year. And there’s a growth factor in there for how   that number might change over time. Then there’s 
what’s called the probability of vessel aberrancy;   basically, the chance that one of those ships 
loses control. AASHTO has some baseline numbers   for this based on long-term accident statistics in 
the US, and the designer can apply some correction   factors based on site-specific issues like water 
currents and navigation aids. Then, there’s the   geometric probability of a collision if a ship 
does lose control. When a vessel is aberrant,   you don’t know which way it’s going to 
head. This gets a little complicated,   but if you’re familiar with normal distributions 
it will make perfect sense. You can plot a normal   distribution curve centered on the transit path 
with one standard deviation equal to the length   of the aberrant ship to give you an approximation 
of where it might end up. The area under that   curve that intersects with the bridge piers is the 
probability that the ship will impact the bridge   if it loses control. And this is really the first 
knob an engineer can turn to reduce the risk,   because the farther the piers are from 
the transit path, the lower the geometric   probability of a collision. And this factor can 
be modified if ships have tethered tugs to assist   with staying in the channel, something that 
wasn’t required in Baltimore at the Key Bridge. But, even if there is a collision, that doesn’t 
necessarily mean the bridge will collapse. This   is where the structural engineering comes into 
play. The probability of collapse depends both   on the lateral strength of the pier and 
the impact force from the collision. But,   that force isn’t as simple as putting a 
weight on a scale. It’s time-dependent,   and it varies according to the size and type 
of vessel, its speed, the amount of ballast,   the angle of the collision, and a lot more. 
Usually, we boil that down to an equivalent   static load. And based on some testing, 
this is the equation most engineers use.   It’s just based on the deadweight tonnage 
(basically how much the ship can carry) and   its velocity. It’s interesting that they settled 
on deadweight, which doesn’t include the weight   of the ship itself. But again, this analysis is 
pretty complicated, especially because you have   to do it for every discrete grouping of vessel 
size and bridge component, so some simplifications   make sense, and since this one assumes every ship 
is fully loaded, it’s relatively conservative. Just for illustration, the ship that hit the 
Sunshine Skyway Bridge had a deadweight of   34,000 tonnes. The NTSB report doesn’t estimate 
the speed at which it hit the bridge, but let’s   say around 5 knots. That would be equivalent to 
a static force of around 56 meganewtons or 13   million pounds if the ship was fully loaded, which 
it wasn’t (but there’s no way to account for that   in this equation). The Dali has a deadweight of 
117,000 tonnes and was traveling at roughly 5   knots on impact. That’s equivalent to more 
than 100 meganewtons or 24 million pounds,   again, assuming the ship was fully loaded (which, 
again, it wasn’t). But you can validate this with   some back-of-the-envelope physics. Force 
is equal to mass times acceleration. We   know the mass of the ship and its cargo from 
records: about 112,000 metric tons. To decelerate   that mass from 5 knots to a standstill over 
the course of, let’s say, 4 seconds requires,   roughly, a force of 72 meganewtons or 16 
million pounds. Even as a rough guess,   that is a staggering number. It’s 5 SpaceX 
Starships pointed at a single bridge pier. Designing a bridge to handle these forces 
is obviously complicated. It’s not just the   pier itself that has to survive, but every 
element of the bridge along the entire load path,   including the foundation, and (assuming the pier 
isn’t perfectly rigid), the superstructure too.   Again, it’s not impossible to design, but it 
gets pricey fast, which is why designers have   more knobs to turn to meet the code than just 
the strength of the bridge itself. One of those   knobs is pier protection systems. Fenders can be 
installed to soften the blow of a ship impact,   but for ships of this size, they would have to 
be enormous. Islands can be built around piers   to force ships aground before the hit the bridge. 
But islands create environmental problems because   of the fill placed on the river bottom, plus they 
get really big for deeper channels, so the bridge   span has to be wider to keep the channel from 
being blocked. Islands can even affect currents   in the water and the bridge structure, creating 
additional load on the foundation as they settle   after construction. Another commonly used 
protection structure is called a dolphin. This   is usually a circular construction of driven sheet 
piles, filled with sand or concrete. Dolphins can   slow a ship, stop it altogether, or redirect 
it away from critical bridge elements like   piers. The new Sunshine Skyway Bridge used islands 
and dolphins to protect the rebuilt span, and   actually, the Key Bridge had four dolphins, one on 
either side of each main support. Unfortunately,   because it came at an angle, the Dali slipped 
past the protection when it lost control. It’s important to point out that everything 
I’ve discussed is a modern look at how engineers   consider vessel impacts to bridges. When the 
Francis Scott Key Bridge was finished in 1977,   there were no requirements like this, and 
the bridge never had a major rehabilitation   or repair that would have triggered adherence 
to the newer codes. Container ships the size   of Dali didn’t even exist until around 
2006. And we don’t know what the ships   of the future will look like. It’s easy 
to say with hindsight that a bridge like   this should have been better protected against 
errant ships, but if you say it for this one,   you really have to say it for all the bridges 
that see similar maritime traffic. And that   represents an enormous investment of resources 
for, potentially, not a lot of benefit to the   public, given how rare these situations are. 
That’s not me saying it shouldn’t be done;   it’s just me saying that a decision like that 
is a lot more complicated than it might seem. I   don’t expect we’ll see bridge design code changes 
come out of this event, but vessel collisions will   certainly be on the minds of the designers for the 
replacement in Baltimore. I’ll let Rob explain. When you take a look at photos of the Key Bridge, 
it looks like Maryland was doing a good job taking   care of their bridge. So if the NTSB report comes 
back and says the bridge was in good shape, it's   100% the ship that's at fault, well, I don't think 
any of us are going to be really that shocked. But for the old Gerald Desmond Bridge here 
in Long Beach, that used to be right here,   well, the environmental impact report, where they 
studied to build this new replacement bridge, the   port staff really didn't seem too concerned about 
a maritime navigation failure. Of a structural   failure? Let's just say engineers scored bridges 
out of 100 points. So you have a brand new bridge,   it gets 100 points. On that scale, the old 
Gerald Desmond Bridge that was right here   scored a 43. I mean, anything below 80 points, 
you get federal money to work on the bridge   to try to rehab it and get it back into good 
shape. And anything, anything under 50 points,   it's so bad the federal government starts throwing 
money in trying to help you replace the bridge. That's how bad off the Gerald Desmond Bridge was. 
Salt from the air of the sea and decades of it   sitting above sea water and all of that, just nice 
salt in the air, eating away at the paint. Well,   that paint was rated very poor on the 
old Gerald Desmond Bridge. And, you know,   paint protects all the bridge members, all the 
metal from rusting out. And as Grady points out,   every single member of a truss is 
really important if you, you know,   want the bridge to stay in good 
shape and not fall down, right? Engineers also conducted a load analysis. 
They tested to see as trucks drove over it,   how the bridge was holding up. And they found 
members of the arch main span were overstressed   for all design trucks. So that didn't matter 
if you drove a big truck or a little truck.   They were all causing problems with the bridge. 
And the concrete that those trucks drove on? It   was all cracking up. It was rated critical. The 
port had to install big nets to catch big chunks   of pavement that were falling off the bridge 
and could hit somebody on the head down here. So, Long Beach had four objectives that this new 
bridge needed to meet in order to build it. And   those goals may mirror some of the ones Baltimore 
may want to have when building their replacement   bridge. 1. This bridge had to have a design 
life of 100 years. Say, stay structurally sound   for that long. 2. Long Beach wanted to reduce the 
approach grades on both sides, even getting up to   155ft before. Sometimes you were driving up a 6% 
grade and now that this thing is over 200 ft high,   that would be way too steep. So they instead 
built these huge freeway viaducts that go on   and on for like a quarter of a mile to lift people 
and trucks gently up to that new bridge height.   Baltimore's bridge already has some very long 
approaches to it, so I don't know whether they're   going to replace the, uh, ramps approaching the 
bridge or not. It'll be interesting to see what   they end up deciding to do. 3. Provide sufficient 
roadway capacity to handle future car and truck   traffic. The old bridge here was two lanes 
in each direction. Four lanes. This widens   it to six. The Key bridge in Baltimore was also 
only four lanes. But this bridge handles twice   the traffic every day. You know, compared to 
the key bridge back when it was open, right? And both the Key Bridge and the old Gerald 
Desmond Bridge had no shoulders for emergency   vehicles and stalled cars to pull off to the 
side. And as you can see, the new bridge has   these excellent shoulders on both the outside 
and the inside of travel lanes. So that makes   the road a lot safer, because you're not going to 
run into the back of a stalled truck in the dark. It's also a lot safer if you're not in your 
car, because this bridge has a way you can   cross it without being in a car. They've added 
this 12ft wide pedestrian and bicycle pathway,   which is about 12ft wider than what they 
had before. Used to be on the old bridge,   The only way across was inside a car. It's a 
good start, certainly not perfect. Right now,   the path just hits this gate and stops. The city 
of LA owns the next harbor bridge down that way.   It's called the Vincent Thomas Bridge. It's also 
old, so it doesn't have a pedestrian walkway,   so this pathway sort of just ends at the 
city limit because there's nowhere for it   to go. But adding in a multi-use path like 
this one onto the new Key Bridge would be   such a no-brainer. It could take a four mile bike 
ride from like, Hawkins Point to Sparrows Point,   down from four miles with the bridge 
path from 22 miles right now, without it. And finally the fourth goal: providing vertical 
clearance for new generation of larger vessels,   which the new bridge certainly has. 
And that must make the port very happy.   And I'm willing to bet that Baltimore will 
take that goal and maybe turn it on its side   and talk about horizontal clearance and insist on 
a design that eliminates the risk of an allision,   like what happened on March 26th 
from ever happening again, Grady. Thanks Rob. If you love deep dives 
into transportation infrastructure,   go check out his channel after this. But, 
it’s important to point out that this wasn’t   just a bridge failure; it was a bridge failure 
precipitated by a maritime navigation failure.   Obviously, engineers who design bridges 
don’t have a lot of say in the redundancies,   safety standards, and navigation requirements 
of the vessels that pass underneath them. But   if you look at the whole context of this tragedy 
and ask, “How can our resources best be used to   prevent something like this from happening 
again?”, reducing the probability of a ship   this size losing control has to be included with 
the structural solutions like pier protection   systems. I don’t know a lot about that stuff, 
so I couldn’t tell you what that might include,   but I’m sure NTSB will have some recommendations 
when their report eventually comes out. Having   tugs accompany large ships while they 
traverse lightly protected bridges seems   like a prudent risk reduction measure, but 
that’s just coming from a civil engineer. And, speaking of risk reduction, I have to say 
that using risk analysis as a tool for design   is really not that satisfying. We humans are 
notoriously bad at understanding probabilities   and risks, and engineers are not that great 
at communicating what they mean to people   who don’t speak that language. That’s how we get 
confusing terminology like the hundred-year flood.   And it’s unsettling to come face-to-face with 
the idea that, even if our bridges are designed   and built to code, there’s still a chance of 
something like this. Everything’s a tradeoff,   but the people driving over the bridge (or working 
on it) had no direct say in where the line was   drawn or whether it applied retroactively, even as 
ships got bigger and bigger. But I hope it’s clear   why we do it this way. The question isn’t “Can we 
design bridges to be safer?” The answer to that   is always “yes.” The real question is, “How much 
risk can we tolerate?” or put in a different way,   “How much are we willing to spend on any 
incremental increase in safety?” Because the   answers to those questions are much more complex 
and nuanced. And if all bridges were required   to survive worst-case collisions with ships like 
Dali, we would just have a lot fewer bridges. But   sometimes it takes an event like this to remind 
us that risks aren’t just small numbers on a piece   of paper. They represent real consequences, and 
my heart goes out to the families of the victims   affected by this event. I hope we can honor them 
by learning from it and making improvements,   both to our infrastructure and our maritime 
systems, so that it doesn’t happen again. The Key Bridge collapse is a really interesting 
case study because it combines two really   different areas of understanding. Obviously, 
I can approach it from the bridge engineering   perspective, but there’s just as much, if 
not more, to understand from the maritime   side. Ships and marine navigation are 
literally a whole different world,   and my friend Sam from Wendover Productions 
has an awesome video specifically about   the crazy sophistication of the commercial 
fishing industry. I find it so fascinating   to learn about the little details behind 
industries I know nothing about, so honestly,   this entire series, “The Logistics of X” is 
so good, and it is only available on Nebula. You probably know about Nebula now, even if 
you’re not subscribed. It’s a streaming service   built by and for independent creators. No studio 
executives deciding what gets the green light,   no advertisements, and no algorithm driving 
the content into a single style. It’s just   independent creators making stuff their excited 
about with a few barriers and distractions as   possible between you and us. The website just 
got a huge update that completely redesigned   the home page, making it easier to find 
new stuff in addition to your favorites. My videos go live on Nebula before they come 
out here, and my Practical Construction series   was specifically produced for Nebula viewers who 
want to see deeper dives into specific topics.   I know there are a lot of streaming platforms 
out there right now, and no one wants another   monthly cost to keep track of, but I also know 
that if you’re watching a show like this to end,   there is a ton of other stuff on Nebula that 
you’re going to enjoy as well. So I’ve made   it dead simple: click the link below and you’ll 
get 40% off an annual plan. Pay just one time,   30 dollars, for an entire year’s access at 
nebula.tv/practical-engineering. Or if you have   subscription fatigue, but still want to support 
what I’m doing, you can get a lifetime membership.   Pay once and have access for as long as you 
and Nebula last. Hopefully that’s a long   time! If you’re with me that independent 
creators are the future of great video,   I hope you’ll consider subscribing. Thank you 
for watching, and let me know what you think!

---

## 45. Connecting Solar to the Grid is Harder Than You Think
**Channel:** Practical Engineering | **Views:** 2.0M | **Date:** 1 year ago | **Duration:** 18:48 | **ID:** 7G4ipM2qjfw
**Link:** https://youtube.com/watch?v=7G4ipM2qjfw

### Transcript:
On June 4, 2022, a small piece of equipment 
(called a lightning arrestor) at a power   plant in Odessa, Texas failed, causing 
part of the plant to trip offline. It   was a fairly typical fault that happens 
from time to time on the grid. There’s a   lot of equipment involved in producing and 
delivering electricity over vast distances,   and every once in a while, things 
break. Breakers isolate the problem,   and we have reserves that can pick up the slack. 
But this fault was a little bit different. Within seconds of that one little short 
circuit at a power plant in Odessa,   the entire Texas grid unexpectedly lost 2,500 
megawatts of generation capacity (roughly 5%   of the total demand), mainly from solar plants 
spread throughout the state. For some reason,   a single 300-megawatt fault at a single power 
plant magnified into a loss of two-and-a-half   gigawatts, dropping the system frequency to 
59.7 hertz. The event nearly exceeded Texas’s   “Resource Loss Protection Criteria,” which 
is minimum loss of power that requires having   redundancy measures in place. Another 
fault in the system could have required   disconnecting customers to reduce demand. 
In other words, it was almost an emergency. If you lived in Texas at the time, you 
probably didn’t notice anything unusual,   but this relatively innocuous event sent alarm 
bells ringing through the power industry.   Solar plants, large-scale batteries, and wind 
turbines don’t produce power like conventional   thermal power plants that make up such a big 
part of the grid. The investigation into the   2022 Odessa disturbance found that it wasn’t 
equipment failures that caused all the solar   plants to drop so much production all at once, 
at least not in the traditional sense. Instead,   a wide variety of algorithms and configuration 
settings in the power conversion equipment   reacted in unexpected ways when they 
sensed that initial disturbance. The failure happened just before noon on 
a sunny summer day, so solar plants around   the state were at peak output, representing 
about 16% of the total power generation on the   grid. That might seem high, but there have 
already been times when solar was powering   more than a third of Texas’s grid, and that 
number is only going up. The portion of the   grid comprised of solar power is climbing 
rapidly every year, and not just in Texas,   but worldwide. So the engineering challenges in 
getting these new sources of power to play nicely   with the grid that wasn’t really built for them 
are only going to become more important. And,   of course, I have some demos set up in the garage 
to help explain. I’m Grady and this is Practical   Engineering. In today’s episode, we’re talking 
about inverter-based resources on the grid. Solar panels and batteries work on direct current, 
DC. If you measure the voltage coming out,   it’s a relatively constant number. This 
is actually kind of true for wind turbines   as well. Of course, they are large spinning 
machines, similar to the generators in coal   or natural gas plants. But unlike in thermal 
power plants that can provide a smooth and   consistent source of power through a 
steam boiler, winds vary a lot. So,   it’s usually more efficient to let the turbine 
speed vary to optimize the transfer of energy from   the wind into the blades. There are quite 
a few ways to do this, but in most cases,   you get a variable-speed alternating current from 
the turbine. Since this AC doesn’t match the grid,   it’s easier to first convert it to DC. 
So you have this class of energy sources,   mostly renewables, that output DC, but the grid 
doesn’t work on DC (at least not most of it). Nearly all bulk power infrastructure, including 
the power that makes it into your house,   uses an alternating current. I won’t go 
into the Tesla versus Edison debate here,   but the biggest benefit of an AC grid is that 
we can use relatively simple and inexpensive   equipment (transformers) to change the voltage 
along the way. That provides flexibility between   insulation requirements and the efficiency of 
long-distance transmission. So we have to convert,   or more specifically invert, the DC power from 
renewable sources onto the AC grid. In fact,   batteries, solar panels, and most wind turbines 
are collectively known to power professionals as   “inverter-based resources” because they are so 
different from their counterparts. Here’s why. The oldest inverters were mechanical devices: a 
motor connected to a generator. This is pretty   simple to show. I have a battery-powered 
drill coupled to a synchronous motor. When   I pull the trigger, the drill motor spins the 
synchronous motor, generating a nice sine wave   we can see on the oscilloscope. Maybe you 
can see the disadvantages here. For one,   this is not very efficient. There are losses in 
each step of converting electricity to mechanical   energy and then back into electrical energy on 
the other side. Also, the frequency depends on   the speed of the motor, which is not always 
a simple matter to control. So these days,   most inverters use solid-state electronic 
circuits, and look what I found in my garage. These are practically ubiquitous these 
days, partly because cars use a DC system,   and it’s convenient to power AC devices from 
them. I just hook it up to the battery, and   get nice clean power from the other end…  haha just 
kidding. These cheap inverters definitely output   alternating current, but often in a way that 
barely resembles a sine wave. Connecting a load   to the device smooths it out a bit, but not much. 
That’s because of what’s happening under the hood.   In essence, switches in the inverter turn on and 
off, creating pulses of power. By controlling the   timing of the pulses, you can adjust the average 
current flowing out of the inverter to swing up   and down into an approximate sine wave. Cheaper 
inverters just use a few switches to create a   roughly wave-like signal. More sophisticated 
inverters can flip the switches much more quickly,   smoothing the curve into something closer to a 
sine wave. This is called pulse width modulation.   Boost the voltage on the way in or the way out, 
add some filters to smooth out the choppiness of   the pulses, and that’s how you get a battery 
to run an AC device… but it’s not quite how   you get a solar panel to send power into the 
grid. There is a lot more to this equipment. For one, look at the waveform of my inverter and 
the one from the grid. They’re similar enough,   but they’re definitely not a match. Even the 
frequency is a little bit off. I will not be   making an interconnection here, since I don’t have 
a permit from the utility, but even if I did, this   inverter would let out the magic smoke. A grid-tie 
inverter has to be able to both synchronize with   the phase and frequency of the grid and be able 
to vary the voltage of the waveform to control how   much current is flowing into or out of the device. 
The synchronization part often involves a circuit   called a phase-locked loop. The inverter senses 
the voltage of the grid and sets the timing of all   those little switches accordingly to match what 
it sees. So, these are often called grid-following   inverters. They synchronize to the grid frequency 
and phase and only vary the voltage to control the   flow of power. And that hints at one of their 
challenges: they only work when the grid is up. I’ve done a video all about black starts, 
so check that out after this if you want   to learn more, but (in general), 
inverter-based resources like solar,   wind, and batteries can only follow what’s 
already on the grid. When the system’s down,   they are too, regardless of whether the sun’s 
shining or the wind’s blowing. That’s why   most grid-tied solar systems on houses 
can’t give you power during an outage. There’s another interesting thing that inverters 
do for solar panels, and I can show you how it   works in my driveway.   I have a solar panel 
hooked up to a variable resistor, and I’m  measuring the voltage and current produced by 
the panel. You can see as I lower the resistance,   the output voltage of the panel goes down and 
the current it supplies goes up. But this isn’t a   linear effect. I recorded the voltage and current 
over the full range, and multiplied them together   to get the power output. If you graph the power as 
a function of voltage, you get this shape. And you   can see there’s an optimum resistance that gets 
you the most power out of the panel. It’s called   the maximum power point. If you deviate on either 
side of it, you get less power out. In other   words, you’re leaving power on the table. You’re 
not taking full advantage of the panel’s capacity. What’s even more challenging is that point 
changes depending on the temperature of the   panel and the amount of sun hitting it. I 
ran this test again with a few more clouds,   and you can see how the graph changes. So nearly 
all large solar photovoltaic installations use   what’s called a Maximum Power Point Tracker (or 
MPPT) that essentially adjusts the resistance to   follow that point as it changes with sunniness 
and temperature. It’s really a separate device   from the inverter, but often they’re located 
right next to each other or inside the same   housing. Even this panel came with a charge 
controller that has this MPPT function,   and you can see it adjusting the flow of 
current to constantly try and stay at the   peak of the curve while it charges this battery. 
These can be used for an entire installation,   but in many cases, each panel or group 
of panels gets its own MPPT because that   curve is just a little bit different 
for each one. Tracking the peak power   output individually can often squeeze a 
little more capacity out of the system. Squeezing out capacity is essential to address 
another challenge associated with inverter-based   resources on the grid: frequency.    The rate at 
which the voltage and current on the grid swing back and forth is an important measure of how 
well generation and demand are balanced. If demand   outstrips the generation capacity, the frequency 
of the grid slows down. Lots of equipment, both on   the generation side and the stuff we plug in, is 
designed to rely on a stable grid frequency, so if   it deviates too far, stuff goes wrong: Devices 
malfunction, motors can overheat, generators   get out of sync, and more. It’s so important 
that rather than let the frequency get too far   out of whack, grid operators will disconnect 
customers to get electrical demands back in   balance with the available supply of power, called 
an under-frequency load shed. Things go wrong on   the grid all the time, so generators have to be 
able to make up for contingencies to keep the   frequency stable. Here’s the quintessential 
example: an unexpected loss of generation. Say a generator trips offline, maybe because of a 
failed lighting arrestor like the Odessa example.   The system frequency immediately starts dropping, 
since power demand now exceeds the generation. And   the frequency will keep dropping unless we inject 
more power into the system. The first part of   that, called Primary Frequency Response, usually 
comes from automatic governors in power plants.   If we do it fast enough, the frequency will reach 
a low point, called the nadir (NAY-dur), and then   recover to the nominal value. The nadir is a 
critical point, because if it gets too low,   the grid will have to shed load in order to 
recover. The other important value is called   the rate-of-change-of-frequency, basically 
the slope of this line. It determines how much   time is available to get more power into the 
system before the frequency gets too low,   and there are several factors that play into it: 
How much generation was lost in the first place,   how quickly we can respond, and how much inertia 
there is on the grid. Thermal power plants that   traditionally make up the bulk of generating 
capacity are gigantic spinning machines. They’re   basically a bunch of synchronized flywheels. 
That kinetic energy helps keep them spinning   during a disturbance, reducing the slope 
of the frequency during an unexpected loss. Maybe you can see the problem with a simple 
grid-following inverter. It’s locked in phase   with the frequency, even if that frequency 
is wrong. And it has no physical inertia to   help arrest a deviation in frequency. If we 
keep everything the same and just increase   the share of inverter-based resources, any 
loss of generation will mean a steeper slope,   reducing the time available to get backup 
supplies onto the grid before it’s forced   to shed load. Larger renewable plants, like 
solar and wind farms, are increasingly required   to participate in primary frequency response, 
injecting power into the grid immediately when   the frequency drops. And some inverters can even 
create synthetic inertia that mimics a turbine’s   physical response to changes in frequency. 
But there’s another challenge to this. Dealing with an over-frequency event is relatively 
straightforward: just reduce the amount of energy   you’re sending into the grid. But, response 
to an under-frequency event requires you to   have more energy to inject. In other words, you 
have to run the plant below its maximum capacity,   just in case it gets called on during 
an unexpected loss somewhere else in   the system. For a power company, that means 
leaving money on the table, so in most places,   the energy markets are set up to pay power plants 
to maintain a certain level of reserve capacity,   either through operating below maximum output 
or including battery storage in the plant. The last big thing that inverter-based resources 
have to manage is faults. Of course, you need   protective systems that can de-energize solar or 
wind resources when conditions on the grid could   lead to damage. These are expensive projects, and 
there’s almost no limit to the things that can go   wrong, requiring costly repairs or replacement. 
But, for the stability of the grid, you can’t   have those protective systems being so sensitive 
that they trip at the hint of something unusual,   like what happened in Odessa. This concept 
is usually referred to as “ride-through.”   Especially for under-frequency events, 
you need inverters to continue supplying   power to the grid to provide support. If 
they trip offline, or even reduce power,   in response to a disturbance, it can lead to 
a cascading outage. This is kind of a tug of   war between owners trying to protect their 
equipment and grid operators saying, “Hey,   faults happen, and we need you not to shut 
the whole system down when they do.” And   reliability requirements are getting 
more specific as the equipment evolves,   because every manufacturer has their own 
flavor of protective settings and algorithms. As inverter-based resources continue to grow 
rapidly in proportion to the overall generation   portfolio, their engineering challenges are only 
becoming more important. We talked about a few   of the big ones: lack of black start ability, low 
inertia, and performance during disturbances. And   there are a lot more. But inverters also provide 
a lot of opportunities. They’re really powerful   devices, and the technology is improving quickly. 
They can chop up power basically however you want,   and they aren’t constrained by the physical 
limitations of large generating plants. So   they can respond more quickly, and, unlike 
physical inertia that will eventually peter out,   inverters can provide a sustained response. 
There are even grid-forming inverters that,   unlike their grid-following brethren, can 
black start or support an isolated island   without the need for a functioning grid to rely 
on. We’re in the growing pains stage right now,   working out the bugs that these new 
types of energy generation create,   but if you pay attention to what’s happening in 
the industry, it’s mostly good news. A lot of   people from all sides of the industry are working 
really hard on these engineering challenges so   that we’ll soon come out with a more reliable, 
sustainable, and resilient grid on the other end. I build a lot of homemade demonstrations 
for videos like this one, and I hope it   comes across how much joy it gives me. I love 
the challenge of making something useful with   constraints on budget and tools. But I’ve 
never built a hot air balloon! One of my   fellow creators who runs the Neo channel 
just released a video on this incredible   story of two families escaping East Germany 
in maybe the most creative way possible. I don’t know about you, but I have to say that 
almost everything I watch these days is produced   by independent creators. There’s just something 
really authentic and original about content that   hasn’t had to go through 5 levels of studio 
executives before it gets made. Neo’s episode   on The Balloon Escape is a perfect example. Just 
a fascinating story about homemade engineering,   including an interview with one of the 
men who made the attempt, all set to the   beautiful animations they’re known for. And, if 
you want to see it, it’s only available on Nebula. You probably know about Nebula now, even if 
you’re not subscribed. It’s a streaming service   built by and for independent creators. No studio 
executives deciding what gets the green light,   no algorithm driving the content into 
a single style, and no ads getting in   the way. We just released a huge update 
that completely redesigned the home page,   making it easier to find new stuff in addition 
to your favorites. There's tons of originals, and we’re always adding creators,   so the new categories can help you 
discover content related to your interests. My videos go live on Nebula before they 
come out here, and my Practical Construction   series, where I embedded on a construction 
site for a year, was specifically produced   for Nebula viewers who want to see deeper dives 
into specific topics. I know there are a lot of   streaming platforms out there right now, and no 
one wants another monthly cost to keep track of,   but I also know that if you’re watching a 
show like this to end, there is a ton of   other stuff on Nebula that you’re going to 
enjoy as well. So I’ve made it dead simple:   click the link below and you’ll get 40% off an 
annual plan. That means you pay just one time,   30 dollars, for an entire year’s access at 
nebula.tv/practical-engineering. Or if you have   subscription fatigue, but still want to support 
what I’m doing, you can get a lifetime membership.   Pay once and have access for as long as you 
and Nebula last. Hopefully that’s a long   time! If you’re with me that independent 
creators are the future of great video,   I hope you’ll consider subscribing. Thank you 
for watching, and let me know what you think!

---

## 46. Why Fish Ladders (Mostly) Work
**Channel:** Practical Engineering | **Views:** 1.5M | **Date:** 1 year ago | **Duration:** 16:18 | **ID:** MonfznEl1hk
**Link:** https://youtube.com/watch?v=MonfznEl1hk

### Transcript:
Building a dam imparts a stupendous change
to the environment, and as with any change, there are winners and losers. The winners are usually us, people, through
hydropower generation, protection from flooding, irrigation for farming, and a stable water
supply for populated areas. But, we've known for a long time, probably
since we started building dams in the first place, that many of the losers are fish (especially
migratory fish) through fragmentation of their habitat. Even in 1890, the state of Washington in the
US had laws on the books requiring consideration of fish when building dams. And, not just consideration, but specific
infrastructure that would allow fish around a dam if they were quote-unquote “wont to
ascend.” I recently took a tour of McNary Dam on the
Columbia River in Washington (operated and maintained by the U.S. Army Corps of Engineers,
Walla Walla District) and an aquatic research laboratory at the Pacific Northwest National
Lab to learn more about the ways we balance our own needs with those of the aquatic wildlife
impacted by the infrastructure we build. You should check out that video after this
one if you want to see the whole tour. But one of the biggest pieces to that puzzle
was the enormous fish ladders that allowed salmon and other migratory fish to swim up
and over the dam. And it got me wondering: how do engineers
design a structure like this? So this video is a follow-up, a chance to
dive a little bit deeper into the intersection between engineering and wildlife. I'm Grady, and this is Practical Engineering. Today we're talking about fishways. You've probably seen a fish ladder before,
but if you haven't, this one on the Oregon side of McNary Dam is just one of many designs. The way it works is simple in practice: adult
fish swim upstream toward the dam. The goal is that they don't even realize the
dam is there. They simply continue upstream through the
fishway and out into the forebay on the other side. Water flows in one direction—fish flow in
the other. But, designing a fishway isn't simple at all. In a way, it's like engineering life support
systems for manned space missions: all the design criteria are biological. How fast can fish swim, and for how long? How are they motivated? How high can they jump? What temperature, dissolved oxygen, pH, and
salinity can they handle? And how do all these factors vary across seasons
and species? These are difficult questions to answer, and
in fact, a big part of my tour at the Pacific Northwest National Laboratory was all about
how scientists study exactly the limits and preferences of migratory fish. I saw the wide variety of tracking systems
they use to observe the behaviors of fish in the wild and lots of different ways they
study fish in a lab as well. From research like that and decades of trial
and error with the fish passage systems in the real world, engineers and biologists have
started to zero in on a few designs that work best. All fish are different, which means every
fishway needs to be specially designed for the particular species that they handle. At McNary, that mainly means salmonids, a
group of fish species that spend most of their adult lives in the ocean but return to shallow
freshwater headstreams to reproduce. Fortunately, NOAA Fisheries has a detailed
Anadromous Salmonid Design Manual that boils a lot of this knowledge down. And I’ve built a scale model of a few fish
ladder designs in the garage to show you how they work. Salmon encounter all kinds of obstacles in
natural streams and rivers, even ignoring the human-made ones. They're quite capable of moving upstream in
a wide variety of conditions like rapids, small waterfalls and even the presence of
hungry bears. Their species literally depends on it. So, the goal of a salmon fish ladder is to
mimic natural conditions, to trick the salmon into thinking they're simply making their
way up a section of the river, if a somewhat steep and concrete one, without delay, stress,
or injury. Part of that trick is in the flow rate. In fact, the flow of water through a fishway
is one of the most essential parts of the design. And like every engineering decision, it’s
a balance. Every drop of water that flows through a fish
ladder is a drop that isn't stored behind the dam, so it can't be used for hydropower
or water supply. But the flow of water is obviously important
to the fish, too. If the flow velocity is too high, the fish
struggle to swim against it. And if it’s too low, there might not be
enough water to swim through. But, fish not only need specific flow to swim
through; they also need it to navigate. If flows through a ladder are too low, fish
can become disoriented trying to find which way is upstream. And that’s especially true at the entrance. A dam stretches the entire width of a channel,
but the entrance to a fish ladder usually doesn’t, so there has to be some way to
draw them to the entrance. That’s called attraction flow. Salmon use the sound and turbulence of flowing
water to know which direction to swim, so a big part of fish ladder design is simply
encouraging the fish inside. In fact, the flow of water through the ladder
itself is often not enough for attraction, so many fish ladders have auxiliary water
systems. At McNary, two enormous pumps draw water from
the tail race of the dam up and into the entrance channel just so it can fall back down, creating
the sound and hydraulic conditions required for salmon to find their way in. In addition, a huge valve and conduit system
under the fish ladder pulls additional water from the forebay and releases it at an intermediate
point down the ladder. Both of these systems provide some redundancy
(since no piece of infrastructure can operate 24/7) and operators some control over the
conditions along the entire length of the fishway, ensuring it can always mimic ideal
conditions for the fish. But once they’re in, another challenge begins. Dams are tall. At least, a lot of them are. And most fish can't climb actual ladders. They can't walk upstairs, and although there
are some fish elevators, they’re a lot more complicated and usually less efficient than
a system that allows fish to swim in a somewhat natural channel. So, the overall hydraulic design of most fishways
is to break up that elevation into manageable “chunks” that fish can navigate at their
own pace. They need to go kind of horizontal, but still
make their way upward over the dam. A steeper channel is shorter, but it can make
the water flow too quickly. A shallower channel has slower flow, but it’s
a longer distance, increasing the cost and complexity of getting up to the top. So, for salmon, at least, the engineers and
biologists have generally settled on something in between (usually a 10-15% slope) that breaks
up the total height into passable increments with some kind of baffle. The simplest and oldest fishways are called
“pool and weir” designs. The idea here is that fish can use a burst
of energy to swim up the fast moving flow over the weir and then rest in the pool above. When they’re ready, they swim up the next
one, and so on. Nothing like a grown man playing with fish
in his garage. Lots of fish can handle this no problem, but
not all species can manage the challenge of swimming up a high velocity jet of water over
and over again. Pool and weir designs are generally considered
one of the less effective designs because they can limit the species and fitness of
the fish that can ultimately make it through. Many of the newer fishways use more sophisticated
geometry to try and address that shortcoming. The fish ladder at McNary modifies the concept
a little bit by breaking the weir into two parts with a non-overflow section in the center
and including submerged holes through each baffle, called orifices. This design provides a wider variety of flow
conditions, allowing more types of fish to find their way to the top. McNary even sees a good number of Lamprey,
a jawless fish species with similar migratory behavior to salmon, pass through the ladder
each year. Most of the salmon prefer to use the submerged
orifices rather than jump over the top. My model isn’t quite scaled to my toy fish,
so I’ll demonstrate that here with some movie magic. This particular configuration is sometimes
called an Ice Harbor design because it was first implemented at Ice Harbor Dam on the
Snake River, just upstream from McNary. Both the pool-and-weir and Ice Harbor designs
have a major limitation in that they’re sensitive to the water level above the dam. Small changes in the forebay can significantly
alter the amount of flow passing through the ladder just due to the hydraulics of weirs
and orifices. So the designs only work when the reservoir
or forebay above a dam is regulated to a tight margin. McNary has several large crest gates that
can be used to control this, but that’s not always feasible. One type of fish ladder solves it in an interesting
way. Vertical slot fishways are exactly what they
sound like. Instead of a weir or orifice, they use a slot
along the entire height of the baffle. That makes it possible for fish to move upstream
under a wide variety of flow conditions. When I remove some of the stoplogs in my model
to lower the level, the vertical slot baffles continue working in essentially the same manner. Plus, the velocity is fairly consistent from
the top to the bottom of the slot, giving fish ample opportunity to pass through each
one. The protrusion on the upstream face creates
a gentle area for fish to rest if they need it. The big question with these designs and all
artificial fishways is this: how well do they work? Again, a difficult question to answer, especially
considering that many are designed with a specific group of species in mind. The fish ladders along the Columbia and Snake
rivers are surprisingly good for salmon. One study found that 97% of Chinook, Sockeye,
and steelhead that entered a dam tailrace made it up the ladder and into the forebay. But, millions of dollars of engineering, research,
and testing were put into those structures because of the huge cultural and economic
value of these fish in the region. The results vary wildly for other species
or other dams. The primary way we know this is through tagging
fish, introducing them downstream of a fishway, and measuring how many make it to the upstream
side. That type of study comes with all kinds of
complications, and of course, it’s impossible to compare those numbers to how many fish
might make it upstream if there were no dam in the first place. The Pacific Northwest National Lab showed
me some of the mind-bogglingly tiny tags that can be implanted into fish and the fascinating
tools they use to track them, so again, check out that other video if you want to learn
more about the process. One of the simplest ways we use to measure
the effectiveness of fishways is to count the number and type of fish that pass through
them. Many of the largest of these structures are
equipped with counting stations, often a simple window into one side of the ladder where someone
watches and marks the fish as they pass by. This is extremely useful data, not just used
to measure effectiveness but to keep track of overall fish migration year over year,
and a lot of it is available online. But even this requires a little ingenuity. Most fishways are too wide to see from one
side to the other in the sometimes murky water, so it’s necessary to funnel fish toward
the window. Sloped grates called pickets allow water to
flow through while the fish are corralled to the counting station. Even these pickets can discourage fish from
continuing upstream, so fish ladder designs have to consider whether they’re really
necessary. A trash rack at the upstream exit is usually
installed to keep debris from getting into the ladder and clogging up the baffles. Fish swim through the rack and into the forebay
to continue their upstream journey. Of course, this is a drop in the bucket of
all that it takes to manage fish passage. You won’t be surprised that adult salmon
migrating upstream is a small subset of the vast array of challenges in getting fish around
the barriers we build. Even McNary has juvenile passage facilities
for younger fish traveling downstream and another fish ladder on the Washington side
with a totally different design. Dams worldwide, particularly those installed
where migratory fish species live, often have significantly different systems custom-designed
for the species needing through. This is important. It’s not just for biodiversity’s sake,
although that’s pretty important on its own. We depend on these fish for food, for recreation,
for cultural identity, and more. So, we’re constantly innovating. I mentioned fish elevators and locks. In some cases, we do the migrating for the
fish by barging up or downstream. You may have seen viral videos of the Whooshh
fish cannon that aims to make fish passage possible where traditional ladders aren’t
feasible. We’ve even tried dropping fish from airplanes. It didn’t work very well, by the way. All this to say, it’s something we care
deeply about. For better or worse, a big part of engineering
is fixing the problems we created through engineering of the past when we either didn’t
know or didn’t care about the impacts our projects could cause. Everyone has a different perspective about
what it means for humanity to live harmoniously with all the other life we share the planet
with. I think it’s fascinating how those ideas
and endeavors trickle down through engineering into the real world. I love talking about the intersection of engineering and and environmental issues, but I definitely
have to be more thoughtful about how I present the issues compared to the pure engineering
stuff. Wildlife isn’t the most polarizing issue
on the news these days, but you might be surprised how stories are covered by different media
sources, or sometimes, how they’re not covered at all. Here’s an example: A bird flu outbreak that started in 2020 has
been spreading to other animals, and now scientists are detecting it in seals and sea lions. If you only rely on a few sources for your
news, you might have missed this story altogether, but Ground News has collected all 31 in one
place. 50 percent of the outlets reporting on this
story lean left, while only 11 percent lean right. You can also get a summary of the Factuality
and Ownership - for this story, 52 percent of the reporting outlets are owned by media
conglomerates. Most of the reporting is pretty similar, but
there’s some nuance in the headlines: One right-leaning source focuses on the environmental
emergency specifically in the US, while left-leaning sources mostly mention the scientists trying
to stop it. This is all easy to see at a glance with today’s
sponsor, Ground News, a website and app that aggregates media sources and puts them in
context. For every story, you get a visual breakdown
of political bias, factuality, and ownership of sources based on ratings from independent
news monitoring organizations. One of my favorite features is the blindspot
feed, which highlights stories mostly covered by only one side of the political spectrum. That’s how I found the story about seals
and bird flu. I think it’s important to think about how
the news affects so much of our lives: what we advocate for, what we talk about, and who
we vote for. With that much power over us, it just makes
sense to paint those stories in context to make it easier to sift through biases. Ground News makes me feel more confident that
I’m not living in a bubble controlled by algorithms that only try to show me what I
want to see. And they’re offering a huge discount right
now if you use my link in the description. Subscribe to get a more transparent media
landscape using my link ground dot news slash practicalengineering or click the link in
the video description for 40% off the Vantage subscription, which includes unlimited access
to all of their features. Thank you for watching, and let me know what
you think!

---

## 47. How the Hawaiian Power Grid Works
**Channel:** Practical Engineering | **Views:** 2.1M | **Date:** 1 year ago | **Duration:** 17:12 | **ID:** bbECmVdyWlQ
**Link:** https://youtube.com/watch?v=bbECmVdyWlQ

### Transcript:
In January of 2024, right on the heels 
of a serious drought across the state,   a major storm slammed into the Hawaiian islands 
of Oahu and Kauai. Severe winds caused damage to   buildings, and heavy rain flooded roadways. 
At the Waiau Steam Turbine plant,   the rain reached some of the generator unit 
controls, tripping two units and knocking 100   megawatts of power off the tiny grid (roughly 10% 
of demand). The overcast weather also meant solar   panels weren’t producing much electricity, and the 
colossal battery systems at Kapolei  and Waiawa were running out of juice. 
Other generating units were out of service due to   maintenance scheduled during the cool winter 
months when power demands were lowest. Then,   the H-POWER trash-to-energy plant tripped 
offline as well. By the evening of January 8th,   all of Hawaiian Electric’s power 
reserves on Oahu were depleted,   and it was clear that they weren’t going to have 
enough generation to meet all the needs. And if   you can’t increase supply, the only other 
option is to force a reduction in demand. At around 8:30 PM, the utility implemented rolling 
outages across the island of Oahu to bring power   demands down to a manageable level. For about 2 
hours, the utility blacked out different sections   of the island for 30 minutes each to minimize 
the inconvenience. Twice since then, as of   this writing, rolling outages have been forced on 
Hawaii Island from unexpected trips at generators   and scheduled maintenance at backup facilities, 
making them unavailable to pick up the slack. When we say “power grid” we’re used to imagining 
interconnections that cover huge areas and serve   tens to hundreds of millions of people. But 
populated islands need a stable supply of   electricity too. Those recent power disturbances 
highlight some really interesting challenges that   come from building and operating a small 
power grid, so I thought it would be fun   to use the 50th state as a case study to 
dive into those difficulties. I’m Grady,   and this is Practical Engineering. Today 
we’re talking about the Hawaiian power grid. Really, I should say Hawaiian power grids, 
because each populated island in the state   has its own separate electrical system. Around 
95% of customers are served by a single utility,   Hawaiian Electric, which maintains grids 
on Oahu, Maui, Hawaii Island, Lanai,   and Molokai. Kauai is the only island with its 
own electric cooperative. There have been a few   proposals and false starts to connect the islands 
through undersea transmission cables and form a   single grid. It is an enormous challenge to 
install and maintain cables of that depth   and distance. When you add in the volcanic and 
seismic hazards of the area and the sensitive   ecology of the surrounding ocean, so far, no 
one has figured out how to make it feasible. So,   each island has its own power plants, high-voltage 
transmission lines, substations, and distribution   system entirely disconnected from the others. 
And that makes for some interesting challenges. “Reliability” is the name of the game 
when it comes to running an electrical   grid. It’s not that complicated to build 
generators, transmission lines, transformers,   et cetera. What’s hard is to keep them all 
running 99.9% of the time, day and night,   rain or snow. Yeah, some parts of Hawaii 
occasionally get snow.  This is a graph of a typical reliability curve that helps explain why 
it’s a challenge. At the left end of the curve,   you can get big increases with a small investment. 
But the closer you get to 100 percent uptime,   each increment gets a lot more expensive. 
It really boils down to the fact that,   in many ways, reliability comes from 
redundancy. When something goes wrong,   you need flexibility to keep the grid up. But, 
in practice, that means you have to pay for and   maintain equipment and infrastructure that rarely 
gets used, or at least not to its full capacity. Hopefully, it’s clear that the graph I 
showed is idealized. It’s much harder   to put concrete numbers to the question. 
The random nature of problems that arise,   our inability to predict the future, and the 
fact that everything in a bulk power system is   interconnected all make it practically impossible 
to know how much investment is required to achieve   any incremental improvement in reliability. 
But it’s useful anyway because the graph helps   clarify the benefits of a large power grid, 
also known as a “wide area interconnection.” For one, it smooths out demand. One part of a 
region may have storms while another has good   weather. From east to west, the peak power demand 
comes at different times. Some areas get sun,   some get shade. But overall, demands average out 
and become less volatile as the grid gets bigger   geographically. Larger interconnections also 
have more redundant paths for energy to flow,   reducing the impacts of major equipment problems 
like transmission line outages. They have more   power plants, again creating redundancy and 
making it easier to schedule offline time to   maintain those facilities. And, the power plants 
themselves can be bigger, taking advantage of the   economies of scale to make energy less expensive 
and more environmentally beneficial. Finally,   larger areas have more resources. Maybe it’s 
windy over here, so you can take advantage and   build wind turbines. Maybe this area has lots 
of natural gas production, so you can produce   power efficiently without having to pay for 
expensive fuel transportation. In general,   a wide area interconnection allows the costs 
of equipment, infrastructure, resources, and   operations to be shared, making it easier to keep 
things running reliably. Hawaii has none of that. Roughly 75% of the electric power in the 
state currently comes from power plants that   run on petroleum. There are no oil or natural gas 
reserves in Hawaii, which means the vast majority   of power on the islands comes from fuel imported 
from foreign countries. That makes the state very   susceptible to factors outside of its control, 
including international issues that affect the   price of oil. Each island has only a handful 
of major power plants and transmission lines.   And when storms happen, they often hit the entire 
place at once. It’s easy to see why retail energy   costs in Hawaii are around 3 times the average 
price paid across the US. Every increment of   reliability costs more than the one before it, and 
each island has no one else to share those costs   with. So, they get passed down to consumers. 
But, it’s not just that the grids are small. The bulk of the remaining roughly 25% of Hawaii’s 
electric power not produced in oil-fired power   plants comes from renewable sources: wind, 
solar, and a single geothermal plant. This   has the obvious benefit of reducing CO2 emissions, 
but it also reduces the state’s exposure to the   complexities of the fuel supply chain and price 
volatility, taking advantage of resources that are   actually available on the islands. But, renewable 
sources come with their own set of engineering   challenges, particularly when they represent 
such a large percentage of the energy portfolio. Of course, renewable sources are intermittent. 
You don’t get power when the wind doesn’t blow   or the sun doesn’t shine. That sporadic 
nature necessitates options for storage   or firm baseload to make up the difference 
between supply and demand. It also makes it   more complicated to forecast the availability of 
power to plan ahead for maintenance, fuel needs,   and so on. And, it requires those storage 
facilities or baseload plants to ramp down   and up very quickly as the sun and wind come and 
go. But that’s not all. Solar and wind sources   are also considered “low-inertia”. Thermal 
and hydroelectric power plants generally use   enormous turbines to generate electricity. Those 
big machines have a lot of rotational inertia that   stabilizes the AC frequency. The frequency of the 
alternating current on the grid is basically its   heartbeat. It’s a measure of health, indicating 
whether supply and demand are properly balanced.   If frequency starts to deviate too much, equipment 
on the grid will sense that something’s wrong and   disconnect themselves to prevent damage. The same 
is true for lots of industrial equipment and even   consumer devices. When conditions on the grid 
fluctuate - say a transmission line or generator   suddenly trips offline - the rotational inertia in 
those big spinning turbines can absorb the changes   and help the grid ride through with a stable 
frequency. Solar panels and most wind turbines   connect to the grid through inverters. Instead of 
heavy spinning machines creating the alternating   current, they’re basically just a bunch of little 
switches. That means disturbances can create a   faster and more significant effect on the grid, 
reducing the quality of power and making it more   difficult to keep things stable. I’m planning a 
deep dive into how inverter-based energy sources   work, so stay tuned for that in a future video. 
But, it gets even more complicated than that. Of all the renewable energy on the Hawaiian 
islands, about half currently comes from   small-scale solar installations, like those on 
residential and commercial rooftops. They’re   collectively known as “distributed energy 
resources.” This has the obvious benefit   of bringing resources closer to the loads, 
reducing strain on transmission lines. It also   takes advantage of space that is already developed 
and builds capacity on the grid without requiring   the utility to invest in new facilities. But, 
distributed sources come with tradeoffs. Most   parts of the grid are built for power to flow 
in one direction, so injecting electricity at   the downstream end can create unexpected loads 
on circuits and equipment not designed to handle   it. Distributed sources also affect voltage and 
frequency, since something as simple as a cloud   passing over a neighborhood can dramatically swing 
the flow of power on the network. The inverters on   small solar installations are generally dumb. 
And I’m using that as a technical term. They   can’t communicate with the rest of the grid; they 
only respond based on what they can measure at the   point of connection. The grid operator doesn’t 
get good data on how much power the distributed   sources are putting into the grid, and they have 
little control over those inverters. They can’t   tell them to reduce power if there’s too much 
on the grid already or increase power to provide   support. And inverters, especially consumer-grade 
equipment, can behave in unexpected and unintended   ways during faults and disturbances, 
magnifying small problems into larger ones. Those inverters can also make the grid more 
vulnerable to cyberattacks since their security   depends on individual owners. It’s not hard to 
imagine how someone nefarious could take advantage   of a large number of distributed sources 
to sabotage parts of the grid. And finally,   distributed resources affect the revenue that 
flows into the utility, and this can get pretty   contentious. The rates a customer pays for 
electricity cover a lot of different costs,   many of which don’t really evaporate on a 
kilowatt-per-kilowatt basis if you remove   that demand from the grid. Fixed costs like 
maintenance of infrastructure still come due,   even if that infrastructure is being used at a 
lower capacity on sunny days. With net metering,   it gets even more complicated to figure out 
how much that power injected into the grid is   really saving, not to mention how those savings 
should be distributed across the customer base. And, these challenges are only becoming more 
immediate. Hawaii’s Clean Energy Initiative,   launched in 2008, set a goal of meeting 
70 percent of its energy needs through   renewables and increased efficiencies by 2030. 
In 2014, they doubled down on the commitment,   setting a goal of completely eliminating fossil 
fuel use by 2045. That would take them from one   of the most fossil-fuel-dependent states in 
the US to the most energy-independent. And,   they’ve taken some big steps toward that goal. 
Renewable generation has gone from less than   10% to about 25% of the total already, and a 
host of policies have been changed to create   more opportunities for renewables on the 
grid. Solar water heaters are now required   for most new homes. Rebates are available for 
solar installations. The only coal-fired plant   in the state was controversially shut down 
in 2022. And, there is a big list of solar,   battery storage, and biofuel turbine projects 
expected to come online in the near future. For better or worse, Hawaii has become a 
full-scale test bed for renewables and the   challenges involved as they become a larger and 
larger part of the grid. Many consider natural gas   to be a bridge fuel to renewables, a firm resource 
that is generally cheaper, cleaner, and often more   stable in price than other fossil fuels. But 
Hawaii is hoping to leapfrog the bridge. For   the climate and their own energy security, they’ve 
gone all in on renewables, making them a leader in   the world, but also forcing them to work out some 
of the bugs that inevitably arise when there’s no   one ahead of you to work them out first. There 
are some really cool innovations on the horizon   as Hawaii grows closer to its goal. Smart grid 
technologies will add sensors and communications   tools to automate fault detection, recovery, 
and restoration, and enable power to flow more   efficiently across distributed resources. Hawaiian 
Electric is also testing out time-of-use rates to   encourage customers to shift their power use to 
off-peak hours, hopefully smoothing out demands   and reducing the need for expensive generators 
that only get used for a few hours per day. That idea really underscores the significant 
challenge Hawaii faces in keeping its grids   operating. Improvements and capacity upgrades 
help everyone, but they cost everyone too,   and they cost more for every additional 
increment of uptime. There’s no reliability menu,   and kilowatt-hours don’t come a la carte. 
If you’re a self-sufficient minimalist or   frequent nomad who isn’t bothered by the idea 
of intermittent power, you can’t pay a cheaper   rate for less dependable service. And if you use 
a powered medical device or work a high-powered,   always-connected job at home, you can’t pay 
extra for more reliability. In many ways,   Hawaiians are all in it together.  Drawing that 
line between what’s worth the investment and   what’s just gilding the electric lily is tough 
already with such a diverse array of needs   and opinions. Doing it on such a small scale, 
multiplied by several islands, and with such a   quickly growing portfolio of renewable energy 
sources only magnifies the challenge. But it   also creates opportunities for some really cool 
engineering to pave the way for a more resilient,   secure, and flexible energy future, not just for 
Hawaii, but hopefully all the rest of us too. If there’s one thing I learned from researching 
and talking to people for this video, it’s that   Hawaiians care a lot about how their state 
is portrayed in the media. There’s a lot of   complexity in the history and culture, and it’s 
easy to miss out on important context if you’re   not from there, and I’m not. And that happens 
a lot for me, actually, even for topics you   think would be strictly about the science 
and engineering. Here’s just one example: The private Odysseus lander (kind of) 
successfully landed on the moon a few   weeks ago. There’s not a lot of politics in 
a story like this, but if you look closely,   you can see it through slightly different lenses. 
More than 289 news outlets covered it. Of these   289 news outlets, 35% lean left and 20% lean 
right. And, while the headlines themselves are   relatively similar across the political spectrum, 
the articles themselves are a little different.   Right-leaning news outlets tended to focus 
on the private sector aspect of the mission,   while left-leaning outlets ascribed more of the 
achievement toward the partnership with NASA. With today’s sponsor, Ground News, it’s 
easy to pick out these little details   and rise above the biases that are inherent 
in lots of media sources. For every story,   you get a quick visual breakdown of the political 
biases, factuality ratings, and ownership of the   sources. Everything’s in one place, so it’s easy 
to compare multiple articles and make sure you   have a well-rounded understanding of the story. 
For the Odysseus story, 49% of the reporting   outlets are owned by Media Conglomerates. One of 
my favorite features is the Blindspot Feed, which   shows you stories that are mostly reported by 
one side of the political spectrum or the other. I don’t think we’ll ever get 
away from biases in reporting,   but reading the same story from different 
angles gives me context and insights that   would be harder to come by just using my 
typical sources. Ground News makes me feel   more confident that I’m not living in a bubble 
controlled by algorithms that only try to show   me what I want to see. And they’re offering a 
huge discount right now if you use my link in   the description. Subscribe to get a more 
transparent media landscape using my link   ground dot news slash practicalengineering 
for 30% off the Vantage subscription. That   link is in the description. Thank you for 
watching, and let me know what you think!

---

## 48. How Fish Survive Hydro Turbines
**Channel:** Practical Engineering | **Views:** 2.6M | **Date:** 1 year ago | **Duration:** 22:22 | **ID:** HCE_lFUMXNg
**Link:** https://youtube.com/watch?v=HCE_lFUMXNg

### Transcript:
Most of the largest dams in the US were built 
before we really understood the impacts they would   have on river ecosystems. Or at least they were 
built before we were conscientious enough to weigh   those impacts against the benefits of a dam. And, 
to be fair, it’s hard to overstate those benefits:   flood control, agriculture, water supply for 
cities, and hydroelectric power. All of our   lives benefit in some way from this enormous 
control over Earth’s freshwater resources. But those benefits come at a cost, and the 
price isn’t just the dollars we’ve spent on   the infrastructure but also the impacts dams have 
on the environment. So you have these two vastly   important resources: the control of water to the 
benefit of humanity and aquatic ecosystems that we   rely on, and in many ways these two are in direct 
competition with each other. But even though most   of these big dams were built decades ago, the ways 
we manage that struggle are constantly evolving as   the science and engineering improve. This is 
a controversial issue with perspectives that   run the gamut. And I don’t think there’s one right 
answer, but I do know that an informed opinion is   better than an oblivious one. So, I wanted to see 
for myself how we strike a balance between a dam’s   benefits and environmental impacts, and how that’s 
changing over time. So, I partnered up with the   folks at the Pacific Northwest National Laboratory 
(or PNNL) in Washington state to learn more. Just   to be clear, they didn’t sponsor this video and 
had no control over its contents.They showed me   so much, not just the incredible technology and 
research that goes on in their lab, but also how   it is put into practice in real infrastructure 
in the field, all so I could share it with you.   This is McNary Dam, a nearly 
1.5-mile-long hydroelectric dam   across the Columbia River between 
Oregon and Washington state,   just shy of 300 miles (or 470 km) upriver from 
the Pacific Ocean. And this is Tim Roberts,   the dam’s Operations Project Manager and 
the best dam tour guide I’ve ever met. But this was not just a little walkthrough. We 
went deep into every part of this facility to   really understand how it works. McNary is one 
of the hydropower workhorses in the Columbia   River system, a network of dams that provide 
electricity, irrigation water, flood control,   and navigation to the region. It’s equipped with 
fourteen power-generating turbines, and these   behemoths can generate nearly a gigawatt of power 
combined! That means this single facility can,   very generally, power more than half-a-million 
homes. The powerhouse where those turbines live   is nearly a quarter mile long (more than 350 
meters)! It’s pretty hard to convey the scale   of these units in a video, but Tim was gracious 
enough to take us down inside one to see and   hear the enormous steel shaft spinning as it 
generates megawatts of electrical power.   All that electricity flows out to the grid on these 
transmission lines to power the surrounding area. McNary is a run-of-the-river dam, meaning 
it doesn’t maintain a large reservoir. It   stores some water in the forebay to create 
the height needed to run the turbines,   but water flows more or less at the rate it 
would without the dam. So, any extra water   flowing into the forebay that can’t be used for 
hydro generation has to be passed downstream   through one or more of these 22 enormous lift 
gates in the spillway beside the powerhouse. As you can imagine, all this infrastructure 
is a lot to operate and maintain. But it’s   not just hydrologic conditions like floods 
and droughts or human needs like hydropower   demands and irrigation dictating how and when 
those gates open or when those turbines run;   it’s biological criteria too. The 
Columbia and its tributaries are home   to a huge population of migratory fish, 
including chinook, coho, sockeye, pink salmon,   and lampreys, and over the years, through 
research, legislation, lawsuits, advocacy,   and just plain good sense by the powers at be, 
we’ve steadily been improving the balance between   impacts to that wildlife and the benefits of 
the infrastructure. In fact, just about every   aspect of the operation of McNary Dam is driven 
by the Fish Passage Plan. This 500-page document,   prepared each year in collaboration with a litany 
of partners, governs the operation of McNary and   several other dams in the Columbia River system 
to improve the survival of fish along the river. This fish bible includes prescriptive details and 
schedules for just about every aspect of the dam,   including the fish passage structures too. 
Usually, when we build infrastructure,   the people who are going to use it are 
actual people. But in a very real sense,   huge aspects of McNary and other similar dams 
are infrastructure for non-humans.   On top of the hydropower plant and the spillway, McNary 
is equipped with a host of facilities meant to   help wildlife get from one side to the other 
with as little stress or injury as possible.   Let’s look at the fish ladders first. 
McNary has two of them, one on each side. A big contingent of the fish needing past McNary 
dam are adult salmon and other species from the   ocean trying to get upstream to reproduce 
in freshwater streams. They are biologically   motivated to swim against the current, so a fish 
ladder is designed to encourage and allow them   to do just that, and it starts with attraction 
water. Dams often slow down the flow of water,   both upstream and downstream, which can be 
disorienting to fish trying to swim against a   current. Also, dams are large, and fish generally 
don’t read signs, so we need an alternative way to   show them how to get around. Luckily, in 
addition to a strong current, salmon are   sensitive to the sound and motion of splashing 
water, so that’s just what we do. At McNary,   huge electric pumps lift water from the tailrace 
below the dam and discharge it into a channel that   runs along the powerhouse. As the water splashes 
back down, it draws fish toward the entrances so   they can orient with the flow through the ladder. 
Some of this was a little tough to understand   even seeing it in person, so I had a couple 
of the engineers at the dam explain it to me. All these entrances provide options 
for the fish to come in, increasing   the opportunity and likelihood 
that they will find their way. Once they’re in, they make their way upstream 
into the ladder itself. Concrete baffles break   up the insurmountable height of the dam into 
manageable sections that fish can swim up at   their own pace. Most of the fish go through 
holes in the baffles, but some jump over the   weirs. There’s even a window near the top 
of the ladder where an expert counts the   fish and identifies their species.  This data is 
important to a wide variety of organizations,   and it’s even posted online if you 
want to have a look. Once at the top,   the fish pass through a trash rack that keeps 
debris out of the ladder and continue their   journey to their spawning grounds. The goal is that 
they never even know they left the river at all,   and it works. Every year hundreds of thousands 
of chinook, coho, steelhead, and sockeye make   their way past McNary Dam. If you include the 
non-native shad, that number is in the millions. And it’s not just bony fish that find 
their way through. Some of the latest   updates are to help lamprey passage. 
These are really interesting creatures! I’m working on another video that will take a much 
deeper look at how this and other fish ladders   work, so stay tuned for that one, but it’s not the 
only fish passage facility here. Because what goes   up, must come down, or at least their offspring 
do (most adult salmon die after reproducing). So,   McNary Dam needs a way to get those juvenile 
fish through as well. That might sound simple;   thanks to gravity, it’s much simpler to go 
down than up. But at a dam, it’s anything but. I definitely wouldn’t want 
to pass through one of these,   but juvenile fish can make it through 
the spillway mostly just fine. In fact,   specialized structures are often installed 
during peak migration times to encourage   fish to swim through the spillway. McNary Dam has 
lift gates where the water flows from lower in the   water column. But salmon like to stay relatively 
close to the surface and they’re sensitive to the   currents in the flow. Many dams on the Columbia 
system have some way to spill water over the top,   called a weir, that is more conducive to 
getting the juveniles through the dam. The other path for juveniles to take is to be 
drawn toward the turbines. But McNary and a lot   of other dams are equipped with a sophisticated 
bypass system to divert the fish before they   make it that far. and that all starts with the 
submersible screens.    These enormous structures are specially designed with lots of narrow 
slots to let as much water through to the   turbines while excluding juvenile fish. They are 
lowered into place with the huge gantry crane that   rides along the top of the power house. Each 
submersible screen is installed in front of a   turbine to redirect fish upwards while the water 
flows continues on. Brushes keep them clean of   debris to make sure they fish don’t get trapped 
against the screen. They might look simple,   but even a basic screen like this requires a 
huge investment of resources and maintenance,   because they are absolutely critical 
to the operation of the dam. Once the fish have been diverted by the screens, 
they flow with some of the water upward into a   massive collection channel. This was originally 
designed as a way to divert ice and debris,   but now it’s basically a fish cathedral 
along the upstream face of the dam. The juveniles come out in these conduits 
from below. Then they flow along the channel,   while grates along the bottom concentrate them 
upward. Next they flow into a huge pipe that pops   out on the downstream face of the dam. Along the 
way, the juveniles pass through electronic readers   that scan any of the fish that have been equipped 
with tags and then into this maze of pipes and   valves and pumps and flumes. In the past, this 
facility was used to store juveniles so they   could be loaded up in barges and transported 
downstream. But over time, the science showed   it was better to just release them downstream 
from the dam. Every once in a while, some of the   juveniles are separated for counting so scientists 
can track them just like the adults in the ladder.   Then the juveniles continue their journey in the 
pipe out to the middle of the river downstream. Avian predation is a serious problem 
for juveniles. Pelicans, seagulls,   and cormorants love salmon just like the 
rest of us. In many cases, most of the fish   mortality caused by dams isn’t the stress of 
getting them through the various structures,   but simply that birds and other predatory fish take advantage of the 
fact that dams can slow down and concentrate   migrating fish. This juvenile bypass 
pipe runs right out into the center   of the downstream channel where flows are 
fastest to give the fish a fighting chance,   and McNary is equipped with a lot of 
deterrents to try and keep the birds away. All this infrastructure at McNary Dam to help 
fish get upstream and downstream has changed   and evolved over time, and in fact, a lot of 
it wasn’t even conceived of when the dam was   first built. And that’s one of the most 
important things I learned touring McNary   Dam and the Pacific Northwest National Lab: 
the science is constantly improving. A ton of   that science happens here at the PNNL Aquatics 
Research Laboratory.   I spent an entire day just chatting with all the scientists and researchers 
here who are advancing the state of the art. For example, not all the juvenile salmon 
get diverted away from those turbines.   Some inevitably end up going right through. You 
might think that being hit by a spinning turbine   is the worst thing that could happen to a fish, 
but actually the change in pressure is the main   concern. A hydropower turbine’s job is to extract 
as much energy as possible from the flowing water.   In practice, that means the pressure coming 
into each unit is much higher than going out,   and that pressure drop happens rapidly. It doesn’t 
bother the lamprey at all, but that sudden change   in pressure can affect the swim bladder that 
most fish use for buoyancy. So how do we know   what that does to a fish and how newer designs 
can be safer? PNNL has developed sensor fish,   electronic analogues to the real thing that they 
can send through turbines and get data out on the   other side. Compare that data to what we already 
know about the limits fish can withstand (another   area of research at PNNL), and you can quickly and 
safely evaluate the impacts a turbine can have. What’s awesome is seeing how that research 
translates into actual investments in   infrastructure that have a huge effect 
on survivability. New turbines recently   installed at Ice Harbor Dam upstream were 
designed in collaboration with PNNL with   fish passage in mind to reduce injury for 
any juveniles that find their way in. One   study found that more than 98% of fish 
survived passing through the new turbines,   and nearly all the large hydropower dams in 
the Columbia river system are slated to have   them installed in the future. And it’s not just 
the turbines that are seeing improvements. I   talked to researchers who study live fish, how 
they navigate different kinds of structures,   and what they can withstand. Just the engineering 
in the water system to keep these fish happy is   a feat in itself. I talked to a coatings expert 
about innovative ways to reduce biological buildup   on nets and screens. I talked to an energy 
researcher about new ways to operate turbines   to decrease impacts to fish from ramping them up 
and down in response to fluctuating grid demands. And I spent a lot of time learning about how 
we track and study the movement of fish as   they interact with human made structures. 
Researchers at PNNL have developed a suite   of sensors that can be implanted into fish for 
a variety of purposes. Some use acoustic signals   picked up by nearby receivers that can precisely 
locate each fish like underwater GPS. Of course,   if you want to study fish behavior accurately, you 
need the fish to behave like they would naturally,   so those sensors have to be tiny. PNNL has 
developed miniscule devices, so small I could   barely make out the details. You also want to make 
sure that inserting the tags doesn’t injure the   fish, so researchers showed me how you do that 
and make sure they heal quickly. And of course,   those acoustic tags require power, and tiny 
batteries (while extremely impressive in their   own right) sometimes aren’t enough for long-term 
studies. So they’ve even come up with fish-powered   generators that can keep the tags running for 
much longer periods of time. A piezoelectric   device creates power as the fish swims… and 
they had some fun ways to test them out too. Of course, migratory fish aren’t the only part 
of the environment impacted by hydropower,   and with all the competing interests, 
I don’t think we’ll ever feel like the   issue is fully solved. These are messy, 
muddy questions that take time, energy,   and big investments in resources 
to get even the simplest answers. The salmon pink and blue paint in the powerhouse 
at McNary really sums it up well, with the blue   symbolizing the water that drives the station, and 
the pink symbolizing the life within the water,   and its environmental, economic, and cultural 
significance. This kind of balancing act is really   at the heart of what a lot of engineering is all 
about. I’m so grateful for the opportunity to see   and learn more about how energy researchers, 
biologists, ecologists, policy experts,   regulators, activists, and engineers collaborate 
to make sure we’re being good stewards of the   resources we depend on. I think Alison Colotelo, 
the Hydropower Program Lead at PNNL put it best: My crew and I spent two full days in 
Washington talking to scientists and   engineers about these complicated issues. 
And I probably learned more about biology   in those two days than anything 
I happened to absorb in college,   especially about how dams can isolate populations 
of fish if they aren’t equipped with well-designed   passage systems like those at McNary. And 
there’s a human equivalent to that too,   that’s really interesting I think, because we’ve 
found ways of living in super remote places,   and the ways people and fish adapt to those 
situations have a lot of similarities. My friend,   Sam, of the Wendover Productions channel has 
a video series called Extremities that is all   about the most remote places on Earth and how and 
why people choose to settle them. I’ve watched all   15 episodes. They’re so good, and if you want to 
check them out, they’re available only on Nebula. You’ve probably heard of Nebula before. It’s a 
streaming service built by a group of creators,   including me, as a way to boost the 
resources and capabilities of independent   creators. It’s totally ad-free, 
full of originals like Extremities,   and there are no industry executives or big 
production houses deciding what projects live   or die. That means people like Brian from Real 
Engineering, Scotty from Strange Parts, Integza,   and a lot of others get to make the stuff 
they’re passionate about without having to   be so careful to please the YouTube algorithm 
or so shallow to capture a wider audience. You can think of it like an employee-owned co-op. 
A place to experiment with bigger projects,   different formats, and extra content and perks 
from your favorite creators. My videos go live   there early, before they come out here, and my 
Practical Construction series wouldn’t have been   possible to make if not for the dedicated people 
watching on Nebula. I know there are a lot of   streaming platforms out there right now, and no 
one wants another monthly cost to keep track of,   but I also know that if you’re watching a 
show like this to end, there is a ton of   other stuff on Nebula that you’re going to 
enjoy as well. So I’ve made it dead simple:   click the link below and you’ll get 40% off an 
annual plan. That means you pay just one time,   30 dollars, for an entire year’s access at 
nebula.tv/practical-engineering. That’s less   than 3 dollars a month. If you’re with me that 
independent creators are the future of great   video, I hope you’ll consider subscribing. Thank 
you for watching, and let me know what you think!

---

## 49. How To Install a Pipeline Under a Railroad
**Channel:** Practical Engineering | **Views:** 818K | **Date:** 1 year ago | **Duration:** 15:33 | **ID:** RK1J8kC1sEY
**Link:** https://youtube.com/watch?v=RK1J8kC1sEY

### Transcript:
This is the Union Pacific Railroad’s 
Austin Subdivision in central Texas.   It’s a busy corridor that moves both freight 
and passengers north and south between Austin   and San Antonio… But it’s mostly freight. 
Trains run twenty-four-seven here, carrying   goods like rock from nearby quarries, cement, 
vehicles, intermodal freight, and more. So,   when Crystal Clear Special Utility District was 
planning a new water transmission main that would   connect a booster pumping station to a new water 
tower to meet the growing demand along I-35,   the biggest question was this: how do you get 
the line across the tracks without shutting   them down and trenching across? It’s only about 
250 feet or 76 meters from one side to the other,   but this small part of a large water transmission 
project takes more planning, coordination,   engineering, and innovative construction than 
the rest of the project combined. Maybe you’ve   never even wondered what it takes to move 
fresh water across the distances from where   it’s stored to where it’s used. But, I really 
think you’re going to find this fascinating. Crystal Clear and their general contractor, 
ACP, invited me on-site to see it happen in   real-time and document the process for you!  Most of the water lines are already installed,  but getting this one across these tracks 
is going to be a different challenge. I’m   your host, Grady Hillhouse, and 
this is a Practical Construction. There are actually a lot of ways to install 
underground utilities without disrupting   things at the surface, collectively known as 
trenchless technologies. This project is using a   method called horizontal earth boring, but really, 
it’s pretty exciting. Before any dirt gets bored,   there’s a lot that has to happen first. So 
much can go wrong if an operation like this   isn’t carried out thoughtfully and carefully. 
One of those risks is hitting something that’s   already buried at the site, and just about 
every subsurface utility contractor can tell   horror stories about what happens if a water, 
sewer, gas, fiber optic, or telephone line is   severed during construction. The right-of-way 
along a railroad track is a common place to   install linear utilities, because they 
can just run parallel to the tracks,   avoiding the complexity of dealing with multiple 
property owners and obstacles. The owners of all   the utilities that run along these tracks have 
already been out to mark their location using   spray paint on the ground and flags. But, 
that’s not enough to make sure they are   avoided. Before the drill can get started, a 
vacuum excavation crew comes to the site to   confirm their location not just along the 
ground, but how far each one is below it. This truck has an enormous vacuum that sucks 
up soil as it’s blasted loose by a pressure   washer. The benefit of a vacuum excavator is 
that, although the water is strong enough to   dislodge and excavate soil, it’s not strong 
enough to damage the utility lines below.   Compare that to using a hydraulic excavator 
with a bucket where one wrong move could rip   a pipe or cable out like a wet noodle. It also 
disturbs a lot less of the area at the surface,   so this process is often called potholing. 
It’s a crucial step if the margins are tight   when avoiding existing utilities, like 
they are on this site. For each utility,   the vacuum excavator locates the exact 
position and depth of the line so that it   can be marked by a surveyor and compared 
to the proposed alignment of the bore. And   there’s hardly any mess once the process 
is done. On this site, there are lines   both above and below the proposed bore, so the 
drilling contractor will be threading a needle. Safety is also critical, especially when 
working around railroads and trains. Since   this job requires people on the tracks and 
construction below them, there’s a specialized   crew on site who coordinates between the Union 
Pacific dispatchers, train engineers, and crews   on site to make sure no one gets hurt. They’ve 
established a specific zone along the tracks,   which requires the train engineers to check in 
with them first before any train gets near the   work. When a train is on the way, the safety 
crew sounds a horn, and everyone on site stops   working and gets clear of the tracks. Once 
the train is past, work starts right back up. The process of horizontal earth boring, also 
known as jack-and-bore, starts with an entrance   pit. Unlike some trenchless methods that can 
curve down and back up again from the surface,   this waterline needs to be as straight and 
precise as possible. So you have to start   underground. This enormous excavation is 
where almost all the work will happen. And,   because it’s so close both to a 
roadway and the railroad tracks,   there’s no room to slope the sides to avoid 
the risk of a collapse. Instead, huge steel   trench boxes are installed in the pit to shore 
it up and keep it from collapsing or affecting   the adjacent structures. Once the trench boxes 
are installed, the boring machine can be lowered   into place. And before long, it’s up and running, 
or I guess you could say it’s down and running. In practice, horizontal earth boring is relatively 
straightforward. The boring machine really only   has two jobs: excavating the soil and advancing 
the casing pipe. For the first job, it uses a   string of augers that connect to a boring head. 
It’s just an oversized drill bit. As the auger   turns, the boring head breaks up the soil ahead of 
the casing pipe, and the flights draw the cuttings   back toward the pit. The cutting head has wings 
that open when rotated in one direction. Those   wings extend just slightly beyond the edges of 
the casing pipe, over-excavating the bore hole   to minimize the friction of pushing the casing 
pipe forward. The soil cuttings from the boring   are discharged from the side of the machine into 
a pile in the pit. Every so often, they have to   be removed. The excavator at the surface uses a 
clamshell bucket to scoop the cuttings out of the   pit and stockpile them nearby. They’ll eventually 
be disposed of off-site or used as backfill. The machine’s second job is to advance the 
casing pipe into the bore. This pipe provides   support to the hole to keep it from collapsing 
and prevent the overlying soil from shifting or   settling over time. The boring machine sits on 
tracks. The back of the machine uses a hydraulic   ram attached to a locking system that affixes 
to the rails. The ram provides thrust, pushing   both the machine and the casing pipe forward 
with the tremendous force required to advance   it through the ground. Newton’s third law is in 
play here. To provide that thrust to the casing,   the machine needs something to react against. 
So, those tracks have been firmly concreted   into the bottom of the entrance pit to make sure 
it’s the machine that moves and not the tracks. Of course, every contractor knows as soon as you 
start making good progress, it’s going to rain.   Water flows downhill, and this pit is the lowest 
spot of ground on site. But the crew doesn’t let   it slow them down too much. The concrete bottom 
in the pit helps keep things from turning into   a muddy mess, and an electric pump makes pretty 
quick work of the water that gets in. Tarps over   the top of the pit also help keep it dry, if also 
making it a little tough to film the work inside. Railroad operators are rightly strict about 
the what, where, when, and why when it comes   to construction on their rights-of-way. Disrupting 
the movement of freight and passengers is simply   not an option. So an essential part of this 
operation is continuous monitoring to make   sure the boring is not affecting the tracks 
above. A surveying crew comes to the site   every six hours to carefully measure for any 
changes in elevation along the tracks. They’ve   installed these reflective markers and use 
a piece of equipment called a total station   that can precisely pinpoint each length of the 
rail. They process the data as it comes in and   compare it to the baseline measurements. 
If they notice any settling or movement,   everything would have to stop (but, 
spoiler alert, they never did). Another requirement from the railroad is 
that this work happens nonstop. They don’t   want an open excavation sitting idle below 
the tracks, so they require that the boring   happen continuously night and day. The longer it 
takes to get this casing pipe to the other side,   the more opportunity for something to go wrong. 
The boring contractor works in double shifts. When   one crew leaves, there’s already another one to 
take their place, so the site is never unattended. Once one segment of casing pipe is pushed 
as far as it can go, the boring machine is   pulled to the back of the pit. A new segment 
of pipe is collected from the stack. And,   it’s lowered in. The next length of the auger 
is already inside. The auger is attached to   the string. And then the casing segment 
is welded to the end of the previous one. Segments go in faster at first, but each one takes 
a little bit longer than the last. That’s because,   every two or three segments, they have to 
check and make sure the bore is following   the right path. There are utilities to avoid, 
dimensional tolerances from the railroad,   and location requirements from the engineer and 
property easements. So, having the alignment   wander is not an option. Every so often, the 
crew has to remove the entire auger string from   the bore to make sure it’s headed in the right 
direction. The way they do it might unnerve you,   especially if you’re claustrophobic: they just 
send a worker on a skateboard to the end of the   casing pipe. There are more sophisticated tools, 
but some contractors prefer the old-school,   reliable method, and they have a slew of 
safety measures in place as required by OSHA,   including ventilation, communication, 
and safety spotters. The person inside   the pipe uses a rule to check for any 
deviations in grade from the precision   laser installed in the bore pit. But, what 
happens if the bore gets off alignment? Horizontal earth boring is not a very “steerable” 
operation, but there is some opportunity to make   corrections if they’re needed. Take a look 
back at the first length of the casing pipe.   Notice the shoes cut from each quadrant of 
the pipe. If the bore starts to deviate,   a hydraulic jack can be used to bend one 
or more of the shoes outward and deflect   the operation back into alignment. You’re not 
going to turn a corner this way, but it gives   some control over alignment and grade. It’s 
why it’s so critical that the first length   of casing pipe be installed perfectly; all the 
rest of the casing will follow right behind it. The operation runs night and day. The machine 
bores and pushes each length of casing pipe.   Soil is removed from the bore and then the 
pit. Alignment is checked. The auger string   is re-inserted. A new length of casing is 
welded on. Rinse and repeat. All the while,   trains are running constantly back and forth 
along this busy corridor. When the drilling   crew starts getting toward the end of the line, an 
excavator arrives to dig the receiving pit. And,   after just about a week of boring 24/7, the 
cutter breaks through on the other side.    Even the guys who do this every day gathered around 
to watch it happen. It’s a perfect sight,   especially for the fact that they broke 
through in the exact spot they were aiming for. Only a few days later, it was time to push 
the water pipe through. The casing’s job is   just to hold the bore open, but the water will 
run in rated plastic pressure pipe. These pipes   connect using a bell-and-spigot design; they 
literally push together. A fiberglass rod is   hammered into a groove around the inside of the 
spigot to lock each segment together. Spacers   are installed to hold the line up off the casing 
to keep it from rubbing during installation or   being damaged over time. Just like the boring, the 
pipes are lowered into the entrance pit, attached,   and pushed through to the other side (although, 
this operation goes quite a bit faster). In some   projects, the annular space between the casing 
and pipe is grouted in, but in this job they opted   to keep the space open. It was a ton of work and 
coordination to get this line under the railroad,   so if it ever breaks or leaks, Crystal Clear 
will be able to pull it out and repair or   replace it. This line will be tied into the pipes 
already installed on either side of the bore,   leak-tested, and backfilled, but the hard part 
is over. It won’t be long before it’s pressurized   and put into service, moving fresh water to 
this quickly growing area in central Texas,   quietly and invisibly meeting a crucial need. And 
not a single train was delayed while it went in. One of the coolest parts of the project was the 
surveying involved. From the initial layout of the   bore to the track monitoring surveys that happened 
every six hours, there were so many surveyors   involved in just this one part of the project. 
I’ve said it before that surveying is such a cool   engineering-adjacent career, especially if you 
don’t like sitting behind a desk. But there’s a   barrier to entry that I think scares a lot of 
people away from it, and that’s trigonometry.   But trig really isn’t that scary, especially if 
you approach it like today’s sponsor, Brilliant. Brilliant’s been sponsoring Practical 
Engineering videos for six years now.   It’s the longest partnership I’ve had. And I 
think the biggest reason for that is people   watching this channel just keep finding value 
in learning new things in this interactive way.   That and they keep adding new lessons every 
month. I took a look at their trigonometry   section for this video, and ended up finishing the 
entire thing, just from the joy of brushing up. We learn best not by reading 
or hearing but by doing,   and that’s why I love Brilliant. The lessons 
just stick better when you’re actually using   the information while you learn. You can 
try this completely free for 30 days and   see if it’s something that can help you get 
ahead in your career, get better at a hobby,   or just enjoy the process of learning 
something new. The first 200 to sign   up will get 20% off a premium subscription. 
Go to brilliant.org/PracticalEngineering or   just click the link in the description 
below. I really like their website and   their app and I think you will too. Thank you 
for watching, and let me know what you think. Huge thanks to Crystal Clear 
Special Utility District,  ACP,  and their subcontractors 
for having me on their site.

---

## 50. Why Locomotives Don't Have Tires
**Channel:** Practical Engineering | **Views:** 1.9M | **Date:** 2 years ago | **Duration:** 16:18 | **ID:** nGhBHrr5CYQ
**Link:** https://youtube.com/watch?v=nGhBHrr5CYQ

### Transcript:
Formula 1 is, by many accounts, the pinnacle of 
car racing.  F1 cars are among the fastest in the world, particularly around the tight corners of the various paved tracks across the globe.   Drivers can experience accelerations of 4 to 5 lateral 
gs around each lap. That’s tough on a human body,   but think about the car! 5 times gravity 
is about 50 meters per second… per second,   and an F1 car weighs 800 kilograms (or 
1800 pounds). If you do a little quick   recreational math, that comes out to a force 
between the car and the track of more than 4   tons. And all that force is transferred through 
four little contact patches below the tires. Traction is one of the most important parts 
of F1 racing and the biggest limitation of   how fast the cars can go. Cornering and braking 
at such extreme speeds requires a lot of force,   and all of it has to come from the 
friction where the rubber meets the   road. Pirelli put thousands of hours of testing 
and simulations into the current design. Nearly   a hundred prototypes were whittled down to 
8 compounds: two wet tires and six slicks   of various levels of hardness that offer teams a 
balance between grip and durability during a race. And yet, when you look at another of 
the most extreme vehicles on earth   you see something completely different. A 
single modern diesel freight locomotive can   deliver upwards of 50 tons of forward force 
(called tractive effort) into the rails,   but it’s somehow able to do that through the 
tiny contact patches between two smooth and   rigid surfaces. It’s just slick on slick. It 
seems impossible, but it turns out there’s a   lot of engineering between those steel 
wheels and steel rails. And I’ve set up   a couple of demonstrations in the garage to 
show how this works. I’m Grady, and this is   Practical Engineering. In today’s episode, we’re 
talking about why locomotives don’t need tires. In a previous episode of this series on railway 
engineering, I talked about how hard it is to   pull a train based on the various aspects 
of grade, speed, and curves. I even tried to   pull a train car myself. The whole point of 
locomotives is to overcome that resistance,   to take all the force required to pull the train 
and deliver it to the tracks to keep the whole   thing rolling. Most modern freight locomotives 
use a diesel-electric drive. The engine powers   a generator, which powers electric traction 
motors that drive the wheels. There are a lot   of benefits to this arrangement, including not 
needing a super complicated gearbox to couple   the engine and wheels. But, even with electric 
traction motors, locomotives are still limited   by the power rating of those motors, and 
power is the product of force and velocity.   So if you graph the speed of a locomotive 
against the force it can exert on a train,   you get this inverse relationship. But, 
this isn’t quite right. Of course, there   are physical and mechanical limits on how fast 
a train can go, so the graph gets cut off there,   but there’s another limitation that governs 
tractive effort on the slow side. Even if the   motors could generate more force at slow speeds 
(and they usually can), the friction between the   rails and wheels limits how much of that force 
can be mobilized (called the adhesion limit). The graph makes it clear why this is 
such a major challenge for a railroad:   you can’t even use the full power of the engine 
because you’re limited by the friction at the   wheels. It’s why dragsters do a burnout 
before the race: to warm up the tires   for more friction. I was reading this 
Federal Railroad Administration report,   and I love that it called friction the “last 
frontier” of vehicle/track interaction; it’s just   so important to nearly every aspect of railway 
engineering. The lack of friction is really the   reason railways work in the first place: it means 
the rolling resistance of enormous loads can be   overcome by relatively tiny locomotives. But, 
of course, some friction is necessary so that   trains can accelerate and brake without slipping 
and sliding on the rails. There are alternatives,   like the cog railways that carry trains up steep 
mountains, but most freight and passenger trains   use simple “adhesion” for traction; just the 
steel-on-steel friction and nothing else. The   area that’s physically touching between a 
wheel and rail, called the contact patch,   is roughly the size of a US dime: maybe 2 to 
3 square centimeters or half of a square inch.   Imagine gluing a dime to the wall and then hanging 
two average sized cars from it. That’s a loose   approximation of the traction force below each 
wheel of a locomotive; it’s a lot of friction! Incredibly, friction really boils down to 
two numbers, one that’s simple (weight, or   more generally, the normal force between the two 
surfaces), and a coefficient that’s a little more   complicated. Let me show you what I mean.  I have 
a little demonstration set up here in the garage.  It’s just a sled attached to a spring scale. I can 
add a weight to the sled, and then slide different   materials underneath.  The reading on the scale is 
the kinetic friction between the materials. Even  if the weight stays the same, the force changes 
because every material interacts differently   with the steel sled, and this can get super 
complicated: asperity interlocking, cold welding,   modified adhesion theory, interfacial layers, 
et cetera. I’m not going to get into all that,   but it’s important to engineers who think about 
these problems. All that complexity gets boiled   down into a single, empirical value called the 
coefficient of friction. Double the coefficient;   double the friction. And the same is true of the 
normal force. If I double the weight on the sled,   I get roughly double the reading on the scale 
for each of the materials I pulled underneath it. In some ways, it really is that straightforward. 
You have two knobs to manage tractive effort:   the weight of the locomotive and the friction 
coefficient. But you don’t always have a lot of   control over that second knob. Environmental 
contaminants like oil, grease, rust, rain,   and leaves lower the coefficient of friction, 
making it harder to keep the wheels stuck to the   track. So you kind of just have the one knob to 
turn. Very generally, the math looks like this:   You look at the steepest section of track where 
the highest tractive effort is required and divide   that force by the “dispatchable adhesion,” a 
complicated-sounding term which is really just   the friction coefficient that you can count 
on for the specific locomotive and operating   conditions. Maybe it’s 30% for a modern locomotive 
on dry rail or 18% for an older model on a frosty   winter morning. Now you have the total weight 
needed to develop that tractive effort. For   longer and heavier trains, you can’t just use 
a single massive locomotive, because there are   limits to the weight you can put on a single 
wheel before the tracks fail or you damage a   bridge. That’s why many large freight trains use 
two, three, four, or more locomotives together. But, that friction coefficient isn’t set 
in stone. You do have some control there.   Even since the days of steam locomotives, 
sandboxes have been used to drop sand on the   tracks to increase the friction between 
wheels and rails. If you look closely,   you can sometimes see the pipes that deliver sand 
in front of the wheels. Some railways use air,   water jets, chemical mixtures, and even lasers 
to clean the rails, carry away moisture,   or just generally increase control over wheel/rail 
friction. And there’s another way to turn that   knob that’s a little tricky to understand, 
because there’s really not a hard line between   a wheel sticking to a rail through friction and a 
wheel sliding on it from not enough. Actually, all   locomotive wheels under traction exist somewhere 
in between the two! Let me show you what I mean. Even though both locomotive wheels and rails 
are made from hardened steel, that doesn’t   mean they’re infinitely stiff. Everything deforms 
to some extent. But, it would be pretty tough to   show the deformation of a steel-on-steel surface 
under hundreds of thousands of pounds in a garage   demonstration, so I have the next best thing: a 
rug and a circular brush that spins on a shaft.   This brush simulates a locomotive wheel, and 
right now, it can spin freely. So, when I pull   the rug underneath it, nothing unexpected 
happens. There’s essentially no traction   here. The force between the brush and the rug 
(representing a wheel on a rail) is negligible,   and there’s no slip. The brush turns at the same 
rate as the rug moves. But I can change that. I have a little homemade shaft brake made 
from a camera clamp, and I can tighten the   clamp to essentially lock up the rotation of the 
brush. Now when I pull the rug under the wheel,   it’s noticeably more difficult. The brush is 
applying a strong traction force to the surface,   and also, it’s completely slipping. The 
relative movement between the wheel and   the rail is basically infinite, since 
the wheel isn’t moving at all. Again,   maybe this isn’t too surprising of a 
result. What’s interesting, I think,   is what happens in between these two conditions. 
If I loosen the clamp so that the brush can   rotate with some resistance and pull the 
rug through again, watch what happens. The bristles deform as the brush rolls 
along. They’re applying a traction force,   even as the brush rolls. If you look closely, 
the bristles stick to the rug at the front,   but at a point within the contact area, they 
lose that connection to the rug and slip   backwards. And this is exactly what happens 
to locomotive wheels as well. The surface   layer of the wheel is stretched forward by the 
rail, but toward the back of the contact area,   there’s not enough adhesion, and they separate 
as the elastic stress is released. The stick   and the slip happen simultaneously. What’s 
fascinating about this behavior is that the   locomotive wheels actually spin faster than the 
locomotive is moving along the rails, an effect   called creep. And the brush makes it obvious why. 
The bristles in contact with the rug are flexing,   making that part of the wheel rim essentially 
longer. So the wheel has to turn faster to make   up for the difference, or in this demo (since the 
brush is static), the rug has to travel a greater   distance for the same amount of rotation. 
I can make this clearer with a bit of tape. With the brake off and no traction, I can pull the 
rug through and mark the length the rug traveled   for half a rotation of the brush. Now, with the 
brake on, I can pull the rug through again. And   you see that the rug traveled a longer distance, 
even though the brush rotated the same amount as   before. If we graph the behavior of a wheel across 
these various conditions, you get something like   this. With no traction, there’s no slip, and so 
there’s also no creep. But as traction goes up,   a bigger part of the contact patch is slipping, 
and so its relative motion to the track,   its creep, goes up. Eventually you reach a 
point where the entire contact patch slips,   and the traction force levels off. You can spin 
and spin, but you’ll never develop more force. Of course, that graph is a theoretical situation 
under ideal conditions. Your intuitions might be   saying that a wheel that’s fully sliding 
on the rail has less traction than one   that has at least some stick, and you’d 
mostly be right. For lots of materials,   the “dynamic” friction coefficient when 
something is sliding, like my little sled demo,   is less than the coefficient of friction when 
there’s no relative movement. That gives rise   to this effect called stick-slip, where 
you get oscillation between sliding and sticking.  A violin bow is a great example: 
the friction from the hairs in the bow stick,   then slide, along the string, causing it 
to vibrate and create beautiful music. On a locomotive, it’s less desirable. 
Stick-slip can lead to corrugation of   the rail and unwanted noise. It was a 
notorious problem for steam locomotives   because the traction force at the wheel 
rim was always fluctuating. But the other   effect this difference in static versus dynamic 
friction creates is that the traction versus   creep curve in the real world often looks 
more like this. There’s a maximum in there,   and if you go past it toward greater 
slip, you get a lot less traction. And that’s the trick many modern locomotives 
take advantage of. Sophisticated creep control   systems can monitor each wheel individually 
and vary the tractive force to try and stay   at the peak of that curve. Eeking out 
a few more percentage points on the   friction coefficient means you can take better 
advantage of your power, and sometimes even   use fewer locomotives than would otherwise be 
required, saving fuel, cost, and wear and tear. All that complexity, and you still might 
be wondering, why all the trouble when you   could just use a different material 
with a higher friction coefficient,   like the rubber tires on cars? And the answer is 
just that everything comes with a tradeoff. Some   passenger rail vehicles do use rubber tires, 
and some locomotives have steel “tires” that   can be removed and replaced. But I think 
those F1 tires are a perfect analogy. You   generally use the soft sticky ones when you want 
to gain track position and switch to the harder,   more durable tires to maintain position without 
losing too much time in the pits. But pit stops   for freight trains are pretty expensive. If you 
keep following that logic to more and more durable   tires that can carry multiple tons of weight 
across hundreds of thousands of miles, you just   end up with a steel wheel on a steel rail, and you 
find other ways to get the traction that you need. Hopefully, it’s clear how important locomotive 
weight is in developing enough friction to pull   an entire train. But the tracks that carry 
the train have to support all that weight,   and that’s made even more complicated when 
utilities like water lines have to cross   underneath. I recently spent an entire week 
on a construction site learning exactly how a   water line is installed below railroad tracks 
in a way that can withstand those incredible   forces and go in without interrupting 
any rail traffic in the process. And of course I   documented the whole thing for you. That video 
is part of my Practical Construction series,   where I go on location to construction sites. 
You can stay tuned for it eventually to come   out on YouTube, but if you can’t wait 
that long, it’s live on Nebula right now. I’m sure you’ve noticed the massive shift in video 
these days, where all the major TV networks are   just running reality shows in place of the stuff 
that used to be really good. Almost everything I   watch now is being made by independent producers. 
Not having to cater to a bunch of suits in a   major production house who don’t care what people 
actually enjoy watching means we have more freedom   to make videos that we’re passionate about. 
Brian from Real Engineering, Sam from Wendover,   Scotty from Strange Parts, Integza, and a lot more 
of my favorites all have their content ad-free on   Nebula, the streaming platform built by and for 
independent, thoughtful creators, including me. Nebula is basically the answer to the 
question of what could happen if the   best channels on YouTube didn’t have to cater 
to an algorithm. It’s just a different model   that changes the incentives and the rewards, 
and it’s come so far. It’s totally ad-free,   with tons of excellent channels and lots of 
original series and specials that just wouldn’t   see the light of day if they were produced 
for YouTube where you have to optimize for   clickability. My Practical Construction series is 
the perfect example. It’s written and produced for   people who want a peek into what really happens 
on a construction site. Maybe it’s a small crowd,   but those are my people, and I want to make 
great videos for them! If you’re with me that   independent creators are the future of great 
video, using my link below will get you 40%   off an annual subscription. That’s less 
than $3 a month. You won’t find any other   streaming platform that cheap, especially 
not one this good. I hope you’ll consider   it. That’s nebula.tv/practical engineering. Thank 
you for watching, and let me know what you think!

---
