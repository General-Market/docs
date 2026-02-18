# Branch Education Long-Form Transcripts

47 video transcripts.

---

## 1. The Engineering that Runs the Digital World 🛠️⚙️💻 How do CPUs Work?
**Channel:** Branch Education | **Views:** 2.6M | **Date:** 3 months ago | **Duration:** 36:23 | **ID:** 16zrEPOsIcI
**Link:** https://youtube.com/watch?v=16zrEPOsIcI

### Transcript:
Inside every desktop computer, smartphone, 
gaming console, laptop, or practically any   other device you use on a daily basis is a CPU 
or Central Processing Unit, and in this video,   we’re going to see how they work. A typical 
processor for a powerful laptop like this one   is built from billions of nanoscopic transistors 
connected together using dozens of layers of wires   and is essentially the brain of the device.
But before we explore the microprocessor and   all its complexity, let’s travel to the early days 
of personal computers and video game consoles and   compare the Apple 2e from 1983 to the modern-day 
MacBook Pro. Inside the Apple 2e we find a chip   called a 6502, which is considered one of the 
great-grandparents of all modern processors.   This chip is built from 4528 transistors and can 
perform around 430 thousand calculations a second.   While it could only run primitive applications 
and video games with simple graphics, this   chip was the backbone of a generation of early 
computers and video game consoles such as the NES,   the Commodore 64, and the Atari. Compare that to 
the MacBook Pro’s M1 processor which is built from   16 billion transistors capable of performing 
around 3 trillion calculations a second,   thus enabling it to generate expansive 
3D worlds with immersive graphics.  Despite these two chips being released around 45 
years apart, the underlying principles of how they   work are rather similar. In a way, you can think 
of these devices as sharing a common section of   technological DNA. In fact, if we were to open 
up a desktop computer and grab the CPU or the GPU   inside the graphics card, or teardown a Nintendo 
Switch or Smartphone and find the system on a chip   or SoC, or even if you could make your way into 
an AI Data Center and grab a state-of-the-art AI   chip, you’d find that all of these processors 
operate using the same underlying principles.   In other words, both the Oregon Trail of 
50 years ago and advanced AI algorithms   run on processors with similar 
technological DNA, but of course,   one of these chips is 10 billion times more 
computationally powerful than the other.  So, in this video, we’re going to take apart 
this microprocessor and find out exactly what   the shared technological DNA is and how it 
enables CPUs to work. And just to be clear,   the technological DNA is not transistors and it’s 
not logic gates, but rather it’s an architectural   design and basic operational principle that’s 
fundamental to microprocessors and differentiates   these chips from other integrated circuits. 
So, stick around, and let’s dive right in.  This video is sponsored by Brilliant.
Let’s begin with a quick 3D animated   teardown of this Macbook Pro. When we open it up, 
we find a range of different components such as   the touchpad, battery cells, speakers, a cooling 
fan, and the motherboard in the center. Mounted to   the motherboard are the solid state drive or SSD 
Storage chips where all your files are saved and   a range of other chips. Underneath the heat pipe, 
we find the DRAM which is the short term working   memory and central processing unit. Let’s desolder 
the DRAM and CPU and open it up. Inside we find   three parts: on the top is a protective cover that 
conducts and dissipates heat, on the bottom is an   interposer with thousands of connection points 
on either side and wires running inside of it,   and soldered onto the interposer is the integrated 
circuit or IC which is also called a die and is   the functional part of the CPU. On the die we can 
see the complex design of billions of transistors   and wires organized into different sections 
such as the 4 high-performance computational   cores, 4 energy-efficient cores, graphics 
processing cores, cache memory and many other   sections. Let’s zoom in on one of the performance 
cores where we find that it’s separated into   different functional blocks which we’ll add labels 
to and then reorganize into an architectural   diagram. This diagram illustrates how data and 
instructions move around a single processing core   in the CPU and, although it’s rather complicated, 
you’ll understand how it works by the end of this   video. But for now, let’s zoom in even further 
to get a nanoscopic view of a massive multilayer   labyrinth of wires with the transistors at 
the very bottom. Here we see a group of 6   transistors that are wired together to build an 
AND logic gate, and in this view we can see around   650 transistors out of the total 16 billion 
that make up the overall chip. Understanding   how billions of transistors work together to 
build a CPU capable of playing video games,   watching movies or browsing the internet will take 
a bit of work, so let’s start with an analogy.  You may have heard that CPUs are like super 
powerful calculators. This analogy is only around   20% complete as it’s missing some critical 
parts, so let’s add them in to make a more   accurate analogy. First, we’ll add a table for the 
calculator to sit on, along with a pencil and a   sheet of paper. Next, we’ll add rows and rows of 
bookshelves containing thousands of books along   with a cart that can carry a small stack of books 
between the shelves and the table. And finally,   we’ll add an automated robot which we’ll call 
a control unit or controller. The controller   can grab books from the bookshelves, move them to 
the cart and onto the table, and it can put them   back. The controller can also read the contents 
of each book, write on the paper and in the books,   and use the calculator. You can think of the 
controller as a super-fast human, but we’re bad   at animating humans, so it’s a robot instead. And 
with that, we have all the parts for our analogy.  Now let’s see how each part of our CPU analogy 
works. To start, the bookshelves are the storage   devices in your computer, such as the SSD chips , 
the cart represents the DRAM , and the table and   its contents represent the CPU. On the CPU Table, 
there’s a small space for a single open book which   is similar to the very limited capacity 
of the cache memory inside the CPU itself.  Next, the single sheet of paper represents 
the Registers which are used for storing   values or numbers that are actively being used. 
Specifically, on it are four general-purpose   registers and a few more special locations which 
we’ll discuss in a little bit. Additionally,   the pencil is there to write and erase 
things on the paper and in the books.  Finally, the calculator represents the Arithmetic 
Logic Unit or ALU. This ALU calculator works using   binary so there are only the digits zero and 
one and it can do simple functions like add,   subtract or multiply two numbers. The 
ALU calculator has many more functions   that you may be unfamiliar with but are still 
rather simple. For example, it can increase or   decrease a number by one or the ALU can perform 
bit shifts which is essentially taking a number   and adding a zero to the end of it. In decimal, 
bit shifting is like multiplying a number by 10   but in binary it’s equivalent to multiplying a 
number by two. The ALU can also perform logic   functions on two numbers such as the logical 
AND, OR, or Exclusive OR operations. For example,   here is the logical AND operation for 2 binary 
inputs and you can see that the output is the   logical AND for each place value of the 2 inputs.
However, more importantly, the ALU calculator can   perform comparisons. For example, you can 
input two numbers and hit the comparison   button to test whether the numbers are equal to 
one another and, if they are, then an equals flag   goes up while the other comparison flags like 
less than or greater than stay down. Finally,   the ALU calculator’s display that outputs the 
result has a special name called the accumulator.  So now that we’ve explained the various parts of 
this analogy, how does it all work together? Well,   the first step is to load a program that we want 
to run, which is like moving a set of books from   the bookshelves to the cart, and then moving a 
single book to the table and opening it up. It’s   important to note that the DRAM cart and cache 
memory on the table are both temporary and limited   capacity locations, whereas the SSD bookshelves 
can hold a lot more and are semi-permanent long   term storage. Additionally, when the computer is 
turned off, there are no books in the DRAM or the   CPU, but when the computer turns on, the cart and 
table are very actively shuffling books around.  Let’s take a look at the contents of one of the 
books. Essentially, there are two types of pages:   instructions and data. You can think of the 
instructions as the directions in a cookbook, with   each step numbered sequentially across the pages. 
And, the pages of data contain a list of addresses   with values stored at each address and are like 
the ingredients that go into the recipe itself.   Similar to cooking, you need both the 
recipe and ingredients to make it work,   and just a few ingredients can be combined 
in dozens of different ways using different   recipes. But to not use an analogy inside 
another analogy, let’s drop the cooking one   and focus on the books, table and calculator.
Let’s start at the beginning of this program   and flip to page one instruction one, which is 
called a ‘Load’ and is the most common type of   instruction. This ‘load’ has us open the pages 
of data and find a specific address. We then copy   and write down the value stored at that address 
into one of the general purpose registers on the   sheet of paper. With instruction one completed, we 
move to instruction two, which is to increment the   value in register zero by 1. So, we plug the value 
into the ALU calculator and hit plus 1. The third   instruction, called a ‘store’ instruction, is 
used to save or store the output of the calculator   found in the accumulator display into the pages 
of data in the same address it was in before.   These simple yet very common instructions are 
equivalent to this line of code. Next we move   onto instruction 4 and complete it and then 
instruction 5 and so on, moving through the   list of instructions which goes on and on and on.
In order to keep track of which instruction is   the next one to be completed, we use one of the 
special locations on the sheet of paper that we   mentioned earlier called the Program Counter or 
PC, also called an Instruction Address Register   or Instruction Pointer. Since the PC currently 
has a value of 5, we find instruction 5,   complete it, and increase the program counter 
by one. Therefore, the next instruction to be   completed will be instruction 6. However, what if 
after completing instruction 6, we want to jump   directly to instruction 42? Well, to do this 
we use a jump instruction at 7 which directly   sets the value in the program counter to a new 
number and in this case it’s 42. As a result, the   sequence of instructions will be 5, 6, 7 which is 
the jump instruction, then 42, 43, 44 and so on.  A similar set of instructions is called a 
conditional branch which is used for implementing   IF statements, loops, and other conditional code. 
Let’s use an example of a FOR loop with a few   simple lines of code inside of it. Quite simply, 
this loop is used to repeat the code inside of it   4 times. Here are the corresponding instructions 
of the FOR loop along with the instructions for   the code inside of it and we color coded each of 
the elements to keep track of which specific lines   of code result in the corresponding instructions. 
We’ll discuss how compilers turn code into   instruction later in this video, but for now 
let’s focus on the FOR loop and its instructions.   Specifically, here’s where ‘i’ gets set to 0 
and stored in an address in the pages of data,   here’s where ‘i’ is loaded from that address 
and incremented by one, and here’s the contents   of the loop. At the top, you can see the three 
instructions, Load, Compare, and Branch greater   than or Equal to. The Load first grabs the value 
for ‘i’ and places it into register 0. Compare   feeds ‘i’ stored in register 0 and a value of 4 
into the ALU and compares them, resulting in the   applicable comparison flags being triggered. Next, 
branch greater than or equal to checks whether   either the greater than or the equals flag is on, 
and if it is, it sets the program counter to 23,   which corresponds to completing and leaving 
the loop. However when ‘i’ is less than 4 th   ose flags aren’t triggered and the loop continues, 
until it hits the jump instruction at address 22,   where the jump sets the program counter to 6 
which corresponds to the top of the for loop. As   a result the loop will repeat a total of 4 times.
Note that this code on the left is in C++,   whereas the actual instructions completed by your 
CPU are in a binary language called machine code,   and the semi-readable version of the instructions 
is called assembly, but we modified this assembly   a little bit to make it more readable.
One interesting note is that you may   think that with everything a computer can do 
there must be tens of thousands of different   instructions. Well actually the 6502 processor 
in the Apple 2e from 1983 could only complete 56   different instructions whereas the modern M1 chip 
in the MacBook Pro can complete 354 instructions.   Here’s the list of all the instructions each 
chip can execute and if you take a good look,   most of these instructions are rather simple. 
Let’s just think about that for a second. Every   single thing you do on your computer can be 
constructed using only various sequences of 354   different instructions. However many programs have 
millions upon millions of lines of instructions,   and hopefully, there aren’t any bugs in them.
So now that we’ve discussed the range of possible   instructions, let’s further explore how CPUs 
work. In order to complete an instruction there   are always three key steps: Fetch, Decode, 
and Execute. The first step is Fetch and   is where the controller uses the value in the 
program counter to search through the pages of   instructions in the book for the corresponding 
instruction address. The controller then   copies the instruction found at that address 
into a special location called the current   instruction register or CIR. At the same time the 
controller increases the program counter by 1.  The second step is decode, and in this step 
the current instruction is fed into a circuit   called the instruction decoder. In our analogy 
from earlier, this decoder is a key part of the   controller, and in essence it’s the circuitry that 
reads in an instruction and both interprets what   the machine code of an instruction actually does, 
and simultaneously produces the control signals to   properly execute that instruction. Specifically, 
this instruction decoder circuit uses the binary   values of the instruction and an incredibly 
complex arrangement of logic gates to produce   the corresponding control signals which are 
then sent to the different elements in the CPU.  Instruction decoders are one of the more 
complicated parts of the CPU but here’s an   example along with a simplified explanation. 
Let’s say we have this ADD instruction in the   current instruction register or CIR and it’s fed 
into the instruction decoder. The first part of   the binary instruction specifies we want to use 
the ALU. With the ALU selected, the next 3 bits   specify that we want to use the ADD function, 
and then the last 4 bits of the instruction   indicates we want the values in register 0 and 
register 1 to be routed and sent to the ALU.  Instruction decoding is considerably more 
complicated than that but let’s move onto   the third step which is Execute. During 
execute, using our example instruction,   the control signals from the instruction decoder 
and an intricate set of electrical timing signals   are used to first send the value in register 
0 and then the value in register 1 to the ALU.   The timing signals are used to accommodate the 
time it takes electricity to travel from the   registers to the ALU and for transistors and logic 
gates to change their state, thereby ensuring the   correct result at the output. After the values are 
input, the ALU adds the two numbers together, and   a subsequent timing signal saves the result into 
the accumulator, thus completing the Execute step.  These three steps, Fetch, Decode, and Execute are 
used to complete a single line of instructions   and once it’s completed, these steps repeat but 
using the new value in the program counter. In   essence Fetch, Decode, and Execute form a cycle 
so let’s run through it again. During Fetch,   the controller uses the program counter’s value to 
fetch the corresponding instruction and places it   in the CIR and the program counter increases 
by 1. Next during Decode the instruction’s   binary is fed into the instruction decoder 
where a complex set of logic gates generate   the correct electrical control signals for 
that instruction. Finally, during Execute,   the instruction is completed using the control 
signals and timing signals, and in this case,   the value in the accumulator is stored back 
into a memory address which, using the analogy,   is like writing the value from the calculator 
display into a data location in the book. Then   the Fetch, Decode, Execute cycle repeats again 
using the next program counter’s value and so on.  The Fetch Decode Execute Cycle is used in every 
processor no matter whether it’s the 6502 in   the Apple2e or the M1 in the MacBook Pro. But of 
course there are many differences such as the size   of the cache, the registers, or functions on the 
ALU calculator and much more. We’ll explore the   exact differences in a few minutes, but for 
now, one important detail is that the Fetch   Decode Execute cycle uses your computer’s clock 
to regulate its pace. The 6502 chip had a One   Megahertz clock which ticked away at a million 
times a second and thus each step in the Fetch,   Decode, Execute cycle took a microsecond. 
Additionally the 6502 was an 8-bit processor   meaning the size of the registers and the ALU’s 
input and output were 8-bits wide. On the other   hand, the M1 chip is a 64-bit processor, so it 
can handle much larger numbers and it uses a 3.2   Gigahertz clock and therefore each step takes a 
third of a nanosecond. Additionally, the M1 chip,   along with all modern chips, uses a technique 
called pipelining where multiple instructions are   queued up resulting in fetch, decode, and execute 
for different program counter values and different   instructions being completed at the same time.
There are many other optimizations in modern   processors that we’ll soon discuss 
but it’s important to understand   that from the second you turn on your laptop, 
smartphone, gaming console, GPU or AI Server,   to the second you shut it off, the processor 
is continuously cycling through Fetch, Decode,   Execute over and over using programs filled with 
instructions and data along with the CPUs clock   to regulate its pace. In essence this Fetch, 
Decode, Execute cycle is the common section   of technological DNA that has powered every 
single processor built over the past 50 years.  This cycle of steps is incredibly powerful, 
capable of performing trillions to quadrillions   of mathematical operations every second in 
a single chip. But you may be wondering,   are there alternatives to the Fetch Decode Execute 
cycle? Well, there’s a world of different kinds   of microchips, but specifically, alternatives 
include Application Specific Integrated Circuits   or ASICs such as these microchips found in this 
bitcoin mining computer, or Field Programmable   Gate Arrays or FPGAs which are the main chips 
in a number automotive computers and cameras.   Both ASICs and FPGAs don’t use the fetch and 
decode steps, but rather they perform repetitive   operations by flowing data through a set pattern 
of logic gates and execution units, making   them highly optimized, but very inflexible. And 
then even further from these chips, are Quantum   Computers which are based on Qubits and Quantum 
circuits which we’ll discuss in future videos.  But, now that we’ve covered the Fetch, Decode, 
Execute cycle, it’s important to discuss two more   steps which are Memory and Writeback. Memory is 
analogous to moving books from the SSD bookshelves   onto the DRAM cart and then onto the table or 
Cache Memory, and Writeback is like writing data   into the books, and when space for a new book is 
needed on the table, the old book is placed back   on the DRAM cart and eventually returned to the 
bookshelves. These two steps use another special   location called the memory address register and 
are critical to a functioning computer, but they   typically take a lot longer to complete than the 
Fetch Decode Execute steps, and therefore in some   architectures and textbooks they’re included 
in the cycle and sometimes they aren’t. We’re   working on a separate video on how data moves 
around these memory locations, so stay tuned.  Now that we’ve uncovered the technological 
DNA inside all processors, it’s important   to note that, similar to the DNA found in the 
nucleus of the cell and there being multiple   layers of biological organization and structure 
for all living things, there are many layers of   complexity or abstraction between the Fetch 
Decode Execute cycle and a computer running   a video game or browsing the internet. If 
you want to dive into some of the other   layers and understand more about how computers 
work, we recommend you check out Brilliant   which is the sponsor of this video. Brilliant 
has a massive library of interactive courses   that include subjects like calculus, scientific 
thinking, circuits, programming in python, logic,   data analysis, and many more topics that would 
take far too long to list. However, Brilliant is   much more than a list of courses, rather it’s 
as if your favorite teacher who makes classes   engaging is combined with your favorite video game 
and then mixed with the knowledge from countless   textbooks. The result would be Brilliant.
Their mission is to create a world of   better problem solvers, and every one of their 
courses focuses on critical thinking through   interactive games and lessons. Furthermore, 
with technology progressing faster than ever,   Brilliant continuously updates their lessons 
to anticipate what you need to know for your   education and career. For example, they have a 
new course on AI and Large Language Models that   explains how Generative AI works far better 
than any other textbook or video out there.  Develop your knowledge by learning a little every 
day. You can start today by signing up for free   using the link: Brilliant.org/BranchEducation, 
or by scanning the QR code on screen,   and you’ll then have access to the wide range of 
courses throughout their catalog. If you enjoy   their content and decide to stay, the link in the 
description below will also save you 20% off an   annual premium subscription, which will give you 
unlimited daily access to everything on Brilliant.  Ok, so let’s quickly run through slightly 
more advanced topics to finish up this video.   Earlier we mentioned that the MacBook Pro’s M1 
chip can complete 354 different instructions.   This set of instructions is called ArmV8.4 and 
it’s categorized as a RISC architecture or Reduced   Instruction Set Computer. For example, here’s a 
simple game of Snake using 145 lines of C++ code.   It’s the job of a compiler, which is a separate 
piece of software, to take this code along with   ArmV8.4’s 354 RISC instructions, and generate 
a list of 676 assembly instructions equivalent   to the machine code instructions that would 
be found in a book or program named snake.app  The other common architecture found in Intel and 
AMD chips is called CISC, or Complex Instruction   Set Computer and is composed of thousands of 
different possible instructions. For example,   here’s the equivalent snake program that 
is compiled to run on an Intel or AMD Chip   using CISC and x86-64bit instructions, and 
you can see it’s only 560 instructions now.  A few key differences between RISC and CISC 
are that each RISC instruction is relatively   simple and is executed at a consistently fast 
execution rate. Additionally, RISC architectures   are more energy efficient and thus used in 
all smartphones, whereas CISC architectures   have thousands of different instructions and 
pack a lot more into a single instruction.   Additionally, the CISC instruction 
decoder is much more complicated,   and individual instructions have a variable 
execution rate sometimes taking multiple clock   cycles to execute. There are many additional 
pros and cons to RISC vs CISC which we’ll save   for yet another video, but we thought it worth 
mentioning these simplified differences here.  Computer architecture is incredibly complicated 
with many different facets and layers of   complexity and we have plans to make more videos 
that dive into each of these topics, but it’s   important to note that each video we make takes 
close to a combined 1100 hours of researching,   script writing, modeling, animating and editing. 
For example, we spent over 250 hours tearing down   these non-working computers we bought from Ebay, 
and meticulously rebuilding each of the 3D models   in Blender. So, if you could take a few seconds to 
like this video, subscribe if you haven’t already,   share this video with someone who might be 
curious as to how CPUs work, and most importantly,   write a quick comment below it would help us out 
immensely. Just a few seconds of your time helps   us far more than you think. So, thank you.
In the final section of this video we’ll   discuss this diagram we showed earlier and the 
architecture of modern processors such as the   M1. In contrast, the analogy we’ve laid out 
is rather simple, and you’re probably thinking   that there must be more components in an actual 
CPU. In fact, this analogy is actually pretty   close to what’s happening inside an Apple2e 
Computer. Specifically, the floppy drives,   are the bookshelves, and then when we open up 
this computer we see the DRAM chips, which are   the cart, and then going inside the 6502 processor 
we find an integrated circuit or die which has the   corresponding sections that we’ll organize into 
an internal architectural diagram. In this diagram   you can see the instruction decoder, ALU, the 
Program Counter, Current Instruction Register,   the other registers and a few other sections. 
Specifically, here’s where the program counter   is used to fetch an instruction, and here’s where 
the instructions and data from the DRAM chips   are bussed in and out. Finally, here’s where 
the instructions are decoded and the control   signals are generated. One note is that there’s 
no cache in the 6502 because the DRAM chips in   the 80s were just as fast as the instructions, 
so the table in the analogy is even smaller.  As we said at the beginning of this video, 
the 6502 chip is made from 4528 transistors,   so let’s see what an M1 chip with 16 billion 
transistors would look like. To start,   we have to significantly increase the size of 
this table. Next, we have to section off areas   for each of the performance and energy efficient 
cores, the GPU, and other areas. When we focus on   one of the performance cores we see the complex 
diagram from earlier, so let’s discuss how this   diagram compares to our analogy. Specifically, 
there’s a separate set of 64 kilobyte data and   instruction caches. As mentioned earlier there’s 
a pipeline to queue 8 instructions per clock cycle   and additional sections like a branch predictor 
to reduce issues with conditional branching and   help the pipeline run smoothly. Here you can 
see the pipelined instruction decoder, and 32   general purpose registers. One key difference is 
that the calculator is broken up into 8 separate   smaller calculators each handling a few functions. 
Additionally, there’s a special section for load   and store instructions. This is the layout of just 
a single core out of the 8 and there are entirely   different architectures in the Graphics Processing 
Unit as well as inside the Neural Processing Unit.  One important note is that the inclusion 
of these 3 types of processors along with   hardware accelerators such as the media 
engine makes this M1 chip closer to a   system on a chip or SoC than a traditional CPU. 
Similarly, all the processors in these devices,   including the CPU in your desktop computer can 
be considered SoCs and therefore the difference   is more a marketing term than a technical one.
On a separate note it’s important to mention   that the M1 along with all modern processors are 
proprietary designs and knowledge, and therefore   the diagrams we’ve shown are close approximations 
that we built using input from industry experts.  Let’s finally discuss our analogy in the terms 
of GPU chips found in graphics cards. We have   a separate video covering how graphics cards 
work, but with respect to this analogy, a GPU   CUDA core is actually very similar in complexity 
to the architecture of the 6502. Therefore with   10,000 to 20,000 CUDA cores in a single GPU chip, 
it’s like having a massive array of 6502 cores.   The difference is that GPUs typically use 
32-bit ALU calculators and perform single   instruction multiple thread or SIMT calculations 
where a single instruction is fetched, decoded,   and then distributed to a batch of cores, and 
then those cores execute that instruction using   different addresses and data. However, there are 
many more nuances to SIMT and GPU architecture,   so let’s wrap up this video on how CPUs work.
We’re thankful to all our Patreon and YouTube   Membership Sponsors for supporting our videos. 
If you want to financially support our work,   you can find the links in the description below.
This is Branch Education, and we create 3D   animations that dive deeply into the technology 
that drives our modern world. Watch another Branch   video by clicking one of these cards or click 
here to subscribe. Thanks for watching to the end!

---

## 2. The $200M Machine that Prints Microchips:  The EUV Photolithography System
**Channel:** Branch Education | **Views:** 1.8M | **Date:** 5 months ago | **Duration:** 38:31 | **ID:** B2482h_TNwg
**Link:** https://youtube.com/watch?v=B2482h_TNwg

### Transcript:
Inside every modern laptop, smartphone, desktop 
computer, advanced AI server, or practically any   other high-tech device are cutting edge microchips 
such as these CPU, GPU, SoC, DRAM, and SSD chips,   each with tens of billions of transistors inside 
of them. The transistors inside these microchips   are incredibly small with the tiniest features 
measuring around 10 nanometers or 45 silicon   atoms. This feat of science and engineering 
may seem impossible because on one hand each   of these microchips is made from connecting 
billions upon billions of transistors together,   and then on the other hand, each individual 
transistor is only nanometers in size.   Additionally, these microchips are 
everywhere and in everything, and therefore   they must be reliably mass produced. So how is 
manufacturing such a microchip even possible?  These are photolithography tools, and they are 
the key to manufacturing microchips. However,   it’s important to note that there are dozens 
of different types of tools used in the various   steps for making microchips, and each one plays 
a critical role in the manufacturing process. So,   to be accurate, photolithography tools are 
the ones that are used to copy and imprint   the nanoscopic patterns of transistors and layers 
of wires onto a microchip and therefore a useful   analogy is to think of these photolithography 
tools as nanoscale microchip photocopiers.  Photolithography tools have been continuously 
evolving to copy and imprint smaller and smaller   transistors and circuitry, and, in this video, 
we’re going dive into this state-of-the-art   EUV Photolithography System and explore 
the science and engineering inside of it.  So, let’s begin with a quick overview. To start, 
the EUV Lithography Machine takes the design of a   single layer of a microchip on what’s called a 
photomask and loads it into the machine. Next,   a 300 millimeter silicon wafer with a set of prior 
processes applied to it is placed onto a wafer   carrier inside the machine. With both in place, 
the machine uses extreme ultraviolet light or EUV   and a set of mirrors to copy the design from the 
photomask onto a silicon wafer. The wafer moves   to the next position and the microchip design 
is copied yet again. This copying happens over   and over until the wafer is filled with a hundred 
or more microchips and then a new wafer comes in,   and the copying starts over. This is the 
real-time speed of the lithography machine,   taking about 18 seconds to duplicate the same 
microchip design around a hundred times across   the entire area of a 300-millimeter wafer.
Let’s take a look at one of these microchips   and see what exactly we’re copying. Inside 
this microchip are approximately 30 billion   transistors, and if you were wondering, it’s the 
design of a GPU or graphics processing unit found   in the center of a graphics card. When we zoom 
into a nanoscopic view of this microchip we find   a 3D maze of transistors and layers upon layers of 
wires with the smallest dimensions of the bottom   most layers measuring around 10 nanometers 
or around 45 silicon atoms. Specifically,   the EUV Photolithography System typically patterns 
the lower layers with the smallest features,   whereas other photolithography tools are used 
to pattern the higher layers. It might be   difficult to fully grasp the level of detail and 
complexity inside a single layer of billions of   nanoscopic transistors, so let’s use a thought 
experiment and pretend that instead of copying   transistors and wires, this EUV photolithography 
system is used to copy the text from a book.  If the width of each line of a letter is 13 
nanometers, then the word ‘Cat’ would take up   around 155 by 240 nanometers, a page of text 
would be about the size of a red blood cell,   and a chapter of a book would be a grain of 
pollen. When we zoom out to see the equivalent   area of a GPU chip, how many pages of text do you 
think we could fit using these nanoscopic letters?   Well, we could print all 7 Harry Potter books 
plus every book written by Stephen King,   the entirety of the text from the English 
Wikipedia, and still have enough space to fit   every single book from your local public library.
There’s an unbelievable quantity of nanoscopic   lines and details that can fit into the area 
of a microchip, and it’s all photocopied by   this EUV Lithography System in less than 
a second. It’s no exaggeration to say that   every piece of modern technology that you use is 
made possible by this machine, and in this video,   we’re going to explore the key modules inside it 
and see how they work. So, let’s jump right in.  This video is sponsored by ASML, the company 
that designs and manufactures EUV Lithography   Systems. Throughout the video all the details 
and facts were independently researched,   written, and animated. Additionally some 
aspects are simplified, and due to the   proprietary knowledge and confidentiality 
around EUV Lithography, some of the details   we present are approximated or modified.
Before we open up and explore this EUV System,   let’s first spend a few minutes discussing 
microchip manufacturing and semiconductor   fabrication plants or fabs for short and 
the exact role of this machine. Inside our   example fab are hundreds of machines 
of which a couple dozen or so are the   EUV Lithography machines we’ve been discussing.
To make a microchip, 300-millimeter silicon wafers   are stacked inside a front-opening universal pod 
or foup and carried from machine to machine using   an overhead transport system. The foup is lowered 
onto a machine where each wafer is processed in   one way or another and, once the machine completes 
its work, the wafers are returned to the foup,   the pod is picked up, carried to the next machine 
and dropped off for the next step in the process.  Microchip manufacturing is incredibly complicated, 
but a simple way to think about it is that it’s   kind of like spray painting a design through 
a stencil, but instead of art this stencil   contains the nanoscopic patterns used to build 
the transistors and wires. Inside the microchip   factory, some tools are used to build the stencil 
such as the EUV lithography system, and many   of the other machines such as the deposition 
tools or ion implanters are the spray paint.  So, let’s take a look at how we build the 
stencil on the wafer which is technically   called a photoresist layer. To begin, the wafer 
travels to a machine called a track tool where   a light sensitive material called photoresist or 
just resist, is poured on and evenly spread across   a spinning wafer. Next the wafer is heated in 
order to dry and solidify the resist thus forming   a flat blank stencil. The wafer then moves to 
the photolithography tool where EUV or extreme   ultraviolet light is projected onto 
the photomask, which is also called a   reticle but typically just a mask for short.
When EUV light hits the mask, the patterned   information is imprinted in the light, and 
this imprinted light then bounces off a set   of mirrored lenses in order to project a focused 
and scaled down image of the mask onto the wafer.  Wherever the EUV light touches, the resist 
is modified and thus the design is copied   from the mask onto the wafer. The wafer moves 
to the next position and the EUV patterning   process repeats again until the entire wafer is 
filled with copies of the design from the mask.   Next the wafer travels back to the track tool, 
where the modified resist is washed away using a   developing solvent and the wafer is heated to form 
a hardened stencil or completed photoresist mask   layer on the top of the wafer.
Now that the wafer is patterned,   the wafer travels to the other spray paint-like 
tools in the fab which are used to etch away the   uncovered areas, implant dopants such as boron 
or phosphor, or deposit a layer of copper,   tungsten, or other metals, thereby building 
a single layer of nanoscopic structures.   Note that there are additional process 
steps that we’re not going to get into.  Now that we have a basic understanding of how 
the stencil and spray paint like processes   form a single layer, let’s zoom into a nanoscopic 
view inside a microchip where we can see how the   transistors and wires are incredibly complicated 
3-dimensional structures. Each of these   layers are built one after the other starting 
with the transistors at the bottom, moving up   to the small wires, and then wider and wider metal 
layers further up. In essence, to build a complete   microchip, the stencil and spray paint process is 
repeated over and over each time building only a   single layer, and therefore it’s more effective 
to visualize these processes as a loop, where a   single pass of the loop forms one layer using 
a single mask design in the lithography tool,   and then another layer is built using an entirely 
different mask loaded in the machine. To complete   a GPU chip like this one, the series of process 
steps or loops is repeated around 80 times   resulting in around a thousand individual process 
steps and taking four or so months to complete.  Let’s go back to the nanoscopic view of the 
microchip. Here we can see that the lower   layers are incredibly tiny and 13 nanometer EUV 
light is used to build the pattern for these   layers. However, the upper wires are substantially 
larger and are patterned using an entirely   different machine called a DUV or Deep Ultra 
Violet Photolithography System which is also   built by ASML and uses deep ultraviolet wavelength 
light. DUV lithography tools were introduced   in the 2000s and are still incredibly advanced 
machines. Because DUV tools typically cost less   than EUV machines, it’s more cost-effective 
to use EUV tools to pattern the transistors   and so-called critical layers, and then use DUV 
tools to pattern the upper, wider, less-critical   layers. Additionally, less advanced chips that 
don’t require the smallest transistors and wires   may forgo using EUV lithography altogether 
and only use DUV wavelengths, such as 193,   248 or 365 nanometers As a result, cutting 
edge fabs typically utilize different types of   lithography tools, and all these machines work 
as an intricate ecosystem to make a microchip.  With the basics of microchip manufacturing 
covered, let’s open an EUV lithography system,   explore the incredible science and engineering 
inside, and divide the system into its five key   parts: The light source, the illuminator, 
the reticle handler and reticle stage,   the projection optics, and finally the wafer 
handler and wafer stages. We’ll begin with the   light source which produces the EUV light, 
but let’s first answer the question of why   we even need to use Extreme Ultraviolet Light.
Well, a simple analogy is to think of the light   used to project and copy the pattern from the 
photomask as the tip of a marker. And, as you’re   probably familiar with markers, if you want to 
draw thin lines then you need a marker that also   has a thin tip. You can do tricks like angling the 
marker, but if you want to draw lines that are 100   times thinner, well then you need to switch pens 
and use a much smaller, fine tipped pen. Likewise,   to copy designs with dimensions only around 
10 nanometers wide, we use 13 nanometer light,   which is in the extreme ultraviolet light 
range of the electromagnetic spectrum.  The more technical answer deals with the 
wavelike nature of light and what happens   when light hits these nanoscopic patterns 
inside the photomask. These patterns are   made from nanoscopic EUV absorbing blockers on 
top of a surface that reflects EUV light. We’ll   explore the photomask and how the system uses 
reflective lenses a little later in this video,   but for now instead of using reflective optics, 
it’s easier to visualize the photomask as through   beam optics in a setup similar to the well-known 
double slit experiment. However, instead of the   double slit we’re showing light passing through 
a complicated pattern of nanoscopic slits that   represents a small portion of the overall 
photomask. So, what happens when we use a   wavelength of light that’s substantially 
larger than the 13 nanometer EUV light,   such as this 450-nanometer blue light. Well, when 
this large wavelength light hits the pattern,   the pattern is almost entirely lost. This is due 
to the width of the holes in the pattern being   substantially smaller than the wavelength of light 
hitting it. This limit to the resolving power of   the lithography machine is described in Rayleigh’s 
Criterion Equation, which we will explain later.   So, let’s switch to 13 nanometer EUV light. 
As the EUV light hits the pattern, the light   passes through and the pattern of the photomask is 
imprinted into the light, and the light diffracts   similar to the double slit experiment. This 
imprinted light then passes into projection optics   mirrored lenses which are used to focus and scale 
down the pattern and project it onto the wafer.  So now that we understand the need for EUV 
light, the next question is how do we produce   it? To start, two high-powered laser pulses run 
through multiple amplifiers below the cleanroom   floor. These laser pulses grow in power and then 
travel from the sub-fab using a pathway of mirrors   and up through the bottom of the tool and into a 
chamber called the source vessel. The first laser,   called the pre-pulse, is around 5 kilowatts 
in power and is targeted at a droplet of tin   using a set of actuated mirrors. This pre-pulse 
laser turns the tin droplets into a pancake-like   shape. The second approximately 25-kilowatt main 
laser pulse which is more than 10 times stronger   than the lasers used to cut steel, hits the tin 
pancake, instantly vaporizing it and turning it   into glowing plasma. Within each of the tin atoms, 
some electrons are ejected, and others are kicked   up to higher energy states. When electrons 
drop back down from the 4F to 4D orbitals,   13-nanometer EUV light is produced. Shooting two 
laser pulses at a droplet of tin might seem like a   rather obscure process, however EUV light doesn’t 
naturally occur on Earth and it’s one of the few   ways to efficiently produce over 500 Watts of 
EUV Light. Additionally, the reason for using   tin is that its plasma produces a wide range of 
wavelengths with a clear peak at 13 nanometers.  So, where does the tin droplet come from? Well 
over here a solid ingot of ultra-pure tin is   melted and fed into a storage tank and then piped 
towards a microscopic nozzle. A piezo electric   transducer squeezes the tip of the nozzle, and due 
to high-pressure nitrogen inside the storage tank,   a droplet of tin is forced out at a 
speed of 100 meters a second. Next,   high speed cameras measure and calculate the 
trajectory of the droplet and feed the data to   a set of actuated mirrors in order to angle 
the laser pulses to precisely hit the tin.   To control the amount of EUV light, sometimes 
droplets are skipped by the lasers, and these   droplets are captured over here. This process 
of producing high speed tin droplets and then   shooting them with 2 laser pulses to generate EUV 
light happens at a rate of 50,000 times a second.   Now that we have EUV light, the first mirror 
called the collector, focuses all the EUV   light to a small hole called the intermediate 
focus, which only EUV light can pass through.  The light next enters into the illuminator, 
which is composed of the field facet mirror,   the pupil facet mirror, and another set of 
mirrors. These mirrors are so perfectly shaped   that there’s less than an atom’s deviation from 
the surface. The illuminator takes this EUV light   and shapes it into a thin ribbon that has equal 
uniformity across a well-defined range of angles   before it hits the photomask. Using an equal 
uniformity of light at all angles is critical to   imprinting a perfect nanoscopic pattern from 
the mask via the light and onto the wafer.  We want to take a short detour and mention that 
this has been a rather challenging video to make   simply because there’s a mountain of science 
and engineering inside these machines built   by ASML and this video only explores the tip of 
the iceberg. Essentially, a lot of the details   had to be cut in order to keep this video a 
manageable length. For example, EUV light is   incredibly difficult to work with because it’s 
absorbed by atmospheric molecules, and therefore   the entire light path and wafer carrier stage is 
connected to vacuum pumps, which remove all the   air. Additionally, EUV light is absorbed by glass 
and practically all other materials, and therefore   to focus and transport the light, this system 
uses mirrors rather than transmissive lenses.   However, these mirrors called Bragg Reflectors, 
are nothing like the mirrors in your bathroom,   but rather they’re composed of dozens of 
alternating layers of silicon and molybdenum,   each only a few nanometers thick. When EUV 
light hits the surface of this Bragg Reflector,   only 3% is reflected at each boundary layer while 
the rest passes through. But with so many layers   the cumulative 3% reflections add together using 
constructive interference, resulting in a total   of 70% being reflected for a single mirror, while 
30% of the light is lost and absorbed. However,   with more than 10 mirrors in the optical system, 
and only 70% reflection at each one, the final   light hitting the wafer is less than 10 percent 
the brightness of the light emitted by the tin   plasma, which is why the initial light from the 
source vessel needs to be as bright as possible.  Another example of the incredible engineering 
inside this machine is that this field facet   mirror is assembled from hundreds of independently 
controlled mirrors that can be angled to direct   the light onto specific regions of the segmented 
pupil facet mirror. Together, these two mirrors   take the cone of EUV light from the intermediate 
focus and turn it into a complex pattern of   illumination. For example, this is called annular 
illumination, here’s dipole illumination and   then here’s quasar illumination. You’re probably 
wondering why we require such complicated patterns   of illumination. Well, when we look back at the 
microchip, one layer of wires is running mostly   horizontally, the next layer is a set of cylinders 
called vias, and then the following layers have   wires that run vertically, and each layer uses 
a different mask. Earlier we said that the EUV   light is kind of like the tip of a fine tipped 
pen. Having different patterns of illumination is   like holding the marker at different angles with 
respect to the lines or circles that are being   patterned. Specifically, annular illumination is 
best used to pattern the layers containing vias   and is like holding the marker straight up and 
down, whereas dipole illumination like this is   best used to pattern lines running horizontally, 
and then we rotate the dipole illumination for   patterning the vertically oriented wires.
Imagine being at the forefront of this   groundbreaking science and engineering. Then 
picture ASML, whose work powers the innovations   that solve some of humanity's toughest challenges 
in energy, mobility, and healthcare. ASML is a   leader in photolithography systems, serving as the 
backbone for the world's leading chipmakers and   enabling the technology that drives our future. 
With over 44,000 talented individuals and growing,   ASML is headquartered in The Netherlands, with 
major R&D and manufacturing sites in the U.S.   and Asia. Their sprawling campus is not just 
a workplace; it’s an exceptional environment   where cutting-edge technology comes to life. To 
keep pushing the boundaries of what's possible,   ASML seeks exceptional talent. They are looking 
for scientists and engineers ready to design   the next-gen lithography systems, technicians 
and logistics experts eager to build, ship,   and support these groundbreaking systems, and 
software developers passionate about working   in a world of nanometers. ASML is the next step 
for those ready to make an impact in an inspiring   setting. Together with their suppliers, partners, 
and customers around the world, they are committed   to powering technology forward. Visit their 
website using the link in the description to   learn more and start a journey with ASML today.
Let’s move onto the next part of this EUV   Lithography tool and explore the photomask 
or mask which is also called a reticle and   contains the entire design of a single layer of a 
microchip. The mask starts in a doubly sealed pod   and is loaded onto the machine using an overhead 
transport system. The outer protective carrier is   opened, and a robotic arm picks up the inner pod 
and carries it to a vacuum load lock. The chamber   is sealed and pumped down to a vacuum, and the 
inner door opens. Next the inner pod opens up and   a separate robotic arm carries the mask and base 
to an inspection station. Each mask has half a   dozen different marks including a bar code as well 
as fiducials, which are designs used to align the   mask with sub-nanometer level accuracy. The mask 
is carried over to and loaded onto the reticle   stage which moves back and forth across the EUV 
beam with incredible accuracy and at high speeds   with more than 7Gs of acceleration. This mask’s 
surface is built from the same Bragg reflector   surface mentioned earlier but with a pattern of 
absorbers on top that locally blocks the light in   order to create the detailed microchip layer 
pattern. This 6 by 6-inch mask has a pattern   area of 104 by 132 millimeters and an absorber 
pixel resolution of below 10 by 10 nanometers.  In the beginning of this video we showed a 
variety of different chips with different sizes,   and shortly after we showed a GPU being 
patterned across the wafer. The pattern   on the mask is 4 times larger than the microchip 
and this GPU chip is close to the maximum size   chip that can fit on the mask, and therefore 
only one copy fits, resulting in 90 GPU chips   fitting onto a 300-millimeter wafer. However, 
CPU Chips are typically smaller and therefore,   in the following example, we can fit 2 copies 
on the mask and a total of 185 chips on the   wafer. When we look at even smaller DRAM chips, 
12 copies can fit on the mask, yielding 978 chips   on the wafer. Technically, the exposure field 
is one scan of the mask onto the wafer, and an   exposure field can have anywhere from 1 to a dozen 
or more die patterns on it, yielding around a 100   to a thousand or more chips on a single wafer.
This mask contains an incredible amount of   information and, as mentioned in the intro, it 
has the equivalent amount of detail as all the   text of Wikipedia plus all the books in an average 
public library. This mask, which can cost around   300,000 dollars, must be so perfect that using 
our analogy there can’t be a single grammatical   error, spelling mistake, or even an extra curve 
on a letter across 21 million pages of text,   otherwise it would damage every chip on the wafer. 
Also, if you’re curious, here are the calculations   we used for the transistors to text and book 
conversions. Pause the video to work it out.  The next topics we’ll explore are the 
projection optics and how the wafer is   moved around the machine. But first we’d like 
to mention that this video topic is incredibly   complicated and took hundreds of hours to 
research, write, model, animate, and edit,   totaling over 1100 hours. So, if you could take 
a few seconds to ‘Like’ this video, subscribe,   comment with a quick message below, and most 
importantly, share it on social media and with   a friend, family, or work colleague, it would help 
far more than you think! Additionally, we have a   Patreon page with AMAs and behind the scenes 
footage, and, if you find what we do useful,   we would appreciate any support. Thank you.
So, let’s move on to the projection optics.   These optics are composed of a series of mirrors 
that are used to project and focus the patterned   EUV light onto the wafer with extremely high 
accuracy, while minimizing wavefront aberrations,   and shrinking the image by a factor of 4. These 
mirrors are designed and manufactured by Zeiss,   who is a longstanding partner of ASML and has 
been a vital collaborator in the development of   the optics systems inside photolithography tools. 
To understand the projection optics, we have to   discuss what determines exactly how small these 
wires can be, and for this Rayleigh’s Criterion   Equation is used. This equation states that 
the smallest dimension or critical dimension,   is equal to k1 times the wavelength of light or 
Lamda divided by the numerical aperture, or NA.   The wavelength of EUV light is 13 nanometers. 
K1 is the process factor, which relates to the   various illumination settings created by the field 
and pupil facet mirrors that we discussed earlier,   along with the photoresist, and other factors 
and is close to .3 for this machine. Finally,   numerical aperture or NA is a measure of the angle 
and amount of light the mirrors in the projection   optics can capture and focus onto the wafer. 
Numerical aperture isn’t just about increasing   the brightness of the EUV light, but rather it’s 
more of a measure of the angles and amount of   constructive interference wave paths that hit the 
mask, and then are projected onto the wafer. In   short, with a larger numerical aperture or NA, 
which corresponds to a larger angle between the   projection mirrors and focal point, we can achieve 
a smaller resolution. This tool has a numerical   aperture of 0.33, however the next generation of 
EUV lithography systems called high NA, increases   this to 0.55 resulting in an 8-nanometer critical 
dimension. Increasing the numerical aperture to   0.55 requires significantly larger mirrors which 
results in a redesign of the entire optics system   and other parts of the machine, thus considerably 
increasing the size and cost of the system.   We could spend an entire video discussing 
the next generation High NA tool,   but instead let’s move on to discuss the wafer 
transport system and wafer stage and see how a   wafer makes its way to the EUV exposure station.
Let’s start with a wafer that’s carried in a foup   on the overhead transport system. This foup lands 
on the lithography cluster, which is a combination   of a wafer track tool and a lithography tool. 
The wafer first enters the track tool where a   layer of photoresist or resist for short, is 
evenly spread across the wafer. The wafer moves   to another area inside the track tool where it’s 
heated in order to dry and solidify the resist.   Next, using robotic arms the wafer is carried 
from the track tool into a vacuum load lock   inside the EUV tool. The pneumatically actuated 
doors close and the chamber is pumped down to a   vacuum. Next the back doors of the load 
lock open up and a different robotic arm   carries the wafer to one of the wafer stages.
This system is called a TWINSCAN because there   are two complete wafer stages that concurrently 
move two wafers around. The key idea is that   while one wafer is actively being patterned, 
a second wafer is being loaded onto the wafer   stage and measured under an alignment sensor.
Nanometer level accuracy is crucial with these   machines and one key philosophy of ASML 
is “Meten is Weten” which is Dutch for   “To Measure Something is to Know something”. The 
reason for requiring this level of perfection is   that when we look at the nanoscopic layers of 
the microchip, which has wires and holes that   are only 10 to 20 nanometers wide, if one layer 
is more than a couple nanometers off the previous   layer, then the electrical connections won’t 
conduct electricity correctly, and if an entire   layer is off, then every single chip 
will be catastrophically destroyed.  To make sure that the layer being patterned 
is perfectly aligned with the previous layer,   the entire wafer is thoroughly measured by the 
alignment sensor. On the wafer are hundreds of   alignment marks, which are reference patterns 
that assist in determining the exact position   of the earlier layers of patterns. The alignment 
sensor meticulously measures the X and Y positions   of every alignment mark on the wafer and builds a 
highly accurate 2D map from the results. This map   shows some regions of the wafer being biased in 
one direction by a few to dozens of nanometers,   and another region being biased in a different 
direction. Additionally, the leveling sensor   uses grazing incident light to measure the exact 
height of the wafer and builds a topological map   of the wafer which is critical for later bringing 
the wafer stage to the position such that the EUV   light is perfectly focused onto the wafer.
Now that we’ve measured and built the exact   alignment and height map for the wafer, the wafer 
stage next moves to the EUV exposure station.   As the wafer is being patterned, the wafer stage 
moves in perfect synchrony with the reticle stage,   but only a quarter of the distance due to 
the 4 to 1 reduction. At the same time,   the stage makes nano-scale adjustments using the 
alignment map so that the new layer perfectly   aligns with the previous layer. When the wafer 
stage moves from one exposure field to the next,   it’s important that no EUV light hits the 
wafer, and thus a shutter positioned up here,   near the reticle stage closes. Once the wafer 
stage is positioned to pattern the next microchip,   the shutter opens and the wafer stage and 
reticle stage move in perfect synchrony again.   This process repeats until the entire wafer is 
patterned taking around 18 seconds in total.  So then, what actually happens as EUV light hits 
the photoresist? Well, resist is a polymer mixed   with a Photo Acid Generator. When high energy 
EUV photons hit the resist, the light ionizes it   releasing high energy electrons. These electrons 
then hit the photo acid generator producing   an acid that breaks apart the polymer making 
it weaker. As a result, the areas hit by the   EUV light become soluble and are washed away by a 
developing liquid in the subsequent process step.   One detail is that the resist has an extremely 
high contrast, meaning that at a certain level   of EUV light, the entirety of the resist hit by 
that light is broken down. This is critical in   producing sharp patterns and walls on the resist.
Let’s next explore how the wafer and wafer stage   move around. Specifically, the wafer stages 
levitate on a large magnetic table composed of   more than a thousand magnets. Electromagnets 
on the underside of the wafer stage move it   along this magnetic table both quickly and with 
micrometer level accuracy while interferometers   on the top of the stage measure its exact position 
and this setup is called the long-stroke stage.  In order to secure the wafer, it’s placed 
on a plate which is technically called an   electrostatic clamp. The clamp cycles zones of 
high voltage across the backside of the wafer   to keep it in place, a phenomenon similar 
to sticking a ballon to a wall using static   electricity. To reach nanometer level accuracy 
the plate is independently moved using smaller   motors which is called the short-stroke stage.
By combining the long stroke and short stroke   stages along with measurement encoders, the 
machine can quickly move the wafer as it’s   being patterned and maintain an accuracy of less 
than 1 nanometer or approximately 4 silicon atoms.  Once all the microchip patterns are copied to the 
wafer, the stage moves back towards the robotic   arms where the wafer is unloaded and placed 
into one of the vacuum load locks, pumped back   to atmosphere, and then a separate robotic arm 
brings the wafer back to the track tool, where the   patterned and modified resist is washed away using 
a developing liquid. Finally, the wafer is heated   again to further harden the remaining resist. The 
patterned wafer is then loaded back into the foup   which is picked up and brought to a different 
tool to undergo processing in other ways.  Let’s close this tool and that’s it for 
our journey into photolithography. If   you have any questions, feel free 
to ask them in the comments below.  We’re thankful to all our Patreon and YouTube 
Membership Sponsors for supporting our videos.   If you want to financially support our work, 
you can find the links in the description below.  This is Branch Education, and we create 
3D animations that dive deeply into the   technology that drives our modern 
world. Watch another Branch video   by clicking one of these cards or click here 
to subscribe. Thanks for watching to the end!

---

## 3. How do Transistors Build into a CPU?  🖥️🤔  How do Transistors Work? 🖥️🤔
**Channel:** Branch Education | **Views:** 2.2M | **Date:** 7 months ago | **Duration:** 26:45 | **ID:** _Pqfjer8-O4
**Link:** https://youtube.com/watch?v=_Pqfjer8-O4

### Transcript:
Inside your computer are dozens of microchips with 
tens of billions of transistors. You may know that   these transistors are the cornerstone 
of all technology, are manufactured in   multibillion-dollar factories, and are only a few 
nanometers in size. But what you may not know is   that this network of billions of transistors 
is actually organized a lot like Lego bricks   connected together in order to build a Lego 
set such as this 7541-piece Millennium Falcon.  In this video, we’ll explore how the transistors 
inside your computer are like Lego Bricks,   what transistors actually look like, how they 
perform basic logic, and finally, how 26 billion   transistors are organized into the different 
sections of the CPU. So, let’s dive right in.  This video is sponsored by Brilliant.org.
Let’s begin with exploring Lego Bricks and   Transistors. In this analogy, we’ll equate one 
transistor to a single stud on a Lego brick. On   their own, neither one does much at all. However, 
when a few transistors are connected together they   form a standard cell which is the fundamental 
building block of every CPU and GPU. Similarly,   multiple studs form a Lego Piece which is 
the building block for all Lego creations.   For example, two transistors connected 
together form an inverter standard cell,   4 transistors connected together form a NAND 
Gate, and 6 transistors form an OR gate.  There are many other standard cells built by 
connecting transistors together, and similarly,   there are a wide range of Lego Pieces with 
varying numbers of studs and shapes. But   before we explore some of the more complicated 
standard cells, we first need to understand how   one of the simplest standard cells works. Let’s 
examine the inverter which is analogous to a   one by two Lego brick. Its function is simply 
to take an input of a 1 and output a 0 or vice   versa. This inverter has a logic symbol like 
this, and the standard cell look like this.   Essentially standard cells like this inverter, are 
the real-world physical structure of a logic gate,   and it’s what you would see if you could open up 
and zoom into a nanoscopic view of the processor   in your smartphone. So let’s see how it works.
At the bottom of the standard cell are two   transistors built on top of a silicon base. 
We’ll focus on one of these transistors which   has been simplified a little bit for the sake 
of this explanation. Inside this transistor are   a few key parts: the gate, the channel, and the 
dielectric which is a barrier that separates the   two and prevents electricity from passing through. 
Additionally, on either side of the channel and   above the gate are metal contacts connected to 
vertical vias that are used to input and output   electricity to the corresponding parts.
So how does this transistor work? Well,   when 1 volt is applied or input to the gate, 
electricity is able to flow through the channel,   essentially connecting one side of the channel to 
the other side. However, when 0 volts is applied   to the gate, electricity cannot flow through, 
resulting in electrically separating or isolating   the two sides of the channel. A quick analogy 
is to think of the channel and gate as a water   faucet and handle. When the handle is turned on, 
water can flow and when the handle is turned off,   the water is stopped. The name of this transistor 
is an N-Type FinFet due to its fin-like shape.   Here’s the symbol for a simple N-Type transistor, 
and again, when 1 volt is applied to the gate,   electricity can flow through the channel.
Let’s bring in a second transistor over here   which is the same FinFet shape, but functions 
a little differently and is called a P-Type   transistor. Specifically, it’s designed to operate 
in the exact opposite fashion where, when 1 volt   is applied to the gate, electricity cannot flow 
through the channel, and when 0 volts is applied   to the gate, electricity can flow through. 
Using our water faucet analogy from before,   this transistor is like a faulty water faucet 
where, when the handle is down the water is on,   and in order to turn the water off, you have to 
actively lift the handle. This is the symbol for   the P-Type transistor, and the circle on the 
gate indicates the inverted functionality.  Now that we have two transistors, one N-Type and 
the other P-Type, let’s connect the gate between   the two of them and merge the input gate contacts 
together into a single contact. As a result,   a single input voltage on the gate, which 
can be either one volt or zero volts,   travels to the shared gate and controls both of 
the transistors. Because the N-Type and P-Type   transistors are opposite of each other, when 0 
volts is applied to the gate, the P-Type will   allow electricity to flow through the channel and 
is considered ON and the N-Type will be OFF. And   then, when 1 volt is applied to the gate, the 
N-Type and P-Type FinFets flip to ON and OFF,   and the N-Type allows electricity to 
flow through while the P-Type doesn’t.  The next step is to bring in the power and ground 
rails above the transistors. The power rail is   at 1 volt, and the ground rail at 0 volts, 
and they always stay at 1 and 0 volts. Next,   we add some wires to the design, and to do 
that we use the contact points and build   vertical vias that connect both sides of the 
transistor along with the power rails to a   layer of wires called local interconnects. 
The power rails, vias, and interconnects are   simply wires made from conductive metals 
such as copper, tungsten or aluminum,   and just carry electricity around in intricate 
paths of wires. Let’s add a label for the input   which is the electrical wire that connects to 
the shared gate, and a label for the output over   here which connects to the local interconnect wire 
attached to a side of each of the two transistors.  Now that we have a complete standard cell, what 
happens when 1 volt is applied to the input?   Well 1 volt travels down to the shared gate that 
controls both of the transistors, and as a result,   the N-Type transistor turns On, and the P-Type 
transistor turns Off. With the N-Type transistor   on, electricity can flow through its channel which 
results in 0 volts from the ground rail traveling   through the local interconnects, down a vertical 
via, through the channel of the N-Type FinFet,   then back up a vertical via on the other side, 
across a separate section of local interconnects,   and finally to the output. Thus the input 
of 1 volt results in an output of 0 volts.   At the same time, because the same 1-volt input 
controls the P-Type transistor which is OFF,   no electricity flows through it, and 
this section of wire is isolated.  So then what happens when 0 volts is applied 
to the input? Well, the opposite happens. The   P-Type transistor turns ON, and the 1-volt rail 
is connected through the local interconnect wires   and vias, through the P-Type’s channel, back up a 
vertical via, and to the output, thus turning a 0   into a 1. At the same time, the N-Type transistor 
is off and this section of wire is isolated.  One thing to note is that while these wires 
may look like they’re floating 3 dimensional   structures, all the empty spaces are in fact 
filled with insulating material called dielectric.   This may have been a rather long explanation, 
but truly understanding the basic function   of the inverter standard cell is critical to 
understanding the more complicated ones such as   this NAND gate, this AND gate or this Exclusive 
OR gate, which we’ll discuss in a little bit.  Let’s now take a second and discuss some 
of the details that might be taught in an   electrical engineering course. Here’s the symbol 
for an inverter and its logic table, and again,   an input of a 1 outputs a 0 and vice versa. Next, 
here’s the schematic where you can see the 1-volt   power rail above and the 0-volt ground rail below, 
and here are the two simplified transistors with   the bottom one N-Type, and the top one a P-Type. 
The input to the gates is connected together,   however, we typically break them apart and 
label them with the same input name. Next,   the output is positioned in the middle 
of the two transistors. As a result,   when 1 volt is applied to input A, the output is 
connected to the ground rail, and when 0 is input,   the output is connected to the power rail.
Now that we’ve thoroughly explored this inverter,   let’s dive into some of the more complicated 
standard cells such as these NAND and NOR   gates with 4 transistors, the AND and OR gates 
with 6 transistors, and the Exclusive OR and   Exclusive NOR gates with 10 transistors inside 
of it. First however, let’s continue discussing   how standard cells are like Lego Bricks.
As mentioned earlier, there is a wide range   of standard cells built by connecting together 
different numbers of transistors using the   local interconnects, and similarly, there’s a wide 
range of Lego pieces built by connecting different   numbers of studs in varying configurations.
So to continue our analogy, if a Lego stud is an   individual transistor, and Lego bricks and pieces 
are standard cells, then the equivalent to a Lego   Set is a Macrocell. For example, here are 350 
Lego Pieces used to build a Starfighter Lego Set,   and likewise, here are approximately 160 standard 
cells connected to form a Macrocell that can add   two numbers together. In order to connect 
each of the 160 standard cells together,   a higher layer of vertical vias and wires, 
called Metal 1 or M1, is used. When we zoom   in we can find the individual standard cells all 
fitting between multiple rows of the 1 volt power   and 0 volt ground rails. As you may have figured 
out already, this circuit uses binary 1s and 0s,   and the input numbers that are added together 
are sent to this Macrocell using 1 volt or 0 volt   on these 2 sets of 32 wires, and then the binary 
output is carried along these 33 wires over here.  Let’s continue this analogy further. Just like 
there are thousands of different Lego Sets,   there’s a wide range of different Macrocells, 
some having thousands upon thousands of standard   cells inside of them. For example, a more 
complicated function is multiplication   which takes in two numbers, multiplies them 
together, and then outputs the result. However,   to perform multiplication, we need a much 
larger Macrocell, such as this one which   is built from 6,100 standard cells. The 
complexity of the 32-bit multiplication   Macrocell is similar to the complexity of this 
Millennium Falcon Lego set built from around   7500 Lego Pieces. One note is that Macrocells 
are also called Modules, Functional Blocks,   Functional Units, or just Blocks or Units.
So now that we’ve seen a couple Macrocells,   what’s the next step up? Well, multiple 
Macrocells are combined into an IP Core,   and then multiple IP cores are combined into a 
Core or hardware accelerator, and these elements   are then combined into a complete chip such as 
this processor, which can be found inside this CPU   package mounted onto a motherboard. Processors are 
incredibly complicated with tens of billions of   transistors inside of them. So here’s a little bit 
of insight into how they work, again using Lego.  Lego pieces are pretty simple objects. For 
example, this pile of Lego bricks may hurt   when you step on it, but overall it isn’t 
that interesting or impressive. However,   when you meticulously assemble thousands of Lego 
Pieces together, you can build an impressive Lego   creation. Likewise, an individual transistor might 
seem pretty mundane, and a standard cell or a   basic logic gate that can only flip a 1 to 0 isn’t 
all that useful on its own. However, the key is   that when you have tens of thousands of scientists 
and engineers assembling billions of standard   cells and logic gates together in what can be 
thought of as a multi-billion-piece Lego set,   well then, we get an integrated circuit capable 
of browsing the internet, playing YouTube videos,   or running video games with incredible graphics.
By the way, thus far, we showed you the local   interconnect layer for the standard cells 
and one metal layer called M1 which is   used to build small Macrocells. In fact, 
CPUs use around 17 metal layers of wires   connected together to form the Macrocells, IP 
cores, Cores, and other sections of the CPU.  CPUs are incredibly powerful devices, but 
when you boil them down, it’s just a bunch   of transistors and logic gates connected together 
using kilometers of wires. Throughout this video   we’ve assumed that you have a basic understanding 
of logic gates, but if you want to learn more   about how logic works, we recommend you check 
out Brilliant.org, the sponsor of this video.   Brilliant is an educational platform with 
thousands of interactive lessons in math,   science, programming, data analysis, along with 
two courses on logic. Brilliant’s mission is to   create a world of better problem solvers, 
and every one of their courses is crafted   with a hands-on problem solving approach that 
helps build understanding from the ground up.  We love to use Brilliant because each of their 
lessons is only 10 minutes long and their entire   catalog can be accessed using the Brilliant app 
on your phone. Learning a little every day is one   of the most important things you can do, both for 
your career and for your mental health. Consider   this, if you were to use the Brilliant app instead 
of mindlessly scrolling, in a couple weeks you   could build an in-depth understanding of how AI 
and Large Language Models work, and then after   that you could, for example, learn how to program 
in Python, or see how Quantum Computers work.  With each lesson only 10 minutes long it’s a 
no brainer that you should delete addictive   and time wasting apps, and learn something 
new using the Brilliant app on your phone.  You can sign up for free using the link: 
Brilliant.org/BranchEducation and for a   whole month you’ll have full access to their 
entire catalog of courses. If you like their   content and decide to stick around, the link will 
also save you 20% off an annual subscription. You   can also find this link in the description below.
So let’s get back to exploring some of the more   complicated standard cells. Specifically we’ll 
start with this NAND gate, then the AND gate,   and then discuss the other types of logic gates.
This NAND gate performs the logic of AND followed   by a NOT. Using the Lego analogy, the NAND gate 
would be equivalent to a 2 by 2 Lego brick. We’ll   move a little bit faster than our explanation 
of the inverter and start with the logic symbol,   truth table, and schematic. To build a NAND gate 
we use two P-Type transistors in parallel above   and two N-Type in series below. The two inputs 
for the NAND gate are connected to one of each   of the transistor’s gates, and the output is 
in the middle of the channels. In order for the   output to be a 0, both of the inputs need to be 
ones, thus turning both N-Types on and creating   a path from the ground rail to the output. For 
the output to be a 1, we need either or both of   the P-Type transistors to be on, thus creating 
a path from the 1-volt power rail to the output.  Let’s see how we turn this logic into a 
physical standard cell. Here are the two   P-Type transistors above, and the two N-types 
below, as well as the power and ground rails.   To control these transistors the two inputs, 
labeled input A and input B, are connected   to the center of each of the gates which span 
across one set of N-Type and P-type transistors.  In order to build the P-Type transistors in 
parallel, we connect the power rail to one   side of each of the transistors, and the output 
is connected in the middle. You can see that when   either or both of these P-Type transistors is ON, 
which happens when a 0 is applied to either of   the inputs, then the 1-volt rail is connected 
through that P-type transistor to the output.   As a result, an input of 0 0, 0 1, or 1 0 yields 
an output of a 1. And again, these transistors   are in parallel because either or both need 
to be on for 1 volt to travel to the output.  Next let’s look at the N-Type transistors which 
are placed in series with one another. To build   this, the ground rail is connected to 
one side of both of the transistors,   and the output is connected to the opposite 
side. Therefore, for 0 volts from the ground   rail to travel through these transistors, both 
N-types need to be ON, which happens when both   N-Types are connected to 1 volt. Thus an input 
of 1 1 yields an output of a 0. Again, these   transistors are in series because both need to be 
turned ON to allow electricity to flow through.  One note is that thus far we’ve been showing 
the power rail above and the ground rail   below. However, in the addition Macrocell we 
showed earlier, the power and ground rails are   alternated, and therefore half of the standard 
cells have the power rail below and the ground   above. To accommodate this, the standard cell 
is flipped around with the P-type transistors   on the bottom and the N-Type on Top, but it 
still works the same way, and if we rotate   the camera, well, it looks the same as before.
We’re going to get to the other logic gates in a   second, but first we want to say that this video’s 
script was actually one of the hardest to write.   In the first 28 drafts of the script, we were 
trying to explain how standard cells work and   how logic gates are used to multiply two numbers, 
which looks like this. However, we decided to move   the lesson on how logic gates perform math into 
an entirely separate video and focus this video on   the design of standard cells. As a result, this 
video has taken close to 54 script revisions,   and 6 times I just threw out large sections 
and restructured the whole script. So, we have   one ask from you the viewer: if you’ve enjoyed 
watching this video and learned something new,   could you take just a few seconds to write a 
quick comment below, subscribe to the channel,   like this video, and most importantly, share 
it with a friend, family member, or colleague.   We would greatly appreciate it. Thank you.
Let’s next take a look at this AND gate.   Here’s the schematic along with the logic table. 
Essentially an AND gate is a combination of a NAND   gate with an inverter tacked on. Let’s take a look 
at the standard cell. Here you can see the NAND   gate with two inputs, and the output of the NAND 
gate being carried to the input of the inverter,   with the overall output right here. As a result, 
when we input two ones, the output is also a 1,   however if either or both inputs are 0s then the 
output is a 0. The NOR and OR Logic gates use very   similar setups to the NAND and AND cells. A NOR 
gate is simply a NAND gate, but with two P-Types   connected in series and the N-Types in Parallel. 
And then an OR gate is a NOR gate with an inverter   tacked on. Pause the video to work out the logic.
Exclusive Or and Exclusive NOR gates are a little   more complicated and require a total of 10 
transistors each because the logic needs to   account for only one of the inputs being on. Here 
is the standard cell for an Exclusive OR gate.   We’ll spend a few seconds flying around it and 
showing the different layers, so see if you can   draw a schematic and work out how it works.
Next, here’s the corresponding schematic.  And then here’s what it looks 
like with an input of 1 and 0.  And then here it is with an input of 
0 and 0 and then an input of 1 and 1.  When we look at an Exclusive NOR gate 
we can see that it’s rather similar,   just with the series and parallel n-type 
and p-type transistors flipped around.  So one question is: How do we make 
an AND gate with 3 inputs? What about   an exclusive OR gate with 4 inputs?
Let’s end this lesson by discussing a   few important technical details and notes.
The first is that this circuit is called a   complementary metal oxide semiconductor or 
CMOS circuit. This is due to the two types   of transistors, N-Type and P-Type functioning 
opposite each other. These circuits have a high   noise tolerance, and low power consumption because 
one of the pairs of transistors is always off,   and, if designed correctly, there is never a 
path between the 1 volt rail and the ground rail.  The second note is that although the explanation 
for how an inverter works took around 10 minutes,   in actuality it physically takes just a few 
picoseconds or 10 to the negative 12 seconds   between the input changing from 0 to 1 volt 
to the gates and then for the transistors to   change their states, and then for 0 volts from 
the ground rail to travel to the output. With   each standard cell taking a few picoseconds to 
complete its logic, the multiplication macrocell   with over 6000 standard cells takes around 
150 to 200 Picoseconds between the inputs   coming in and all the standard cells completing 
their logic and changing their states to yield   the correct value on the output wires.
The third note is that transistors are   incredibly complicated. For example, most finfets 
are built from multiple fins in order to improve   electrical characteristics. If you’re wondering 
how transistors are made or how they work, well,   we’re planning multiple videos that 
will explore transistor manufacturing,   transistor physics, why CMOS circuits use 
P-Type transistors above and N-Types below,   and the evolution and future of transistor 
design. Subscribe so you don’t miss it.  The final note is that we’d like 
to give a shoutout to Matt Venn,   who was vital in helping us get these accurate 
standard cell layouts. He runs the Zero to ASIC   Course YouTube channel and we recommend you 
check it out if you want to learn more about   integrated circuit design. Additionally, he 
runs a service called TinyTapeout which allows   you to manufacture your own integrated circuit.
We’re thankful to all our Patreon and YouTube   Membership Sponsors for supporting our videos. 
If you want to financially support our work,   you can find the links in the description below.
This is Branch Education, and we create 3D   animations that dive deeply into the technology 
that drives our modern world. Watch another Branch   video by clicking one of these cards or click 
here to subscribe. Thanks for watching to the end!

---

## 4. How do Graphics Cards Work?  Exploring GPU Architecture
**Channel:** Branch Education | **Views:** 6.7M | **Date:** 1 year ago | **Duration:** 28:30 | **ID:** h9Z4oGN89MU
**Link:** https://youtube.com/watch?v=h9Z4oGN89MU

### Transcript:
How many calculations do you think your 
graphics card performs every second   while running video games with incredibly 
realistic graphics? Maybe 100 million? Well,   100 million calculations a second is what’s 
required to run Mario 64 from 1996. We need   more power. Maybe 100 billion calculations a 
second? Well, then you would have a computer   that could run Minecraft back in 2011. In order 
to run the most realistic video games such as   Cyberpunk 2077 you need a graphics card that can 
perform around 36 trillion calculations a second.  This is an unimaginably large number, so let’s 
take a second to try to conceptualize it. Imagine   doing a long multiplication problem once every 
second. Now let’s say everyone on the planet does   a similar type of calculation but with different 
numbers. To reach the equivalent computational   power of this graphics card and its 36 trillion 
calculations a second we would need about 4,400   Earths filled with people, all working together 
and completing one calculation each every second.   It’s rather mind boggling to think that a 
device can manage all these calculations,   so in this video we’ll see how graphics cards work 
in two parts. First, we’ll open up this graphics   card and explore the different components inside, 
as well as the physical design and architecture   of the GPU or graphics processing unit. Second, 
we’ll explore the computational architecture and   see how GPUs process mountains of data, and why 
they’re ideal for running video game graphics,   Bitcoin mining, neural networks and AI.
So, stick around and let’s jump right in.  This video is sponsored by 
Micron which manufactures   the graphics memory inside this graphics card.
Before we dive into all the parts of the GPU,   let’s first understand the differences between 
GPUs and CPUs. Inside this graphics card,   the Graphics Processing Unit or GPU has over 
10,000 cores. However, when we look at the   CPU or Central Processing Unit that’s mounted to 
the motherboard, we find an integrated circuit or   chip with only 24 cores. So, which one is more 
powerful? 10 thousand is a lot more than 24,   so you would think the GPU is more powerful, 
however, it’s more complicated than that.  A useful analogy is to think of a GPU as a massive 
cargo ship and a CPU as a jumbo jet airplane.   The amount of cargo capacity is the amount of 
calculations and data that can be processed,   and the speed of the ship or airplane is the 
rate at which how quickly those calculations   and data are being processed. Essentially, 
it’s a trade-off between a massive number   of calculations that are executed at a 
slower rate versus a few calculations   that can be performed at a much faster rate.
Another key difference is that airplanes are a   lot more flexible since they can carry passengers, 
packages, or containers and can take off and land   at any one of tens of thousands of airports. 
Likewise CPUs are flexible in that they can run   a variety of programs and instructions. However, 
giant cargo ships carry only containers with bulk   contents inside and are limited to traveling 
between ports. Similarly, GPUs are a lot   less flexible than CPUs and can only run simple 
instructions like basic arithmetic. Additionally   GPUs can’t run operating systems or interface 
with input devices or networks. This analogy   isn’t perfect, but it helps to answer the question 
of “which is faster, a CPU or a GPU?”. Essentially   if you want to perform a set of calculations 
across mountains of data, then a GPU will be   faster at completing the task. However, if you 
have a lot less data that needs to be evaluated   quickly than a CPU will be faster. Furthermore, 
if you need to run an operating system or support   network connections and a wide range of different 
applications and hardware, then you’ll want a CPU.  We’re planning a separate video on CPU 
architecture, so make sure to subscribe   so you don’t miss it, but let’s now dive into this 
graphics card and see how it works. In the center   of this graphics card is the printed circuit 
board or PCB, with all the various components   mounted on it, [Animator Note: Highlight and list 
out the various parts that will be covered.] and   we’ll start by exploring the brains which is 
the graphics processing unit or GPU. When we   open it up, we find a large chip or die named 
GA102 built from 28.3 billion transistors. The   majority of the area of the chip is taken up by 
the processing cores which have a hierarchical   organization. Specifically, the chip is divided 
into 7 Graphics Processing Clusters or GPCs,   and within each processing cluster are 12 
streaming multiprocessors or SMs. Next,   inside each of these streaming multiprocessors 
are 4 warps and 1 ray tracing core, and then,   inside each warp are 32 Cuda or shading cores and 
1 tensor core. Across the entire GPU are 10752   CUDA cores, 336 Tensor Cores, and 84 Ray Tracing 
Cores. These three types of cores execute all the   calculations of the GPU, and each has a different 
function. CUDA cores can be thought of as simple   binary calculators with an addition button, a 
multiply button and a few others, and are used   the most when running video games. Tensor cores 
are matrix multiplication and addition calculators   and are used for geometric transformations 
and working with neural networks and AI. And   ray tracing cores are the largest but the fewest 
and are used to execute ray tracing algorithms.  Now that we understand the computational 
resources inside this chip, one rather interesting   fact is that the 3080, 3090, 3080 ti, and 3090 ti 
graphics cards all use the same GA102 chip design   for their GPU. This might be counterintuitive 
because they have different prices and were   released in different years, but it’s true. 
So, why is this? Well, during the manufacturing   process sometimes patterning errors, dust 
particles, or other manufacturing issues   cause damage and create defective areas of the 
circuit. Instead of throwing out the entire chip   because of a small defect, engineers find the 
defective region and permanently isolate and   deactivate the nearby circuitry. By having a GPU 
with a highly repetitive design, a small defect in   one core only damages that particular streaming 
multiprocessor circuit and doesn’t affect the   other areas of the chip. As a result, these chips 
are tested and categorized or binned according   to the number of defects. The 3090ti graphics 
cards have flawless GA102 chips with all 10752   CUDA cores working properly, the 3090 has 10,496 
cores working, the 3080ti has 10,240 and the 3080   has 8704 CUDA cores working, which is equivalent 
to having 16 damaged and deactivated streaming   multiprocessors. Additionally, different graphics 
cards differ by their maximum clock speed and the   quantity and generation of graphics memory that 
supports the GPU, which we’ll explore in a little   bit. Because we’ve been focusing on the physical 
architecture of this GA102 GPU chip, let’s zoom   into one of these CUDA cores and see what it looks 
like. Inside this simple calculator is a layout   of approximately 410 thousand transistors. This 
section of 50 thousand transistors performs the   operation of A times B plus C which is called 
fused multiply and add or FMA and is the most   common operation performed by graphics cards. 
Half of the CUDA cores execute FMA using 32-bit   floating-point numbers, which is essentially 
scientific notation, and the other half   of the cores use either 32-bit integers or 32-bit 
floating point numbers. Other sections of this   core accommodate negative numbers and perform 
other simple functions like bit-shifting and bit   masking as well as collecting and queueing 
the incoming instructions and operands,   and then accumulating and outputting the results. 
As a result, this single core is just a simple   calculator with a limited number of functions. 
This calculator completes one multiply and one add   operation each clock cycle and therefore with this 
3090 graphics cards and its 10496 cores and 1.7   gigahertz clock, we get 35.6 trillion calculations 
a second. However, if you’re wondering how the GPU   handles more complicated operations like division, 
square root, and trigonometric functions, well,   these calculator operations are performed by 
the special function units which are far fewer   as only 4 of them can be found in each streaming 
multiprocessor. Now that we have an understanding   of what’s inside a single core, let’s zoom out 
and take a look at the other sections of the GA102   chip. Around the edge we find 12 graphics memory 
controllers, the NVLink Controllers and the PCIe   interface. On the bottom is a 6-megabyte Level 
2 SRAM Memory Cache, and here’s the Gigathread   Engine which manages all the graphics processing 
clusters and streaming multiprocessors inside.  Now that we’ve explored this GA102 GPU’s physical 
architecture, let’s zoom out and take a look at   the other parts inside the graphics card. On this 
side are the various ports for the displays to be   plugged into, on the other side is the incoming 
12 Volt power connector, and then here are the   PCIe pins that plug into the motherboard. On 
the PCB, the majority of the smaller components   constitute the voltage regulator module which 
takes the incoming 12 volts and converts it to   one point one volts and supplies hundreds 
of watts of power to the GPU. Because all   this power heats up the GPU, most of the weight 
of the graphics card is in the form of a heat   sink with 4 heat pipes that carry heat from the 
GPU and memory chips to the radiator fins where   fans then help to remove the heat. Perhaps some of 
the most important components, aside from the GPU,   are the 24 gigabytes of graphics memory chips 
which are technically called GDDR6X SDRAM and   were manufactured by Micron which is the sponsor 
of this video. Whenever you start up a video game   or wait for a loading screen, the time it takes 
to load is mostly spent moving all the 3D models   of a particular scene or environment from the 
solid-state drive into these graphics memory   chips. As mentioned earlier, the GPU has a small 
amount of data storage in its 6-megabyte shared   Level 2 cache which can hold the equivalent of 
about this much of the video game’s environment.   Therefore in order to render a video game, 
different chunks of scene are continuously being   transferred between the graphics memory and the 
GPU. Because the cores are constantly performing   tens of trillions of calculations a second, 
GPUs are data hungry machines and need to be   continuously fed terabytes upon terabytes of data, 
and thus these graphics memory chips are designed   kind of like multiple cranes loading a cargo ship 
at the same time. Specifically, these 24 chips   transfer a combined 384 bits at a time, which 
is called the bus width and the total data that   can be transferred, or the bandwidth is about 1.15 
terabytes a second. In contrast the sticks of DRAM   that support the CPU only have a 64-bit bus width 
and a maximum bandwidth closer to 64 gigabytes a   second. One rather interesting thing is that you 
may think that computers only work using binary   ones and zeros. However, in order to increase data 
transfer rates, GDDR6X and the latest graphics   memory, GDDR7 send and receive data across the bus 
wires using multiple voltage levels beyond just   0 and 1. For example, GDDR7 uses 3 different 
encoding schemes to combine binary bits into   ternary digits or PAM-3 symbols with voltages of 
0, 1, and negative 1. Here’s the encoding scheme   on how 3 binary bits are encoded into 2 ternary 
digits and this scheme is combined with an 11   bit to 7 ternary digit encoding scheme resulting 
in sending 276 binary bits using only 176 ternary   digits. The previous generation, GDDR6X, which 
is the memory in this 3090 graphics card, used a   different encoding scheme, called PAM-4, to send 
2 bits of data using 4 different voltage levels,   however, engineers and the graphics memory 
industry agreed to switch to PAM-3 for future   generations of graphics chips in order to reduce 
encoder complexity, improve the signal to noise   ratio, and improve power efficiency. Micron 
delivers consistent innovation to push the   boundaries on how much data can be transferred 
every second and to design cutting edge memory   chips. Another advancement by Micron is the 
development of HBM, or the high bandwidth memory,   that surrounds AI chips. HBM is built from 
stacks of DRAM memory chips and uses TSVs   or through silicon vias, to connect this stack 
into a single chip, essentially forming a cube   of AI memory. For the latest generation of high 
bandwidth memory, which is HBM3E, a single cube   can have up to 24 to 36 gigabytes of memory, thus 
yielding 192 gigabytes of high-speed memory around   the AI chip. Next time you buy an AI accelerator 
system, make sure it uses Micron’s HBM3E which   uses 30% less power than the competitive products. 
However, unless you’re building an AI data center,   you’re likely not in the market to buy one 
of these systems which cost between 25 to   40 thousand dollars and are on backorder for a 
few years. If you’re curious about high bandwidth   memory, or Micron’s next generation of graphics 
memory take a look at one of these links in the   description. Alternatively, if designing the next 
generation of memory chips interests you, Micron   is always looking for talented scientists and 
engineers to help innovate on cutting edge chips   and you can find out more about working for Micron 
using this link. Now that we’ve explored many of   the physical components inside this graphics card 
and GPU, let’s next explore the computational   architecture and see how applications like video 
game graphics and bitcoin mining run what’s called   “embarrassingly” parallel operations. Although 
it may sound like a silly name, embarrassingly   parallel is actually a technical classification 
of computer problems where little or no effort is   needed to divide the problem into parallel tasks, 
and video game rendering and bitcoin mining easily   fall into this category. Essentially, GPUs solve 
embarrassingly parallel problems using a principle   called SIMD, which stands for single instruction 
multiple data where the same instructions or steps   are repeated across thousands to millions of 
different numbers. Let’s see an example of how   SIMD or single instruction multiple data is used 
to create this 3D video game environment. As you   may know already, this cowboy hat on the table is 
composed of approximately 28 thousand triangles   built by connecting together around 14,000 
vertices, each with X, Y, and Z coordinates.   These vertex coordinates are built using a 
coordinate system called model space with the   origin of 0,0,0 being at the center of the hat.
To build a 3D world we place hundreds of objects,   each with their own model space into the world 
environment and, in order for the camera to be   able to tell where each object is relative to 
other objects, we have to convert or transform   all the vertices from each separate model space 
into the shared world coordinate system or world   space. So, as an example, how do we convert the 
14 thousand vertices of the cowboy hat from model   space into world space? Well, we use a single 
instruction which adds the position of the origin   of the hat in world space to the corresponding 
X,Y, and Z coordinate of a single vertex in   model space. Next we copy this instruction to 
multiple data, which is all the remaining X,Y,   and Z coordinates of the other thousands of 
vertices that are used to build the hat. Next,   we do the same for the table and the rest of 
the hundreds of other objects in the scene,   each time using the same instructions but with 
the different objects’ coordinates in world space,   and each objects’ thousands of vertices in model 
space. As a result, all the vertices and triangles   of all the objects are converted to a common 
world space coordinate system and the camera   can now determine which objects are in front 
and which are behind. This example illustrates   the power of SIMD or single instruction multiple 
data and how a single instruction is applied to   5,629 different objects with a total of 8.3 
million vertices within the scene resulting   in 25 million addition calculations. The key to 
SIMD and embarrassingly parallel programs is that   every one of these millions of calculations 
has no dependency on any other calculation,   and thus all these calculations can be distributed 
to the thousands of cores of the GPU and completed   in parallel with one another. It's important to 
note that vertex transformation from model space   to world space is just one of the first steps of 
a rather complicated video game graphics rendering   pipeline and we have a separate video that delves 
deeper into each of these other steps. Also,   we skipped over the transformations for the 
rotation and scale of each object, but factoring   in these values is a similar process that requires 
additional SIMD calculations. Now that we have a   simple understanding of SIMD, let’s discuss how 
this computational architecture matches up with   the physical architecture. Essentially, each 
instruction is completed by a thread and this   thread is matched to a single CUDA core. Threads 
are bundled into groups of 32 called warps,   and the same sequence of instructions is issued to 
all the threads in a warp. Next warps are grouped   into thread blocks which are handled by the 
streaming multiprocessor. And then finally thread   blocks are grouped into grids, which are computed 
across the overall GPU. All these computations are   managed or scheduled by the Gigathread Engine, 
which efficiently maps thread blocks to the   available streaming multiprocessors. One important 
distinction is that within SIMD architecture,   all 32 threads in a warp follow the same 
instructions and are in lockstep with each   other, kind of like a phalanx of soldiers moving 
together. This lock step execution applied to GPUs   up until around 2016. However, newer GPUs follow 
a SIMT architecture or single instruction multiple   threads. The difference between SIMD and SIMT is 
that while both send the same set of instructions   to each thread, with SIMT, the individual 
threads don’t need to be in lockstep with   each other and can progress at different rates. 
In technical jargon, each thread is given its own   program counter. Additionally, with SIMT all the 
threads within a streaming multiprocessor use a   shared 128 kilobyte L1 cache and thus data that’s 
output by one thread can be subsequently used by   a separate thread. This improvement from SIMD to 
SIMT allows for more flexibility when encountering   warp divergence via data-dependent conditional 
branching and easier reconvergence for the threads   to reach the barrier synchronization. Essentially 
newer architectures of GPUs are more flexible and   efficient especially when encountering branches 
in code. One additional note is that although   you may think that the term warp is derived from 
warp drives, it actually comes from weaving and   specifically the Jacquard Loom. This loom from 
1804 used programmable punch cards to select   specific threads out of a set to weave together 
intricate patterns. As fascinating as looms are,   let’s move on. The final topics we’ll explore are 
bitcoin mining, tensor cores and neural networks.   But first we’d like to ask you to ‘like’ 
this video, write a quick comment below,   share it with a colleague, friend or on social 
media, and subscribe if you haven’t already.   The dream of Branch Education is to make free 
and accessible, visually engaging educational   videos that dive deeply into a variety topics on 
science, engineering, and how technology works,   and then to combine multiple videos into an 
entirely free engineering curriculum for high   school and college students. Taking a few seconds 
to like, subscribe, and comment below helps us   a ton! Additionally, we have a Patreon page 
with AMAs and behind the scenes footage, and,   if you find what we do useful, we would appreciate 
any support. Thank you. So now that we’ve explored   how single instruction multiple threads is used 
in video games, let’s briefly discuss why GPUs   were initially used for mining bitcoin. We’re not 
going to get too far into the algorithm behind   the blockchain and will save it for a separate 
episode, but essentially, to create a block on   the blockchain, the SHA-256 hashing algorithm is 
run on a set of data that includes transactions,   a time stamp, additional data, and a random number 
called a nonce. After feeding these values through   the SHA-256 hashing algorithm a random 256-bit 
value is output. You can kind of think of this   algorithm as a lottery ticket generator where you 
can’t pick the lottery number, but based on the   input data, the SHA-256 algorithm generates 
a random lottery ticket number. Therefore,   if you change the nonce value and keep the rest 
of the transaction data the same, you’ll generate   a new random lottery ticket number. The winner of 
this bitcoin mining lottery is the first randomly   generated lottery number to have the first 80 bits 
all zeroes, while the rest of the 176 values don’t   matter and once a winning bitcoin lottery ticket 
is found, the reward is 3 bitcoin and the lottery   resets with a new set of transactions and input 
values. So, why were graphics cards used? Well,   GPUs ran thousands of iterations of the SHA-256 
algorithm with the same transactions, timestamp,   other data, but, with different nonce values. 
As a result, a graphics card like this one could   generate around 95 million SHA-256 hashes or 95 
million randomly numbered lottery tickets every   second, and hopefully one of those lottery numbers 
would have the first 80 digits as all zeros.   However, nowadays computers filled with ASICs or 
application specific integrated circuits perform   250 trillion hashes a second or the equivalent 
of 2600 graphics cards, thereby making graphics   cards look like a spoon when mining bitcoin next 
to an excavator that is an asic mining computer.   Let’s next discuss the design of the tensor cores. 
It’ll take multiple full-length videos to cover   generative AI, and neural networks, so we’ll focus 
on the exact matrix math that tensor cores solve.   Essentially, tensor cores take three matrices and 
multiply the first two, add in the third and then   output the result. Let’s look at one value of the 
output. This value is equal to the sum of values   of the first row of the first matrix multiplied 
by the values from the first column of the   second matrix, and then the corresponding 
value of the third matrix is added in.   Because all the values of the 3 input 
matrices are ready at the same time,   the tensor cores complete all of the matrix 
multiplication and addition calculations   concurrently. Neural Networks and generative 
AI require trillions to quadrillions of matrix   multiplication and addition operations and 
typically uses much larger matrices. Finally,   there are Ray Tracing Cores which we explored in 
a separate video that’s already been released.   That’s pretty much it for graphics cards. 
We’re thankful to all our Patreon and YouTube   Membership Sponsors for supporting our videos. 
If you want to financially support our work,   you can find the links in the description below.
This is Branch Education, and we create 3D   animations that dive deeply into the technology 
that drives our modern world. Watch another Branch   video by clicking one of these cards or click 
here to subscribe. Thanks for watching to the end!

---

## 5. How does Ray Tracing Work in Video Games and Movies?
**Channel:** Branch Education | **Views:** 1.5M | **Date:** 1 year ago | **Duration:** 29:22 | **ID:** iOlehM5kNSk
**Link:** https://youtube.com/watch?v=iOlehM5kNSk

### Transcript:
Every new TV show and movie that uses 
computer-generated images and special   effects relies on Ray Tracing. For example, 
in order to build an interstellar battle,   set in a galaxy far, far away, 3D 
artists model and texture the spaceships,   position them around the scene with lights, a 
background, and a camera, and then render the   scene. Rendering is a computational process that 
simulates how rays of light bounce off of and   illuminate each of the models, thus transforming 
a scene full of simple 3D models into a realistic   environment. There are many different ray 
tracing algorithms used to render scenes,   but the current industry standard in TV 
shows and movies is called path tracing.  This algorithm requires an unimaginable number of 
calculations. For example, if you had the entire   population of the world working together 
and performing 1 calculation every second,   it would take 12 days of nonstop problem solving 
to turn this scene into this image. Due to these   incredible computational requirements, path 
tracing was considered impossible for anything   but super computers for decades. In fact, 
this algorithm for simulating light was first   conceptualized in 1986, however it took 30 years 
before movies like Zootopia, Moana, Finding Dory   and Coco could be rendered using path tracing 
and even then, rendering these movies required   a server farm of 1000s of computers and multiple 
months to complete. So, why does path tracing   require quadrillions of calculations? And how 
does Ray Tracing work? Well, in this video, we’ll   answer these two questions, and in the process, 
you’ll get a better understanding of how Computer   Generated Images or CGI and special effects are 
created for TV and movies. After that we’ll open   up this GPU and see how its architecture is 
specifically designed to execute ray tracing,   enabling it to render this scene in only a few 
minutes. And finally, we’ll investigate how Video   games like Cyberpunk or the Unreal Engine Lumen 
Renderer use Ray Tracing. So, let’s dive right in.  This video is sponsored by Brilliant.org
Let’s first see how Path Tracing works   and how this dragon and kingdom are created and 
turned into a setting for a fantasy show. To make   the scene, an artist first spends a few months 
modeling everything, the islands, the castles,   the houses, the trees, and of course, the dragon. 
Although these models may have some smooth curves   or squares and polygons, they’re actually all 
broken down into small triangles. In short,   GPUs almost exclusively work with 3D 
scenes made of triangles, and this   scene is built from 3.2 million triangles.
After a model is built, the 3D artist assigns   a texture to it which defines both the color, 
as well as material attributes, such as whether   the surface is rough, smooth, metallic, glass, 
water-like, or composed of a wide range of other   materials. Next, the completed models are properly 
positioned around the scene and the artist adds   lights such as the sky and the sun and adjusts 
their intensity and direction to simulate the   time of day. Finally, a virtual camera is added 
and the scene is rendered and brought to life.  As mentioned earlier, path tracing simulates 
how light interacts with and bounces off every   surface in the scene, thereby producing 
realistic effects such as smooth shadows   across the buildings or the way light interacts 
with the water and produces bright highlights   in some areas and water covered sand in others.
In the real world, light rays start at the sun,   and when they hit a surface such as this red roof, 
some light is absorbed while the red light is   reflected, thus tinting the light based on the 
color of the object. These now tinted light   rays bounce off the surface and make their 
way to the camera and produce a 2D image.  With this scene, a near infinite number 
of light rays are produced by the sun   and sky and only a small fraction of them 
actually reach the camera. Calculating an   infinite number of light rays is impossible 
and only the light rays that reach the camera   are useful, and therefore with path tracing we 
don’t send rays out from the sky or light source,   but rather we send out rays from a virtual 
camera and into the scene. We then determine   which objects the rays hit and calculate how those 
objects are illuminated by the light sources.  With computer-generated images or CGI, the 2D 
image is represented by a view plane in front   of the virtual camera. This view plane has the 
same pixel count as the final image, so a 4K image   has 8.3 million pixels. Furthermore, by animating 
the camera around or changing its field of view,   the view plane will correspondingly change.
Let’s transition to an indoor scene such   as this barbershop, which contains 8 million 
triangles and is actually more complicated than   the island kingdom. In order to create this image 
on the view plane, a total of 8.3 billion rays,   which are a thousand rays per pixel, are sent out 
from the virtual camera through the view plane and   into the scene. Ray Tracing is a massively 
parallel operation because each pixel is   independent from all other pixels. This means that 
the thousand rays from one pixel can be calculated   at the same time as the rays from the next pixel 
over and so on. Once a single pixel’s rays finish   flying around the scene, the results are combined 
with the other rays and pixels to form a single   image. If we were to show billions of rays, the 
scene would quickly become inundated with lines,   so let’s simplify it down to a single ray 
running through one pixel of the viewing plane.  This ray starts at the camera, travels through a 
random point in the pixel and into the scene. It   flies straight and eventually hits a triangle, 
and once it does, that object’s color becomes   associated with that ray and pixel. For example, 
when the ray hits this chair, then the pixel   becomes red. The other nearby rays running through 
random places in the same pixel will hit pretty   close to this ray and have their colors averaged 
together. These rays are called primary rays and   they answer the question of what triangle and 
object do the rays first hit and what basic color   should be in that specific pixel. Another example 
is that these rays running through this pixel hit   the blue stripe on the barbershop pole turning the 
pixel blue. The other billions of rays do the same   thing resulting in a single image with the proper 
3D perspective from the virtual camera. This image   is fairly flat colored because each pixel just 
has the simple color of the object the rays hit.  So the next question is: how is the location where 
the primary ray hits illuminated by the light   sources and how bright or dark should the pixel’s 
color be shaded. For example, when you look at the   blue stripe of the barbershop pole, the entire 
stripe is just blue, but in the rendered image,   there’s a gradient from bright to dark across 
a number of pixels depending on how the   triangles are facing the lights and the window. 
Specifically, the dark blue backside doesn’t   face any of the light sources and therefore its 
illumination comes only from light bouncing off   the nearby walls. Furthermore, when the lighting 
conditions change and more light enters the scene,   the entire barbershop pole brightens up. This 
accurate lighting applies to all the objects in   the scene and is what transforms the scene and 
makes it look realistic. In order to accurately   determine the brightness of these blue pixels, ray 
tracing first needs to determine how the surface   is illuminated directly by the light sources, 
which is called direct illumination, and second,   how the surface is illuminated by light bouncing 
off other objects, which is called indirect   illumination. Combining direct and indirect 
illumination is called global illumination.  In order to calculate direct illumination, we 
start at the intersection point where the primary   ray hits the triangle in the barbershop pole and 
then we generate additional rays called shadow   rays and send them in the direction of each light 
source such as the light bulbs or the sun outside   the window. If there are no objects between 
the intersection point and a light source,   then that means that this point on the blue stripe 
is directly illuminated by that light source. For   each light source that directly illuminates this 
point, we factor in the light source’s brightness,   size, color, distance, and the direction of the 
surface that the triangle inside the blue stripe   is facing. All these factors are multiplied by 
the Red, Blue, and Green or RGB values of the   blue stripe, which in turn changes the shading or 
brightness of the pixel that the primary ray went   through. Let’s brighten the room again, and you 
can see the RGB values increase for this pixel.  Now let’s dim the room once more and look at 
a different pixel whose primary ray hits the   backside of the barbershop pole. A similar set of 
shadow rays are sent out from this intersection   point to each light source, but each of these 
rays is blocked by other triangles in the pole,   and thus this point doesn’t receive any direct 
illumination from any of the light sources,   leaving the pixel dark. These rays are 
called shadow rays because they determine   whether a location is directly illuminated by 
a light source or whether it’s in a shadow.  You might think that this backside should be 
entirely black because it’s in the shadows and   none of the light rays from the light sources can 
reach it. However, this backside still has color   because it’s illuminated by light bouncing off the 
walls. This light is called indirect illumination,   and in order to calculate it, we take the 
intersection point from the primary ray and   generate a secondary ray that bounces off it. This 
secondary ray then hits a new surface such as this   point on the wall. From this secondary point we 
send out a new set of shadow rays to each light   source to see whether the point on the wall is 
in shadows or whether it’s directly illuminated.   The results from these new shadow rays and the 
attributes of the corresponding light sources   are combined with the color of the wall’s surface, 
essentially turning this point on the wall into a   light source that illuminates the backside of 
the barbershop pole. Sometimes this point is   still in shadows, so we create an additional 
secondary ray from the point on the wall and   send it in a new direction and see what it hits. 
Then we calculate how that third point is directly   illuminated using yet another set of shadow rays 
thereby turning this third point into a light   source that illuminates the previous point. This 
secondary ray bouncing happens multiple times,   and each time we send shadow rays to the light 
sources and check how that point is illuminated.  The purpose of bouncing the secondary rays 
around and sending out shadow rays at each   point is to find different paths where 
light bounces off different surfaces and   indirectly illuminates the original point 
where the primary ray hits. Furthermore,   by sending a thousand rays through random points 
in a single pixel, and by having thousands of   secondary rays bounce in different directions, 
we get an accurate approximation for indirect   illumination or how this pixel is illuminated 
by light bouncing off the other objects.  It's called path tracing because by using these 
primary rays, secondary rays and shadow rays,   we’re finding billions of paths from the camera 
through different points in the scene and to the   light sources. One additional benefit of indirect 
illumination and the use of secondary rays is that   color can bounce from one object to another. 
For example, when we place a red balloon next   to the wall and brighten the scene, some secondary 
light rays are tinted red by the balloon, and this   reddish color can be seen on the wall itself.
An important detail is that the direction the   secondary rays bounce off the surface depends 
on the material and texture properties assigned   to the object. For example, here is 
a set of spheres that are all gray,   but have different roughness values that 
drastically change their look. Essentially, for   a perfectly smooth surface with no roughness, the 
object becomes a mirror because every one of the   secondary rays will bounce off in the same perfect 
reflection direction, and whatever the secondary   rays hit will combine together and become 
visible in the mirror-like surface. However,   when a material has a roughness set to 100%, then 
the secondary rays will bounce in entirely random   directions resulting in a flat gray surface.
Furthermore, if an object is assigned a glass   material, then additional refraction rays 
that pass through the glass are generated,   and the color and brightness of the pixels in the 
glass will depend mostly on the direction of the   refraction rays and what those rays hit. Here’s an 
interesting scene of some glass and mirror objects   that truly show the power of path tracing, and 
you can see multiple mirror bounces in some of   the objects and proper refraction in the glass.
Note that for this barbershop scene a thousand   rays per pixel and four secondary bounces are the 
render settings we chose during scene setup. Other   scenes use different numbers of rays per pixel, 
secondary bounces, and light sources. When we   multiply these values together with the number of 
pixels in an image we get the total number of rays   required to generate a single image. Furthermore, 
animations typically have 24 frames a second,   so a 20-minute animation requires over a 
quadrillion rays, and that’s why path tracing   was considered computationally impossible for 
TV shows and movies for decades. The other key   problem was figuring out which one triangle 
out of 8 million each of the rays hits first.  So let’s see how these problems are solved and 
we’ll start by transitioning to a new scene and   see how ray-triangle intersections are calculated. 
Let’s simplify the scene down to one ray and two   triangles and find which one the ray hits. We 
start by extending the planes that the triangles   are on and then, using the equations of the planes 
and the ray, we calculate the point at which they   intersect. Now that we have a set of intersection 
points on separate planes, we find whether the   point is inside each corresponding triangle. If 
it is, then that means the ray hits the triangle,   and if it isn’t that means it misses the 
triangle. These steps are relatively simple,   and with 10 triangles, we can do this over 
and over, once for each triangle. If multiple   triangles are hit we do a distance calculation to 
find the closest one. However, when a scene has   millions of triangles, finding which one triangle 
a single ray hits first becomes incredibly   repetitive and computationally problematic.
We solve this by using what’s called a bounding   volume hierarchy or BVH. Essentially, we take 
triangles in the scene and, using their 3D   coordinates, we divide them into two separate 
boxes called bounding volumes. Each of these   boxes contains half of all the triangles in the 
scene. Then we take these 2 boxes with their   1.5 million triangles and divide them again into 
boxes with 750,000 triangles. We keep on dividing   the triangles into more and more progressively 
smaller pairs of boxes for a total of 19 divides.   In the end we’ve separated 3 million triangles 
into a hierarchy of 19 divisions of boxes with   a total of 525 thousand very small boxes at the 
bottom, each with around 6 triangles inside.  The key is that all of these boxes have 
their sides aligned with the coordinate axes,   which makes a far easier calculation. For example 
e, if we have a ray and two axes aligned boxes,   finding whether it hits box A or box B is just 
a matter of finding the intercept with the plane   of Y equals six, and then seeing whether the 
intercept coordinates fall between box A’s   bounds or between Box B’s bounds. Then we do the 
same thing inside Box B but using the axes aligned   coordinates of the two smaller boxes inside of it.
For a scene of 3 million triangles, these 19 box   divide branches form a binary tree or hierarchy, 
hence the name bounding volume hierarchy. At each   branch we perform a simple ray-box intersection 
calculation to see which box the ray hits first,   and then the ray travels to the next branch. At 
the very bottom, once a ray finishes traveling   through all the bounding volume branches, 
which is called BVH traversal, we end up   with a small box of only 6 triangles. We then do 
the ray-triangle intersection calculation that we   mentioned earlier with just these 6 triangles.
As a result, BVH trees and traversal reduce   tens of millions of calculations down to 
a handful of simple ray box intersections   followed by 6 ray triangle intersections.
Using BVHs helps to solve which triangle   a ray will hit first but doesn’t fix the fact 
that a single frame of animation requires over   a hundred billion rays. The solution is in the 
incredibly powerful GPUs we now have. When we   open up this GPU, we find a rather large 
microchip that has 10496 CUDA or shading   cores and 82 Ray Tracing or RT cores. The 
CUDA cores perform basic arithmetic while   the ray tracing cores are specially designed and 
optimized to execute Ray Tracing. Inside the RT   cores are two sections, the BVH traversal section 
takes in all the coordinates of the boxes and the   direction of the ray and executes BVH traversal in 
nanoseconds. Then, the ray triangle intersection   section uses the coordinates of the six or so 
triangles in the smallest bounding volume and   quickly finds which triangle the ray hits first. 
The RT cores operate in parallel with one another   and pipeline the operations so that a few billion 
rays can be handled every second, and a complex   scene like this one can be rendered in 4 minutes.
Overall Path Tracing’s computationally impossible   problems are solved by using bounding volume 
hierarchies along with improvements in GPU   hardware. One crazy fact is that the most powerful 
supercomputer in the year 2000 was the ASCI White,   which cost 110 million dollars and could perform 
12.3 trillion operations a second. Compare   this with the NVidia 3090 GPU which cost a few 
thousand dollars when it first came out in 2022   and the CUDA or shading cores perform 36 trillion 
operations a second. It’s mind-boggling how such   an incredible amount of computing power can fit 
into a graphics card the size of a shoebox and   how computer-generated images or CGI and special 
effects, which used to be only for high-budget   films, can now be created on a desktop computer.
Ray Tracing is a fusion of a variety of different   disciplines from the physics of light, to 
trigonometry, vectors, and matrices, and then   also computer science, algorithms and hardware. 
Covering all these topics would require multiple   hour-long videos which we don’t have time to do, 
but luckily Brilliant, the sponsor of this video,   already has several free and easy to access 
courses that explore these topics. Brilliant is   where you learn by doing, and is a website filled 
with thousands of fun and interactive modules,   loaded with subjects ranging from the fundamentals 
of math to quantum mechanics to programming in   python to biology, and much more. When I learn new 
things on Brilliant, I like to think about Steve   Jobs, and how he took a calligraphy class 
at college. Although at the time it had no   practical application in his life, 10 years later 
when designing the Macintosh computer, he applied   all the lessons from that calligraphy course 
to designing the typefaces and proportionally   spaced fonts of the Mac. The key is that as 
you progress through Brilliant’s interactive   lessons and learn new things, you may not know 
how those lessons apply to your job or life,   but there will be one or two courses that will 
click into place and change the trajectory of   your career. However, if you don’t try out their 
courses, then you’ll never know. The other reason   why Steve Jobs is applicable to ray tracing 
is because he was the CEO of Pixar from 1986   until 2006 and helped to design the computers 
that rendered some of its first movies. To be   a successful inventor like Steve Jobs, you need 
to be well versed in a wide range of disciplines.   For the viewers of this channel, Brilliant 
is providing a free 30-day trial with access   to all their thousands of lessons and is also 
offering 20% off an annual subscription. Just   go to brilliant.org/brancheducation. 
The link is in the description below.  We loved making this video because path 
tracing is an algorithm that we use daily   due to the fact that all our animations are 
created and rendered using a software called   Blender which uses path tracing in its 
rendering engine. Specifically, here are   all the scenes we used and some statistics 
that you can pause the video and look at.  It takes a ton of work to create high quality 
educational videos. Researching this video,   writing the script, and then animating 
the scenes has taken us over 800 hours,   so if you could take a quick second to 
like this video, subscribe to the channel,   write a comment below and share it with someone 
who watches TV or movies it would help us a ton.  Furthermore, we’d like to give a shout-out to 
the Blender Dev Team. Blender is an incredibly   powerful, free-to-use modeling and animation 
software. Each of these scenes was made by   an incredible artist and you can download 
them for free from the Blender website.  Finally, one question you may have is: 
how is ray tracing is used in video games.  There are many different methods, so we’ll cover 
just a few of them. The first one is similar   to path tracing but with some shortcuts. 
For a given environment in a video game,   a very low-resolution duplicate of all the models 
in the scene is created. Path tracing is then used   to determine direct and indirect lighting for each 
of these low-resolution objects and the results   are saved into a light map on the low-resolution 
duplicate. Then the light map is applied to the   high-resolution version of the objects in the 
scene, creating realistic indirect lighting   and shadows on the high-resolution objects. 
This method is pretty good at approximating   indirect lighting and is one of the ray tracing 
techniques used in Unreal Engine’s Lumen renderer.  The second and completely different method 
for using ray tracing in video games is called   screen space ray tracing. It doesn’t use the 
scene’s geometries but rather uses the images   and data generated from the video game graphics 
rendering pipeline where all the objects in the   scene undergo 3D transformations to build a 
flat 2D image on the viewscreen. During the   video game graphics process, additional data 
is created, such as a depth map that shows how   far each object and the corresponding pixels 
are from the camera, as well as a normal map   that shows the direction each of the objects and 
pixels are facing. By combining the view screen,   the depth map, and the normal map, we can generate 
an approximation for the X, Y, and Z values of   the various objects in the scene, as well as 
determine what direction each pixel is facing.  Now that we have a simplified scene, let’s say 
this lake is reflective, and we want to know   what pixels should be shown in its reflection. 
To figure it out, we use ray tracing with this   simplified screen space 3D representation and 
bounce the rays off of the lake’s pixels using the   normal map. These rays then continue through the 
simplified geometry and hit the trees behind it,   thus producing a reflection of the trees on 
the lake. One problematic issue with screen   space ray tracing is that it can only use 
the data that’s on the screen. As a result,   when the camera moves, the trees move out of 
view, and thus the trees are removed from the   screen space data and it’s impossible to 
see them in the reflection. Additionally,   screen space ray tracing doesn’t allow for 
reflections of objects behind the camera. This   type of ray tracing along with other rendering 
algorithms are used in games like Cyberpunk.  Additionally, if you’re curious as 
to how video game graphics work,   we have a separate video that explores 
all the steps such as Vertex Shading,   Rasterization, and Fragment Shading. The 
video game graphics rendering pipeline   is entirely different from Ray Tracing, 
so we recommend you check it out. And,   that’s pretty much it for Ray Tracing.
We’d like to give a shoutout to Cem Yuksel, a   professor at the School of Computing at the 
University of Utah. On his YouTube channel,   you can find his lecture series on computer 
graphics and interactive graphics, which were   both instrumental in the research for this video.
This is Branch Education, and we create   3D animations that dive deeply into the 
technology that drives our modern world.   Watch another Branch video by clicking one 
of these cards or click here to subscribe.

---

## 6. How are Microchips Made? 🖥️🛠️ CPU Manufacturing Process Steps
**Channel:** Branch Education | **Views:** 10.6M | **Date:** 1 year ago | **Duration:** 27:48 | **ID:** dX9CGRZwD-w
**Link:** https://youtube.com/watch?v=dX9CGRZwD-w

### Transcript:
Inside this smartphone are 62 microchips 
containing a total of 90 billion transistors.   These microchips are incredibly powerful and 
the cornerstone of all technology, but how are   billions of nanoscopic transistors manufactured 
into a microchip the size of a tiny ant?  Well, all these microchips were manufactured in 
a semiconductor fabrication plant like this one.   Inside it is a clean room which spans the area of 
8 football fields and is filled with hundreds of   machines ranging in size from that of a van to 
that of a city bus and costing anywhere between   a few million and 170 million dollars. Within 
this microchip factory, silicon wafers travel   from machine to machine and undergo around a 
thousand processes over a 3-month period. And,   by the end of production, each silicon wafer 
will be covered in hundreds of CPU chips   each containing 26 billion transistors.
When we zoom in we can see the nanoscopic   transistors at the bottom and over 
a dozen layers of wires above. This   integrated circuit is then cut out from 
the wafer, tested, and packaged so that   it can be installed into your desktop computer.
In this video we’re going to explore the entire   microchip manufacturing process and show 
you how billions of nanoscopic transistors   and an impossibly complex 3D maze of wires 
are manufactured in one of the world’s most   technologically advanced microchip factories. 
It’s an incredibly complicated process,   so stick around and let’s jump right in! A portion 
of this video is sponsored by Brilliant.org.  There are two sides to understanding how microchip 
manufacturing works. The first is the sequence of   steps and processes needed to build the nanoscopic 
transistors and the labyrinth of wires. Whereas   the second is how the semiconductor fab and 
multimillion dollar equipment on the cleanroom   floor work, and we’ll be flipping between 
these two sides to get a complete picture.  Let’s start by opening up this desktop computer, 
focusing on the CPU and taking a look at what’s   inside. Here we have an integrated circuit, or 
die, which we’ll refer to as a chip. This chip   has 24 cores, a memory controller, a graphics 
processor, and many other sections. Within one   of the cores, we can see its block diagram 
and the various elements. Zooming in on   this multiply block, we find a layout of 44 
thousand transistors that physically execute   32-bit multiplication and constitute just 
point zero zero zero one seven percent of the   overall 26 billion transistors in the CPU.
Zooming in even further, we see layers of   metal wires, or interconnects, and at the very 
bottom are the transistors that form the basic   logic gates. Note that these layers of metal 
interconnects aren’t floating, but rather,   the empty space that you see is filled with 
insulating materials, thus providing structure,   and preventing the metal wire layers from 
touching. Furthermore, here we’re only showing   the transistors at the bottom and five layers of 
metal interconnects with vias traveling vertically   between the layers. In actuality there are a 
total of 17 metal layers of wires in the CPU,   and each successive set of levels uses larger 
and larger interconnects. At the bottom are   local interconnects that move data around this 
32 bit multiply circuit. In the middle are   intermediate interconnects that move data around 
the core, and at the top are global interconnects   that move data around the entire CPU.
You might be wondering how small are   these transistors? Zooming in again and past 
the interconnect layers we find FinFets,   which are transistors whose channel dimensions 
are 36 by 6 by 52 nanometers with a transistor   to transistor pitch of 57 nanometers. Clearly 
the transistors are incredibly small. Here’s   a mitochondria, a dust particle, and 
a human hair for size comparisons.  Now that you have a sense of what the transistors 
and labyrinth of metal interconnects look like,   let’s explore how they’re manufactured.
We’ll begin with an analogy. Imagine baking   a cake that’s 80 layers tall, with each layer cut 
to a unique shape. To make this cake there are   940 steps in the recipe, which takes 3 months 
to complete and includes hundreds of exotic   ingredients. And, if any measurement, baking 
time, or temperature is more than one percent off,   then the cake is entirely ruined. That’s 
kind of what it’s like to make a microchip,   but microchips are even more complicated.
Let’s look at a single layer of this integrated   circuit and run through a simplified 
set of steps used to build it. To start,   a layer of insulating silicon dioxide is deposited 
on top of the wafer and then a layer of light   sensitive photoresist is spread across the top. 
Next, using UV Light and a stencil, a pattern is   applied to the photoresist. Solvents then are 
used to remove the areas hit by the UV light,   thus creating a patterned mask layer. Using the 
mask, the revealed silicon dioxide is etched away   down to the previous layer. Next the mask layer is 
removed, and a layer of copper is added to cover   the wafer and fill in the areas that were just 
etched away. Finally, the surface is ground down   and leveled off to reveal the copper and insulator 
patterns. And thus, a single layer is completed.  In order to build the next layer, which is 
a vertical set of metal vias, we repeat the   same set of steps, but use a different pattern 
for the photomask. Since these layers are all   built using the same set of steps it’s more 
effective to visualize the steps as a circle   like a clock. To build all the 80 layers of the 
die, this sequence is repeated over and over,   resulting in 940 steps. One important note is 
that the FinFet transistors at the bottom are   even more complicated than the metal wires, and 
thus additional steps are needed to fabricate   them. Furthermore, cleaning the wafer to wash away 
dust particles that may have landed on the wafer,   as well as inspecting the wafer to make 
sure everything is being built properly,   happens frequently and these steps need to 
be added to the circle. A different tool is   used to complete each of these process steps. .
Now that we have an understanding of the steps,   let’s take a look at this semiconductor 
fabrication plant. This CPU is manufactured   on a 300-millimeter silicon wafer which can 
fit 230 CPU chips. In contrast DRAM chips are   considerably smaller and thus 952 of them can fit 
on a wafer. These silicon wafers are carried in   stacks of 25 using a container called a front 
opening universal pod, or foup. This sealed   plastic wafer carrier is transported around the 
cleanroom floor using an overhead transport system   which lowers the foup onto the tool’s landing pad. 
Inside the tool, robotic arms transport the wafer   through vacuum load locks and to different 
process chambers where materials are added,   removed, or processed in ways that we’ll explore 
later. The wafers are then returned to the foup,   resealed inside, lifted up to the overhead 
transport system, and carried to and dropped   onto the next tool, where the next step in the 
process is completed. To build the entire chip   composed of 80 different layers it takes 3 months 
of traveling from tool to tool where at each   stop one of the 940 process steps is completed.
In order to increase the microchip mass production   capabilities of a semiconductor fabrication 
plant or fab, typically there are dozens of the   same semiconductor tools organized in rows that 
perform the same process. On the cleanroom floor   there are a total of 435 semiconductor tools 
resulting in the fab’s production capacity of   50,000 wafers or 11.5 million CPUs a month.
These tools have rather complicated names,   so we’ll start by categorizing them according 
to their functionality. There are 6 groups:   making the mask layer, adding material, 
removing material, modifying the material,   cleaning the wafer, and finally inspecting 
the wafer. We’ve color coded the different   functional groups to the various tools and 
process steps to help you not get lost.  Let’s next look at each of these semiconductor 
tools and see how they process the wafer in   various ways. We’ll start with the ones that are 
used to make the mask layer or the nanoscopic   stencil on the wafer. These tools include the 
photoresist spin coater, photolithography tool,   developer and photoresist stripper. First the 
photoresist spin coater applies a light-sensitive   layer to the surface of the wafer and sends 
it through a soft bake where the wafer is   heated in order to evaporate the solvent from 
the photoresist. Next the wafer goes to the   lithography tool which shines UV light through a 
stencil, which is technically called a photomask.   The light passes through the stencil and is then 
demagnified or shrunk down to produce a nanoscopic   pattern on the wafer. Wherever the light from 
the stencil touches the wafer, the photoresist is   weakened. The wafer then goes to the developer 
and the weakened photoresist is washed away,   leaving only the patterned nanoscopic stencil on 
the wafer. The wafer is then sent through a hard   bake to harden the remaining photoresist. 
Next the wafer travels to other tools to   undergo processing, and once these processes 
are completed the wafer goes to a photoresist   stripper which uses solvents to dissolve and 
remove the photoresist mask layer. And that’s   how a mask layer is formed and then removed.
The photolithography tool is one of the most   important, so let’s take a look at it. Inside 
is a UV light source, a set of lenses to   focus the light, a photomask which contains the 
stencil, or design of the layer to be patterned,   and a wafer carrier. The photomask is 6 by 6 
inches, and, based on the dimensions of the CPU,   can fit 2 copies of a single layer of 
the CPU design. The purpose of using   a photomask with these crazy optics is because 
it’s a reliable way to copy and paste a design   for billions of nanoscopic transistors and wires 
onto 230 identical CPUs on a single wafer in a   few minutes. After the light passes through the 
photomask, the UV light goes to more lenses in   order to shrink down the pattern by a factor of 
4 and print a single layer of the design onto the   photoresist. The wafer carrier steps from position 
to position, printing the photomask image at each   stop, until all 230 chips are patterned.
Let’s clarify one detail. In our previous   examples, we talked a lot about this CPU having 80 
layers. Specifically, what we were referring to is   the number of photomasks and mask layers used to 
create all the different layers of patterns on   the wafer. Therefore, one complete CPU chip 
uses 80 different photomasks, each costing   300,000 dollars. With only one mask layer being 
patterned at a time, this CPU chip will undergo 80   separate visits to the lithography tool. We could 
spend another hour talking about photolithography   but let’s move onto the next category of tools.
Deposition tools are used to add or deposit   material onto the wafer. A lot of times we 
use the mask layer from the photolithography   step to add materials to the areas uncovered 
by the mask layer, kind of like spray painting   through a stencil. Due to the wide range of 
elements and compounds used to create the layers,   deposition tools have a wide range of variations 
with complicated names and acronyms for each   variant. But essentially there are 3 key groups 
of materials that are added or deposited onto   the wafer: metals such as copper or tantalum, 
insulators which are typically called oxides,   and crystalline layers of silicon. Each group of 
different materials uses different physics and   chemistry principles to deposit the material 
on the wafer and therefore has a different   technical name for the tool that deposits the 
material. Deposition tools typically have a   central wafer handling chamber, with the various 
chambers attached to the edges, each one dedicated   to adding just a single element or compound.
The next category of machines do the opposite,   which is to remove material. There are 2 
key methods. The first is etching. Etchers   use either corrosive chemicals or high energy 
plasmas to react with and remove materials from   the surface of the wafer. They are typically used 
with the mask layer stencil in order to remove the   material exposed by the mask, thus creating a hole 
that can be later filled by a deposition tool.  The second method to remove material is CMP, 
which is chemical mechanical planarization. CMP   applies slurry and uses abrasive pads to grind 
and polish away the top surface of the wafer,   making it perfectly flat. CMP levels off the top 
layers of the wafer and is typically used as the   last step in a cycle of processes in order to 
prepare the wafer for another layer to be added.  The fourth category are tools that modify the 
silicon and are called ion implanters. These tools   use the photomask stencil to bombard the unmasked 
regions with phosphor, boron, or other elements   in order to make the P and the N regions required 
to form the transistors themselves. Therefore, ion   implanters are only used in the front end of line. 
You might think that this is adding material.   However, ion implanters only add around one atom 
of phosphor or boron for every 10,000 atoms of   silicon. Additionally, while other machines spray 
paint a layer on top of the wafer, ion implanters   hurl atoms deep into the silicon lattice, kind 
of like a cannon launching a baseball 6 feet into   a concrete wall. This process typically damages 
the silicon lattice, which is why the following   step is to repair the silicon by heating the 
wafer using a separate tool called an annealer.  The fifth category of tools are used to clean 
and remove any contaminants or particles from the   wafer. These wafer washers use ultra-pure water to 
clean the wafer and then dry it with nitrogen or   hot isopropyl alcohol. Cleaning the wafer happens 
rather frequently in order to remove any stray   particles that may have fallen onto the wafer.
And finally, sixth are tools that inspect the   transistors and metal layers for defects and 
are called metrology tools. A common metrology   tool uses a scanning electron microscope with 
nanometer-level resolution to take pictures of the   top surface of the wafer and determine if there 
are defects such as improperly patterned layers   or particles on the surface. When fabricating 
an integrated circuit that takes 3 months to   complete, it’s important to repeatedly monitor the 
progress and make sure that each of the processes   is being executed with nanometer-level precision.
Now that we’ve covered each of the categories,   here are the color coded process steps 
along with the layout of the tools in the   semiconductor fabrication plant. Let’s run 
through the complete set of steps used to   manufacture a single metal interconnect layer.
First a layer of insulating silicon dioxide is   deposited onto the wafer. Next photoresist is 
spread across the surface and the wafer is sent   through a soft bake to remove the solvent. The 
wafer then travels to the photolithography tool   where the design from the photomask is transferred 
to each of the chips on the wafer by weakening   the areas of photoresist hit by the light. The 
wafer next goes to the developer to wash away   the sections that were hit by the light from the 
lithography tool and then through a hard bake to   harden the remaining photoresist. With the mask 
layer built, the wafer goes to an etching tool,   where a plasma etcher removes a vertical column 
through the exposed silicon dioxide until it   reaches the previous layer’s metal vias. Next the 
wafer is sent to a photoresist stripper where the   mask layer is removed. The wafer then travels 
to a physical vapor deposition tool where a   sequence of metals fills in the exposed pattern 
and coats the wafer in metal. Finally the wafer   is sent to a chemical mechanical planarization 
tool where the metal is ground down so that all   that remains is a flat layer of insulating silicon 
dioxide and conductive copper interconnects that   match the pattern from the photomask. A single 
metal layer is now completed, and the wafer is   ready for the next cycle to begin where insulating 
silicon dioxide and the vias will be added. Note   that cleaning and wafer metrology or inspection 
steps occur in between many of these other   steps. Furthermore, the process steps to make the 
transistors are less straightforward and utilize   the ion implanter, and thus we’ll cover them in a 
separate video on transistor physics and design.  These steps are for building the 
integrated circuit on the wafer, however,   there are additional steps in manufacturing a 
microchip which we’ll explore in a little bit.  But before we get there, one important thing 
to note is that the semiconductor industry   is incredibly secretive regarding the exact tool 
layout and the process steps and recipes used to   make the transistors. We wanted to make the best 
video on how microchips are made and it took us   180 hours of scouring the internet and textbooks 
for information and reference images and, using   what we found, we spent 205 hours modeling each 
of these tools, the many layers of the integrated   circuit, and the semiconductor fab. Furthermore, 
writing the script took about 100 hours, and then   animating all these visuals took more than 825 
hours. As a result, this video took over 1300   hours to make, and it’s entirely free to watch. 
We want to make more videos like this one where we   explore computer architecture and how transistors 
work, and we can’t do it without your help. The   best way you can help is by taking a few seconds 
to scroll down, write a comment below, like this   video, subscribe if you haven’t already and then 
share this video on social media or send it to a   friend or colleague. Truly, just a few seconds 
of your time helps far more than you think.   Additionally, we have a Patreon page where 
we’ll be releasing behind the scenes footage   of our work and updates for upcoming 
videos. If you find what we do useful,   we would appreciate any support. Thank you.
So then, what are the additional steps in   manufacturing a microchip? Before 
chip manufacturing at the fab,   we first have to manufacture the silicon 
wafers by refining quartzite into pure silicon,   and then growing a monocrystalline ingot 
and cutting it into wafers. For reference,   these 300-millimeter wafers are around 
three-quarters of a millimeter thick,   they have a barcode on the side and a small 
notch in them to indicate the direction of the   crystal lattice. Furthermore, these wafers are 
incredibly delicate, and shatter into hundreds   of shards when broken. A single wafer costs 
around a hundred dollars, but after being   populated with CPUs it’s worth closer to a hundred 
thousand dollars, making it quite literally ten   times more valuable than its weight in gold.
Moving onto the steps after chip manufacturing.   The completed wafer is sent to a separate building 
where each of the CPUs undergoes rigorous testing   to figure out if it works as intended. If a CPU 
works, that’s great. But frequently a particle   or photomask defect has damaged a section of 
the integrated circuit, rendering that section   defective. These semi-functional circuits are then 
categorized, or binned, based on what still works.   These Intel Thirteenth Gen processors are sold as 
an i9, i7, i5, or i3, depending on how many cores   are functional with different product lines of 
CPUs whose on-board integrated graphics sections   are defective. These wafers are transported 
to another building where the chips are cut   out using a laser, flipped over, and placed on an 
interposer which distributes the connection points   to a printed circuit board while a protective 
heat conductive cover is placed on the back   side. The printed circuit board holds the landing 
grid array that interfaces with the motherboard   as well as various electrical components. Next 
an integrated heat spreader is mounted on top,   and the entire assembly is tested one last time 
before being packaged for sale. Finally, the CPU   is now ready to be mounted onto the motherboard 
and installed into your desktop computer.  It’s important to understand that chip 
manufacturing requires an incredible   amount of science and engineering and there’s a 
free and easy way to learn the basic principles   inside each of these complex tools and that’s with 
this video’s sponsor, Brilliant.org! Brilliant   reimagines how courses are taught. Instead 
of boring hour-long lectures or textbooks   that put you to sleep, Brilliant uses fun and 
interactive modules inside thousands of lessons   from basics to advanced topics – and new lessons 
are added every month. Whatever your skill level,   Brilliant customizes its content to fit your 
needs and allows you to learn at your own pace.  We use Brilliant daily. We’re working on 
videos on how AI and Chat GPT Works, and   so each of our animators is progressing through 
their lessons on How Large Language Models work.  Because you’re watching this video, you probably 
enjoy learning about how technology works,   and fortunately for you, Brilliant just added 
a course on this very topic. In it they have   lessons such as How GPS Works, How Computer 
Memory Works, and how Recommendation Algorithms   such as those used by YouTube work. If 
you’re looking to advance your career,   Brilliant is the go-to resource for leveling up 
your skills and staying up-to-date on the latest   concepts behind world-changing technology.
For the viewers of this channel, Brilliant   is offering a free 30-day trial with access to 
all their thousands of lessons. Additionally,   Brilliant is offering 20% off an 
annual subscription. Just go to   brilliant.org/brancheducation. The 
link is in the description below.  Microchip Fabrication is a massive topic, and 
thus, we have two more equally complex videos   that we’re working on. The first will be an 
in-depth 3D animated factory tour and the   second will explore transistor physics, FinFets, 
and the next generation of transistors. We’re   also working on a series of videos on GPUs and a 
separate one on CPU architecture so make sure to   subscribe so you don’t miss any of our videos.
We’re thankful to all our Patreon and YouTube   Membership Sponsors for supporting our work. 
If you want to financially support our work,   you can find the links in the description below.
This is Branch Education, and we create 3D   animations that dive deeply into the technology 
that drives our modern world. Watch another Branch   video by clicking one of these cards or click 
here to subscribe. Thanks for watching to the end!

---

## 7. How do Digital and Analog Clocks Work?
**Channel:** Branch Education | **Views:** 630K | **Date:** 2 years ago | **Duration:** 15:36 | **ID:** oEC5fIw0bL0
**Link:** https://youtube.com/watch?v=oEC5fIw0bL0

### Transcript:
Inside almost every piece of technology is a tiny 
clock that ticks at a rate of over a billion times   a second, generating a digital heartbeat that 
is critical to regulating the execution of code,   the movement of data in the processor 
and memory, the generation of wireless   signals for transmitting data and much more.
So then, how do we generate a clock that precisely   pulses at less than half a nanosecond?
It might seem counter-intuitive,   but this billions-of-times-a-second heartbeat, or 
gigahertz clock signal, is incredibly similar to   how a ten-dollar analog wall clock ticks through 
the seconds, minutes, and hours of the day.  In order to explore how a gigahertz 
technological heartbeat is generated,   let’s open a wall clock, see how it works, and 
then see how the same technology is used to   produce your desktop computer’s gigahertz 
clock signal. So, let’s jump right in.  Inside this ten-dollar wall clock are 5 
unique systems that enable it to work. The   most recognizable is the gear train made from 
8 gears. At the beginning of the gear train,   a driver gear is rotated by an electromagnet 
which provides the force to rotate the clock   hands. This electromagnet is composed of a coil of 
wire, which uses electrical current to generate a   magnetic field, and a strip of iron to channel 
that magnetic field to the drive gear. Every   second the electromagnet switches directions, 
thus causing the magnet inside the driver gear   to rotate 180 degrees in order to align its 
permanent magnet with the fields produced by   the electromagnet. Therefore, the driver gear 
rotates fully around once every two seconds.  Most of the gears in the gear train are composed 
of compound gears, each of which has two different   gears, one on top of the other. To move the 
second hand, which is mounted on a shaft through   the clock center, we go through a 12 to 48 gear 
reduction and then an 8 to 60 gear reduction,   thereby reducing one revolution every 2 seconds 
down to one every 60 seconds. The minute hand is   also mounted on a shaft through the center and 
is driven through an 8 to 64 gear reduction to   the idler, followed by 8 to 60 to the minute 
hand. And finally, the hour hand is driven via   a 15 to 45 reduction to the idler and a 10 to 40 
gear reduction to produce one rotation every 12   hours. As a result, we have 3 shafts rotating 
to which the hands of the clock are mounted,   each rotating at different speeds.
The last gear is used to set the time,   and interestingly this gear has 13 teeth on it, 
and rotates once every 69 minutes. As in the name,   the time-setting gear directly rotates 
the minute and hour hands, however,   the gear with the second hand doesn’t move because 
the two parts of this compound gear slip from the   high torque required to rotate the second hand 
52 times per rotation of the time-setting gear.  Now that we’ve covered the gear train, let’s 
dive into the quartz crystal oscillator and   see what makes this clock nearly identical to 
the digital clock in your computer. Inside this   metal cylinder is a quartz crystal tuning 
fork with wires printed onto the side which   travel along the legs to the outside of the 
metal canister. Let’s focus on a single side   with wires printed on the left and right.
Inside the quartz is a crystal lattice of   one silicon for every two oxygen atoms 
which forms a network of covalent bonds,   with electrons being more attracted to the oxygen 
due to their electronegativity. When you cut a   slice of quartz in a particular direction, you can 
see repeating sections of a crystal lattice with a   hexagonal organization of oxygen and silicon. When 
a negative charge is applied to the printed wires,   an electric field is directed to the crystal 
lattice and the negatively charged oxygen   atoms are pushed away, whereas the positively 
charged silicon is pulled towards the wire.   The combined movement of all the oxygen moving 
away and the silicon moving towards the wire   results in a lengthening of the crystal lattice. 
Conversely, when a positive charge is applied,   oxygen moves towards the positive charge 
and the silicon away, and as a result,   the crystal lattice shrinks in length. 
This lengthening and shrinking along the   length of the crystal lattice, called the 
piezoelectric effect, causes the leg of   this tuning fork to move back and forth.
Let’s move back to view the tuning fork   crystal with wires printed on each of the sides. 
As mentioned before, when a voltage is applied,   the tuning fork lengthens and bends outwards and 
when the voltage is turned off, the quartz bounces   backward. The crystal bounces back and forth 
creating positive and negative voltages with   the frequency of oscillation being dependent 
on the orientation of the crystal lattice as   well as the shape and dimension of the cut 
crystal. The purpose of having two legs is to   create a vibrational mode wherein the prongs 
vibrate and resonate together while the base   doesn’t move. Frequently manufacturers add 
small amounts of metal to the ends of the   crystal to tune it to the desired frequency.
However, to get a crystal to continuously   oscillate, a changing voltage needs to 
be repeatedly applied to the wires on the   legs. Specifically, this voltage needs to match 
the movement of the crystal such that the peak   positive voltage is aligned with the movement of 
the crystal in one direction, and the opposite   when the crystal moves in the other direction, 
kind of like pushing a kid on a swing set when   it’s at its low point, but in both directions.
To do that we use an integrated circuit with   an inverter to form a feedback loop and 
two capacitors to assist in the timing of   the voltage from the inverter and feedback loop, 
thus producing a resonant movement in the crystal.   This is a rather complicated circuit to fully 
explain, but here’s one way of thinking about   it. An inverter on its own flips the input from 
a 1 to an output of a 0 and vice versa. However,   if we loop an inverter back in on itself, 
depending on the physical design of the inverter,   the output will continuously flip between one and 
zero, a few picoseconds per cycle. And, if we add   the crystal tuning fork and capacitors in the path 
of the feedback loop, then the flipping between 1   and 0 and back is regulated by the geometry and 
movement of the prongs of the crystal oscillator   tuning fork and the filling and emptying of the 
charges in both of the capacitors. For this wall   clock, the time it takes is 30.52 microseconds 
per cycle resulting in 32,768 cycles per second.  The signal is then fed to another section in the 
integrated circuit where a binary counter counts   each cycle, and after 32,768 cycles, which 
takes one second, a signal is sent to the   electromagnet controller telling it to flip the 
direction of the electromagnet, thereby rotating   the driver gear around 180 degrees and moving 
the hands of the clock forward by one second.  One thing to note is that if your clock is either 
fast or slow, it’s most likely because the crystal   oscillator doesn’t oscillate exactly at 32.768 
kilohertz due to the geometry and incorrect   resonant frequency of tines. These crystals 
typically have 20 parts per million accuracies,   meaning it can gain or lose at most 1.7 
seconds a day, or 10 and a half minutes a year.  As mentioned earlier, this wall clock is composed 
of a set of systems with each falling under a   different domain of science and engineering. 
These topics are rather complex and typically   covered by college courses, but instead of 
paying thousands of dollars there’s a free   and easy way to learn and that’s with this video’s 
sponsor, Brilliant.org. Brilliant reimagines how   courses are taught. Instead of boring hour-long 
lectures or textbooks that put you to sleep,   Brilliant uses fun and interactive modules, with 
thousands of lessons from basics to advanced   topics – and new lessons added every month.
For example, in a single afternoon,   you can learn about gear trains, then dive into 
oscillations and classical mechanics followed   by chemistry and understanding how batteries 
store energy, and finally, you can finish it   up with an exploration of logic circuits and 
how computers work. Whatever your skill level,   Brilliant customizes its content to fit your 
needs and for you to learn at your own pace.  For the fans of Branch Education, we 
recommend you check out their course   on How Technology Works with lessons such as 
How GPS Works or How Computer Memory Works.  We can’t emphasize enough how important it is to 
be a life-long learner, so for the viewers of this   channel, Brilliant is offering a free 30-day trial 
with access to all their thousands of lessons.   Additionally, Brilliant is offering 20% off an 
annual subscription to the first 200 people who   sign up. Just go to brilliant.org/brancheducation. 
The link is in the description below. Let’s move on and see how smartphones and 
computers generate a clock between 1 to   5 gigahertz which is 30 to 150 thousand times 
faster than a single oscillation of this quartz   crystal tuning fork. Let’s look again at this 
inverter looped back upon itself and add two   more inverters into the loop, thus creating a ring 
oscillator. Due to the odd number of inverters,   the output rapidly oscillates between a 
1 and a 0. These inverters can operate   incredibly quickly and can easily reach the 
gigahertz frequency range and higher. However,   the issue is that this ring oscillator’s frequency 
is highly dependent on temperature as well as the   physical geometry and electrical properties 
of the transistors and thus has a frequency   range of plus or minus 50 percent or more from 
the desired frequency. Therefore, to stabilize   the output frequency of a ring oscillator to 
less than a few parts per million accuracy   we use a circuit called a phase-locked loop.
This is a complicated circuit, but here’s the   general idea of how it works. On the right, 
we have the ring oscillator, and when we add   some additional circuitry, depending on the 
input voltage, the output frequency changes,   and the ring oscillator is now called a 
voltage-controlled oscillator or VCO. On the   left we have a 16-megahertz crystal oscillator 
similar to the tuning fork crystal oscillator,   but by changing the crystals’ geometry and placing 
electrodes on the top and bottom, we get a crystal   with a faster resonant frequency. And again, 
this crystal is placed in a feedback loop of   its own to produce a stable resonant frequency.
In the middle is a frequency and phase comparator   that outputs a signal equal to the difference 
between the crystal and the voltage-controlled   oscillator. Next, an integrator takes 
the output from the phase comparator and   turns it into a steady voltage and uses it to 
drive the voltage-controlled ring oscillator.  Finally, this frequency is fed back into the 
frequency and phase comparator, and as it is,   the feedback loop will drive the ring oscillator 
to match and be identical to the output from   the 16-megahertz crystal oscillator loop.
However, since we want to get, for example,   a 2.4 gigahertz signal, which is 150 times 
that of the 16-megahertz crystal oscillator,   we add a frequency divider into the feedback 
loop. This frequency divider is just like the   one in the wall clock that took 32,768 cycles 
per second and turned it into a 1 hertz signal,   rather now, we’re dividing by 150.
Next, the signal is sent to the frequency and   phase comparator which wants the two signals to 
be identical. However, by having them different,   it outputs a signal which goes through the 
integrator, turning it into a steady voltage,   and driving the voltage-controlled 
oscillator up to a higher frequency,   which will be exactly 150 times that of the 
16-megahertz crystal, which is 2.4 gigahertz.  Using this phase-locked loop we have an 
incredibly fast frequency generator producing   a signal that is exactly 150 times that of a 
reliably manufactured and temperature-stable   quartz crystal. Additionally, if we 
want to change the desired frequency,   we have the binary counter divide by a different 
number, thus changing the amount the 16 megahertz   crystal is multiplied by. And in fact, all 
smartphones do this when not actively in use   in order to the reduce clock frequency of 
their processor and conserve battery life.  That’s pretty much it for clocks and crystal 
oscillators. One thing to note is that sometimes   MEMS oscillators are used in smartphones to 
save space instead of crystal oscillators,   and we’ll dive into MEMS in a future episode.
We believe the future will require a strong   emphasis on engineering education and we’re 
thankful to all our Patreon and YouTube Membership   Sponsors for supporting this dream. If you want 
to support us on YouTube Memberships, or Patreon,   you can find the links in the description.
This is Branch Education, and we create 3D   animations that dive deeply into the technology 
that drives our modern world. Watch another Branch   video by clicking one of these cards or click 
here to subscribe. Thanks for watching to the end!

---

## 8. How do Video Game Graphics Work?
**Channel:** Branch Education | **Views:** 5.1M | **Date:** 2 years ago | **Duration:** 21:00 | **ID:** C8YtdC8mxTU
**Link:** https://youtube.com/watch?v=C8YtdC8mxTU

### Transcript:
Video games have spectacular graphics, capable of 
transporting you to incredibly detailed cities,   heart-racing battlegrounds, magical 
worlds, and breathtaking environments.  While this may look like an old western train 
station and locomotive from Red Dead Redemption 2,   it’s actually composed of 2.1 million 
vertices assembled into 3.5 million   triangles with 976 colors and textures 
assigned to the various surfaces, all with   a virtual sun illuminating the scene below.
But perhaps the most impressive fact is that   these vertices, textures, and lights are entirely 
composed of ones and zeroes that’s continuously   being processed inside your computer’s 
graphics card or a video game console.  So then, how does your computer take billions 
of ones and zeroes and turn it into realistic   3D graphics? Well, let’s jump right in.
The video game graphics rendering pipeline has   three key steps: Vertex Shading, Rasterization, 
and Fragment Shading. While additional steps are   used in many modern video games, these three core 
steps have been used for decades in thousands of   video games for both computers and consoles and 
are still the backbone of the video game graphics   algorithm for pretty much every game you play.
Let’s begin with the first step called vertex   shading. The basic idea in this step is to 
take all the objects’ geometries and meshes   in a 3D space and use the field of view of the 
camera to calculate where each object falls in   a 2D window called the view screen, which 
is the 2D image that’s sent to the display.  In this train station scene, there are 1,100 
different models and the camera’s field of view   sections off what the player sees, reducing the 
number of objects that need to be rendered to 600.   Let’s focus on the locomotive as an example.
Although this engine has rounded surfaces and   some rather complex shapes, it’s actually 
assembled from 762 thousand flat triangles   using 382 thousand vertices and 9 different 
materials or colors applied to the surfaces of   the triangles. Conceptually, the entire train 
is moved as one piece onto the viewscreen,   but actually, each of the train’s hundreds of 
thousands of vertices are moved one at a time.  So, let’s focus on a single vertex. The 
process of moving a vertex, and by extension,   the triangles and the train, from a 3D world onto 
a 2D view screen is done using 3 transformations.   First moving a vertex from model space to world 
space, then from world space to camera space, and   finally from the perspective field of view onto 
the view screen. To perform this transformation   we use the X,Y, and Z coordinates of that 
vertex in modeling space, then the position,   scale, and rotation of the model in world space, 
and finally the coordinates and rotation of the   camera and its field of view. We plug all 
these numbers into different transformation   matrices and multiply them together resulting 
in the X and Y values of the vertex on the view   screen as well as a Z value or depth, which 
we’ll use later to determine object blocking.  After three vertices of the train are transformed 
using similar matrix math, we get a single   triangle moved onto the view screen. Then the 
rest of the 382 thousand vertices of the train   and the 2.1 million vertices of all the 600 
objects in the camera’s field of view undergo   a similar set of transformations, thereby moving 
all 3.5 million triangles onto a 2D viewscreen.  This is an incredible amount of matrix 
math, but GPUs in graphics cards and video   game consoles are designed to be triangle mesh 
rendering monsters and thus have evolved over   decades to handle millions of triangles every few 
milliseconds. For example, this GPU has 10,000ish   cores designed to efficiently execute up to 35 
trillion operations of 32-bit multiplication and   addition every second, and, by distributing the 
vertex co-ordinates and transformation data among   each of the cores, the GPU can easily render the 
scene resulting in 120 or more frames a second.  Now that we have all the vertices moved onto a 2D 
plane, the next step is to use the 3 vertices of a   single triangle and figure out which specific 
pixels on your display are covered by that   triangle. This process is called rasterization.
A 4K monitor or TV has a resolution of   thirty-eight forty by twenty-one sixty, 
yielding around 8.3 million pixels. Using   the X and Y coordinates of the vertices 
of a given triangle on the view screen,   your GPU calculates where it falls within this 
massive grid and which of the pixels are covered   by that particular triangle. Next, those pixels 
are shaded using the texture or color assigned to   that triangle. Thus, with rasterization, 
we turn triangles into fragments which   are groups of pixels that come from the same 
triangle and share the same texture or color.  Then we move on to the next triangle and 
shade in the pixels that are covered by   it and continue to do this for each of the 
3.5 million triangles that were previously   moved onto the viewscreen. By applying the Red 
Blue and Green color values of each triangle to   the appropriate pixels, a 4K image is formed 
in the frame buffer and sent to the display.  You’re probably wondering how we account 
for triangles that overlap or block other   triangles. For example, the train is blocking the 
view of much of the train station. Additionally,   the train has hundreds of thousands of triangles 
on its backside that are sent through the   rendering pipeline, but obviously don’t appear in 
the final image. Determining which triangles are   in front is called the visibility problem and 
is solved by using a Z-buffer or Depth Buffer.   A Z-Buffer adds an extra value to each of the 
8.3 million pixels corresponding to the distance   or depth that each pixel is from the camera.
In the previous step, when we did the vertex   transformations, we ended up with X and Y 
coordinates, but then also got a Z value   that corresponds to the distance from the 
transformed vertex to the camera. When a   triangle is rasterized, it covers a set 
of pixels and the Z value or depth of the   triangle is compared with the values stored in the 
Z-Buffer. If the triangle’s depth values are lower   than those in the Z-buffer, meaning the triangle 
is closer to the camera, then we paint in those   pixels using the triangle’s color and re-place the 
Z-buffer’s values using that triangle’s Z-values.  However, let’s say a second triangle comes along 
with Z values that are higher than those in the   Z-buffer, meaning the triangle is further away. 
We just throw it out and keep the pixels from   the triangle that was previously painted 
with lower Z-values. Using this method,   only the closest triangles to the camera with the 
lowest Z-values will be displayed on the screen.   By the way, here’s the image of the Z or Depth 
buffer, wherein black is close and white is far.  Note that because these triangles are in 3D space, 
the vertices often have 3 different Z values, and   thus each individual pixel of the triangle needs 
its Z value computed using the vertex coordinates.   This allows intersecting triangles to properly 
render out their intersections pixel by pixel.  One issue with rasterization and these pixels is 
that if the triangle cuts at an angle and passes   through the center of the pixel, then the 
entire pixel is painted with that triangle’s   color resulting in jagged and pixelated edges.
To reduce the appearance of these jagged edges,   graphics processors implement a technique 
called Super Sampling Anti-Aliasing. With SSAA,   16 sampling points are distributed across a single 
pixel, and when a triangle cuts through a pixel,   depending on how many of the 16 sampling 
points the triangle covers, a corresponding   fractional shade of that color is applied to 
the pixel, resulting in faded edges in the image   and significantly less noticeable pixelization.
One thing to remember is that when you’re playing   a video game, your character’s camera view as 
well as the objects in the scene are continuously   moving around. As a result, the process and 
calculations within vertex shading, rasterization,   and fragment shading are recalculated for every 
single frame once every 8.3 milliseconds for   a game running at 120 frames a second.
Let’s move onto the next step which is   Fragment Shading. Now that we have a set 
of pixels corresponding to each triangle,   it’s not enough to simply paint by number to color 
the pixels. Rather, to make the scene realistic,   we have to account for the direction and 
strength of the light or illumination,   the position of the camera, reflections, and 
shadows cast by other objects. Fragment shading   is therefore used to shade in each pixel 
with accurate illumination to make the scene   realistic. As a reminder, fragments are groups of 
pixels formed from a single rasterized triangle.  Let’s see the fragment shader in action. This 
train engine is mostly made of black metal,   and if we apply the same color to each of its 
pixel fragments, we get a horribly inaccurate   train. But once we apply proper shading, such 
as making the bottom darker and the top lighter,   and by adding in specular highlights or shininess 
where the light bounces off the surface, we get a   realistic black metal train. Additionally, as the 
sun moves in the sky, the shading on the train   reflects the passage of time throughout the day, 
and, if it’s night, the materials and colors of   all the objects are darker and illuminated from 
the light of the fire. Even video games such as   Super Mario 64 which is almost 30 years old have 
some simple shading where the colors of surfaces   are changed by the lighting and shadows in the 
scene. So, let’s see how fragment shading works.  The basic idea is that if a surface is pointing 
directly at a light source such as the sun,   it’s shaded brighter whereas if a 
surface is facing perpendicular to,   or away from the light, it’s shaded darker.
In order to calculate a triangle’s shading,   there are two key details we need to know. 
First, the direction of the light and second,   the direction the triangle’s surface is facing. 
Let’s continue to use the locomotive as an example   and paint it bright red instead of black. As 
you already know, this train is made of 762   thou-sand flat triangles, many of which face 
in different directions. The direction that   an individual triangle is facing is called its 
surface normal, which is simply the direction   perpendicular to the plane of the triangle, kind 
of like a flagpole sticking out of the ground.  To calculate a triangle’s shading, we take the 
cosine of the angle or theta between the two   directions. The cosine theta value is 1 when the 
surface is facing the light and when the surface   is perpendicular to the light it’s 0. Next, we 
multiply cosine theta by the intensity of the   light and then by the color of the material to 
get the properly shaded color of that triangle.   This process adjusts the triangles’ RGB values 
and as a result, we get a range of lightness to   darkness of a surface depending on how its 
individual triangles are facing the light.  However, if the surface is perpendicular or 
facing away, we don’t want a cosine theta value   of 0 or a negative number because this would 
result in a pitch-black surface. Therefore,   we set the minimum to 0 and add in an ambient 
light intensity times the surface color,   and adjust this ambient light so that it’s higher 
in daytime scenes, and closer to 0 at night.  Finally, when there are multiple light sources 
in a scene, we perform this calculation multiple   times with different light directions, and 
intensities and then add the individual   contributions together. Having more than a few 
light sources is computationally intense for   your GPU, and thus scenes limit the number 
of individual light sources and sometimes   limit the range of influence for the lights 
so that triangles will ignore distant lights.  The vector and matrix math used in rendering 
video game graphics is rather complicated,   but luckily there’s a free and easy way to learn 
it and that’s with Brilliant.org. Brilliant is a   multidisciplinary online interactive education 
platform and is the best way to learn math,   computer science, and many other 
fields of science and engineering.  Thus far we’ve been simplifying the math behind 
video game graphics considerably. For example,   vectors are used to find the value of cosine theta 
between the direction of the light and the surface   normal, and the GPU uses the dot product divided 
by the norm of the two vectors to calculate it.   Additionally, we skipped a lot of detail when it 
came to 3D shapes and transformations from one   coordinate system to another using matrices. 
Rather fittingly, Brilliant.org has entire   courses on vector calculus, trigonometry, and 3D 
geometry, as well as courses on linear algebra   and matrix math. All of which have direct 
applications to this video and are needed for   you to fully understand graphics algorithms.
Alternatively, if you’re all set with math,   we recommend their course on Thinking in 
Code which will help you build a solid   foundation on computational problem solving.
Brilliant is offering a free 30-day trial   with full access to their thousands of 
lessons. It’s incredibly easy to sign up,   try out some of their lessons for free and, if you 
like them, which we’re sure you will, you can sign   up for an annual subscription. To the viewers 
of this channel, Brilliant is offering 20% off   an annual subscription to the first 200 people who 
sign up. Just go to brilliant.org/brancheducation.   The link is in the description below.
Let’s get back to exploring fragment shading.   One key problem with it is that the triangles 
within an object each have only a single normal,   and thus each triangle will share the 
same color throughout the triangle’s   surface. This is called flat shading and 
is rather unrealistic when viewed on curved   surfaces such as the body of this steam engine.
So, in order to produce smooth shading, instead   of using surface normals, we use one normal for 
each vertex calculated using the average of the   normals of the adjacent triangles. Next, we 
use a method called barycentric coordinates   to produce a smooth gradient of normals across the 
surface of a triangle. Visually it’s like mixing 3   different colors across a triangle, but instead 
we’re using the three vertex normal directions.  For a given fragment we take the center of each 
pixel and use the vertex normals and coordinates   of the pre-rasterized triangle to calculate the 
barycentric normal of that particular pixel. Just   like mixing the three colors across a triangle 
this pixel’s normal will be a proportional mix   of the three vertex normals of the triangle. 
As a result, when a set of triangles is used   to form a curved surface, each pixel will be part 
of a gradient of normals resulting in a gradient   of angles facing the light with pixel-by-pixel 
coloring and smooth shad-ing across the surface.  We want to say that this has been one of the most 
enjoyable videos to make simply because we love   playing video games and seeing the algorithm 
that makes these incredible graphics has been   a joy. We spent over 540 hours researching, 
writing, modelling this scene from RDR2,   and animating. If you could take a few seconds 
to hit that like button, subscribe, share this   video with a friend, and write a comment below it 
would help us more than you think, so thank you.  Thus far we’ve covered the core steps for 
the graphics rendering pipeline, however,   there are many more steps and advanced topics. For 
example, you might be wondering where ray tracing   and DLSS or deep learning super sampling fits into 
this pipeline. Ray tracing is predominately used   to create highly detailed scenes with accurate 
lighting and reflections typically found in TV   and movies and a single frame can take dozens 
of minutes or more to render. For video games,   the primary visibility and shading of the objects 
are calculated using the graphics rendering   pipeline we discussed, but in certain video 
games ray tracing is used to calculate shadows,   reflections, and improved lighting. On the other 
hand, DLSS is an algorithm for taking a low   resolution frame and upscaling it to a 4K frame 
using a convolution neural network. Therefore DLSS   is executed after ray tracing and the graphics 
pipeline generates a low-resolution frame.  One interesting note is that the latest generation 
of GPUs has 3 entirely separate architectures of   computational resources or cores. CUDA or Shading 
cores execute the graphics rendering pipeline. Ray   tracing cores are self-explanatory. And then 
DLSS is run on the Tensor cores. Therefore,   when you’re playing a high-end video game with 
Ray Tracing and DLSS, your GPU utilizes all of   its computational resources at the same time, 
allowing you to play 4K games and render frames   in less than 10 milliseconds each. Whereas if you 
were to solely rely on the CUDA or shading cores,   then a single frame would take around 
50 milliseconds. With that in mind,   Ray Tracing and DLSS are entirely different topics 
with their own equally complicated algorithms,   and therefore we’re planning separate videos 
that will explore each of these topics in detail.  Furthermore, when it comes to video game graphics, 
there are advanced topics such as Shadows,   Reflections, UVs, Normal Maps and more. Therefore, 
we’re considering making an additional video on   these advanced topics. If you’re interested 
in such a video let us know in the comments.  We believe the future will require a strong 
emphasis on engineering education and we’re   thankful to all our Patreon and YouTube Membership 
Sponsors for supporting this dream. If you want to   support us on YouTube Memberships, or Patreon, 
you can find the links in the description.  This is Branch Education, and we create 
3D animations that dive deeply into the   technology that drives our modern 
world. Watch another Branch video   by clicking one of these cards or click here 
to subscribe. Thanks for watching to the end!

---

## 9. How do Electron Microscopes Work? 🔬🛠🔬 Taking Pictures of Atoms
**Channel:** Branch Education | **Views:** 4.6M | **Date:** 2 years ago | **Duration:** 19:54 | **ID:** 9DnnxvS6BBQ
**Link:** https://youtube.com/watch?v=9DnnxvS6BBQ

### Transcript:
Have you ever wondered how scientists and
engineers design transistors that are around the width of a strand of DNA? How do we even take pictures of such nanoscopic
transistors? Well, that’s the role of the electron microscope
which has literally changed the way humanity sees the micro and nanoscopic world. Don’t believe us? Take this European Peacock Butterfly for example. When we zoom in on its wing using a light
microscope, we see that it’s composed of tiny overlapping scales. But, when we zoom in using an electron microscope,
we can clearly see the shape of each scale, and zooming in further, we see how the scales
have a truly incredible texture entirely foreign to anything that humans manufacture. Although this wing may not be directly related
to the technology you’re familiar with, scientists and engineers have been using electron
microscopes for the past 60 years to develop smaller and smaller transistors, and with
today’s technology this microscope can zoom in millions of times to where it’s able
to capture images of individual atoms. There are two main types of electron microscopes. The Scanning Electron Microscope or SEM is
used to see surface images like this butterfly wing, or the bristles of a used toothbrush. See, here are cells from your body, and all
around here in yellow is bacteria. It’s gross, but let’s move on. Scanning Electron Microscopes have a maximum
resolution of around 1 nanometer. Meaning the spacing between two adjacent features
or dots of resolvable data in an image is 1 nanometer. The other type is the Transmission Electron
Microscope or TEM which is used to take images of structures that are inside materials, much
like an x-ray machine takes pictures of the bones inside our bodies. For example, TEMs are used to take the pictures
of these sections of a transistor. However, in other domains of science TEMs
can be used to take images of proteins inside mitochondria, the powerhouse of the cell,
or of nanoparticles of pure gold. Transmission Electron Microscopes are typically
more complex than SEMs and have a resolution up to 50 picometers, which is roughly the
size of a hydrogen atom. One quick note is that this video’s sponsor,
Thermo Fisher Scientific, provided us with a basic 3D model of one of their transmission
electron microscopes and assisted in our understanding of the complex technology involved. Let’s first focus on the TEMs as they are
more commonly used in developing cutting-edge technology, and later we’ll provide an overview
of the scanning electron microscope. And note that there’s considerable overlap
between the engineering inside them both. The basic idea behind a TEM is that it generates
electrons and accelerates them to around 70% the speed of light, thus creating a beam of
electrons. Next a series of magnetic lenses focuses the
electrons down to a small area and shoots or transmits these electrons through the specimen
that we’re looking at. Depending on the different densities and materials
inside the specimen, the electrons are scattered as they pass through it, thereby imprinting
an image of what’s inside the specimen onto the beam of electrons. The imprinted beam of electrons is then magnified
40 times using an objective lens and further magnified 50,000 times using a set of projector
lenses. At this point, the imprinted image is 5 or
so centimeters wide and large enough to be captured by a high-resolution camera sensor
at the bottom of the microscope. We’ll explore the detailed engineering in
a little bit, but for now, you might be wondering why do we have to go through the hassle of
manipulating electrons, and why can’t we just use light? Well, visible light is physically limited
to magnifications up to around 2000 times, and, if you try to zoom in further the image
remains blurred without revealing any more details. On the other hand, electrons can reach meaningful
magnifications up to 2 million times. Why then is light physically limited? Well, let’s return to this image of the
European peacock butterfly and the scales on its wings. This image was captured with a camera, this
image was taken with a light microscope, and these images were captured with an electron
microscope. Let’s consider two features from the specimen
that are only 100 nanometers apart. Visible light has an average wavelength of
540 nanometers, which is larger than the distance between these two points. Due to the physics of waves, as light hits
these two features it’s bent around, thus creating a pair of propagating waves with
a diffraction pattern resulting from the interference of the two waves. If the features are substantially closer than
the wavelength of visible light, then the diffraction pattern will make the two features
appear like a single blurred feature. In short, visible light can’t really resolve
features that are less than 300 nanometers apart. However, in this electron microscope, electrons
are accelerated to 70% of the speed of light and have a wavelength of 2.5 picometers which
is around 200,000 times smaller than visible light’s wavelength. In principle, such an electron microscope
could resolve features spaced just 1 picometer apart, but, due to the magnetic lenses’
physical limitations the real resolution is around 50 picometers, which is enough to see
individual atoms in a material. Also, if you’re wondering about the scale
of micrometers, nanometers, and picometers, here’s a comparison of the size of each
unit. Note that there are many more details and
facts that were cut from this video’s script and thrown into the creator’s comments which
you can find in the English Canadian Subtitles. That said, let’s now dive into the complex
science and engineering behind each part of this Transmission Electron Microscope. We’ll begin at the top with a device called
a field emission source which generates free electrons. The basic principle is that negatively charged
electrons are attracted to positive electric fields. Here we have a tungsten crystal needle, and
below is a ring called the extractor. This extraction ring is connected to positive
5 thousand volts, and as a result the negatively charged electrons in the tungsten are pulled
towards the extractor. The electric field’s effect on the electrons
is amplified by the sharply pointed tungsten crystal, which is only a few nanometers wide,
and as a result the electrons are freed from the tungsten. The next step is to accelerate them to 70%
the speed of light. To do this we use a series of metal rings
which are graduated to be tens of thousands of volts apart from one another. And, just like before, these positively charged
rings use electrostatics to attract the negatively charged electrons which are accelerated through
the center of the rings. There are two key reasons for the incredible
speed of the electron. First is so they can travel through the specimen,
whether it be a transistor, protein or a crystal lattice or something else that has been sliced
to typically only 100 nanometers in thickness; and second, as mentioned earlier, electrons
exhibit wavelike properties, and the faster they are, the shorter the wavelength and the
higher the resolution achievable. One important detail is that when the microscope
is running and electrons are being accelerated to relativistic speeds, vacuum pumps are used
to remove all the atmospheric molecules, thus creating a vacuum, similar to the vacuum of
outer space. This is because incredibly fast-moving electrons
will scatter in random directions as they collide with air molecules and thus ruin the
images of the specimen. Now that we have a beam of electrons, we’ll
explore the magnetic lenses of which there are essentially three sets: the condenser,
the objective, and the projector. The role of the condenser magnetic lenses
is to focus the electrons from the source and project them onto the sample so that they
illuminate an area the size of a micrometer to several nanometers depending on the desired
magnification. Additionally, the microscope uses apertures,
or holes placed in the path of the beam to filter out any electrons that are fanning
too far from the center of the column, or optical axis, resulting in electrons more
parallel to one another before they hit the specimen. The specimen is placed on a holder which is
inserted through an airlock into the vacuum chamber. To see different aspects of the specimen such
as the crystal lattices, the holder can move, or translate the specimen in all three directions,
X,Y, and Z, and rotate the specimen along the X-axis, and with some holders, also the
Y-axis. With this we can get images exactly perpendicular
to the features such as these transistors inside. The incredibly small beam then hits the specimen
composed of different elements and densities of materials, thus scattering the electrons
in different ways thereby imprinting an image on the transmitted electron beam. The next lenses, the objective and a series
of four projector lenses, are used to resolve and magnify the miniscule image imprinted
into the electron beam up to a width of a few centimeters. This process is separated into two parts. First the objective lens – often considered
the heart of the microscope – magnifies the image by 40 times and its optical aberrations
define the final resolution. Then the projector lenses magnify the image
the rest of the way by 50,000 times. What are optical aberrations and why is 2
million times the typical maximum magnification? Well, let’s look at this image of 962 blurry
atoms of gold. With today’s technology, the TEM’s ability
to resolve the smallest features is not limited by the electrons in the beam, but rather by
the lenses and the aberrations and distortions that they add to the image-imprinted electron
beam after it has been magnified. There are a few main types of aberrations
such as spherical and chromatic, which we won’t explore further, but the main idea
is that perfectly controlling a beam of electrons is far from trivial and the aberrations add
blurriness and impede resolution after the magnification. The projector lenses magnify what has already
been magnified by the objective lens, including the added aberrations, and this second magnification
adds its own aberrations afterwards. Therefore, a considerable amount of science
and engineering is dedicated to reducing the aberrations introduced by the objective lens,
as that is what ultimately limits the sub-nanometer scale resolution of the microscope. One thing you’re probably wondering is why
these magnetic lenses look nothing like microscope or camera lenses and how do magnetic lenses
operate on fast moving electrons? Well, inside the lens is a coil of copper
wire surrounded by an iron housing. When a current is run through these coils,
a magnetic field is produced. This magnetic field is then routed through
the iron to the pole pieces where it’s channeled into an optical column. These magnetic fields are then used to change
the trajectory of the electron by bending the electrons towards the center, or optical
axis, in a shrinking helical direction. The physics at play is the Lorentz Law. To summarize, the force on the electron is
equal to its charge, Q, times V or the electron’s velocity vector crossed with B, the magnetic
field vector. In short, if the electron were to have a velocity
away from the optical axis, it would be forced by the magnetic field down towards the center. However, if the electron were traveling perfectly
down the center along the optical axis, it wouldn’t experience any Lorentz force from
the magnetic fields and would just continue down the center. As a result, the magnetic lenses act as convex
or converging lenses, focusing all the electrons down to a focal point. As the electrons continue their trajectory
past the focal point and expand, they produce a magnified image. This magnification depends on the strength
of the magnetic fields, the position of the lenses, and the position of the detectors
and cameras. Let’s move further down the microscope and
explore how we turn electrons into images. There are two separate systems. First, we have a phosphorescent screen which
has a special coating that glows when electrons hit it and a camera is used to view the screen. This system is used to align the microscope
and provide an overview of the specimen. When you’re ready to capture a high-resolution
image, the phosphorescent screen moves out of the way, and the image is captured using
the second system with a more sensitive CMOS camera that has a higher resolution and dynamic
range. The purpose of having two systems is that
the phosphorescent screen and camera is used to ensure that the electron beam and magnetic
lenses are set up properly, as an incorrectly focused beam could damage the sensitive CMOS
camera. We’ve covered many key parts of the microscope,
but there are other pieces of equipment and modules that provide additional features. For example, there are X-Ray detectors, energy
filters, phase plates, monochromators, multipole correctors, mechanisms to hold and adjust
apertures, water cooling for the magnetic lenses, tons of circuitry to control the magnetic
lenses and the field emission source, vacuum pumps, power supplies, and much more. Additionally, the entire microscope sits on
air cushions to remove external vibrations. Undoubtedly, this microscope represents an
incredible amount of science and engineering, and we’re thankful to this video’s sponsor,
Thermo Fisher Scientific, for allowing us to look inside. In addition to electron microscopes, Thermo
Fisher also makes a wide range of laboratory equipment such as centrifuges, incubators,
x—ray and mass spectrometers, and in fact they make PCR systems that can be used to
test for Covid 19. Undeniably, Thermo Fisher products are some
of the backbones of scientific research in labs across the world. Thermo Fisher isn’t sponsoring this video
because they want you to buy a multi-million-dollar electron microscope, but rather, just like
us at Branch Education, they believe that the future of humanity lies in the hands of
scientists’ and engineers’ abilities to discover, innovate, and engineer solutions
to the problems that face humanity. If you’re pursuing a career in science or
engineering, take a look at Thermo Fisher Scientific. You too could work on creating the tools that
propel science and engineering forward. Now that we understand the transmission electron
microscope, let’s look at the Scanning Electron Microscope or SEM which Thermo Fisher Scientific
also manufactures. The main idea is that, instead of illuminating
an area of a specimen and imprinting the image all at once, with a SEM we create a focused
spot, and scan this spot across the object we’re trying to magnify. These electrons then bounce off, and, in the
process, create secondary electrons, back-scattered electrons and X-Rays, which we measure to
get details as to the surface topology and chemical composition. For example, this process was used to create
these images of the butterfly wing, or of this salt crystal. The issue with SEM is that it only takes images
of the surfaces of materials and the resolution is limited by how small we can create the
focused spot and by how deep the electrons penetrate into the sample, or the so-called
interaction volume. The practical resolution is typically around
1 nanometer. Additionally, a useful variation of the Transmission
Electron Microscope that’s worth mentioning is called an STEM, where the S is for scanning. This microscope is similar to the TEM, but
like the SEM, we focus the beam into a spot and then use deflection coils to scan the
spot through the specimen. The benefit of STEM is that it has a different
mechanism for creating image contrast and, when paired with an x-ray detector, is capable
of elemental analysis of the sample. More expensive TEMs typically have the optical
elements and circuitry to perform both TEM and STEM, and the user can toggle between
the two modes. We’re sure you have many questions; feel
free to put them in the comments below, and we’ll try to answer them in the top pinned
comment. Also, one of the scientists from Thermo Fisher
who works on these microscopes and helped us to research and write this script, has
written the creator’s comments with loads of additional information, so take a look
at them in the English Canadian Subtitles. We believe the future will require a strong
emphasis on engineering education and we’re thankful to all our Patreon and YouTube Membership
Sponsors for supporting this dream. If you want to support us on YouTube Memberships,
or Patreon, you can find the links in the description. This is Branch Education, and we create 3D
animations that dive deeply into the technology that drives our modern world. Watch another Branch video by clicking one
of these cards or click here to subscribe. Thanks for watching to the end!

---

## 10. How do Computer Keyboards Work? 🤔⌨⌨🛠
**Channel:** Branch Education | **Views:** 1.8M | **Date:** 2 years ago | **Duration:** 11:09 | **ID:** h-NM1xSSzHQ
**Link:** https://youtube.com/watch?v=h-NM1xSSzHQ

### Transcript:
You might not think it, but basic computer 
keyboards have a surprisingly impressive   amount of engineering inside. We’re not 
talking about incredible engineering   like a rocket that can land itself or a 
stealth aircraft that can evade radar;   rather, we’re talking about the engineering of 
cost reduction. Specifically, this keyboard has   only 8 critical parts inside, essentially removing 
all the components’ costs so that you can buy them   in bulk for as little as 1 dollar and 57 cents 
each! Engineering something that is durable,   functional, and costing next to nothing is 
indeed a feat on its own. So, let’s look inside   this dirt-cheap keyboard and see how only a few 
critical components enables it to work. After that   we’ll open a mechanical keyboard that costs over 
50 times as much and see the difference as well as   find out what causes that clicking sound inside 
the mechanical keys. So, let’s jump right in.  This inexpensive keyboard is assembled from 148 
parts, and almost all the parts are the keys,   screws, and the top and bottom plastic casing, 
leaving us only 8 critical parts inside. These   components are a rubber sheet with domes under 
each key and three plastic sheets. The top and   bottom sheets have conductive wires printed 
onto them, with dots under each key, and the   middle sheet acts as a spacer with holes cut out 
of it. The remaining 4 components are 2 batteries,   a bracket to clamp down the plastic sheets, 
and a small printed circuit board which has a   simple microprocessor, a crystal oscillator, 
a switch, a 2.4 gigahertz planar antenna,   a pair of wires to connect to the batteries, and 
a set of conductive lines to connect to the wires   printed on the top and bottom plastic sheets.
So now that we’ve seen the few components inside,   how do they work? Well, the main idea is that 
the batteries and microprocessor apply 3 volts   to all the traces on the bottom sheet, while 
all the traces on the top sheet are actively   being monitored by the processor on the PCB. When 
a key is pressed, it presses on the rubber dome,   which pushes the conductive circle from the top 
sheet down through the air gap created by the   middle sheet and into the circle on the bottom 
sheet, thereby bridging the connection between   top and bottom plastic sheets. The 3 volts then 
travels along the conductive trace of the bottom   sheet through the hole of the key that has been 
pressed, and into the top sheet’s trace, and then   returns back to the PCB and microprocessor where 
it’s sensed. When you let your finger off the key,   the rubber dome returns the key to the un-pressed 
position thereby opening the connection.  On the top sheet of plastic are 12 traces 
and on the bottom sheet are 11 traces,   with each trace traveling to a different set of 
keys. It’s visually hard to see here, so let’s   reorganize these traces into a grid, also called 
a keyboard matrix, with the bottom traces forming   the columns and the top traces forming the rows. 
Just as before the microprocessor outputs 3 volts   along each column while actively monitoring the 
in-puts along each row. With this reorganization,   you can more easily see that, as you press the 
Y key, 3 volts is sent out along the 4th column,   and returned along the 2nd row, and thus the 
processor can tell that the Y key was pressed.   Or with the B key, 3 volts is output along 
the 8th column, and input through the 1st   row. With 11 columns and 12 rows, we can have 
a maximum of 132 keys, which works out well,   because the keyboard has only 111 keys.
However, if you haven’t noticed, there’s   actually a major problem with this keyboard 
matrix. That is: if we have 3 volts running   along all these columns and we press a key, 3 
volts will return along a row. However, because   each of these columns output the same 3 volts, how 
do we know which key in the row was pressed? Well,   there are a few solutions to this problem. One 
solution is to quickly scan 3 volts along each   of the 11 columns, so that at any given time 
only one column is active. By correlating the   active column with when voltage is received on the 
input row, we can determine the exact intersection   of column and row and thus which key is pressed. 
However, with this solution, we’re continuously   scanning 3 volts across the columns, which takes 
power thereby draining the batteries. So instead,   we found that it’s more practical to have 3 volts 
on each column, and when a key is pressed, a cycle   of pulses of turning off one column at a time is 
sent to determine which key in a row is pressed.   These pulses are sent for 65 microseconds to each 
column, once every 4 milliseconds. Therefore, if   the G key were pressed, then the 3rd row would see 
an input that looks like this. Whereas if the T,   L, and A key were pressed, then the 2nd and 6th 
row inputs would see a voltage that looks like   this, and all the other rows would see nothing.
Now that the microprocessor knows which keys are   pressed, it sends the data to the 2.4 gigahertz 
transceiver using these printed planar antennas.  We’ll cover these antennas as well as the 
oscillator in another video, but for now let’s   close this inexpensive keyboard and look inside a 
mechanical keyboard that costs over 50 times more.  But before exploring mechanical keyboards, 
the next portion of this video is sponsored   by Keysight’s virtual event, Keysight World: 
Live from the Lab. In this livestream, Keysight   will be exploring batteries, DC to DC converters, 
and a wide range of IoT devices through hands-on   design analysis and Q and A sessions with industry 
experts. Sign up quickly because the next Keysight   Live event is May 16th, and by attending this live 
stream you’ll be entered to win an oscilloscope   in their test gear giveaway. In fact, the only way 
we were able to reverse engineer this keyboard was   with an oscilloscope just like this one, where 
we could easily see the cycling of OFF pulses   whenever a key is pressed. At Keysight’s upcoming 
Live from the Lab event, you’ll learn many useful   tools such as how temperature can affect battery 
and device life as well as techniques and tricks   for using DC to DC converters in your designs.
Whether you’re an expert engineer or electronics   newbie, there’ll be plenty of opportunities to 
learn new things. Hurry up and register for the   May 16th Keysight World livestream using 
the Branch Education link, and you’ll get   an extra entry into Keysight’s huge test gear 
giveaway. Go check it out! But now let’s get   back to the inside of this mechanical keyboard.
Instead of seeing plastic sheets, we find a rather   large, printed circuit board, with mechanical keys 
soldered to it. This PCB functions similarly to   the keyboard matrix, but now we have an LED under 
each key to create attractive designs. However,   quite noticeable with the mechanical keyboard 
is that these keys have a different tactile feel   and make a clicking sound when pressed.
So, let’s look inside one of these keys where   we find a keycap on top, the stem and slider 
below that, a top and bottom switch housing,   and inside are a spring and two metal 
contacts which are also called metal   contact leaves or gold crosspoint contacts.
The main mechanism is that when you press a   key down, it moves the stem and slider. The 
slider is uniquely shaped such that it pushes   one of the contacts away from the other, and, when 
pressed down, the slider moves out of the way,   allowing for one of the metal contacts to spring 
outwards and hit the other, thus creating a   connection between the two pieces of metal and 
causing a click sound when they hit. When you   release the key, the spring pushes the slider, 
the stem, and key back up and the slider reengages   the metal contact, thus separating the two metal 
contacts and opening the connection between them.  The stem and slider are separate components, so 
that if you accidentally brush a key, the keycap   and stem can travel a small distance down before 
the slider is engaged. However, once the slider is   pushed a frac-tion of a millimeter down, the metal 
contact quickly forces the slider to jump out of   the way allowing the metal contacts to engage.
By having such a mechanism, each key has a more   tactile feel when pressed, different from 
the key hitting the rubber dome. That said,   having a large PCB such as this, as well as an 
intricate mechanism inside each key, causes this   keyboard to be significantly more expensive, but 
depending on your preferences, it can be worth it.  Finally, there are laptop keyboards which 
have a scissor switch mechanism along with   rubber domes to allow it to have a lower 
profile, but let’s wrap it up for now.  This topic is moderately simple, but we think 
it properly highlights the cost difference and   engineering in two similar items. We’re working on 
more videos that dive deeper into the engineering   inside computer architecture and other complex 
technologies, so be sure to subscribe, hit that   like button, and share this video with others.
We believe the future will require a strong   emphasis on engineering education and we’re 
thankful to all our Patreon and YouTube Membership   Sponsors for supporting this dream. If you want 
to support us on YouTube Memberships, or Patreon,   you can find the links in the description.
This is Branch Education, and we create 3D   animations that dive deeply into the technology 
that drives our modern world. Watch another Branch   video by clicking one of these cards or click 
here to subscribe. Thanks for watching to the end!

---

## 11. How does Computer Hardware Work?  💻🛠🔬  [3D Animated Teardown]
**Channel:** Branch Education | **Views:** 3.6M | **Date:** 2 years ago | **Duration:** 17:13 | **ID:** d86ws7mQYIg
**Link:** https://youtube.com/watch?v=d86ws7mQYIg

### Transcript:
Throughout this video we’re going to do
a desktop computer dissection using 3D animation.  Kind of like a dissection lab in biology class,
but instead, we’ll journey through the inside of this computer and disassemble every piece
of hardware.  We’ll then use a microscope and zoom in to give you a nanoscopic view
of the transistors and other structures inside.  To make this video we disassembled all the
hardware inside a typical desktop computer, we desoldered and removed the components from
each of the printed circuit boards and took thousands of pictures.  Then using these
pictures, we meticulously 3D modeled every single component from the computer case down
to the tiniest resistor.  As a result, here’s all the hardware that we’ll explore throughout
this video.  It kind of looks like a crime scene where someone viciously destroyed a
computer and arranged all the components, but anyways let’s dive right in.  
We’ll begin this journey with the  Central Processing Unit or CPU which is the brain
of the computer.  On top we have the cover, called an integrated heat spreader, and inside
is a smaller metal package that holds the integrated circuit which is technically called
a die. This die is mounted on a printed circuit board that distributes the 1200 connection
points to landing pads that interface with the landing grid array on the motherboard.
The integrated circuit inside has a few different sections, but perhaps the most recognizable
are the 10 cores where programs and instructions are run.  Each core is quite  complicated,
so here’s a diagram laying out the different functional sections.  There are dozens of
rather complicated elements in this diagram, and you can look forward to a series of videos
we’re currently planning which will explore computer architecture and how each of these
sections work. Let’s zoom into a nanoscopic view of the
integrated circuit so we can see individual transistors.  These transistors are incredibly
small, only a few nanometers wide  and in this die there are approximately 8 to 10 billion. 
On top of the transistors are multiple layers of metal wires with vias rising vertically
between the layers.  Together these transistors and wires create a multilayer labyrinth or
highway resulting in a computer that can execute billions of operations every second.  
Let’s now zoom out and look at other sections of the CPU.  To the side of each core is
the shared L3 memory cache and ring interconnect.  On the far right is an integrated graphics
processor which functions as a less powerful GPU; in the top left is the memory controller
which sends data to and from the DRAM; and finally on the far left is the system agent
and platform I/O, which communicates with the Chipset on the motherboard and manages
the flow of data between many of the other components in your PC.  So, with that in
mind, let’s move on and look at the motherboard.  This motherboard is a massive, printed circuit
board with thousands of wires running inside and a variety of microchips, components,
sockets, ports, slots, headers and connectors soldered to it.  Perhaps the single most
important and expensive component, aside from the bare PCB, is the Chipset, which is this
integrated circuit found underneath a heat sink down here and is connected directly to
the system agent section in the CPU.  Here’s a diagram illustrating how the CPU and chipset
are connected to everything else.  As seen here, the CPU connects directly to the DRAM,
one or two displays, the GPU, and perhaps a few SSDs plugged into the M2 slots.  The
Chipset manages most everything else: data flowing through the ethernet or Wi-Fi, data
going to and from solid state drives and hard drives plugged into the SATA ports, some of
the PCIe slots, your keyboard and mouse, USB devices, and the audio sent to the speakers
or from the microphone.   Just a quick note, computer hardware has evolved
immensely over the past 65 years and continues to evolve, so the details we show should be
thought of as a current day example PC and not as how all computers work.
Let’s move on and skip over the many different sockets and connectors throughout the motherboard
and focus on the voltage regulator module or VRM found near the CPU.  These components
are used to drop the voltage coming from the power supply down to the 1.3 volts used by
the CPU.  As a result of all the power flowing through these components and their 80 to 90
percent efficiency,  heat sinks need to be  placed on top.
While we’re on the topic of power, this CPU consumes power equivalent to approximately
16 LED bulbs, thus generating a considerable amount of heat which is taken away by the
CPU cooler.  This particular cooler uses a pump to circulate liquid through these tubes
and into the radiator’s channels which transfers heat to the radiator fins.  The fans then
help transfer the heat to the air and the cooled liquid returns to the pump via the
return loop.  The pump is a brushless DC motor constructed from a PCB, a control chip
and a stator on the dry side, a barrier in the middle, and then the permanent magnet
rotor and impeller on the liquid side.  There’s no mechanical connection between the rotor
and stator, thereby preventing any leaks of the cooling liquid. 
Let’s move onto the power supply which distributes power throughout the computer.  In here,
the main transformer reduces the voltage and bridges the isolation boundary between the
primary side high voltage and the secondary side lower voltages used throughout your computer. 
Here’s the control PCB that ensures a stable output voltage and sends adjustment signals
to the switching power transistor on the primary side using opto-isolators.  There are dozens
of other components used to filter the input voltage and generate various output voltages
which are then sent to all the different hardware in your computer.  For example, an SSD consumes
just a few watts, and the connector uses these voltages, whereas your GPU can consume hundreds
of watts using these connectors and these voltages.
Next, we’ll explore the GPU, but before that, let’s take a step back and consider
the technology we’ve covered thus far.  Alone, each of these components doesn’t
do much at all, but when united, they combine to form a powerful system.  Similarly, this
video is a multidisciplinary combination of engineering, technology, art and animation
inspired by the Magic School Bus.  We can’t emphasize enough how important it is to be
a multidisciplinary student.  And to help you do that, the sponsor of this video is
Brilliant.org.  Brilliant is a multidisciplinary online education platform which teaches a
ton of different topics in hands-on interactive ways.  Here are two courses from different
disciplines that you might think were entirely unrelated.  However, when combined they provide
the foundational basis for a cutting-edge field of science and engineering.  This combination
of seemingly unrelated courses can be done with pretty much any two courses that Brilliant
offers.   Don’t worry, you won’t be learning from 
boring textbooks, but rather Brilliant uses interactive modules to make their lessons
entertaining and help the concepts stick in your head. 
It’s incredibly easy to sign up.  Try out some of the lessons for free and, if you like
them, which we’re sure you will, you can sign up for an annual subscription.  We personally
are currently working through their lessons on quantum circuits and algorithms for a future
video that dives into Quantum Computers. Brilliant is offering a free 30-day trial
with access to all of their thousands of lessons, and to the viewers of this channel, Brilliant
is offering 20% off an annual subscription to the first 200 people who sign up.  Just
go to brilliant.org/brancheducation.  The link is in the description below.  
Let’s get back to dissecting this computer and move onto the graphics card and GPU which
is also the brain of the computer… well… actually this analogy doesn’t really work
very well but anyway…  Opening the graphics card we see another PCB, with the GPU’s
integrated circuit in the center, VRAM chips all around, and the voltage regulator module
on the side.  Above the IC is a heat sink with a fan to dissipate heat, and on the side
of the graphics card are HDMI and Display Ports, a PCIe Interface and then on the other
side is the input power connector.   Let’s focus on the GPU integrated circuit
which, similar to the CPU, has more than a thousand solder pads that connect it to the
PCB.  Opening the packaging we find the GPU die which is noticeably different from the
CPU.  In here are approximately 11.8 billion transistors organized into 6 graphics processing
clusters, totaling 28 streaming multiprocessors.  Each streaming multiprocessor is composed
of 128 cores, resulting in a total of 3,584 cores.  Each core has sections for integer
and floating-point arithmetic, and sections for queueing in the operands and collecting
the results and is far simpler than a CPU core.  Additionally, on the die is an L2
memory cache shared among all the graphics processing clusters, a set of memory controllers
that connect to the VRAM located around the processor, and a PCIe interface for connecting
to the CPU. When we zoom in to see a nanoscopic view of
the integrated circuit we find something very similar to what we saw in the CPU, with the
transistors on the bottom and a labyrinth of multiple layers of metal wires above. 
All these structures are manufactured in multibillion dollar semiconductor fabrication plants or
fabs but that’s a topic for a whole different video, so let’s move on.  GPUs and CPUs
are similar in many ways, however, GPUs have thousands of cores that are limited to basic
arithmetic, whereas CPUs have only a handful of cores that perform far more complicated
operations.  Additionally, CPUs have branch prediction and deep pipelines that optimize
the execution of code.    Here’s a quick example of what GPUs can do.  Take this image
comprised of 16 million pixels each with RGB values for each pixel.  A simple way to brighten
the image is to add 20 to each of these numbers.  A CPU has 10 cores and thus performs arithmetic
10 numbers at a time whereas GPUs distribute the data to thousands of cores thus performing
magnitudes more parallel processing.  Let’s close this graphics card and talk
briefly about the 3D model.  Note that this is a slightly older model graphics card because
we buy most of our hardware as non-functioning parts from eBay, and then, as shown earlier,
we tear them down rather destructively in order to accurately model everything.  Additionally,
sometimes components shown aren’t compatible, such as this motherboard that says DDR4, while
the DRAM is DDR5.   That said, modeling and animating everything
to make it feel like you’re actually inside a computer took us around 500 hours and we
would greatly appreciate it if you could take a few seconds to hit that like button, subscribe
if you haven’t already, type up a quick comment below, and share this video with someone
who will enjoy it.  Also, we have a Patreon and would appreciate any support.  We’re
planning more videos on computer architecture and other related topics and can’t do it
without your help, so thank you for doing these 4 quick things. It helps a ton.
Let’s move on and look at the DRAM, Solid State Drives, and Hard Drives.  We’re not
going to spend too long, because we have an entire series of videos on solid state drives,
and then separate videos covering DRAM, and Hard Drives.  But quickly, the CPU communicates
directly with the DRAM through memory channels running inside the motherboard.  Inside each
of these 8 DRAM chips is an integrated circuit composed of 32 memory banks each 8192 columns
wide by 65536 rows tall.  The DRAM temporarily stores data using capacitors and transistors
called 1T1C memory cells in 2D arrays that look like this.  Data can be accessed within
nanoseconds, however, among these 8 chips, only 16 Gigabytes of data can be temporarily
stored.    Take a look at our 35-minute video on DRAM, but for now let’s move on
to SSDs which permanently store data in 3D arrays called 3D NAND.  This array is 100
to 200 layers tall, 32 to 64 thousand columns wide and 32 to 64 thousand rows deep.  Additionally,
within a single SSD chip such as this one, are multiple 3D NAND arrays stacked one on
top of the other.  As a result, a single microchip can store terabytes of data, however
reading or writing data takes 50 or so microseconds, which is 3000 times slower than DRAM.  Zooming
in on a single SSD memory cell we find a charge trap which stores different levels of charge
allowing for 3 bits of data to be more permanently saved.  Looking at the NVMe and SATA SSD,
both have a few 3D NAND data storage chips, a DRAM chip for buffering and holding the
data mapping table and a controller chip. Let’s move on and dissect the hard disk
drive.  Here we have a disk mounted to a spindle with a motor that rotates the disk
at thousands of rpm.  A read write head moves across the disk in order to access a single
track out of half a million other data tracks.  Let’s zoom in on the read write head. 
The write head changes the direction of localized magnetic domains in a small layer on the disk
whereas the read head senses these changes in magnetic domains.  This disk drive is
even slower than the SSD, taking a few milliseconds to access, thus resulting in slower read and
write times, but costing less per terabyte of storage.
Thus far we’ve covered all the hardware inside your computer.  So, thanks for watching
this far, and as a bonus here’s what it looks like inside a computer mouse, with the
scroll wheel up top, the infrared light, image sensor, and multiple lenses down here and
the battery and processor in the middle.  For computer mice we have separate dedicated
videos exploring the image sensor and scroll wheel with incredible details.
Additionally, here’s what it looks like inside a basic keyboard, with plastic traces
that carry electricity to each key and, when pressed, that key completes a circuit which
is sensed by the processor up here.   That’s pretty much it for what it looks
like inside your computer.  We believe the future will require a strong emphasis on engineering
education and we’re thankful to all our Patreon and YouTube Membership Sponsors for
supporting this dream.  If you want to support us on YouTube Memberships, or Patreon, you
can find the links in the description.  Also, thank you again to Brilliant for sponsoring
this video. This is Branch Education, and we create 3D
animations that dive deep into the technology that drives our modern world.  Watch another
Branch video by clicking one of these cards or click here to subscribe.  Thanks for watching
to the end!

---

## 12. How do Hard Disk Drives Work?  💻💿🛠
**Channel:** Branch Education | **Views:** 3.0M | **Date:** 3 years ago | **Duration:** 15:16 | **ID:** wtdnatmVdIg
**Link:** https://youtube.com/watch?v=wtdnatmVdIg

### Transcript:
Imagine every picture you took over the past year, 
all saved within the area of a single dot of ink   from a ballpoint pen. Well, this is approximately 
how compact data is stored inside a hard disk   drive, and in this video, we’re going to open one 
up and see how an entire library worth of books is   able to fit within the surface of this metal disk.
We’ll start by opening up this hard drive and   detailing the components inside. After that, we’ll 
dive into exactly how the drive stores data using   the read and write head, and in the process, we’ll 
look at the tracks, sectors, and magnetic domains   of the metal disk. Finally, we’ll explore some of 
the latest advances that enable over a terabit of   data to fit within every square inch of the 
disk. This video is sponsored by PCBWay; more   on them later, but for now let’s jump right in.
On the inside of this drive, we find a variety of   components. Here’s the disk or platter that 
stores all the data, and, depending on the   storage capacity of the drive, might be multiple 
platters tall. The disk is composed of an aluminum   magnesium alloy with multiple coatings of other 
alloys, but the magnetic, functional layer is   this 120-nanometer thin layer of a cobalt chromium 
tantalum alloy which has small magnetic domains or   regions whose direction can be manipulated via 
external magnetic fields. The platter is mounted   on a spindle which spins at a speed of 7200 
rpm using a brushless DC motor at its center.  Next, there’s a head stack assembly, with 
one arm above and one arm below each disc,   and with a slider and a read/write head at the 
end of each arm. The slider is uniquely designed   such that it catches the airflow generated by 
the ludicrously fast-spinning disk and uses the   air flow to float or fly the read/write head so 
that it’s only 15 nanometers or about 100 atoms   away from the surface of the disk. For reference, 
here’s the thickness of a sheet of aluminum foil.   Because the arm assembly flies on top of 
the spinning disk, it’s only brought over   the surface when it’s at full speed, and when 
the disk is not spinning, the arm assembly is   parked to the side on a small piece of plastic.
Back here a voice coil motor composed of a coil   of wire and two strong neodymium magnets above 
and below is used to move the entire arm stack   assembly. When electric current is run through 
the coil it creates an electromagnet which   is influenced by the neodymium magnets, thus 
generating a force that causes the arm to move   across the disk. When a reverse current is sent 
through the voice coil, the arm is forced in the   opposite direction, thereby enabling control of 
the exact position of the read/write head within   30 or so nanometers. Additionally, the magnets and 
voice coil make a rather strong motor that enable   the lightweight arm stack assembly and read/write 
head to move back and forth to different tracks   across the platter up to 20 times a second 
and to make small adjustments incredibly fast.  In order to connect to the read/write head, a 
flexible ribbon of wires is routed along the   side of the arm and down to this connector which 
feeds signals to the outside of the hard drive   enclosure and to the printed circuit board or PCB. 
On the PCB we have the main processor as well as   a DRAM chip, which is used as a scratchpad for 
the processor and a buffer for the incoming and   outgoing data. Additionally mounted on the PCB 
is a chip for controlling the voice coil and   brushless DC spindle motor, and then on the edge 
of the PCB is a SATA connector which connects to   the motherboard for communications and a separate 
connector which goes to the power supply.  Additional important components are the gasket 
that seals the disk from the exterior environment   and two filters that catch any stray dust 
particles. These filters are necessary since   the read/write heads are just 15 nanometers away 
from the platter, and a single dust particle   can be up to 10,000 nanometers large and could 
cause major damage if it were to collide with   the 7,200-rpm disk. Now that we’ve looked through 
many of these components, let’s see how they work.  To begin, the disk is divided into concentric 
circles of tracks. The latest hard drives can   have more than 500,000 tracks on just one side. 
These tracks are then divided into sectors, and   in each sector is a preamble or synchronization 
zone which tells the read/write head the exact   speed of the spinning disk and the length of each 
bit of data. The next part of the sector is the   address which helps the read/write head know which 
track and sector it’s currently positioned over.   After that we have the actual data that’s stored, 
typically 4 kilobytes of data per sector. Next is   an area for an error correcting code, or ECC, 
which is used to verify that the data stored in   the block is accurately written and properly read, 
and finally there’s a gap between this sector and   the next which allows the read/write head some 
tolerance when writing the contents of a block.  Now let’s zoom in on the read/write head 
and the disk to see exactly how data is   written and read. Writing data to the disk 
is done by manipulating the direction of   magnetization of a localized region or domain 
of the cobalt-chromium-tantalum layer in the   disk and forcing the region to be magnetized 
in the up direction or the down direction.   This tiny magnetic domain or region is around 90 
by 100 by 125 nanometers, and when magnetized,   all the atoms will have their even tinier magnetic 
north/south poles pointing in the same direction.  In order to magnetize a single domain, which 
is equivalent to writing a single bit of data,   a current is applied to a coil of wire at 
the back of the write head, thus creating a   strong magnetic field back here. The magnetic 
field is channeled through the write head and   focused into a small point at the tip and then 
jumps across the 15-nanometer air gap and into   the disk. When the focused magnetic field passes 
into a single domain of cobalt-chromium-tantalum,   all these atoms are forced to align 
their tiny atomic magnetic fields   with the applied magnetic field from the 
write head, thus turning the small domain   or region into a permanent magnet. The key is 
that even when the write head is moved away,   the direction of the magnetic domains in this 
layer of the disk is maintained for years,   and they emit a permanent magnetic field which can 
be repeatedly sensed by the read head every time   you read out the data stored in this sector. That 
is, of course, until the computer and write head   rewrite a new bit of data to the domain by either 
flipping the direction or keeping it the same. Let’s explore how we read data from the disk. Thus 
far we’ve been showing domains as pointing up as a   binary 1 and pointing down as a 0. While this 
is conceptually simple, it isn’t actually the   case. Rather the read head is designed to detect 
the changes in orientation from magnetic domains   pointing in one direction and then the adjacent 
domain pointing in the opposite direction. This   is because emitted magnetic fields from adjacent 
regions that switch their orientations are   much stronger than the emitted field from just a 
single domain pointing one direction or the other.  Therefore, each change in magnetic domain 
pointing in one direction to the opposite   direction is assigned a 1, and an absence 
of a transition from one domain to the next   is assigned a 0. Therefore, the write head would 
record a binary sequence of 0011 0010 like this.   Or a sequence of 1101 1110 like this, where the 
1’s are changes, and the 0’s are lack of changes.  So then, what’s inside the read head that 
detects these magnetic fields? Well, inside   is a multilayer conductive material composed 
of alternating layers of ferromagnetic and   non-magnetic materials. This multilayer material 
has a property called giant magnetoresistance or   GMR, and, put simply, it’s a material that 
changes its resistivity depending on the   strength of magnetic fields that pass through it. 
Therefore, using GMR it’s a simple matter of just   measuring the resistivity, and when there’s a low 
resistivity that means there are strong magnetic   fields below the read head resulting from a change 
in domain orientation and it’s a 1, and when   there’s high resistivity and no change it’s a 0.
However, this poses the problem of how a string   of dozens of non-changing domains can result 
in an ambiguous number of zeroes. To fix this,   in each sector the preamble is simply a 
set of alternating domains and is used   to set the size of each domain, and then 
the error correcting code at the back of   the sector is used to ensure no data is lost.
Next, we’re going to explore some advancements   in hard disk drive technology that improve the 
areal density, which is the number of bits that   can fit within a given area. In this graph, 
you can see how areal density has increased   by over 50 million times throughout the past 60 
years. However, perhaps more important is that   the cost to store trillions of bits of data has 
dropped by over 100 million times. Just imagine,   if we were to time travel this hard drive 
back to the 1960s, it would be worth over   4 billion dollars, and now in 2022 it costs 
less than 40 dollars and is far faster and   more reliable than the disk drives from the 60s!
Similar to the trend in hard drives, you can buy   inexpensive, and yet incredibly reliable printed 
circuit boards from our sponsor PCBWay. Whether   you’re prototyping your next project, or ready to 
mass produce thousands of your finalized devices,   PCBWay can quickly manufacture your PCBs with 
competitive prices and impeccable standards.   Additionally, if you don’t want to spend weeks 
soldering all the components to every board,   PCBWay provides PCB assembly services where 
they populate and solder the components to   the PCB for you. They’ll send pictures throughout 
the assembly process, and you can work directly   with PCBWay’s engineers to provide programming 
and testing protocols. The next time you have   a project and want to save both time and 
money, consider using PCBWay to manufacture   and populate all your Printed Circuit Boards. 
Thank you PCBWay for sponsoring our channel   and supporting engineering education. Check out 
PCBWay using the link in the description below.  Let’s now return to hard drives and see 
some of the advances that allow this disk   to store terabytes of data. First, around 2010 the 
orientation of the domain was switched from being   horizontal to vertical, and with it the write and 
read heads also had to change their orientation.   This change in orientation is due to the fact 
that as a magnetic domain shrinks in volume,   it becomes more easily affected by temperature. 
So, by changing the orientation to vertical,   the domains or magnetic regions can utilize the 
depth of the material while continuing to shrink   the area on the disk that each domain takes up.
The next advancement we’re going to look into   is called Shingled Magnetic Recording or SMR, 
which started being commercially available around   2020. Before shingled magnetic recording, 
hard drives typically used the technique,   Classic Magnetic Recording or CMR, where the 
tracks of data are 90 nanometers wide and have   guard bands on either side of the track.
However, with shingled recording,   the tracks are written to partially overlap with 
previously written tracks with no guard bands to   separate each track. Thus, we can fit many more 
tracks and much more data into a given area.   Note that the read head is much smaller than the 
write head, and as a result one shingled track   can be reliably read at a time. The issue 
however is that if you write over a track,   and the upper track of shingled data is still 
good or valid data, the drive will first have   to read and store that valid data in the DRAM 
buffer, and then write both the lower track of   new data and the upper track of valid data. And, 
as a result, the buffering and the extra read and   write steps can result in a loss of performance.
The third advancement we’re going to discuss   is heat assisted magnetic recording or HAMR which 
is not yet commercially available. Essentially,   this technology utilizes a small, focused laser to 
heat the region that is actively being written to.   By heating the domain, the magnetic region can 
be more easily influenced or coerced to orient   in a particular direction. This is necessary 
because both the write head and the localized   electromagnetic field are incredibly small 
and, by making the magnetic region more easily   coerced using focused heat, we can continue 
to shrink the size of the magnetic domain.  That’s pretty much it for how Hard disks work. 
Thank you to all of our Patreon and YouTube   Membership Sponsors for helping to make this 
video. This is Branch Education, and we create   3D animations that dive deep into the technology 
that drives our modern world. Watch another Branch   video by clicking one of these cards or click 
here to subscribe. Thanks for watching to the end!

---

## 13. How does Computer Memory Work? 💻🛠
**Channel:** Branch Education | **Views:** 5.1M | **Date:** 3 years ago | **Duration:** 35:33 | **ID:** 7J7X7aZvMXQ
**Link:** https://youtube.com/watch?v=7J7X7aZvMXQ

### Transcript:
Have you ever wondered what’s happening inside 
your computer when you load a program or video   game?  Well, millions of operations are happening, 
but perhaps the most common is simply just copying   data from a solid-state drive or SSD into dynamic 
random-access memory or DRAM.   An SSD stores all   the programs and data for long-term storage, 
but when your computer wants to use that data,   it has to first move the appropriate 
files into DRAM, which takes time,   hence the loading bar.  Because your CPU works 
only with data after it’s been moved to DRAM,   it’s also called working memory or main memory.
The reason why your desktop uses both SSDs and   DRAM is because Solid-State Drives permanently 
store data in massive 3D arrays composed of a   trillion or so memory cells, yielding terabytes of 
storage, whereas DRAM temporarily stores data in   2D arrays composed of billions of tiny capacitor 
memory cells yielding gigabytes of working memory.   Accessing any section of cells in the massive 
SSD array and reading or writing data takes   about 50 microseconds whereas reading or 
writing from any DRAM capacitor memory   cell takes about 17 nanoseconds, which is 3000 
times faster.  For comparison, a supersonic jet   going at Mach 3 is around 3000 times faster 
than a moving tortoise.  So, the speed of   17 nanosecond DRAM versus 50 microsecond SSD is 
like comparing a supersonic jet to a tortoise.     However, speed is just one factor.  DRAM is 
limited to a 2D array and temporarily stores   one bit per memory cell. For example, this stick 
of DRAM with 8 chips holds 16 gigabytes of data,   whereas a solid-state drive of a smaller 
size can hold 2 terabytes of data, more   than 100 times that of DRAM.  Additionally, 
DRAM requires power to continuously store   and refresh the data held in its capacitors.  
Therefore, computers use both SSDs and DRAM and,   by spending a few seconds of loading time 
to copy data from the SSD to the DRAM,   and then prefetching, which is the process of 
moving data before it’s needed, your computer can   store terabytes of data on the SSD and then access 
the data from programs that were preemptively   copied into the DRAM in a few nanoseconds. 
For example, many video games have a loading   time to start up the game itself, and then a 
separate loading time to load a save file.    During the process of loading a save file, all 
the 3D models, textures, and the environment of   your game state are moved from the SSD into DRAM 
so any of it can be accessed in a few nanoseconds,   which is why video games have DRAM capacity 
requirements.  Just imagine, without DRAM,   playing a game would be 3,000 times slower.  
We covered solid-state drives in other videos,   so in this video, we’re going to take a deep 
dive into this 16-gigabyte stick of DRAM.  First,   we’ll see exactly how the CPU communicates 
and moves data from an SSD to DRAM.  Then   we’ll open up a DRAM microchip and see how 
billions of memory cells are organized into   banks and how data is written to and read from 
groups of memory cells.  In the process, we’ll   dive into the nanoscopic structures inside 
individual memory cells and see how each   capacitor physically stores 1 bit of data.  
Finally, we’ll explore some breakthroughs and   optimizations such as the burst buffer and folded 
DRAM layouts that enable DRAM to move data around   at incredible speeds. A few quick notes.  
First, you can find similar DRAM chips inside   GPUs, Smartphones, and many other devices, but 
with different optimizations.  As examples,   GPU DRAM or VRAM, located all around the 
GPU chip, has a larger bandwidth and can   read and write simultaneously, but operates at 
a lower frequency, and DRAM in your smartphone   is stacked on top of the CPU and is optimized for 
smaller packaging and lower power consumption.    Second, this video is sponsored by 
Crucial.  Although they gave me this   stick of DRAM to model and use in the 
video, the content was independently   researched and not influenced by them.  
Third, there are faster memory structures   in your CPU called cache memory and even faster 
registers.  All these types of memory create a   memory hierarchy, with the main trade-off 
being speed versus capacity while keeping   prices affordable to consumers and optimizing 
the size of each microchip for manufacturing.  Fourth, you can see how much of 
your DRAM is being utilized by   each program by opening your computer’s 
resource monitor and clicking on memory.  Fifth, there are different generations of DRAM, 
and we’ll explore DDR5.  Many of the key concepts   that we explain apply to prior generations, 
although the numbers may be different.    Sixth, 17 nanoseconds is incredibly fast!  
Electricity travels at around 1 foot per   nanosecond, and 17 nanoseconds is about the 
time it takes for light to travel across a room.  Finally, this video is rather long as it covers 
a lot of what there is to know around DRAM.  We   recommend watching it first at one point two 
five times speed, and then a second time at   one and a half speed to fully comprehend this 
complex technology.  Stick around because this   is going to be an incredibly detailed video.  
To start, a stick of DRAM is also called a Dual   Inline Memory Module or DIMM and there are 8 
DRAM chips on this particular DIMM.  On the   motherboard, there are 4 DRAM slots, and when 
plugged in, the DRAM is directly connected to   the CPU via 2 memory channels that run through 
the motherboard.  Note that the left two DRAM   slots share these memory channels, and the right 
two share a separate channel.  Let’s move to   look inside the CPU at the processor.  Along 
with numerous cores and many other elements,   we find the memory controller which manages 
and communicates with the DRAM.  There’s also   a separate section for communicating with SSDs 
plugged into the M2 slots and with SSDs and   hard drives plugged into SATA connectors.  Using 
these sections, along with data mapping tables,   the CPU manages the flow of data from 
the SSD to DRAM, as well as from DRAM   to cache memory for processing by the cores.
Let’s move back to see the memory channels.    For DDR5 each memory channel is divided into two 
parts, Channel A and Channel B. These two memory   channels A and B independently transfer 32 bits at 
a time using 32 data wires.   Using 21 additional   wires each memory channel carries an address 
specifying where to read or write data and, using   7 control signal wires, commands are relayed.
The addresses and commands are sent to and shared   by all 4 chips on the memory channel which 
work in parallel.  However, the 32-bit data   lines are divided among the chips and thus each 
chip only reads or writes 8 bits at a time.    Additionally, power for DRAM is 
supplied by the motherboard and   managed by these chips on the stick itself.
Next, let’s open and look inside one of these   DRAM microchips.  Inside the exterior packaging, 
we find an interconnection matrix that connects   the ball grid array at the bottom with the die 
which is the main part of this microchip.  This 2   gigabyte DRAM die is organized into 8 bank groups 
composed of 4 banks each, totaling 32 banks.    Within each bank is a massive array, 65,536 memory 
cells tall by 8192 cells across, essentially rows   and columns in a grid, with tens of thousands of 
wires, and supporting circuitry running outside   each bank.  Instead of looking at this die, we’re 
going to transition to a functional diagram,   and then reorganize the banks and bank groups.
In order to access 17 billion memory cells,   we need a 31-bit address.  3 bits are used to 
select the appropriate bank group, then 2 bits   to select the bank.  Next 16 bits of the address 
are used to determine the exact row out of 65   thousand.  Because this chip reads or writes 8 
bits at a time, the 8192 columns are grouped by   8 memory cells, all read or written at a time, 
or ‘by 8’, and thus only 10 bits are needed for   the column address.  One optimization is that 
this 31-bit address is separated into two parts   and sent using only 21 wires.  First, the bank 
group, bank, and row address are sent, and then   after that the column address.  Next, we’ll look 
inside these physical memory cells, but first,   let’s briefly talk about how these structures are 
manufactured as well as this video’s sponsor.     This incredibly complicated die, 
also called an integrated circuit,   is manufactured on 300-millimeter silicon wafers, 
2500ish dies at a time.  On each die are billions   of nanoscopic memory cells that are fabricated 
using dozens of tools and hundreds of steps in   a semiconductor fabrication plant or fab.  This 
one was made by Micron which manufactures around   a quarter of the world’s DRAM, including both 
Nvidia’s and AMD’s VRAM in their GPUs Micron also   has its own product line of DRAM and SSDs under 
the brand Crucial which, as mentioned earlier,   is the sponsor of this video.  In addition 
to DRAM, Micron is one of the world’s leading   suppliers of solid-state drives such as this 
Crucial P5+ M2 NVME SSD.   By installing your   operating system and video games on a Crucial 
NVMe solid-state drive, you’ll be sure to have   incredibly fast loading times and smooth gameplay, 
and if you do video editing, make sure all those   files are on a fast SSD like this one as well.  
This is because the main speed bottleneck for   loading is predominantly limited by the speed of 
the SSD or hard drive where the files are stored.  For example, this hard drive can only transfer 
data at around 150 megabytes a second whereas   this Crucial NVMe SSD can transfer data at a 
rate of up to 6,600 megabytes a second, which,   for comparison is the speed of a moving tortoise 
versus a galloping horse.  By using a Crucial NVMe   SSD, loading a video game that requires gigabytes 
of DRAM is reduced from a minute or more down to   a couple seconds.  Check out the Crucial NVMe 
SSDs using the link in the description below.  Let’s get back to the details of how DRAM works 
and zoom in to explore a single memory cell   situated in a massive array. This memory cell is 
called a 1T1C cell and is a few dozen nanometers   in size.  It has two parts, a capacitor to store 
one bit of data in the form of electrical charges   or electrons and a transistor to access and read 
or write data.  The capacitor is shaped like a   deep trench dug into silicon and is composed of 
two conductive surfaces separated by a dielectric   insulator or barrier just a few atoms thick, which 
stops the flow of electrons but allows electric   fields to pass through.  If this capacitor 
is charged up with electrons to 1 volt,   it’s a binary 1, and if no charges are present 
and it’s at 0 volts, it’s a binary 0, and thus   this cell only holds one bit of data.  Designs 
of capacitors are constantly evolving but in   this trench capacitor, the depth of the silicon is 
utilized to allow for larger capacitive storage,   while taking up as little area as possible.
Next let’s look at the access transistor and   add in two wires.  The wordline wire connects to 
the gate of the transistor while the bitline wire   connects to the other side of the transistor’s 
channel.  Applying a voltage to the wordline   turns on the transistor, and, while it’s on, 
electrons can flow through the channel thus   connecting the capacitor to the bitline.  This 
allows us to access and charge up the capacitor   to write a 1 or discharge the capacitor to write 
a 0.  Additionally, we can read the stored value   in the capacitor by measuring the amount of 
charge.  However, when the wordline is off,   the transistor is turned off, and the capacitor 
is isolated from the bitline thus saving the   data or charge that was previously written.  Note 
that because this transistor is incredibly small,   only a few dozen nanometers wide, electrons slowly 
leak across the channel, and thus over time the   capacitor needs to be refreshed to recharge 
the leaked electrons. We’ll cover exactly how   refreshing memory cells works a little later.
As mentioned earlier, this 1T1C memory cell is   one of 17 billion inside this single die and is 
organized into massive arrays called banks.  So,   let’s build a small array for illustrative 
purposes.  In our array, each of the wordlines   is connected in rows, and then the bitlines are 
connected in columns.  Wordlines and bitlines   are on different vertical layers so one can 
cross over the other, and they never touch.   Let’s simplify the visual and use symbols for the 
capacitors and the transistors.  Just as before,   the wordlines connect to each transistor’s control 
gate in rows, and then all the bitlines in columns   connect to the channel opposite each capacitor. 
As a result, when a wordline is active,   all the capacitors in only that row are 
connected to their corresponding bitlines,   thereby activating all the memory cells in that 
row.  At any given time only one wordline is   active because, if more than one wordline were 
active, then multiple capacitors in a column   would be connected to the bitline and the data 
storage functionalities of these capacitors would   interfere with one another, making them useless.  
As mentioned earlier, within a single bank there   are 65,536 rows and 8,192 columns and the 31-bit 
address is used to activate a group of just 8   memory cells.  The first 5 bits select the bank, 
and the next 16-bits are sent to a row decoder   to activate a single row.  For example, this 
binary number turns on the wordline row 27,524,   thus turning on all transistors in that row and 
connecting the 8,192 capacitors to their bitlines,   while at the same time the other 65 
thousandish wordlines are all off.    Here’s the logic diagram for a simple decoder.
The remaining 10 bits of the address are sent   to the column multiplexer.  This multiplexer 
takes in the 8192 bitlines on the top, and,   depending on the 10-bit address, connects a 
specific group of 8 bitlines to the 8 input   and output IO wires at the bottom.  For example, 
if the 10-bit address we this, then only the   bitlines 4,784 through 4,791 would be connected 
to the IO wires, and the rest of the 8000ish   bitlines would be connected to nothing.  Here’s 
the logic diagram for a simple multiplexer.    We now have the means of accessing any 
memory cell in this massive array; however,   to understand the three basic operations, 
reading, writing, and refreshing let’s add   two elements to our layout:  A sense amplifier 
at the bottom of each bitline, and a read and   write driver outside of the column multiplexer.
Let’s look at reading from a group of memory   cells.  First the read command and 31-bit address 
are sent from the CPU to the DRAM.  The first 5   bits select a specific bank. The next step is 
to turn off all the wordlines in that bank,   thereby isolating all the capacitors, and then 
precharge all 8000ish bitlines to .5 volts.  Next   the 16-bit row address turns on a row, and all 
the capacitors in that row are connected to their   bitlines.  If an individual capacitor holds a 1 
and is charged to 1 volt, then some charge flows   from the capacitor onto the .5-volt bitline, and 
the voltage on the bitline increases.  The sense   amplifier then detects this slight change 
or perturbation of voltage on the bitline,   amplifies the change, and pushes the voltage on 
the bitline all the way up to 1 volt. However,   if a 0 is stored in the capacitor, charge 
flows from the bitline into the capacitor,   and the .5-volt bitline decreases in voltage.  
The sense amplifier then sees this change,   amplifies it and drives the bitline voltage down 
to 0 volts or ground.  The sense amplifier is   necessary because the capacitor is so small, 
and the bitline is rather long, and thus the   capacitor needs to have an additional component 
to sense and amplify whatever value is stored.    Now, all 8000ish bitlines are driven to 1 
volt or 0 volts corresponding to the stored   charge in the capacitors of the activated 
row, and this row is now considered open.    Next, the column select multiplexer uses 
the 10-bit column address to connect the   corresponding 8 bitlines to the read 
driver which then sends these 8 values   and voltages over the 8 data wires to the CPU. 
Writing data to these memory cells is similar   to reading, however with a few key differences.
First the write command, address, and 8 bits to   be written are sent to the DRAM chip.  Next, just 
like before the bank is selected, the capacitors   are isolated, and the bitlines are precharged 
to .5 volts.  Then, using a 16-bit address,   a single row is activated, the capacitors perturb 
the bitline, and the sense amplifiers sense this   and drive the bitlines to a 1 or 0 thus opening 
the row.  Next the column address goes to the   multiplexer, but, this time, because a write 
command was sent, the multiplexer connects the   specific 8 bitlines to the write driver which 
contains the 8 bits that the CPU had sent along   the data wires and requested to write.  These 
write drivers are much stronger than the sense   amplifier and thus they override whatever voltage 
was previously on the bitline, and drive each of   the 8 bitlines to 1 volt for a 1 to be written, 
or 0 volts for a 0.  This new bitline voltage   overrides the previously stored charges or values 
in each of the 8 capacitors in the open row,   thereby writing 8 bits of data to the memory 
cells corresponding to the 31-bit address.  Three quick notes.  First, as a reminder, writing 
and reading happens concurrently with all the 4   chips in the shared memory channel, using 
the same 31-bit address and command wires,   but with different data wires for each chip.  
Second, with DDR5 for a binary 1 the voltage   is actually 1.1 volts, for DDR4 it’s 1.2 volts, 
and prior generations had even higher voltages,   with the bitline precharge voltages being 
half of these voltages.  However, for DDR5,   when writing or refreshing a higher voltage, 
around 1.4 volts is applied and stored in each   capacitor for a binary 1 because charge leaks 
out over time. However, for simplicity, we’re   going to stick with 1 and 0.  Third, the number 
of bank groups, banks, bitlines and wordlines   varies widely between different generations 
and capacities but is always in powers of 2.  Let’s move on and discuss the third operation 
which is refreshing the memory cells in a bank.    As mentioned earlier, the transistors used to 
isolate the capacitors are incredibly small,   and thus charges leak across the channel.  The 
refresh operation is rather simple and is a   sequence of closing all the rows, precharging 
the bitlines to .5 volts, and opening a row.    To refresh, just as before, the capacitors perturb 
the bitlines and then the sense amplifiers drive   the bitlines and capacitors of the open row fully 
up to 1 volt or down to 0 volts depending on the   stored value of the capacitor, thereby refilling 
the leaked charge.  This process of row closing,   precharging, opening, and sense amplifying happens 
row after row, taking 50 nanoseconds for each row,   until all 65 thousandish rows are refreshed 
taking a total of 3 milliseconds or so to   complete.  The refresh operation occurs 
once every 64 milliseconds for each bank,   because that’s statistically below the 
worst-case time it takes for a memory   cell to leak too much charge to make a stored 1 
turn into a 0, thus resulting in a loss of data.  Let’s take a step back and consider the 
incredible amount of data that is moved   through DRAM memory cells. These banks of memory 
cells handle up to 4 thousand 8 hundred million   requests to read and write data every second 
while refreshing every memory cell in each   bank row by row around 16 times a second. 
That’s a staggering amount of data movement   and illustrates the true strength of computers. 
Yes, they do simple things like comparisons,   arithmetic, and moving data around, but 
at a rate of billions of times a second.   Now, you might wonder why computers 
need to do so much data movement. Well,   take this video game for example. You have obvious 
calculations like the movement of your character   and the horse. But then there are individual 
grasses, trees, rocks, and animals whose   positions and geometries are stored in DRAM. 
And then the environment such as the lighting   and shadows change the colors and textures of the 
environment in order to create a realistic world.  Next, we’re going to explore breakthroughs and 
optimizations that allow DRAM to be incredibly   fast. But, before we get into all those 
details, we would greatly appreciate it   if you could take a second to hit that like 
button, subscribe if you haven’t already,   and type up a quick comment below, as it helps get 
this video out to others.  Also, we have a Patreon   and would appreciate any support.  This is our 
longest and most detailed video by far, and we’re   planning more videos that get into the inner 
details of how computers work.  We can’t do it   without your help, so thank you for watching and 
doing these three quick things. It helps a ton.  The first complex topic which we’ll explore 
is why there are 32 banks, as well as what the   parameters on the packaging of DRAM are.  
After that, we’ll explore burst buffers,   sub-arrays, and folded DRAM architecture 
and what’s inside the sense amplifier.  Let’s take a look at the banks.  As 
mentioned earlier opening a single   row within a bank requires all these 
steps and this process takes time. However, if a row were already open, we 
could read or write to any section of   8 memory cells using only the 10-bit 
column address and the column select   multiplexer.   When the CPU sends a read or 
write command to a row that’s already open,   it’s called a row hit or page hit, and this 
can happen over and over.  With a row hit,   we skip all the steps required to open a row, and 
just use the 10-bit column address to multiplex a   different set of 8 columns or bitlines, connecting 
them to the read or write driver, thereby saving   a considerable amount of time.  A row miss is 
when the next address is for a different row,   which requires the DRAM to close and isolate the 
currently open row, and then open the new row.   On a package of DRAM there are typically 4 numbers 
specifying timing parameters regarding row hits,   precharging, and row misses.  The first number 
refers to the time it takes between sending an   address with a row open, thus a row hit, to 
receiving the data stored in those columns.    The next number is the time it takes to open 
a row if all the lines are isolated and the   bitlines are precharged.  Then the next number 
is the time it takes to precharge the bitlines   before opening a row, and the last number is 
the time it takes between a row activation and   the following precharge.  Note that these 
numbers are measured in clock cycles.    Row hits are also the reason why the address is 
sent in two sections, first the bank selection and   row address called RAS and then the column address 
called CAS. If the first part, the bank selection   and row address, matches a currently open row, 
then it’s a row hit, and all the DRAM needs is the   column address and the new command, and then the 
multiplexer simply moves around the open row.    Because of the time saving in accessing an 
open row, the CPU memory controller, programs,   and compilers are optimized for increasing the 
number of subsequent row hits. The opposite,   called thrashing, is when a program jumps around 
from one row to a different row over and over,   and is obviously incredibly inefficient 
both in terms of energy and time.    Additionally, DDR5 DRAM has 32 banks for 
this reason.  Each bank’s rows, columns,   sense amplifiers and row decoders operate 
independently of one another, and thus multiple   rows from different banks can be open all at the 
same time, increasing the likelihood of a row hit,   and reducing the average time it takes for the CPU 
to access data.  Furthermore, by having multiple   bank groups, the CPU can refresh one bank in each 
bank group at a time while using the other three,   thus reducing the impact of refreshing. 
A question you may have had earlier is why   are banks significantly taller than they are 
wide? Well, by combining all the banks together   one next to the other you can think of this chip 
as actually being 65 thousand rows tall by 262   thousand columns wide. And, by adding 31 equally 
spaced divisions between the columns, thus   creating banks, we allow for much more flexibility 
and efficiency in reading, writing and refreshing.  Also, note that on the DRAM packaging are 
its capacity in Gigabytes, the number of   millions of data transfers per second, which 
is two times the clock frequency, and the peak   data transfer rate in Megabytes per second.
The next design optimization we’ll explore   is the burst buffer and burst length.  Let’s add a 
128-bit read and write temporary storage location,   called a burst buffer to our functional diagram.  
Instead of 8 wires coming out of the multiplexer,   we’re going to have 128 wires that connect 
to these 128-bit buffer locations.  Next   the 10-bit column address is broken into two 
parts, 6 bits are used for the multiplexer,   and 4 bits are for the burst buffer. 
Let’s explore a reading command.  With   our burst buffer in place, 128 memory cells and 
bitlines are connected to the burst buffer using   the 6 column bits, thereby temporarily loading, 
or caching 128 values into the burst buffer.    Using the 4 bits for the buffer, 8 quickly 
accessed data locations in the burst buffer   are connected to the read drivers and the data is 
sent to the CPU.  By cycling through these 4 bits,   all 16 sets of 8 bits are read out, and thus the 
burst length is 16.  After that a new set of 128   bitlines and values are connected and loaded 
into the burst buffer.  There’s also a write   burst buffer which operates in a similar way.
The benefit of this design is that 16 sets of   8 bits per microchip, totaling 1024 bits, can be 
accessed and read or written extremely quickly,   as long as the data is all next to one 
another, but at the same time we still   have the granularity and ability to access any 
set of 8 bits if our data requests jump around.  The next design optimization is that this bank 
of 65536 rows by 8192 columns is rather massive,   and results in extremely long wordlines and 
bitlines, especially when compared to the size of   each trench capacitor memory cell.  Therefore, 
the massive array is broken up into smaller   blocks 1,024 by 1,024, with intermediate 
sense amplifiers below each subarray,   and subdividing wordlines and using a hierarchical 
row decoding scheme.  By subdividing the bitlines,   the distance and amount of wire that each tiny 
capacitor is connected to as it perturbs the   bitline to the sense amplifier is reduced, and 
thus the capacitor doesn’t have to be as big.  By   subdividing the wordlines the capacitive load from 
eight thousandish transistor gates and channels is   decreased, and thus the time it takes to turn on 
all the access transistors in a row is decreased.  The final topic we’re going to talk about is 
the most complicated.  Remember how we had   a sense amplifier connected to the bottom of 
each bitline?  Well, this optimization has two   bitlines per column going to each sense amplifier 
and alternating rows of memory cells connected to   the left and right bitlines, thus doubling the 
number of bitlines.  When one row is active,   half of the bitlines are active while the other 
half are passive and vice versa when the next row   is active.   Moving down to see inside the sense 
amplifier we find a cross-coupled inverter.  How   does this work?  Well, when the active bitline is 
a 1, the passive bitline will be driven by this   cross-coupled inverter to the opposite value 
of 0, and when the active is a 0, the passive   becomes a 1.  Note that the inverted passive 
bitline isn’t connected to any memory cells,   and thus it doesn’t mess up any stored data.  The 
cross-coupled inverter makes it such that these   two bitlines are always going to be opposite 
one another, and they’re called a differential   pair.  There are three benefits to this design.  
First, during the precharge step, we want to bring   all the bitlines to .5 volts and, by having a 
differential pair of active and passive bitlines,   the easiest solution is to disconnect the cross 
coupled inverters and open a channel between the   two using a transistor.  The charge easily 
flows from the 1 bitline to the 0, and they   both average out and settle at .5 volts.  
The other two benefits are noise immunity,   and a reduction in parasitic capacitance of the 
bitline.  These benefits are related to that fact   that by creating two oppositely charged electric 
wires with electric fields going from one to   the other we reduce the amount of electric fields 
emitted in stray directions and relatedly increase   the ability of the sense amplifier to amplify 
one bitline to 1 volt and the other to 0 volts.    One final note is that when discussing DRAM, 
one major topic is the timing of addresses,   command signals and data, and the related 
acronyms DDR or double data rate, and SDRAM,   or Synchronous DRAM.  These topics were omitted 
from this video because it would have taken an   additional 15 minutes to properly explore.  
That’s   pretty much it for the DRAM, and we are grateful 
you made it this far into the video.  We believe   the future will require a strong emphasis on 
engineering education and we’re thankful to all   our Patreon and YouTube Membership Sponsors 
for supporting this dream.  If you want to   support us on YouTube Memberships, or Patreon, 
you can find the links in the description.   A huge thanks goes to the Nathan, Peter, and 
Jacob who are doctoral students at the Florida   Institute for Cybersecurity Research for helping 
to research and review this video’s content!  They   do foundational research on finding the weak 
points in device security and whether hardware   is compromised.  If you want to learn more about 
the FICS graduate program or their work, check out   the website using the link in the description.
  This is Branch Education, and we create 3D   animations that dive deep into the technology that 
drives our modern world.  Watch another Branch   video by clicking one of these cards or click here 
to subscribe.  Thanks for watching to the end!

---

## 14. Why are Smoke Detectors Radioactive?  And How do Smoke Detectors Work?
**Channel:** Branch Education | **Views:** 1.2M | **Date:** 3 years ago | **Duration:** 18:59 | **ID:** X6wJE-4BLM0
**Link:** https://youtube.com/watch?v=X6wJE-4BLM0

### Transcript:
I recently purchased a smoke detector and noticed 
a small radioactive symbol on the box, which got   me wondering: why are smoke detectors radioactive? 
Well, in this video we’re going to explore the   inside of this smoke detector, see how it works, 
and understand how radioactive decay is used to   detect smoke. Also, stick around until the end 
where we’ll discuss 2 related topics or branches:   how Geiger counters work, and why atoms with high 
atomic numbers are counter-intuitively small.   This video is sponsored by PCBWay; more on 
them later, but for now let’s jump right in.  When we open up the smoke detector, we find a 
number of components. Here we have the battery   that, of course, is almost always dead and 
needs replacing… just kidding… but really…   Here we have the piezoelectric speaker which 
produces both the alarm as well as this chirp   which honestly is one of the world’s most 
frustrating noises. Next, we have a through-hole   printed circuit board or PCB which holds just a 
few basic components and is designed in such a way   to be extremely inexpensive. On the PCB, we have 
the main microchip and finally, here we have the   heart of the smoke detector, a metal cylinder 
which has vents on all sides to allow air and   smoke to flow through. On the inside of this dome 
is a short cylinder with a metal disk on the top   and another on the bottom, with plastic separating 
and holding them both. In the center of the bottom   disk is a small well containing 300 nanograms of 
the isotope americium-241 which is radioactive and   thus requires this symbol on the packaging.
Before we go further, it’s important to say   that opening up an ionizing smoke detector like 
this one is dangerous and should never be done,   not even with adult supervision. Americium is, 
as we mentioned, radioactive and while it is   inside the metal cylinder it’s perfectly safe, but 
outside it’s very dangerous, especially if inhaled   or ingested. We take it apart, so you don’t 
have to, and with that stated, let’s move on.  So, how does this radioactive contraption detect 
smoke? Well, the small amount of radioactive   americium-241 emits alpha particles which 
are highly energetic, incredibly fast-moving   helium nuclei, with 2 protons, 2 neutrons, and no 
electrons, and thus are positively charged ions.   How fast? Well, they’re ejected from the americium 
nucleus at around 15,000 kilometers per second,   which is about 5% the speed of light or 
2,000 times faster than the international   space station or 419 thousand times faster than a 
cheetah… This incredible amount of kinetic energy   is what makes the radiation dangerous. By the 
way, the other types of radioactive decay are   beta and gamma decay which are, respectively, 
incredibly fast-moving electrons and high-energy   photons. However, in ionizing smoke detectors 
the americium-241 predominantly generates   alpha particles. As these positively charged 
helium nuclei are ejected at ludicrous speeds,   the alpha particles run into atoms in the 
atmosphere and knock off their electrons,   thus creating positively charged nitrogen, oxygen, 
other gasses, and thousands of free electrons.   Note that any atom or molecule that has lost or 
gained an electron is charged and thus called an   ion. In fact, a single alpha particle has enough 
energy to create around 10,000 positively charged   oxygen and nitrogen ions and tens of thousands 
of electrons. This process is called ionizing   radiation. A professor of mine once referred 
to an alpha particles as a bull in a pottery   shop. Alpha particles run into everything thereby 
creating atomic chaos. Here’s a picture of a cloud   chamber with americium-241, and in it you can see 
the paths created by individual alpha particles.   By the way, whoever marketed these radioactive 
smoke detectors as ‘ionizing smoke detectors’   is a genius, because, let’s be honest, no one 
would ever buy a ‘radioactive smoke detector’.  But we digress. Outside of this device 
these electrons and positively charged   atmospheric ions would eventually recombine and 
become neutral, however in this contraption,   called an ionization chamber, we want to use alpha 
decay to help us detect smoke. And to do that we   use two metal disks and apply the voltage 
from the battery across the top and bottom   disks such that the top is positively charged, 
and the bottom is negative. As you may know,   negative charges and positive charges attract, 
and as a result, the negatively charged electrons   are attracted to the upper positively charged 
metal plate, and conversely the positive oxygen   and nitrogen ions are attracted to the bottom 
disk. A flow of electrons is a current, and,   using the circuitry in this chip, we can measure 
the current drawn to the top plate, which is what   happens under normal conditions when no smoke 
is present. If you want more exact numbers,   the amount of americium in this smoke detector, or 
alpha source, emits around 37,000 alpha particles   every second, resulting in hundreds of millions 
of electrons being pulled off their atoms,   but equating to only 50 or so picoamps of current 
which is rather small. This provides a baseline   for the amount of current flowing as a result of 
the ionizing radiation from the americium-241.  However, when smoke comes in through 
these vents and into the cylinder,   the environment and circumstances change. Smoke 
contains a lot of carbon monoxide, carbon dioxide,   larger soot or more complex carbon structures, 
unburned matter, volatile compounds, and a whole   variety of other components. Thus, when smoke 
from a fire, smoldering combustibles, or burnt   popcorn is present in the ionization chamber, 
it intercepts both the alpha particles as well   as the ionized air molecules and electrons, thus 
preventing the electrons from reaching the top   plate and positive ions from reaching the bottom 
plate. No electrons flowing to the top plate means   no current is present and this lack of current 
is measured by the microchip down here which in   turn triggers the piezoelectric alarm to alert you 
that there’s a fire or that you’re bad at cooking.  Alpha particles are used in this application 
because, of the three types of radiation alpha,   beta and gamma, alpha particles have the largest 
ionizing potential; in other words, they produce   the greatest number of ions, and a steady flow of 
current in the ionization chamber when no smoke is   present. Additionally, although alpha particles 
are ejected with a tremendous amount of energy,   they are in fact stopped by practically 
anything. This is because they’re helium nuclei,   which are much larger than either the beta or 
gamma particles. Just a few centimeters of air,   a thin piece of plastic, or a few layers of skin 
cells are enough to stop alpha particles. However,   gamma particles or photons are more dangerous 
because they’re able to travel much further   and through much thicker objects and only dense 
metals like lead, or layers of concrete can stop   them. And beta particles can travel through skin, 
but just a thin sheet of aluminum can stop them.  So, let’s answer three potential questions you 
may have. Why is americium-241 radioactive?   How is it produced? And finally, are 
there other types of smoke detectors?  Well, americium-241 is down there on the 
periodic table. It has 95 Protons, and 146   neutrons in its nucleus, and 95 electrons in its 
shells. You’re probably familiar with the idea   that like charges repel each other. Well, here we 
have 95 positive charges and a bunch of neutrons   all glued together by the strong nuclear force. 
However, the repulsive forces of these 95 protons   and their ratio to neutrons makes the nucleus 
unstable, and as a result it has a probability   to repel two neutrons and two protons, and thus 
turn into Neptunium 237. In this smoke detector,   we have 300 nanograms of americium, which equates 
to around 750 trillion atoms, and over the course   of 432.2 years, that number will have decayed 
into 375 trillion atoms of americium-241,   and 375 trillion atoms of neptunium-237. By 
the way, neptunium-237 is also radioactive,   and emits alpha particles, but because it has 
a more stable ratio of protons to neutrons it   has a half-life of 2.14 million years.
So then, let’s move onto the second   question- How is americium-241 produced? Well, 
rather interestingly, it’s generated in nuclear   power plants with the neutron activation of 
plutonium-239 and 240 into plutonium-241, and   then plutonium subsequently emits beta particles 
and decays into americium-241. That means that   all ionizing smoke detectors have some material 
that came from a nuclear reactor! By the way,   this americium is in the form of Americium 
oxide and has a thin sheet of gold on top   for safety reasons. Each smoke detector has 
such an incredibly small amount of americium,   that a single gram generated from 
a Nuclear Power plant can produce   tens of thousands of smoke detectors or more.
Finally, is there another way to detect smoke?   And the answer is yes, the other most common 
way to detect smoke is using a photoelectric   sensor or light, but there are a variety of ways 
in addition to these two methods. Photoelectric   smoke detectors have an LED on one side of 
a chamber, and a sensor on the other side,   however in this chamber, the light doesn’t have 
a direct path through and thus can’t reach the   sensor. Additional pieces of plastic are added to 
the chamber to make it such that even reflected   light can’t reach the sensor.
However, when smoke is present,   the particles of smoke deflect the light 
from the LED, dispersing it in the smoke,   and thus the sensor can see a fraction of the 
light which triggers the smoke alarm to go off.  There are a number of pros and cons to 
each design of smoke detector. We’re   not going to cover them here, but if you 
want you can read the Wikipedia articles.  Two quick things: First, smoke detectors 
save lives. Replace the batteries once   a year, check that they work, and 
although one type is radioactive,   it’s perfectly safe to have in your home, but 
as with many things, it’s not safe to eat.  Second, in our explanation, we simplified the 
circuitry of the smoke detector’s ionization   chamber. In reality, the top metal cylinder is 
also an ionization chamber, and the circuitry   senses the voltage of the middle disk and compares 
the ionizing activity in the top chamber to the   reference ionizing activity in the bottom chamber 
in order to know when smoke is present. Here’s a   schematic explaining it, and note, some designs 
have the voltages across the chambers flipped.  Next, we’re going to talk about two topics 
that branch from smoke detectors which are   the counterintuitive size of different atoms 
and how Geiger counters work. So, stick around   because these are genuinely interesting topics.
But for now, let’s discuss this video’s sponsor,   PCBWay. PCBs range from the simple, like this one 
inside a smoke detector with just a couple dozen   holes and traces, to the incredibly complex, such 
as those inside GPUs, with hundreds of components,   multiple layers, thousands of traces running 
inside and ball grid arrays with thousands of   connection points. PCBWay can quickly manufacture 
any PCB from the simple to the complex with   competitive prices and impeccable standards. 
Furthermore, PCBWay also offers services such   as PCB Assembly, CNC machining, and 3D printing, 
as well as manufacturing flexible PCBs such as   those found in wireless earbuds. From PCBWay, you 
can buy standard boards for as little as 5 dollars   and complex PCBs from 78 dollars and up, and then 
a senior engineer will dedicate themself to ensure   perfection in the finished product. Additionally, 
you can have boards assembled for as little as 30   dollars, and you’ll work directly with PCBWay’s 
engineers who can send pictures throughout   the assembly process. Take a look at PCBWay’s 
website using the link in the description below.  Okay, so let’s quickly talk about two branches 
related to smoke detectors, atomic size,   and Geiger counters. As you may know, atoms 
are incredibly small, but do you think that   as the atomic number increases the size of 
the atom also increases? Let’s check. Here’s   sodium with 11 protons and here’s americium 
with 95 protons. When we look at the atomic   radii based on empirical measurements, sodium 
is in fact larger than americium. This is rather   counterintuitive because you would think that as 
we add more protons, neutrons, and electrons, the   size of the atom would correspondingly increase. 
So why is sodium larger than americium? Well,   it has to do with the fact that positive charges 
and negative charges attract with a tremendous   amount of force. For example, if 1 gram of pure 
protons were placed 100 meters away from 1 gram   of pure electrons, the positive charges and 
negative charges would attract one another with   1500 trillion tons of force, which is equivalent 
to the force of 440 billion Saturn V rockets-   rather un-imaginable, huh?
A similar force occurs in an   atom. In Americium there are 95 protons, and 
they hold onto these 95 electrons so tightly   that the radius of an americium atom is only 
a tiny bit smaller than the size of sodium.  Here’s a 3D representation of the periodic 
table and the height of each element shows   how large each atom is. The size jump 
in atomic radius from, for example,   Argon to Potassium is a result of the increase in 
the number and configuration of electron shells,   whereas the increase in radius down each column 
is due to the inner shells of electrons repelling   outer shells. And the decrease in radius from 
left to right is due to the attractive force   between the protons in the nucleus and the 
electrons in the shells. One interesting note   is that americium-241 is slightly smaller 
than sodium but has almost 11 times the   number of protons and neutrons, and due to 
this, americium is 14 times the density of   sodium. This trend in density applies to many 
other elements as well. In fact, here’s osmium,   it has a rather small atomic radius, and is the 
densest of all the naturally occurring elements.  To finish up this episode, let’s briefly branch 
out to Geiger Counters. In short, Geiger Counters   fundamental principles are similar to smoke 
detectors. In this tube, we have an ionization   chamber. Radiation enters through this window made 
of mica, and knocks off electrons from the gas,   typically argon. We apply positive voltage to 
a central rod, and then negative voltage to the   surrounding cylinder, and as a result, the ionized 
argon travels towards the negatively charged wall,   while the electrons travel towards the central 
rod. The voltage used is much stronger, at around   500 to 1000 volts, and this higher voltage creates 
an avalanche of ionization which is required to   detect beta particles as they don’t have nearly 
as much ionizing potential as alpha particles.   Then we measure the current, and when there is 
a spike in current that means some radioactive   particles entered the window and ionized some 
gas in the chamber. There are a lot of other   design elements to Geiger counters, but because 
the fundamental principle is similar to smoke   detectors, we thought it interesting to mention.
That’s pretty much it for smoke detectors,   atomic sizes, and Geiger counters. We believe 
the future will require a strong emphasis on   engineering education and we’re thankful to 
all of our Patreon and YouTube Membership   Sponsors for supporting this dream. If you want 
to support us on YouTube Memberships, or Patreon,   you can find links in the description.
This is Branch Education, and we create   3D animations that dive deep into the technology 
that drives our modern world. Watch another Branch   video by clicking one of these cards or click 
here to subscribe. Thanks for watching to the end!

---

## 15. How does Starlink Satellite Internet Work?📡☄🖥
**Channel:** Branch Education | **Views:** 9.2M | **Date:** 3 years ago | **Duration:** 28:09 | **ID:** qs2QcycggWU
**Link:** https://youtube.com/watch?v=qs2QcycggWU

### Transcript:
Beaming internet from the middle of the 
woods using an extra-large pizza-sized satellite dish placed on top of your house up 
to a satellite orbiting 550 kilometers outside Earth’s atmosphere, well let’s be honest, is 
technologically mind-blowing. What’s even crazier is that the Starlink satellites move incredibly 
fast, around 27,000 kilometers per hour, and data is being sent back and forth between them 
at hundreds of megabits per second, all while the dish and satellite are continuously angling 
or steering the beam of data pointed directly between them. On top of that, the dish switches 
between different satellites every 4 or so minutes because they move out of the dishes’ field of 
view rather quickly. If you have no clue as to how this is possible, stick around because we’re 
going to dive into the multiple key technologies which enable satellite internet to magically work.
First, we’ll explore inside the satellite dish and see how it generates a beam of data that is able 
to reach space. Second, we’ll see how this dish continuously steers the beam so that it points 
directly at a satellite moving across the sky. And third, we’ll dive into what exactly the dish and 
satellite are sending inside the beam that results in your ability to stream five HD movies or shows 
simultaneously. This video is quite long as it’s full of in-depth details. We recommend watching 
it first at one point two five times speed, and then a second time at one and a half speed 
to understand it as a complete technology. So, stick around, and let’s jump right in.
First, let’s start by clarifying the difference between a television satellite dish 
such as this one, and the Starlink ground dish, which Elon Musk dubbed Dishy McFlatface or Dishy 
for short. TV dishes use a parabolic reflector to focus the electromagnetic waves which are 
the TV signals sent from broadcast satellites orbiting the Earth at an altitude of 35 thousand 
kilometers. TV satellite dishes only receive TV signals from space, they can’t send data.
Dishy, however, both sends and receives internet data from a Starlink satellite orbiting 550 
kilometers away. While the Starlink satellite is 60 times closer than TV satellites, it’s still an 
incredible distance to wirelessly send a signal, and thus the beams between Dishy and the Starlink 
satellite need to be focused into tight powerful beams that are continuously angled or steered to 
point at one another. Compare this to TV broadcast signals which come from a satellite the size of 
a van, and whose signals propagate in a wide fan that covers land masses larger than North 
America. Table size Starlink satellites, however, need to be in a low earth orbit 
to provide for 20-millisecond latencies, which is critical for smoothly playing internet 
games or surfing the web, and as a result, their coverage is much smaller. Thus 10,000 or more 
Starlink satellites, all orbiting at incredibly fast speeds in a low earth orbit, are required to 
provide satellite internet to the entire earth. Let’s now open up Dishy McFlatface. At the back, 
we have a pair of motors and an ethernet cable that connects to the router. Note that these 
motors don’t continuously move Dishy to point directly at the Starlink satellite; they’re used 
only for initial setup to get the dish pointed in the proper general direction. Opening up Dishy, 
we find an aluminum structural back-plate and on the other side, we find a massive printed circuit 
board or PCB. One side has 640 small microchips and 20 larger microchips organized in 
a pattern with very intricate traces fanning out from the larger to smaller microchips, 
along with additional chips including the main CPU and GPS module on the edge of the PCB. On the 
other side are 1,400ish copper circles with a grid of squares between the circles. On the next layer, 
there’s a rubber honeycomb pattern with small, notched cop-per circles, and behind that, we find 
another honeycomb pattern and then the front side of Dishy. So, what are we looking at? Well, in 
essence, we have 1280 antennas arranged in a hexagonal honeycomb pattern, with each stack of 
copper circles being a single antenna controlled by the microchips on the PCB. This massive array 
works together in what’s called a phased array in order to send and receive electromagnetic 
waves that are angled to and from a Starlink satellite orbiting 550 kilometers above. Let’s 
zoom in and see how a single antenna operates. Here we have an aperture coupled patch antenna 
composed of 6 layers, most of which are inside the PCB. It looks very different from the 
antenna of an old-school radio, and is honestly, incredibly complicated, so let’s simplify 
it. We’ll remove a few of the layers for now, and step through the basic principles of 
how we generate an electromagnetic wave that propagates out from this antenna.
To start, at the bottom we have a microstrip transmission line feed coming from one of the 
small microchips. This transmission line feed is just a copper PCB trace or wire that abruptly ends 
under the antenna stack. We send a 12 Gigahertz high-frequency voltage or signal to the feed 
wire which is a voltage that goes up and down in a sinusoidal fashion, going from positive 
to negative and back to positive once every 83 pico-seconds, 12 billion times a second, or 12 
Gigahertz. Note that high-frequency electricity works differently from direct current or low 
frequency 50 or 60-hertz household electricity. For example, above the copper feed wire, we 
have a copper circle with notches cut into it called an antenna patch. With DC or 
low-frequency alternating current, there wouldn’t be much happening because the patch 
is isolated, but with a high-frequency signal, the power sent to the feed wire is coupled or sent 
to the patch. How exactly does this happen? Well, as mentioned earlier, a 12 Gigahertz signal is 
applied to the copper feed wire. When the voltage is at the bottom of its sinusoidal, or trough, 
we have a concentration of electrons pushed to the end of the feed wire thus creating a zone of 
negative charge which corresponds to the maximum negative voltage. This concentration of electrons 
on the tip of the wire repels all electrons away, including the electrons on the top of the patch, 
and as a result, these electrons are pushed to the other side of the circular patch. Thus, one 
side of the patch becomes positively charged, while the other becomes negatively 
charged, thereby creating electric fields between the patch and feed wire like so.
However, when we reverse the voltage to the copper feed wire 42 picoseconds later, we have a 
concentration of positive charges, or a lack of electrons at the end of the wire, and thus the 
electrons in the patch flow to the other side, the voltage in the patch is flipped, and the 
direction of the electric fields are also flipped. Because the feed wire voltage oscillates back and 
forth, 42 picoseconds between one peak and trough, the electric fields in the patch will also 
oscillate as the electrons, or current, flows back and forth.
If we pause the oscillation we can see some of these electric field vectors, 
or arrows, from the patch, are vertical, and because they are equal and opposite, they cancel 
out. However, other electric fields are horizontal in the same plane of the patch and are called 
fringing fields. These fringing fields are in the same direction and thus they add to each other, 
resulting in a combined electric field pointing in this direction. At the same time, electrons 
flowing from one side of the disk to the other, which is an electric current, generate a 
magnetic field with a strength and direction, or vector, perpendicular to the fringing 
electric field vector. As a result, we have an electric field pointing one way, and 
a magnetic field pointing perpendicular to that. Let’s move forward in time to where the 
voltage on the feedline becomes positive, and now, we’re at the peak of the sinusoid, 42 
picoseconds later. The charge concentrations, or voltage, as well as the current, is all 
flipped, and thus the electric and magnetic fields point in the opposite directions. Electric 
and magnetic fields propagate in all directions, and by creating these oscillating fields, 
we’ve generated an electromagnetic wave which travels in the direction perpendicular to 
both the electric and magnetic field vectors. Because the two sets of field vectors are not 
all in the same plane, but rather are curved, the propagating electromagnetic wave travels outwards 
in an expanding shell or balloon-like fashion, kind of like a light bulb on the ceiling. Let’s 
simplify the visual so we only see the peak and trough or top and bottom of each wave and note 
that the trough is just a vector pointed in the opposite direction. Additionally, the strengths 
of these field vectors directly relate back to the voltage and signal that we originally sent 
to the copper microstrip feed wire at the bottom of the stack. Which means, if we want to make 
these electric and magnetic fields stronger, we just have to increase the voltage sent to the 
feedline. It’s like a dimmer on a light switch: more power equals a brighter light.
Thus far we’ve been talking about this aperture-coupled patch-antenna as transmitting; 
however, it can also be used for receiving a signal. In this microchip, called a front-end 
module, we switch the antenna from transmit to receive and turn off the 12 Gigahertz signal. 
When an electromagnetic wave from the satellite is directed towards Dishy, the electric fields 
from this incoming signal will influence the electrons in the copper patch, thus generating 
an oscillating flow of electrons. This received high-frequency signal is then coupled to the 
feedline where it’s sent to the front-end module chip which amplifies the signal. Thus, these 
antennas can be used to both transmit and receive electromagnetic waves, but, not at the same time.
Two quick things to note. First, as seen earlier, this antenna has many more layers and is more 
complicated than we’ve discussed. For example, here are two circular patches. The bottom is 
used to transmit at 13 Gigahertz while the top to receive at 11.7 Gigahertz. Additionally, 
there are two H slots and two feed wires to support circular polarization, a reflective plane 
in the back, and also, there are multiple features for isolating the operation of one antenna from 
the adjacent antennas. We’ve included these and many more details in the creator’s comments which 
you can find in the English Canadian subtitles. The second note is that there are electromagnetic 
waves of all different frequencies from thousands of different sources passing through 
every point on Earth, whether it be visible light from the sun, radio waves from radio or 
cell towers, or TV signals from satellites or towers. Therefore in order to block out all 
other frequencies of electromagnetic waves, these antenna patches are designed with 
very exact dimensions so that they receive and transmit only a very narrow range of 
frequencies, and all the other frequencies outside this range are essentially ignored 
by the antenna. Let’s move on and see how a single antenna can be combined with others in 
order to amplify the beam to reach outer space. This single antenna is only a centimeter or 
so in diameter and using only it would be like turning on and off one light bulb and trying 
to see it from the international space station. What we need is a way to make the light a few 
thousand times brighter, and then focus all the electromagnetic waves into a single powerful 
beam. Enter the massive Mr. McFlatface PCB, 55 centimeters wide with a total of 1280 
identical antennas in a hexagonal array. The technique of combining all the antennas’ 
power together is called beamforming. So how does it work? Well, let’s first see what 
happens when we have two simplified antennas spaced a short distance away. As mentioned before, 
one antenna generates an electromagnetic wave that propagates outwards in a balloon shape. At every 
single point in space, there’s only one electric field vector with a strength and direction and 
thus the two antennas’ oscillating electric field vectors combine together at all points in 
space. In some areas, the electric fields from the antennas are pointing in the same direction 
with overlapping peaks, and thus add together via constructive interference, and in other locations, 
they’re oppo-site with one peak and one trough, and thus they cancel each other via destructive 
interference. We can now see that the zone where they add together constructively is far tighter, 
or more focused, than a single antenna alone. When we add even more antennas, the zone of 
constructive interference becomes even more focused in what is called a beam front. 
Thus, by adding 1280 antennas together we can form a beam with so much intensity and 
directionality that it can reach outer space. Now you might be thinking that the strength of 1 
antenna duplicated 1280 times over would result in a combined power of, well, 1280 times a single 
antenna, but you’d be mistaken. The effective power and range of the main beam from all these 
antennas combined is actually closer to 3500 times that of a single antenna. The quick explanation 
is that by having these patterns of constructive and destructive interference, it’s as if we 
took a single antenna, multiplied it by 1280, and then placed a whole bunch of mirrors around 
it and left only a single hole for the main beam to exit through. The long explanation requires 
a ton of math and physics, so let’s move on. Dishy McFlatface and the Starlink Satellites 
undoubtedly have some rather complicated science and engineering inside and to fully comprehend it 
all you have to be a multidisciplinary student. To help you do that, check out Brilliant, which 
is sponsoring this video. Brilliant is an amazing tool for learning. They teach a wide range 
of STEM topics in hands-on, interactive ways, many of which directly relate to Starlink 
and other cutting-edge technologies such as electric cars, quantum computers, 
rocketry, or neural networks. For example, they have an entire course dedicated 
to Waves and Light, and another one on gravitational physics which will greatly help 
in understanding Starlink and SpaceX rockets. Brilliant is nothing like a boring textbook, 
but rather all the courses use interactive modules to make the lessons entertaining 
and to help the concepts stick in your head. To really understand today’s frontier technologies 
and to help you become a revolutionary engineer and entrepreneur like Elon Musk, you have 
to be versed in a wide range of fields in science and engineering. We recommend you sign 
up, try out some of the lessons for free and, if you like them, which we’re sure you will, sign 
up for an annual subscription. To the viewers of this channel, Brilliant is offering 20% off an 
annual subscription to the first 200 people who sign up. Just go to brilliant.org/brancheducation. 
You can find that link in the description below. Now let’s continue exploring how a powerful 
beam can be continuously swept across the sky, and then how we fill it with hundreds 
of megabits of data every second. As a quick refresher from before, here’s 
an array of 1280 antennas and we fed them all with the same 12 Gigahertz signal in order to 
create a laser-like beam propagating perpendicular to Dishy. However, as mentioned earlier, we need 
to be able to angle this beam so that it points directly at the Starlink satellite zooming 
across the sky at 27,000 kilometers per hour. Using the motors isn’t feasible because they would 
break within a month and aren’t accurate enough. So, the solution is to use what’s 
called phased array beam steering. Let’s go back to our two-antenna 
example. Before we were feeding the same signal to the two antennas, and thus 
the antennas were in phase with one another. Understanding phase is critical, so quickly: 
changing the height or amplitude of the signal is done by changing the power sent to the 
antenna, thus making the signal stronger or weaker. The frequency is how many peaks and 
troughs, or wavelengths there are in one second, and changing the phase is shifting the signal left 
or right. Phase shifting is measured in degrees between 0 and 359, because, if we shift the signal 
360 degrees, or one full wavelength, then we’re back at the beginning, exactly as if we were to 
loop around a circle. For example, here’s a signal with a 45-degree phase shift, here’s another 
with a 180-degree shift, and then another with a 315-degree shift. Your eyes can’t see differences 
in phase shifted visible light, however, high-tech circuitry such as what’s inside Dishy is really 
good at detecting and working with phase shifts. So then, how do we use phase shifting to angle the 
beam and have it point directly at the satellite? The solution is to phase shift the signal sent to 
one antenna with respect to the other antenna and, as a result, the timing of the peaks and troughs 
emitted from one antenna is different from the other. These peaks and troughs propagate 
outwards, and the location of the constructive interference is now angled to the left with 
destructive interference everywhere else. If we change the phase of the antennas again, the 
zone of constructive interference is angled to the right. Therefore, by continuously changing 
the phase of the signals sent to the antennas, we can create a sweeping zone of 
the constructive interference. Let's bring in six more antennas and simplify 
the visual so that we only see a section of the peaks from each wave. Far away from the 
antennas, the waves join to form a wave front that is a planar wave. Kind of like ocean 
waves crashing on a shoreline. Just as before, by continuously changing the timing of when 
each wave peak is emitted by each antenna, we can change the angle at which the wave front 
is formed, essentially steering the beam in one direction or another. And, if we bring in 
more antennas in a two-dimensional array, we can now steer the beam in any direction 
within a one-hundred-degree field of view. Let’s move back to view all 1280 antennas in 
Dishy. In order to know the exact angle the beam needs to be pointed or steered, we use the GPS 
coordinates of Dishy from this chip over here, along with the orbital position of the Starlink 
satellite which is known in Dishy’s software. The software computes the exact set of 3D angles and 
the required phase shift for each of the antennas. These phase shift results are then sent 
to the 20 larger chips called beamformers, and each beamformer coordinates between 32 smaller 
chips called front end modules, each of which controls 2 antennas. Every few microseconds, these 
computations are recalculated and disseminated to all the microchips in order to perfectly aim the 
beam at the satellite. As a result, the beam can be steered anywhere in a 100-degree field of view.
There are a few quick notes. First, the main beam, also called the main lobe looks like this. 
However, constructive and destructive interference isn’t perfect, and as a result 
there are additional side lobes of lesser power. Third, Mr. McFlatface holds is a single phased 
array, however, on the Starlink satellite, there are in fact 4 phased array antennas. Two 
are used to communicate with multiple Dishys, and 2 are used to communicate with the ground 
stations to relay the internet traffic. And fourth, phased arrays are used in many 
applications, and interestingly they’re used on commercial airlines to allow for mid-flight 
internet. So this video also tangentially explains how mid-flight internet works.
Before we explore how actual data is sent, we want to mention that this video took a month 
to research, two dozen script revisions, and two months to model and animate. If your mind is blown 
by the complexity of this technology and the depth of this video click the subscribe button, like 
this video, write a comment below, and we’ll be sure to create more videos like this one.
The third topic we’re going to dive into is how information gets sent between Dishy and 
the Starlink satellite. For example, we’ve talked about high-frequency 
sinusoid-shaped electromagnetic waves, but that doesn’t look anything like binary 
and even less like your favorite TV show. So, what’s happening? Well, Dishy and the 
satellite indeed send a signal that looks like this; however, they vary the amplitude and the 
phase of the transmitted signal and then assign or encode 6-bit binary values to each different 
combination or permutation of amplitude and phase. With 6 bits, there are 64 different 
values, and thus we need 64 different permutations of amplitude and phase. However, 
instead of listing all the permutations, it’s more easily visualized by arranging the 64 
different values in a graph called a constellation diagram as shown. Let’s look at the point 011 101 
and draw a line from the origin to this point. The distance from the origin is the amplitude 
of the signal, and the angle from the positive-X axis is the phase. It’s a bit like using polar 
coordinates. Thus, for Dishy to send these 6-bits, it transmits a signal with an amplitude 
of 59% and a phase shift of 121 degrees. Then, if the next value being sent is 101 000, the 
signal switches to an 87% amplitude or brightness, and a 305-degree phase shift. After that it sends 
the next value with a different amplitude and phase shift. Each of these 6-bit groupings are 
called symbols and they last for only 10 or so nanoseconds before the next symbol is sent.
Lots of times you see the signal scrunched up like this however, because the frequency of 
the signal is just once every 83 picoseconds, or 12 Gigahertz, and since a symbol lasts 10 
nanoseconds, it’s more accurate to have around 120 wavelengths per symbol before the next symbol 
is sent. Because we’re dealing on the order of pico and nanoseconds, that means that we 
can fit 90 million 6-bit groups or symbols, resulting in 540 million bits per second. However, 
note that this data transfer is shared between download and upload. Since this particular antenna 
can’t transmit and receive data at the same time, about 74 milliseconds of every second is 
used to send data from Dishy to the Starlink satellite and 926 milliseconds is used to send 
data from the satellite down to Dishy. And, for the sake of reducing latency, these time 
slots get distributed throughout a single second instead of grouping them all together.
This technique of sending 6-bit values using different variations of amplitude and 
phase is called 64QAM or Quadrature Amplitude Modulation and is more complicated than we 
discussed but let’s not get sidetracked. Now that we have a stream of millions of 6-bit 
symbols yielding hundreds of megabits of data per second, in order to turn it into your favorite 
TV show we use the advanced video codec, or h.264 format. You can learn more about that in our 
video that explores image compression shown here. I’m sure you have many questions, and by 
all means put them in the comments below, but before we finish let’s clarify two things.
First, the scale of practically everything in this video is off. Here’s the correct scale of Dishy 
and the Starlink Satellite, however Dishy is 550 kilometers away which we can’t correctly show. In 
stark contrast, the emitted electromagnetic waves are only around 2.5 centimeters apart, and thus 
between Dishy and the satellite there are around 22 million wavelengths which is many more than the 
few waves that you see here. Additionally, in this animation we’re showing the wavelengths slowly 
making their way up and down, when in reality it only takes around 2 milliseconds for an 
electromagnetic wave emitted from Dishy or the Starlink satellite to reach the other.
The second clarification is that we disproportionately show Dishy emitting 
electromagnetic waves and sending them to the satellite. In reality the satellite dish 
is more frequently in receive mode and the steps and physics of receiving an electromagnetic wave 
are similar to emitting one, just in reverse. That’s pretty much it for how Starlink and Dishy 
send data to each other. The original script for this video was over 45 minutes long, so all the 
details that were cut got thrown in the creator’s comments found in the English Canada subtitles.
Thank you to all of our Patreon and YouTube Membership Sponsors for helping to make 
this video. Also, thank you to Colin O’Flynn at NewAE Technology for lending us a 
Starlink Dishy PCB for imaging and research. This is Branch Education, and we 
create 3D animations that dive deep into the technology that drives our 
modern world. Watch another Branch video by clicking one of these cards or click here 
to subscribe. Thanks for watching to the end!

---

## 16. Technology Size Comparison  🤯🤯  3D Animation
**Channel:** Branch Education | **Views:** 1.6M | **Date:** 3 years ago | **Duration:** 3:52 | **ID:** gfOD-Qpl6eg
**Link:** https://youtube.com/watch?v=gfOD-Qpl6eg

### Transcript:
ERROR: 
Could not retrieve a transcript for the video https://www.youtube.com/watch?v=gfOD-Qpl6eg! This is most likely caused by:

Subtitles are disabled for this video

If you are sure that the described ca

---

## 17. How do Scroll Wheels Work? 🖱🛠🔬
**Channel:** Branch Education | **Views:** 660K | **Date:** 4 years ago | **Duration:** 10:47 | **ID:** -HVKm5fIUA8
**Link:** https://youtube.com/watch?v=-HVKm5fIUA8

### Transcript:
A computer mouse without a scroll wheel is 
ridiculous. It’s like having a TV without a remote   control. Yes, you might be able to make it work, 
but is it really worth the effort? Well, in this   episode we’re going to explore the scroll wheel 
in detail. First, we’ll examine two different   technologies used to measure the direction and 
speed of rotation, and after that, we’ll see what   causes some to have a stepped or clicking motion 
versus spinning smoothly. So, let’s jump right in.  This video is sponsored by 
PCBWay, more on them later.  Scroll wheels commonly use either optical rotary 
encoders or magnetic rotary position sensors   in order to measure rotational motion. They’re 
functionally equivalent in that they both measure   rotation, but technically different, as one uses 
light and optics, while the other uses magnets.  Let’s first explore the optical rotary encoder. 
It has three key components. First is an   infrared LED that emits light and a lens that 
focuses it. Next, there’s a pair of optical   sensors that detect the light, and finally, 
mounted on the inside of the scroll wheel,   there’s an encoding disk with 48 equally spaced 
spokes which rotate when you spin the wheel,   kind of like the spokes of a bicycle wheel.
The key to the optical rotary encoder is that,   as the wheel is rotated, the light emitted from 
the IR LED is intermittently blocked by the   encoding disk. The light that makes it through the 
slots between the spokes reaches these two optical   sensors and is converted into an electrical signal 
called a pulse wave or pulse train, and with every   full rotation of the wheel, each sensor sees 
48 pulses of light resulting in 48 electrical   puls-es. Let’s spin this wheel rather quickly. 
Within each hundredth of a second, the sensors   see 12 pulses of light and using the generated 
pulse train, the processor calculates that the   wheel is spinning at 25 rotations a second and 
then sends this information to the computer.   The information is not speed, however, but 
rather, the angular distance measured in degrees   and the direction the scroll wheel has travelled 
every hundredth to a thousandth of a second.   This angular distance and direction can then be 
used by the operating system and its software   to know how far up or down to move in a website 
or application. But how does the scroll wheel   know which direction it’s rotating? Well, the 
two sensors are spaced next to one another, and,   depending on the direction the wheel is rotating, 
one sensor sees the light before the other.   For example, if you scroll the wheel down, 
the pulse train from the two adjacent sensors   will look like this, whereas when you scroll the 
wheel up, it will look like this. By the way,   this is technically called an incremental 
quadrature encoder. It’s called an encoder   because the term encoding means to convert one 
form of data into another form, and in this case,   we’re turning mechanical rotational motion 
first into an electrical pulse train and   then into speed, distance, and direction.
Let’s move on to the other type of scroll wheel,   the magnetic rotary position sensor. 
Instead of using light and a bunch of slits,   this scroll wheel has a magnet mounted to it, and 
next to the wheel is a microchip that contains   two magnetic field sensors, called Hall Effect 
Sensors, which are used to detect the magnetic   field strength and the rotational position of the 
magnet. How do these sensors work? Well in each   sensor we have a very small plate of metal or 
semiconductor with electrons flowing across it.   A basic law of physics called the Lorentz force 
is that all moving charged particles such as   electrons are affected by magnetic fields. When 
moving electrons are introduced to a magnetic   field with this orientation, they’re deflected 
to-ward the bottom of the plate or, if we flip the   direction of the magnetic field by rotating the 
magnet, they’re deflected to the top of the plate.   With the electrons concentrated at one side of the 
plate because of the magnetic field, we just need   to add a few wires and additional circuitry 
in order to measure the voltage difference   between the top and bottom of the metal plate. 
As the magnet rotates, the electrons are pushed   to one side of the plate and then the other, and 
the voltage flips from positive to negative and   back again in a sinusoidal shape. This swing in 
voltage is then used to determine rotational speed   and angular distance travelled. However, a single 
Hall Effect Sensor can’t tell us the direction of   rotation, and therefore in this micro-chip we have 
two Hall Effect sensors, positioned perpendicular   to one another and labelled X and Y. With two 
sensors we’re able to determine the absolute   angular position of the scroll wheel because for 
every different angle, from 0 to 359 degrees,   there’s a unique combination of voltages on the 
X and Y magnetic sensors. The microchip over here   records the exact angular position every 
thousandth of a second and compares it with   the previous position. Then, using the difference 
in angles and the time between measurements,   the mouse determines the speed, angular distance 
travelled, and direction of movement, and sends   it to the computer. There are a few things to 
note. First, the incremental optical encoder   from earlier can’t read out an absolute angular 
position because the wheel has 48 equally spaced   spokes, and it can’t discern one angle from the 
next. However, it is possible to have an absolute   optical encoder which has a disk that looks 
like this, where different angles have different   sections open to let the light through. It’s also 
interesting to note that the physics of magnetic   fields deflecting moving electrons, called the 
Lorentz Force, is the driving principle behind   all electric motors, just with coils of wires 
and different configurations of magnetic fields. Let’s move on and look at two additional features. 
Here we have the scroll wheel assembly below which   you’ll most likely find a push button. When you 
push down on the scroll wheel it triggers the   button, and when you release it, the plastic, or 
sometimes a spring, pushes the assembly back up.   Most scroll wheels have some type of mechanism 
to create the clicking-like motion and sound   as the scroll wheel rotates. A common way 
this is done is to have a ring of ridges,   a spring, and a small plastic follower that rides 
along the ridges. When this button is pressed,   the motor turns and rotates to engage the follower 
so that it presses against the ridges. As you   rotate the wheel, the plastic moves up and 
down the ridges thereby creating a stepped   or chattering motion, and the spring applies a 
very light force so that the plastic follower   stays in contact with the ridges. If you spin 
the wheel quickly, the plastic will continue to   move up and down, and slow the wheel faster than 
if the follower were not pressing up against the   plastic and the scroll wheel was spinning freely.
One thing to note is that in this video we covered   just two methods to measure rotational motion: an 
optical encoder and a magnetic position encoder.   There are thousands of designs of computer mice, 
and dozens of different ways to measure rotation.   Other methods include a potentiometer which uses 
a resistive track and a wiper that results in a   change in electrical resistance. Older or cheaper 
mice use two push buttons and an attachment on the   wheel that actuates these buttons. Additionally, 
there are different methods for registering a   scroll wheel push and for creating different 
aesthetics when you rotate the mouse. For example,   this scroll wheel uses an electro-permanent 
magnet and teeth that conduct magnetic fields   resulting in the wheel stepping from tooth to 
tooth. There are many other designs that we   didn’t cover in this video, but if you have a 
broken mouse, we encourage you to take a look.  Printed circuit boards or PCBs are everywhere 
and inside this mouse, you can find four of them.   They may look complicated but they’re pretty fun 
to design and purchasing them is made incredibly   easy by our sponsor PCBWay. PCBWay can quickly 
manufacture your PCBs with competitive prices   and impeccable standards. They also provide PCB 
assembly services where they populate and solder   the components to the PCB. The next time you 
want to get rid of that breadboard and take your   project to the next level, consider using PCBWay 
to manufacture all your Printed Circuit Boards.   Thank you to PCBWay for sponsoring our channel and 
supporting engineering education. Check out PCBWay   using the link in the description below.
That’s pretty much it for scroll wheels.   This is the second video on the computer mouse. 
In the first, we explored the optical sensor   and how computer mice take images of the surface 
and calculate X and Y movement. We recommend you   take a look! We believe the future will require 
a strong emphasis on engineering education   and we’re thankful to all of our 
Patreon and YouTube Membership   Sponsors for supporting this dream. If you want 
to support us on YouTube Memberships, or Patreon,   you can find the links in the description. Also, 
thank you to Logitech for providing information,   reviewing the script, and providing a mouse to 
tear apart. Remember to subscribe, comment below,   and share this video with others. This is Branch 
Education, thanks for watching to the end!

---

## 18. How are Images Compressed?  [46MB ↘↘ 4.07MB] JPEG In Depth
**Channel:** Branch Education | **Views:** 4.1M | **Date:** 4 years ago | **Duration:** 18:47 | **ID:** Kv1Hiv3ox8I
**Link:** https://youtube.com/watch?v=Kv1Hiv3ox8I

### Transcript:
here we have an uncompressed image and it uses 46 megabytes of space and over here we have the same image as a compressed jpeg and it uses 4.1 megabytes can you see the difference what about when we zoom in so that we can see the individual pixels well in this video we're going to take a deep dive into the jpeg algorithm and see how images can be compressed to just a tenth of their uncompressed file size all while keeping the same image resolution and a very high quality appearance to begin let's take a quick 26 seconds to understand the importance of this algorithm why we're making this video and truthfully why you should stick around first most digital images from your phone or a camera are saved using the jpeg format second i spent a couple hours on the internet recording which images were jpeg versus other formats and found that 86 of the images were jpegs so essentially this algorithm is everywhere third video compression algorithms such as h.264 well that's 26 seconds so let's get back to seeing what jpeg does in short jpeg goes through and analyzes each section of an image and finds and removes elements that your eyes can't easily perceive when you compress an image via jpeg you can use a sliding scale called quality to decide how much you want to compress the image as the quality of an image decreases from one hundred percent to zero percent the amount of file compression increases thereby decreasing the amount of space the image file takes up here we have 12 images along with the quality and file size of each image as we continue to compress the image we can see that the picture's resolution or number of pixels stays the same but eventually we get these defect squares which are technically called artifacts let's take the 90 image and the 10 image and zoom in here we can see the inner workings of the jpeg compression hard at work but wait how exactly does jpeg work well that's the focus of this video so let's dive right in the jpeg compression algorithm is composed of five key steps each with a rather complicated name but before we dive into the details it's first important to understand the reason why jpeg works human eyes are not perfect they have their nuances and jpeg exploits these nuances to remove information that our eyes are not great at perceiving for example in the human eye there are two different types of light receptive cells rods and cones rods are not color sensitive and are critical for seeing in low light conditions whereas cones with their color receptors of red green and blue are color sensitive furthermore in each eye there are 100 million rod cells whereas there are only six million cone cells and as a result your eyes are far more receptive to the brightness and darkness of an image which is called luminance and far less receptive to the colors contained in that image which is called chrominance take this image of some tulips for example the black and white version that shows only the luminance appears to be just as detailed as the full colored image however when we look at just the color alone or the prominence that same image appears significantly less detailed so let's see how the jpeg algorithm exploits the nuance of the human eye the first step is color space conversion see the original image is composed of pixels and every pixel has a red green and blue component each with a value from 0 to 255 and the combination of these three values of r g and b results in a color for a single pixel the process of color space conversion takes these three r g and b values for every single pixel and calculates three new values luminance blue chrominance and red chrominance abbreviated y cb and cr this process is reversible and no data is removed during the conversion however the next step called prominence down sampling removes a considerable amount of data remember how we said that our eyes are bad at detecting color or prominence versus brightness or luminance well in down sampling we take both the blue and red chrominance component images and divide the component images into two by two blocks of pixels then we calculate the average value for each block remove the repetitive information and shrink the image so each average value of a 4 pixel block takes up a single pixel as a result the information that our eyes are poor at perceiving the red and blue prominence component images are shrunk to one quarter of the original size but the luminance remains the same now with just two steps the image is half the original size note that when reassembling the picture the blue and red prominence images are rescaled to match the size of the luminance component with the rgb values being recalculated from luminance blue chrominance and red chrominants and because the luminance changes from pixel to pixel the recalculated rgb values can change from pixel to pixel as well the next two steps are definitely a little more complicated and they're called discrete cosine transform or dct and quantization together these two steps also remove information but they do it by exploiting the fact that our eyes aren't good at perceiving high frequency elements within images what does that mean well let's take a look at this picture of the woods our eyes are great at seeing the edge of a tree or the outline of a rock but when it comes to focusing on and distinguishing high frequency color data such as single blades of grass individual leaves in a cluster of leaves or variations in the shadows created by the leaves of a tree our eyes can't really pick out the details furthermore most nature or landscape photography has portions of the image that are out of focus and removing high frequency color variation to create smoother textures is unnoticeable so then how does the jpeg algorithm exploit the nuance of the human eye well essentially the discrete cosine transform and quantization steps go through each section of the image and find areas that have a high frequency of alternating prominence or luminance these elements that our eyes aren't able to perceive are then removed this process is rather complicated but bear with us let's use the luminance component image as our example but know that the same process happens with the two prominence components the first step is to divide the entire image into 8 by 8 sections called blocks each with 64 pixels with values from 0 to 255 that represent the luminance at every pixel next we shift each value by subtracting 128 from each value so the range becomes negative 128 to 127 where negative 128 is black and 127 is white the next step is complicated so let's start with an analogy pretend you have a painting that you want to recreate and you only have a dozen different colors in order to recreate this painting you'll need perhaps 15 parts of the first paint and then three parts of the second paint followed by eight parts of the third paint all the way up until you use perhaps 11 parts of the last paint and in the end we have recreated our original painting the discrete cosine transform works kind of like this however instead of paint we use these 64 base images and just like in our analogy we can rebuild any block of 64 pixels using a combination of these 64 base images with each image multiplied by a value or a constant saying how much of that base image is used thus the 64 pixel block each containing a value is transformed into 64 values or constants that represent how much of each base image is used let's take this letter a for example we can rebuild this letter a using this set of 64 base images with a constant multiplied by each base image we add up all the base images times their respective constant and as a result we get this letter a nothing in dct actually compresses or shrinks the image but the next step quantization does so how does quantization work well here we have our table of constants corresponding to the utilization of each base image the next step is to divide each value in the table of constants by the corresponding value in the quantization table and round each result to the closest integer this quantization table has higher numbers in the bottom right where the high frequency data that your eyes aren't great at perceiving is located and smaller numbers in the top left where more distinct patterns are located after we divide each constant by the corresponding value in the quantization table and round to the nearest integer our blocks data looks like this it has just a few numbers and a lot of zeros in this step we're throwing away data but really we're just throwing away data that our eyes don't perceive so we can't even tell the difference we also use a second quantization table with the prominence values that are larger and thus we generate even more zeros in the resulting table in essence throughout the discrete cosine transform and quantization steps the entire image uses a set of 64 base images which are always the same and two quantization tables one for luminance and the other for chrominance in order to transform every eight by eight block of pixels into just a few numbers and a whole bunch of zeros the last step is called run length and huffman encoding and in it we list all the values for every block in both the luminance and prominence images however when we list the numbers we use a zigzag pattern like this because it's more likely that the non-zero numbers will be found up here next we use a run length encoding algorithm where we list the numbers and then instead of listing all the zeros we just say how many zeros there are perhaps you can see that this list of just a couple dozen numbers is far more compressed than 64 pixels being represented each by a number from zero to 255 after that we use a huffman encoding scheme which is a whole separate encoding algorithm that's covered pretty well in this video by tom scott that you should take a look at after we discuss the h.264 video compression algorithm and how the image is rebuilt as well as a few caveats the h.264 video compression algorithm also called advanced video coding or abc is currently the recommended video compression algorithm for uploading videos to youtube and it uses techniques such as chrominance down sampling or chroma subsampling as well as variations of discrete cosine transform and quantization however h.264 is more complicated because instead of compressing a single static image as in jpeg video compression must compress 24 to 60 or more frames for every second of video the very short explanation is that it uses intra frames or iframes which are similar to jpeg images for one out of every 30 frames and then for the other 29 frames it uses prediction or bi-directional prediction to only code for the difference and motion while using previously decoded frames as reference note that the frequency of iframes varies widely and there is typically an iframe at the start of every scene change as prediction doesn't work well across scene changes these topics are incredibly complex so they'll have to be covered in a separate video but let's now get back to jpeg in order to rebuild the original image we follow the reverse set of steps first we disassemble the run length encoding and perform huffman decoding schemes and lay the values into our 8x8 blocks next we multiply each value by the quantization table and then multiply the resulting constants by the corresponding base images and add all the constituent base images together then we upscale the red prominence in blue prominence images and reconvert the luminance and chrominance values into the red green and blue color space with this we can see how four blocks of luminance and two sets of prominence blocks yield a 16 by 16 grid of pixels finally when we zoom out we have something that looks nearly identical to our original uncompressed image it's truly amazing how your smartphone can take images composed of millions of pixels and then perform calculations on every eight by eight block of pixels compressing all that data into just a couple dozen numbers and then turning around and uncompressing the image faster than it takes you to swipe your finger across the screen for example this picture is 4032 by 3024 pixels which yields a total of 190 512 blocks and in order to compress or uncompress this image every single block must go through each step of the algorithm indeed our smartphones are truly impressive but wait wait we're not yet done with this video there are some additional notes and major shortcomings to the jpeg algorithm that we should discuss first sometimes you can select how much you want to compress an image and this scaling level of compression changes the values in the quantization table because the algorithm divides using these quantization tables and then rounds to the nearest result if we increase the values in the table we will inevitably get more zeros in the resulting discrete cosine transformed and quantized block and as a result the file will be smaller however with too much compression you get artifacts or issues with the compressed image that look like blurry splotches on the edges of square blocks you can see how many blocks have similar traits to the top left blocks in the discrete cosine transformation table the next note is that earlier we mentioned that quantization removes high frequency data which is partially correct in reality quantization reduces the precision of an image block and reduces the precision more for the high frequency data compared to the low frequency data thus making the image block less accurate the third note is that jpeg is great at compressing pictures taken from a camera because natural world pictures tend to have a lot of smooth textures and because no camera is perfectly in focus it's hard to tell the difference between the uncompressed and compressed image however it doesn't perform well at compressing vector graphics like this and in fact you get rather noticeable artifacts close to the boundary lines in vector graphics this is because the jpeg algorithm needs to reconstruct these straight lines using the base images which don't work perfectly when the data is compressed therefore it's recommended not to compress vector graphics using the jpeg algorithm finally jpeg is by far the most common image format because it's old well understood and royalty free but there are a number of other image formats some with comparably better compression capabilities rather fittingly this video is sponsored by brilliant a website and app that teaches you all kinds of stem topics in hands-on interactive ways from the basics such as foundational math or computer science fundamentals all the way to complex topics such as astrophysics and quantum computing in this video we just scratched the surface of algorithms by showing you the inside of one algorithm but if you want to learn more about the algorithms that run our technology-filled world we recommend you look at brilliant's course on algorithm fundamentals brilliant uses interactive courses to bring explanations and thus your understanding to the next level textbooks boring lectures and powerpoint presentations are out and fun animations and interactives are in for the viewers of this channel brilliant is offering 20 percent off an annual subscription to the first 200 people to sign up just go to brilliant.org slash branch education and you can find that link in the description below thank you again to brilliant for sponsoring this video that's pretty much it for the jpeg compression we believe the future will require a strong emphasis on engineering education and we're thankful to all of our patreon and youtube membership sponsors for supporting this stream if you want to support us on youtube memberships or patreon you can find the links in the description also remember to subscribe comment below and share this video with others this is branch education thanks for watching to the end [Music]

---

## 19. How does a Mouse know when you move it?  ||  How Does a Computer Mouse Work?
**Channel:** Branch Education | **Views:** 5.3M | **Date:** 4 years ago | **Duration:** 12:04 | **ID:** SAaESb4wTCM
**Link:** https://youtube.com/watch?v=SAaESb4wTCM

### Transcript:
You’ve probably used a computer mouse for
thousands of hours, and yet, have you ever stopped to wonder how it works? Well, essentially the modern computer mouse
is a merger of 7 different technologies and some rather ingenious engineering. It would take over an hour to cover all these
technologies in-depth, so in this video, we’re going to focus on just one, the image sensor,
and find out what exactly happens when you move your mouse around on a mouse pad. After that, we’ll take a look at a gaming
mouse and see how some mice have 25,000 DPI or dots per inch, while others have only a
few thousand. Stick around and let’s jump right in. At the bottom of this mouse, we have the image
acquisition system or IAS, which is composed of an Infrared LED, a pair of lenses, and
the image pixel array. Infrared light, generated by the LED, passes
through a lens and illuminates the surface directly underneath the computer mouse. Next, the infrared light bounces off the surface,
passes through a second lens, then through a tiny aperture, and finally hits this rather
sophisticated image pixel array, or image sensor, which is composed of sixteen hundred
pixels, laid out 40 X 40. This is important: your mouse doesn’t capture
the colour or design of the mouse pad or surface. Rather, because the light is emitted at a
shallow angle, it illuminates the texture, or the ridges and valleys of the surface,
kind of like a sunset falling across rolling hills. The tops of the hills catch and reflect the
light and are illuminated, but the light doesn’t reach into the valleys, and thus they remain
dark. Your eyes might see just a uniform black mouse
pad or wooden desk, but because of the shallow angle of the infrared light and the focus
of the lenses, the image sensor is able to capture a topographically and texturally complex
landscape. Note that if the surface were perfectly smooth
with no imperfections, the mouse would struggle to work on it which is the reason why some
computer mice don’t work well on glass [Video Note: Some mice are better at detecting the
imperfections of a glass surface]. Furthermore, this image sensor with its 1600
pixels focuses only on a tiny area just 1/200th the size of a penny, immediately below the
mouse. However, the key is that the image sensor
takes up to 17,000 pictures of the surface every single second, and thus, even if you
move your mouse across the mousepad for just a tenth of a second, the image sensor would
take around 1700 pictures during that quick move. And here’s the kicker to this technology:
your mouse doesn’t save any of these images, but rather, every time it takes a picture,
it compares it to the previous one taken 59 microseconds earlier. The microchip then uses the difference between
the two images in order to determine the change in X and change in Y, or in essence how far
and in what direction you moved your mouse in that one seventeen-thousandths of a second
or 59 microseconds. Let’s dive a little deeper into this idea. If we have two images of the topographical
texture of the surface taken 59 microseconds apart, how exactly does the microchip determine
the change in X and the change in Y between them? Well, to calculate this, the two images are
sent to a section of the microchip called the digital signal processor, or DSP for short,
where an algorithm called cross-correlation is executed. As mentioned before, each image is composed
of 40 by 40 pixels, and every pixel generates a value between 0 and 4095 that relates to
the intensity of light that hits that particular pixel. Here we represent the values by the height
of each pixel. The digital signal processor or DSP takes
the first image and overlays the second image on top of it. Next, the DSP subtracts all the values of
the second image’s individual pixels from the first, and we get a new resulting image. The processor then shifts the second image
around while leaving the first stationery and continues to calculate the difference
between the two images until a position is found where the resulting image is at a minimum. The amount of shift in position to reach a
minimum resultant image tells us exactly how far the mouse moved between two successive
images taken one seventeen thousandths of a second apart, yielding a value for the change
in X and the change in Y, measured in pixel counts. 59 microseconds later another image is captured,
and the processor performs the same cross-correlation algorithm but with the new image shifting
around, and the previous image stationary, resulting in another set of values. The processor continues to capture new images
and executes the cross-correlation algorithm 17 times. It then adds up all the values, and we get
how far the mouse moved in one millisecond. This combined change in X and change in Y
for the one millisecond is then sent to the System on a chip over here which in turn relays
the information to your computer using either a USB transceiver or Bluetooth [Video Note:
Point to Bluetooth card]. And that’s how your mouse calculates movement
every single millisecond. Let’s now take a look at the difference
between gaming mice and non-gaming mice. Aside from the sharper-looking shape of the
mouse, a different number and layout of buttons, and the LED lights, the first main difference
is the specified DPI or dots per inch. Gaming mice have DPI specs of 12,000 to 25,000
while non-gaming mice are closer to 850 to 4,000 DPI. But that begs the question, what exactly is
DPI? Well, when you move your mouse to the right
by 1 inch, however many units your cursor moves across the screen results in the value
of dots per inch. A DPI of say 2,000 means your cursor will
move 2,000 units for every 1 inch of movement of the mouse. However, how does this relate to the image
sensor and the cross-correlation algorithm that we talked about earlier? Well, let’s say each pixel in this 40 by
40-pixel image sensor has a length and height of 30 micrometres totalling a square 1.2mm
by 1.2mm. If we were to extrapolate this sensor’s
pix-els out to an inch in length, then we would need around 850 pixels, which in effect
would yield a DPI of 850. In order to reach a higher DPI, we need to
subdivide each whole or integer pixel using multiple cuts. Let’s take each pixel and subdivide it by
4 along the X direction and 4 along the Y. Each pixel turns into 25 subpixels and now,
our 850 DPI sensor has a DPI of 4,250. However, if we were to make 29 cuts along
each length of every single pixel, we get a DPI closer to 25,500. Note that DPI is a linear unit, whereas pixels
per square inch is a square unit. So now that we have the general idea, how
specifically does it happen? Well, a common technique for subdividing whole
pixels into subpixels is called interpolation, and the simple version goes like this. Here we have 4 whole or integer pixels, each
with a value for the intensity of light hitting that pixel and just as before, the height
of each pixel represents the value as well as an approximation for the textural topography
of the surface. Next, we draw a line between the tops of the
two sets of pixels in the X direction, and then draw lines between the two lines in the
Y direction. Then, depending on how many subpixels we want,
we subdivide the lines accordingly. At each intersection, we have a corresponding
value for a new interpolated subpixel. So, when you change the DPI settings of your
mouse, what you are actually changing is the number of subdivisions in this interpolation
algorithm. Here we’re showing a bilinear interpolation. It’s called bilinear because we draw straight
lines between the whole integer pixels. However, a bicubic interpolation, which uses
a little more math, can be used to create a smoother topography. One additional difference between gaming mice
and non-gaming mice is that gaming mice typically report their movements to the computer 1000
times a second, or once every millisecond, whereas non-gaming mice send data 120 times
a second. Furthermore, the number of pictures taken
every second called the frame rate, of 17,000 is only this high when you are quickly moving
your mouse, and it scales down when your mouse is stationary in order to conserve battery
life. One important thing to note is that there
are a wide variety of mice out there, and in this video, we listed specs of a frame
rate of 17,000, and a resolution of 25,000 DPI, which are the specs for a rather high-end
gaming mouse. Specs typically range from 4000 frames per
second to 17,000, 1,000 DPI to 25,000, 18 by 18 pixels to 40 by 40, and a reporting
rate from 100 to 1000. Furthermore, we showed a mouse that uses an
infrared LED for illumination, whereas some mice use a laser, older mice use a red LED,
and prehistoric mice use a ball. Note that at the beginning of this video we
said there were 7 different technologies inside this com-puter mouse, and thus far we’ve
only covered one. The next video we’re considering making
is on the scroll wheel and how fast we can get this wheel spinning. If we can get this current video to over 30,000
likes, we’ll be sure to make that video. Inside this mouse is a rather complicated
printed circuit board or PCB, and without it, there would be a rather messy jumble of
wires that most likely wouldn’t even work properly. If you want to make your own devices, you’re
going to have to create your own PCB which is rather fitting because this video was made
possible by our sponsor PCBWay. PCBWay can quickly manufacture your PCBs with
competitive prices and impeccable standards. They also provide PCB assembly services where
they populate and solder the components to the PCB. Check them out using the link in the description
below. We believe the future will require a strong
emphasis on engineering education and we’re thankful to all of our Patreon and YouTube
Membership Sponsors for supporting this dream. If you want to support us on YouTube Memberships,
or Patreon, you can find the links in the description. Also, thank you to Logitech for providing
information, reviewing the script, and providing a mouse to tear apart. Also remember to subscribe, comment below,
and share this video with others. This is Branch Education, thanks for watching
to the end!

---

## 20. 3-Way Light Switches Explained!! Engineering Inside Light Switches and How They Work
**Channel:** Branch Education | **Views:** 121K | **Date:** 4 years ago | **Duration:** 7:28 | **ID:** bHXJnY7h6gw
**Link:** https://youtube.com/watch?v=bHXJnY7h6gw

### Transcript:
You’ve probably seen thousands of light 
switches throughout your life, and yet,   have you ever seen the inside of a light switch? 
Also, have you ever wondered how two, three,   or more light switches can be wired together 
and used to control the same set of lights,   such as in the case of light switches 
positioned at the top and bottom of a stairway?   Well in this video we’re going to explore the 
engineering inside the humble light switch,   as well as how multi-way light switches work. 
So, stick around, and let’s jump right in.  Here’s a basic light switch. When you flip the 
switch from OFF to ON, this circuit becomes   closed, a path for electricity to flow is created, 
and the light turns on. When you flip the switch   OFF, the path breaks open, and the light turns 
off. The part that you flip up and down is called   the toggle switch or handle, and when you flip 
it to ON, a plastic leg at the bottom of the   toggle switch releases the metal contact bar 
or track. This metal contact bar springs upward   thereby allowing the two contact points to touch 
and electricity to flow from one screw terminal to   the other, thus closing the circuit and powering 
the light. However, when the toggle is flipped   OFF, the plastic leg at the bottom of the toggle 
switch presses against the metal contact bar   and separates the electrical contacts, 
thus disrupting the flow of electricity,   opening the circuit, and turning OFF the light.
There are a few other key components that enable   this light switch to function properly. First, 
there’s a spring in the center which presses on   the bottom of the plastic toggle switch. This 
spring is positioned so that it’s compressed   when the toggle is in the middle of the ON and 
OFF positions. The spring applies a force to the   bottom of the toggle switch which ensures 
that when the switch is not being flipped,   it’s either fully in the ON position or fully in 
the OFF position and not somewhere in the middle.  The second key component is a pair of bumpers 
which limit the motion of the toggle switch   and provide a solid surface for the 
toggle switch to bump into. Finally,   we have the screw terminals for attaching 
wires, the metal bracket for attaching the   light switch to the electrical outlet box as 
well as a screw terminal for a ground wire,   the plastic housing that keeps everything 
contained, and on top of everything is the   face-plate that can be either simple or ornate.
With the functionality and components of a basic   switch wrapped up, let’s now take a look at 
multi-way switches, specifically three-way   switches which are used when we want to have two 
light switches control a single set of lights.   For example, in my house, we have one three-way 
light switch at the top of the stairs and another   one at the bottom, and they both are used to 
control the same stairway light. In contrast to   the basic light switch, three-way switches have 
a common terminal and two traveler terminals.   Now when the toggle switch is flipped, the 
common terminal moves from being in contact with   one traveler to being in contact with the other 
traveler. These travelers are a pair of wires that   travel through the walls in order to connect one 
light switch to the other. When we flip the toggle   of one of the three-way switches, a path for 
the electricity to flow to the stairway light is   created, and the light turns ON. However, when we 
flip the other three-way switch’s toggle, the path   is broken, and the light turns OFF. In general, if 
both toggles are flipped down or both toggles up,   the lights turn off. To turn the lights on, 
one toggle needs to be up and the other down.  Let’s take a look inside one of these three-way 
light switches and see what’s happening inside.   Here we have a metal bar or track connected to the 
common terminal along with the two traveler metal   bars, each connected to their own separate 
traveler terminals. When we flip the toggle   switch, one traveler is pushed away from the 
common by the bottom of the toggle switch while   the other traveler is in contact with the common.
Now let’s say we want three or more light switches   to control a single set of lights. To do that 
we have to use one or more 4-way switches with   a 3-way switch at each end. Here’s the schematic. 
Instead of a com-mon and two travelers as we saw   in the 3-way switch, 4-way switches use two sets 
of two travelers. When the toggle is flipped, the   two pairs of travelers on the left change to being 
connected to the opposite traveler on the right.   Here’s a brief animation showing how the 
path of electricity is closed or opened   and the light turns on or off depending 
on the position of each switch.  When we open up the 4-way switch, we 
find an even more complicated layout,   and yet a familiar set of components. The bottom 
plastic leg of the toggle switch presses down on   the one contact bar when toggled up and presses 
down on the other contact bar when toggled down.   As you can see, the path of the electricity is 
flipped from each pair of traveler terminals   to the other pair when toggling the switch 
from the up position to the down position.  Light switches are practically everywhere, and as 
a result there are dozens of different designs,   internal mechanisms, and methods for wiring the 
light switches together, but unfortunately, we   can’t cover them all. Note that this video isn’t a 
guide to the installation of light switches which   is why we avoided using the terminology of hot, 
neutral, and ground. Please do NOT install light   switches unless you’re a professional or you’re 
fully knowledgeable about what you’re doing.  Light switches are pretty humble, but if you want 
to build complicated circuits, you’re going to   have to use Printed Circuit Boards or PCBs, which 
is rather fitting because this video was made   possible by our sponsor PCBWay. PCBWay can quickly 
manufacture your PCBs with competitive prices   and impeccable standards. They also provide 
PCB assembly services where they populate and   solder the components to the PCB. Check them 
out using the link in the description below.  The amount of engineering that 
goes into a simple light switch   is amazing. We believe the future will require 
a strong emphasis on engineering education   and we’re thankful to all of our Patreon and 
YouTube Membership Sponsors for supporting   this dream. If you want to support us on YouTube 
Memberships, or Patreon, you can find the links in   the description. You can also provide support by 
subscribing, liking this video, commenting below,   and sharing this video with others. Thank you for 
watching until the end. This is Branch Education.

---

## 21. How do Soap Bottle Pumps Work?  ||  Inside Animation of a Soap Pump Dispenser
**Channel:** Branch Education | **Views:** 442K | **Date:** 4 years ago | **Duration:** 1:00 | **ID:** 9kzC4CpPxSQ
**Link:** https://youtube.com/watch?v=9kzC4CpPxSQ

### Transcript:
We’ve all used pump dispensers, and it’s rather 
counterintuitive that you press down on the top,   and liquid flows up. So, how does it work? Well, 
when you press the top, it pushes this tube which   moves the piston down forcing the liquid in 
the housing to go either up or down. However,   it can’t go down because there’s a glass ball, a 
spring, and a funnel, which act as a one-way valve   ensuring that liquid flows in only one direction. 
Thus, as the piston is pressed down, the liquid   goes UP through these holes through the center 
of the tube and out the top. Once you release the   top, the spring applies a force to the bottom of 
the tube, pushing the piston back up and pulling   liquid back into the housing. Because of the 
design of the tube and the piston, when the piston   moves up, these holes in the tube get blocked 
by the interior walls of the piston, and thus   the liquid that refills the space can only come 
up from the bottle via the dip tube. The volume   in the housing is now replenished, and ready to 
be pumped out again. This is Branch Education.

---

## 22. How does Bluetooth Work?
**Channel:** Branch Education | **Views:** 10.1M | **Date:** 4 years ago | **Duration:** 21:35 | **ID:** 1I1vxu5qIUM
**Link:** https://youtube.com/watch?v=1I1vxu5qIUM

### Transcript:
Bluetooth is a fascinating technology. For example, when you play music on your wireless
head-phones, your smartphone transmits around a million 1s and 0s to your headphones every
second using Blue-tooth. These 1s and 0s are assembled into 16-bit
numbers which are used to build the electrical waveform that is sent to the speaker and converted
into sound waves. But how are a million or so 1s and 0s wirelessly
transmitted every single second between your smartphone and your wireless earbuds? In order to answer this question, we’re
going to explore the engineering behind Bluetooth and the principles of wireless commu-nication. Before we get into the details and specifics
of Bluetooth, let’s start with an analogy. When you see a traffic light change color,
you recognize what that color change means. The traffic light uses a section of the electromagnetic
spectrum, or light, to convey information. The green light has a wavelength of around
540 nanometers, yellow around 570 nanometers, and red around 700 nanometers. Your eyes can easily distin-guish between
these different wavelengths of light, and your brain interprets these different wavelengths
and the information they convey. Your smartphone and wireless earbuds communicate
using electromagnetic waves in a rather similar fashion but utilizing a different section
of the spectrum. Specifically, Bluetooth uses waves that are
around 123 millimeters in wavelength. They are invisible to the human eye and can
generally pass-through obstruc-tions like walls, rather like visible light passing through
glass. When your smartphone sends a long string of
binary 1s and 0s to your earbuds, it communicates these 1s and 0s by designating a wavelength
of 121 milli-meters as a 1, and a wavelength of 124 millimeters as a 0, similar to the
540-nanometer green and 700 na-nometer red colors of the traffic light. Your smartphone’s antenna generates these
two wavelengths, and switches back and forth between them at an incredible rate of about
a million times a second. With this pro-cess of switching between the
two wavelengths, kind of like switching between the red and green traffic lights, your smartphone
can communicate around a million 1’s and 0’s every single second to your earbuds. And amazingly, engineers have designed the
antennae and circuitry in your earbuds and smartphone to be attuned to sensing and transmitting
these wavelengths back and forth to one another. Before we dive into further details on Bluetooth,
let’s briefly explore and clarify these visualizations because they’re potentially
rather confusing. First of all, electromagnetic waves do not
travel in a single direction in a sinusoidal fashion like this. In fact, the electromagnetic waves that are
transmitted from your smartphone travel out in all directions like an expanding sphere. When your smartphone switches between frequencies,
it’s as if it were a lightbulb that rapidly changes between two different frequencies
of millimeter length electromagnetic waves, which travel out as expanding spheres. As a result, your smartphone and wireless
headphones can work in any di-rection. Thus, this visualization of a directional
sinusoidal wave is lacking, yet there are still merits to the vis-ualization. In order to give you a sense of how Bluetooth
works, we’re going to use 4 different visualizations that are all different perspectives of looking
at the same invisible thing. Here we have the sinusoid waves which give
us a sense of the frequency and wavelength of the electromagnetic wave. What’s moving up and down is not the wave
itself, but rather it’s the strength of the electric field. This perspective just shows us a directional
sliver or ray of the expanding sphere with the electric field going up and down as the
Bluetooth signal propa-gates outwards in all directions. If we were to measure the electric field at
a single point in space, we would find that the strength of the electric field would increase
and decrease sinusoidally, and the number of peaks per second would be the frequency. Furthermore, we’re ignoring the magnetic
field component of the elec-tromagnetic wave, as including it would be too confusing. Let’s move onto the second visualization. Here we have the travelling binary numbers
which give us a sense of the data being sent, however it also doesn’t show the spherical
propagation of the electromagnetic waves or the changing frequency of the wave. Note that it’s possible to send multiple
bits at the same time which we’ll explore later. Third, we have the expanding spheres visualization,
which gives a sense of the true near-omnidirectional emission of electromagnetic waves from your
smartphone and headphones, but it’s difficult to show the frequency or the data that’s
being sent, and it's rather visually complex to process. And last, we have the simplified spheres,
which help us see that these two devices are emitting and receiving electromagnetic waves
along the same frequencies, but it doesn’t show us much else. Different visualizations are useful in different
scenarios, and with that covered, let’s get back to the focus of this video. As mentioned, Bluetooth operates at around
123 millimeters of wavelength, but specifically, it oper-ates between 120.7 millimeters and
124.9 millimeters of wavelength in the electromagnetic spectrum. Note that, these frequencies are more commonly
referred to as having a 2.4 to 2.4835 Gigahertz frequency band-width or range. Just as our eyes see within a range on the
electromagnetic spectrum, Bluetooth anten-nas see or perceive within their own range of
frequencies . Now, at any given time, there might be dozens of people using Bluetooth
devices at the same time in the same room. To accommodate so many users, this section
of the electromagnetic spectrum is broken up into 79 different sections or channels,
with each chan-nel having a specific wavelength for a 1, and another for a 0 and at any given
moment your Smartphone and earbuds communicate across just one of these channels. For example, these are the frequencies for
a 1 and a 0 in channel 38, whereas these are the frequencies for channel 54. Now this begs the question: if dozens of devices
are using the same wavelengths and possibly the same channel, how do your earbuds receive
long strings of binary bits, or messages from your phone exclusively. Well first, the messages are assembled into
packets. In each packet, the first 72 bits are the
access codes that synchronize your smartphone and earbuds to make sure that it’s your
specific earbuds that receive the message. These access codes are similar to the address
words on a postal letter or package. Just a few lines of writing and a stamp can
send a letter, which is seemingly identical to millions of other letters, to the exact
house or address anywhere in the world. The next 54 bits are the header which provides
details as to the information being sent, which in our analogy can be equated to the
size of the letter or the box. And the last 500 bits are the actual information
or payload, kind of like the contents of our postal letter or box, which in this case are
the digital 1s and 0s that make up the audio that you are listening to. If you’re wondering how audio can be represented
by 1’s and 0’s take a look at this episode on audio codecs. Ok, so now let’s add more complexity to
the mix. As mentioned, Bluetooth operates in a set
of 79 dif-ferent channels. However, when your smartphone and earbuds
communicate, they don’t stick to a single channel, but rather they hop around from channel-to-channel
kinda like channel surfing on your TV. In fact, this hopping between the 79 channels,
which is called frequency hopping spread spectrum, happens 1600 times a second, and after each
hop one packet of information composed of the address, header, and payload, is sent
between your smartphone and earbuds. Your smartphone dictates the sequences of
channels it will hop to, and your earbuds follow along. Furthermore if one of the 79 channels is noisy
due to interference or is crowded with other users, then your smartphone adapts and doesn’t
use that channel until the noise clears. This channel hopping also prevents anyone
from eavesdropping on the information that is being sent between the two devices, because
only your smartphone and earbuds know the sequence of channels that they will communicate
across. Interestingly, because the information is
divided and sent using packets, if your earbuds don’t receive one of the thousands of packets,
it says it didn’t receive that particular one , and your smartphone sends the packet
again. It might seem crazy or mind blowing that the
circuitry in your phone can generate pulses of electro-magnetic waves a million times
a second at very specific frequencies and then have these pulses received and decoded
by your earbuds- but hey- it happens. Just think about how your screen has millions
of pixels, also emitting specific frequencies and strengths of the electromagnetic spectrum,
or light at around 30 to 60 or more times a second. Technology is fascinating. One quick side note: We would greatly appreciate
it if you could take a second to like this video, sub-scribe to the channel, comment
below, and share this video with others. A few seconds of your time can help us to
create many more educational videos. Thank you! Okay, let’s move on. One point of interest is that Bluetooth’s
frequency range of 2.4 Gigahertz to 2.4835 Gigahertz is shared by other industrial and
medical devices. For example, your microwave is in this range
and has a frequency of 2.45 Gigahertz. In fact, when your microwave is on, it can
cause your head-phones to lose track of the 1s and 0s being sent by your smartphone, or
in other words your headphones can lose signal. However please don’t think your Bluetooth
headphones are dangerous because they emit a wavelength that’s similar to your microwave’s. That would be like comparing the light output
from stadium floodlights to the light from your smartphone screen, and saying that, because
they both use the same colors of light, they will both cause damage when stared at from
a foot away. Also, remember we mentioned that the electromagnetic
waves from Bluetooth can easily travel through obstacles such as the walls of your house? However, the walls of the microwave are designed
to block waves of this frequency. You can test this by putting your smartphone
in the microwave; the Bluetooth signal from your smartphone to your headphones will be
blocked, and the connection lost. However, make sure NOT to turn on your microwave
with any electronic devices inside of it, I repeat, do NOT turn on your mi-crowave otherwise
it WILL damage whatever electronics you put into it. In addition to microwave ovens, 2.4 Gigahertz
Wi-Fi networks also operate within this range of the electromagnetic spectrum. Similar to Bluetooth, Wi-Fi networks divide
this range or bandwidth into 14 chan-nels in order to accommodate multiple users communicating
via Wi-Fi at the same time. You might be won-dering, if there are a bunch
of different devices all sharing similar frequencies, one of them being a microwave that, if poorly
shielded, can emit stray electromagnetic waves, how is it possible for your smartphone and
headphones to send megabits of data every second, error free? Well, as mentioned earlier, your smartphone
does this by frequency hopping, and utilizing packets. In addition to that, Bluetooth also utilizes
bits for de-tecting errors and the circuitry in your smartphone filters out unwanted noise. For a non-technical under-standing of this,
let’s go back to our traffic light analogy. When you’re driving and you see a traffic
light, it’s not like that’s the only thing you can see. Your eyes perceive a rather complex scene
filled with tons of other objects. Your brain interprets this information-filled
scene and picks out the information important to you, while ignoring all the objects that
aren’t. Similarly, your smartphone and wireless headphones
have rather complicated circuitry inside a specialized Bluetooth microchip that’s designed
and tested by engineers, which filters out unwanted signals, checks for errors, coordinates
the frequency hopping, and assembles the infor-mation into packets thereby enabling reliable and
secure communication. Before we move onto some higher level-engineering
concepts, we’d like to take a few seconds to thank KIOXIA for sponsoring this video. Many Bluetooth devices such as mobile phones
and tablets use KIOX-IA BiCS Flash Memory. KIOXIA also manufactures a wide variety of
SSDs and they have sponsored a couple of our videos that explore the inner workings behind
how SSDs work. Here’s a consumer class SSD, versus this
enterprise class SSD. They look similar from the outside but are
entirely different on the inside. KIOXIA pro-vides these leading quality enterprise
class PCIe NVMe solid state drives, and they can fit in the same space, but have capacities
up to a whopping 30 Terabytes, and use a proprietary architecture built with their own controller,
firmware, and BiCS Flash 3D TLC memory in order to deliver incredibly high sustained
read and write performance and reliability. Check out KIOXIA’s SSDs using the link in
the description. Let’s move on to even more complicated details
regarding Bluetooth. The scheme of sending a digital signal, or
a binary set of 1’s and 0’s by transmitting different frequencies of electromagnetic waves
is called frequency shift keying. Frequency shifting means that we adjust the
frequency, and keying means that a 1 is assigned to one frequency, and a 0 to another, just
like our traffic light colors. Note that the comparison to a traffic light
which emits one color and then another is a little inaccurate because your smartphone’s
circuitry generates one frequency, called a carrier wave. This circuitry shifts the carrier wave to
a higher frequency when it wants to send a 1 or to a lower frequency when it wants to
send a 0. This shifting of frequencies in order to send
information is also called frequency modulation, and it’s closely related to FM radio. That being said, Bluetooth isn’t limited
to using just frequency shift keying; but rather it can also use other properties of
electromagnetic waves to transmit information. A different method that has higher data transfer
rates is called phase shift keying, which is a significantly more complicated to explain
but we’ll try. An electromagnetic wave’s phase is a property
that our eyes can’t perceive, and it shouldn’t be confused with the amplitude or the frequency
or the wavelength. Let’s use an analogy. Imagine you’re at the beach and you see
the waves hitting the shore at a rate of one wave a second. Over a minute you would see 60 wave peaks
reach and break on the shoreline. Changing the frequency would be changing how
many wave peaks reach the shoreline every second and changing the amplitude would be
changing the height of the peaks and troughs of the waves. However, phase shifting would be seen as breaking
up the waves’ locations of the peaks and the troughs within a set of wavelengths. There are still 60 waves over an entire minute,
meaning the frequency doesn’t change, but as the phase shifts, it’s as if the peaks
and troughs shift forward or backward within a set of wavelengths. Bluetooth antennas and circuitry in your smartphone
and wireless earbuds can be designed to emit and detect shifts in the phase of an electromagnetic
wave, and binary values can be keyed, or assigned to dif-ferent levels of shifts in the phase
of the wave. There are a few things to note with our examples
and explanations. We’ve talked a lot about your smartphone
sending information to your wireless earbuds; however, your earbuds also send data to your
smartphone. For example, when you’re on a phone call
using your earbuds, the audio from the microphone in your wireless headphones is obviously sent
back to your smartphone. In order for Bluetooth to accommo-date this
back-and-forth conversation, the smartphone and the headphones alternate transmitting
and re-ceiving data, while maintaining the frequency hopping schedule. During one 625 microsecond timeslot, your
smartphone will send one packet of data to your headphones along one channel, and then
during the next 625 microsecond time slot your headphones will send one packet of data
to your smartphone along the next channel in the frequency hopping schedule. Also, as we mentioned earlier, a Bluetooth
packet is composed of 3 sections: access codes of 72 bits, a header of 54 bits, and for example
a payload of 500 bits. The number of bits in the access codes and
header are pretty close to those mentioned, however the size of the payload which is specified
using the header can vary widely between 136 bits and 8168 bits depending on the requirements
of the data being sent. For exam-ple, simple commands from your headphones
like pause or play the music would require far fewer bits than sending or receiving high
quality audio. An additional caveat is that the electromagnetic
waves sent and received from the antenna in your smartphone and earbuds, and the light
from a traffic light, share the aspect that they both function within the electromagnetic
spectrum. However, the principles that govern how your
smartphone and headphones gen-erate and receive those electromagnetic waves are quite different
from the principles around how traffic lights and your eyes work. It’s kind of like how fire and an electric
radiator both generate heat but using vast-ly different methods. The principles behind Bluetooth fall under
the category of antenna theory and will be explored in a separate episode. Thus far we’ve made a few episodes that
help to explain other parts of these wireless headphones such as noise cancellation and
the audio codec, and we’ve made even more episodes that dive into the dif-ferent parts
of your smartphone. Check them out to learn about these other
fascinating technologies. We believe the future will require a strong
emphasis on engineering education and we’re thankful to all of our Patreon and YouTube
Membership Sponsors for supporting this dream. If you want to support us on YouTube Memberships,
or Patreon, you can find the links in the description. You can also provide additional support by
subscribing, liking this video, commenting below, and sharing this video with others. This is Branch Education, thanks for watching!

---

## 23. How does this SSD store 8TB of Data?  ||  Inside the Engineering of Solid-State Drive Architecture
**Channel:** Branch Education | **Views:** 450K | **Date:** 4 years ago | **Duration:** 9:37 | **ID:** r-SivgEpA1Q
**Link:** https://youtube.com/watch?v=r-SivgEpA1Q

### Transcript:
this video is sponsored by keoxia   solid-state drives are fascinating not only 
because they can store terabytes of data   but because they can access any piece of that 
data almost instantaneously this solid state drive   can hold eight terabytes of data if each bit were 
represented by a penny faced either heads or tails   that is a one or zero this drive could store the 
capacity of 64 trillion pennies now if we laid all   of these 64 trillion coins out flat on a surface 
the area of the surface would take up the entire   state of massachusetts which is an incredibly 
large area to be covered in pennies but what's   truly incredible is that the solid state drive can 
find a five by five meter area of pennies anywhere   on this massive surface and then right to or 
read out the binary state of those pennies   in fact the ssd can erase and change the state of 
every single one of these 64 trillion coins up to   10 times every day and it can read out the state 
of all of these pennies around 70 times a day so how does it do it well in this solid state 
drive there are 18 nand flash microchips that   are used for storing all eight terabytes 
of data when we look inside a single chip   we find that there's a stack of eight die each 
die has two planes and if we were to zoom in on   a single plane we would find that each plane is a 
vast array of vertically stacked charge trap flash   memory cells organized into thousands of blocks 
each block is organized into hundreds of pages   and each page contains tens of thousands of 
memory cells and each charge trap flash memory   cell can hold three bits of information or three 
coins worth of data here's a nanoscopic picture   of what the stacks of memory cells look like which 
is just one microscopic section of the overall dye   in other episodes we discussed how information 
is stored in each cell or how the pages of cells   are organized but for this episode let's focus 
on the big picture and see how the solid state   drive can store 64 trillion bits and how it 
can access or write to the contents of just one   page of about 10 million pages note however that 
these numbers are approximate and that they're   different for different brands and sizes of ssds 
in this solid state drive there are a number of   components we have to look at first over here is 
the ssd controller microchip or brain whose role   it is to interface between all 18 nand flash chips 
this microchip also interfaces and communicates   with the laptop computer or server that the ssd 
is plugged into aside from the 18 nand flash chips   and the controller the other main components are 
the 8dram chips which serve as a memory buffer for   holding the massive lookup tables or translation 
tables that tell where all the information is   stored we'll get into what this lookup table does 
shortly but for now the other main components are   the memory channels that allow the 18 nand flash 
chips and the ssd controller to communicate   each nand flash chip has a memory channel 
and is composed of 16 wires or traces   that run through the pcb these memory channels 
are used for reading the address of where data is   located and transferring the actual data to write 
to or read from the nand flash additional traces   are used for sending commands to write to or read 
out the information to each of the nand flash   chips to better explain the data flow let's use a 
simple example the computer requests a small piece   of information from the solid state drive say a 
picture the ssd controller then sends the request   for the nand flash chip to read out the contents 
of chip 9 die 4 plane 1 block 351 page 45.   the 3d nand flash chip accesses that location and 
sends the contents along the memory channel's 16   traces back to the controller this controller then 
routes the information to the computer that it's   plugged into or the reverse could happen where in 
the computer asks to store data the ssd controller   would then ask the nand flash chip to write the 
information to a particular page or if the file   were larger the controller would write this file 
to hundreds of pages instead of just a single page   you might wonder how does the controller keep 
track of where all the information is stored   well that's the role of the lookup table or 
the translation table from the perspective   of your computer the ssd is just a massive set 
of sectors of data each the size of 512 bytes   and thus this 8 terabyte drive has 15 billion 
sectors for example when you store a picture   your computer tells the ssd to store the picture's 
data in a set of unused sectors the ssd controller   then takes the picture's data and sends it noting 
the address for the chip die plane block and pages   of the precise location the ssd controller 
essentially has a massive spreadsheet where   all the sectors are translated into different 
locations inside the 18 different nand flash chips   note that this type of translation is also called 
a logical to physical translation where your   computer only sees what sectors the picture is 
stored in but the ssd knows the physical locations   furthermore the translation table or lookup 
table is continuously being updated when it's   in continuous use it can be found in the working 
memory or dram chips of the solid state drive   and when it's not in use it's saved to the 3d nand 
flash chips another important detail is that while   individual pages can be written to or read from 
it's more common for super pages to be utilized   a super page consists of all the pages on each 
of the 18 chips that share the same die plane   block and page designation and thus the super page 
has the same address in each of the respective   18 nand flash chips for example when a large video 
gets saved it gets spread across all 18 nand flash   chips and stored in a super page or possibly 
multiple super pages thus when writing to or   reading out the video all 18 chips are running 
in parallel resulting in read or write times   faster than if the video were stored in just one 
of the nand flash chips furthermore super blocks   can also be utilized and they're the common block 
address among all 18 nand flash chips also note   that the ssd controller performs other 
functions like wear leveling garbage collection   and executing the error correction code but 
these topics will be saved for a future video   this is the fourth video that explains how 
solid state drives in 3d nand flash work   this video focuses more on the ssd architecture 
while the other videos explain the structure of   the 3d nand flash how information is written to 
a cell and how information is read from a cell   check out those videos as well this video is 
sponsored by kioxia as you may have noticed   this is a chaoxia ssd and there's a 
lot of engineering that goes into it   the oxia sells a wide variety of ssds and the 
one we're using here is a data center class   ssd which is designed for consistent performance 
and latency for hyperscale applications they   also provide enterprise ssds which are top of the 
line ssds in terms of read and write performance   and reliability check out keoksia's ssds using the 
link in the description we'd like to thank all of   our youtube and patreon sponsors for helping us 
build these in-depth engineering explanations   you can also provide your support by 
subscribing liking this video commenting   below and sharing this video with others 
this is branch education thanks for watching

---

## 24. How Do Noise Canceling Headphones Work?
**Channel:** Branch Education | **Views:** 1.2M | **Date:** 4 years ago | **Duration:** 6:12 | **ID:** VIi04uD8LtY
**Link:** https://youtube.com/watch?v=VIi04uD8LtY

### Transcript:
Active Noise Cancellation is a fascinating feature 
of high-end headphones that requires some rather   complicated engineering. Headphones such as these 
are able to eliminate or destroy unwanted noise   that is produced by the external environment, 
while simultaneously playing the desired music   or audio that is sent from your smartphone.
In a nutshell, headphones such as these do   this by using a microphone to measure the 
unwanted noise produced by the environment   and then calculating an anti-sound wave. This 
anti-sound wave is added to the waveform of   your music or audio, and when the combined 
waveform is played through the headphone’s   speaker, the external noise is eliminated or 
canceled out, and just the desired audio remains.  That’s the basic principle, but there’s a lot of 
intricate engineering that underpins active noise   cancellation. In order to better understand the 
engineering, it’s easier to visualize sound waves   not as these sinusoidal patterns but rather 
as a set of traveling high-pressure zones,   known as compressions, and low-pressure 
zones, known as rarefactions.  Let’s say you live or work next to a highway. 
All the cars and trucks that zoom by generating   a sound with a waveform such as this, which is 
really just a sequence of traveling high pressure   and low-pressure zones. These compressions 
and rarefactions move through the air,   and when they hit your eardrum, 
you hear the sounds of the highway.  In order to produce an anti-sound wave for the 
highway’s noise, a sound wave must be generated   that is equal and opposite. By that, we mean 
that for every high-pressure zone from the noise,   a low-pressure zone needs to be generated, 
and for every low-pressure zone from the noise   a high-pressure zone needs to be generated. 
The noise and anti-noise meet, and when these   low-pressure zones and high-pressure zones meet 
or vice versa, they average out in that area,   thereby eliminating the sounds from the highway.
There are a few engineering challenges with   this solution. First, the headphones or earbuds 
them-selves provide some passive noise insulation,   and therefore we need two microphones. One 
microphone is used on the outside to measure   the noise itself, and a second microphone 
is used on the inside of the head-phones   to measure the percentage of noise that’s 
getting through the sound insulating   properties of the headphones and into your ear.
The second challenge is that it’s rather difficult   to perfectly time the anti-sound wave with the 
external noise. The noise from the highway has   hundreds of compressions and rarefactions every 
single second, so, if the anti-sound wave is off   by a few milliseconds, then the noise cancellation 
won’t work properly. Therefore, a high-powered   digital processor is used to measure and calculate 
the perfect anti-sound wave, while simultaneously,   the interior microphone is monitoring whether 
the active noise cancellation is in fact working   properly. Note that active noise cancellation 
is more effective for low frequency, repetitive   noises because they have only a couple hundred 
peaks and troughs, or wavelengths every second,   but high-frequency noises have thousands 
of wavelengths per second. If there’s even   the smallest inaccuracy in timing the anti-sound 
wave with the high frequency noise, the resulting   combination between the anti-sound wave and 
the high frequency noise will be ineffective.  The third challenge, managed by the processor 
and circuitry is that the anti-sound waveform   needs to be combined with the audio waveform that 
is sent from your smartphone. The audio plus the   anti-sound acts just like different instruments in 
a song and they combine to make a new sound which   is played through the single speaker. When 
the combined audio plus anti-sound waveform   and the noise from the environment mix, the 
anti-sound component of the combined waveform   and the noise from the environment cancel out, 
and we are left to hear just the desired audio.  We made a separate episode that goes over 
the different components of these headphones   and we’re working on future episodes that 
will cover other feats of engineering such   as Bluetooth communication, the antenna, and the 
micro-electrical mechanical system microphones.  This video was made possible by our sponsor   PCBWay. PCBWay can quickly manufacture 
your PCBs with competitive prices,   impeccable standards and they also provide 
PCB assembly services where they populate and   solder the components to the PCB. Check them 
out using the link in the description below.  Also, one quick note about this 3D model. These 
are the Apple AirPods 2, which don’t actually   have an active noise cancellation feature. In 
order to model the interior of these headphones,   we have to get detailed pictures of each 
component, which as you see can be rather   destructive. We have exterior models of these 
other rather expensive headphones which do provide   active noise cancellation, but no interior models 
of them. Sorry for the switch up which we hope   wasn’t too confusing. Furthermore, check out the 
creator’s comments in the English Canada Subtitles   where we discuss the difficulties of 
implement noise cancellation in a room.  We’d also like to thank all of our YouTube 
and Patreon sponsors for helping us build   these in-depth engineering explanations. You 
can also provide your support by subscribing,   liking this video, and commenting below. This 
is Branch Education, Thanks for watching.

---

## 25. The Engineering Inside Wireless Earbuds || How do Wireless Earbuds and Audio Codecs Work?
**Channel:** Branch Education | **Views:** 1.3M | **Date:** 5 years ago | **Duration:** 17:41 | **ID:** _ZKNOKHpqE4
**Link:** https://youtube.com/watch?v=_ZKNOKHpqE4

### Transcript:
How do Wireless Headphones Work?
Script: Teddy Tablante
Modelling Animation: Victor Duarte To most of us, it’s a complete mystery as to how wireless earbuds work. With wired headphones, it makes sense that the electricity flows from your smartphone, through the plug, up the tangle of wires, and to the headphones. But with wireless headphones, how does the audio of your favorite music or podcast get transmitted from your smartphone, through the air, 
and into these wireless earbuds? Well, in this episode we’re going to answer a segment of that question. wireless headphones are incredibly complex
and inside these tiny plastic earbuds there are 9 distinct technologies that we’re going to explore. These technologies are the speaker, audio codecs, Bluetooth, the System on a Chip or SoC, the Printed Circuit board or PCB, accelerometers, the Lithium Ion Battery, MEMS microphones, and noise cancellation. Each of these topics is rather involved, and thus an episode is dedicated to each technology, rather than fit all 9 technologies into a single, feature length movie. Here, as you may have figured from this video’s title and thumbnail, we’re going to focus on the audio codecs, and we’ll explore how sound waves can be represented digitally using just a bunch of numbers. This video will be broken up into 4 parts.  First, we’ll break open these Apple AirPods 2 and explore the different components and where they’re located. Second, we’ll give you a conceptual overview of how these earbuds work. Then we’ll explore the basics of how the audio, or the sound waves of your favorite song, can be represented as digital information using numbers alone. Finally, we’ll provide you with a set of increasingly complicated details which will fill out this explanation, along with a brief discussion of audio file formats. And by the way, this video is sponsored by PCBWay, a provider of all kinds of printed circuit boards.  So, let’s begin. There are many different types of wireless headphones and earbuds, but they all use the same basic principles and technology. Here’s a pair of Apple AirPods 2 we decided to tear open and use as our example. One thing to note is that opening up these AirPods is much more difficult and destructive than we show in these animations. There’s a lot of glue inside, and if you try this at home with your earbuds, they probably won’t work afterwards.  We did it so you don’t have to. Now, let’s take a look inside. Underneath the outer plastic earpiece and mesh dust cover we have a rubber protective shell, along with an optical sensor. Below these sets of covers is the speaker that generates the sound, with its 4 key components: the diaphragm, the suspension or spider, the voice coil, and the magnet.  Behind the speaker, we find some insanely complex circuitry folded into a teeny tiny package Let’s pull out this circuitry and see what makes the earbuds tick. This circuitry is essentially three separate printed circuit boards neatly folded into the earbud, with flexible wires connecting them to make a single PCB. On this top board, which is glued to the backside of the speaker, we find two points where the speaker connects, along with a larger microchip, which handles Bluetooth connectivity and decodes the compressed audio stream sent from the smartphone. We also have a set of accelerometers, along with a programmable SoC. This circuit board is connected to and folded on top of a second circuit board which contains a low power stereo audio processing chip or audio codec. Also connected to this circuitry is a flat cable for the antenna which lies adjacent to the battery, a microphone situated at the back of the earbud which is used for noise reduction, and a third circuit board which is connected to the battery. Down below the battery is an additional small circuit board that holds the main MEMS microphone which is about the size of a grain of rice, and below that is a mesh dust cover, along with the contacts for charging the earbuds. It’s truly an impressive amount of engineering that goes into making these earbuds so light weight and so incredibly small. Now that we’ve seen everything that’s packed inside these earbuds, let’s talk about how they work. When you turn on your already paired wireless headphones near your smartphone, a Bluetooth communication channel is established in order to send information back and forth. As soon as you start playing music or a podcast, your smartphone grabs the audio data from its flash storage chip, decompresses the audio, and stores it in your phone's working memory. This audio is represented digitally as a long set of numbers, and in order to send it to your earbuds, your smartphone compresses and divides the information into packets according to Bluetooth specifications.  Next your smartphone converts these packets into electromagnetic waves or photons and sends the data to the earbuds over the Bluetooth connection. The earbuds receive the data and disassemble and decompress the packets back into long sets of values.  These values are then sent to the audio codec, which converts the digital values into an analog electrical waveform. This waveform is then sent to the voice coil, which is attached to the back of the diaphragm. The voice coil moves back and forth depending on the given waveform, thus moving the diaphragm which in turn creates pressure waves in the air. These pressure waves are sensed by your ear and interpreted as sound by your brain.  But wait, what’s a codec? Well, codec stands for coding and decoding, and in general, it’s either a piece of software or hardware that converts data or information from one format into another format thereby compressing or decompressing data. In the scenario we just talked about, the audio codec converts the music or podcast data from a set of digital values or numbers, into an analog waveform. This is the process of decoding the audio file. In this scenario, the codec performs a digital to analog conversion or DAC. However, audio codecs can also do the reverse by encoding the analog signal from the microphone, into a digital set of values, which is an analog to digital conversion or ADC. Codecs are used in every piece of technology we use in order to convert certain types of data into other types while compressing or decompressing the data. In fact, this video you're watching is downloaded as a compressed video file, and a video codec is actively decompressing this video’s data as you watch it. Now that we have a conceptual overview, let’s take a look at how an analog sound waveform can be turned into and represented by 1’s and 0’s. Here’s an analog audio waveform. It has some peaks and troughs, it’s incredibly detailed, and, depending on the length of the audio file, it can get pretty long in duration.  So, how do you turn this audio waveform into a digital long list of numbers?  You might think that it involves some crazy mathematics  with a ton of sines and cosines, along with multivariable equations, but it’s actually a lot less complicated than that. Rather, the analog audio waveform is placed on a graph, and all the values that it passes through at a set time interval are placed into a list of values. That’s it, the digital version of the audio waveform is just a long list of values or points that the waveform passes through, and in this scenario, we’re going to have 23 microseconds between each data point.  When the digital information, or the long list of numbers, is fed into the audio codec, the audio codec plots all the points on the graph, connects the dots and smooths the line between the points, and sends the analog waveform to the speaker which generates sound. In fact, if you were to open up an audio file in some audio editing software and zoom in, you would see all the points that constitute the audio. A music file or podcast’s data isn’t an analog waveform like this, but rather it’s just a long set of points equally 
spaced apart with their associated values. the process of turning an analog waveform into a set of numbers is called digitization, or analog to digital conversion.  That’s the basic concept. Next, we’ll add on a few more details, and then further, more complex details. But before that, let’s briefly talk about this video’s sponsor, PCBWay. These earbuds contain a Rigid-Flex printed circuit board, where certain segments are flexible and able to bend, while others are rigid and able to support rather complex circuitry. PCBWay offers all kinds of PCB prototyping and manufacturing services including these Rigid-Flex PCBs, aluminum PCBs, PCBs with dozens of layers, and PCBs designed by your kid that are used with push buttons to light up an LED, or this LED cube. PCBWay also offers Turnkey PCB Assembly services to assist you in populating your PCBs.  Check them out at their website linked below. Let’s move on and dive into the details of how sound is represented digitally. There are two key aspects that need to be addressed regarding this system. First, on this graph, the X axis is time, and as we mentioned, every data point, or sample of the analog audio waveform is 23 microseconds apart. If we wanted, the spacing could be smaller, at, let’s say 1 microsecond between values, or samples, which would yield a million samples every second, or a million hertz sampling rate, and would result in audio files that would be over a hundred megabytes for 60 seconds of audio.  So, why 23 microseconds? Well the short answer is that the spacing between each data point depends directly on the average human ear’s ability to perceive sound.  The human ear can hear sounds up to around 20kilohertz, or one wave every 50 microseconds. If the waves were closer together like this, the sound would have a higher frequency which humans wouldn’t be able to hear. Scientists and engineers decided to not really concern themselves with frequencies that humans can’t hear. So, in order to capture a waveform with a maximum 20 kilohertz frequency, two data points are required per full wave, and thus they use one data point every 23 microseconds, which is a rate of 44.1 kilohertz, or 44 thousand 1 hundred samples every second. Note that this sampling rate or sampling frequency of 44.1 kilohertz is the most common rate for recorded audio such as music and podcasts, and 48 kilohertz is the second most common sampling rate. But why is the number slightly more than double the frequency of human hearing? Well, you can find those specifics along with details as to why music played over the telephone always sounds terrible, and finer points on the Nyquist Theorem and aliasing in the creator’s comments.  Also, we would greatly appreciate it if you could take a quick second to tell us what you think about this video in the comments below. Knowing whether you find a section confusing, boring, really interesting, whether it has great graphics, or whatever, is extremely useful, and it helps us to improve on future videos. So, thank you. Let’s get back to our long list of digital values that represent the analog waveform. Our next question is, how do we represent these values in binary? Or, essentially, how many 1’s or 0’s are we going to use for each sample? Let’s try representing each sample by using a single bit, either 1, or 0. To do that, let’s take the original waveform, assign each sample either a 1 or a 0, and here we have the resulting digital data. But how accurate is our analog to digital conversion? To check, we reassemble the graph using these values, 1’s up here, 0’s down here, and smooth a line between the points. Now we have an analog waveform created from the digital data, which was created from the original audio waveform, and… this recreation looks nothing like the original audio, and thus 1 bit isn’t good enough.  So, let’s say we use two bits, which means each sample could be one of 4 different values. Let’s take the original audio, round each value to the closest 2 bits equivalent, and here we have the long set of values.  When recreating the audio, we would again plot all the points on the graph, smooth out the line  but... it still looks pretty bad as it doesn’t really match the original waveform. Really, the question is, what's the optimal number of values in the vertical axis needed to accurately represent the original audio waveform? And the answer is that it varies, but an audio CD for example, uses 16 bits, for every single sample.  With 16 bits that means that there are 2 to the 16 or 65536 different values along the Y axis, or using technical jargon, we say our audio file has a bit depth of 16 bits. The process of turning an analog signal into a set of values is called quantization and assigning bits to each value is called pulse code modulation. Furthermore, an audio bit depth of 16 bits is pretty common, however higher quality audio files use 24 or 32 bits per sample or higher. Okay, so if you came to this video wondering about MP3, AAC, WAV, FLAC, or other audio file formats, we’ll briefly talk about them here. Digital audio data, which is this long list of 16-bit values at 44.1kilohertz, is uncompressed and takes up a lot of space at around 10 and a half megabytes per 60 seconds of 2 channels of audio.  MP3 files at 320kbps stereo, reduce the file size to around 2.4megabytes by processing every millisecond of audio, and finding elements in the uncompressed audio that humans aren't good at hearing. The psychoacoustic algorithm finds elements in the audio that have exceptionally low volume sounds,  very high-pitched sounds, or sounds very close together which the mp3 compression discards, thereby saving space and making it a lossy compression format. Lossless compression formats such as .alac or .flac don’t discard any data but rather compress the data by finding patterns, or redundant data, and representing those patterns more efficiently than when the audio is uncompressed.  But file compression is a complex topic and we’re planning entire videos dedicated to just that topic. As mentioned in the intro, there's a lot of technology that goes into these wireless earbuds. Thus far we have videos made on these topics, and we’re working on videos to explain these other topics. So if you’re interested in getting a complete understanding of how wireless headphones work, check out those videos on our channel page, and subscribe and hit the bell so that you’ll be notified when we release future videos on this topic.  As usual there are even more details in the creator’s comments which can be found in the English Canada subtitles. Thanks again to PCBWay for sponsoring this video as well as our Patreon and YouTube Membership Sponsors for helping us to produce these videos.  Thanks for watching, and finally, always remember to consider the conceptual simplicity, yet structural complexity in the world around you.

---

## 26. How do Smartphone CPUs Work?  ||  Inside the System on a Chip
**Channel:** Branch Education | **Views:** 2.1M | **Date:** 5 years ago | **Duration:** 24:56 | **ID:** NKfW8ijmRQ4
**Link:** https://youtube.com/watch?v=NKfW8ijmRQ4

### Transcript:
How do Systems on a Chip Work?  Understanding Microchips.  By. Branch Education Your smartphone has a variety of components that can do dozens of different things. and the brain at the center of all of these components and functions is the System on a Chip, or SoC for short. When you watch a video such as this one, phone a friend across the country, or navigate through a city using GPS, it may seem like magic, or alien tech, but in reality these feats of technology are all performed inside this SoC which is designed and manufactured through the hard work of countless scientists and engineers.  In this episode we’re going to explore each section of this SoC and then piece together the processes this system on a chip goes through when you do something as routine as snap a photo and post it online. These chips are unfathomably complex as there are between 5 and 10 billion transistors that make up the SoC and they all need to fit into an area the size of a penny. This is a complex topic, and there are many avenues that we could explore, but in order not to overload your brain with details, we’ve decided to focus on the following aspects. First, we’ll start with a few notes and caveats, and then we’ll dive into the layout and key sections of the system on a chip. Next, we’ll explore how data flows through the SoC using the example of what happens when you take a picture. Then we’ll look at some of the complexity inside the central processing unit or CPU block of the SoC. And stick around until the end where we’ll discuss how scientists and engineers design and manufacture these microchips, and we’ll explore what a nanoscopic view of the SoC would actually look like compared to this visualization. So, for this video, grab a snack, sit down, and maybe take some notes if you feel like it because this is going to be one very thorough  and incredibly detailed video. To start, this video is sponsored by Gerber Labs, a quick, reliable, and user-friendly provider of printed circuit boards. Next, this microchip is actually composed of two key parts. On top is the DRAM or the dynamic random-access memory, which is the working memory of your smartphone, and on the bottom is the SoC, the brains of your smartphone. FYI, the long-term memory, where all your music, apps, files, and the operating system are saved, is over here in the flash storage. We have a separate episode on that microchip, and you can find it here, but in this episode we’re going to focus on the SoC. This setup is called a Package on Package microchip or PoP Technically this is the microchip, and the separate layers of the DRAM and SoC are each called a die. However, the word chip has evolved to mean a variety of things so, while all of these rectangular components are microchips or chips, both the DRAM and system on a chip are also called chips even though they're just half of the overall package on package microchip. Moving on, we may make comparisons or analogies between smartphones and humans; for example we called the SoC the brain, or the camera can be considered similar to a human eye- however these are two very, very different systems, and while the analogies may be useful conceptual tools, the underpinning principles behind SoCs and human brains and how they work are entirely different. Finally, the companies that design these SoCs are incredibly secretive about the specifics of how they work and what the actual designs look like. It takes dozens of different companies to design the optimal layout for billions of transistors to perfectly execute the functions of a phone, and a separate set of companies to manufacture the billions of chips used by all our phones. So, in this video, we’ll provide you with the best information we can, considering the companys’ secrecy of intellectual property. As a result, this information will be mixed and woven together from different sources. For example, this is an LGV10 smartphone from 2015 and it uses a Qualcomm Snapdragon 808, but due to the limited availability of information on it, we’ll have to use images and information from the Apple A12 and A13 microchip in the IphoneX and iPhone 11, as well as the Qualcomm snapdragon 865 in the Samsung S20. All of these microchips have different performance metrics and different capabilities, but fundamentally they work on similar principles. Okay, with all these notes covered, let’s move on to understand how this System on a Chip works. A human brain has different sections for processing information received by your eyes and ears, a different section for speech, ones for controlling your taste, smell, movement, balance, involuntary functions, and so on. Rather similarly, this System on a Chip is divided into different functional areas. Here is a graphical representation called a block diagram. The key areas in the SoC are: the CPU containing multiple cores; the GPU which renders graphics; the shared memory cache which is usually around 4 to 8 megabytes; the digital signal processor which interfaces with things like the speakers, microphone, sensors and many other things; the display engine which communicates with the touchscreen display; the video processor which compresses and decompresses images and video and enables 4k video recording and playback; the image signal processor which processes pictures and video taken by the cameras; the modem which interfaces with the various wireless networks; the storage controller, which saves and loads information from the flash storage microchip; the memory controller which connects to the DRAM microchip located on top of this one; the security enclave, which executes encryption, and manages the public and private keys; a number of peripheral functions such as clocks, temperature sensors, debug ports, and general purpose inputs and outputs, an always on microcontroller unit; and finally the network-on-chip or NoC which arbitrates or manages data flow through the SoC, the DRAM and other parts of the phone. Furthermore, some SoCs may have on board power management circuits that complement the power management performed by separate chips outside the SoC. Additionally, some SoCs such as Apple’s, have a neural processing unit or an NPU that is specialized circuitry that can execute machine learning algorithms far more efficiently than the CPU, both in terms of speed, and more importantly, power consumption. One confusing detail is that different generations of SoCs use different marketing names and mix multiple functions into different functional blocks. For example, here’s the block diagram of the snapdragon 808, versus the diagram for the snapdragon 865 and here’s the block diagram for Apple’s A12 chip. Each company’s marketing team may decide to provide differing block diagrams to try to impress the consumers, which at times can certainly be confusing. Let’s move on and explore a real-life example of how data moves around your smartphone when you take a picture. But before that, one quick note.  If you enjoy watching this video, or if you think it’s a useful learning tool, make sure to like and comment on this video as well as share it with others.   With your help, we can get this video to over 10,000 comments and more than 100,000 likes.  But for now, let’s get back to understanding what happens when you take a picture on your smartphone. First, the photons from the scene enter the camera’s lenses, flow through a color filter array, and hit the sensor’s photodiode pixels. These color filtered photons are then absorbed by each photodiode and converted into an analog electrical current which is then converted into a digital 12-bit binary value. A 12-megapixel camera’s image has 12 million of these 12-bit binary values. Note, that each pixel is either Red, or Green, or Blue, and thus the overall image is considered raw and still has to undergo a number of image processing steps to turn it from a raw image into a recognizable picture, where the pixels each have a red, and green, and blue value. But before these processes take place, this image data must be stored somewhere, and as a result it’s sent to the smartphone’s working memory or DRAM. To do this, the data travels from the camera and enters the SoC through a mobile industry processor interface or MIPI which can send or receive data at around 5 to 8 Gigabits per second. This image data is then routed by the Network on Chip arbitrator through the SoC to the memory controller and into the DRAM, which, as mentioned before, is located on the die above the SoC. There are two quick things to note: First, the data path between the SoC and the DRAM is shared by everything. In this scenario it’s the job of the network arbitrator to prioritize the incoming sensor data of the uncompressed raw image so that no data from the camera is lost, and thus the arbitrator streams the raw image directly into the DRAM. Second, a 12-megapixel uncompressed raw image takes up around 24 megabytes However, the memory cache on the SoC is typically 4 to 8 megabytes and is shared among all the processes on the SoC. Therefore, when the image signal processor or the video processor works on a recently taken picture in order to make it viewable or to compress it, they can only work on small subsections of the overall image, leaving the entire image temporarily stored on the DRAM. This also happens while watching a video, playing a video game, or using pretty much any app. Okay, let’s get back to the raw image data of the picture that was taken by the camera, and then sent to the MIPI routed through the SoC, and stored in the DRAM. The next step is for the image signal processor or ISP on the SoC to read the raw uncompressed image data and perform a number of image processing steps. These steps involve first correcting for darker pixels on the edge of the sensor due to lens shading. Then the ISP performs the demosaicing process which involves taking the image data and the pattern on the camera’s color filter, and calculating a red, green, and blue value for every pixel. Next the image signal processor denoises, sharpens, enhances the image, and color corrects it because the red, green, and blue filters on the camera don’t directly match the hue of the red, green, and blue pixels in the display, and finally the image signal processor tone maps the image. After all this we have a picture with 12 million pixels, each with an 8-bit red, green and blue value. To get the picture to promptly appear on your screen another series of steps are involved: the RGB image data is taken from the image signal processor, sent to the GPU where it gets overlaid into the graphics of the camera app and scaled to fit the screen  The resulting RGB values get sent to the display processor, and then the image is routed to the display where it’s converted into intensities of current in order to light up the corresponding pattern of red, green and blue pixels. And there you go- a picture taken by the camera and whoosh! displayed on the screen. But we’re not done yet.  How is the picture saved on your smartphone? Well, first the picture needs to be compressed, and to do that the uncompressed image currently residing in DRAM is sent to a dedicated video coding processor where it first gets converted from red, green and blue values into YUV, or luminance, blue chrominance, and red chrominance values. Next, this data undergoes a series of algorithms in order to remove information that is undetectable to the human eye and compresses the image into approximately a 3-megabyte JPEG format. This compressed image is sent back to the DRAM, and then routed to the smartphone’s flash memory for long term storage. Now, if you were to send this picture to a friend, the compressed image would get brought back into the DRAM, and then routed to the modem where it’s divided and assembled into packets, then sent to the  4G, 5G or Wi-Fi microchip, converted into electromagnetic waves and sent to a cellular or Wi-Fi network. One thing we’ve talked a lot about is the movement of data through the SoC. All of this data movement between the blocks runs over connecting wires on what is part of the network on a chip. This network has routers and switches for shared access to routes and targets like the DRAM.  The routers and switches arbitrate the flow of data and act like digital traffic lights and the pathways act as a digital highway. These highways have different widths of wires based on what they’re talking to and the amount of information that needs to be sent.  
Depending on required data rates, there are typically 128 or 256 wires running parallel to one another, carrying one bit at a time, and operating between 500 and 1,500 Megahertz. In order to avoid wasting power from your smartphone’s battery, the frequency and resulting data transfer rates across the network on a chip ramp up and down depending on the requirements of the applications you’re running and this feature is called dynamic frequency scaling. Before we explore the CPU and see how these chips are designed and manufactured, let’s take a quick break and talk about this video’s sponsor, Gerber Labs. Every SoC eventually makes its way onto a printed circuit board along with other components that are put together to create a vast array of different circuits. You can start your own creative circuits by building a printed circuit board from Gerber Labs. Gerber Labs is founded by electrical engineers for electrical engineers. They make it easy to get boards with consistent quality, quick turnaround, and reliable shipping. Check them out with the link in the description  and stick to the end of this video to receive a discount code for your order. Okay, so, thus far we’ve glossed over the functionality of each of these blocks in the SoC, but now let’s quickly take a look into the central processing unit or CPU section of the SoC. As you see there are multiple cores, and each core can run part of a program by executing instructions. If we focus on just one of these cores, we see that inside it there is another incredibly complex set of blocks that depict the different functional sections and the data flow between them.  There is a ton of information in this block diagram, and we’re planning on making an entire series to explain it all, but for now, here are the CPU’s memory caches. The instructions such as add, multiply, load, store, compare, jump, and many more, flow this way, and the actual data being processed flows this way. And then over here are the blocks that actually  execute the arithmetic, branching, and storing of data. Let’s move on to a few additional details about this processor. All smartphones use a reduced instruction set computer, or RISC architecture, and almost all of these architectures are licensed from a company called ARM which stands for Advanced RISC Machines. Some companies like Apple license the instruction set architecture or ISA from ARM and use this ISA to design their processor cores in house whereas other companies like Qualcomm license complete blueprints which are technically called intellectual property cores from ARM. Qualcomm then integrates the ARM IP cores into its SoCs, sometimes keeping the design of the core as is, but more often modifying or customizing the ARM core to better suit Qualcomm’s design needs and, in the process, Qualcomm rebrands the name of the CPU. However, all this information still begs the question of, how do these SoCs get designed and manufactured. Instead of talking about the entire design process which you can find in the creator’s comments, we’re going to discuss two design principles of the SoC. The first principle is called hardware acceleration, and this principle deals with the fact that instead of having a single very powerful general purpose CPU with a lot of cores, this chip has a variety of special purpose blocks dedicated to performing specific functions.  These special function blocks, or hardware accelerators, compute their tasks faster while using significantly less power than if the same operation were performed by the general-purpose CPU. For example, as we saw with the processes involved in taking a picture, there is an entire block of the SoC that's dedicated to processing the image, and then a separate block whose job it is to encode, decode or compress or decompress the image,  and, if you’re watching this video on your smartphone, it’s actively decompressing this video as you watch it. These sections are useful for taking pictures, but critical for recording 4K video, and saving battery life.  Hardware accelerators are utilized for pretty much all computationally-intensive tasks performed by your smartphone The next design principle is that, because SoCs are used in smartphones, which operate on a battery, there's a huge focus on having the SoC consume as little power as possible.  One example of low power consumption design  is in the CPU.  Instead of having all high performance cores, chip designers often follow a big-little design structure, where there are 2 or 4 big cores that are high performance cores but consume more power, and 4 little cores that are lower performance 
but are energy efficient, and your smartphone prioritizes using these lower performance energy efficient cores when possible. Furthermore, the design of the transistor, which is the smallest and fundamental building block of the SoC, has had its design evolved to both be smaller, but more importantly to consume less power.  
As of 2020 the latest technology of transistors is called a gate all around field effect transistor. Let’s finally move onto how these chips are manufactured. To start, the lion’s share of all SoCs get manufactured by a single company called TSMC, or Taiwan Semiconductor Manufacturing company, and a smaller, yet increasing proportion of SoCs, are manufactured by Samsung. These microchips are manufactured on 300mm wide silicon wafers in factories called fabs.  In order to manufacture an array of chips, the silicon wafer has to go through a series of 120 to 160 processes or steps performed by dozens of different machines. This is the most common sequence of steps
for manufacturing microchips, As you see, there are only a dozen or so steps, but each of these processes are performed dozens of times in order to build an incredibly complex layout of transistors. But this video is getting too long, so we’ll have to save the details of each step for a future video.  For now, here’s what a nanoscopic view of the SoC looks like.  On the bottom is the silicon wafer, and the billions of transistors are implanted and built into and on top of the silicon. On top of the layer of transistors are layers of local interconnects that connect transistors to one another, and then on top of that are the global interconnects that connect sections of transistors. This is just a small fraction of  the entire SoC layout. Let's zoom out in order to get a sense of the size of these components. I'm sure you've heard that transistors are incredibly small, and, Well, here's a single grain of fine table salt.  Mind-blowing- right? It makes you think… the potential of humanity to reach incredible levels of science and engineering is limitless.

---

## 27. How does NAND Flash Work?  Reading from TLC : Triple Level Cells  ||  Exploring Solid State Drives
**Channel:** Branch Education | **Views:** 451K | **Date:** 5 years ago | **Duration:** 13:20 | **ID:** YtBysgPOKx4
**Link:** https://youtube.com/watch?v=YtBysgPOKx4

### Transcript:
we have an engineering puzzle for you let's set it up first here's just one of the hundreds of millions of nanoscopic charge trap flash memory cells used to store information in your smartphone computer tablet and dozens of other devices second it's composed of three functional sections a gate a charge trap and a channel with dielectric barriers used to separate each section third this memory cell can be used to store one bit of information either a zero or a one using electrons in the charge strap if there are electrons on the charge strap it's a zero if there are no electrons it's a one and fourth solid state drives worked this way about a decade ago so the puzzle is how do we increase the storage capacity of this one charge trap memory cell so that it can store a value from zero to seven or three bits of information instead of just zero or one or one bit of information in other words how can one memory cell with a single charge trap be manipulated or engineered so that it can store three bits of information or one of eight different values by the way there are hundreds of millions of memory cells inside just one of these flash memory microchips and there are 18 of these microchips inside this particular enterprise-class solid-state drive from keoksia it's rather fitting that keyoxia was willing to sponsor this video because under their company's former name toshiba memory they invented nand flash memory in 1987 but we'll discuss them more later to start let's give a little more context this insanely small memory cell is just one of hundreds of millions of memory cells in your smartphone which are organized one hundred layers tall forty thousand columns wide and fifty thousand rows down the overall structure is called 3d nand here's a sheet of paper and a one euro cent coin so you can get a sense of the height and scale of these cells let's zoom back into an individual memory cell this memory cell is composed of concentric cylinders which are a result of manufacturing these cells in vertical columns let's focus on a cutaway of the cylinder to make it easier to visualize and understand what's happening as mentioned before here we have the gate the charge trap and the channel and each of these sections is separated by a dielectric that acts as an electric insulator and prevents the flow of electrons between sections but allows electric fields to pass through in the center is a non-conductive material called core filler but it's just there for structural support and not much else so we're going to remove it the first step for solving our puzzle is that we have to understand how this memory cell reads out information to begin let's simplify the design and remove the charge trap and we're left with a basic transistor the gate controls whether electrons can flow through the channel normally the channel doesn't allow electrons to flow through it in other words the channel is normally off electrons are there it's just that they can't flow however when a voltage is applied to the gate an electric field is emitted from the gate which turns the channel on and thus allows electrons to flow through the channel the minimum voltage required to turn on the channel is called the threshold voltage which is a key term that will get used a lot in this episode understanding this concept is important so to repeat when reading information from a memory cell if the gate voltage is below the threshold the channel is off and electrons can't flow through the channel but when the gate voltage is above the threshold the channel is on and electrons can flow through it what we've covered are some transistor basics which makes sense as this charge trap flash memory cell evolved from a floating gate transistor and transistors in general now let's put the charge strap back into the middle to turn the transistor into a memory cell when we place electrons or charges onto the charge trap located between the channel and the gate and when a voltage just above the threshold voltage is applied to the gate the electrons in the charge trap disrupt the electric field emitted from the voltage on the gate and the channel is prevented from turning on in other words the charge is stored in the charge trap inhibit the gate's ability to turn the channel on in order to overpower the inhibiting electric field caused by the electrons on the charge trap a stronger voltage on the gate is required in essence the electrons in the charge trap shift the threshold voltage of the memory cell by using the difference in threshold voltages between a charge trap with stored electrons and a charge drop without stored electrons we can store and read different values if you're confused don't worry we'll explain this concept further but for now let's quickly recap applying a voltage to the gate that is greater than the threshold voltage causes the channel to turn on thus allowing electrons to flow through it if the applied voltage is less than the threshold then the channel is off and the presence of more or fewer electrons in the charge trap can shift this threshold voltage now let's demonstrate how we use this phenomenon to store information inside each memory cell to do that let's bring back the other parts of the charge trap flash memory cell and duplicate it so that we have two memory cells the one on the left has no electrons in its charge trap and the one on the right has a lot of electrons when a small voltage is applied to both only the channel on the left the memory cell with no electrons on its charge trap turns on this is because the electrons on the charge trap of the right memory cell inhibit the gate's ability to turn the channel on next a higher voltage is applied to both gates and thus the electric field on the right memory cell's gate becomes strong enough to overcome the inhibiting effect of the electrons on the charge trap and its channel turns on as a result of the two memory cells turning on at different gate voltages we can conclude that the two memory cells have different threshold voltages and thus have different numbers of electrons stored in the charge trap when a charge trap turns on at a small voltage it holds no extra electrons in its charge trap and we designate this low level of stored charge as a binary one when the charge trap turns on at a higher voltage it means there are a lot of electrons in the charge trap and the binary values stored is a zero details of this inverted assignment are mentioned in the creator's comments let's take a short break and briefly talk about this enterprise class solid state drive from kioxia here's a consumer class ssd and here's an enterprise class ssd they look similar from the outside but are entirely different on the inside keoxia provides these leading quality enterprise class pcie nvme solid-state drives and they can fit in the same space but have capacities up to a whopping 30 terabytes and use a proprietary architecture built with their own controller firmware and bics flash 3d tlc memory in order to deliver incredibly high sustained read and write performance and reliability by the way tlc in this context stands for triple level cell and is the marketing term which means three bits of information can be stored in each cell and now you might be getting an idea as to how we can store three bits of information and solve our puzzle in order to store eight different values or three bits of information eight potential different levels of electrons need to be placed onto the charge strap resulting in eight different possible threshold voltages the level of charge on an individual trap is determined by a sequence of increasing voltages applied to the gate and then correlating the specific level of voltage at which the channel turned on with the associated memory cell when a set of memory cells are all next to each other this group is called a page and the same voltage is applied to a gate that is shared by every memory cell in the page let's cover up the level of charges in the charge trap as if we didn't know the stored value the voltage applied to the shared gate starts small and we check each and every channel to see if electrons can flow through and well this memory cell's channel has electrons flowing through it and therefore it's on that means there are no extra electrons on the charge strap and a 1 1 1 value is stored there next we step up the voltage on the shared gate and check if any other channels have turned on and we see that this channel is now on so that means that it has a slightly higher threshold voltage or just a few electrons on the charge trap and the stored value is one one zero we continue stepping up the voltage and correlate at which voltage each channel turns on and that gives us the corresponding threshold voltage which directly relates to the level of stored charges on each memory cell's charge trap and the stored binary value in each cell this process happens incredibly fast in order to read information from millions of cells and read the megabytes of data your smartphone goes through this voltage stepping up cycles thousands of times every second fortunately the memory cells are organized in pages and every cell in a page shares a common control gate and thus all information from an entire page is read simultaneously and now our puzzle is all pieced together however there's another puzzle how do we add electrons to a charge trap in other words how do we write to a memory cell the solution involves materials that are around 75 to 100 atoms thick as well as quantum mechanics so that topic is covered in a separate episode that you can find here this episode is part of a series of episodes that explore solid state drives 3d nand and how we save information on smartphones tablets or pretty much any device in this day and age if you want you can watch this video a second time and if you do we recommend you check out the creators comments in the english canada subtitles wherein we include details on dimensions exact threshold voltages and other stuff thanks again to keoxia for sponsoring this video additionally we'd like to thank our youtube membership supporters and patreon supporters for helping in our goal of exploring complex engineering concepts if you want to help this channel comment below like this video and subscribe thanks for watching and don't forget to consider the conceptual simplicity yet structural complexity in the world around you

---

## 28. How do Video Game Controllers Work?  || Exploring a PS4 Game Controller
**Channel:** Branch Education | **Views:** 478K | **Date:** 5 years ago | **Duration:** 9:15 | **ID:** vQesgAtr2e4
**Link:** https://youtube.com/watch?v=vQesgAtr2e4

### Transcript:
Exploring Video Game Controllers.  By:  Branch Education / Teddy Tablante Exploring the Playstation 4 [PS4] Dualshock Video Game Controller.  Similar to Playstation 5 [PS5] Dualsense Controller. Also, similar to the Nintendo Switch Joy Con, and the Xbox One and Xbox Series X Video game Controller. Video game controllers are precision devices that give us access to competitive battlefields, uncharted worlds, and epic storylines, and this here is one of their most critical components. But where is this circular metal object located, and what does it do? In this episode, we're going to open a PlayStation 4 DualShock video game controller to see how it works. First, we’ll go through the components and then we’ll see how the buttons and analog sticks work, and in the process, we’ll learn where this delicate metal disc is located, and why it's critical in almost all of the console video games you play. This episode is kind-of a mystery game, so if you figure out where it’s located and what it does before I reveal the answer, congratulations, and comment below with the timestamp of when you figured it out.  So, let’s get started. After removing a few screws, we can take off the plastic outer housing and see all the components inside. On top, is the D-pad, the triggers, and several other buttons. Below each button are conductive rubber button gaskets, and below that is the flexible plastic contact board that the conductive rubber presses against. At the center of the controller is a  touchpad, along with a small speaker. Next is the mid-frame and below that, the primary printed circuit board or PCB. On the top side of the circuit board are a number of components such as the microcontroller unit which are the brains of the controller, a pair of analog joysticks, the wireless communication microchip, an antenna, a headphone jack, an additional E.X.T. port for seldom used applications, and a set of push buttons.  On the bottom of the PCB are a set of connectors for flat cables to be plugged into, an audio codec microchip, and an accelerometer and gyroscope microchip. below the PCB is the battery case and the rechargeable lithium ion battery. Next, attached to both sides of the mid-frame are motors with off-balance weights that, when spun up, cause the controller to vibrate. Finally, attached to the back plastic housing, we have an additional printed circuit board, or daughter-board that holds the microUSB port, and a multicolor LED with a set of plastic pieces that guide and disperse the light in order to illuminate the controller’s triangular light. That’s pretty much it for the components. Have you figured out where this metal disk is located? If you haven’t, here’s a hint: there are 4 of them in every controller. Let’s move on and see how the buttons work. For each button on this PlayStation 4 controller, there are 3 parts.  The plastic front face, the rubber button gasket with a conductive bottom, and the flexible plastic contact board. On the contact board are a set of intricate wires or traces protected by insulating plastic, similar to the wires that run through the printed circuit board. Below each button is a gap in the wire that breaks the path of electricity. When a button is pressed, the conductive pad on the bottom of the rubber button gasket presses against the contact board, and the gap is bridged, thereby closing the circuit, and allowing electricity to run through the traces. When you let your finger off the button, the shape and design of the rubber gasket pulls the conductive bridge away from the gap, and the circuit is broken. It may look complicated, but it’s a simple circuit that just gets completed It may look complicated, but it’s a simple circuit that just gets completed or closed when you press a button and becomes incomplete or opens when the button lifts up. Other push buttons use similar setups, but with different materials and constructions. This concept applies to all the buttons except the L2 and R2 triggers. Instead of having a gap that gets bridged, these two buttons use  pressure sensitive resistors. When the L2 or R2 trigger is pressed, 
the rubber button gasket applies a force to the pressure sensitive resistor and the change in resistance is measured by the microcontroller. Details on how this works are included in the Creator’s Comments. Let’s move on and explore the analog sticks. These analog sticks are solder-mounted to the printed circuit board, and each one has almost a dozen different parts inside. On top we have the rubber thumb pad and the plastic joystick shaft below it. Next, we have a metal housing that limits the movement of the joystick. Inside the metal housing are a pair of plastic brackets that are perpendicular to one another called followers. The function of these following brackets is to change the up down left and right movements of the analog stick into a small rotation over here. Each of these brackets is attached to a potentiometer whose function in this application is to measure rotation. If you push the analog stick to the bottom right, these two brackets will rotate, which in turn will rotate the center of these two potentiometers. Let’s open one of the potentiometers 
to see how it works Voila! Inside we find that small metal piece we’ve been talking about and it’s called a wiper. On this side we have a plastic housing which contains electrically resistive material printed in a set of two circles on the inside called a track. The key concept is that electrical resistance is proportional to the length of the resistive material, so if we are able to vary the length of the electrically resistive material, we can vary the overall resistance, which the microcontroller can easily measure. So, when we rotate the wiper, the position where the wiper contacts the track changes, and thus changes the effective length of the resistive material that electricity flows through. Let’s follow the path of electricity. We can see that this metal disk, or wiper, is rotated by the following bracket.  The wiper contacts the track in different locations than before, thus changing the distance along which the electricity passes through the resistive track, thereby changing the overall resistance. The wiper is specially designed so that the metal is bent to continuously press against the track at an exact set of locations. This allows for precise measurement of movements of the joystick, which is critical for any eSports or similar video game. Furthermore, we can see that for clockwise and counterclockwise rotation of the potentiometer we use a set of three terminals. One connects to the wiper, and the other two connect to each side of the track for measuring left and right or up and down motions. There are similar setups in each of the 4 potentiometers. In addition, below the analog stick is a small assembly that presses on a push button when the analog stick is pressed in.  Finally, there is a spring that returns the analog stick to the center of the metal bracket and returns the analog stick to its un-pressed state. That wraps this episode up! By the way, this type of construction is similar to other video game controllers, however of course there is considerable variation in layout and design. Thanks for watching!  Comment below with any questions or thoughts you may have. Furthermore, we added the creator’s comments to the English Canadian subtitles, if you’re curious for more details, along with an additional puzzle, we recommend you check it out. Additionally, if you want to explore and use these 3D models of a video game controller you can purchase them on Blender Market using the link in the description. We’d like to thank our Patreon Supporters and YouTube Membership Supporters for helping in our goal of exploring complex engineering concepts! If you want to help this channel, subscribe, like this video and share it 
with others. Thanks for watching, and remember to consider the conceptual simplicity, yet structural complexity in the world around you!

---

## 29. The Engineering Puzzle of Storing Trillions of Bits in your Smartphone / SSD using Quantum Mechanics
**Channel:** Branch Education | **Views:** 698K | **Date:** 5 years ago | **Duration:** 7:35 | **ID:** 5f2xOxRGKqk
**Link:** https://youtube.com/watch?v=5f2xOxRGKqk

### Transcript:
in your smartphone there are millions of memory cells that store all your phone's data and in each memory cell there's a structure whose dimensions are only around 75 to 100 atoms wide if this structure were thicker or thinner the memory cells wouldn't work and in this episode we'll explore why it's only around seventy-five to a hundred atoms thick and how quantum mechanics is involved but before we get there let's move on to familiar ground here's a smartphone and whenever you take a picture receive a message or download an app it saves that data into this grey rectangular and overall rather boring looking microchip but this memory storage microchip is far from mundane because the level of technology inside it will astound you to begin let's open this microchip and investigate first we see that this one component holds a stack of eight Chiclets let's zoom in further to a nanoscopic view of one of these chip le'ts and in it we find a massive array of memory cells stacked 100 layers tall by 40,000 columns wide and 50,000 rows down these memory cells are called charge trap flash and each memory cell contains a charge trap in which different levels of electrons are used to store 3 bits of information but here's the issue how do scientists and engineers design billions of nanoscopic memory cells that can reliably trap electrons for years on end this is crucial because if the electrons are not properly trapped your saved pictures and files would become corrupt and you would lose entire sections of data to solve this and prevent electrons from leaking out scientists and engineers surrounded the charge trap with dielectric materials which are non conductive insulators that stop electrons from passing through you can think of this charge trap is a valley and the insulating dielectric as the walls of the valley and when electrons are moved onto the charge trap they become trapped in the valley with no way out and they can stay there for years on end this is the basic idea of how your smartphone stores its information however this setup poses a new issue you see the channel where the electrons come from is over here on the other side of the dielectric barrier in a valley of its own now we have two valleys with a rather high barrier in the middle electrons can now comfortably stay in one Valley or the other but here's the problem how do we move the electrons we want from the channel across the dielectric and into the charge trap valley or in other words how do we write information to a memory cell well that's where quantum mechanics comes into play in classical mechanics this electron is a localized point charge with an energy level the dielectric is an electrical insulator and the minimum energy level required for electrons to get over the barrier is so high that doing so would take a lot of energy which would damage the barrier itself and thus the electron can't pass over the dielectric however in quantum mechanics the electrons location is not a point but rather it's a probability density or a cloud that depicts where the electron is most likely to be found when we apply a positive voltage on the gate over here the positive electric field attracts the negatively charged electrons probability cloud from the channel and pulls it towards the charge trap Valley if the dielectric barrier is thin enough and the pull from the positive voltage on the gate is strong enough then the electrons probability cloud is pulled far enough across the dielectric barrier so that there becomes a sizeable probability that the electron will find itself on the other side of the dielectric barrier and into the charge trap this phenomenon is called quantum tunneling since it can be imagined that the electron tunnels through the barrier instead of going over it and every time you take a picture your smartphone uses this phenomenon to write information to the charge trap flash memory cells scientists and engineers use a set of quantum mechanical equations developed by Ralph Fowler and Lothar norheim in the 1920s for figuring out exactly how thin the dielectric barrier should be and how strong the gate voltage should be in order to tunnel electrons from the channel across the dielectric and into the charge trap in fact perhaps the most impressive detail is how thin the dielectric barrier is these are some of the smallest things humans have ever mass-manufactured and as you see the dimensions shown here are in nanometers if we were to zoom in on the dielectric we find that it's only 75 to 100 atoms thick the dielectric walls can't be thicker because if they were the required voltage would be considerably higher and the extra voltage would cause damage to the memory cells and if the walls were thinner there would be a higher chance that the electrons would leak out it's amazing that these structures are found in billions of identical charge trap flash memory cells in your smartphone and in every smartphone in the world of course to save a picture onto your phone you don't have to understand quantum mechanics but it's interesting to know that it's happening one quick note before we wrap up these charge traps do in fact lose their charge over time it takes about a decade of inactivity before files may potentially become corrupt also these memory cells have a limited number of write and erase cycles a good rule of thumb is that you should always back up your important files into multiple locations and that's it this episode is a part of a series of episodes detailing how solid-state drives and 3d NAND or v-nand memory cells work if you're curious take a look you can also watch this video a second time and read through the creator's comments in the English Canadian subtitles in there we added additional notes and details such as exact values materials terminology caveats and much more we'd also like to thank our patreon sponsors and our YouTube membership sponsors thanks for watching and remember to consider the conceptual simplicity he had structural complexity in the world around you

---

## 30. How do SSDs Work?  How to fit 3 WEEKS of TV in a microchip the size of a dime!!  Explained in 3min.
**Channel:** Branch Education | **Views:** 440K | **Date:** 5 years ago | **Duration:** 2:54 | **ID:** E7Up7VuFd8A
**Link:** https://youtube.com/watch?v=E7Up7VuFd8A

### Transcript:
3 minute overview on How SSDs work  By.  Branch Education Most smartphones can store 128 gigabytes, and this solid-state drive can store 1 terabyte of data, and it all happens inside this microchip, right here. If this 1 terabyte solid state drive were full of movies and TV shows, it would take about 3 weeks of non-stop binging to watch them all. So how can this incredibly small microchip fit such an insane amount of content? To understand that, we gotta zoom in to a nanoscopic view of its insides. In here we can see an individual memory cell called charge trap flash. This memory cell stores 3 bits of information by trapping different levels of electrons on a charge trap. Very few extra electrons are a 1-1-1 while a lot of electrons are a 0-0-0 and the other levels of trapped electrons have other 3-bit designations.  Measuring this value doesn’t change the amount of electrons and once electrons are placed on the charge trap, they stay trapped there for years. However, when the memory cell is erased the electrons are forcibly removed. To reach a terabyte of storage capacity in a single chip, this memory cell is copied, and it is copied a lot. First, these memory cells are stacked 100 layers tall, and then these stacks of cells are copied 40,000 columns across, which is then copied 50,000 rows down. You can kind of think of it as a 3D excel spreadsheet where the values can only be 0 to 7, and this spreadsheet has 40,000 columns by 50,000 rows, and then there are 100 different spreadsheets stacked in layers one on top of another. In order to isolate and determine which row and layer to write to or read from, control gate selectors are used along layers and bitline selectors are used along the rows. We're going to zoom out to the view that we had earlier where we can see the overall microchip. Here's the 3D array of charge trap flash cells and control gates that we were just looking at. This is a massive layout of memory cells but, engineers didn’t stop there. In order to fit more capacity, they copied this layout onto the other side and then copied it 8 times again, and crammed it all into a single microchip. And that’s it – 3 weeks of non-stop binging movies and TV squeezed into a microchip the size of a dime. Watch our follow up episode to get a complete  and in depth understanding as to how everything that I just talked about works.  Thanks!

---

## 31. How do SSDs Work? | How does your Smartphone store data? |  Insanely Complex Nanoscopic Structures!
**Channel:** Branch Education | **Views:** 6.3M | **Date:** 5 years ago | **Duration:** 17:55 | **ID:** 5Mh3o886qpg
**Link:** https://youtube.com/watch?v=5Mh3o886qpg

### Transcript:
How do Smartphones Store Data?  ||  How do SSDs Work?  By Branch Education It’s hard to believe that all your photos, videos, music, messages, and apps can be stored in the palm of your hand, and to most of us it’s a mystery how so much information can fit in such a small space. But it might not seem so surprising when you see the complexity inside your smartphone, or the inside of this one terabyte solid state drive commonly found in laptops or computers. However as seeing the outside of this memory storage microchip tells us little about how these smartphones and solid-state drives can store tens of thousands of photos and files, let’s explore deeper and zoom in until we get to a nanoscopic view, and it's here that we can see the structures called VNAND that hold all the data in your smartphone and computer. Here is where the real magic happens. Every picture, message, and bit of information gets saved as quantities of electrons inside these memory cells which are called charge trap flash and, in this episode, we'll learn how smartphone memory and solid-state drives work. Now, hold on- these insanely small and intricate structures seem very complex, and yeah- they are- I’m not going to say this marvel of engineering is simple. But you have to trust me- stick around, watch closely, maybe watch this video twice, and by the end of it, this technology will amaze you, it will blow your mind at least twice over, and yeah, you'll have a thorough understanding as to how such a small device, can store weeks of high quality video, tens of thousands of pictures, or hundreds of thousands of songs in such an itty bitty little space. So, let’s get started. We’re going to use a real-life example and explore how it works when you save a picture to your smartphone or computer. First, this picture is made up of pixels and each pixel has a color so let’s zoom in so that we can see the individual pixels. The color of every pixel is defined by a combination of 3 numbers, ranging from 0 to 255, each representing red, green, or blue. For example, the numbers would be 55-53-55 for this pixel’s color right here, and then 124-121-119 for this pixel. Each of these 3 numbers from 0 to 255 is represented by 8 bits in binary, or eight ones and zeros ya know, because computers work in binary. So, 3 colors, red, green and blue, and 8 bits each, means each pixel takes 24 bits to define its color. This picture is a grid of colored pixels, so let’s turn it into a grid of values, kind of like a spreadsheet in excel, but called an array instead of a spreadsheet. This array of bits is what your computer cares about and noncoincidentally, it’s also the information that the camera on my smartphone recorded when I took the picture. One quick note: if you want to see the pixels in any picture, just open it in an image editing program like paint or 3D paint in this case, and zoom in. And then if you want to see the red, green and blue or RGB values, just use the eye dropper, click on a pixel, and then click on the edit color option. Right here you can see the 3 values for red, green, and blue, and the resulting color. Ok, with that covered, let’s get back to this episode, first, we’re gonna zoom out to see the full picture, which is 3024 pixels wide and 4032 pixels tall, which is a total of around 12 million pixels, or, 12 megapixels- which relates to the resolution of the 12 megapixel camera on my smartphone. Next, by doing some multiplication we calculate that an array of this size, where each pixel is defined by 24 bits, or 24 0s or 1s only requires 293 million bits or a unique set of 293 million 0s or 1s. That’s a ton of bits, so let’s figure out how your smartphone or this solid-state drive seamlessly stores every single one of them. Ok: so let’s open up that solid state drive again and zoom into a simplified nanoscopic view kind of like the one we had earlier. It's here that we can see the memory cells that are used in every single one of your smartphones or tablets, as well as inside the solid-state drive in your computer. This is the basic unit of a computer’s long term memory storage and it’s called Charge Trap Flash Memory- so how does it work? Well, in each cell we can store information by placing different levels of electrons onto a charge trap, which is the key component inside the memory cell. Older technology could only store two different levels of electrons, a lot of electrons or very few electrons, which were used to store a single bit as a 1 or a 0. However, engineers have been developing 
more finely tuned capabilities for trapping and measuring different amounts of electrons or charges onto the charge trap. Most memory cells in 2020 can hold 8 different levels, but newer technology can have 16 different levels of electrons. This means that a single cell, instead of holding only one bit as a lot of electrons or no electrons, can now hold 3 or more bits but, for this example, let’s stick with 3 bits. So- in this cell, if we were to have very few electrons on it, it would be 1-1-1, while some electrons get designated as 1-0-0 and a lot of electrons are 0-0-0 There are 8 different levels for all the various amounts of electron charges that our charge trap can be set or written to. The key to the charge trap is that it is specially designed so that after it gets charged with electrons, it can hold onto those electrons for decades, which is how information is saved or written to the solid-state drive. I mean- it’s called a charge trap for a reason. It traps electrons, or charges for years on end,  and in order to read the information, the electron charge level is measured, and the amount of charge on the charge trap is unchanged. However, in order to erase the contents of a memory cell, all the electron charges are forcibly removed from the charge trap returning it to its lowest level, which is 1-1-1, and leaving no excess electron charges behind. Let’s move on and explore how these memory cells are organized so that we can store more than just 3 bits of information. After we zoom out a little, you can see that the memory cells are stacked vertically. This is where the vertical part in Vertical NAND or VNAND comes from. This stack of memory cells, what is technically called a string is composed of 10 charge trap flash cells layered one top of another. when information is written to or read from a string, only one cell can be activated at any given time, and to do that we use separate control gates attached to every layer in the string. It works like this: the bottom control gate first says “Hey you, charge trap 1 what’s your electron charge level at?” Then the bottom cell sends that information through the center of the string up to the information highway at the top, which is technically called a bitline. Then the next control gate for the 2nd layer asks for the charge level in the 2nd cell, and so on, up the string, each cell sending their information up to the highway or bitline. The same kinda sequence happens when charges are being added to a charge trap which is how information is written to a memory cell. The main thing is that only one layer in the string is either written to or read from at any given time. Let’s move on in complexity, next we duplicate this string 32 times, and this gets us a page of strings. Let’s review some terminology: this a memory cell and this is a string. And now here we have a page, and we are going to call this entire page of strings a row.  When we duplicate the string, we also duplicate the bitline 32 times, however rather than duplicate the control gates, we are going to have every cell in the same page share a common control gate. This makes it such that when information is written to or read from a row, an entire page composed of 32 adjacent cells, all in the same layer, are activated at the same time. Let’s step up in complexity again: Next, we duplicate these rows 6 times until we get a block, but we are going to do it 12 times so we can see 2 blocks. Okay, so again, here we have a column, here is a row, this is a layer.  And now here is a cell and here is a string.  Next we have a page, and finally we have a block.  We are going to connect the tops of each string in a column together, so they all share the same bitline and our bitline is looking more like a highway now. In addition, we have to add a control gate that selects between rows, so that only one row is using the bitline at a time. These are called bitline selectors. As discussed these bitlines are like highways, and the selectors at the top act as traffic lights that mediate the flow of information so that only a single row can use the highway, or is active at a time.  Similarly, the control gates attached to each layer act as traffic lights for the layers. With bitline selectors along the tops of each row, and control gate selectors along each layer, the solid state drive can read from or write to a  single page at any given time. Additionally, in order to connect to the bitline selectors and control gate selectors there are wires that drop down from above and run perpendicular to the bitlines. So, let’s quickly recap: 8 different levels of electrons are placed on charge traps in order to store 3 bits of information. These charge trap flash memory cells are stacked into strings 10 cells tall, which are duplicated into pages of 32 strings in a row. Next, those pages of strings are duplicated until we have a block 6 rows deep, and here we are showing 2 blocks. Doing some quick multiplication we find that there are 3,840 memory cells here capable of storing a total of 11,520 bits. With each pixel in our picture requiring 24 bits,  that means that we can store 480 pixels, or this much of our overall picture. That means you need about 25 thousand times the size of this layout to store the contents of this single picture. Aaand, here’s where we learn about the actual size of a memory chip. All the principles we have discussed remain the same, so keep those in mind, it’s just that the size is much more extensive than we discussed in our example. It’s hard to pin down exact numbers because manufacturers are continually improving their designs and they are very secretive regarding what their designs look like. But I’ll tell you what I know: the latest designs utilize not 10 layers as in the example, but rather somewhere around 96 to 136 layers tall. Here's a single sheet of paper so you can get a sense of the of the approximiate height of these stacks of memory cells. Now that we understand the height, lets think about the width. A page is around 30,000 to 60,000 adjacent memory cells wide. That means there are 30,000 to 60,000 bitlines in our information superhighway. Blocks are every 4 to 8 rows and there are around 4000 to 6000 blocks. Along the edges are the control gate selectors and the bitline selectors on the other side. Together, they comprise what is called a row decoder, and by using both sets of selectors as traffic lights, we're able to accesss a single page. To repeat this, only one page, 45 thousand or so cells wide, ever uses the bitline to read or write information at any given time All tens of thousands of bitlines feed down here to the page buffer where the information from a single  page is written to or read from. Let’s transition to see what an overall chip might look like. Here we have the arrays of 3D memory cells, the row decoder and the page buffer at the bottom. Additional peripheral circuitry can be found here for supporting the chip. In order to fit more capacity, engineers copied this layout onto the other side. This chip can read or write at a rate of around 500megabytes per second.  That means that it can read from or write to around 63 blocks every single second. That’s incredibly fast! Ok, let’s add the last level of complexity. Engineers like to fit even more stuff in as small of a space as possible, so on top of having a massive array of memory cells in this insanely complex layout, they decided to copy this chip 8 times. and stack it into a single microchip. At the bottom, an additional interface chip is used to coordinate between the 8 different chips. And that’s it, that’s all there is in this one microchip that can found at the center of every one of your smartphones, tablets, or solid-state drives. This video covered a lot, and I hope you kept up. You can always watch this video a second time, and if you do watch it a second time, we added our notes and commentary into the English Canada subtitles. Turn them on by clicking the settings gear over here. On the contrary the notes that are placed up here are caveats or footnotes, but the notes we placed in the English Canada subtitles include commentary, additional information, and much more. Let us know what you think of them in the comments Also, I will be making a follow up set of episodes that will branch off and explain how each part works in detail. In separate episodes we'll cover specifics as to how the charge trap flash works, how the bitline and control gate selectors work, and how these microchips are manufactured. Also, take a look at our channel page where we cover other topics such as how touchscreens work, how PCBs work, or how cameras in your smartphone work. If you have any questions or want me to add more branches relating to solid state drives, tell us in the comments below. But for now, thanks for watching. subscribe and hit the bell to get notified when we post more branch episodes on how solid-state drives work and other topics. If you learned something new, share this video with others- Tweet it, post it to your favorite discussion board, or share it on social media so others can learn how this amazing technology works. Until next time, consider the conceptual simplicity yet structural complexity in the world around you.

---

## 32. The Intricate Engineering Inside Foldable Smartphones
**Channel:** Branch Education | **Views:** 176K | **Date:** 6 years ago | **Duration:** 5:57 | **ID:** E7cInSaqJSM
**Link:** https://youtube.com/watch?v=E7cInSaqJSM

### Transcript:
here we have the Samsung Galaxy foal to enter the Motorola RAZR and these are two of the latest foldable smartphones in this video we will learn about the mechanisms and technology that make foldable smartphones possible this video will focus on the mechanisms inside the samsung galaxy fold as they've yet to model the interior elements of the Motorola RAZR but both use similar foldable screen technology as you may know the Samsung Galaxy fold had some major design flaws and there are many videos that talk about these flaws as well as how it breaks so instead in order to better understand foldable smartphones I'll show you how it was designed to work first we will explore the engineering behind the hinge and then second the technology in the layers of the flexible display and after that in order to fix some of the issues with these phones I'll give you a conceptual redesign and my take on a foldable smartphone so let's jump right in okay first let's look at the hinge it's not like a door hinge with two leaves held together by a pin but rather the hinge somewhat resembles the folding of a hardcover book as it has a spine with the left side and right side after removing the back cover of the spine you can see the internal mechanisms at the top and bottom we have the hinges that connect the spine to each side also along the spine we have a set of four latches with buttons and springs on one side and then holes on the other when this phone is fully open - the buttons click into the holes thus preventing it from folding closed without a small amount of force this feature gives the phone more rigidity and makes it feel more like a tablet when fully open next we have a pair of flat cables that allow the left and right sides to communicate with one another and finally in the middle we have a unique set of gears and a partial metal bushing or motion guide this guide helps to control the motion of the two sides and prevents any twisting from left to right finally these gears make sure that the two sides open symmetrically by that I mean when opening these two angles will remain equal like the wings of a butterfly which makes for a more aesthetically pleasing opening and closing feel moving on to the foldable screen and here are a variety of layers on top is a protective laminate then clear capacitive touchscreen wires and then an AMOLED display I made a video that goes into exactly how the main layers of the touchscreen display work and you should check it out this screen is kinda similar with the key difference that the foldable AMOLED display doesn't have protective glass but rather it has a protective laminate on top which is significantly softer than glass but it does allow the phone to bend the other key difference is that while the AMOLED display is manufactured on top of a thin flexible metallic foil behind the foil is a layer of plastic and foam and behind that is a solid metal layer with an accordion like hinge along the fold this is called a living hinge and it allows for bending along the center of the display this smartphone has some rather innovative elements but it needed a lot more rigorous durability testing and a few more redesigns during prototyping which I'm sure was cut short due to the rush to be first to market so let's move on here's my conceptual redesign ends take on a foldable smartphone first I would separate the two screens into a primary and a secondary screen and use a cylindrical hollow hinge with wires running through the inside this hinge is similar to those used on the Nintendo DS a wide variety of laptops and flip phones and it would be sealable from dirt dust and possibly water although the primary and secondary screens would be separated there would be a lot of opportunity to develop apps to utilize both halves and to separate screens would be more conducive to multitasking the primary side of the phone would act as a normal smartphone and the secondary side would be composed of several transparent layers these transparent layers would be as follows toughened glass a capacitive touchscreen in AMOLED display a layer of polymer dispersed liquid crystal a layer of aluminum oxynitride and then another touchscreen and toughened glass you know what these layers do but this one the polymer dispersed liquid crystal is an electrically controlled clear or opaque glass this material is used to turn conference room glass windows from clear to opaque then this layer the aluminum oxynitride also called a LAN or transparent aluminum will provide strength and structural rigidity as it is the same material that is used as bulletproof glass on armored vehicles so now that we understand the layers let's go through some functionality when the smartphone is closed and the secondary screen is folded on top of the primary screen the secondary screen will be fully transparent the touch screen on the back of the secondary screen will operate the primary screen and then the phone will operate like a normal smartphone when the secondary screen is flipped open the middle layer of polymer dispersed liquid crystal will turn it opaque and the secondary screen will function as an additional touch screen display what are your thoughts on this concept of a foldable smartphone tell me in the comments below that wraps it up for this episode I'd like to thank Jack from the channel jerry-rigged everything for providing me with images that were a big help in modeling this phone his channel was one of the inspirations for my channel and in it he does reviews durability tests and tear downs for a wide variety of smartphones and tech this episode branches to prototyping durability testing and touchscreen displays thanks for watching until next time consider the conceptual simplicity yet structural complexity in the world around us

---

## 33. What does a Star Wars battle actually sound like?
**Channel:** Branch Education | **Views:** 128K | **Date:** 6 years ago | **Duration:** 3:47 | **ID:** T_bLVAqLZMY
**Link:** https://youtube.com/watch?v=T_bLVAqLZMY

### Transcript:
What do Star Wars space battles actually sound like using accurate physics?  By: Branch Education This is what a Star Wars battle in outer space would sound like if it used accurate physics and it might surprise you that it’s not silent. But- before you start commenting about how I got it all wrong, let’s rewind and explain why sound can travel through the vacuum of space… sometimes. [Rewinding Sound] that sound cannot travel through space or a vacuum, they're mostly correct, but not 100% correct,it’s more like 85% give or take. So, to explain that other 15% of how sound can travel through a vacuum, let’s use an example. Here we have an alarm clock, a speaker, and a balloon and they are all placed in a vacuum. When the alarm clock’s bells ring, or we play music on the speaker, there is no sound. Both the bells and the speaker vibrate, and this vibration moves air particles, which creates sequences of high pressure and low-pressure zones in the air called sound waves. Thus, with no air or medium for sound to travel through neither the speaker nor the bells make sound. So, now let’s look at the inflated balloon. This balloon will, in fact, generate sound when popped in a vacuum. Let's zoom in on the edge of the balloon. Gas particles are bouncing around inside the inflated balloon and there’s a vacuum outside. When we pop the balloon, the gas rushes out into the vacuum in all directions resulting in a spherical propagation of gas particles with a rather high velocity, of around 500 meters per second. If we have a microphone nearby, these particles will hit the microphone causing it to vibrate and record a sound. In a way, the balloon provides its own medium or particles for transmitting sound through the vacuum. So, let’s get back to this Star Wars battle in outer space. When you’re flying around in the Millennium Falcon, and you dodge a laser, you shouldn’t hear a sound, but when you successfully hit a tie fighter and it explodes, you will hear a sound.  This is because that tie fighter had a good amount of air and fuel onboard and when it exploded all of it was released into the vacuum of space along with a smattering of debris. All that matter rushed out at a rather high velocity kinda like when we popped the balloon This results in your ship getting hit with a barrage of high-speed atoms, molecules and debris and the force from this barrage of stuff on the outside of your ship, generates sound on the inside. The number and force of the particles hitting your ship, and therefore the loudness of the explosion, changes drastically with your distance from the explosion and the amount of energy and mass released from the explosion. But, if you’re too close to the explosion and your deflector shields are damaged, then there’s is a good chance a piece of high velocity shrapnel might just tear a hole in your ship and you’ll have a lot more to worry about than whether there is or isn’t sound in space. So now we’re back to this clip of what a Star Wars battle in outer space would sound like if it reflected accurate physics. By the way, these sounds are as if we placed the microphone in outer space. If the microphone were in the Millennium Falcon, you would also hear the engine, radio communications, and other internal noises. I made a video that goes into more detail as to what sound is and you should take a look at it. If you still have doubts that explosions or popping a balloon in a vacuum make sound, check out Cody’s lab where he tested this out.  A link is in the description. Hit that like button and consider subscribing! Thanks for watching!

---

## 34. What are PCBs? || How do PCBs Work?
**Channel:** Branch Education | **Views:** 1.4M | **Date:** 6 years ago | **Duration:** 10:27 | **ID:** Z2LgmIGE2nI
**Link:** https://youtube.com/watch?v=Z2LgmIGE2nI

### Transcript:
How do PCBs Work?  By:  Branch Education That smartphone your holding has over 110 meters, or about 360 feet of wires inside of it. That’s what it takes to combine a camera, speaker, display, wifi, antenna, GPS, battery, fingerprint sensors, dozens of microchips, and many more components, 
into a single device and have all the components work seamlessly together. There is one football fields length of wire that fit rather comfortably in that smartphone of yours.  But wait, where are all of these wires? Enter the printed circuit board or PCB. You’ve probably seen a circuit board like this one and it might have been green- not blue but, what you may not know is this circuit board is really a multilayered labyrinth of hundreds of copper wires. This PCB provides structure and organization for all the components to be mounted on the surface, while wires in the middle allow each of the components to communicate and work together. So, then what’s inside the printed circuit board and how does it work? First, let’s establish the difference between components such as the microchips, resistors, capacitors, connectors, and the printed circuit board itself.  These are the components, and they are solder mounted, or attached to the PCB.  The term motherboard refers to a printed circuit board with the components mounted to it, whereas a PCB is just the flat board without anything on it.  Certain components like the display and camera are not mounted directly to the PCB, but rather they are attached to the PCB through a set of mating connectors and a flat cable. This is an X-Ray picture I had taken of this PCB. The dark areas are the conductive wires or traces and there are a lot of them, The dark areas are the conductive wires or traces and there are a lot of them,
and the rest of the material is a non-conductive insulator. and the rest of the material is a non-conductive insulator. made of a woven fiberglass with an epoxy resin binder called FR4. In this x-ray image you can see multiple layers of wires, all on top of each other, but they are not actually touching. Okay, let’s move on.  Here is the main microchip in the smartphone. It’s called the System on a Chip or SoC for short and it’s mounted onto the PCB on a grid of connection points or pads called a ball grid array, thereby connecting the brain of the smartphone to the wires or traces, that run through the PCB. There are many other pads on the PCB for the other microchips, such as the memory chip and wireless chip, as well as resistors, capacitors and other components. Let's focus on a small set of wires These 15 traces connect the SoC to the 16 megapixel back camera, whereas these 10 traces connect the SoC to the 5 megapixel front camera.  The higher number of traces allows for more data to be sent.  Note that each of these traces is electrically separate and cannot touch any other trace.  Here we have these 32 wires that are routed along the edge of the printed circuit board and connected to a flat cable that goes to the touchscreen display. All these tiny signal wires must be routed through the PCB and fit within a width of less than 1 millimeter. In summary, the PCB or Printed Circuit Board allows each of the components to communicate with the System on a Chip or SoC and other microchips via hundreds of wires and rather precise organization. So then, what is the Printed Circuit Board made of? Well, this smartphone’s PCB is actually built of 10 conductive layers. Let’s go through them quickly.  The top and bottom layers are used for mounting components and acting as multiple antennae.  Also, each of these components on the circuit board needs power and ground and the PCB has entire layers that are dedicated to just that and are aptly named the power planes and the ground planes.  Additional ground planes are also used as electromagnetic shielding and heat dissipation. The remaining 4 middle layers are used to carry all the communication traces or signal wires.   Each of the conductive layers is composed of copper, and between each of the layers is an insulating fiberglass and epoxy resin that prevents the flow of electricity.
This PCB has 10 conductive layers, however in other applications, they can have anywhere from 2 to 50 or more layers!   But most PCBs stay around 2 to 10. Additionally, on the top and bottom is a coat of colored solder mask, which provides electrical insulation while keeping the mounting pads for the components accessible.  And on top of that, is silkscreen, which is just ink used for markings and letters that tell where components are placed. Let's jump out of animation. Hi, I'm Teddy, and I’m the creator behind Branch Education. Let’s take a short break from all this technical jargon and slow down and chat. I think it’s truly amazing that 50 years ago computers took up entire rooms and looked like this, and now, after decades of really hard engineering and development, we have something this light, small, thousands of times more powerful, and everyone has one of these in their pocket! Our world is amazing! but these innovations were only made possible because of the hundreds of thousands of scientists, mathematicians, and engineers that studied hard and then worked even harder to discover, and design transistors, microchips and PCBs, while shrinking the size of each one of these by factors of multiple thousands. So, here’s my pitch:  If you want a future full of even more amazing innovations, then you should take it onto yourself and a pursue a career in science, technology, math, or engineering! But, if you can't do that, another way you help is by liking and then sharing this video, and maybe it will inspire some student out there to pursue a science, technology, engineering, or mathematics career themselves, and then they will work towards a future of amazing innovations. Hit this like button here, and then this one here and share this video with others. Thanks for watching and helping out! Ok, now let’s get back to the PCB and the thousnds of microscopic wires inside of it. So where were we: ok.  with 10 separate conductive copper layers and insulating material between each layer, how do signals travel from one layer to another? Well, vias or vertical interconnect accesses perform this function. You can see them in the x-rays here. Vias are drilled and metal plated holes that connect two or more layers. There are three types of vias: through vias are holes that go from the top to the bottom layer. Blind vias connect either the top or bottom layer to a middle layer, and buried vias connect internal layers to one another. Because vias can pass through multiple layers, when they pass through a layer that they don't want to connect to, the copper is removed from around the via on that layer. Let’s take another look at an X-Ray of a very small portion of this PCB, and then let’s zoom in even further on this X-Ray. Here are the pads on topside of the PCB for mounting components, and on the inside you can see a set of wires running this direction, and then another set of wires running perpendicular to that direction on a separate layer, and a third set of wires at an angle, while vias go between each layer. Here's a dime so that you can get a sense of scale for the size of these wires. These intricate wires found inside the PCB at the center of your Smarpthone are just mind blowing. Okay, let’s move on, each model of smartphone is different in shape and specifications, and thus each has a different Printed Circuit Board, which engineers carefully design. For example, some smartphones separate the top and bottom PCBs, with the bigger one called the motherboard and the smaller, the daughter board. Or, for another example, some newer smartphones stack PCBs on top of one another in order to fit more space for a larger battery and more cameras.  Another important detail is that this PCB is light and small- it weighs just shy of a tablespoon of water, and well, it fits inside your smartphone. Engineers have been continuously innovating; making microchips, resistors, capacitors, inductors, and connectors as small as possible- some of these components are smaller than a flea. Older designs of PCBs used components that took up much more space both on the board, and through the board. Due to their mounting mechanism as a leg going through a hole these older designs were called through hole components. However, these components here are all surface mount devices or SMD and engineers are continuously developing smaller and lighter solutions. I’m telling you- one of you will the engineer to design the next generation of electronics. So let’s summarize and wrap this episode up: Printed Circuit Boards are integral in all electronics. and they come in a whole variety of shapes and designs. They provide structure, nice neat, organized homes for all the components, and they also connect the components using a vast labyrinth of over 100 meters of wires in a connect the dots like fashion. That's about it for this episode.  Thank you for watching! Consider subscribing, and if you learned something new, make sure to hit that like button, but more importantly share this video with others and hopefully it will reach the student or more likely a group of students who will invent the next breakthrough technology in electronics! This episode branches to PCB Manufacturing, PCB Design, And all the components that get mounted onto the PCB Such as the System on a Chip and the solid state drive. Ask questions in the comments, and until next time consider the conceptual simplicity yet structural complexity in the world around us.

---

## 35. How Do Trees Extract CO2?
**Channel:** Branch Education | **Views:** 129K | **Date:** 6 years ago | **Duration:** 3:25 | **ID:** o2Sq373iVds
**Link:** https://youtube.com/watch?v=o2Sq373iVds

### Transcript:
#TeamTrees has a goal of planting 20 million trees to help fight climate change. But that begs the question, of  “How do trees actually fight climate change?” So, let’s explore this question. As you may know, the main contributor to climate change is the historically high level of Carbon Dioxide or CO2 in the atmosphere which is a result of burning fossil fuels. To fight climate change, there are two key efforts. The first is to reduce the quantity of fossil fuels burnt, and the second is to find ways to take the CO2 already released in the atmosphere and store or sequester it. Now… if only there were a way, for maybe a machine or maybe an organism that could take in CO2 and store it. Well, that’s where planting trees comes into play. When you look at a massive 80 ft tree, what you’re really looking at is a massive structure that is mostly just carbon, oxygen and hydrogen.  Let’s take a look at the trunk of this tree. Aside from water, a lot of the mass inside the trunk is composed of cellulose which is made of long chains of carbon, oxygen and hydrogen. All of these atoms circled here are carbon, and every single one of these atoms of carbon was once CO2 in the atmosphere. As a tree grows from a small sapling into a massive tree, it’s fighting climate change by removing tons of CO2 in the atmosphere, and then using it as a key building block in every single one of it cells. So then, the next question is how does a tree actually accomplish  the extraction of CO2 from the atmosphere in order to grow? Well, the super short explanation is photosynthesis.   The leaves of the tree combine CO2 with both water  pulled up from the roots and energy from the sunlight and then turn them into glucose and oxygen as a byproduct. This glucose is then transported throughout the tree  and used as energy and also for providing the molecular  building blocks which grow more leaves,  branches, rings around the tree trunk, and deeper roots.   Here on the left we have CO2 in the atmosphere and water from the roots.  In the middle we have glucose,  and then on the right we have cellulose which is found in every single one of plant’s cells.   This process of turning CO2,  water and the energy from the sun into glucose and oxygen, and then turning glucose into cellulose  and growing larger and larger until it is a massive tree
is what trees do best.   And you can see how all of these carbon atoms in every plant cell of the tree  once came from the CO2 in the atmosphere.   So then, if we want to remove CO2 from the atmosphere  to help curb climate change, and knowing that every tree is just a massive structure created from CO2, light and water,  a key solution is to plant millions of trees. And that’s where you come into play.   Team Trees is asking you to contribute to the Arbor Day foundation  to help plant 20 million trees by 2020.   1 dollar will plant 1 tree so every donation helps.   Take a look at the link below and join the effort!

---

## 36. How do Steam Engines Work?
**Channel:** Branch Education | **Views:** 834K | **Date:** 6 years ago | **Duration:** 9:36 | **ID:** xnClSss50pI
**Link:** https://youtube.com/watch?v=xnClSss50pI

### Transcript:
It's crazy to think that the little wisps of steam rising from your morning coffee can be used to move this massive locomotive. But, a couple hundred years ago engineers developed the technology to extract energy from fire and use that energy with water and steam to move this huge machine. In the previous video we learned about how Thomas Newcomen invented the world’s first steam engine by figuring out how to use steam to create a vacuum and move a piston in order to pump water out of a well. Throughout the late 1700s, engineers such as James Watt improved Newcomen’s design, enabling it to more efficiently use a higher percentage of the energy released from fire and making it run at more cycles per minute. Watt also redesigned it so that both directions of the piston’s movement  were used to output power and do work.  Also, around this time, stronger steel and improved manufacturing and machining techniques were developed. And in 1800, the first high pressure steam engine was designed. From then on, steam engines began to find their way into steamboats, factories, and even carriages as you can see in this image from 1828. At the same time, larger and higher-pressure steam engines were designed to pull trains, and by the 1860s, this locomotive’s engine design was both shrunk down to power tractors. as well as scaled up to be strong enough to pull massive trains across Europe and the United States. To understand how steam engines were able to become small and mighty enough to drive the Industrial Revolution, we're going to examine the design of a simple steam engine from the 1860s and understand exactly how fire, water, and steam are used to create tons of force. Let’s begin by exploring this traction engine manufactured  by the English company Ransomes, Sims, and Jeffries. It was basically an early tractor used for ploughing fields, threshing wheat, powering machinery, and hauling heavy loads, and its design is essentially a smaller version of a locomotive’s steam engine. Let's take apart this traction engine and look inside. Here we have a firebox for burning coal.  The firebox heats up a sealed tank of water and a set of tubes submerged in the water carry the hot fumes from the firebox to the smokestack. At the top of this tank of water is a sealed space where the water is boiled into high pressure steam.  The steam builds up and is trapped, and the only way for the steam to escape is by travelling through a slide valve, a cylinder back through the  slide valve, and then the exhaust. As the high-pressure steam follows this path it hits the piston, which causes the piston to move which in turn moves the piston rod. The movement of the piston rod transfers motion to the flywheel causing it to rotate which in turn rotates the wheels of the tractor or whatever farm machinery may be attached. We still have high pressure on this side of the piston, but the piston has reached the end of its stroke so it can’t move any further.  So, the slide valve moves over and creates a new path for the steam to vent through the exhaust and into the open air. When the slide valve moves over it also blocks the steam from applying pressure to this side of the piston, and at the same time it opens a path for the high-pressure steam from the boiler allowing it to push on the other side of the piston. Now the piston is pushed in the opposite direction, and once it reaches the end of its stroke, or movement, the slide valve shifts back over thus completing one full cycle. Because steam is pushing on the piston in one direction and then the other, back and forth, while the opposite side is venting through the exhuast, it is called a double acting cylinder. It is this intermittent venting of the steam that causes the familiar sound of a locomotive *chug chug chug* This is the basic idea behind how traction and locomotive steam engines convert energy from fire into moving a wheel.  But you may be thinking to yourself: “A train is massive! How could this steam possibly have enough force to move an entire locomotive and dozens of cars?!” Well, to answer that question, let’s explore the concept of “high-pressure steam”. Here we have a piston that moves back and forth in a cylinder, with one side connected to a tank of boiling water and steam, while the other is open to the atmosphere. As the steam molecules bounce off the metal piston, they impart a small force. The sum of forces of all the molecules divided by the area is called pressure. This kinda seems like the Newcomen Engine in the previous episode- doesn’t it? However here, the power is generated from high pressure against the atmosphere, compared to atmosphere against a vacuum with the Newcomen Engine. So, in this engine if you increase pressure, then you’ll have more force on the piston to use during the power stroke. So how do we take regular steam from boiling water, and turn it into high-pressure steam? Prior to and throughout the Industrial Revolution, European scientists were deepening their understanding of pressure and discovered that there are essentially three ways to increase the pressure of a gas. The first way is to increase the number of molecules. Since each molecule imparts a little force on the piston, increasing the number of molecules, increases the amount of little forces on the piston and so, as the number of molecules goes up, the pressure increases. The second way is to increase the temperature. Temperature is an average measure of how fast the molecules are moving, rotating and vibrating. So, as you increase the temperature, you increase the average kinetic energy of the molecules and consequently how much force each molecule imparts when it bounces off the piston. Finally, decrease the amount of space. If molecules are closer together,  they don’t have to travel very far before bouncing into each other, changing direction and hitting the piston again. The smaller the volume of a container, the more bounces the molecules apply to the walls and piston. If we put this all together, we understand that if we decrease the volume, increase temperature and increase the number of molecules, the pressure will rise drastically reaching around 620 kilo pascals of pressure or 90 pounds of force per square inch for this traction engine.   But, what does that number even mean?  Well, for this traction engine, the piston’s diameter is about the size of a dinner plate, so with a pressure of 620 kpa, the overall force from the steam on this plate sized piston comes out to be 2,600 kilograms of force or almost 3 tons.  That’s equivalent to trying to lift the weight of about 2 cars balancing on a dinner plate, or a stack of bricks, one on top of another, 72 meters high. Now, when we get to locomotives, the pressure is even higher, more than twice the pressure of the traction engine, and the diameter of the pistons are much larger, at around 71cm or 28in, so the force across the area of the piston in a locomotive can reach up to 53,000 kilograms, or more than 58 tons of force.  That’s the weight of about 40 cars placed on a diameter the size of a car’s wheel. What’s more is that locomotives have two pistons on either side, effectively doubling the force.  That’s a lot of force! Definitely enough to move this massive train Let’s return to this image of a steam driven carriage from almost 200 years ago. I like to think about what the people riding on the top of this cutting-edge carriage were thinking. Were they imagining their society had reached the apex of human innovation? Could they have dreamed up planes or instantaneous worldwide communication? Could they have known the impact that burning coal fired steam engines would have on the global climate? Nearly 200 years later, we know that while these inventions drove our economy and enabled access to many modern conveniences and breakthroughs, the coal and other fossil fuels burned by engines during the Industrial Revolution and up to today changed our global climate and has put us at great risk. Engineers and scientists must not only consider physics, efficiency and design, but they must also consider sustainable sources of energy and the impact these inventions can have on our lives and as well as our planet. That about wraps it up!  If you haven’t already watched the first video on the Newcomen Steam Engine, take a look! Thank you for watching!  Don’t forget to subscribe, like the video, leave comments with your questions and thoughts and tell your friends and family about something you learned today.

---

## 37. What is the First Engine Ever?
**Channel:** Branch Education | **Views:** 521K | **Date:** 6 years ago | **Duration:** 9:11 | **ID:** GMgP-4O99qU
**Link:** https://youtube.com/watch?v=GMgP-4O99qU

### Transcript:
This isn’t an oil derrick, this is one of the world's first engines ever invented. This one machine is the genesis of a family tree of modern technology: airplanes, power plants, trains, cars, and even refrigerators – they all owe their invention to this innovation, the Newcomen steam engine. Thomas Newcomen, born in Devon, England in 1664, was an ironmonger and a preacher who was determined to find a way to solve the problem of flooding in the local mines. It turns out, the Newcomen steam engine is not only the direct ancestor of modern engines, but its invention in 1712 helped set the stage for the machines that powered the industrial revolution. Had this machine not been designed, the entire resulting tree of technology, our society as we know it, could have evolved differently and our world be unrecognizable. So, let’s explore this ancestor to all engines and see how it works. The Newcomen steam engine resembles an oil derrick, and that’s because it has a similar function. Oil derricks pump oil up from the ground, and the Newcomen steam engine was used to pump water out of mines. Let’s see this engine in action…  it seems slow, doesn’t it? But this was the first engine of its kind, so moving at the speed of 12 cycles a minute was rather fast. Let’s take a look!  Over here we have the steam engine, while on the opposite side is the pump that went deep into the mines. Above that is a heavy wooden beam and a fulcrum which make a seesaw like action with arch-heads and chains which transfer motion from the steam engine side to the pump side. These pump and see-saw movements were not new, but rather what was revolutionary was the steam engine, so let’s focus on that. Here we have a piston, a cylinder, a tank of boiling water with a fire underneath it, a tank of water, and a set of valves. To start the cycle, the weight of the pump side is heavier, so the piston is pulled up.  While this is happening, hot steam is filling the cylinder, and when the chamber is full, the chamber is sealed by closing these two valves. Next, the valve which connects to the water is quickly opened and a spray of water cools the steam, and then the valve shuts. This cooling causes the steam to turn from a gas back into a liquid, that is, it condenses and as a result, the amount of pressure pushing from the inside of the cylinder drops dramatically thereby creating a vacuum. With the pressure from the atmosphere above the piston and a vacuum below, the piston is pushed down and power is produced. The motion is then transferred through the balance beam and used at the pump side to move water out of the mines. This part of the cycle is named the power stroke. Now that the piston is down, the cycle resets and these two valves open. The vacuum is broken, and steam rushes back in, while the condensed liquid water exits out the side and the cycle repeats. The weight of the pump side lifts the piston while the chamber refills with steam. When the piston reaches the top, the steam and output valves close, the water valve briefly opens, and a spray of water condenses the steam back into liquid thus creating a vacuum again. The piston is pulled down, the two valves open, the vacuum breaks, steam enters, and liquid leaves out the side. Now the weight from the other side pulls the piston back up, and steam fills the cylinder. Wait wait hold on...- before we get stuck in a loop, let's pause this cycle and look closely at the cylinder of steam to better understand how it creates enough force to move this massive wooden beam and pump water. To do this we're going to zoom in so we can see the molecules bouncing around. At the bottom we have the cylinder of steam, in the middle is the piston, and above that is the air in the atmosphere. Both the steam and air particles are bouncing around and every time a molecule bounces on the piston it imparts a little bit of force.  The force of air particles bouncing over the area of the piston is called pressure, and because the atmosphere is imparting a force over that area, we call it atmospheric pressure.  So, in this step of the cycle, we have the piston at the top with the cylinder full of steam, right before the valve with the cool water spray is opened. The two pressures from the bouncing of the atmosphere’s molecules and the bouncing of the steam’s molecules equal each other. Now when water is introduced to the steam, the water cools down the steam and with that it slows down the speed of the steam molecules. As the steam slows down, eventually inter-molecular bonds begin to form between gaseous water molecules or in simpler terms, the steam turns from a gas into a liquid. This liquid then forms droplets, falls to the bottom of the cylinder and collects at the bottom. However, now you can see an imbalance of forces. The atmosphere is still pushing down on the piston, but now that the steam has condensed into a liquid, there isn't much force bouncing up from the underside of the piston. This lack of force holding up the piston, means that the piston is pushed down by the atmospheric pressure above the piston and this lack of pressure is called vacuum pressure. Tho, technically this is a partial vacuum, because the cylinder wasn’t fully empty of steam, but regardless this imbalance between atmospheric pressure and the vacuum is where the force to move the piston and pump is generated. In addition, this is why Newcomen's engine is called an atmospheric engine. It uses the atmosphere to drive it on the power stroke, and the maximum steam pressure in the cylinder never significantly surpasses atmospheric pressure. The steam engines we are familiar with use high pressure steam, sometimes hundreds of times atmospheric pressure, but in the early 1700s, vessels that could withstand high pressure were unreliable and deadly explosions were possible. Ok, let's move on, so now that we understand  the concept of creating a vacuum, let me ask you this: if I were to take 1 liter of liquid water, and boil all of it, turning it into steam, what size volume would that steam take up, considering it’s at atmospheric pressure and not compressed. Maybe it would take up 10 liters of space?  Maybe 100 liters? Well, the volume from one liter of liquid water, boiled into steam, would take up almost 1,700 liters of space. That is a crazy amount of expansion. Here’s a 2-liter bottle of water. let’s boil all of it, and without pressurizing the steam, it will fill a much larger space in fact, four large refrigerators. Now let’s reverse the process. Let’s start with a massive 425-liter cylinder of steam at atmospheric pressure, like we do with the Newcomen Engine now, let's cool it down, and the gas turns into slightly more than a cup of liquid water. You can see that from a lot of steam bouncing around, when condensed we get just a fraction of that volume in liquid water. Thomas Newcomen understood this concept and had the metal working know how to apply it in order to build this engine to pump water. This innovation was revolutionary, and it kicked off a completely new tree of technology. While the idea of metal working and boiling water with fire had been around since antiquity, and in the 16th and 17th centuries the understanding of vacuums and pistons had improved, Newcomen’s idea of combining fire, steam, pistons, and vacuums in a cyclical engine to do continuous work was groundbreaking. The Watt steam engine invented 60 years later, evolved in efficiency and became the real workhorse of the industrial revolution. But James Watt got his ideas while working on the Newcomen steam engine!  In the 1800’s evolved designs of high-pressure steam engines powered boats and locomotives, and eventually steam was replaced with the internal combustion engine. But none of those engines would exist without the founding work of Thomas Newcomen. His ability to engineer and creatively combine the technologies around him changed the world forever. Stay tuned for the next video in this two-part series where we will explore traction engines and dive into more details about how steam engines work. Thank you for watching. Don’t forget to subscribe, like the video, leave comments with your questions and thoughts And tell your friends and family about something you learned today.

---

## 38. What's Inside a Smartphone?
**Channel:** Branch Education | **Views:** 926K | **Date:** 6 years ago | **Duration:** 3:34 | **ID:** fCS8jGc3log
**Link:** https://youtube.com/watch?v=fCS8jGc3log

### Transcript:
[Music] [Music] [Music] [Music]

---

## 39. How do LEDs & Batteries Work?
**Channel:** Branch Education | **Views:** 106K | **Date:** 6 years ago | **Duration:** 10:04 | **ID:** 546rdaNv3PE
**Link:** https://youtube.com/watch?v=546rdaNv3PE

### Transcript:
How do Lemon Batteries & LEDs Work!
By: Branch Education When life gives you lemons, why not learn about electricity! in the previous episode we built a lemon battery using those lemons that life gave you, and now let's go deep under the rind and explore how this lemon battery produces electricity and then how we can use that electricity to generate light. So, let's dive right in. To start, electricity is a flow of electrons and as in any battery, this flow is caused by the interaction between two materials, one that wants to lose electrons, and one that wants to gain electrons. In the case of our lemon battery, the nails, but more specifically the protective anti-rust coating of zinc on the nails, 
wants to lose electrons. And then the acidic juices in the lemon, specifically the Hydrogen ions, or H+, wants to gain electrons.  So this chemical reaction is between the Zinc and the acidic lemon juice, and when a path is made available electrons flow out of the zinc coated nails and to the hydrogen ions in the lemon juice. As a result of this interaction the zinc dissolves off the nail and becomes a positively charged zinc ions and the hydrogen ions become hydrogen gas and leave the lemon. So, let’s see it happen. We’re gonna drop a bunch of zinc coated nails into a cup of lemon juice. Uhh- this is going to take some time, so let’s fast forward. Throughout the course of several hours, you can see hydrogen gas bubbles forming and the lemon juice turning a sickly green color as a result of the dissolved zinc. Also take a look at the line formed from the nail only being part way submerged and how the zinc has been dissolved. This is evidence of the electrons moving from zinc to the H+ ions in the acidic lemon juice. So then, now that we have a reaction between zinc and hydrogen, what help does the copper wire and pennies provide? And why would electrons take the longer path instead of just interacting with the lemon juice next to the nail? To answer this let’s rewind and zoom in. When the zinc loses its electron it becomes positively charged, falls off the nail, and dissolves into the lemon juice. This positively charged zinc repels other hydrogen ions, so the zinc ion forms a kind of traffic jam and has to move out of the way before further hydrogen ions can react with the zinc. So by adding the wire and copper pennies, we provide the electrons a secondary path to get to the hydrogen ions. It’s like having two doors, an entrance and an exit, to a busy building instead of just one. Zinc takes one path, while electrons go all the way around, along the wire, through the copper pennies, and through the lemon via a separate path. Though, let’s stop here and clear up a misconception. This animation is accurate that there is a flow of electrons, but it is wrong because in reality, the electrons travel at an unbelievably slow pace of 33 nanometers per second. It would take electrons almost a whole week to travel from the bottom of this LED up to the top. That being said, once the LED is connected, the flow of electrons along the entire path starts up near instantaneously. To say it differently, when a zinc atom loses 2 electrons, those electrons push into the next adjacent electrons and so on, thereby starting up a flow until 2 electrons on the other side join 2 hydrogen atoms as we discussed earlier. The propagation of this force from the electrons and starting up a flow of electrons happens at around the speed of light. Electrons may move unbelievably slow themselves, however the force that propagates is near instantaneous. Also, let's be real, it's not just two electrons that are passing by this cross section of wire. The number is closer to 9 quadrillion electrons per second, which is 1.4 milliAmps of current. Let's move on and explore how an LED uses electricity to produce light, and why we have to use 3 lemons batteries in series instead of just one. We’re going to have to use an analogy to help with this explanation as it’s a little complex. Let's imagine in an LED there is a road. And electrons are balls moving along the road. In an LED this road is composed of two special materials next to each other, named N and P, and they form a one-way road. Electrons can only move in this direction. Additionally, this road is not flat, but rather P is uphill from N and thus, the electrons don’t move from N to P, at least without extra energy, ya know, because it’s uphill. So, to fix this let’s give some energy to the electrons. This energy comes from the zinc pushing away the electrons, and the hydrogen wanting the electrons. In our analogy, let’s represent this energy by the height of the electron. Technically this height is called electrical potential energy, or voltage, but let’s stick with the analogy. With the energy from the chemical reaction between the nails and lemon, we raise the height of the electron, and it can then move along the one-way road from N to P- easy enough- right? Well… no… one issue is that N is a special material as we mentioned, and with that it has special properties. Specifically, it can only allow its electrons to be certain heights, and nowhere in between. That means we can't just raise the electron’s height up a little, no- the special material doesn't allow that. It’s like an elevator- you can only stop at floor 1 or floor 2, but not at floor 1.25. In essence, we must raise electrons to at least this height, or none at all. And that's why 3 lemon batteries in series are required. Each lemon battery has the potential to raise the electron a certain height, and it takes 3 lemon batteries to get to the height, or energy level that is acceptable to material N. Now that the electrons are at the higher energy level, they can flow from the N side to the P side and make their way through the copper and to the hydrogen ions in the lemon. But now, since N has a much higher height than P, you can see there is a big drop for electrons from their height in material N to their height in material P. As a result, the electron drops from this height down to here and when it does, the difference in energy level is released as photons, or light. And that's where the light is coming from: the zinc/hydrogen interaction brings the electrons to a higher electrical potential, essentially raising the electrons up to a higher energy level in N, and when the electrons move to P, they drop in energy and this energy is released as light. The technical term for this is electroluminescence. Without material N being picky about the energy level of its electrons, and both materials N and P making a one-way road, there wouldn’t be a drop-in energy resulting in the production of light. That's what makes an LED special! Also, the color of the light is dependent on the height of the drop. Blue light, which has more energy per photon than red light has a larger drop between N and P And this is related to why efficient blue LEDs were so difficult to discover. Furthermore, the intensity of the light is dependent on how many electrons are flowing through the LED.  The more electrons, or current, passing from N to P, the more photons generated and the brighter the light from the LED is. My Super lemon battery and LED had around 1.4 milliAmps running through it, which equates to around 9 with 15 zeros after it or 9 quadrillion electrons dropping from N to P per second, and around that many photons emitted as well. I’m excited to hear what questions you have. I included a set of frequently asked questions and answers in the description. But you should ask them in the comments as well I love this activity.  You may think it's fun and simplistic,  as it just makes a small amount of light. But, LEDs are everywhere!  They can be found in lightbulbs Smartphones, TVs, computer monitors, and this 8 by 8 LED cube I built a few years back, and they all function using the principles that we discussed earlier. Also LEDs demonstrate one of the core interactions between N and P materials which is at the center of microchips. The combination of N and P materials is so amazing that many Nobel prizes have been awarded to people for their discoveries and research into these materials. In fact, in 1921, Albert Einstein was awarded the Nobel prize for his understanding of topics related to discrete energy levels, very similar to what we discussed here.  Pretty cool, no? That about wraps it up. Thanks for watching, don't forget to like, subscribe, and share with others! If you have any questions post them in the comments below. This episode branches to how to build Lemon Batteries, solar cells, understanding current and voltage, and understanding electricity. Also remember to think about the conceptual simplicity,  and structural complexity throughout the world around you.

---

## 40. How to Make Lemon Batteries!
**Channel:** Branch Education | **Views:** 196K | **Date:** 6 years ago | **Duration:** 4:56 | **ID:** EA751OyNLOk
**Link:** https://youtube.com/watch?v=EA751OyNLOk

### Transcript:
Building a Lemon Battery
by: Branch Education When life gives you lemons, make a lemon battery! You just need a few copper pennies, some wire, galvanized nails, those lemons life gave you, and science! This episode is a hands-on activity where we build a lemon battery to power an LED. Whereas the follow-up episode goes under the rind to explore the physics and underpinning science around how all this works. These episodes will help provide an in-depth understanding of electricity. Let's switch out of animation and get started building the battery. For this activity you'll need these materials, and you'll also need these tools. A step by step procedure is linked in the description. If you're under 12, ask an adult before starting this activity.   Also, a few tips for safety: don't eat or drink any of the lemons or objects that we use. This is because the metal in the nails leaches into the lemons and eating that isn't good for you, so, just- don't, and be careful with the nails, wire, and wire cutters- don't hurt yourself. So now let’s build this lemon battery and start generating electricity. First, take a lemon and press and roll it on the counter to break up some of the internal structures in the lemon and release the juices. Second, push 4 nails into one side of the lemon. The nails should be as close as possible and touching one another. Third, cut a good length of wire, about yey long and use it to make a small row of punctures on the other side of the lemon, away from the nails. Now push a penny into the lemon where you made the row of punctures. Then press a second, and then a third penny into the lemon. Fourth, take the copper wire and loosely coil it around your finger a few times, flatten the coil, and press it into the lemon between two of the pennies. To make sure there’s enough copper surface area, push in a few more pennies. This is science!  But not exact science, so have fun with it.  You may want to add a 2nd shorter coil of wire into the lemon and attach it to the first like I’ve done here. The goal is to have a lot of copper surface area in the lemon  with a good connection from the pennies to the wire. Also, make sure that the copper pennies don’t touch any of the nails inside the lemon; if they were to, the battery wouldn't work. And that's it! You built a lemon battery. Now let's try and light up this LED.  Annndd… it doesn't work,  and that's because one of these lemon batteries doesn't provide enough voltage to light the LED, and therefore we have to use 3 of these batteries in series to make a super lemon battery. So, fifth, let's build 2 more lemon batteries identical to the first. In order to combine the power from 3 batteries and make a super lemon battery, we are going to place them in series. To do this we’ll use some tape and a marker to label the lemons #1, 2, and 3. Now, take the copper wire from lemon #1 and use the pliers to wrap it tightly around the nails on lemon #2.  And then do the same with the copper wire from lemon #2, by wrapping it around the nails on lemon #3 Next cut an additional length of copper wire, and wrap it around the nails on #1, and then tape and label this wire “negative”.  Then, tape and label the copper wire out of #3 as “positive”. To light the LED, take the negative wire and press it to the shorter leg on the LED and take the positive wire, and press it to the longer leg. It works! You just generated electricity using some lemons, nails, wire, and copper pennies, and then used that electricity to power an LED and produce light!  Good job! Our super lemon battery is done!  Here are some questions for you to think about: Consider them and we'll explain the answers and more in the next episode, so stick around for that!  Also, if you had issues with your lemon battery, read the description to troubleshoot; probably the answer will be in there. Thanks for watching, don't forget to like, subscribe, and share with others! If you have any questions or ideas, post them in the comments below. This episode branches to: exploring lemon batteries, voltage and current, lithium ion batteries, and understanding electricity. Also remember to think about the conceptual simplicity, and structural complexity throughout the world around you. Made by Branch Education

---

## 41. How do Lithium-ion Batteries Work?
**Channel:** Branch Education | **Views:** 1.5M | **Date:** 6 years ago | **Duration:** 9:30 | **ID:** G5McJw4KkG8
**Link:** https://youtube.com/watch?v=G5McJw4KkG8

### Transcript:
Exploring Lithium-Ion Batteries:
How they work, Recharge, and Degrade
by: Branch Education It's crazy every second you use your smartphone, 
there's a chemical reaction, like a baking soda volcano happening inside of it. It looks like a solid device without many moving parts, 
but its true! Inside the battery there's chemical a reaction 
that is continuously running and without it, your phone would just be dead, 
which is something we’re all familiar with. Let’s investigate this lithium-ion battery.
How does it power your smartphone, what happens when you recharge it, 
and probably what we’re all wonder Why does your battery die 
earlier and earlier in the day? To answer these questions, let's 
open up this battery and look inside. So first, how does your battery power your smartphone?
Let’s start from what we know. All batteries have a positive terminal 
and a negative terminal and supply power or electricity
 to our portable devices. So, Electricity is essentially a 
flow of electrons and in our smartphone. Electrons which are negatively charged
flow from the negative terminal and run things like the speakers or the display 
and then end up at the positive terminal. So then, where does this flow of electrons come from? Well, this is a lithium ion battery, 
so the electrons come from the element lithium. At the negative terminal, which is technically called the anode, lithium is stored between layers of carbon graphite, 
similar to the graphite in your pencil. Graphite has a nifty crystal structure of layered planes that allows for the lithium to be 
wedged in between each of the layers. The technical term for this is intercalation. Graphite functions as kind-of-like a 
stable storage space for lithium atoms. Ok- Moving on, one inherent property of the element lithium is that it doesn’t like it’s outer-most electron, and it wants to give it up. When there is an available path from the
negative terminal to the positive terminal, this electron separates from the lithium 
and starts heading to the other side. At the same time, the lithium leaves the graphite, and becomes positively or +1 charged and is now called a lithium ion. FYI- an ion is just fancy word for an atom who has lost or gained an electron, and thus is charged. When a lot of lithium atoms leave 
the graphite at the same time, a flow of electrons is built up. So, let's now jump to the positive terminal,
which is technically called the cathode. Here we have Cobalt that has 
lost some electrons to oxygen, thus making the Cobalt positive, or +4 charged. As a result, it wants to gain back an electron. So, when we connect the negative 
and positive terminals to our smartphone, the electrons flow from the lithium 
which wants to give up an electron, through the circuits and components in the smartphone and to the cobalt which wants to gain an electron. Now here we run into a small issue. With the flow of electrons from the 
negative to the positive terminal, the cobalt side grows more and more negatively charged, and the other side positively charged. Yes, the electrons do want to flow in this direction, but at the same time electrons don’t like to flow to an area that is growing more and more negatively charged. This is because opposite charges attract,
and similar charges repel. So, to fix this, we give the now
 positively charged lithium ions that recently left the graphite, 
a path to move to the other side. This path is called an electrolyte, 
and its function allows for lithium-ions to migrate over from one side to the other, 
while not allowing the electrons to move through it. When lithium gets to the cobalt side, it again wedges itself, or intercalates with the
cobalt and oxygen to become Lithium Cobalt Oxide. The lithium isn't regaining its electron- that electron went to the cobalt, 
it's just balancing out the charge build up. Let's quickly recap.  Here is a full battery. Throughout the day lithium 
atoms leave the graphite layers and separate from their electrons to become lithium ions. The electrons flow from the negative terminal 
through the circuits and components in the smartphone and into the positive terminal to join the cobalt atoms. At the same time, the lithium-ions travel through the electrolyte in order to neutralize
the charge build up and keep the reaction going. Here's the chemical formula for the reaction. Thus, at the end of the day almost 
all of the lithium has left the graphite layers, and joined the cobalt to become lithium cobalt oxide, 
and your battery is now running on empty. Now that the battery is empty, let's recharge it. We plug in our smartphone and when we do this the USB charger applies a higher force on a flow of 
electrons in the opposite direction. Electrons are pulled out of the cobalt, thus returning cobalt to its +4 state and kicking out the lithium ions. On the other side, electrons are forced onto the graphite, which pulls the lithium through the electrolyte, 
and back into the layers of graphite. As you see it’s the exact opposite of the earlier reaction, 
which is why this battery is rechargeable. The lithium and its electrons move in one direction 
when you use the phone, and the opposite when you charge it back up. Ok, so now let's rewind and 
add a few more details of note. First, these two sides can’t touch,
If the anode and cathode were to touch, and if there were any lithium left in the graphite, the chemical reaction would accelerate uncontrollably
and cause a fire or often a small explosion. Thus, a non-conductive semipermeable separator that allows the lithium-ions to pass through is placed in the middle. And this electrolyte isn't an effective barrier because it's a liquid The second thing to note is that the 
graphite and cobalt peroxide aren’t good at collecting or distributing the electrons. Thus, a conductive copper layer is added next to the graphite, and a conductive aluminum layer next to the cobalt peroxide. These two layers or sheets are called collectors. Ok, onto third, these animations 
are showing 100% of the lithium moving from the anode to the cathode, and back. But in reality, there will always be some percentage of lithium that remains in the anode, 
cathode, and electrolyte despite the battery being fully charged or 
discharged respectively. Continuing to fourth, in order to 
maximize the capacity of the battery, and allow the battery to fit into your smartphone, all these layers are folded and wrapped 
into a rectangular prism package. Ugh, I know this is a lot, but fifth and final, in order to regulate the flow of electricity, additional circuitry is added to the top of the battery. This circuitry prevents overcharging 
and damage to the battery. So, then the final topic. Why does your battery's max 
capacity reduce over time? There are several reasons, one of which is that sometimes 
lithium and the incoming electron react with electrotye and organic solvent to form compounds that are called a 
solid electrolyte interphase or SEI SEI's irreversibly consume lithium and the electrolyte, thus reducing the overall quantity of lithium and thereby reducing the max capacity of your battery. Another reason is that when you 
fully discharge your battery until it’s dead, it can result in too much lithium on the cobalt side, which causes the irreversible generation 
of Lithium oxide and Cobalt (II) Oxide. These compounds are stuck in that state 
which thereby reduces the amount lithium and cobalt for future use. So, one tip is to not let your battery run until its empty. It’s better to recharge your battery at 30 or 40% then to let it run until its dead. That about wraps it up. When it comes to batteries, there are hundreds of different chemistries and
compounds that allow them to work, but they all work on similar principles. You just need three materials, one that wants electrons, one that wants to give up electrons, and then a path for the build up of charge to neutralize. Thanks for watching!  
Here are 3 questions I’m going to leave you with. Discuss them in the comments.  
Also, ask questions in the comments! If you do it I will pin the top questions for further discussion. Don’t forget to subscribe and tell your friends and family about something you learned today. This episode is about lithium ion smartphone batteries, and it branches to electric vehicle batteries discussed by Learn Engineering, 
we recommend you take a look! It also connects to galvanic and voltaic cells, Chemical bonds & electronegativity and lemon batteries. Post your comments with further questions, 
answers, and thoughts. And Remember conceptual simplicity 
and structural complexity.

---

## 42. How does Multitouch work?
**Channel:** Branch Education | **Views:** 126K | **Date:** 7 years ago | **Duration:** 5:58 | **ID:** 4mPdNV_smWg
**Link:** https://youtube.com/watch?v=4mPdNV_smWg

### Transcript:
How does Multitouch work?
By. Branch Education Have you ever thought of your smartphone’s multitouch screen as functionally similar to your body’s skin? Stay with me here:  both are able to sense multiple touches, and then both are able to make decisions and act on those inputs. We take for granted being able to feel and sense the environment around us but translating these senses to electronic devices and building something like multi touch is no trivial task. In this branch episode we are going to discuss how engineers created screens that could discern multiple touches in smartphones. This episode is a branch of the episode how does a touchscreen display work? which goes into the physics and basic structure behind projected capacitive touchscreens as well as OLED displays and toughened glass, so I recommend you take a look if you haven’t seen it. *Intro Music* Ok, so let's dive in! This touch screen is made of 40 rows colored in blue and 80 columns colored in yellow The result is a grid with over 3 thousand intersections, and your phone can sense a touch at each of those intersections. We’ll get into how it does that shortly, but for now- when you type out a message, your phone detects a pattern that looks like this. When you swipe right, your phone detects this, and multi touch zooms look like this. Even if you have large fingers, your smartphone can find the center of your touch. It can see the size, shape and location of the tap or gesture and then calculates the X, and Y coordinates. It also determines whether you left your finger or fingers on the screen and if you swiped in any particular direction. Let’s quickly review how the screen detects a touch at one intersection. Electrons with a negative charge are applied to the blue plate which builds an electric field and causes positive charges to gather on the yellow plate. When a conductive material like your finger tip comes close, it interrupts the electric field and the change in positive charge on the yellow plate is measured. You might be wondering how does my touchscreen work through the glass and screen protector. Well, this type of touchscreen is called a projected capacitive touchscreen because the electric field rises above the surface of the glass, so the touchscreen will work through protective covers as well as thin plastic or rubber gloves.  Test it out! grab a few plastic bags or saran wrap and see how many layers of plastic your touchscreen can sense through. Before we continue, let's simplify the grid from thirty two hundred intersections down to two hundred intersections. Everything conceptually works the same, it's just easier to visualize. Ok- so with all the rows charged negatively and the electric fields built up, and the columns actively measuring to see changes in the electric field, we have a touchscreen, right?  Well not exactly. See, if we continuously measure each of these columns while all the rows of electric fields are active, we run into a few issues. Say I tap here. Well, because the entire yellow column is connected, it can’t distinguish whether there was a tap here, or here. This is not a good touch screen. We have to measure the entire column simultaneous, because if we break up the column and measure individual diamonds, we will end up measuring thirty-two hundred points, and that is too many points. so then how do we get it to work properly? Well, the solution that engineers implemented was to scan or sweep the electrid field along the rows veerrryy quickly - at a rate of about 10 microseconds per row. At any given time only one row is on, thus only one row of intersections can detect a touch at a time. Circuitry in the smartphone controls this sweep of the electric field across each of the rows, and at every row a measurement along each column is recorded. Before the electric field moves to the next row, each column resets its measurement. The smartphone then correlates when the row was active with the output of each column in order to reconstruct a complete grid. This scanning happens within a couple millisconds and it allows for the smartphone to distinguis between 3 or more touches in all different locations. The drawback is that a new time delay is introduced and if the touchscreen gets too big, say the size of a small table, there would be a rather noticeable delay from the scanning across so many rows. However, with a touchscreen the size of your smartphone, it can quickly determine all types of touches and gestures. That pretty much sums it up for multi touch in your smartphone There are many other types of touchscreens like resistive, or self-capacitive touchscreens to be detailed in other episodes.  This episode is related to the structure of a touchscreen display as well as electric fields, and capacitors.  And how to measure capacitance Thanks for watching!  Don’t forget to subscribe, comment with your questions and thoughts, and tell your friends and family about something you learned today. And remember to think about conceptual simplicity and structural complexity. Thanks!

---

## 43. How Do Touchscreens Work?
**Channel:** Branch Education | **Views:** 4.0M | **Date:** 7 years ago | **Duration:** 8:36 | **ID:** cFvh7qM6LdA
**Link:** https://youtube.com/watch?v=cFvh7qM6LdA

### Transcript:
How do Touchscreens work?   By: Branch Education What enabled smartphones to dominate as a technology- to be so prolific and critical to our lives that I I would rather lose my car keys or wallet than my smartphone. The answer to this question isn’t a simple one liner, 
 but rather it's a combination of answers, app development, wireless internet, carrier networks, Steve Jobs’ brilliant marketing, tho I would argue the most important contributor was the seamless combination of different functions and technologies into a single package. In this episode we're  going to explore the most distinctive feature of the smartphone’s merging of technologies- the touchscreen display. There are three technologies in the touchscreen display These technologies are combined all on top of each other. When you felt and used a smartphone for the first time, you just knew that you were holding something revolutionary – something different from all previous phones. These… were not new technologies. Many devices used a tactile interface, 
and color displays had already been a standard for most phones. Even toughened glass had been discovered in the 1800s. But the innovative element was combining them seamlessly. One layer on top of another like magic. Ok, so let’s get into the layers of a touchscreen display. On the top, we have the protective glass. A lot of us have had a screen shatter but think about how many times you’ve dropped it and it hasn’t. That’s because a smartphone’s glass is over 5x stronger than normal glass. And, before the first iPhone showed up in 2007 the standard for cellphone screens was plastic and although plastic doesn’t shatter, 
it is very easily scratched. If the screen were covered in plastic, it wouldn’t last a week sitting in your pocket next to your keys before having dozens of scratches all over it. So, what makes toughened glass so much stronger? A smartphone’s glass is an aluminosilicate glass that is toughened by soaking it in a bath of molten potassium nitrate. This causes the sodium atoms in the glass migrate out, 
and much larger potassium atoms take their place. Because the potassium atoms are much larger, they generate a substantial compressive force on the surface of the glass. Here’s a quick analogy: imagine filling the backseat of a car with 3 average sized people. They fit snugly but if you push them, they're still able to move. Now replace those 3 people with 3 football linebackers.
Those linebackers are just flat out stuck- unable to move. It would take much more force to move those linebackers from their seats. This is the fundamental concept behind what makes toughened glass special, the atoms are compressed so it would take more force for the glass to break. Below the toughened glass is a projected capacitive touchscreen that senses the presence and location of conductive materials,
such as your finger tip. This touchscreen is composed of two transparent diamond grid patterns
printed on polyester with an optically clear insulator in the middle. The diamond grid pattern is printed with a transparent, 
material called Indium Tin Oxide or ITO which acts as a conductor. Let’s take a closer look on how it works. say we build up a bunch of electrons on this blue diamond, however because there is an insulator in the way, the electrons cannot move. The electrons generate a negative electric field 
which causes a bunch of positive charges to build up on the yellow diamond This is called a capacitor. Now, when we move a conductive material such as the tip of your finger close to this capacitor it disrupts the electric field which changes the amount of positive charges that build up on the yellow diamond. The change in positive charges caused by this disruption on the yellow diamond is measured, 
 and the processor registers this as a touch. The location of the touch is detected by scanning the charges or voltage along the blue diamond rows, while actively measuring each yellow diamond column. Note that each row of blue diamonds is connected together, also each column of yellow diamonds is connected. This setup makes a grid of blue columns and yellow rows. Just to clarify again, all of these components are made with transparent materials. Measuring each point requires too much circuitry,
 so we only measure each column. The charge or voltage gets sent to each row in quick succession, 
so the processor can register multiple touches at once Below that is a display which uses LCD or OLED technology. While the LCD and the OLED display both produce high quality images, in this episode we are going to focus on the OLED technology as it is the standard in most new Smartphones. OLED stands for Organic light emitting diode. This high-resolution OLED display is what generates the high-quality images that we see whenever we look at our smartphone. This is a crazy intricate grid!  Current 2018 high-end phones can have over 3.3 million pixels. That means there are 10 million microscopic individually controlled dimmable red green and blue lights in the palm of your hand. Take a moment to think about the engineering level recuired to control let alone design and manufacture that many microscopic lights! OLED displays are composed of a massive grid of individual pixels and each pixel is composed of a red green, and blue subpixel. Each subpixel’s light intensity is controlled by a small thin film transistor that acts as a dimmer switch. There are many layered structures in each sub pixel, however explaining the function of each layer will have to be saved for a future episode. Photons are produced in the subpixel by electrons that are driven from the negative to the positive terminal. When they pass through this middle layer here, called the emissive layer,
photons are emitted through a release of energy. The compounds used to make up the emissive layer determines the color of the light emitted, and the intensity of this light is dependent on how many electrons pass through. This explanation is greatly simplified but the research, engineering and science behind OLEDs is extensive. In fact the 2014 Nobel prize in Physics was awarded to 3 researchers for their discovery of efficient blue light emitting diodes! So, let’s summarize: on the bottom is an OLED display composed of a 10 million itty bitty little colored lights. On top of that is a transparent projected capacitive touchscreen that can sense one or multiple finger touches at a time. And on top of that is strengthened glass that protects your screen from scratches and most falls. Now you too are a touchscreen expert! If you have any questions, post them to the comments below. Subscribe, Like, and tell your friends or family about something you learned. This episode details the structure of a touchscreen display. Branches from this episode are:  Multitouch design, electric fields, Capacitors OLEDs and their control, LCDs, Why are materials transparent?  And interface aesthetics. Thanks again for watching and until next time, consider the conceptual simplicity yet structural complexity in the world around us.

---

## 44. What is Sound?  The Fundamental Science Behind Sound
**Channel:** Branch Education | **Views:** 625K | **Date:** 7 years ago | **Duration:** 9:41 | **ID:** 24yESm63tSY
**Link:** https://youtube.com/watch?v=24yESm63tSY

### Transcript:
What is Sound?
Understanding the fundamentals of sound and sound waves.  Physics of sound by Branch Education. Why does everything around us generate sound?   Also, there are a whole variety of sounds-  running water, a cellphone, music, someone’s voice. The list of sounds you hear throughout a given day is endless. But, when you are shown what sound looks like, inevitably you are shown something like this…  which sounds like this...  and to me, that doesn’t make much sense because you never hear that sound in the real word.  In this Branch Episode, lets try to better understand what is sound? Let’s start with a simple sound. *POP*  That was popping an inflated polka dot balloon.  This polka dot balloon is filled with high pressure air particles and when popped, all these particles rush out and hit the adjacent air particles. Those particles hit the next set of adjacent particles, and so on , thereby creating an expanding shell of air particles just bouncing into one another This is called a pressure wave or sound wave.   This wave travels throughout the room  and eventually the bouncing particles apply a force to your ear drum which causes parts of your internal ear to move. Then your brain processes this motion in your internal ear and tells your cognition that oh this motion in my ear sounds like a balloon popping.   Let’s, rewind, go back to take deep dive into what this sound wave looks like. Even though popping the balloon makes a relatively simple sound when we take a cross section and zoom in  on a molecular level we can see the complex pattern depicting how the air particles are bouncing into one another.   This pattern is produced within a tenth of a second after the balloon is popped.   You may ask- where does this pattern come from?   Well, the high-pressure air particles rush out and generate a high-pressure wave, but when they do, they create a low-pressure void in the balloon’s center The air particles rush back into fill this void, there by generating a low-pressure wave When the particles rush back in to fill the void, they rush in too much  thereby creating second-high pressure zone.  This cycle repeats itself and each time it does it generates a high pressure & low-pressure wave which can be graphed. This graph shows the pressure waves or waveform produced by a popping balloon.   The vertical axis is pressure, or the amount of force the particles bounce into one another.   The horizonal axis is time.   These high points in the waveform are called compressions  and they are where the particles are compressed and bouncing around a lot and thus have a higher pressure. The low points in the waveform are called rarefactions,  and they are where the air particles are more spread out and not bouncing around as much,  and thus have a lower pressure. Both the graph and  particle animation help to visualize sound,  which as we know is invisible to our eyes. The measurements are taken at a single point in space,  in this case the pressure was measured a by microphone In order for your speakers to duplicate this sound the diaphragm in your speakers just have to move in a similar fashion.   The entire sound takes one tenth of a second for your speaker to duplicate.   *POP*  This visualization is just the first section of the overall pattern popping balloon. of cycling compressions and rarefactions produced from a popping balloon. In just this quick sound, there were about 50 of these cycles. If we slow down this sound to 4 seconds, *RUMBLE* you can hear some of the cycles between compression and rarefaction. Most sounds last much longer than this quick duration,  so in visualizations of sounds, we usually see the squished version of this graph which looks like this. Let’s consider another sound,  here is a running faucet. *SWOOOOOOOOOOOOOOOOOOOOOOOOOSSSHHHH* The moving water molecules apply a force to the nearby air particles thereby causing the air particles to bounce into one another thus creating a sound wave The sound wave propagates throughout the room and hits your eardrum, or a microphone, and the waveform of looks like this The difference between the balloon popping and the running faucet is the way the air particles are moved which can be seen in the shape of the waveform Another difference is that the sound of the running water is continuous  whereas the popping balloon only lasted a tenth of a second *Beethoven's 9th Symphony* Now, let’s consider a significantly more complex sound. This sound of Beethoven’s 9th is constructed from dozens of instruments. Each instrument when played applies a force to the air particles around it thus causing the air particles to bounce into one another thereby generating a soundwave So, when the waveforms of different instruments meet in the air  they combine to make a new unique waveform or sound Wait wait wait-  let's actually rewind and clarify three quick things.   First, this animation properly shows how a sound wave is a sequence of  alternating compressions and rarefactioins, however it doesn't show how sound propagates in all directions.   It propagates kinda like this- as an expanding sphere.  So- just keep that in mind. Also, second, with this animation, it looks like the particles are travelling,  however in reality it is the force of the air particles that is travelling,  and this propagation of force along with the alternating compressions and rarefactions is what constitutes a sound wave.  Take a look at the video of how  sound travels to better conceptualize this bouncing-like movement of the air particles. And finally third, this sound waveform is just a quick snapshot of what the entire soundwave looks like.  It's about four thousandths of a second in duration.  To say it differently, there would be 440 of these waveforms hitting your ear in one second, or to say it technically, the frequency of this violin sound is 440 hertz,  or musically it is the musical note A. Ok, now that we have those details clarified, let's jump back to where we were. So, when the waveforms of different instruments meet in the air  they combine to make a new unique waveform or sound With simple combinations of instruments our brain is able to analyze this combined waveform and pick out individual instrument However when many instruments are combined, only a trained ear would be able to determine all of the instruments used to create the music because the combined new waveform is so dissimilar to the individual instruments. Furthermore, for us to record and play back the sound of Beethoven’s 9th symphony we would just need to convert the pressure waveform  in the concert hall into something like the movement of a needle This is the core concept behind vinyl records. A device measures the force or pressure levels from the air particles in the concert hall or recording studio and graphs them into the grooves on a vinyl record. You can see how the shape of the grooves closely resembles the waveforms we have been talking about. To play this record, a needle just needs to follow the recorded grooves, and convert this motion into the motion of a diaphragm, which applies a force to the air particles, thereby reproducing the original sound.      Thanks for joining us to learn about sound!   If you have any further questions, post them to the comments below  Subscribe, like, and tell your friends or family about something you learned. This episode is about understanding what sound waves are.   Branches from this episode are how do sound waves travel?  Understanding pressure, how ears work, how a microphone and speaker work understanding air, frequency and amplitude, loudness and intensity, and understanding wind movement vs sound. Thanks for watching and until next time, consider the conceptual simplicity yet structural complexity in the world around us.

---

## 45. The Speed of Sound & How does Sound Travel?  A Fundamental Understanding
**Channel:** Branch Education | **Views:** 424K | **Date:** 7 years ago | **Duration:** 8:20 | **ID:** 1kjAkuwYx2M
**Link:** https://youtube.com/watch?v=1kjAkuwYx2M

### Transcript:
How do Sound Waves Travel?  By: Branch Education Every waking second of our lives, we hear sound waves everywhere. From the hum of a fan to the clicking of your keyboard, sound waves permeate our lives. But how do they travel throughout the world around us? To answer this question, we are going engage in a thought experiment. Let’s say we have a bar of steel that reaches the 384,402-kilometer distance between the surface of the Earth and the surface of the Moon overhead. Let's be real, that's a very long bar that could never feasibly exist. but for the sake of this thought experiment let’s say it does and, that we are going to suspend all these factors. So, let’s pose this question: if we were to raise the Earth side of the bar by one meter, what would happen to the far Moon end of the bar? Would it move a meter instantly?  Would there be a couple seconds delay? Possibly an hour delay? Maybe a much longer delay? As it turns out, the moon end of the bar would move one meter 18 hours and 24 minutes after we moved the Earth end of the bar. This is a massive delay and it is due to the fact that when we are pushing on the bar on earth, we are not pushing on the entire 384,000-kilometer-long bar at once, but rather we are just pushing on this localized group of atoms here. These atoms at the Earth end of the bar push on their adjacent atoms, and then to the next group of atoms up the bar and so on, all the way until this pushing reaches the moon. This pushing can also be thought as a bouncing of atoms and it does not travel up the bar instantaneously but rather it takes time for one group of atoms to push or bounce into the next group of atoms. Specifically, in steel this rate of bouncing and reacting to the adjacent atoms travels up the bar at a rate of 5.8 kilometers per second. This speed is considered the speed of sound in steel and it varies depending on the material. If the bar were made of oak, the 384,000 kilometer long delay would be just under 27 hours. That’s a long time, but eventually the motion would get to the moon. The point is that although materials like a steel bar, or a wooden table look to be a coherent single object and thus one would expect the entirety of the object to move instantly all at once; in reality forces and movements takes time to travel throughout the many atoms in an object. This travelling of movement, or propagation can be thought of as a chain reaction of atoms pushing or bouncing into one another. The speed of this propagation is called the speed of sound, and it is dependent on the material or medium that the motion passes through. It is also dependent on the temperature of that particular medium. Now, back to the thought experiment, consider what may happen if we move the steel bar differently. On Earth, let’s move the bar up, and then after 10 minutes, we move the bar back down. What will happen on the Moon? Well, similar to our previous experiment, after 18 hours, the bar will move up and then 10 minutes after that, it will move down. Now, let’s say we move the bar faster specifically up and down 100x a second for a full minute and then stop? Well again, this shaking-like motion will start at the Earth end of the bar, make its way up the bar at a rate of 5.8 kilometers per second, and after the 18-hour delay, the moon end of the bar will move in the exact same shaking motion for 1 minute. In essence forces and motions in a material do not catch up to one another, even if the forces are in the opposite direction, but rather once a motion is started, it continues up the bar at a constant speed. The propagation of this motion is called a wave. In this thought experiment, the steel bar represents the air around us, and the chain reaction of bouncing atoms up the steel bar represents the propagation of a sound wave. There are five key concepts shown in this thought experiment that will help you better understand sound waves and waves in general. The first is that sound waves are a bouncing of air atoms or particles into one another. Second, waves can travel very far, however the atoms themselves only travel a short distance. Third, waves travel at the speed of sound and these speeds are material dependent. Fourth, sequential waves in the same medium travel at the speed of sound and thus one wave does not catch up to the following wave. And finally, fifth, the coup de grace of concepts a sound wave isn’t really an object like a steel bar, a wooden table, or atoms of air but rather, a sound wave is a propagation of force or motion. When we hear something, we are in essence hearing the motion that an object makes, or how kindof that object is applying a force to the air particles around it thereby causing those air particles to bounce around and that bouncing is picked up by your ears and perceived as sound.  Pretty fascinating, no? I hope you enjoyed this branch episode. Please be sure to comment, subscribe, like, and tell your friends and family about what you learned! This episode is about how sound waves travel, and branches from this episode are what are sound waves, what are the different types of waves how do your ears perceive sound, what are frequency and loudness , if sound is the movement of air particles, then what is wind isn’t that also the movement of air particles , and what is the structure of a smartphone speaker? Thanks for watching and until next time, consider the conceptual simplicity yet structural complexity of the world around us.

---

## 46. How do speakers work?  Incredibly small, yet impressively loud
**Channel:** Branch Education | **Views:** 546K | **Date:** 7 years ago | **Duration:** 5:34 | **ID:** jhg90zsjqt4
**Link:** https://youtube.com/watch?v=jhg90zsjqt4

### Transcript:
How do Smartphone Speakers Work?
by. Branch Education It wakes you up in the morning, plays your music, and projects the voices of your friends and loved ones. A smartphone speaker does this, all while being only the size of a dime. To understand how this tiny marvel of engineering can do so much, we will first look at what it is made of. Most smartphones have two speakers. A smaller speaker near the top of the phone is used for phone conversations while a larger one at the bottom is used for playing music and other louder applications. Although this second speaker is the larger of the two, it is still ridiculously small. It weighs as much as a dime and is about equal in size. The smaller speaker weighs a fifth of that! Let’s focus on the top speaker as both the top and bottom speakers have the same components with identical functions. In a smartphone speaker there are 4 key components. A diaphragm, a voice coil, a magnet and a spider. Four additional components, two pole plates, the plastic case and the front cover, provide uniformity for the magnetic field, structural support, and protection. Let’s focus on the 4 key components and go over them in detail. The first key component is the diaphragm. It is a thin piece of rigid plastic that moves back and forth to generate sound waves. The diaphragm moves forward and compresses air particles generating a high-pressure wave, and then moves backward and generates a low-pressure wave. The diaphragm can do this thousands of times a second which creates cycles, or an oscillation, of high pressure and low-pressure waves. These waves then propagate out from the speaker and when this oscillation of high pressure and low-pressure waves hits our ears, it is perceived as sound. The diaphragm creates these waves by moving back and forth, and what facilitates this movement is the second component, the voice coil. The voice coil is firmly mounted to the diaphragm and it is constructed from a coil of insulated copper wire. The diaphragm and coil are positioned around the third component, the magnet. In a smartphone, this magnet is made of neodymium which has a strong permanent magnetic field. Together, the coil and neodymium magnet act as a kind of miniature motor. When a current is applied to the coil, a magnetic field in the coil is generated or induced. The interaction between the coil’s temporary magnetic field and the neodymium’s permanent magnetic field cause the coil and the diaphragm to move. When the amount of current running through the coil changes, it also changes the shape of the coil’s temporary magnetic field. This in turn changes the position of the coil and diaphragm. Thus, when a waveform of current like this is run through the coil, the diaphragm will move accordingly, and the pressure waves generated by the diaphragm will result in the corresponding sound waves. The fourth key component is the spider. This thin piece of flexible saran wrap like plastic stabilizes the diaphragm and prevents it and the voice coil from moving side to side. The spider functions similar to the springs of a trampoline. Both the trampoline’s surface and a diaphragm are free to move up and down, but not side to side. The spider, similar to a trampoline, applies counteracting tension to the direction of motion, thereby returning the diaphragm to a central position. If the diaphragm and voice coil weren’t stabilized, they could hit the magnet resulting in both getting damaged. To summarize, the diaphragm physically pushes on the air in order to generate sound waves. This diaphragm is mounted to a voice coil and is stabilized in the center by the spider. Finally, the voice coil and magnet operate as a miniature motor to drive the diaphragm. Working together, these 4 components generate an impressive variety of sounds from our smartphone. Branches of this episode will continue to explain: what are sound waves, how does a coil with a magnet result in such a complex motion, how do our ears perceive sound, and if sound is a movement of air particles, then what is wind? Thanks for watching and until next time, consider the conceptual simplicity yet structural complexity of the world around us.

---

## 47. How does a camera work?
**Channel:** Branch Education | **Views:** 1.6M | **Date:** 7 years ago | **Duration:** 14:20 | **ID:** B7Dopv6kzJA
**Link:** https://youtube.com/watch?v=B7Dopv6kzJA

### Transcript:
How does a Camera work?  By. Branch Education  If you were to guess how many smartphone pictures will be taken throughout 2018, what would you guess? Perhaps a billion?  Or is it closer to a trillion?  Or is it even higher at 50 Trillion or 1 Quadrillion? Here’s some stuff to help you out. There are 7.6 Billion humans on the earth.  The percentage of people across the globe who own smartphones is about 43%. And let’s say each person takes around one photo a day,  thus the answer is around 1.2 trillion photos, so 1 trillion is a pretty good guess. That’s an astounding number of pictures,  but how many different parts of your phone have to work together  to take just one of those pictures? That’s the question we’re going to explore: How do smartphones take pictures? So let’s dive into this complex system. To start we are going to divide the system into its components, or sub-systems, and lay them out into this systems diagram. First of all we need an input to tell the smartphone to load the camera app and take a picture. This input is read via a screen that measures changes in capacitance and outputs X and Y coordinates of one or multiple touches. This input signal feeds into the central processing unit or CPU and random access memory or RAM. Here, the CPU acts as the brain and  thinking power of a smartphone while the RAM is the working memory,  it’s kinda like what you are thinking of at any moment. Software and programs such as the camera app are moved from the smartphones storage location which in this case is a solid-state drive and into the random access memory.  It would be wasteful if your smartphone always had the camera app loaded into its active working memory or RAM.  It’s like if you always thought of what you were going to eat at your next meal.  It’s tasty, but not efficient. Once the camera software is loaded, the camera is activated,  a light sensor measures the brightness of the environment and a laser range finder measures the distance to the objects in front of the camera. Based on these readings, the CPU and software sets the electronic shutter to limit the amount of incoming light while a miniature motor moves the camera’s lens forwards or backward in order to get the objects in focus. The active image from the camera is sent back to the display  and depending on the environment, an LED light is used to illuminate the scene. Finally, when camera is triggered, a picture is taken and sent to the display for review and the solid-state drive for storage. This is a lot of rather complex components; however, there are still two more critical pieces of the puzzles  and that is the power supply and wires.  All of the components use electricity provided from the battery pack and power regulator. Wires carry this power to each component while separate wires carry electrical signals to allow the components to communicate and talk between one another. This is a printed circuit board, or PCB, and it is where a lot of components such as the CPU, RAM, and solid-state drive are mounted. It may look really high tech, but it is nothing more than a multilayered labyrinth of wires used to connect each of the components mounted to it. If you want, you can add other components to your systems diagram, however we limited our selection to these. So, now that you have the system layout, let’s make a comparison or analogy between this system and that of the human body. Can you think of parts of the human body that might provide a similar function as those we have described for the sub-systems of a smartphone? For example, the CPU is like the brain’s problem-solving area while the RAM is the short-term memory. These are some of the comparisons that we came up with. It’s interesting to find so many commonalities between two things that are so very different. Like nerves and signal wires both transmit high speed signals to different areas of the body and smartphone via electrical pulses, yet one is made of copper while the other is made of cells. Also the human mind has similar levels of memory to that of a CPU, RAM, and solid state drive. What do you all think? Overall it takes a complete system of complex, interconnected components to take just a single picture. Each of these components has its own set of sub-components, details, a long history and many future improvements. This layout is starting to resemble the branches of a tree. Each element will be explored and detailed in other episodes  however for the rest of this episode we will focus our attention on the camera. But before we give you an exploded diagram of the camera, and get into all of its intricate details, let’s first take a look at the human eye. With the human eye, the cornea is the outer lens that takes in a wide angle of light and focuses it. Next the amount of light passing into the eye is limited by the Iris. A second lens, whose shape can be changed by the muscles around it, bends the light to create a focused image. This focused image travels through the eye until it hits the retina. Here, a massive grid of cone cells and rod cells absorb the photons of light and output electrical signals to a nerve fiber that goes to the brain for processing. Rods can absorb all the colors of visible light and output a black and white image. Whereas 3 types of cone cells absorb red, green, or blue light and provide a colored image. Now this brings us to a key question: If your eyes only have 3 different types of cone cells, each of which can only absorb red, green, or blue, how do we see this entire spectrum of colors? The answer is in two parts.  First, each red, green, and blue cone absorbs a range of light and not just a single color, or wavelength of light. This means that the blue cone picks up a little light in the purple range as well as a little in the aqua range. Second, our eyes don’t detect just single wavelength of light at a time, but rather a mix of wavelengths, and this mix is interpreted as a unique color. It’s kinda like cooking a soup.  It takes many ingredients chopped up and mixed together to make a complex flavor.  If you look closely, individual ingredients can be identified, but these ingredients taste very different on their own compared to the whole soup together. This is why colors like pink and brown which are combinations of colors can be found on a color wheel, but not on the spectrum of visible light.  So, if this episode is about how a smartphone takes pictures, why are we talking about the human eye? Well, it’s because both of these systems share a lot of commonalities. A smartphone camera has a set of lenses with a motor that allows the camera to change its focus.  These lenses take a wide angle of light and focus it to create a clear image. Next there is an electronic shutter that controls the amount of light that hits the sensor. At the back of the camera is a massive grid of microscopic light sensitive squares. The grid and nearby circuitry is called an image sensor, while each individual light sensitive squares in the grid is called a pixel.  A 16-megapixel camera has about 16 million of these tiny  light sensitive squares or pixels in a rectangular grid Here we have a zoomed in image of an actual sensor as well  as an even more zoomed in cross section of a pixel. A microlense and color filter are placed on top of each individual pixel to first focus the light and then to designate each one as red, green, or blue, thereby allowing only that specific range of colored light to pass through and trigger the pixel.  The highlighted zone is the actual light sensitive region, called a photodiode. This photodiode functions very similar to a solar panel. Both photodiodes and solar panels absorb photons and convert that absorbed energy into electricity. The basic mechanic is this: When a photon hits this junction of materials in the photodiode here, called a PN junction, an atom’s electron absorbs the photon’s energy and as a result it jumps up to a higher energy state and leaves atom. Usually the electron would just recombine with the atom and the extra energy would be converted back into light.  However here, due to an electromagnetic field, the ejected electron is pushed away so that it can’t recombine with the atom. When a lot of photons eject electrons a current of electrons build up and this current can be measured. Massive grids of solar cell panels don’t measure this buildup of  electric current but rather use the current to do work. As mentioned before there are about 16 million of these tiny light sensitive circuits in a camera’s image sensor.  For reference, in the human eye there are around 126 million light sensitive cells and then on top of that eagles can have up to 5x the density of light sensitive cells as humans! These cameras are indeed amazing, but they still have a way to go. Getting back to the sensor, there is a lot of additional circuitry beyond the grid of photodiodes that is required to read and record each value for all 16 million light sensitive squares. The most common method for reading out this grid of electric current is row by row. Specifically, at a given time only one row is read out to an analog to digital converter at a time. A rolling electronic shutter is timed with the row value reading in order to turn off the sensor’s sensitivity to light. The analog to digital converter interprets the buildup electrons and converts it into a digital value from 0 to 4095. This value gets stored in a 12 bit memory location. Once all 2,998 rows, totaling 16 million values gets stored,  the overall image, gets sent to the CPU for processing. So now that we have gone through some depth, let’s take a step back and think about a few of these concepts. It’s pretty strange that both the human eye and a smartphone camera only have 3 color sensors, red, green, and blue. Why do humans and cameras share the trait that they both only have sensors for these 3 colors, and yet there is a massive range of other colors? Also, why specifically this section of light in the entire electromagnetic spectrum?  Microwaves, X-Rays, and radio waves are all photons, but why aren’t our eyes or our smartphones able to detect these photons, while being great at detecting these photons? Well, the answer all comes down to the Sun light that we see on Earth. The Sun emits this spectrum of light.  The Y axis is the intensity of the light emitted, while the X is the wavelength, or color. After the sunlight passes through the atmosphere, the spectra look like this, because some of the light was absorbed by Ozone, oxygen, and other atoms or molecules in the atmosphere. It makes sense that because these colors of light are most around us, the earliest organisms first developed photoreceptors,  or light sensitive cells, to pick up on these colors of light. And after millions of years, humans evolved with photoreceptors that still react to these same colors of light,  and following that we designed our smartphone cameras with the intent to produce the same colors of light that our eyes expect to see. It is however possible to use other colors in the grid for a color filter, however the resulting image would look a little bit different. Another fun fact is that if you look at your smart phone display through a microscope, then you will see the similar red green and blue pattern. So now we will leave you with a final question: Why are there 2x as many green color photocells in this pixel array? Perhaps it is related to why plants are green, or perhaps why at a stop light, the green light looks a lot brighter than the yellow and red lights? Furthermore, what would life be like on an exoplanet if their star emits an entirely different spectrum of light or if their atmosphere is composed of different gasses? Tell me what you think in the comments. Thanks for watching and until next time, consider the conceptual simplicity yet structural complexity of the world around us.

---
