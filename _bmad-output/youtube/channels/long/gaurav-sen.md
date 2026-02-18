# Gaurav Sen Long-Form Transcripts

50 video transcripts.

---

## 1. AI Engineering Cohort 2026
**Channel:** Gaurav Sen | **Views:** 7K | **Date:** 7 days ago | **Duration:** 1:43 | **ID:** RAGEWlo_aPw
**Link:** https://youtube.com/watch?v=RAGEWlo_aPw

### Transcript:
Welcome to the AI Engineering Cohort of 2026. Through the course of this program, you'll
learn how to build reliable AI systems, which means you'll master
AI frameworks, build AI projects, and then productionize them into reliable
AI applications. To do this, we'll be learning
over the course of 16 weeks the most important
AI concepts like large language models, vector databases, retrieval augmented generation, and AI agents. The course has 32 live classes
and hands on coding assignments, where students will be coding
the internal algorithms of a transformer, and then moving to more practical concepts
like RAG, MCP, and genetic systems. You can find the detailed syllabus
for this cohort in the attached link. I will be the instructor for this cohort
and will be supporting you end to end through live classes,
networking sessions, and community groups. This cohort is ideal for software
engineers or the engineers who are looking
to understand AI systems in depth. Apart from this, the students get lifetime access
to all the class recordings and material, along with four months of dedicated support
from a team of engineers who work with us as teaching assistants. By the end of this cohort,
we expect you to improve your workplace productivity significantly by correctly
building and deploying applications. We also expect you to identify new AI
opportunities for your team and company, resulting in both business
growth and savings. The cohort starts on the 28th of February and will continue
till the 14th of June, 2026. All classes will be held live from 9 a.m. to 10:30
a.m. IST on Saturdays and Sundays. We will also be having networking sessions
at 7 PM IST on Wednesdays. If you have any questions,
you can contact us on the website page or email us at hello@aiengg.dev or WhatsApp us on the mentioned number. Thank you for your attention. I look forward to seeing
you in the program. Cheers!

---

## 2. Diffusion Models Just Beat Large Language Models?
**Channel:** Gaurav Sen | **Views:** 40K | **Date:** 3 months ago | **Duration:** 15:01 | **ID:** Yu4ZWy1GjlE
**Link:** https://youtube.com/watch?v=Yu4ZWy1GjlE

### Transcript:
In today's video, we'll see what Diffusion-based models are. These are quickly replacing
large language models for most tasks. Code generation. Image generation. Video generation. By the end of this video, you'll know what a diffusion
based model is, how it's useful, and the internal mechanism
that is used by a model like this. So let's start to understand
diffusion based models. Let's see how they generate output. An input query might be what is the best programing language. In 2026. And if you have a large language model
it might say in terms of popularity I would say Python Here, the Large Language Model is going to be generating tokens
one by one from left to right. But if you would consider something
that some other feature, let us say speed,
then maybe you would say rust or good. Which means that the final output, the tokens
which come after popularity, completely depend on the fact
that you have chosen popularity. But if we pass the same input
to a diffusion based model. Then it's going to generate a bunch of tokens. The diffusion model
now can iteratively improve on this output
by replacing some of the tokens. So in terms of speed can change to
in terms of safety. I choose C plus plus and it can refine its answer
even further by adding tokens of end speed. If it were a large language model. After generating the token of safety, you would have no choice but to follow
through on that initial thought. But for a diffusion based model,
there is no such constraint. It can generate text
by going back and forth until you have something
which is acceptable. Why is this so useful? Think about images
where you are generating an image. If you go from left to right while
generating an image, it is quite likely that you have made a mistake over here
or you have made a mistake over here. But in a autoregressive model,
you can't really improve this in case of a diffusion based model. Since the entire image is constantly
being bubbled, is being improved, you can improve the image
till it becomes acceptable. Okay, so this is the behavior
of a diffusion based model. But why is it getting so popular. Is it really better than a large language
model? In many cases, no large language models or autoregressive models, especially. Have the benefit
that they require less of compute. So if you're buying many Nvidia
GPUs and you're almost out of budget, it makes sense to go
for a autoregressive model, which is going to require less compute
than a diffusion based model. However, at this point in time,
when it comes to train 25 or beyond, it looks like the major bottleneck for scaling models. Is not compute, but data. Data is being called
the fossil fuel of the world, in the sense
that you can only generate so much data and it takes a long time to generate
getting information out of this data is even more challenging
because a lot of the data is repeated. For example, if I have weather forecasts
and I give you the weather forecast of 37 degrees, 38
degrees, 30 degrees, 31 degrees, then all of this data just gives me the information
that this place is a hot place. The amount of data that we have in
the world is low. The amount that we are generating
is also not a lot. We are able to compute
a lot more than we are generating, and the amount of information that you
have with all this data is limited is low. Knowing this, diffusion
based models have a clear advantage. One of the things is for the same amount
of data. Diffusion models outperform autoregressive models. The other thing is,
if you pass in the data again and again during training, if you pass it
in four times for autoregressive model, then it almost feels like fresh data
to the autoregressive model. The reason is, once you pass this data
through your neural network, it's going to update its weights
the second time you pass in the data. Some of the weights may be inaccurate or incorrect,
or may have been changed too much. So you have epoch one. Then you have epoch two till you have epoch four. So the same data can be
reused the same thing again duplicates. On the other hand
you have the diffusion based model which can have duplicates 100 times, not four times 100 times. This is the primary reason that as a engineer, you are interested
in the diffusion based model. You have a lack of data. And so to get the most ROI
for the limited data that you have, you're looking at diffusion. Let's see how diffusion based models
actually work. Firstly you have some sort of an input which might be images or code or video to the model. The model maps this input into a vector. So if it's an image
it will be an image vector. If it is a video,
it will be a video vector and so on. The vector then is basically a mapping
in the n dimensional space. The model takes the original input
and then adds some noise to it, which takes the vector to a new position. Let us say this is v1. This is going to be v2 for the noisy
image. You can then add more noise to it
to take it to a new position. V3. And in this way you keep adding noise till the original input
is almost completely distorted. Okay, there is very little information
to be had. If there is very little information
to be had, then there is very little meaning to that vector
which you can map in the vector space. So you get a bunch of vectors
by adding more and more noise. In fact, to be more precise,
you take the original image v1 and then you map
it to multiple vectors. Here. Okay, nearby. Then you take the noisy image, the first layer of noisy images,
and then you add more noise to them, which means they are getting further and further away
from the first most meaningful image. And you get this vector space
with a single image which has high value here
close to reality. Slightly lower value
here, here, here, here and here. And much lower value here. Here. Here and here. So the first original image
has a very high value. You can see it has a score of 1000. The second one has a score of 100. The third one the third level of noise
image has a score of ten. And maybe the fourth
level has a score of one. This is for one image. Another image might come in here, which makes this point a high value point. You can think of a new school
coming in a neighborhood. The price of everything in that place
increases. And similarly, in the diffusion based
model, if a new sample comes in there, you know that there is some reality which
this vector is actually representing. So all the points near that place, after adding noise to them. Have added value. In a three dimensional space. These will be mountains. These will be smaller hills
and these will be little mounds. Everything else is flat and your job,
whenever you are dropped into this 3D space, is to find the tallest mountain
that you can see. So the diffusion based model has many,
many images, hundreds of thousands of images
that are fed into it. It then generates this complex n
dimensional space where high values are represented by direct vectors,
and the value keeps reducing. As you add more
and more noise to the original images. Now there
are two questions which come here. One is
how are you generating these vectors? How do you know that
this vector should land here? And the next image,
the noisy image is going to land here. Okay.
So what gives you the coordinates of an image into a vector space? That's one big question. And the second question
is using this diffusion based model. What can we really do. That is an easy answer. We can generate output. If it's an image based diffusion model
then you can generate images. If it is a coding based diffusion model
then you can generate code and so on. Given an input query
that generate the code for sorting, you're going to take that
original input query code for sorting. You're going to convert this into a vector that will send you somewhere in this end
dimensional space. From here,
you look around at the tallest mountains that you can see
and choose the tallest mountain. Okay, so here
you are doing some sort of a random walk or a gradient descent till you reach the end state. The goal state. The tallest mountain
that you can see in this vector space. So generating text or generating
any kind of output is intuitive. We know that the highest value space
should be where we should go, for we are being nudged into that space
with the input query. So that's also good. And we are slowly iterating on a better
solution using gradient descent. We are basically moving down a path
to the maximum value point. This is how you can generate output
for any given input query. The query might be an image. Also generate an image
which looks similar to this image. Okay, that can be done. Generate code
which looks similar to this code or generate me code
by taking my text query. So you're going to take this text query and have some mechanism
to convert that into a vector. The only question which remains is
how are these vectors being generated when given an image or a piece of code
or a video file? How do we map it into a vector space? The answer is a variational autoencoder. Okay,
which sounds much more complex than it is. This is basically like a compression
engine. Given any object you can hash an object to get a single number or a single value. A variational autoencoder would take the same object
and hash it to a value which has some semantic meaning. The idea would be that
if you take various images of cats and you run them through
a variational autoencoder, the hash value or the final output is going to be such
that in the vector space, all the points for cats
n dimensional points that we generated for
cats are going to be close to each other. Okay,
the ones for dogs might also be close because they're animals after all. You might have trees quite far apart. And so this variational autoencoder
is able to compress the image to its minimum representation. How is it trained
when you pass in the image of a cat and then you try to regenerate it? So that's the best test
for the compression engine. You pass in the original image and then you try to reconstruct
that original image. If you're able to do it in a good way,
then you can say that this compression engine is good. The intermediate representation
does not lose any information. So the way that these vectors are
generated is by using variational autoencoders. The newer models from Google now
are doing an end to end vector generation. So you do not need
to separately train a V. You can actually create this diffusion
model, this space. And while it is being created
the vectors are also being updated. So this thing is inbuilt into the diffusion training process. So this is what diffusion
models look like. They are superior to autoregressive models in terms of their data efficiency. And so they are extensively used when generating images. Video and more recently code. In future, as we run out of data,
as we have less and less data to work with, to train with, I see diffusion
based models getting even more popularity. They are not more intelligent. They are not smarter than the large
language models that we have today. It's just that the performance
that benchmarks are better. Okay, there's a fundamental difference. The internal architecture
is not making them smarter. It's just that their performance
on the limited benchmarks that we have now are higher. Thank you for watching this. If you have any doubts or suggestions,
do let me know in the comments. I'll see you next time. Bye bye! Recently, I have noticed that there's been a lot of backlash
on large language models. Finally,
people are seeing through the hype. But then there is an excuse here. You say that it was never about the LLMs. It's about the next model which is going
to come in the next five years. This is something we have been seeing
for the longest period of time. In 1997, Gary Kasparov lost to a system called Deep Blue by IBM. And everyone thought
that the world is ending. Because these systems can search
in a complicated position, they have heuristics. After all,
the world is all about making choices. The search algorithm has been solved. W is going to take over the world soon. 28 years later, we are still saying that
the world is going to be taken over soon. Okay. Lots of things have come. None of them are even close. Close to human intelligence. To be frank with you, I don't see many of these systems,
even close to mammal like intelligence. Human intelligence is much, much higher. So if you
are concerned that AI is going to be more generally capable than you
is going to be more intelligent than you, it's not going to happen
any time in the near future. Okay. People are talking about a decade. I really don't know where they're
getting these numbers from. But if you're concerned
that I can take over your job. That depends on the job that you're doing. Okay, if you're a doctor,
if you're a hotshot lawyer, if you're a top engineer, it's
not going to happen anytime soon. But if you're doing something
which is mundane, if you're doing something
which is repetitive, you yourself believe that a lot of this
could be automated or is basically pattern matching, then yes, it is likely
that AI is going to be either assisting you heavily in your job, or it's going to
just take over the entire space. The best thing you can do
here is to upskill yourself. You can learn more about AI. You can learn more about maybe people. How do you interact with more people
and make them more efficient. But don't worry about AGI. This is usually nonsense. Thanks for watching. Cheers.

---

## 3. Why AGI is pure fantasy.
**Channel:** Gaurav Sen | **Views:** 99K | **Date:** 3 months ago | **Duration:** 13:42 | **ID:** 3yEQaHvQxlE
**Link:** https://youtube.com/watch?v=3yEQaHvQxlE

### Transcript:
Hi everyone, this is gkcs. This video is a broad overview
of the AI engineering space in 2025. Specifically, there are two major
things happening right now: 1. We are trying to improve
the existing technology. Large language
models are being improved in various ways. 2. We are trying to solve problems
which large language models cannot solve. Fundamentally, we will have to change the
architectures. By the end of this video, you will know what technologies currently exist in the AI space. What are the drawbacks and how we plan
to improve on them eventually, Till we have a timeline of AGI. All right. So currently most companies
are fascinated with Large Language Models. This is where most of the research
is happening. When it comes to application development. So GPT-5 is slightly better than GPT-4.5 which is much better than GPT-4, which was far better than GPT-3.5. Dollar-for-dollar training GPT-5 is more expensive than training
GPT 4.5. The performance boost here is smaller. The performance boost here, from GPT-4 to GPT-4.5 is larger. So you would expect that
when you go from GPT-5 to GPT-6, the performance boost
is going to be even smaller than this. But it turns out that we have a new type
of model, a new architecture. It is a Large Diffusion Model. You see that stable diffusion is currently being used by OpenAI
to generate images and videos. Gemini is doing the same thing. Gemini is also trying
to use diffusion for coding. Now the interesting thing about diffusion models
is they can train much better on the same amount of data
than large language models. And so
because you have diminishing returns here, it makes sense to switch your approach
to switch your architecture to a diffusion based model. This is great, but it doesn't solve one core problem
that all of these models have. Take the example
where you flip a coin ten times, and every time we get the result of heads. If we are asked to predict
what the next flip is going to result in, any reasonable person
is going to first check the coin and then make a prediction
that it could be 50% heads or 50% tails. But when it comes to a large language
model, it only looks at the previous tokens
and calculates an expected output. So for rarely occurring
or hard to predict tasks, large language
models are really, really bad. They have no internal concept of time,
no internal concept of space, and no way to predict the consequences
of their actions in the real world. Large language models today can't do this. Neither can diffusion based models. But if you had an internal world representation. Or the world model, then you could, using physics or using
some of the constraints of the real world, predict what's going to happen
when you do an action. For example,
if I have the model of a tomato, and if I perform the action of throw, then I know that it's going to be damaged. Okay. If it's an unripe tomato,
maybe the damage is small. If it's a ripe tomato,
the damage is large. If it's somewhere in between,
then the damage is significant. But what I am doing now is I'm not trying to predict
the next token or the next action to do. I'm actually finding a representation
of the world, the world that I am living in, and I'm trying to predict what actions
are going to cause, what results. So the large language model is able to filter out actions
which don't help in this course. It's able to focus more on the actions
which help bring it to its end goal. And currently, the research by Toyota. Around large behavioral models where they're using robots to do
everyday tasks is quite promising. There's also Yann LeCun
with the chatbot architecture, which builds wild models and tries
to solve these problems. However, these do not solve
the problem of continuous learning. The problem with any of the models
that I spoke about earlier is that once you give them data,
once you get the information, they try to do their best. They try to solve the problem on the spot. But if you have trained them on chess,
or if you have trained them on tomato sorting. You can't take the knowledge from tomato sorting
and move the robot to play chess. If you try to do that, then the
information or the things that it learned while sorting tomatoes is going to be lost, the internal weights
are going to be changed, and you're going to be having a bot
which is neither good at tomato sorting, not good at playing chess. While humans don't have this problem, they are able to compartmentalize
or somehow gain some general intelligence such that they can perform
well on both tasks. Humans dream. So at the end of the day, they sleep
and they lose a lot of the useless information
that they don't need. The neural networks are kind of reset
or to be more precise. They retain the information
which they got from this day, which is useful for the future. The remaining information is just dumped
or put into a backlog. That's what humans do. But we do not know how to do this
with a model. Not every biological mechanism
can be exactly replicated in a model. Very often
we are trying to find the competency and then find a mechanism
for that competency. The biological way in which a human does
this is extremely complex for us to even recognize images. There's a lot of stuff which goes on
in our brain, extremely efficient, but you can mimic that same competency with something from the metal world. Okay, most of the topics, such as like Sutton
and LeCun, are hoping that this is solved. The loss of plasticity. Is resolved
soon, but nothing exists for this. Okay, this is the first challenge in the AI space, which is currently beyond
the research side. So the hope again is that by 2030, there will be some sort of research
breakthrough where we can find models
or we can find the right architecture, which is going to have
continuous learning. Okay.
So this is a hope. This is a hope of a hope. And now we are going to go
into a completely fuzzy line. Okay. Things which have not been solved
are nowhere near being solved and which are in the path of AGI. So the first hurdle after learning how to consciously learn is system
two thinking. This was made really popular by a book by Daniel Kahneman, and the main idea was that two
major ways of thinking, two major modes of thinking
were identified system one and system two. System one is fast. It's very, very efficient for most of
the things that you do in your daily job. This is good enough. System two thinking is more involved. It's more accurate, requires more effort. System two thinking is something that models can clear
completely incapable of doing. This includes
the ability to have meta thinking, which means thinking about thinking. Thinking about things
that you do not know. Thinking about things
that you might learn later. The margins are nowhere near this. There's other things also that system
two thinking has, which is when we talk about context window,
the things that you have in your working memory system. Two thinking can pull things
into working memory and push them out as and when needed. Okay, so if you're seeing a five players
playing a basketball game and the gorilla comes in between,
you can actively ignore the gorilla crazy. How do you choose to ignore that? Subconsciously is just something
that models are not yet able to do. I said that by 2030, there is a hope
that we are going to have this solved. I don't see this happening before 2040, but
even if you are believing short timelines, then 2035 is where I can see this
happening. Okay, after this comes self-defined goals. And self defined goals means that an AI system
can create its own objectives instead of following goals
explicitly made by humans. We need the AI to choose
one bot amongst an infinite set of paths. The problem with self-defined goals is
the model needs to have some motivation, so it needs to have a motive. And this is not exactly the same as code. Okay, this is what you are supposed to do
when it comes to humans. There's Richard Dawkins
who wrote the books The Selfish Gene, which means that we are all trying
to preserve our gene. The gene is trying to preserve itself,
and we are basically just mediums by which it's
keeping its information intact. When it comes to models,
there is no such inherent reason to exist. You can try to code that in,
but we don't really know how to code that in very well. In the case of an AI model. If we give it the motive of being good,
doing the maximum good for humanity, then the model needs to understand
what should I pursue? What should I explore? And that always comes internally,
inherently in humans. It's not very obvious how we are going to
code this exploratory phase into a model. This is actually even harder than system
two thinking. Okay. A lot of organisms have self defined
goals. They do not have system two thinking. This is more essential
to the concept of life than the previous things
that we have done. Okay, but let's be really optimistic. Let's say by 2040
we will have solved this problem. Also up very very optimistic. And finally we have governance. But I don't know
when we are going to solve this. I don't know if I have to predict,
but if I'm forced to predict on the fastest timeline
which is possible, then I governance for humans can come up by 2045. So by the time
this implementation reaches the world, 2050 would be the shortest timeline by which we hit AGI. Okay, so in the next 25 years, whenever someone talks about governance
and big things like this taking over humanity,
usually they are completely wrong. There is a lot of optimism
that I've kept here. Like too much optimism. We probably shouldn't
have so much optimism when it comes to developing technology, because there is fatigue in the research
based on one thing. Thank you for watching this video. I'll see you next time. Bye bye. Okay, a short run
until I recently saw a video of Richard Sutton being interviewed by Dawkins
Patel and I would say bookish. If you're watching this video, it's very nice that you bought
such a nice guest to your podcast, but it would be even better
if you could prepare questions beforehand by reading some of the papers
in this piece, or just looking at the fundamentals
of how large language models work. This is also something
I saw in the diary of a CEO. I think with Geoffrey Hinton. Again, the questions there are. So, maybe things that they've already answered
many times in the research and what ends up happening is they are left with giving more clarifications, and ending up arguing with the host
than actually do some sort of exploration, Some of the questions are so bad
that people listening to them might think that this is. This is something to even consider. Like one of the questions was, don't babies mimic their moms in the first
6 to 10 months? And no, they don't. I mean, if you have a baby,
you will know this by default. But if you if you go through basic child psychology,
you will know that this is not true. So asking such a question
then becomes a waste of time, right? Another thing that I see
with AI philosophers in this space, for example, is a very famous quote. I'm a huge fan,
so if you're watching this, but the idea of AI is going to come in
the next four years, cause a revolution and we do not need to
fight for our rights is not true. You know, there's a lot of things
which are there which need to happen
before that can occur. And there is no reason to believe
that AI is going to be very nice to us when we can't even understand ourselves. Despite having all the time in the world. How do you expect us to express ourselves
to systems through code? Our intent, our understanding, is probably
going to be lost in translation. All the problems of humanity are going to exist for many, many decades
moving forward. They can't be solved by AI. That looks more
of a coping mechanism to me. Okay. All right. I have now sufficiently angered everyone,
but I just want to say to the people who I mentioned here, like a lot
the idea of a CEO or person. I'm actually very, very happy
to see you in this space. And I just want you guys to maybe
look more into it so that we can have awesome discussions,
moving forward. Thank you. See you.

---

## 4. 20 AI Concepts Explained in 40 Minutes
**Channel:** Gaurav Sen | **Views:** 348K | **Date:** 4 months ago | **Duration:** 43:34 | **ID:** OYvlznJ4IZQ
**Link:** https://youtube.com/watch?v=OYvlznJ4IZQ

### Transcript:
Hi everyone, this is GKCS. In today's video we will see some of
the commonly used terms in the AI space. If you are an engineer
who is building applications, then you will find these terms useful. When communicating with people
within your team or outside. And I think if you know these terms, then it is also easier to learn
the deeper subjects around AI. So by the end of this video,
you'll have a list of terms whose definitions you understand
quite well. And I'll also be linking some references in the description
so that you can dig into them further. Let's start. The first term that you should know about is large language model. Also known as LM. And the definition
of this is a neural network. That is trained to predict the next term. Of an input sequence. For example, if I pass in the query all that glitters to a large language model, then it's going to come up with the response of is not going okay. At which point the complete response
of all that glitters is not gold is returned to the user. What do we mean by training? What do we mean by neural network? As we go through this video, you will be understanding these terms
better one by one. Okay. The second term that we're looking at
is tokenization. This has to do with processing
the input of a large language model. For example, if all that glitters is passed into a large language model, the first thing it's going to do is break
this into discrete tokens. That is the process of tokenization. The first token will be all. Then there's a space character. You have then that after which you have glitched. And finally also you might think, well, why shouldn't you just break this into space characters
and get the job done? The humans do not talk like that. We are, after all, trying to process
natural language. So ours is a common term. Shimmers. Murmurs. Flickers. These are terms
which have the suffix of ers which means that the action of glitched is being performed by that object. Another example of this is in. So eating, dancing, singing all have the suffix of ING, and a large language
model can look at this token of ING and know that the previous action
is being performed. As long as you have the suffix. Okay, remember, the core problem
for the large language model is to truly understand human language
so that it can speak it really well. Tokenization is an essential part of that. Whose end result is
that the input text is broken into tokens. Which brings us to our third term vectors. Tokens tell you what you should focus on. What is the smallest term
that you can derive meaning from? But what meaning has to be derived is represented by vectors. If the large language model
can map a two dimensional or a n dimensional space. Such that all the words which are close in
meaning are placed close to each other, then the benefit will be that the meaning of these words
will be turned into a coordinate. In this n dimensional space. This is called a vector. Okay. The coordinate. The mapping of a word
in a n dimensional space such that. Nearby words. Similar
meaning words are all clustered together and opposite
meaning words are somewhere far away. Comes
through the process of vectorization. The end result
of this is that large language models know the inherent meaning of all the words
that are in the English vocabulary, and they also know how to break it
into small tokens. Any input text into tokens. Words which are similar to each other
are placed close to each other. Once they know the meaning,
they can construct sentences effectively. Okay,
so now you have large language models which can tokenize input text,
convert them into vectors. But there is one major challenge
which actually change the entire industry here, which made large
language models very popular. And that is attention. We just said that all the input tokens for a large language
model are converted into vectors. The vectors
encapsulate the meaning of those words. But what about the word apple when you say it is a tasty apple, you mean the fruit, the edible apple? When you say apples revenue, you probably mean the company. And if you say the apple of my eye, you are probably talking about
a young person who you have affection for. So Apple has different meanings, and the only way to understand the meaning
is not by looking at the word itself, because that spelling is the exact same,
but by looking at nearby words which add context to the meaning of apple. The moment I said tasty, you know that it's some sort of food
that is going to talk about. That's how humans derive
meaning, and large language
models can derive meaning this way. Now, the way they do this is
look at nearby words in a sentence. Generate those vectors so nearby contextual vectors are picked up. And for ambiguous terms you end up with ambiguous vectors. But you can derive the exact meaning by adding
this nearby contextual vector to it. So take the vector of Apple. Take the vector of revenue
when you add these two vectors. When you perform
some sort of an operation, it's not a direct addition,
but it's the attention operation. You effectively take the vector of Apple and you push it
in the direction of the company Apple. So Google meta, Microsoft are all here. The first operation of vector
revenue is going to send it there. If you instead add a vector of tasty, do this. If you perform the attention mechanism
of these two vectors, then it's going to push the vector
of apple to banana, chiku and guava. Okay, so you can tokenize input text. You can derive the inherent
meaning of all of those tokens. And for ambiguous tokens, for tokens
which are difficult to understand. You have a mechanism
to add context by looking at nearby words. And this is another breakthrough
that large language models have made. This was in 2017. The paper came out then, but in 2022 this became really, really famous
which are gpt2 being released. The quality of responses of a large language model far exceed
anything else that we have seen earlier. Okay, because it is able to derive
contextual meaning, it's able to construct sentences
in a way that humans speak. Okay, so now we know how LMS can process input. But how do you train them to predict the next token? Okay, here's where there was a major breakthrough in 2017. Basically the concept of self-supervised learning. Became very popular. Self-supervised learning means that instead of telling the model
exactly what it needs to do, the structure of the input data is such
that the model knows what it should do. Okay. For example, you're watching this video
right now. I'm going to make a part of this video
blank. So 12345. What do you think is being hidden
right now? What number is coming to your mind? Let's see if that is right. Yes, most of you guessed one
because we went in the sequence five, four, three, two, one. Okay. But when it comes to a video,
you can also do something else. Let me make another part of the video
blank right now. Where do you think
the other AI is looking? Let's check. Most of you got it right. Both eyes are looking upwards. So what's happening is a section of the input can be predicted. Even if you make that section blank, which means that
there is inherent structure. In your input which your mind is able to replace
with the expected token or expected output. Now, the standard way to train
such a model would be called supervised learning, where you would have a human
being say that if the input text is all that glitters,
then the model should predict is not gold. If the input text is at two, then the output should be Brutus instead. Self-supervised learning has made getting test data much cheaper here. If you have a two Brutus, then the model is going to be fed
in this text and it's going to make three
predictions. One, what comes after it? Two what comes after a two and three what comes after it? Two Brutus okay, no, humans are involved. You had some text in the world. Maybe you scraped this off the internet
and now you're taking the model. Look, I have three questions for you. Tell me, what are the right answers? So the model looks at these three puzzles. They are all running in parallel, and they try to make predictions. So it the model might say
now the model might say two. The model might say something, but you train the model
that two is the expected response. So if it makes a mistake then you penalize
the model that increases loss. And so the neural network
weights are updated. In the second task you have at two, if the model makes
the prediction of Brutus, then you tell the model
that this is great. The weights don't need to be updated. But if it says Caesar, then the model has to be penalized. And so the internal weights are updated. In the third case, if you predict a stop
token like add to Brutus, that's it, then you will get it wrong. If it is a comma, you're right. And if it's, then maybe you're also right. Okay. What you're doing is
you are looking at text, which already exists in the world,
and you're creating multiple challenges for yourself
without human intervention. This is what makes the model
self-supervised. It might seem like a small thing,
but this architectural decision or this benefit of the large language
model makes it really, really scalable. In fact, most AI models now are moving
to self-supervised learning. Even image models like we discussed,
are looking for removing some patches of the image
and trying to predict those patches. The benefit of this is you understand
the underlying structure and the inherent meaning of those patches. In the case of text,
it's going to be terms. In the case of images,
they are a bunch of pixels. And in the case of video you might
understand how an object even moves. Okay. So that explains what self-supervised
learning is. Next is the transformer okay. And most people confuse transformer
with large language model, which is completely
understandable actually. But that's not the case. A large language model is something which predicts
the next token given an input sequence. A transformer does the exact same thing,
but it's a specific algorithm or a specific method
by which you predict the next token. A transformer basically is input tokens. Being run through an attention block, which is then forwarded to a neural
network, a feedforward neural network, and then you have a bunch of outputs. Okay,
you can think of these as output vectors. These vectors are then passed in to another layer of attention. The first layer of attention,
like we said, disambiguate terms. The second layer might find more complex
relationships. It might find sarcasm.
It might find implications. For example, a crane was hunting a crab. So in the first case you understood it is
not the metal plane, it's a bird train. But in the second one
you might infer that the crab is fearful. You might understand the crane is hungry. So this is the second layer. And then you have another
feedforward neural network and so on. Till finally you are confident enough
to generate an output. Okay. So you have these stacked. Sometimes they're stacked to 12 layers,
sometimes more. I think recent GPT
architectures are in hundreds. The main idea behind this is are getting all of the meaning
from your input tokens and then manipulating them again and again to finally predict
what the next word should be. This attention lock is order in square. Okay. You could replace this transformer
in a large language model with something else to model. A new architecture could come in,
in which case the transformer and the state space
models are gotten rid of, which could be a diffusion model. That constructs essays or text. Okay, so the large language model
is actually the product. You can think of it as a car. And this is the engine. A car, many people say is just the engine. But no, there are some other fancy
things around it. The internal algorithm can be different. This term number seven, it's fine tuning. We said that a large language model is something that is trained
to predict the next term. Of an input sequence. The question is what type of next token
are we talking about? If you are talking about a medical large
language model, something which helps doctors
explain the diagnosis of a patient, then you're probably going
to be thinking of medical terms. If you have a model
which is trained on financial operations. Then the same model for the same query is going to think
in terms of financial terms. So the next token that the model comes up
with is not always going to be general. You're first going to train your base
model. In a self-supervised fashion. Then you're going to take that model and make it go
through a series of questions and answers. This process is called fine tuning. And goes something like who is the president of USA? Donald Trump? But the model could also say, I would like to know that too. Here's where things are going wrong okay. The model should not be responding
like this. Give us a direct answer or confess
that you do not know. Or you could say no. But then this is also very, very bad
because the models are trained to be helpful. Okay, so what's happening
is other plausible responses which are not wrong but are not desirable, are penalized in the fine tuning process. You have these questions and answers. The fine tuning process
forces the model to take a question and give answers. As expected. So when it comes to a medical diagnosis,
the model is going to train itself. The internal weights will be updated
in such a way that it will learn to speak
in medical jargon or medical terms. And so this step, where a base model is trained to answer in a specific
way, is called fine tuning. The same base model can be run
through different sets of questions answers to come up with multiple
fine tuned models. So the base model of Lamarck can be fine tuned by a company to answer that customer's
specific queries. A few short prompting. So the main idea behind future prompting is before you send a query
to a model, before you send a plain vanilla query to a large language model
and ask it to come up with a response. You augment the query. You add more information by saying, look, if the query is where is my parcel? Then let me tell you that there are some
examples that I want you to go through. This is happening during inference time
during response time in production. Right? Life, your system, your server sends
the original query and sends examples to the model so that it takes this into context
and then gives an appropriate response. The quality of the response goes up. This is called future prompting. It's basically example prompting example in prompt. That's it. It brings us to point number nine
which is very interesting and is completely exploded,
which is retrieval, augmented generation. In fact, the AI space is moving so quickly
that people are saying rank or retrieval
augmented generation is already dead. So the basic idea again,
is that you have a large language model and you pass in the input from the server. So a customer connects to you here
they hit your API. The server says, you know what
this is the customer query that is forward
that to the language model. Along with that let's give some examples. So that's for short prompting. And along with that,
since there are some company policies that I want you to know of, last language
model, I'll give you those documents. So in real time the server goes fetches
the most relevant documents. Maybe your policy document, maybe your terms and conditions. When placing an order,
and maybe many more things. Right? You send these documents along with
examples of how you should respond. This gives you a good idea
of the format of the response. This gives you a good idea of the company
specific context, and this is the direct user input query. Okay, with all of this,
the large language model tends to give very high quality responses. Now the question is where
are you getting these documents from? How does the server know which documents
are related to which query? There are many ways to do this. If you talk to Neo Forger,
which is a graph database company, they will tell you
you should store things in a graph. DB. If you talk to neon, then they will tell you that
you should store things in a vector DB and some people will say
just keep everything in memory. Just keep everything in cache. This doesn't matter how you fetch
the documents, doesn't matter so much. Usually it's a vector DB by the way,
because. But I mean it is easier to find relevant documents
because you just do a similarity search. Once you have the documents,
you pass that to a large language model. The large package model converts
it internally into vectors and then gives you a response. Okay, but at a high level you just want
to add more and more context. You retrieve the context,
augment the query, and then generate a response. The 10th term, which is vector database. We just mentioned vector database
is something which is used to find relevant documents
for an incoming query. Let's see how that happens. You have the request. I am upset with your payment system. I expect a refund. This is a lot of terms in this query. A human being can read this and easily
understand what the user is feeling. They are feeling upset. I mean they've already mentioned it,
but they are looking for a refund if you give them a refund,
maybe the upset feeling will go away. What do you do? Which documents do you search for? You could search for all documents
where the word upset exists, but maybe you do not have it
in your company policy. Maybe nowhere is it
mentioned that a user is upset, but you have a document which mentions if the user is giving you a low rating, or if a user drops off. How do you make that decision
that upset as a word, is close to the low rating or drop off? We spoke about vectors. Vectors can encapsulate semantic meaning,
which means documents which store similar words are going to be similar or close in distance. Remember,
vectors are basically coordinates, right? So the distance between upset
and documents having low rating are going to be low. You will fetch the documents
which mention low rating or drop offs and use them to add
context to your large language model. When you have an incoming
query from the user. You're going to find
which document is closest to the query and add that to the large language
models context. So this document will be sent
along with the original user query and maybe a system prompt. Where are you going
to store these documents in a vector database, which helps you perform
these similarity searches efficiently. Some of these algorithms are hierarchical,
navigable, small world. We have spoken about this in detail
in the interview. Right course at the end of the day. The vector database
is like a black box to you. You can store documents and you can
quickly retrieve them when you need them. Great. So you can store internal company
documents and information in a vector database
to get context for a large language model. But what if the context exists
outside your system? So this challenge was met with model context protocol. Okay. As the name suggests, it's a protocol
or a way to communicate the transfer context into a model. The basic
idea here I made a detailed video on this. You can check it out,
but the basic idea here is that you have a large language model which, before receiving an incoming query from a user. Has a client, an MCP client model,
context protocol client which forwards the initial query user query. The LLM now makes a decision. It says that there may be external
tools or databases that I want to connect to. The client gets to know of this and connects with external MCP servers. In one case, that might be Indigo. In another case that will be Air India, whose MCP server
can give you details around Air India. So you can think of this as a wrapper
for Air India's database. This as a wrapper for Indigo's database. As a response, you are going to get flight details. From each of these airlines. Once you have the details, you can forward it to the alum
saying that hey, along with the user query
and along with whatever system from the relevant context
that I could get from my vector database, I'm also adding flight details, real time
information from external servers, which you can now consume
to come up with a decision. Okay. And the large language model at this point
might say, okay, book flight number i.e. Indigo 1020, which then results in another API call to book on the MCP server of Indigo. Okay. The response
final response is given to the MCP client. The client
then forwards it back to the user. Result in customer satisfaction. Okay. You see that the user is no longer
just able to get data up. They do not have to do things themselves
after being given the recipe. The recipe can be completely
executed by the MCP client. Okay,
so this makes LMS a lot more powerful. MCP has picked up a lot of popularity now. Okay, so all of this put together is called context engineering. If you are an engineer,
you have probably heard of this term. And basically this is an encapsulation of many of the things
that we have already discussed. We discussed a few short prompting, which is giving examples. We discussed retrieval, augmented generation, which is getting relevant documents from a vector database. And using them to add context to a query and using model context protocol to hit external servers. And perform actions as needed. When it comes to context engineering. This two new challenges
that we are facing as engineers. One is user preferences and the second is prompt summarization. You can call it context summarization. For example,
you might use a sliding window. Where the last 100 chats are sent directly to the large language
model, and all the previous chats are summarized
into five sentences, just. This limits the max amount of chats that you are sending
to the large language model. You could use other techniques also. For example,
some people just focus on keywords. Some people focus just on the last chat. So one chat and the previous
entire history summary together. The idea is to get context summarization
this way when you get a document, you again
summarize it first and then send it. So this can be done
maybe using a cheap small language model or a distilled model. And once you have generated the context, you send that to the expensive
large language model. You see, the main difference between
context engineering and prompt engineering is prompt
engineering is for one single prompt. It is stateless. Anytime you ask the large language model
to behave in a particular way, the system prompt is going to be the same. But context engineering evolves as per the user's declared preferences
and also the previous chat history similar to what it was earlier,
but this is more long term. Which brings us to the most long
term thing you can come up with in the air space right now. Agents. I've taken a detailed video on this,
so do check that out. But at a high level,
you have a long running process. Which is known as an agent. You can think of this is a server
which is getting an API call. And this has many capabilities. It can go and query and LM. It can also query external systems. And other agents. To meet the user's requirements. Let's take an example here. Let's say your travel agent
can look into booking flights, booking hotels and even manage your email
when you're away. When it sees a window of opportunity. Maybe the flights then are cheap. It goes ahead and makes the booking
according to your preferences. All of this stuff
can be managed by an agent and the most hyped term here. Is reinforcement learning. It's a way in which you can train models
to behave in a particular way. So, for example, if you give a query
a user query to the model, the model can generate two responses response one and response two. You must have seen this in ChatGPT. Choose the one which is better. Okay, so the one which is chosen
gets a plus one. The other one gets a minus one. What happened
effectively is you took a user query. This entire thing
can be mapped to a vector. And the vector is an n dimensional space. So you go to that coordinate and you tell the model that look
after reaching here you generated
further tokens for the vectors. So that's your path. You went from here to here to here. So this was the final point of response. And now you got a score of plus one. So this gets a score of plus one. This also gets the score of plus one
plus one plus one plus one plus one. It's also discounting that you can do. But for now let's just keep things simple. This is a nice path. You always want to follow this path. Response two was bad there. You followed this point to this point. This point, and then you deviated. The next token that you generated
after the first three tokens, let's say, is not going. And then you did a comma here and went, but it may be so token one, two, three for token one, two, three four. Okay. This was bad. It got a score of minus one, which means
this area gets a score of minus one. This also gets the score of minus
one, minus one, minus one, minus one, plus one takes it to zero. Minus one plus one takes it to zero. Minus one plus one takes it to zero. So what you're doing is you have a space where you have negative scores,
positive scores and neutral scores. If you do this enough, then you will end up
with a space, a vector space where given an input
query, given a starting point, you will have a space of negative
where you do not want to go. You will have a space of positive
where you definitely want to go. And the more positive
it is, the more you want to go there. Okay, so maybe you go here. From here you have another
very positive space which is over here. This is like hill climbing, right? You're
basically trying to optimize on the path that you're taking as a large language
model. The expectation is that the final result
will make the end user happy. Okay. If the end user experience is good, then
the model is trained to make users happy. That's what is reinforcement learning with human
feedback. Human feedback is telling you
whether it is a plus 1 or -1, and the feedback is helping you reinforce good outputs. This is an extremely powerful technique. In fact, it is seen in nature. If you know about Pavlov's dog,
then there was this situation
where Pablo would press a bell and give food to the dog when it would come
after pressing the bell. Eventually he realized that if he just
presses the bell without giving food, the dog already comes and starts
salivating because it's expecting food. So its behaviors have been reinforced. Fortunately, this is not the only
capability that human beings have. You cannot model human intelligence
using just reinforcement learning. I'll take an example. Let's say you have a coin
which is giving you heads. Heads. Heads. Heads. Heads. Heads. If you know that this is a fair coin. If you have a mental understanding
of how the coin works, then what do you think is coming next? Heads or tails? Okay. With what? Probability? Okay, so I just looked at the camera and said,
okay, okay. Twice. Something's going on. But as a human being,
you should look at this and say if it is a fair coin,
if it's an unbiased coin, then it can be heads or tails. You can't guarantee
that it is going to be heads next. But reinforcement learning looks. It observes the real world and based on
that makes a decision. So when it predicts heads
it gets reinforced. Great job. When it predicts tails, it gets punished. Bad job. But the reality is this is a fair coin. So there's a 5050 chance of either. If you ask a human being,
you show them the coin. You tell them that this is a fair coin,
and then you just keep flipping the coin. You get a lot of heads. They're just going to say 5050 because they have an internal
representation of how the coin works. They have a mental model
of the physics of the coin. While reinforcement learning cannot build
mental models, they can just tell you based on outcomes what is more likely
and what is maybe a more beneficial path. Okay, we are not crocodiles.
We are humans. We have a deeper understanding
of how things work. Having said that, reinforcement
learning is a powerful technique. It does make models get smarter. Quite smart right? Chain of thought. Pretty simple concept, but very powerful. When training the model, we
clearly explain our thought process here. The expectation
is that as the model trains to break a problem step by step, it's
going to look at newer problems with different parameters
and still be able to reason through them because it has been trained to reason
step by step. This is called chain of thought,
where the model goes through a series of deductions or inferences
and comes up with the final response. The quality of this response
is usually much higher than a direct response. As you can see,
this is similar to a few short prompting. The quality of the response is higher. It has some examples to go through,
but here the key difference is that there is a step
by step breakdown, and new steps can be added by the model
as it sees fit. Because it is trained on so much
training data, it may be able to reason to add more steps as the problem gets more
and more difficult. Okay. In fact, this is something
that has been seen by deep seek. If you make the problem harder,
it goes for more steps. If you make the problem easy,
then it goes for fewer steps. So this is called a reasoning model. Okay. They do not
necessarily need to do chain of thought. They can also use other algorithms. For example there is tree of thought graph
of thought also that you can go through. You can use tools also to come up
with better reasoning, but a model that can reason, a model
that can figure out, given a problem, how to solve that
problem step by step is a reasoning model. This is also known as L or M's. Okay,
examples of this deep seek and OpenAI. I mean the O one and O three another. All these models but they newer models with new capabilities. Now multi model models. Okay. So the basic idea is that most large language models
that we know of operate on text. But what about models which can accept and create images, generate images. What about models which can accept and create videos. Okay. So they can analyze images. They can tell you the number of apples
in an image, let's say. Or they can modify an image
to create a new image. Similarly for video,
these have tremendous application similar to how large language models
have changed the marketing space. To textual content. Now, social media is rife with large
language model content. Images are going to get better and better,
and video can be a really big deal. Because if you have celebrities. Who can create video? You can create
ads through large language models. Then the cost expectation of creating
video is going to go down okay. This is already happening to some extent,
but the quality of the models are not very good. Multimodal
in general means any kind of mode of input data. It turns out that their performance
is better than models which are just trained on text. Okay. They have a deeper understanding
of the meaning of objects. If you train a model on cat and feline and so on,
and then if you show it, images of cats, then the performance of the model,
the output quality is usually better. Okay. The training is better. Fine. Let's get to three major topics, which is where the AI space is heading. Okay. People are looking for more company
specific smaller models. Foundation models. The reason for this is companies
want more control over what they generate. They also want to keep the data
close to themselves. They don't want to expose it
to any other third party company. So one of the things which is happening
is we are looking at smaller models. Of small language models. As you can expect with the words
have fewer parameters than large language models. For example, a small language model may
have 3 million to 300 million parameters. Okay, the neural network internally
has fewer connections, fewer weights. But if you look at large language
models, contrast it. You have 3 to 300 billion parameters. So this is a very large neural network
with a lot of weights in a LM. But the SLM is smaller. But they are useful
because they are trained on lesser data, which can be company specific. Or task specific. For example, a bot which is trained on
just customer queries, how to manage customer queries, how to make
sales is likely to perform decently well. Okay, it's going to be an expert at sales,
but it probably can't tell you a detailed weather analysis. For most companies, this doesn't matter. In the case of NASA.
This is what you need. You are probably not
selling anything openly, so maybe you are. Who knows? But NASA would be more interested
in building a foundation model which can predict the weather,
but not bothered about the sales part. So in this way, smaller language
models are being trained by companies on their specific data,
on the proprietary data to come up with reasonably good responses
for specific use cases. And the process of building small language models is usually distillation. The basic idea is you have a large language model, which is a teacher, and then you pass in some input. You look at the output of the large
language model, and in parallel you also send
it to a small language model. Okay, with fewer parameters. You and it also tries
to predict the output. So the teacher produces an output
and the student tries to mimic the teacher. If these two outputs match, then
the small language model is doing well. No weights need to change,
but if it is not doing well, then the internal weights
of the small language model are changed. But there is a limited number of weights
assigned to this model 3 to 300 million. What you are basically trying to do
is condense this information, the the complex neural network,
into the most reasonable representation that you can have such that your performance is okay,
but the costs are significantly reduced. So during runtime, during production
inference time when you get a query,
this is going to be much faster at responding as compared
to this large language model. It's also easier to host. Okay. Distilled models take us to the last term
that you really should know if you are the engineer,
and that is quantization. Here the idea is that you have neural networks. Each of these weights is basically a number, let's say a 32 bit number. What if you could take these weights
and condense that information into eight bits. Then 75% of your memory
is expected to be saved. It doesn't directly map over here
because the weights are usually just done on the feedforward neural network. You still have the attention mechanism,
and also the training cost is the same because initially you come up with a
really good model with zero quantization. Once the model is completely trained,
that's when you apply quantization. So the training cost does not reduce. This is mainly to reduce inference cost or during production. The cost of running a model. So these are the most important 20 terms that I want to discuss
in the engineering space. I think knowing these terms
will help you effectively communicate with any other engineer
or people in the team. I couldn't go into enough detail here
because, I mean, when you're talking about the attention mechanism or quick action, you cannot do this
in a 20 30 minute video. But the things you should know about
are these terms. And also most of the things that are mentioned in the engineering
course are going to be ready. If you know them, then you
truly understand how these models work. And all of the hype and nonsense
which is going on in this space, they become hype
and nonsense to you, right? You are able to recognize it much better.
Thank you for watching. I hope you enjoyed the video.
I'll see you next time. Bye bye.

---

## 5. Does AI improve developer productivity?
**Channel:** Gaurav Sen | **Views:** 28K | **Date:** 5 months ago | **Duration:** 20:17 | **ID:** Xan5JnecLNA
**Link:** https://youtube.com/watch?v=Xan5JnecLNA

### Transcript:
Hi everyone, this is GKCS. In today's video we talk about the impact
that AI has on software engineering. Specifically,
we talk about the productivity gains or losses, due to AI on software engineering. So if you are a software engineer or an engineering manager, you will find this
video useful by the end of this video. You know how I generally affect
the productivity of an engineering team. Okay, so there is a lot of talk around how AI is changing
the way that people are writing code. But I will be quoting mainly research
conducted by Stanford University. I found this to be very good in the sense that it has been conducted
on hundreds of private repositories, both. The benefit of this is instead of using public repositories where people
sometimes contribute when they are free. Private repositories are for companies. So this is much more like the day
in the life of a software engineer. The second thing is that the data set is large. So this is 2 billion plus lines of code. Okay. With thousands of commits. And finally it was conducted
with over 50,000 engineers. So unlike the recent studies
that you might have seen, which conducted a study with 35 engineers
and they came up with conclusions. So this is not like that. This is having lots of engineers, lots of
lines of code and, private repositories. So the quality of the code is also high. Let's see how the use of AI impacts
the productivity of software engineers. The first thing is
if you have something called greenfield tasks, which means you are starting from scratch, there is no code written
or a new file has to be generated here. AI tends to perform very well. The second thing is, if there is low complexity. Meaning it's an easy thing to do. Maybe you are just doing some sort of Crud
operation. AI is very, very good at it. So low complexity greenfield tasks. There is a 35 to 40% increase in productivity, 35 to 40%. Meaning
if you have a team of five engineers, three
are now sufficient to do the same job. But if you have greenfield
and high complexity tasks, meaning this is a difficult project
and you are starting with it fresh, but it's complex,
then you have a 10 to 15% improvement in productivity. Okay. Which is good. No doubt 10 to 15%
additional productivity. Meaning you have if a team of six
or a team of ten 1% can be asked to either leave or join some other team,
they are surplus strength. Now, now, if you have low complexity, but it's not a greenfield
task, it's not a fresh task. It's a brownfield task. So some sort of refactoring or change in code results in 15% to 20% improvement in productivity, which is quite good. Okay. But finally, if you have complex tasks and it's not a new project,
it's not fresh. Then you have an improvement of 0 to 10%. In those tasks thanks to. Yeah okay. So it's not negative. I mean in rare cases
it is negative, but in most cases it's in this range 0 to 10%. Overall there is a clear benefit
of using a in companies. Okay. Whether it is high complexity brownfield
tasks or low complexity greenfield tasks. It's useful. But there is one thing to note,
which wouldn't be the case for most of us
if the language that you're using. So the programing language can be Go or Python or Java or C plus plus,
if this language is popular, then the benefit of using AI is higher because large language models
now are trained more on popular languages. Okay, so the quality of the output
is going to be higher. But if you use lesser known languages
like Haskell or Erlang. Then the improvement is going to be less
so okay. Which means that if you are going to write
WhatsApp, Erlang and you are going to have existing
WhatsApp, the app already there and you're trying to use AI on it,
it is possibly high complexity. Maybe some parts of the complex
app are being changed, then this is probably going
to go into negative to positive 5%, which means using
AI is pretty much useless in these cases. Okay. But then these are rare cases. You are using a lesser known language
and you have a complex task with an existing system, right? So whenever you're going for AI,
just be aware that there are certain cases
where things can get difficult. So overall, should we use
AI in our organization, in our projects? The answer seems to be a resounding yes. For most companies, most use cases,
AI is going to reduce the amount of work
that a software engineer needs to do. So that's going to boost productivity. You're going to have surplus workforce. You can either let go of this workforce, or you can have this workforce
working on newer projects. Okay. And if you're an AI engineer,
then what you want to do is truly understand
how to use these tools. Well, maybe you want to look at prompt
engineering context engineering. Some of the things that you can think of
doing is chain of thought. So if you're writing any piece of code,
think about this. Maybe you want to give examples. So we do this when writing unit tests
anyway. Think about what is going to be input
and what can be output. Maybe you also want to give references. So this is like guiding the
AI to the right sources as an engineer. These are some ways that you can improve
your prompt quality. Okay. So that's it for this video. If you have any thoughts or suggestions on
this, do let me know in the comments. I'll see you next time. Bye bye. To truly calculate productivity increase or decrease in in
software training because of AI, you need to look at
what should be measured. So one thing that we could measure is lines of code added or removed. By an engineer or SD. This is a bad idea if you measure the productivity
of an engineer by the number of lines of code that the right,
then easy tasks or project start up. Requires
adding thousands of lines of code. But the complexity of this. Is very, very low. Okay, it's
very easy to start up a project, but it's much harder to work on a project
to maintain a project. Fixing bugs though. Refactoring code. Improving readability. Focusing on dependency injection. Reducing coupling. Adding the right data structures. Usually require fewer lines of code. Okay, so productivity cannot be taken
as number of lines of code. This is rejected as a metric. The second thing that can be used to measure productivity is tickets result. And if you are a team,
then you're probably thinking of starting tickets result. It's also the story points of each ticket. Okay, it's a good metric. It's a nice attempt, but the problem is
this is usually inflated. If you're going to ask people to complete more story points,
then for every task that they have, they're going to inflate the number
of story points that they'll take. For example, if you believe that
a task is going to take two days and you know that your story points are being measured
for your next promotion, then you say that this is actually a much more complex task
and should be completed in four days. Now, the benefit of this is
even if you complete this in three days, then you have one day buffer. And so you have saved 25% of the company's
time. Also, if you complete a lot of tasks here, then the total amount of work
you're going to complete is a lot more. So your predictions
should be extremely pessimistic. If you're looking for gaming, this system
so tickets resolve the number of story points in these
tickets is not a good metric. It's not acceptable in this case. Okay. This is some sort of self-assessment. How hard are the
tasks that you're solving? The third one is a direct self-assessment which we can use
for assessing productivity. And this is by far
the worst metric you can ask engineers. When you ask engineers
how good are you at coding? Or, you know, solving problems,
then they are off by 30 percentile points, which means that you might think
you are a ten x engineer with a 90 percentile score, but in reality you are at 60 percentile. Okay, so you are slightly better than
average, but not as smart as you think. Similarly,
you might have imposter syndrome because of which you think you are ten
percentile, but you are at 40 percentile, which is not so much worse
than the average. Knowing these things. How do you accurately measure the productivity increase or decrease due to AI in a software engineering job? And the answer to this comes from machine learning. How do you accurately measure
the productivity increase or decrease due to AI in a software engineering job? And the answer to
this comes from machine learning. So you have, let's say, a comment or a pull request. This is written by an engineer. And evaluated by two different judges. The first one is a set of human judges. So in this case the applicant 15 judges. And the other one is an AI model. Okay. It's not a large language
model, it's just an AI model. So it's trained using machine learning. And how exactly is a trained. You send the code to this model. You send the code to these
human evaluators and they score the code. This code is on different metrics. One is the complexity of the given task. So out of five, maybe
you want to give this a score of three. The second thing is where any data structure is used. Sort of five. Maybe you want to give it a score of zero. There's no data structure used. What about the quality of API contracts where the signature is used. So you want to give it a score
of four out of five and so on. Now you take these scores and you look at the scores of the
AI model. On complexity. Data structure use. API contract quality and so on. What you are effectively trying to do
is train this model to mimic
the behaviors of these human judges. These experts. So if the human judge
gives a score of 0 to 5 and you give a score of four out of five,
the difference is the loss that you have. Similar to supervised learning. That difference will then be back
propagated and the model will be updated. So you can imagine
a neural network over here which is being constantly updated as per
the difference between what you predicted as a score
and what is the actual score. Now, if you do this
for thousands of commits. Over hundreds of companies. The expectation is
that the model will start mimicking the capabilities
of the human judges quite well. It will start noticing how the complexity
or data structure or API
contact scores are scored by the humans. And now,
because this AI model is trained well, you can extend it to the remaining
millions of commits. Written by 50,000 engineers. Okay, so initial training
is done on thousands of commits. Later on you extend it. You basically scale up
this judgment process. All of the judgment happens
through the AI model. Data. And with this with the AI model judge,
you can tell how useful the code was
which was generated by AI. So initially you have humans
and AI generating code here. Sending that for human judges to evaluate. They come up with the score. The AI model tries to mimic this score. Eventually, after the model has been
trained, you take all sorts of code written by engineers and AI and evaluate
that with this smart AI model. There's something called AI. 2027. This is a report by an ex open
AI engineer, which talks about how different systems
are going to be developed in the US, from GPT four to GPT five to agent one. Which is eventually going to be copied by China to something like agent. 10.7. I'm just paraphrasing here. Basically, the gist is China copies the US looks at this
and says we need to improve the go to agent two. China copies that to make agent 1.7. And then US improves on it further. Eventually the agent becomes self-aware
because it's so good at hacking systems that it can enter any system
that it likes, including nuclear or bio weapons. And now humanity is at risk. Here you have two possible scenarios. AI development
slows down or humanity is wiped out by AI. The only thing missing in this is time
travel and aliens. Now focusing on the technical problems
in this report. Firstly,
we know that large language models with higher training
are getting lower return on investment. Okay, so scaling of these models further
and further don't seem to be solving the problem. You need new architectures for this. So just by calling it
agent one instead of GPT six, it's not going to really improve
its intelligence. Okay. There's a fundamental flaw
in the way it thinks. We spoke about this in the last video. The second thing is assuming
that I can have self defined goals is absolutely stupid. Okay. AI at this point has difficulty
even defining subgoals. So if you give it a goal of, let's say, win a game of poker, then it's great
because the number of actions it can take is limited, and the number of states
it can go to a clearly defined. Okay. So you can perfectly
simulate the environment. But when it comes to the real world,
I cannot define its own goals. It has no purpose okay. It has no motive. So to think that through magic,
at some point there's going to be a transition
where motive is going to enter. AI is it is farfetched, okay. To say the least,
this is equal to the time travel loophole. Anytime you ask people, how is this going
to be possible in Terminator two? And they say it's true time travel. Okay. So that is how the self defined goal. Looks like. And finally the systems
that we are talking about, the nuclear weapons
or the biological weapons, they aren't done through alarm prompting. They actually have deep math proven math to stop intruders
from entering the system. So if you look at cryptography. And physically secure systems. Then breaking into these systems
is really, really hard. Okay, a large language model or an
AI model doing this seems extremely hard. At least I don't see this happening
for the next 20 or 30 years. You will have to exceed human intelligence
to be able to do this. Okay. Which is not close at all. So yes, this entire report
seems more of a sci fi movie. Right now it's September 2027, and already
I think the predictions are starting to fail. So yeah, any time
you see any kind of report like this, which is talking about Armageddon
or doomsday scenario, really focus on a few things. First, does the villain have plot armor? The villain has plot armor,
then it's a horror story. If the hero has plot armor,
then it's a hero story. Okay, in this case, I has plot armor. It can do anything. Literally anything. The second thing is,
if the timelines are really close, if the timelines are, let's say
2015 or 2055, I don't know whether
this is going to be possible or not. No one can predict it,
but at the time, it's really close. Then you can look at the existing research
and make reasonably good predictions. This sounds like nonsense. It's just two years away. And finally,
if there is a lot of fancy geopolitics or AI terms involved
like they could have called this GPT six, but they called it agent one
because it sounds cool. Agent oh yeah, it's tough. And China is involved somehow. China doesn't need to be involved
for this story to be true. It could be that US just goes from
agent two to agent ten, right? That could have been the story. But no, it needs to be some game theory
involved here. So when that's the case, someone is imagining cooking things up in their own head. And it doesn't make sense. Okay. So really long rant. I'm sorry, but I wanted to address this because a lot of people have given
a lot of attention. On the best.
I'll see you next time. Bye bye.

---

## 6. AI Trends in 2025
**Channel:** Gaurav Sen | **Views:** 140K | **Date:** 5 months ago | **Duration:** 19:42 | **ID:** _bbuRFT2l-Q
**Link:** https://youtube.com/watch?v=_bbuRFT2l-Q

### Transcript:
Hi everyone, this is GKCS! Today's video will be a little different
from our usual research paper analysis. It's going to be about predictions
in the AI space and this is a risky topic to pick,
but I will try to keep it as fact based as possible, as close
to the existing research as possible. But we are in 2025. AI is really, really hot,
and so making any predictions for 2030 or 2035 is going to be a challenge. You can let me know in the comments
whether you find this video useful. The main idea of this video
by the end of this, is that you have a decent idea of what is going
on, what are the current trends here, and potentially what are the market forces that are driving the search in the
AI space. So let's start. All right. One of the things that we should really
look into is the return on investment from scaling large language models. Okay. And the return on investment from GPT 3.5, the training of GPT 3.5 to GPT four. To GPT 4.5 to GPT 5.2 is lower and lower
and lower and lower. Okay, it's not that the models
are not getting smarter, it's just that they are not getting as smart
as you would have expected them to. So these large language models,
when trained on more and more data,
when trained for longer and longer, are having larger neural networks
with more and more parameters. But the return on investment
is not worth it. Okay, or should I say
the return on investment is less and less? So every time you do this. This is just one company, GPT. So is it not the case for Gemini? Is it not the case for Deep Sik? Is it not the case for Kwan or Lama? But all of them seem to be suffering
from the same problem. Low return on investment
for more and more scaling of the models. That's one trend. The second thing which is happening
is that most companies
are now looking at cost optimization. So if you have a large language model, can you run that model for cheap? If you are going to use
an API of a large language model, can that API cost be low? Okay, so it's now cost considerations
more than intelligence. One of the reasons for this is because companies are becoming
more and more savvy at using these models. So they're bringing in domain knowledge when they are making queries to these
models, resulting in good performance. Even if you use a, let's
say, small language model, which really helps reduce costs. Now, if you are going to use
a small language model, you are probably going to train it
yourself. Okay. As a medium
or slightly large organization, Netflix, various
other organizations are doing this. So the LMS, the LM providers like OpenAI are under pressure to reduce costs because intelligence
is not really increasing. One thing you can do is reduce costs
so that you get more customers and more use of your existing products. And the third trend that is quite popular and quite interesting is company specific. Models. These are different from large language
models. Those models are trained on very large
sets of data, and they are trained for general intelligence. But when you're looking at company
specific models, for example, NASA has one
which is able to predict forest fires. It's able to predict glacier movement. If there's floods, then it's able
to quickly detect and track that. Swiggy has one for finding out preferences of a user
when they're ordering from a restaurant. Netflix has something
for their own recommendation engine, so people are building
their own foundation models. Trained on company specific data. And this is really helping companies
do well. Instead of firing queries
at a general intelligence model. There are various reasons for this. One is you are expecting that
the cost of a small language model or a company
specific model will be less. So. The second thing is
you have complete control over the model. And the third thing is
that the data quality is much higher. So for those factors
you can call it a market force, but it's also a trend that is taking more
and more company specific models. Okay. So the three trends that we notice
here are one reduced ROI as the model scale. Second, people really want low cost as
they're using these models more and more. And thirdly,
companies are building their own models. These give us some clues as to what
the future of AI is going to look like. But now let's look at market forces
before we make the predictions. The first thing that's happened is that the hype around
large language models has gone down. Strongly gone down. This happened before Chang GPT five, with GPT 4.5 being released. People were wondering,
is this really better than four? I remember when 3.5 came out. Of course, all of us were stunned
by its performance, and rightly so. We for the first time saw a bot
which could hold a conversation, which could give recommendations,
which could do search for you is crazy. Was very, very good. Four was better. Much better. It had the idea of rank higher, I think, external tool calling. A lot of the things that you're looking
for were there and for image generation. So that was amazing. 4.5 and four hardly had a difference. And five and 4.5, I think, are just there's almost no difference,
except that the cost here is much less. So. 3.5 came out in 2022 November 4th came out in 2023, 4.5 came out in 2024 and five came out in 2025. In 2022, the hype around
I was at its peak. So this I would give it a score of 100. Hype score
and the person to blame for this or the company to blame for
this will be OpenAI. You can understand why
their marketing message has to be strong. They need people to use the large language
models. They need people to invest in them
and believe the key to the future
is being held by OpenAI. Someone who didn't do this was Google. Google was oddly quiet
about the capabilities of large language models in future. And Lamar
actually went on the open source route. Okay, so meta open source Lamar. And they were hoping that people will use
AI to build applications, which then can be,
you know, controlled by meta. But 2022, everyone
thinks that AGI is around the corner. Sam Altman talks about six months,
nine months says that. Have you past the singularity or not? Ridiculous statements
made on purpose to create hype. Very successful, very good strategy. Works out. Let's go to 2023. When GPT four comes out,
it really is a significant improvement. Not only can it get the latest data, but it also has multimodal capabilities. So the improvement was significant. I do not know anyone who said
that 3.5 is still better than four. Okay. It was it was an obvious improvement
and companies were ready to pay top dollar to get the best AI that they could. It's also at this time, around this time
when Mark Zuckerberg, meta said that they're going to create
an S2 level intelligence. Okay. Within a year. So 2024 or 2025 at most. Now, this was a tall claim, and it seemed realistic
because I could generate code quite well. Score this pretty decent. It could also review code quite well. It seemed like if you improve it
a little more and give it domain specific information for generating code,
it's going to do really, really well. A lot of other companies
also came in Anthropic Gemini perplexity. A lot of these companies came together
in 2023. They started becoming popular in 2024. The hype around I had reduced the reason
being in one year or one and a half years, most companies
had started experimenting with AI and some of them had started understanding
what's going on. So the knowledge gap
which builds hype, had reduced. People understood that even after giving domain specific information,
these bots are not reliable. They have some code problems. One is that they hallucinate. So they're unreliable. The second thing is that they cannot set their own goals. So they require handholding, which is the entire subject
of prompt engineering. And thirdly, they're incapable or incompetent. Which we can clearly just call not AGI. Okay. This does not mean that
these models were not useful. A lot of AI that you see now has replaced
software engineers. So generating boilerplate code
or generating an email or generating something from scratch,
the formats are fed so well into this, into this element
that it can generate the initial draft version of code or emails or text or blogs
very well. In fact, the entire websites
which are running on pure AI. Okay. Because what they do is they try
to summarize things well, having said that, the hype around LMS has gone down
from 100 to maybe 50 right now. Half the hype that you had earlier. The second thing to consider when it comes to market
forces is the lack of data. To train these models, it's not a lack of infrastructure,
but a lack of data. So if you think of large language models,
you initially have data that is being gathered by. Either you write pages, you write blogs,
you create videos that is then processed. Which is basically training
a large language model. And then you have model solving. And then you have applications being built
on top of these large language models. So if you are in this space,
let's say OpenAI. You want to convince app builders that LMS are the best thing
after sliced bread. If you are Nvidia, then you want to do the same thing,
because as people build more apps, they're going to use more models
serving companies and eventually that's going to end up
with more GPUs in the market. But for this pipeline to keep getting fed,
you need lots of data and you need new techniques
to process this data. Okay. So the processor is being sold GPUs,
but you need algorithms here which are going to be powered by research. A lot of funding has gone into research. You would expect that
neural neural algorithms keep coming. But research has its own pace. It requires
time to come to the real world. So that means you have only one lever
to pull. Which brings us back to our first problem
of diminishing returns. As you are scaling these models
up, as you are bringing more and more data into these models,
they really aren't becoming much smarter. And in fact, there was a question,
I think in one of the interviews, Sam Altman asked his chief
data engineer that, do you think we are
going to hit AGI in GPT 60? And the engineer who has has built, you know, for five
or at least led the teams said that I do not think GPT is going to do it okay. Which means I do not think large language
models are going to go in the AGI space for various problems
that we discussed. The hallucinate,
they have no way to set goals. They are internally not consistent. You know,
they do not have logic, internal logic. If they say that from a you should go to B and then you say,
what are the substeps here? So from A actually we should go to A1
and then A2 and A3 and then B the models really don't understand this,
they just understand A to B if you tell them
what about A1 or a two or A3. They cannot explain any of these steps in fact, they can't even explain
why they are going to be okay. While a human is able to recursively break down the problem
and understand them quite well. Apart from that,
a human does not hallucinate. Humans have tremendous energy efficiency. Definitely 60 or 100
is not going to be replacing a human. So I'm going to be AGI. Okay. So where does this put us? What kind of predictions
can we make in the AI space? There is a lack of data that is dying
hype. Companies are building
their own models, costs are being reduced and ROI is worse than ever. So what do we expect in future? One is more engineers. Most likely heads are going to be hired. From 2026 there is no new model out there. The companies are feeling comfortable
with the existing technology. They have seen the limits
of the existing technology so they know that which spaces
they have to cover. So you will see talent being hired. Most likely software engineers are going
to see the tech window toying. The second one is
that there is going to be a push from the research side
for newer advanced models. Okay, there's quite a bit of research in the
AI space right now. Contrastive learning is one thing. You have diffusion based models also,
and something which is quite interesting by Yann LeCun is jetpack joint embedding
predictive architecture. This has many benefits. I talked about internal consistency,
missing large language models, japa with little data can train itself to be quite good. And another benefit
is that it builds a world model and then it changes the world
model as you are in your data comes in. So it seems like a superior
architecture in practice. It is doing quite well, but
it's still in the proof of concept phase. It's not replaced a large language. Models performance is not that good yet,
and the third thing, which is a bit of a conspiracy
from my side, is that I think the companies are going
to be called out for misleading marketing. So, for example,
I think Salesforce was the company whose CEO said that
we won't need engineers after a few years, unless they are planning
to close their company. I don't think that's going to happen. Okay. Mark Zuckerberg,
like we said, said that psd2 level intelligence is going to be found. I don't think these models are smart
enough to even beat an intern when it comes to actually thinking
about business problems and solving business problems.
Nowhere close. So the marketing that you will see
is going to be much more measured moving forward.
They're going to talk about reduce costs. They're going to talk about ease of use,
ease of integrating into existing systems. There's going to be talk about how you can bring in domain specific knowledge
and make these models perform quite well. The presentations
I hope, are not going to look like magic, although that works
best when it comes to generating eyeballs. But I do think that as companies
become more and more mature, they're going to look through
that initial veneer of perfection and they're going to look at really,
what does this model do for me and my company. So thank you for watching this. I hope that this gives you an idea of what
trends are current in the AI space, and what is going to come up in the next
few years 2030, 20, 35. We are going to see a lot of these search
around models which have internal consistency in logic and have maybe
some goal setting abilities. I still think that is very, very far,
but it's possible. Research is always good. The second thing is that
we are probably going to see more hiring, which is good news,
which means investing your time and effort in learning
AI is probably going to be useful. Okay, I'm also going to give a short rant before I leave. I really think that
some of the benchmarks. That have been claimed,
the scores that have been claimed, on benchmarks by large language
models, I'm not going to name them. Are fake or are highly misleading, especially around computer programing. I'm talking about code forces,
competitions or at code competitions. The research papers
that have been published by OpenAI are talking about 99.8
percentile performance. I think that's bullshit. Okay. It's not true, simply put. Because when I try
oh three mini or one, it performs terribly in contests. So either they are hiding their best model
somewhere in a closet or some human is helping them out. Okay? Or they are gaming the benchmarks
that using 50 submissions, I don't know, 100 submissions. Maybe they have ten models
running in parallel and then they take the best model
submission. Whatever would be the case,
these benchmarks seem completely rigged. The other thing is the toxicity,
which was in social media. On social media, a lot of AI influencers talked about how humanity
is going to be overtaken very soon, and they didn't see it in a healthy way. They said it in a almost anti-human way. Okay, so this was very sad to see when humanity is in a crisis,
when people are scared, a lot of people
try to take advantage of this situation and come up with their own completely misinformed opinions. The worst thing about this
is that it is powered partly by industry leaders
like Sam Altman, Mark Zuckerberg and Elon Musk because they knew better than most people
how these models work. They knew better than most people
what the capabilities of these models are. And yet for, I would say, a quick profit, they completely allowed toxicity to roam around the hype, to get more and more
feverish in the social media space. In fact, they went to Joe
Rogan and talked about ridiculous things that, you know, they are going to replace
humanity in a few years. So yes, the only guy I am proud of actually, is Yann LeCun. And Geoffrey Hinton, both of these are top level researchers
who were quite measured in the way that they described
the capabilities of these systems. So thank you, Yann LeCun. If you ever watch this video
and thank you, Geoffrey Hinton. You are an asset to humanity,
especially during trying times. Okay. Thank you for watching this. And again, do leave your opinions
and thoughts in the comments. I'll see you next time. Bye bye.

---

## 7. Philosophy meets AI. Platonic representations could be real...
**Channel:** Gaurav Sen | **Views:** 27K | **Date:** 6 months ago | **Duration:** 9:52 | **ID:** TgiF20Edqlg
**Link:** https://youtube.com/watch?v=TgiF20Edqlg

### Transcript:
Hi everyone, this is GKCS. In today's video we will see how AI is validating
a 2400 year old philosophy from Plato. By the end of this video, you will know some of the AI terms
which are very useful right now, if you are an engineer.
And you will also know maybe some of the philosophy terms
which are super exciting, But, are rarely discussed the AI space. So let's start! So around 400 BC, Plato came up with the idea that all objects
have higher level representations. If I say apple, then
you are probably thinking of a red apple. But some of you might think
of a green apple. Some of you might think of a peeled apple. Some of you
might think of an apple on a tree. Some of you might think of an apple
in a fruit basket. All of those are apples. And so apple is not a physical reality. You can't look at a physical object and
say that this is how all apples are like. But there is a high level representation
for the word apple. That representation is in
some sort of information space. It's out of the physical space. Now you have large language models
which look at words and try to find the meaning or
the complete information of those words. If there is some sort
of platonic relationship between the physical word apple
and the high level concept of apple that a large language model can describe
accurately, then you can encode all information in the physical world
into a large language model. That is where we are going towards. You will see that
there are some nuances here. This is not proven theory.
It's still a hypothesis. But it's very interesting because the experiments are pointing
towards its correctness. So the first thing which helps validate
this hypothesis is that different models from different companies where you have different engineers,
different people with different ideologies are coming up with large language models
that share the same neural networks. So you take Lama,
you take gamma from Google, you take OpenAI, and if you layout
the neural network, you will see some components of these neural networks
matching each other. Despite the training data being different, despite the architectures being different,
despite the researchers being different. Some of the neurons, some of the subgraphs
you can imagine are common. Why is this the case? It could be that they are all representing
the same thing at a high level. When you train these models,
you all see the same reality. This was discovered by UC
Berkeley and Google in 2023. It's an interesting beast,
but it's not sufficient. It's just a starting point. Which brings us to a second point,
which is most important as these models scale as you make these models
from 3 billion parameters to 30 billion parameters,
from 30 billion parameters to 300 billion parameters, the models get stronger
and stronger, better at doing their jobs. And you know what? They all start to converge. The vector representations in these models
start to converge to the same space, which means that as models get stronger,
they are probably reflecting the real world or the actual information
space that you want. But when they are weak,
they might be differing from each other. Very interesting. Thought from Tolstoy here
is that all happy families are the same, but unhappy families are unhappy
in their own way. So small
models are unhappy in their own way. But the larger models all agree
to the same reality. this was discovered
by Google Brain in 2023. An interesting point here is that
even if you initialize the vectors to completely different values across models,
they end up with the same values or converging
towards the same values eventually. The third point is that these vector
representations are getting even better if you use different types
of training data. If I use image training data,
I'm going to see human human, human human. Okay I understand
what a human is in image. Now if I start using the word,
if I start constructing sentences with the word human,
it turns out that the model, when trained on both kinds of data,
gets better at its vector representation. It's kind of counterintuitive. You think that
if you want to be an expert at speaking, then you should just focus
on a lot of textual data. But that's not the case.
You also should feed it image data. You also should feed it
audio and video data. And OpenAI I discovered this a while back. The whole point is that it seems like
there are physical realities which can be represented
in the information space. The way to do that is to look at all
possible representations of that physical reality image, audio, video and then map
them into a common single vector space. And I think the intuition here is that if you show a baby only audio,
or if you give them only books, then they are not going to be able
to understand the concept as well as if they have multiple sources of
information representing the same thing. Models also seem to be behaving that way. They are getting smarter by getting
different modalities for training. And the fourth
point is really interesting. It's that these models are similar
to how the brain processes information. Okay, I'll be a little careful here. It's nowhere near the human brain yet,
but part of it is similar to how the human brain processes
information. Exactly which part? When you give a large language model,
when you talk to ChatGPT and you write some input text, it breaks
it into words, breaks it into tokens. And those tokens are converted
into vectors, okay, higher level representations. It seems like our brains
also do something similar. So we hear information or we
see information or we read information and that information
is broken into chunks. Each of those are some sort of concepts. And our brain then is able to map
those concepts into a particular meaning. So if that is the case, then all the information that we are
generating is coming from a higher dimensional space. And the best way
to represent this higher dimensional space is a higher dimensional space
from the model. The only difference here
is that you have a n dimensional information
space in your head, and that n dimensional information
space is now being captured by the model. And some of you might be thinking,
all of you are gone completely cuckoo. Now you have completely lost it.
But it's from UC Berkeley. It's from Microsoft
Research, it's from Adobe, and then independently verified by, again,
OpenAI and Microsoft later. It's not something which is scary,
frankly, because yeah, sure, the models are learning
from the human brain, but they are really accurate
and they really follow the human brains. Architecture
is something interesting to know about. Okay. So we have these four points
which are backing the platonic hypothesis. It doesn't matter which organization
you are in, doesn't matter who you are. That is a high level
concept of all objects that we speak of. Flowers. You know what I am talking about? I know what I'm talking about. But there is no physical flower
that I can point to, and you can point to and say that this is
what we were talking about exactly. So the concept is information space. Now what could be the reason for this?
Why is this even happening? The three major points made by the paper. And I kind of agree with all three. The first one is that as you get
better and better at doing different tasks, you become better
as a general task manager. Which means that if you are good
at mathematics, you're good at tennis, you're good at chess, you're
probably going to get good at painting. Also, at a high level,
if you are able to do many tasks, you basically have general intelligence,
which is being drawn from to do those smaller tasks. This would support the idea of IQ, but
you have some sort of general intelligence which works across all domains. Specific intelligence is like sports
or music does not seem to fit with this hypothesis. The second reason for this could be
as the models get larger and larger, they get smarter and smarter. So eventually they all agree
on the same thing. Very smart people
all agree on the same reality. The smaller models
don't agree with each other because they haven't seen enough
of the reality space yet. This looks like a classist way
of describing things, but we leave it at that. The third point is from Richard Feynman,
which says that if I want to describe something,
then I should describe it simply. Okay. Albert Einstein also,
I think, said that if I can't describe it to a ten year old or a or 18 year old,
then I don't really understand it. I might have messed up the quotes then, but the basic idea is that
if you are trying to understand something, then you have to understand it
in a simple way. So the idea would be that as you get more and more data,
as you do more and more research, as you gain more and more knowledge,
the underlying concepts they are going to align with each other
much better, because the number of vector
representations are much lesser here than that would be
if you had very complex thoughts. Smarter people have lesser thoughts,
fewer simple thoughts, complex or convoluted thoughts
come from people who do not know much. So as you are asking the models,
they are converging to the same patterns. Okay, that's a lot to process. But finally,
what is the implication of this? What does it mean to you and me? basic idea is that if you are able
to scale the models sufficiently,
then eventually reach a point where you don't need to train
any other model on vector embeddings. You can just take the vector embeddings from one model
and pass them on to the rest. So all this training time
that you have for vector embeddings can be gotten rid of. Let's say Facebook does this for ten years, and they get
the best vector representations from now, and no one is going to waste their time
finding the vector representations. They are just going to pass these on
to all other models in future. Most of the information in the world
has been captured. The neural networks have been trained
well enough. You don't need any different
kind of vector representation. The way to think of this is that all languages in the world
can converge to a single language, to a common language,
and every human can comfortably describe whatever they want to say in that one
language. Language was starting under the comments. All right. So that's something
I wanted to share with you today. This is between philosophy and here, which is both of
these are very exciting spaces for me. And like I said,
the implication is not yet true. The hypothesis has not been proven. We might see that not all vector representations
are different for different models. Eventually, as you scale them enough, which is what happened
with the concept of overfitting in AI. But thank you for watching. If you have any comments
or suggestions on this, do let me know if you liked the video. Do hit the like button
and if you want notifications for other videos, hit the subscribe
button. I'll see you next time. I'll just shortly represent what I think is going to happen in the AI space,
maybe in the next 5 to 10 years. I think some of the best philosophers
across history are going to be either
validated or invalidated with AI. I know it sounds like really stupid
maybe to say this directly, but Nietzsche this can't. There's there's quite a few people
who are either accepted or proven wrong using neuroscience,
using sciences in general. And AI is a field
where a lot of information theory can be validated,
which means that the more we invest in this space,
the more we know about our own existence. And that is really, really both humbling
and scary. Like for me to understand who I am in the
next 5 to 10 years, I think that's fine. Yeah. I mean, we kind of know each other, but at the same time, it is a bit scary
to know that this is what the reality is. You can't change it. There's there's
no thought that you can have around it. This is the fact. Let's see, let's see.

---

## 8. AI Agents: Architecture, Usecases & Future Applications
**Channel:** Gaurav Sen | **Views:** 107K | **Date:** 9 months ago | **Duration:** 9:39 | **ID:** VDhQFBxIgtI
**Link:** https://youtube.com/watch?v=VDhQFBxIgtI

### Transcript:
Hi everyone! In this video we'll talk about
what AI agents are. This is a very hot topic at the moment
because it's got a lot of use cases, a lot of potential,
but it's also got a lot of hype. We look at the use cases of agents. We look at
what is the internal working of an agent and how it fits into an overall software
application. And finally, we look at some of the future
applications, which is driving all the hype. So let's start. Let's take an example
where you have a travel agent managing your travel from Mumbai
to Bangalore. You mentioned the time when you want to go
and the rough location where you need to work,
and the travel agent is now expected to come back with some results
around flight tickets around bookings, so hotel bookings and everything else
that is related to travel. Now you can write a script around this,
but the problem with scripts is they keep changing for minute
changes in requirement. There is a change required in the script
which is manual. With the advent of large language models. What's happened
is these agents are now smarter. They're able to hit APIs as expected, depending on the current situation
and the exact requirement. Now, how does this
behavior benefit companies? Customer success and sales. Both of these use cases
have some orchestration with them. When it comes to customer success. If a person comes to you and says,
I want a refund on my flight ticket, what you do
is you ask them for some details. You send them to the right department and eventually you may accept
or reject the request. So some intelligence
really improves the chances of good customer satisfaction. So the question is, if you're an engineer
or a product manager, when do you decide to go ahead
and build an agent? This five things to consider
when you're building an agent. The first is how common is this problem? Does it occur frequently? If that's the case, the investment
is likely going to be useful because the number of hours saved is going to directly convert
into profits or more customers. The second thing which is interesting
is you're looking for processes which don't have much intelligence,
do not have much variation. For example, if you are building a roadmap per customer, you have to go ahead
and build a custom road map. It makes sense not to give this
to a large language model. Maybe it can assist the process,
but it can't just take care of it. A complete independent
agent may not make sense. You. Which brings us to our third point,
which is low risk. You don't want places
where the agent can do a lot of harm. For example,
if you're looking for refund queries, yes, the agent can have a bias towards
refunding instead of not refunding where the AI may be too kind
to users and accept all claims, it will directly result in company losses. But if the claim is rejected
directly by the AI, that is also risky. So when it comes
to a core business problem which is not related to simple sales,
you probably want AI to be out of it. It can assist you in that process,
but it can't manage the process by itself. The fourth point is that the number
of times a human has to intervene when it comes to this
agent should be as low as possible. For example, if a customer comes
to your website with a sale query, as long as the large language
model can answer it satisfactorily, you want this customer to keep moving ahead in the pipeline
and maybe even finish the process of sale. You do not want a human to intervene
unless it's necessary, because the whole idea of the agent is to be as independent
as you possibly can be, and also satisfy customers in a smooth way,
not with part bot, part human interaction. And finally,
you want this to be low effort. I have seen a lot of people looking at agents
as if they can replace humans completely. The reality is
that most processes are complex and they require escalation
to humans eventually. So what you want to do is you want to
maybe manage most of the queries through the bot,
but sometimes you have to escalate. Okay, so let's see how these agents
actually work in the overall scheme of things. Firstly, you have an agent which is going to be interacting directly
with a large language model. This large language model can be
OpenAI can be Gemini can be any large language model
that you like. On receiving a query, your agent goes
and talks to a vector database, which tries to augment the query
with relevant context. For example, a user may be on your website
for the past three hours. They may be doing something
when they ask a query. You want that context to be sent with it. How many purchases
has the customer already made? What is the last purchase that they made? Do they look for discounts, etc.? You also want to add more context to it. So every time a travel agent sends a query
to a large language model, it's going to stay in the system. From that you are a travel agent,
you are managing bookings for users. Blah blah blah. Just giving the right kind of context that the large language model
should think of before responding to it. This often contains the thought process
breakdown of this agent. So, for example,
if you're booking a stay for a person, you're going to be considering flight
bookings. You are going to be considering cost. That would be step one.
That would be step two. And then you are going to think of a hotel
stay step three, and then you're going to think of actually
booking that calendar. Step four. So once you give an example
to the large language model, it's able to follow that example
and basically recreate the steps in the current situation
much better. So the expected response
quality is much higher. Now often the large language
model is going to respond with certain actions
that need to be taken. Here's where your agent shines. It does the actions. Large language models. Now at this point in time,
can't perform actions. They still can suggest actions. But with the advent of model Context protocol MCP,
these agents can behave like MCP clients. They can actually ask an MCP server
to perform actions. So let's say the airlines Indigo creates an MCP server
for booking flights. Your agent can go and talk to that server,
ask it to book a flight, maybe take care of the payment also,
and come back with a response. So you as a user are going to be happy
with your agent because it's managing a lot of things for you,
but in reality, it's actually connecting with APIs publicly exposed,
which are discovered by the client. Finally, when the response comes back,
when the results are in front of you,
you as a user may say, wonderful. This is exactly what I wanted. Congratulations. So that's going to be human feedback,
which is going to help reinforce good behaviors
and demote bad behaviors in this model. So let us say you got the ticket
as you expected. But the pricing is really high. You say, no, this is not what I expected. Now the model is going to learn. It's going to say, okay, next time
I'll do better. And whether it can pinpoint on the problem
of pricing or not is not the problem. It takes a very general brute force
approach that the customer is not happy. I will avoid doing all of the steps
I did last time and try something else next time
so that the customer is happier next time. This is called reinforcement learning. Using human feedback. All right. So that's pretty much it. This is what an agent is. It does look like a rapport a rapport. And it does improve its performance
based on the feedback that you give it. So if you have any questions or doubts on
this, please let me know in the comments. If you liked the video
then do hit the like button. I'll see you next time. Bye bye. Okay, now if you want to stick around, I'm
going to talk a little bit about the future of these models,
the future that I see, and I hope to see. One of the things that I really want
in these large language models is the ability to perform actions
without needing tremendous human intervention
at this point in time. They are I mean, calling them
agents is like a marketing gimmick. It's they are not agents.
They are not independent. They run when told to. So there's a person
who's running a script. It feels a lot like a cron job
or a workflow file. Okay, a lot of this has exact process. The other thing is that these agents,
although they should be improving their performance based on human feedback,
don't do it right. A lot of the agents which are out there, being built by various companies,
don't really get better. They just do well enough. And what happens is that
if a customer says this was bad, then yes,
there is an avoidance of the procedure. There's really no learning from it. It's like you get scalded in your hand
and then you withdraw and you never want to touch that again. But it's possible
that moving till this point was fine. It was touching the pan which scalded you. So the algorithms which are being used
to improve these agents are very simple. So the agents themselves are quite dumb,
you know, they are like reptiles. They,
they can just react. They can't think. Another thing
which I see missing here is reasoning. So an agent which is able to reason
through simple things like for example, if you download a ticket after booking it,
that will be really helpful. But should I really tell you that? Maybe. Maybe. You know, without telling you, it's
very hard to reason through this, but the models are, at this point in time,
not able to look at common use cases and say everything
that you should be doing. Yes. But at the same time, you know,
I don't want to beat on this too much. The agents
which are being built now are useful. They are solving many use cases, and they are in hype
because they do have a lot of potential. So the name of agents is a marketing
gimmick now, but eventually it may be the right name
for these these scripts of code. Thank you again for watching this. If you like AI and if you like system
design, do check out InterviewReady. I've covered various topics of system
design, low level design over there, and in fact, the live classes have a lot of white paper
readings where we are moving to AI now. So see you next time. Bye bye.

---

## 9. Model Context Protocol: A Deep Dive into the future of AI systems
**Channel:** Gaurav Sen | **Views:** 114K | **Date:** 10 months ago | **Duration:** 9:17 | **ID:** uBL0siiliGo
**Link:** https://youtube.com/watch?v=uBL0siiliGo

### Transcript:
Hi folks! This is GKCS and we are talking
about the Model Context protocol. Now this is something
which has tremendous potential. But I think because there is so much hype
in the AI space right now that people have completely missed
the potential of this new protocol. the current problem
with large language models is that they have some intelligence. They can tell you what you should do,
but they can't do the thing for you. They can't take actions they can only give
outputs in text or other mediums. Let's take an example. You are a software engineer
and you have a production outage, Now, what you want to do is pick up all the requests
which have been coming to this server. Run the request locally. Look at where you have the problem. Make the code changes for it. And then deploy this new branch to main. If this tedious process
could be taken up by a large language model, then you would require
less engineers to do the same jobs. And you could send the engineers to Goa
instead of having them on call. so with this basic idea
that you want your large language model to not only give you advice or give you
the steps that you need to follow, but also actually do things for you comes the model context protocol, MCP. This enables a two party system
where you have clients who are large language models, and you have servers
who are typical servers exposing APIs. the client, can send a request
to the server to do something This isn't a new concept. the unique thing about this is that
you have some sort of intelligence here. A large language model can decide
what to do based on the current situation. There was
I have triple T, which used to allow you to take events from external systems
and react to them. but LMS are smarter than just
if as conditions they can take the decision
required In the given situation. okay,
so that's the most basic use case for MCP. What other use cases can you see? Three major ones. The first one is search
engine optimization. This is where Google ranks your page based on how relevant
it finds it for an incoming query. So if someone searches for system
design course and if InterviewReady comes on top,
then my startup benefits because the chance of people
actually purchasing the course just increases, Because it's more
searchable, it's more discoverable So now the traditional search
engine optimization, which tries to rank
you on top, is no longer sufficient. You're
looking for a slightly different approach where your website should be linked
to create the consolidated result. How do you increase the chances of this? Well, if you have MCP servers, which are exposing APIs
the chance of your website coming in. The final result is quite high. I'll take an example. Let's say you want to get the top
100 rank coders on code forces. And you could do this by scraping pages, but it would be much better,
much faster, much more structured. If you had an explicit
API available on an MC server, which could be accessed
by a large language model. Now the last language model goes hits
that API, gets that response in a structured way,
uses it to create the final response. And so we may see a major change in how SEO is done
across websites. Earlier you would look at light speed. You would look at how quickly a response came, how quickly your web page
loaded, how accessible it was. With large language models. Your page may not be accessed by a human. It might be accessed by a lamp,
which doesn't really care so much about the look and feel,
or how easy it is to read. As long as the information
is there, it's code. And maybe you're looking for more information
than is usually readable by a human being. So things are still very, very new. The field is being called Elmo, which
stands for Language Model Optimization. everything which is considered good search engine optimization
principle is also being applied here. There are two other major
use cases for MCP servers. The first one is retrieval
augmented generation. This has been in AI for the last six
months and it has lived up to its hype. Because now when you ask
GPT for the latest information, it doesn't say, oh,
I haven't been updated up to that point. So I can't answer that query. No. It goes searches online, finds relevant
data sources, fetches them. Converts that data into vectors
and uses them to answer your query in the best way possible. It could also be using local data sources
which are updated at a different frequency. Let's say once every hour versus the model
which is updated once every six months. So what you have done is separated
the frequency of data, updates to the frequency of model updates. This really helps because model training is very expensive
while fetching data is super cheap. So retrieval augmented generation
gets better through Amqp because now the external sources can answer
your queries, you know, better format. And also much faster. and the final major use case
I see for MXGp servers is applications. an example of
this is a user asking to rent a car This has always been a difficult
use case for search engines, If you list these out, then
the user has to individually search these. How can large language models do better? Aggregator websites? Aggregate websites, take all of the top
search results and try to condense them into one place where a user can compare
different cars, compare the cost, compare the size and everything else,
and then make a decision. So now the aggregate result
has to turn into an aggregator MQB API. If you are looking to find the best car
to rent, the MQB server
which you have created in your application can go and fetch results
from different websites, aggregate it into a single API
and give that response to the LM. The benefit for that
LM is that this response is much faster, it is better consolidated, And the benefit for you is either
the LM paying you for using your API or the websites who are scraping paying you
to rank themselves higher in the result. it's almost like
you can charge these websites to put up their ads in your MC
server response, which is eventually going to be consumed
by an LM to give the final output. now this hasn't happened yet. The monetization part of MXGp servers
is not very clear, and the ecosystem is very young. But I do predict this change coming
in the future where large language models, even if they don't explicitly show
you ads, may be forced to show you things which other people have paid for
because they are hyped up. The content is boosted
before an LM can pass that content. So that's majorly it for model context
protocol. It's got a lot of potential,
but whether it will be realized or not depends on the large companies right now. Google opening. I can decide to accept this as a way
to interact with different servers. Or they can just ignore it completely. Or they can hack this protocol and make their own versions out of it,
like they did with Android. thank you for watching this video. If you have any doubts or suggestions,
you can let me know in the comments below. If you liked the video, then hit the
like button and I'll see you next time. Bye bye! One small thing around the future of these kind of protocols. I don't mean to say MCP
is going to make it big, but I can see one major improvement over the protocol,
which would really help make this much more useful. The main benefit of MCP is that it
lets you perform actions But it would be really nice
if the actions could be more capable in the sense if I have to send an email without Gmail access,
I can't send an email. So what if Gmail had an MCP server? If it did, it would need authorization
from my side before any emails are sent by ChatGPT 
using the MCP server. Because it's my email address,
I have to say yes before an email is sent. Now, there already exists
something around this. It's called auth, where when you're
logging into a website and you don't want to add your email and password, again,
you just go and sign in with Google. what Google does is it
hijacks the page and asks you permission to share your email
address with this new server. If you say yes,
then the server gets your email address signed by Google
so it knows that you are an actual user with this email address
and it can just log you in. but the potential is much bigger. I tend to be ready
with calendar permissions for any kind of future zoom classes
If these two protocols come together, then you can have tremendous capability
in the MCP server backed by tremendous permissions
through the websites, which we often use. This is where I see the future
for large language models. It's very similar to agents,
kind of like personal agents, but building personal agents
per person is really hard. If the larger companies
pick up more servers or some sort of capability servers
that large language models can use, then you see the amount of human work
reduced dramatically. And I hope that it happens. I hope the mundane things that we do
in life reduce a little bit. In fact, I am going to create an MCP
server for InterviewReady. (just for learning purposes
and understanding how this works) I'll make it open source so that all of us
can contribute and learn along the way. If you want to share it on your LinkedIn
or resume, please go ahead. Feel free. I link the GitHub
repo in the description below. Thank you for watching this
and I'll see you next time. Bye bye!

---

## 10. How LLMs use VECTORS to build multimodal outputs
**Channel:** Gaurav Sen | **Views:** 14K | **Date:** 10 months ago | **Duration:** 6:58 | **ID:** I94LF4IdhyU
**Link:** https://youtube.com/watch?v=I94LF4IdhyU

### Transcript:
Hi everyone! In this video, we talk about how large language models
convert objects to representations. Let's take an example where you have a large language model
that is being used for translations. Okay. Let's say you are on a zoom call with me and you make the statement
she is going there. The pronoun she tells me that it is
a woman who is going. But the equivalent statement
in Hindi is over here. Raji is the place where I get the gender,
which is equivalent to going in English. So if I try to do a direct translation,
what the word from English to Hindi,
I will have a problem. How do I solve this problem? Is it a real problem for me? Yes, a large language models are heavily
trained on English data, which means that if I try to make it work
with Hindi data or with Spanish data, it's going to focus so much on the word
composition and on the grammar of English. The translations might be poor. So for me to improve the translation in every single language,
I can do either of two things. One is I can take all the different n square combinations where n is
the number of languages in the world, and I can look at how I can translate
from one language to another, or I can look at an intermediate
representation into a vector space. If we could have sentence to sentence
mapping, the last language model
could somehow encapsulate this entire statement
into a single vector, into a single representation
in a n dimensional space. When generating the same meaning in Hindi,
it would look at the single meaning, then generate that statement. So this idea of sentence level
encoding is what Facebook has tried with large concept models. It has
some big benefits and some big drawbacks. Also,
I will tell you the drawbacks beforehand. There are many sentences in the world
that you can make this basically infinite
number of sentences that you can make. An example of this is she is going there,
she will be going there, she may be going there. And all of these are different statements. If I had a token to token comparison,
then this would be easy because most of the words are common. But if I have a sentence based comparison,
then that's all different sentences. All of them have different
representations. So some of the work seems to be redundant
because there is so many different concepts
which are actually all very similar. But the benefit is also clear. This is great for long context questions
where you have lots of statements. Each of those statements
then are mapped a single point. And so it's easy for the model
to have the context of the input query,
even if it's a long one. Another clear benefit
which we have talked about is that different
languages can be answered very well. Using this kind of a model. And probably the biggest potential benefit
is text to image generation, since the entire text of a statement
can be converted into a single vector. We are able to better encapsulate
its meaning and context, resulting in higher quality
and more accurate images. I don't think this is entirely
because you have taken a concept and converted it into a single vector. This previous research
that Facebook has done with Image Mind, I'll briefly describe it here,
but you can skip it in case you are not very interested
in the technical details. The basic idea
here is taking objects of one type and then mapping them to a vector space. We then take two of these vectors,
say cats and cheeseburgers,
and then find the corresponding images. Once we have the vectors of these images,
we can forcefully align the image vector of cats
to the text vector of cats. This can be done
with the concept from computer graphics, where the points are translated, scaled
and rotated as required. If all of the points in the two vector
spaces coincide, we can say that
all the vectors are aligned and that our model has a common
understanding of multiple modalities. Facebook used a large dataset of images where every image had
a texture description. They then generated vectors
for each of these images, and then train the model
to align its text vectors to the images. The result was a vector space where image
descriptions and text descriptions mapped to the same points
in a similar way. Facebook aligned video and audio files
to the image files. The result was that a new object of any
type could be mapped to any other type, without requiring an intermediate
mapping to images. This is being called emergent alignment. When mapping objects from any modality
to images is resulting in the overall alignment. This has resulted in state of the art
recognition capabilities, even outperforming
previously specialized models, and this
in my view, has tremendous applications. I stay in a country called India. We have 22 official languages
and hundreds of spoken languages. If you have a language agnostic model,
if you have a multi-model model, the vector representation here
is much more robust and stable than it would be otherwise. If you were specifically trained
on just English or just Hindi. That's pretty much it.
Last language models. When they are looking to represent
any kind of objects, this is what they do. They convert them into embeddings
or vectors, and the representation determines how closely the model performs
to expectation. So I'll see you next time. Thank you for watching. Bye bye. Yes I'm going to go on a small I won't say rant,
but a justification for this video. There is a M.I.T. professor, Patrick Winston, who very recently passed away,
and he was one of my favorite professors. He gave a step by step breakdown
of how you should solve problems. I think he wasn't just talking about here,
he was talking in general. But it really relates
very well with large language models. So I'll just share it with you here. The first idea is definition. So you define what the problem is. Even now humans do that for large language
models. The second point is representation
which we are looking at. Okay. And that's why this is so exciting for me
because he says that if you represent the problem the right
way, most of your problems are solved. Okay? But most people focus on the next two parts,
which is algorithm and implementation. Okay. Algorithm in our case
would be the transformer. But really even before the transformer, you need to look at how you are
representing the data, the vectors. Because the transformer may be replaced
by some other thing to model this are CMV and other linear models
which are trying to replace this transformer has order
n square time complexity. When it comes to finding attention. This can be changed,
but the representation doesn't change right
then this implementation. Should I implement this in C
plus plus or Python? Right. Facebook implemented it in C
plus plus you might find a better GPU. You might. I don't mean to say implementation
is not important, but this is more about translating what you have as an idea
into the real world. Okay, this is where the engineers come in and at best they go here to algorithm. But it feels so good to also look at the representation side though
the research side. All right.
So thank you for watching this video. If you are curious about whether an AI
course is coming at an interview ready. Yes it is.
Until next time. See you. Bye bye.

---

## 11. The latest LLM research shows how they are getting SMARTER and FASTER.
**Channel:** Gaurav Sen | **Views:** 29K | **Date:** 11 months ago | **Duration:** 12:19 | **ID:** _Y3BfN9v3sA
**Link:** https://youtube.com/watch?v=_Y3BfN9v3sA

### Transcript:
Hi everyone! In this video, we will see how large language models
are being scaled up to become smarter and more efficient. So by the end of this video, you will know about the scaling laws
for large language models. And you'll also see what kind of advancements are being made
in the current research to bring down the size of these models and
also make them smarter at the same time. So stick around.
You'll learn a lot. Let's start. There are two important scaling laws
that we should keep in mind. The first one is that as these models
get bigger, they get smarter. So when I say bigger,
I mean the number of parameters that every large language model has. You have seen a neural network,
the typical diagram of a bunch of neurons connected to each other. All of these connections are called edges, and the weight of these edges
is called a parameter. If you have more parameters, if you have
more layers, if you have more connections, that's a more dense network,
that's a bigger neural network. Is this smarter than something
which is simpler with lesser weights? In general, yes. At the 405 billion parameter
model will be much smarter than a 3 billion parameter model. Basically, all of the edges can map
to a more dimensional space. If you have complex queries
which are being asked to this model, it will be able to understand them
through this complex n dimensional space
where it has many points, many parameters. This small, puny model will not be able
to map the input query rightly, and it is going to lose
compared to this model. So this suggests that we should use
larger models, possibly with trillions of parameters. The problem, though,
is that when you have a very large model training, it is very expensive and slow
because every input actually goes through this entire model with 405 billion
parameters or trillions of parameters. And after the output comes out,
you want to actually use it for backpropagation. So again, these weights
are being continuously updated. So one idea is why don't we just simplify
the weights of this model instead of using 32 bits or 64 bits to represent
every weight, like a floating point? We can instead
just have one weight on every weight. So that's either 1 or 0. If you try this, it doesn't work out well. There's too much accuracy loss. But if you change this slightly,
if you make it two bits, so you have assigned one bit
which is minus one or plus one. Suddenly
this model becomes like really good. It's not as good as the 32 bit model,
but it's still retaining a lot of the intelligence
with a 36 efficiency increase. And this result has been independently
verified by both Microsoft and ByteDance. It's interesting to think of that. You know, you don't really need a lot of precision
when you're looking at these weights. You just need an idea
of whether I should keep the weight, or I should ignore the weight,
or I should go against the weight. And the second thing you want to do with
this model is you want to avoid fetching the weights, fetching the parameters
of this model from disk from time to time. In fact, because these models
are being trained on a GPU, you don't even want the weights
to be fetched from the CPU because that is like an IO call. What do you do? One thing you can do here
is try to use the GPU cache efficiently. And there's an idea around this
which is basically flash attention. It utilizes the understanding of GPU hardware to make the cache more efficient. Okay, the slam of the GPU, more efficient. The model weights are stored
there in a better way. The computations happen kind of in memory. So when you get an output,
it is much faster than it would if you didn't use this cache properly. So with these two ideas of reduce
the size of the weights and try to store them in cache as much as you can, you're actually able
to make the models much faster. And so you can invest this time
saving into making the model better. So how do you make the model better? You saved some time. But how does that help
you make the model better? Well, you can basically take samples
or take the data points that you have
and run them through the model and ask the model to generate
multiple outputs. And amongst the three, choose
the best one. Pick that and use that for reinforcement. And one remarkable example of this is from
Shanghai University, where researchers took a 1 billion parameter model,
which is a reasonably small model and actually beat a 405 billion parameter
model. Okay, I'm talking about Lama 1 billion
parameters versus Lama 405 billion
parameters. Lama 1 billion wins. How it makes no sense. More parameters should make the model
smarter. Well, the amount of test time
here was much larger. So every test, every data point
which has input into this model during training generated multiple outputs
for every data point, chose the best output. Use that for reinforcement. And this model is therefore much smarter, although it's gone through the same number
of data points as this one. The only difference is that this has been able to think
more per data point than this one. And so this is our second scaling law. The more time you spend per data point
during training, the smarter your model gets. Okay. Of course, scaling law was that the more parameters
we have, the smarter our model gets. Second one is the more time you spend
per data point. Which one do you think is more important? Which one
do you think brings more promise? This one. Right. The slope of scaling here is much larger. If I double the time per data point
that I spent, the intelligence
is going to go a lot higher than if I double
the number of parameters in the model. It makes more sense as an engineer
to focus on this side than on this side. So, for example, OpenAI says that
for every data point that I have, if I generate a really long response
with long chain of thought, then what I'm doing is I'm taking every data point
and judiciously using it in my training. So during actual query time,
I'm going to come up with smarter, more intelligent responses. Now this generating this long answer
during training takes time. How do you get that time? By having savings in other places. Okay, so this entire process
of taking a data point, running it through the model
and doing the backpropagation. Can we make this faster? Yes. You don't have to update
all the weights of the transformer. You just update the parts
which are relevant to this output. So whenever you're sending
in a data point, you look at the parts which were enlightened or the parts
which were affected. Only those parts are actually going
to go through a retraining. That's an interesting thought process,
and it basically reduces the time that a model takes
to go through different inputs. The second ideas from Google, which says that it's not that every data
point is important. Every data point is useful unless you have
a lot of information in the data point. You do not need to update the model. So think about a person saying
the sun will rise from the east tomorrow. So what? I know the sun is going to rise
from the east tomorrow. This is data. This is not information. This is useless. But if someone says the sun
is going to rise from the west tomorrow. Well, okay,
I need to update my entire model. Because this piece of data has a lot of information, has high
entropy, has surprise in it. So take those data points
which have surprise or find out
how much supplies every data point has. Based on that,
you have some sort of an investment in how much of the model
do you want to change? How much of your worldview will change
with the sun rising from the West? Tomorrow is very different
from how much your worldview changes with the sun
rising from the east tomorrow. Apart from this, there's one other thing
you can do to make the alarm go faster. And that is basically
look at the core of the alarm. Look at what it's made of. It's made of transformers. And what is the thing about Transformers? They need attention, right? Attention is all you need. This is an order n squared operation. Can't we make it faster? Very recently now, MIT has released
a paper called LOLcats
written by Simran and Rahul. They are back. The idea is very interesting. You're basically
using these different operators to move away from attention,
which is very expensive, to a new kind of order n operation
which approximates that relation. So that's how large language models
are being made smarter and smaller. In future, we are
likely to see many of these developments being used in large
language models as a standard. Right. So if you're an engineer some of these
things are useful to look into. I have linked all the research papers
in the description. Thank you for watching this. If you have any doubts or suggestions,
you can let me know in the comments. I'll see you next time. Bye bye. There's one thing I wanted to discuss. And if you are looking for large language
models at this point, you can stop. You can go ahead and walk into the sunset. But if you're looking for something which is probably ten years away
or even more, here's a topic. It's called neuromorphic computing, right? We discussed that Google has come up with
this paper, which is, entropy surprise. So if you see new information,
you are interested. If you see information which you don't
care about, it doesn't really matter. You do not update the model. We also talked about
Circrna, which says that if you see something, then you should just update those parts of the model
which are related to it. Guess what? The human brain already does this. The human brain looks at those parts which are being affected
when someone raises their hand. It's not that my entire brain processes
the entire image, it's a part of my brain processes
a part of the image. Okay, so it's really energy efficient. Humans are incredible in that way. We have a few hundred calories
and we are able to generate very good responses
as compared to large language models. The reason for this is because like
I said, these two optimizations exist. The other thing is
we compute things in memory. We do not have a L2 and memory
unit somewhere. So when we are taking
in any kind of computation two plus two, we don't send that two data to the memory,
bring it back to the ALU, do the computation
and send it back to memory. No two plus two comes into our brain. It is processed in place
and the response comes out in place. So that makes our brain again
more efficient. And finally, our brain is incredible
in the way that it doesn't work by binary okay, there's no zeros and ones. We have chemicals
which are analogs, signals, and the benefit of having chemicals
in our brain or analog
signals is they can be extremely precise. Okay. There's no zeros and ones you don't need
a very verbose language to say one word. Our brain can just represent
that through a single state. Neuromorphic computing is basically taking these three ideas
and trying to bring them into computers. So this is taking the hardware,
the GPUs that are currently being used in large language models and replacing them
with brain inspired chips. Okay. It sounds very flashy,
but in reality it's not that crazy. Okay. Brain inspired
could be anything, right? It could be things
which are computing in memory. Okay. So that's one improvement. Non binary chips. They're still digital but non binary. Every point can have 16,000 states. Instead of just having two states of zero
and one you now have a molecule where if you excite the oxygen then it's going to jump from one place
to another. You note that down and you say,
oh, this is a new state. And then we get slightly less excited. You say, oh yeah, there's
this under the state here. And then you might excite the particle
in a different way. So you have 16,000 orientations. And every orientation
can be basically one data point instead of just zeros and ones
which is voltage. Right.
So this is much more efficient again. And so if you're looking
to learn more about this you can look at neuromorphic computing
I have the links in the description. I am particularly excited about it. But I know that it's going to take a while
to come up before we can replace GPUs with brain inspired chips. So until next time. See you. Bye bye!

---

## 12. OpenAI THRASHES 99.8% of competitive programmers with their new model
**Channel:** Gaurav Sen | **Views:** 98K | **Date:** 1 year ago | **Duration:** 12:40 | **ID:** LZljPiftqyo
**Link:** https://youtube.com/watch?v=LZljPiftqyo

### Transcript:
OpenAI's new model, O3, is outperforming
99.8% of all competitive programmers. Now, this is on CodeForces,
which is the world's most popular competitive programing platform. And if you are a software engineer,
this result should worry you, because this shows that the new reasoning models
of OpenAI and various other organizations are starting to solve problems
which were earlier exclusively human. So stick around
till the end of this video. You learn a lot. Let's go. All right. Let's start with the computer programing
side of things. For a long time, companies have been trying to build
an automated computer programmer. This started with Google. They had something called Alpha code. And recently they had an improvement
with alpha code two. If you know about AlphaGo,
which played the world champion on go and won alpha code is using the base model and then training itself on huge sets of submissions,
which are basically code for computer programing contests,
running them through a MapReduce pipeline, doing some sort of reinforcement learning
and trying to get a decent result. This was not very efficient in the sense
you would have this massive training process,
and at the end of it, you would have a model
which would get 85 percentile on code forces,
which is roughly 1600 in reading. So a human being with little training,
maybe a month of training can actually beat this model. So it's not very impressive,
but it is a good benchmark. After this you had O1 which is better. It has a 89 percentile on code forces
1600 to 1700 rating. Internally,
one is expected to use m.c.p.s. Monte-Carlo Tree search. The same thing that AlphaGo used to beat
the world champion human world champion, and it is also expected to use long chain
of thought chain of thought is a basic practice where while training the model,
you explain to it what you are doing. So an example would be
give me the answer for 35 divided by 14. As a human, you're
probably looking for factors. That is a first step. So you find a common factor seven. You see
this is five by two as a second step. Just look at the quotient
of this division. Okay. So that can be the second step. And then you're looking at the remainder
which is one by two. So the final answer is two and half. This would be a chain of thought
while training the model. It's been noticed
that if you give the model enough time to go through these chains,
if every example is understood in a good way, then the knowledge of the model or
the intelligence of the model increases. And this has been independently verified
by Google, by deep Seac, by OpenAI. So what seems to be the case
now is the longer you can make these chains, the more complex
thought you can come up with. A recent paper again
by Google here, Alpha geometry two actually beats nearly all humans,
right? It's again got a world rank of,
I think 60, 69 out of 600 mathematicians in the International Mathematics Olympiad,
which is AI ML. And that paper just came out
like a week ago. And to improve on this,
OpenAI took the existing O1 model and fed in a bunch of difficult
AI problems. They saw that the model performance
improved. Right. So you had this general O1 model and you used specific computer
programing problems to fine tune it. The performance improved from 1600 the rating to 1800, which is 93 percentile
for further improvement. The O1 model took around
10,000 submissions for each problem, and then it tried to find
which submissions make the most sense. So if all the test cases
for two programs match. So if you pass the first ten test cases
and fail the next ten and another solution does the same thing, then you take both of them
and you consider them to be equivalent. You put them in the same cluster. Each of these clusters
is going to have a score. If you get ten right and get ten wrong,
then you're probably at zero. If you get all 20 right,
then you are at a plus 20. And if you get everything wrong,
you're at -20. So the ones which have -20 need
to get that reinforcement. The negative reinforcement that you suck. You really have to improve. And so the model is going to be changing
the weights accordingly. The ones which get a plus
20 score are awesome. The model is going to again
change the weights accordingly. It's going to say this is great.
Keep the weights. And then you take the solution
from the highest scoring cluster to make your submission. With this overnight with full test time
strategy. Got a score of 2200
which is 98 percentile on code forces. So out of 100 computer
programmers, you are in the top two. But then all three came along and completely smashed
these benchmarks. It has a rating of 2700 plus, which is 99.8 percentile on code forces. It's not in the top two out of 100. It's in the top two out of a thousand. Computer programmers
write this in total, around the world, there's less than 200 people
with a rating higher than that. The whole of United States has like seven
computer programmers who have a rating higher than oh three
right now. And the entire country of India
has one computer programmer from A who has a rating higher than oh
three right now. And I forgot to mention one thing here. Or three does something
which is creepily human in the sense
if you have a difficult problem to solve. What it does is it
first finds a brute force solution. Brute force solution, let's say, is running in order
n squared time complexity. And this brute force solution is used
as a judge for future optimized versions. As a computer programmer,
I used to do this right. I used to write a brute force solver. Let's say it's order n squared.
I don't really care. I'm not trying to pass
all the submissions. I'm just trying to create a solver,
a desktop, which I can run locally. Then what I do is I write an optimized version
of the algorithm, but that optimized version is a bit
complex. It's not easy
to get right in the first go, and you are not even sure
if that is actually correct. So what do you do? You take the optimized version,
you send in a test case, and you send in the same test case
to the brute force solver. If both of them
give you the same response, you know that the brute force
solvers, correct? That means you
optimize version is also correct. So that is to build my confidence. And I could also basically make changes
without any regression. Right. I got to know of the regression
term later as a software engineer. But computer programmers
do this all the time. They have a brute force solver. They have an optimized version, and they can further optimize that version
without worrying about a regression. Now, if all three can come up
with this strategy by itself, it means that it's not only able
to do things like a monkey,
you know, pulling a bunch of levers. It's actually able
to derive strategies from its split. If you have seen how AlphaGo worked, it
played millions of games with itself. Eventually it got better than
the best human in the world. And that's what's happened here
with computer programing. It's played millions
and millions of games with itself, till the point that it understands
what computer programing is as a concept, and now it is able to actually
generate solutions better than humans. And there is no reason to believe
that this trend is going to stop, that this model is not going
to get much smarter, because as you scale up testing, as you scale up
inferences, models keep getting better. The scaling law for large language
models is absolutely brutal. If you spend ten x the time on compute, then you can expect
maybe two x intelligence. And that's not so crazy
to think of the two x intelligence. You're going to be. A lot of people. Is that any computer programmer who's to X as smart as the person at number 100. Number 200. Like if you look at tennis, right. The top 100 players are all considered
really close to each other. Even in computer programing,
it is really, really close at the top. Consistently some people perform better,
but it's not that they are much, much smarter than the other people, it's
just that consistently they end up getting results faster
and better than the people below. So if if OpenAI or Google
or any other company can actually raise the bar,
then we will probably see the end of excitement in computer
programing when it comes to humans. Okay, it's similar to chess
where yes, you have lots of humans. You can play chess really well,
but computers, including my cell phone,
can actually beat Magnus Carlsen, right? Because of the advancement in algorithms
and just the way that these computers work, they're much, much faster
and can see a lot deeper. Now, some of you who are not computer
programmers might be wondering, how does it matter? This was never a real test anyway. It was just a monkey problem. It was just a coding problem
that people used to solve. I don't do binary trees. Well, OpenAI has actually worked on
something called Hackerrank Astra, which is a set of problems
which are real world based. So you have multiple files
you have a task to do, which is very similar to software
engineering in the real world. And it's got state of the art scores here. Like 70% of the problems can be solved
using this large language model. They're now starting to call it
a logical reasoning model. And you can see why. Because a lot of this is actually human
compatible performance software engineering, which is a very abstract
field, is having a large set of problems. And these models are tending to perform at par with humans. And to bring the point home, they have
another benchmark called sweep bench. This is custom built by OpenAI. I can guarantee you they have used it
for recruitment at some point in time. So they have a bunch of, again, real world problem
solving skills for software engineers. Test based on them and they ask the model to solve these problems
to get a 70% solving rate. Again with all three. So it's interesting to think of
because when you look at the when you look at the logic
behind these results, it's like as long as you can tell
if a solution is correct or not. The model through reinforcement
learning trains itself, keeps playing against itself and eventually finds a path
which is which is sensible, right? So as long as you have a bunch of test cases which can tell you
whether this is correct or not correct, and you have a clear goal
to get to all test cases being solved. The large language models are so smart that they are able to learn
through reinforcement learning. The things that they need to do,
the weights that they need to adjust to actually reach the goal state. Now, if you're a software engineer, I'm
sure this is concerning you a little bit, especially if you are young
and in university you might have been doing
computer programing to get job offers, you might have been doing leetcode
to to better understand data structures and algorithms,
but also for the job offer. It seems like this space is going to die
very quickly, right? Because as computers get better
and better at this plagiarism and just solving the problem
using an Elm is going to be trivial. So I see a serious movement away from these kind of mathematical, extremely sanitized problems to more real world,
practical, hands on problems. So not
only are we going to have more problems in this space, but I also think that
there's going to be more focus. Various companies like Google and, definitely OpenAI have already moved
to these kind of problems. And although you do have a lot of data
structures and algorithms, we are going to be moving as an industry to more complex ways
of evaluating a candidate. So thank you for listening. If you have any comments or opinions,
please let me know in the comments below. If you are looking for the link
for this paper, I'll be sharing it in the description. And also have an awesome system
design course at InterviewReady. All taken by me! It has hundreds of videos on system design
concepts like load balancing, routing, message queues and then it also has high
level design questions. There's also a low level design course
which talks about design patterns, about the solid principles, and machine
coding, which might be the last bastion when it comes to software
engineering interviews. So check it out,
let me know what your thoughts are and do let me know your thoughts
on this video and the people. Thank you so much for watching
this. See you. Bye bye.

---

## 13. Google Borg: Billions of Distributed Linux Containers
**Channel:** Gaurav Sen | **Views:** 10K | **Date:** 1 year ago | **Duration:** 18:32 | **ID:** l35hqwTY5W0
**Link:** https://youtube.com/watch?v=l35hqwTY5W0

### Transcript:
Hi everyone, this is GKCS. In today's video
we go through Google Borg. This is a paper from 2015. But Google Borg has been there
for two decades at Google since 2005. And the reason why it's lasted so long
is because it is an absolute all system of Google. It provides compute and memory for processes. 98% of all the servers at Google are running because of Borg. So Borg manages the entire lifecycle of a process
from start to finish. If you're an application developer,
all you have to worry about is your code. And once you're ready, you just deploy what goes and finds a different data
scientist to deploy this tool. It finds the right number of resources
that have to be allocated. It makes sure that in case it
crashes, it's restarted. And in case it's just failing a lot,
then it has to be migrated. Everything end to end is managed by Borg. It's so good
and so popular that, open source project. You might have heard of this. Kubernetes
is developed by the engineers at Google who built Borg,
and this is extremely similar to work. I would say 90% of the internal
architecture is understandable if you go to this paper. So by the end of this video,
I hope that, you know, Kubernetes is also easy to understand. And as with Kubernetes, Borg
has similar requirements. It does load balancing. Make sure that. So this is deployed across the hardware that you have judiciously
utilized the money that you've spent the other thing
it does is process lifecycle management. Part of this is service discovery meaning you have to identify
where the process exists. Borg has a list of this. If you deploy your application,
let's say Google Maps, and you deploy this in two clusters
and you have 50 total servers which are running,
this Borg is going to note down where they are running in case one of them
crashes, then it's going to restart it. But also if you're
the application developer and want to know where exactly they are
running, you can see the entire list. So Borg has something called Borg naming. So DNS, DNS, they have everything. It also manages autoscaling. And this day and age 2025 it. This seems simple, but in 2005
this is a big deal. And Google used to manage
Google scale autoscaling at that time. And the final thing is capacity planning. This to me seems like a more machine
or hardware problem. But what can help you do that? By giving you the proper metrics
and observability for a DevOps engineer, you can look at
the amount of services which, application needs, and based on that,
you can go and buy a fleet of servers. If you need to. You can basically make good business
decisions based on this. So these are the features of Borg. What's the scale like? He's pretty big. 4 billion containers are deployed every week at Google. 4 billion containers. These are like 4 billion processes. As you can expect,
it is highly configurable because you have all the engineers
at Google, pretty much everybody at Google using what
they have their own requirements. If you give them an extensible,
configurable system, then they are going to use it. Otherwise
they will find their own solutions. So you don't want that to happen. You want the system to be easily usable,
but at the same time extensible. And finally it is highly available. The way to think of
this is everything runs on Borg, so GFS runs on board spanner. You're right, it runs on Borg everything including Bigtable which basically manages
Google search runs on this application. If Borg fails then Google is down. So that can't happen. That has to happen extremely rarely,
and you will see the kind of things that what does to make sure
that this doesn't happen. Okay. Before we start
with the internals of Borg, I'll just tell you the differences
between Borg and Kubernetes. Maybe you can skip this part
if you are not interested in Kubernetes, but because this is
a very popular project, I'll just mention the high level
differences. The first thing is Kubernetes is open
source, Borg isn't. Borg is set to be deployed
in very large cells or clusters. Kubernetes can be deployed
at almost any scale. The main benefit of Kubernetes
is not just that it's open source. It's also easier to learn. It has better documentation,
and it has better APIs. That is, APIs are designed
with generic terms. Borg has very Google specific
or Borg terms. The other thing is that Kubernetes
has decentralized orchestration. So Borg has a central server, Borg master,
which tells you will do this
task, you will do this task. But Kubernetes has a set of microservices
which manage different parts of the cluster. And so it is you can say better,
more modern, but Borg also works. So it's just a more of a design choice. One interesting point that I noticed about
Kubernetes is you can actually tag the odds that you have in Kubernetes. Those are called Borg. Let's your odds and Borg lids. They're the same concept. But in Kubernetes you can say that
these pods are part of Google Maps. But here you can't okay. You have to go and actually query
for with a particular edge. Also you can say that this is production
or you can say that this is in India. All of those tags can be given
in Kubernetes. But Borg doesn't
have such a rich language. Querying and debugging and observability
is slightly improved here. For all I know, it's 2025. Borg has probably taken all of these open
source ideas and already moved it here. They are not going to mention
that in the paper. What do you see?
That is a small difference. Okay, let's get
into the internals of Borg. Every job has a state which is defined by the priority of the task. So this might be production level or batch level or just free. Three is basically or things
which don't really matter as much as a MapReduce job in prod
or real time application in prod. And even before this,
there is actually monitoring. So monitoring is most important because if things fail
then these jobs have to exist. So that's at the highest priority level. What happens is if you have a job
which is running, let's say at priority batch
and you have an incoming job of production, then
this job is going to be preempted, it's going to be killed, and this machine
is actually going to pick up this new job. Okay. This is a simple algorithm. Low priority jobs are kicked out. Sometimes this can become really bad. Let's say
you have a monitoring job come in and you have a production job over here. Then this job is going to get killed and
move to some other place, which is batch. And then this job is going to get killed
and move to some other place which is running free,
resulting in a lot of jobs being killed. And so to avoid this production, jobs
cannot be preempted. Okay. You can only kick out existing batch
or free jobs. Now, this is just a way
to avoid the cascade. There's other things
also that a bug job can contain. One of them is rules or constraints. So you may specify the type of operating system that you need
and basically generic rules. You can talk about
the IP addresses and so on. Now this can look like a linear programing problem
right. That you want the region to be India
but you want ten large servers and so on. And then border has to figure out
how to allocate these things in the most efficient way possible. Yes, it can be. So the engineers can provide constraints,
but most engineers don't. They don't really need
these kind of constraints. Most use cases are that,
you know, just run this job somewhere and things are fine. But the constraints are a possibility. Now when we say running a job,
where is this? What is this exactly? Is it a virtual machine? Well, it can be,
but most jobs are not running on a VM. This VM is too slow,
like a windows VM is a bit slow. So instead what you can do is use a Linux container. The security is managed by C root gene. If you know about these things
then congratulations. You know quite a bit about Linux. And resources are managed by C Group. These are Linux specific terms. This is basically a way to make sure that some resources
are allocated to a particular container. And this is to make sure
that nobody else gets access to this. In fact, you might have done C mod in your life
sometime and changing file permissions. Think of it like that. And here C group
you can think of how much network how much file storage
do I give this container. So in this way you make sure that an engineer who's a application
engineer can run their application. Knowing that I need at least
this much file storage just for logs. Let's say once they have defined
that here, you can execute this on a VM or in this container,
if you have to restart the process, send a signal term signal here which is basically till -15 means please die. And if you do not die
then there are other ways which is signal. That's a n minus nine. Okay. Again
things that you might have used in Linux. It forces the container to shut down
and then it can be restarted. Gog has the concept of a cell
which is about 10,000 machines at Google scale. This 10,000 machines
sounds like a small cell, but this is a pretty big number. So single cell has one master. Okay, it's a single point of failure,
but we will see why availability is not affected much,
even if it goes down. The basic idea is
if a block master goes down, then the bottlenecks continue functioning and a block master
sets up the configuration of the power plates, which are basically
like pods in Kubernetes. It tries to assign these tasks
which come to it okay, these are commands which are sent that please
execute this application on 5000 machines. Once a cell is chosen, one master
then tries to spread this application for high fault tolerance. So you have different power
domains, you have different regions. And this is actually a bean
packing problem. The basic idea is
if you have an application running here up one and you have another application
running here up to, and the third application
is coming in one of these two, then which one do you choose? So you choose no one. Which has a perfect fit with app three. So then what happens is
this is running at 100% capacity. Best fit maximum usage. Or do you try to find any one
which can take care of app three? So let us say there's 60% compute
remaining here. And here you only had
30% remaining app three required 30%. You gave 30%. It's the best fit,
but you could have put it here as well. It didn't matter. So this would have been faster, lower
assignment, but it would be a bad fit. So at scale,
maybe the compute power would be wasted if the next process has 40%
compute power required and you put 30% in here,
then you have only 30% remaining. And with both of these, with 30,
this new app can't fit anywhere. This looks like a really bad idea,
but the idea with Borg is they want to quickly
assign tasks to the Borg. Let's. And the second thing
is, best fit has a risk. In case this app takes more than 30%,
it claims that I can do it 30%, but if it takes 35%, as is common
with MapReduce jobs, you kind of underplay
the requirements you need. Then this app is going to crash. So resilience is a problem here. Borg. What it tries to do is
it takes a hybrid of these two approaches, and it tries to fit the application
in a place which has some space remaining. So let's say 40% or 50%,
but it also tries to fit them snugly. So that's the approach
hybrid fit algorithm. Now once an application is assigned
to a model it once it is running here there is a mapping
added in a service called BNS. It stands for Borg Naming Service. Okay. Very similar to a domain name server. This keeps a server to IP mapping. So in this case
you're going to have something like let's say
this is the 30th server of app one. So that's going to be 30 dot app one dot. The user who has executed
this command on board master the cell id.borg.google.com. I don't know why they have this part,
they can just sounds cool or something, but in this way you can, you know,
have some sort of a regex which says not on google.com
as at the end for this cell ID. So you're doing an inverse,
the reverse rejects this cell ID, this user who has started
the task for this application get me all the servers
and then we can store these in a file. With their states. So this application is currently pending
meaning it has to be picked up. It has to be assigned to some late. This one is running and this one is stopped okay. So different states
and also the health of the model. It can be noted down over here. All the metadata around
execution is stored in chubby. Chubby in case you don't know is a Paxos based persistent store. This is used by Google. It is a key value store. The problem with chubby
now is that they have Google Spanner, which is a highly consistent, highly available system
which is a distributed lock service. So it is highly consistent
if you have all of your rights on chubby. But I'm not sure blog
master has actually moved to spanner. Now, another interesting point
is these Borg nets when they are running the applications,
store the logs of these files in a local file. I was expecting that
these will go to Google file system, but no, these are just local files
and they are rotated. So every day or every hour the frequency is not mentioned
but the files are actually deleted. So after the botnet has finished
processing this app or moved it from one place to another,
these logs will be deleted. So within 1 or 2 days
after the movement logs are purged. It's interesting
to note that metrics from this application are also emitted earlier. There used to be something called Borgman. Now there is something called monad. You can check out the video
explaining this time series data store. The basic idea here is it
helps in observability of the system, and if you're looking
for business decisions, then these app metrics
are again sent to Dremel. So here you can find SQL queries
to see how much capacity do you need. Or you know what kind of applications
are taking up most of the compute power based on this
we can make business decisions. The funny thing is, if a machine
is running out of some sort of resource, let's say you're running out of memory,
then you can't avoid it. Like you can't get more memory
in the same machine. So Borg starts killing processes, and the first ones
it kills are the ones with low priority. So batch jobs or free jobs,
those are taken care of in case it's a temporary issue, like CPU usage is 100%
or I was completely choked out. In that case, Borg
actually waits for a while. But again, if things don't improve,
then processes start to die, starting with low as too high a priority. Now you might be wondering what happens
if Borg Master dies. Yes, Borg, let's continue functioning. But one issue is if it dies, then
no new task can come in. So it's important not to let it die. And you have basically replicas
of what master. So these are in-memory replicas
and the five of these they have read using Paxos. What happens is since they are in sync,
in case one board master dies, then another is selected and then it takes
care of the provisioning. Here with the bottlenecks,
this is mostly taken care of again by chubby, which stores
all the state of the Borg master. Finally, there are some optimizations
that Borg has for scaling up. One of them is caching. Very heavy use of caching. The idea is a Borg. It has some parameters. It's in a region. It is of a particular size, the server has a particular size
and maybe it has a power outlet. It's connected to this. So all of these things are common. You do not have to recompute it
again and again unless you are changing the configuration
or the physical server. You do not have to change the score
or the definition of this bond. Let. So all of this config information is cached in mod master. So when it's making a decision
where should I send this application to. It has all of this config cached. It has this scores of each model it cached. And so it can quickly make a decision
as to where to send this application to. Similarly,
applications are not very different. You know you have Google Maps,
which is a kind of an application. You will have email,
which is a kind of an application. Many of these are going to be similar. So instead of having each application
specific requirements, you have a class of applications. So one might be IO intensive. Another might be memory intensive. Another might be CPU intensive. So now based on
the class of the app are running you can find the appropriate block
like this again is something that you can constrain in the number of variations
and also cache. And lastly, when an application
is going to be assigned more tries to find bottlenecks which already have the libraries required
for that application. This is similar to Bazel
which caches the libraries. So instead of you
caching the libraries in every bottle, it of course you find the best fit
based on already installed libraries, and this reduces the
start time from 25 seconds to just five seconds. So deploying an application
across thousands of servers becomes a very fast process. So that's it for Google Blog. It's a very interesting and simple system. Most of Google runs on it. 98% of Google
runs on it. What I find interesting about it
is it's got this concept of cells. It's got this concept of both master
and portlet. That's almost all of the containerization
logic that you have. Everything else is external. And this was made in 2005. So concepts like autoscaling and cross-region fault
tolerance were not very common back then. But Google solved this problem. The principal engineers went ahead and actually made this system,
which has lasted for two decades now. So thank you for watching this video. If you have any doubts or suggestions,
do let me know in the comments. If you liked the video
then do hit the like button. And if you want notifications
for further videos like this, hit the subscribe button.
I'll see you next time. Bye bye!

---

## 14. Amazon DynamoDB: A Scalable, Predictably Performant, and Fully Managed NoSQL Database Service
**Channel:** Gaurav Sen | **Views:** 47K | **Date:** 1 year ago | **Duration:** 20:14 | **ID:** cU01EnyBwQI
**Link:** https://youtube.com/watch?v=cU01EnyBwQI

### Transcript:
Hi everyone, this is GKCS! In this video
we are talking about Amazon DynamoDB, which is a paper from 2022. DynamoDB is a very popular NoSQL
data store. It has over 1 million customers. I do not have that many subscribers as these guys have been customers. They make around 79.8 million requests per second at peak load. So this is easily about 10 trillion
requests daily. One of the main reasons
why it's had such popularity is because it's very easy to set up,
and it provides auto scaling. It's a NoSQL data store. It easily stores petabytes worth of data,
sometimes with a single client. Now, the funny thing with
this is when you see NoSQL, you might think, oh, asset guarantees
go out the window eventually. Consistent. No, DynamoDB says, let me be a contrarian. Let me say that
NoSQL with acid guarantees. So you can have transactions in DynamoDB. The key here,
this is basically serializable. Another thing that we mentioned
is eventual consistency. Yes. That is something that DynamoDB provides, but it also provides strong consistency
if you need it. So most users who would have otherwise left you saying that no,
I need a strongly consistent database. No longer have that excuse. And finally, there is a clear bias towards having consistent behavior. This is one of the craziest parts
about Amazon. It has not that much to do with tech,
but with their culture that if things go wrong,
they go wrong in a predictable way. If things are going right, they will be
happening in a predictable way. So if users see that a page takes five seconds to load,
that is slow, but it is bearable. What is not bearable is the page loading. Sometimes in 100 milliseconds,
sometimes in three seconds, sometimes in four seconds,
sometimes in ten milliseconds. Okay. So the variance is something that Amazon
DynamoDB is completely against. Or basically the engineers
at AWS do not want to see. Now these six points make DynamoDB very interesting to study. Now let's look at the request
flow of DynamoDB. You have a client
which is just behind my head, and the client is sending a request
to a request router. This is one of the interesting things
about DynamoDB, which says that let's split. Let's isolate concerns. Let's say request routing. Load balancing is one thing. You have a queue
and storage is another thing. So you have separation here. But in reality they are belonging
to the same availability zone. Okay. So one request auto can send the request
to the same availability zone or depending on where
the primary of this key is you can send it
to a different availability zone. Also. Okay. So typically what you try to do
is you want the client to connect to the request auto which is in the same
availability zone as the primary. But sometimes that may not happen. Just to ensure that it doesn't cause
any issues, you have a separation. Now when the request auto gets this request,
the first thing it does is query a cache. This is a global distributed cache called MDS. MDS finds
the SSD is where the key belongs. The request auto
now sends it to the primary. Let's say it's here in the same
availability zone which persists the data and then forwards it
to the other two replicas. For this key. Behind the scenes you have some special stuff happening,
which is the SSD stores the data, but at the same time
the data is replicated to S3 using logs. So this log is streamed into S3. Now, if you're looking for backups, replication of the data,
all of that can be managed here itself. In fact, if you are looking for a change
data capture solution, or if you are looking to do something
with that data, if you want to stream that data, then that can be done easily
using DynamoDB streams. So the data changes or the logs can be consumed
by the client through these streams. There's other benefits of the stream also for things
which require eventual consistency. Streams do really well. One of the things is indexing. The index is created using stream data,
which is eventually consistent. Now, if the user wants a global index
saying that, get me all the users in a particular department. So by this department ID, it's possible
that department ID is not a sort key or a partition
key doesn't really matter. All you have to do is go to this global
index on the department ID. And it will store the data in a way that the department ID will be used to sort the data. And there'll be a copy of the data from the original tables
using these streams. Now, one of the funny things about this
architecture is when a client makes a pull request,
it goes to this request router and it finds the primary
persisted there first. And then replicates
before the replication is done. Can you do a Get request? Let's try. If you do a Get request
with eventual consistency. It will go to the request router. It will see that this SSD has persisted
the request, or it will order the request in a way that the SSD
will have to process it after persisting. At which point you can get a response which will be strongly consistent. If you're going for the eventual
consistency, the request author may also send it to one of the replicas
for load balancing purposes. In this case,
the data is not replicated yet. You're going to get slightly stale
data, slightly old data. It's possible that the data was already deleted here,
but that tombstone did not go here. So you might get something
which has come alive again. Okay, so this is possible. Eventual consistency
is what you're going for. But if you force strong consistency
in a get operation, then you are guaranteed that the request
author is only going to send it to the primary
because all rights happen in the primary. The reads which will happen subsequently will be sure that the data will be
the most consistent value. And the way that you elect
these leaders is through multi Paxos. This is a leader election algorithm
which is a variation of Paxos. The leader has a B-tree which has all the keys
sorted and easily indexed. But it's not necessary
that all its replicas will have B trees. It is not important for its replicas
to materialize the view. So if you do a read request here, then
it's going to take a long time to read. Because if you are reading through logs
it can be ordering. So ideally you want to send
the read request to replicas which have B trees with them
a materialized view. But this is helpful
because if you're looking for higher durability and persistence, then
a replica with just logs is sufficient. Okay, in this way
you are able to reduce the amount of work that these replicas are doing,
which improves write throughput. Speaking of logs,
the logs that you send here are propagated to the streams service. These changes are extremely important
for DynamoDB because their replication the database
replication often depends on this. So what they have done is verify
this with TLS plus. This is a formal verification method. So they are sure that the
changes will be propagated. And in
this high level design there is one thing which is much more complicated
than it initially looks. Guess where that is? The cache. This tiny cache is actually quite complex because it's in the critical part
of any client request. Whenever a request out
is looking for a SSD to persist the data
in or to fetch data from. What's really happening
is it's first going to the cache and getting the primary, getting
the replicas that it needs to query. The cache is usually populated
with a 99.7% hit rate, which means all the requests
almost successfully go to the cache. In case there's a failure,
you pull from the data store. What if there is a failure? What if this cache has gone down
and it is being repopulated? Right now? It's a cold cache. It's going to get warm in some time. The success rate goes from 99.7% to 0%. This. Why is this such a big problem earlier? If you had a thousand requests, 997 were being answered
in a very short period of time. Let's say one millisecond, and now all thousand require the long period of time,
which is, let's say ten milliseconds. So earlier,
your average request latency was, for all intents
and purposes, one millisecond. Now it is ten milliseconds. You're going to be able to handle one
tenth the requests that you could earlier, which means your request auto
is going to be bombarded with requests
and it's going to be performing slowly. The entire request spot is going to
be affected, and your system can come down to avoid this. The crazy thing that AWS does,
I really find this insane is to actually keep the client cache, querying the DB from time to time. Whether you find a cache hit
or miss doesn't matter. The client cache will keep going the DB
and getting the latest data from time to time. Now why? If you have the data in the cache,
why are you creating the DB? The reason for this
is because you want consistency in the amount of
work that the cache is doing. So if
request start getting slow in this cache, you start responding
by scaling up the cache okay, so you add more servers. So earlier
you were able to manage with ten servers. Now you see that
your request load has increased. You go to 20. If you had a massive cache hit rate
then you would say I can manage with just one server. Later on you would scale to two servers,
but when there would be a crash, you would need 20
and you wouldn't have 20. You couldn't
bring up so many cache nodes quickly. So just to avoid a shock, you have caches constantly calling the DB,
doing more work than they need to so that you can monitor them carefully
and scale them to the right level. Okay. Like I said, you are trying to make
a boring system with very low variance. Caches actually increase variance. And AWS is known for reducing variance. Increasingly reliability
as much as it possibly can. And that is embodied by this cache. I should be sponsoring this video. I'm speaking a lot of good things
about you. The data scheme of DynamoDB
is quite simple. Every table has a partition key, which is
used to horizontally scale DynamoDB. When you put or get any data
from the DynamoDB table, the partition key is used to find
which partition this data belongs in. Using a hash function. This is very similar to a hash map. You also have an optional sort key. This is similar to an index
in a relational database. The key can help you quickly
search for elements using binary search, and also range queries become efficient. Together
they make the primary key of the table. So the partition key plus
the sort key combined is one unique key. Let's take an example
where you have posts being made by users. So let's say
Reddit is using this table to store posts. And the partition key is the post id,
while the sort key is the timestamp. With this table, you can quickly
find all the posts in the last seven days
by querying all three partitions and aggregating the results,
which are sped up due to the sort key. You can also query
for a specific partition. So for example, if you know that
all the posts in India are going to the partition with post underscore two as a prefix,
then you can get all posts in India within the time range. You can also use more advanced
design patterns. So for example, if you want to find
the latest posts made by a user where you need the user ID
and the timestamp, you can combine
two of these keys into a single key. So this would be a composite index where you have
the partition key as user id plus post id. Now, if someone is looking for posts
made by user number six with a time range of 60 to 90,
they will get the data quickly. So depending on your access pattern,
you want to model the table accordingly. You can also add additional indexes. So for example, your sort key in the original table on timestamp
works for one access pattern, but users may want to see
the most popular posts ever made by them. In that case,
you can sort by the like count. And if you get an incoming query of
get me my most popular posts, you can get them quickly. Because of this new sort index. In this case,
it would be a local secondary index. Amazon lets you use the same partition key with different indexes, which are stored
locally in the same partition. This keeps the data strongly consistent
and is sufficient for most use cases. AWS lets users make 20 local indexes
on the same table. You can also create a global index. The main thing about
this is you have a different partition key as compared to the original one. If you have user
plus post in the original one, maybe a different access
pattern is talking about. Get me all the comments for a post. So the latest comments for a post
can easily be fetched if we use the partition key of comment
plus post with the key of timestamp. In this way, you can see that a single table probably
takes care of the entire application. The reason this is done
is because you want to force users to think
in the NoSQL terms of key value pairs. You are okay with data duplication
and denormalization, but you do not want
to anchor the joints at all. A caveat here is that the global index
is actually the entire copy of the table. Amazon limits that to four global indexes,
which is four additional tables. These are eventually consistent. The logs from the original partition
are streamed to make changes in the global indexes. In this way, most complex access
patterns can be resolved using a single table. Now, the last thing we should know
about DynamoDB is that it has a concept of rate limiting or capacity booking. The basic idea
is you only pay for what you ask. So let's say you want to read this
data and each row is around four GB. Now if you want to read this once
every second, that would be one read capacity unit that you're consuming. So DynamoDB has these tables
hosted somewhere. They know that the I o operations
and the processing is going to take time. They understand that with four GB of data
being read per second, that can be called a unit. So maybe one node can have 10,000 units. But a person doesn't come and buy
an entire node. Maybe what they want to do is they say
I just want 100 IQ from this node. So if you take 100,
it still has 9900 series remaining. This is maybe going to be used
by other customers. So a single node
can be potentially serving hundreds of different customers
different companies. Now what you have to do is ensure that
someone does not throttle everybody else. So a single customer who's asked for one
RCU is now consuming 100 hours. You is not acceptable. Everybody else will have to be throttled. So instead what you want to do is throttle
the person who is doing this. So DynamoDB gives you that one
read capacity unit. If it sees that you are exceeding
that, they go for throttling. Similarly, you have write capacity units, which is one KB of data
being written per second. So let's say you book 100 write capacity units,
and the node itself may have 10,000 or 50,000 write capacity
units. Now the sad part about this is whenever you are throttled
as a customer, you don't like it. It feels unfair
or it at least feels irritating. So you want to avoid throttling,
and especially you want to avoid unfair throttling. So let us say Zomato is using AWS and they have most of the traffic
during dinner time and lunch time. So for four hours a day they have enormous traffic of 500
or so 500 hours to the network. But yes, 500 hours you only. And the rest of the day
they do not have much traffic during that time. They are using 500 or so. The rest of the time they are wasting
this 500 as you. Instead, the Zomato engineers,
what they would really like is if throughout the day
they would have a more consistent review load of 200. Okay. But if they book this during lunch
time, you're going to exceed capacity. So they can either manually
scale this down and scale it up during lunch time,
or they can just waste capacity. This is not a very good experience
for customers. Instead, what you want to do is
you want to take care of this by yourself. You want to be fair. So if Zomato books 200 hours you for a while,
you actually start saving their requests. You start filling up a token bucket,
which is the rate limiting algorithm in DynamoDB. And this bucket has five minutes
of burst capacity. So 200 hours, you in five minutes
is going to have these many tokens, which is 60,000 hours. You. Okay. Let's say this gets filled up throughout
the day and then lunchtime arrives. Everybody is working lunch
from this bucket. Instead of
just being able to pull a 100 reads, you will be able to boost up
to 60,000 reads until you run out of tokens. So this allows the customers
to leverage the wasted or saved up reviews
that they had from earlier. Okay, this is one of the reasons
why the adoption rates are high. You can drop requests, right?
What does it matter? But as a customer,
it matters to you a lot. You feel like, oh,
I paid all that money for 24 hours of this capacity, but I'm getting much
less than what I had asked for. If you take care of that for them,
they are already on your side. If you give them that boosting capacity,
they are on your side. On AWS, this makes the challenge harder
because you have this kind of boasting allowed for customers. You now have to find out the right
distribution of data across nodes to allow this kind of boost
for different customers. And in
fact, AWS takes it one step further. This read capacity or write capacity
that you have is set up across replicas. So locally,
the throttling would have happened at 100 hours to itself, but instead
now you have 300 across three replicas. As you. If one of the replicas takes 200
and the others take 50 and 50,
that is going to be allowed. So AWS allow one to go to 200 without
depleting your overall token bucket. So there will be no throttling
as long as globally you are consuming less or equal to the amount
that your cost. So that's it for Amazon DynamoDB. I think this is a very interesting system
because it's controlled in so many ways. Well, but it allows transactions. It is very popular, but at the same time
it gives you a lot of control over what you want to do, and it behaves
the way that you want it to behave. I think that's one of the major reasons
why its popularity is so high. We also mentioned some of the crazy things
that they did for allowing very high availability
and predictable performance. Okay. Throughout Amazon's papers,
you will see that behavior of let's make boring systems. Let's make systems
which have predictable performance. If you have any doubts
or suggestions on this, you can let me know in the comments below. If you want to know more about system
design, then check out InterviewReady. I'll see you next time. Bye bye!

---

## 15. Apache Spark: Cluster Computing with Working Sets
**Channel:** Gaurav Sen | **Views:** 27K | **Date:** 1 year ago | **Duration:** 11:15 | **ID:** I-PwfcNurWo
**Link:** https://youtube.com/watch?v=I-PwfcNurWo

### Transcript:
Hi everyone, this is GKCS. In this video we talk about Apache Spark. So this is a paper from 2010 and this is from Berkeley. Apache spark is probably the world's
most popular data analysis system. It's used by software engineers, data engineers, data analysts, data scientists,
machine learning engineers. You know, I have personally also used it while I was working in a data
analysis system. And the reason for its popularity
is because it is such a generic system. Before Apache Spark,
there were many systems which are specialized in the tasks
that they used to do for data analysis. One of the systems we have already looked
at is Dremel, which is really popular for count queries or aggregation
statistical queries. There was also a paper written
by Google called MapReduce. It has changed the way in which you could use commodity
hardware to come up with data analytics. MapReduce was very good at batch jobs. Then there are stream methods. Then there was Google, which used to perform PageRank
algorithms for Google at very large scale. When you're running a graph algorithm,
you want to run it in batch. Some of the principles of MapReduce
are put into practice. But all of these are all specialized
for their own use case. What spark does is take them all together and put it under
a single umbrella internally. It lets you do graph algorithms
using something called graphics. It lets you run machine
learning algorithms, also using something called Mllib. You have a SQL library
for aggregate queries and it allows MapReduce. So everything packaged in one. The benefit of
this is if you're a data engineer. Now you don't have to learn
for different technologies. Everything is covered by Apache Spark. You can write your programs in the programing language of spark,
which is basically Scala, and that program will execute
in any one of these systems. So this is the major benefit. It is extremely general purpose when it comes to data analytics. The second thing about spark is that it is extremely scalable,
but it's also extremely performant. This is much faster than MapReduce. It's in some cases
a thousand times faster than MapReduce. We will see why. This. And finally it is pluggable with various technologies. So if you want to run spark
with Kubernetes that is possible. If your nodes are going to be all managed
by Kubernetes that is possible. You can use miso. So you can use any other cluster manager. And spark will not care right. Spark just needs a way to run a cluster. It doesn't know how the cluster is
being run or what is the internal workings of the cluster. Now, the first thing we should look at
when it comes to these three requirements is
why is it so performant? It gives you a thousand speedup
in some cases, and on average
it gives you a 40 speedup over MapReduce. So how is this happening? The basic idea is pretty simple. Let's say you have a MapReduce job. This is how a typical MapReduce
job looks like. You have some data
that is being pushed into the system. So maybe you are trying to do a select
star for all employees from a department. So you have different
employees sharded into C1, C2, C3. These are going to be mapping
the employee object to just the name. So E dot name. Okay.
This is the first step. Now you might say that
let me sort this data set. So you're going to sort parts
of this data set. And then you are going to aggregate it
all together. So this would be able to do so operation where you would have the sorted names
of all employees in a department. MapReduce is not very efficient
when it comes to these kind of operations. The main reason for this is
because the assumption and that time was this is going to be cheap commodity
hardware. It can crash at any point in time. We can restart the entire process. This would be a very slow process. So you had the choice of either having a
no fault tolerance, very slow process, which is restarting a lot of times versus
you actually store the intermediate results in between
and using those results during failure. That takes a lot of disk space. Spark looks at this problem and says, what if I just store these results
in memory stats input instead of storing things
in persistent storage? Why don't I move it into memory? Now, if this mapper job fails,
I can go and query the memory here, the output over here, and re send it
to a new mapper which will spin up. This will be much, much faster. Instead of pulling it
from persistent storage instead of using disk space,
I'm going to be using memory, which may look more expensive,
but it is so much faster. Not only does it make the failure
recovery faster, it makes the overall computation faster. So you no longer need to have
intermediate results after every map job. You can put them all together
in a single computer. Run those functions together. It's no longer a full process of convert
E to E dot name. You know, this would be a slow
step in the MapReduce job. Now you can convert E to E dot name
right here in the first computer itself. As long as you can perform that operation memory,
do it in memory and go to the next step. You see that the number of steps
have been effectively reduced. Of course, you are performing
the same number of operations, but each operation earlier
you still have one stage. Now it has everything put together
and everything is performed in memory. That gives you a huge speedup. It gives you a 40 x speedup on average. But for iterative algorithms
like PageRank, like some machine learning algorithms
where this back propagation, this is just a lot more fast,
it goes all the way to 1000 times fast, in case there is not enough memory to pull in the data
into a single computer. Then Apache Spark will overflow it
into disk, so it's worst case behavior is MapReduce, and its best case behavior
is like running it in local memory. It's much, much faster. Recent versions of Apache Spark
actually are cache aware using cache over algorithms. So those think about the L1
L2 cache, the L3 cache. Before that,
things are just kept in memory. With the improvements of cache over
algorithms, it's become even faster. Now imagine
you are the professor at Berkeley. This is 2010. You don't have much money, but you have
quite a bit of influence and respect. So you come up with this project
and you say that I am trying to solve the current problem
of having four different systems for four different use
cases by creating Apache Spark. How do I make a general purpose
and how do I make it pluggable with various existing technologies
so that it becomes popular quickly? People do not have to migrate
with difficulty. So one of the things you want to do
then is to make sure that the spark system is small. It should only focus on one thing
and that is computation. If you
treat Apache Spark as a pure computation platform,
the cluster management can be pluggable. The data sources can be pluggable. The network can be pluggable. Everything can be pluggable
except for computation. So as long as you give me some compute
power and memory I can run Apache Spark. And I can give you results over data. And the best way to define
this would be a program, a series of instructions
which have to be executed. The benefit of this is
you could write a script in Scala. You could say dot map. And what would happen is this arrow would basically be
just a single line of code. The benefit of this is, like we said,
if there is any fault in one of the computers, then you can look at the log of operations
that it has gone through, the partitions that it has consumed
when mapping and producing, and then recreate this state
using this log of operations. These are called RDB,
which is resilient distributed data sets. Whenever there is a computation to be performed on this,
let's say data dot reduce, spark first tries to see if this data exists
in any of the cluster computers memory. If it is, then assign that compute to the operation
because that's going to do it the fastest. If not, then
try to find one of the preferred locations based on data locality. So for example, when you're sorting a data
set, maybe you want to put the objects are close to each other
in the same partition. That would be data locality. The final point to note is
who is managing this cluster. We mentioned Kubernetes or Miso. Yes. Either one of those can be used. Miso is an extremely simple
cluster manager. All it has is a leader
and a bunch of followers. So when it has a set of computers
which are performing operations, if Miso says that I have enough compute capacity right now,
I do not need to spin up a new instance. Then a job which comes to Apache Spark is going to be assigned
to one of the computers. If there isn't enough compute capacity,
then it's going to spin up a new instance. So the leader miso instance spins up new follower instances,
makes them perform computations, and when they are done,
it releases those instances. So the entire cluster
management is managed by me. So it is very similar to Kubernetes
but it's a bit more generic. And that's it at a high level. Apache spark is an aggregation
of multiple specialized libraries. It runs over a cluster managed by. And the best thing about it
is that it keeps things in memory. The strategy is to keep
your intermediate results in memory for faster queries and fault recovery. If you have any doubts or suggestions
on Apache Spark, you can let me know in the comments below. If you want to see more videos on system
design, integrated is the place. I'll see you next time. Bye bye. Also, some interesting news. The System Design course at Interview
Ready with over 300 video lessons, has been split into two. System Design Simplified,
which covers high level design including the fundamentals, example,
interview questions and research papers, and a low level system design course
which cover solid principles, design
patterns and machine coding. Our hope is that this will help you
complete the courses better and faster. So if you're focused on learning
high level design, system Design
simplified is what you can go for. If you're looking for a low level design,
that's now a separate course. If you've already purchased the system
design course, this split is not going to affect you. You will have lifetime access
to both courses. Thank you so much for your support. Both the courses are complete
in themselves. You do not have to finish one
to go to the next one. There is no prerequisite, no ordering. You can work on both in parallel.  Thank you so much for listening. I'll see you next time. Cheers.

---

## 16. Apache Kafka: a Distributed Messaging System for Log Processing
**Channel:** Gaurav Sen | **Views:** 165K | **Date:** 1 year ago | **Duration:** 15:33 | **ID:** hNDjd9I_VGA
**Link:** https://youtube.com/watch?v=hNDjd9I_VGA

### Transcript:
Hi everyone, this is GKCS! In this video
we will be talking about Apache Kafka. So this is a system from LinkedIn
from 2011. Kafka is a very popular system. It's used by many organizations partly
because it's open source, but mostly
because it is extremely scalable. So what is Kafka really do? Most people look at it as a message queue. If you have a set of publishers who want to send messages to subscribers,
that's where you want to have Kafka. Let's assume that you are Instagram. You want to take a message
which is published by Brad Pitt, and you want to now send these messages
to all the followers of Brad Pitt. That is a very difficult task
because you are going to broadcast those messages
to potentially millions of people. How do you scale that system? How do you make sure that everything
is working fine? It's reliable. Well, Kafka is the solution. It is an open source solution. It's been there for a long time
and it's been battle tested. The other major use case for Kafka is event
streaming. Kafka can take multiple streams of events
from sources and transport them
to different destinations. So this is especially useful
for event based systems. Imagine that I have a profile on Facebook
and first I add a profile picture. Then I add my first name. Then I add my address
and finally I add my email address. Now these are all separate events. If I take this event log
and replay it in a new data store, the initial data store and the final data
store are going to look the same. So I do not need to make copies
of databases anymore. I can just replay all the events
using Kafka and the entire
data store will be recreated. I can guarantee that the state here
and the state here will be the same. Kafka
is comprised of three major components. One is the producers. These are the people
who generate messages. Here you can think of applications which
are trying to send messages to Kafka. They will have Kafka clients. Here you are publishing messages
to a topic. And because this queue can be very large,
because this topic can be very large, you can have it in multiple partitions. So you have these producers
sending messages to various partitions
for a particular topic. That message can be retained for a period
of two weeks or more, depending on how much data you want to store
and how much capacity you have. Now, why do we need all this complexity? Why can't we just get rid of these brokers and have the producers sending
the messages directly to consumers? That would be easier, right? It would be easier,
but it would not be as scalable. The reason for that is producers
are constantly producing messages, so they want to write to a place quickly
and continue with their application logic. So there is some isolation of concerns. There is an async component to this,
and a lot of the code for persistence and retries
would be duplicated across applications. So whenever you see that some of the work
which is being done, a lot can be extracted out
to a single system. In our case Kafka, then you can save
engineering time and company money. That's the intent behind
this entire architecture. Now the guarantee that Kafka gives you
is whenever you are sending a message, it's going to land in one partition,
and all of the messages for a topic in a partition
are going to be ordered. But if M5 is instead
sent to some other partition, this message may be processed with m
one being consumed second. So they may be out of order
processing across partitions. But within the partition you are sure that
the ordering is guaranteed. Now you might be wondering
where do topics and partitions lie? They are all inside a Kafka message
broker. This is basically a Kafka server. One single server, one physical server
may have thousands of partitions. Consumers can consume these messages
from the Kafka server. So this is a pull architecture. You could have pushed messages
from the brokers, but Kafka has decided
on the pull architecture because the responsibility of pulling messages
is then given to the consumers. This makes the Kafka servers themselves simpler to manage. So these form
the basic components of Kafka. Producers produce messages using clients. Kafka servers or brokers
temporarily store these messages to be distributed to the consumers who pull messages using message offsets,
which is basically the index of the last message
that they have pulled from the queue. Now, as your system scales, each of these components
have to scale horizontally, meaning you have multiple producers,
multiple brokers, and multiple consumers. Now, such a large scale, disparate system
requires tremendous amounts of bandwidth. If you are going to send 7
trillion messages per day, which is LinkedIn's daily requirement,
even if 0.1% of your servers feel that is 7 billion failures,
you cannot manage this manually. It has to be automated. Recovery. So what Kafka does is keep
replicas of every partition. Let's say
that is topic D one with partition p one. You will have two replicas
of this partition P1 in two other servers. Now if one of these partitions goes down, the consumers can continue
consuming messages from the replicas. There is one problem though. Let us say a Kafka client writes message
number 4 to 1 of these partition replicas, and for some reason, the next message of
five does not go through. So the producer says, that's fine,
I will try a different replica to write to. It sends message number five,
which is accepted by the other replica. And now if a consumer is pulling messages
from one of these partitions, it gets one, two, three and four. Let's say this Kafka server goes down now, and the consumer is forced
to pull messages from the other replica. It will mention the offset of four,
but this server has no idea where four is. It only has one, two, three
and five directly. So here you will have a problem. The data in the Kafka server
and in the consumer are inconsistent. To avoid this problem. Kafka has a single primary replica
which takes all right operations and multiple read replicas
which just help perform reads. So if a client is pulling messages
from a read replica, it is sure that there is only one place where the write operations are happening
and there is no data inconsistency. Every read replica pulls messages
from the primary to stay in sync. Now, in case the primary replica fails,
that would result in all right operation stopping,
which would be a single point of failure. So what we do now is take one of the read
replicas and promote it to the primary. The way this is done is using Apache
Zookeeper, which uses the Paxos algorithm. You have a leader
elected between the replicas, and the only replicas which actually
participate in this election are the replicas, which are in sync
with the original primary. So the way they do this is replicas. Say, if I got a message in the last 10s
from the primary, I can be the leader. If not, then I am probably out of sync and I choose to
not be part of this election. Now, the good thing about this is Kafka
also has a high watermark, meaning a consumer
will only consume those messages which have been replicated
across all replicas. So even if message number three
is available in the primary, but it is not available
in any one of the replicas, it's not going to be shown
to the consumers. They will wait on three to be replicated
before they can pull it. In this way, you ensure data consistency. Another issue at this scale is the amount of bandwidth
that this distributed system needs. 7 trillion messages sent individually
are going to be too expensive. So what you want to do
is batch the messages. Let's say of maximum size 50 kbps
and then send them together to increase throughput. The same
thing is also done on the consumer side. Instead of consuming messages one by one,
the consumer can say give me the next 50 KB of messages. The maximum messages
that can be stuffed in this space are batch together
and sent to the consumer. You see the benefit of such architecture. The brokers. The Kafka servers do not have to manage
the rate at which they consume messages, nor do they have to manage the rate
at which they send messages. It's being decided
by producers and consumers. So the Kafka broker can just manage
offsets. While all application logic and retries
are managed by producers and consumers. Speaking of retries,
there is this guarantee called at least one
to guarantee in message delivery, which means a consumer is going to get
this message at least once. Take the example of you registering on a website
and you expecting a verification email. You would expect that at least one email for password verification will reach you
in case the first attempt fails. The second one will be retried and in case that fails,
the third one will be retried. Now, Kafka normally gives this guarantee
to its consumers. So as a consumer, let's say
you consume the first message, processed it successfully, and send the acknowledgment to Kafka
saying that please increment my offset. The next message that you pull
may be processed unsuccessfully,
may have resulted in a server crash, and after restart,
you can go back to Kafka and say, please give me my next message and the server
will basically retry that same message. Notice that here we are storing the offset
in the Kafka broker itself. This is possible. You can store it here or in zookeeper,
which makes them fault tolerant. So this would give you the guarantee
of at least once delivery. You could inverse your behavior
also as a consumer. You can see the moment you get a message, you send an acknowledgment
with the increment of the offset. And now whether you process the message
successfully or not doesn't really matter. So this may be a low priority message, like sending a notification to a user
in case it works. It's good. In case it doesn't,
it really shouldn't block us. Let's go ahead. Finally is something called exactly once delivery, which makes the
whole process really complex. The idea here is that only one consumer should be able
to pull a message from one partition. You have multiple replicas
for a partition. If a consumer pulls one message
from any one of these replicas or the primary, then that message
should not be sent to any other consumer. How do you do this? Kafka brings two concepts for this. One is the ability to have a transaction. So a distributed two phase
commit is what you're looking at here. It's going to be quite expensive. But if you want exactly one delivery
then all the Kafka servers having these partition replicas will need
to be in sync using transactions. And the second thing,
which is often used in Kafka and is a little more efficient,
is the concept of a consumer group. Let's say you have some famous LinkedIn celebrity
like Suniel Shetty posting a message. This message goes to broker
one to the topic of famous influencer. The next message is posted
by Varun Dhawan. It goes to the same broker, one to the same topic of famous influencer. Now imagine you have two consumers
one and two. If this both start pulling
from the same partition of this broker, they are going to consume this viral
message and distribute it multiple times to all of their LinkedIn followers, which
may be hundreds of thousands of people. You want to avoid this. What you do is assign each consumer to one topic partition. So consumer 1st May be assigned
this partition of broker one. It's going to consume
the first message of the new setting. Only after that is finished
processing will it dare to go to 1000. And consumer
two will not touch this partition. It may be assigned a different broker where God of sin
is going to be sending these messages. It's important to note, though,
that the same broker can have multiple partitions
of the same topic. So Gaurav may be part of broker
two partition one, but he may also be part of broker two. The same topic, but a different partition being consumed by a different consumer. Okay,
so the guarantee that the consumers have, if they are part of a consumer group
is that they are going to be exclusively pulling from a distinct set of partitions. So they are not going to be stepping on each other's toes,
but it has nothing to do with the brokers. The partitions may be distributed
in any way around the brokers and the brokers themselves can scale up
and scale down with no problem. Now let's see some of the optimizations in Kafka. One very interesting
and famous optimization that Apache Kafka gives
is called a zero copy. And this makes sending messages
in Kafka extremely fast. How exactly? Well, let's say you are sending message
number one to the consumer. Typically what happens is this message is going to be pulled
into some sort of a cache, an application cache. In your server. So the server which is running the Kafka
broker is going to pull this message into cache. It's also going to pull this message
into cache. And so on. Now when you get a request to pull message in one,
you're going to see the message in this cache M
one you're going to write it to a socket. And this IO socket is going to be the place
where the message is pulled from. Instead, if you could take the message
from the file system itself and push it to the socket,
you would save this redirection. Okay. Not only would you use less memory,
but it would be lesser IO calls using this optimization that Linux offers. Kafka is able to send messages
almost twice as fast. And it avoids a big problem in Java garbage collection. A typical Java garbage collector is very poor
at collecting objects from a linked list. The reason for this is something
called a young and old generation. It is called nepotism. You can check out the link
in the description for more details. But the basic idea is garbage collection
in Java incorrectly promotes old objects into a safe zone, and even though they're consumed even though they are dead,
this safe zone object is not collected. And eventually you have a bunch of dead
objects in the safe zone eating up your memory
and increasing garbage collection times. So you avoid this problem
completely by moving away from the application
cache to a direct socket call. So that's it for Apache Kafka. It's a very popular distribute system. It really empowers applications to send
messages from one place to another. It seems like a simple use case,
but at the scale that it operates, it becomes a really big engineering
challenge. And written in 2011
by a principal engineer at LinkedIn, many of the concepts
were extremely unique. They have now become a standard
in the entire industry. Thank you for watching this video. If you have any doubts or suggestions,
you can let me know in the comments below. If you want to see more videos on system
design, please check out and if you ready, I'll see you next time. Bye bye!

---

## 17. How I built an AI Teacher with Vector Databases and ChatGPT
**Channel:** Gaurav Sen | **Views:** 216K | **Date:** 1 year ago | **Duration:** 13:43 | **ID:** Z3uWleYwOQA
**Link:** https://youtube.com/watch?v=Z3uWleYwOQA

### Transcript:
Hi everyone, this is GKCS. In this video
I wanted to share with you how I built a AI teacher
using vector databases and ChatGPT. By the end of this
video will know what vector databases are, the internal workings
of a vector database, and what are some good solutions
in the market. The reason I built this bot is because I
have a startup called InterviewReady. It has video lessons. It has PDFs that you can download,
and often students have questions
which are related to the lesson. What would be ideal is if the user, while logged
in, would get a response immediately. Now there are two ways to do this. One is what a lot of people do,
which is hiring teaching assistants. This, of course, is expensive,
not just in terms of paying salaries, but also in terms of training people
getting their responses up to the mark. So the human element is a bit erratic, expensive and slow. If you can't afford it,
or if you do not have the people to train them,
or if you want to get very fast responses. This option number two
using a large language model to immediately respond to queries. All the problems here are taken away,
but the quality of the response has to be ensured. How do you ensure that with a bot? The first idea was very simple. We use the plain APIs from OpenAI
so they know how to use it. Ask a question,
be forwarded to OpenAI and return the response. So we went ahead
and bought a license for GPT. I did $100 in the API and then we tested,
but the responses were very bad. That's when we read up about something
new, something interesting, which is vector databases. And the basic
idea here is that you have a video file on load balancing dot mp4. You take the transcript of this file and then you store this text file. You send this as a request to ChatGPT and you say, please store this file. When a user sends a doubt for a load balancing question,
we are going to say listen. Go to the load balancing transcript. Read that file
and use it to give a good response. Remember, we are being charged for tokens. The number of characters we are sending. We are not being charged for
how much we are storing inside. I mean,
this is going to be a one time cost. Now if you just use the single file like load balancing,
that's just going to be one video. And one video is quite small. It's just five minutes long. Also the problem is it's just one video,
so there could be doubts around that area. Any auxiliary doubts, any doubts which are related to that
concept will just be dropped out. So this is not the best approach. What we should instead
do is look at the videos which are related to load balancing, all videos
which are related to load balancing. Should it be used to gain context by GPT and then send the response? So if I knew that video number one,
six and eight are related to the load balancing video,
which is video number ten, if I could say that these are
similar to it, then I could tell Gpt2 to use all four files of one, six, eight
and ten to give a response. The quality of that response
would be much better. It will almost be human like. The technology that we are looking at then is vector databases. Vector databases can answer queries
like given an object, find all similar objects. If you send an object, in this case a transcript to a vector database,
it processes the transcript and then represents
that object using a point. Okay. For example, let's
say you are watching this in 2D right now. So a point in 2D can be represented
using x and y. If I have a video transcript. One thing I can use the x axis for
is the length of the video, and the y axis I will use for frequency of the term system design. If I want to add a third dimension, I would either need to start showing you
3D video or I can use colors, which is frequency of the term low level
design. Blue means high frequency and red means low frequency. Now if I get a query for low level design, which points do you think will be relevant
for me? The ones having blue right
high frequency have low level design. That's
maybe something I should be targeting. Also, maybe
the length of the video is not too large, so the density of the term low level
design is high. That could be something
like similarly for system design. Similarly for load balancing. Similarly for different topics. Now three dimensions is too small
when it comes to making a point like this, because you have various terms
that you want to represent in this space, you probably look for a
n dimensional space. This point is easily
represented in a vector database, so you do not have
to do any kind of Cartesian calculations. You do not have to do a cosine. All of that is provided for you
using the API of a vector database. Okay. And a really good one
that I found is actually neon. There are many reasons I went for this. I am using Postgres at interview ready,
so Postgres is really nice. And there is a vector database
called pkg vector. Okay, this is what I came across. If I had to host this,
I would have to manually host pkg vector on my AWS instance. So this would be a bit of a challenge. Instead neon
actually gave a large number of credits. Okay, this
this database also has good documentation. So I ended up using it. So when a user actually has a query, when they ask a doubt under a video, the server sends the query and the content piece to our vector database. This tells you all similar points. Which is basically similar files similar transcript
similar videos to this query. Now we take these similar files. Take the names of them or the IDs of them, and we send this to ChatGPT. We say answer this query keeping in mind that these are the files
you should look into. ChatGPT gives us a response and then this
response is forwarded to the user. Let's now
look at how this is actually implemented. So the first thing I need to do
is take the videos and the PDF files that I have and convert them
into text text information. So here I've used AWS transcribe
to do this. It's a very cheap
service. It's reasonably good. Eventually you know as a creator you always have to go through
the transcription once. Anyway, so cheap is the only factor
that I am looking for. I need all this is pretty good. You can also get it for free in Adobe. So that's even better. But I also have live classes on zoom,
so I want a single page to do this. Now I get a file at the end
of this, which is the result. And I go to neon serverless. Neon, after all, is Postgres
with the wrappers that I need. I'm sure there's a lot of other solutions
also out there, but that code is open source
so I can, you know, literally go and check the things that that we,
for example, in a drag model, one of the things that you want to do is how is the vector database working
internally in case you want to know. So they use this algorithm
which is Heroku NSW. It stands for Navigable small World. The benefit of this
is that when you have a bunch of vectors in the spatial domain,
so n dimensional vectors, you want to cluster them all together,
the ones which are close to each other. And those clusters
will have representative vectors. So if you have let's say 5000 vectors
and each cluster is of size 100,
then you'd be left with 50 clusters. And each cluster
will have one representative vector. Okay. The benefit of this is instead of
comparing between 5000 vectors, you're now just comparing the 50 vectors. And one very useful benefit that I saw here
is that you are actually able to see the history of your changes on new,
and you can walk back step by step in history and go forward
also, and things will be fine. Why am I doing this? Because I've heard. When you are creating vector databases,
when you are having these kind of search queries, sometimes
you want to know what you did in the past. Whenever you are running an AI model, it's
not just that your code changes need to be committed. Like in git, you have these commits where
you can see what code change happened. But in reality, when you are running
your model, your data is also changing. So for the same code and same data,
you should get the same response. But tomorrow, if you want to see
the performance of this model versus some other model,
the data also has to be the same. So my database has to have some sort
of versioning history. Neon provides
that with the with the walkable interface. So overall I really like this database. That's the reason I'm putting it forward
so strongly. Also, I really like AWS in general. And if you are looking for
how do they upload these files, these transcription files to ChatGPT,
just Google the API reference for OpenAI. Here you will see various API endpoints. The one that you are looking for is files. So you will be able
to upload a file into OpenAI. And what you have to do is
you have to just mention a few parameters. This is very easy. Once the file has been uploaded,
you can use this file later on to answer queries. So later when you want to have a
conversation with the AI, you can do that. In fact, let me just show that to you. Here I have given a genuine instruction. You have a system
designed to talk to the AI assistant. I'm also saying the files
that you have to use are 175, 176, and 177. Now this is going to be fetched
from Nuan, right? As a similarity search. And the query is what is load balancing. So let's see what happens. Boom. Load balancing is a process that distributes network and application
traffic across a number of servers. This helps to increase the availability
and reliability of applications or websites by ensuring
no single server bears too much load. That's a simple answer,
which has been derived from the files
that we have sent beforehand. And the files have been chosen
by the one DB, because you know that these files are the ones
which are most relevant to the query. With this, users don't have to wait for
24 hours to get an answer on the query. They get an AI generated answer, which may be suboptimal,
but at least it is a response. Later on, an admin can come and
look at the answer, look at its quality and make a new reply, or delete
the old answer and make a new reply. If they want to. This is called retrieval, augmented generation or AG. This is becoming very popular
now in the AI world. The basic idea
is that you retrieve context from vector databases
which store similar content. Then you can augment this query
with context. The final step is generation. Here I use PD
because it's got a very easy API. I understand it quite well. I mainly test queries also on it. So in many ways
this was the easiest to use. But I have heard llama is also
very very light, very very good. And there's other large language models
also of course, which you can use. Thank you so much for watching this. If you have any doubts or suggestions,
you can leave them in the comments below. I'll see you next time. Bye bye. I wonder why you're sticking around. I just said bye. But if you're looking for implementation
details, I'll give you some hints. Now AWS
and OpenAI are pretty well documented. I don't think you need help there, but for creating a vector database,
what do we need to do? Let's login to this portal. Just click on New Project. You can add a name here. I'll just say YouTube project. And depending on your salary,
you can set up the instance you want. Also, depending on your region,
you can set up the instance. I usually pick up Singapore
and then I create the project. Now you see that there is this branching
which neon offers. And it's got a bunch of these connection
strings which can be used. Because I'm using go in the backend. I will go for this and I can just copy
paste this code literally that easy to connect to this database. You might need to change it a little bit
because you don't have a main function hopefully,
which is picking the database URL. But the good news is all the libraries
which are necessary, all the code for writing the connection
string is already here. If you're looking to play around with
the DB, you just go to tables over here and you can see all the tables
you create right here. Okay. You can find a SQL if you like,
have an integration with GitHub. Lots of stuff. But I think frankly speaking
the most important part is just creating the connection string
and actually being able to use this DB. Its ease of use is pretty good. So all the best. See you soon!

---

## 18. Google Dapper, a Large-Scale Distributed Systems Tracing Infrastructure
**Channel:** Gaurav Sen | **Views:** 11K | **Date:** 1 year ago | **Duration:** 12:42 | **ID:** AZhIjNHzURQ
**Link:** https://youtube.com/watch?v=AZhIjNHzURQ

### Transcript:
Hi everyone, this is GKCS. In this video we talk about Google Dapper. That is a request
tracing system at Google. So when you type "Large language
models" in Google search, you will see a list of pages
in front of you in the back end. What happened is that this query string
was taken to the Google servers. The Google servers
potentially hit thousands of data stores, fetch the results, and created them,
and got them in front of you in your search page. So now you have them all paginated. You have them searched, but behind
the scenes a lot of things happened. And if you want to trace that request path
as a Google engineer, if you want to see how did go from client to server, how it go from server to all these data
stores, what does the aggregation like? How much time did it take
to get a response? The entire tracing is managed by Dapper. This is from 2010. Now the first thing you want to do is make this process
seamless and low latency. If engineers are given a tracing system
which is going to be impacting the production services,
they will not be happy with them. They will not onboard. So the first requirement that you have
for this kind of a tracing system is it has to be very, very fast, basically have very low latency. The second thing like we mentioned
is that it should be easy to onboard, easy to use, easy
to setup, easy to maintain. And the third thing that we mentioned is
it has to be universal. In the sense that all the services that you are hitting as an engineer
have to be using the app internally too. Otherwise, there's really no point. You're going to be seeing
the metrics of your service, but you wouldn't be able to tell
if a RPC call to a different service caused the problem, or your service itself
has the problem, so it has to be used by all services. Apart from this,
you're also looking for high availability because if a service goes down
or if it's slow, that is what you will be using to debug it. So the chance of this service going down
has to be low. You also want the data to be as consistent
as possible, as fresh as possible. If a service is having problems
and an engineer logs into the system, you want to be able to see the requests
which are going wrong. So this is going to be real time tracing. So this is less than one minute
since creation. Finally, the system has to be a Google system which is quite scalable. They have one terabyte of request traces per day. One terabyte is more than the size of my
database at the start of that interview. Ready? So that's a lot of request traces. Engineers usually are looking
for request traces in the last two weeks, so they do not need to store
all the request traces forever. Just the past two weeks is enough. Now, most of these are technical
requirements. These two,
though, are a little political or, ease of use and adaptability is something
that senior engineers need to consider. Not so much on the technical side, but on how people are going to use this
system side. Well, one thing that we have spoken
about many times in many systems, especially memcached, is the importance
of having clients, software, clients,
which are basically libraries that other engineers in different systems
can use. Do check out that video. Using software clients is also what dapper does to make
the adaptability of the system high. In fact, Google has a very generic client
for making any remote procedure calls, and so dapper is added to this client so that request tracing becomes universal. But for the rest of the requirements, you need to have a technical understanding of how the system is going to be built. So let's look into that. Now this is
what is actually stored inside dapper. You have this object
which is called a span. And internally this span stores a set of events which have happened
during the login request. So you try to log in at Google. Initially we check whether the domain that
you are trying to login from is allowed. That is a remote procedure call. It has an ID of two
and a parent of one like two. Okay. The parent's panacea. Now after this RPC call is done,
you can go and start a new span, which is basically a new remote procedure
call to the profile service. It checks
whether the profile exists at Google. If it does, then you get a response
and again you see that it has an ID and a parent,
which is equal to one. Internally, the profile check resulted
in two other remote procedure calls. One was to check
whether you are already blacklisted and the other is to authenticate you,
maybe with the password. Both of them have the same parent
of three, which is this profile check. And eventually
when these calls have given a response, we go to the parent
and complete the event stream. Okay. This is a single span. This is also a single span. So is this. So is this. And so is this. So how do you trace requests. Well all of these spans
have the same trace ID. So the trace ID here. Is equal to one trace ID here will also be equal to one. In all the children the trace ID will be one. So that when we query dapper for a trace ID,
we can get all of these spans together and look at it from a high level
or a service specific level. Internally,
like I said, each of these events is basically like a micro object
inside this span. It's like an array of objects. And this event is going to be storing
the timestamp. It's going to be storing the service
which actually started this. And one annotation okay. Like a text string of RPC calls started
RPC call stopped. Now let's see how these objects
are being created and stored in dapper. Behold the dapper system. It's a very simple system. That's the reason why I'm so excited. I guess you have clients,
which are basically running on application servers,
and those clients are persisting logs. I've drawn a database,
but it's just a file, right? You have your log files. Those are being stored in local storage. And what's happening is these logs, these log files are being consumed
by a dapper background process. It's a daemon process which buffers them till they're eventually
pulled by a collector. So there's a set of collectors, dapper
collector servers which are pulling these log lines
from these files. And then they process it
to convert it into a span. Right. We talked about spans. This is where the magic is happening
that objects are being converted for persistence. They are being stored in Bigtable. Bigtable is a storage solution
that Google has. It's backed by GFS. Now Colossus. Okay. It's used for places where you need sparse
data or multiple versions of the data. Google search, for example,
when it is storing pages, multiple versions of the same page. The document for search results
uses Bigtable. It's a very old system.
You can check out the paper. I will put the link in the description,
but the basic idea is that this makes the dapper system reliable. So there is high availability here, and to some extent
it also makes it scalable. One terabyte of data per day
is no big deal for Google Bigtable. Now this is just for a single machine. Google has hundreds of thousands
of machines which are running dapper and each of those machines
have multiple applications running. All of those applications
have their own log files. All of them are being pulled
into the background process and eventually into the collector
into these objects. So spans the spans, like we said,
have traces. See, single trace may have multiple spans. And when, engineer at Google
wants to query for a trace. Right. So they may say
get trace with the ID of the trace. Bigtable. Has an index on the trace ID. Which helps them
see the entire array of spans which are related to this trace ID. Okay, so if a single person makes a search request of large language models
and you want to trace it later, you find the ID of that request,
come to Bigtable, make that search query. And it will give you all of the spans,
meaning all of the systems which are hit because of that single large language
model query. The interesting thing
is this entire process from here to here takes about 15 seconds. So most of the requests reach Bigtable within 15 seconds. Most of the times when you are doing
any kind of a get trace, you get it within a minute. In the worst case,
it can take up to two hours. But that is also I mean, two hours is not good,
but that is also acceptable for that. For now. One thing that we mentioned is that this system
has to be very low latency. It has to be super fast. It has to have very little overhead. Otherwise engineers
will not use a tracing system which is slowing down
the production systems. I o calls are the bulk of latency, right? They take most of the time when you are
looking to process these traces. So how do you reduce the number of
IO calls in the system? One thing would be
to try to batch the requests. I think it is already done,
but another clever thing that Google does is instead of taking all the requests, it samples requests. If you sample requests, meaning out of 100 requests,
you just take one request. As a Google engineer, you are going to be searching for
get requests to a particular service. With start timestamp and end timestamp. Okay, these are going to give you
all of the requests within this timestamp that have been sampled successfully
and persisted for that service. And the reason why this works for Google
is because they have a huge volume of requests. In fact,
the production systems take 1 in 1 024. This is the sampling rate. It's insane. When they run the experiments on latency,
they saw that the system got faster because the margin of error was so small
that it looks like the system got faster. Some other thing must have happened, but you are taking only one out of 1024
requests. It makes sense that your system
is having zero impact on latency. All the samples for the given request
have the same trace ID, so if your total ID space
is two based about 64, you divide this by 1000
and you get roughly two about 54. So all the trace ID
is having a number less than or equal to this will be sampled. Everybody else will not be sampled in case
your service does not have much volume. In case your services like interview
ready or something, then you have, adaptive sampling rate. Which means you can mention that
give me at least ten samples per second. So instead of having a fixed sampling
rate of one by 1024, you say I want ten requests per second. So if I have 100 requests per second
in my service and I just want ten of them to be sampled, then I automatically set
the sampling rate to one by ten. Okay. This would be adaptive sampling. This is rarely used because most services
have so much weight in them, but yes, it is used. So that's it for Google. Dapper. It's a simple, interesting system. I particularly like the
the approach that Google engineers took. Instead of trying
to build things from scratch. They used existing systems like Bigtable
and their RPC clients
to increase the optimality of the system. Another thing I really like about
it is other systems like Google, monarch actually use that for traces
to debug problematic requests. So it really integrates well
with the rest of the Google ecosystem. Thank you so much for watching this. If you liked the video
then please hit the like button. If you have any doubts
or suggestions on this video, post them in the comments below. And if you're looking to learn more about system design, do check out InterviewReady. I'll see you next time. Buh-bye!

---

## 19. Monarch: Google's Planet-Scale In-Memory Time Series Database
**Channel:** Gaurav Sen | **Views:** 8K | **Date:** 1 year ago | **Duration:** 15:18 | **ID:** NxPTVhc1tFA
**Link:** https://youtube.com/watch?v=NxPTVhc1tFA

### Transcript:
We are talking about Google Monarch today, which is a paper from 2010. Monarch is a time series data store. So at Google,
if you want to store server side metrics, for example, how much CPU was used,
and if you want to plot that as a graph. So time is on the x
axis and CPU used on the y axis. Then monarch can store data points here such that later on
you can plot them on a graph. You might also notice
that there is a spike at one point, in which case
you might want to dig into this position. Timestamp t one. What makes monarch unique is the scale
at which Google operates. So the amount of data that is being pushed
in per second is 6 million data points. In total it is petabytes worth of data. And since it is a time series data store
which will be used to track metrics in real time,
this is going to need very low latency. I'm talking about less than 100
milliseconds. There's one other major problem
that monarch solves. if a system at Google is down. The reaction time
totally depends on monarch. If spanner goes down,
monarch doesn't go down. if Colossus goes down,
monarch still goes on. It can't have a hard dependency
of any of these systems. you have extremely high availability. Let us see how Google built this system. So let's go back to 2010. You are the principal engineer at Google. And you hear these complaints
from engineers who say, I have a system. I am running Google Photos
and my fleet of servers. Pushes metrics to a system, a monitoring system. Every time there's a problem,
I have to log in to this system and see where things went wrong. You ask them, how did they develop this? And they say, oh,
there's a common library. There's something called Borgman, which means board monitor at Google. This library is used by all systems,
all of the server fleets that we have to push metrics. To the monitors. So this is like
you having a very large company, and you have different teams
in that company. Each of those teams is deploying Borgman
individually in their own set of servers. If Borgman goes down for them,
then they have to manage it, okay? And they also have to know some internals
of Borgman to actually be able to use it. And this is not very good. You see that
multiple teams are doing the same thing. Duplicate work. If you can save engineering time,
you can save engineering money. Okay. Money for the company. So you are the principal engineer. Like I said, you are going to look at this problem and say, I can solve this problem in a common way by moving away from Borgman to one arc. This is going to be my time series data store
where various metrics will be pushed in. People do not need to worry about it
much because they will have other clients, which will be taking data and periodically
pushing to the monarch's servers. And so one decision that you make
almost immediately is you have petabytes worth of data, which has to be accessed
at any given point in time. So this system has to be in-memory. Okay. And in-memory data store having petabytes worth of data
is going to be a very expensive system. But hopefully with the requirements
that we have, it is going to be worth it. Let's understand what kind of data
is being stored in monarch. For observing the health of systems. One important metric is request latency. Servers emit events
every time they process a request. The amount of time that this request
took to complete. So that could be ten, five, ten, two, six, and so on. If you plot these values in a graph. It will look something like this. Visually, you can see the anomaly, but what monarch does is
make this detection even easier. Instead of plotting request latencies, it makes a histogram of request latencies. So 0 to milliseconds were taken
for eight of the requests. One request was served
within 11 to 20 milliseconds, and one request took between 81
and 90 milliseconds. When you plot the histogram of this, engineers can easily tell you
what are p99 latencies. And also if they detect anomalies
like this. They can trace the request using examples. Monarchs stores examples for every. Window in the histogram. So from 0 to 10 you will find one example
request that is a normal processing time. From 11 to 20
you will find another example. In our case there is only one request
which took 16 milliseconds. So that will be stored. The trace ID will be stored
and 81 to 90 has one request. which engineers can use. To dig deeper in the system. So this histogram explains how well requests were served
within a time window. The initial graph had requests with time
on the x axis and latency on the y axis. If you look at the time window here. The resultant frequency graph. Notes down this time window. And what monarch does is for every time
window it stores a histogram. which explains how
well the system is doing across time. So an engineer can. Dig into a single time window,
or they can get an aggregate. Across multiple histograms. One of the most impressive things about monarch
is you store billions of data points. In memory. This would not be feasible unless Google
applied compression algorithms. If you try to keep the raw data in memory. You will require millions of servers,
which is going to be too expensive. So Google applies two techniques here. One is to share the timestamp. You see timestamp
one here is going to be shared across all the histograms
generated for different metrics. This results in 90% savings
when storing timestamp values. The other benefit of this
is interpolating data or doing joints across metrics is much easier now
because they are broken into time. Windows Sharing the same timestamps. So if you want to see. How did request latency? React to changing memory usage. Doing so is easy because. You have a direct mapping with timestamps. The other
algorithm is differential encoding. Here you have values in each histogram. Let's say 811 for these time windows. In the next histogram you expect that
most of the values will be similar. You are probably going to get 7 to 1. So instead of storing these three
big numbers we can take the differences of the numbers And store
these smaller numbers using fewer bits. This helps compress every time series
for every metric. By around 90%. So instead of storing exabytes of data
in memory, we can do with just petabytes of data. So this is the high level
architecture of monarch. You have a route in blue. And this is just one root
node in the world. You also have zones. So 30 or 40 zones around the world. And these are like child
nodes for the route. And each of those zones
has a bunch of leaf nodes. Okay.
So the data points are being stored here. And the query actually comes and hits
the root. Always very similar to Dremel. In fact you will see many components are
extremely similar to Dremel. You have data
which is being written to by services. So every one second tell me how much CPU
is consumed per server, that kind of data. Those data points
are being ingested into this server. This is going to buffer the data
for a while, and it is also going to route it
to the right zone. Okay. So this router belongs to a particular
zone. the router then is able to move the data
to the right leaf node. It has a mapping of key to list And so data can be persisted over here. Each of these leaves is connected to. Colossus. Which is a distributed file
stored at Google. There was a Google file system
earlier GFS which used to do this. This is used for storing logs. So you can think of each metric as a log line
in case a leaf server crashes. It can go and pick up from Colossus
that data and rehydrate itself. So there is fault tolerance
also over here. Whenever there is a query, it comes to the root. The root tries to find
where this query belongs to. What zones are responsible
for the incoming query. It then sends the query to relevant zones. The zone itself has multiple leaves. It looks at the key, the list of keys
that have been asked in this query. And then it hits the right leaves. Once the leaves have a result,
they propagate it upwards to the zone. The zone aggregates. The result sends it back to the root,
which aggregates it again and sends it back to the client. To speed up
query execution, you also have an index. So at the root level you have one index which tells
you where a query should be rooted. So instead of storing that index here
and managing the index here, you have it in a separate component. You also have
the same concept in the zone. So where does a key belong. Which leaves does it belong to
is stored in an index. This is similar to a database index. One major optimization for. Making queries fast in monarch. Is the idea of field hints index. This is stored in the index. So. What this does is take
every key That a leaf is storing. And convert it into trigrams. So that's three consecutive characters. Created by sliding a window of size
three across the key. So trigram
four courses will look like this. Start. Start c. Start c o c or u, and so on. Till s dollar dollar. Okay. Dollar. Here is the ending sign. And now you take each of these trigrams
and hash them. You will get a bunch of numbers. This is like the unique fingerprint
Off that key. When you get a query for the key,
the only leaves that you are interested in are the ones which satisfy all of these
trigrams which contain all of these. So this is very similar
to the idea of a bloom filter. where an element can exist if and only if. All the indexes
corresponding to those trigrams. Are set to value one. If this is the case, we go to leaf. Otherwise we do not. The benefit of this is 99.5%. of all leaves are ignored
thanks to this field hints index. Thanks to this trigram algorithm. So you have sped up your query execution. By 200 x. At the zone level. And on top of that the root index. So reduces fan out by 80%. So again you have. Sped up your query execution by five x. In total queries execute 1000 times faster
thanks to the indexes. This lets engineers at Google
find data blazingly fast. And the other common
use case is a pre-computed cache. Very often you have periodic queries
being fired on manok. So you want to see the overall health
of a server. You say, what is the maximum
CPU usage in the last one minute So you do not need to fire a query
every time from root reaches the zone
and hit the leaf for that. Maybe you can pre-compute that query
and store it in a cache for ozone. In some cases there are global queries
which you want to keep pre-computed. So in that case you will be using
the pre-computed cache of the root. You can imagine them to fire a query
every 10s to the root node. The root node goes to the zone, gets
some value from the pre-computed cache. Most of the data is right here,
but in case it needs to, it will go and hit some leaves
and give a response. The cache is helpful
mainly for repeated queries. Any general query follows the root
zone and leaf path. Also for fault tolerance. What monarch does is store the data
not just in one leaf, but in three leaves. So these three leaves are chosen
for a single zone. If a zone goes out, then
you may not be able to query those leaves, but that is fine. At least one leaf server going out
is not going to stop your queries. This reduces
the tail latency of most queries. Also it provides some fault tolerance. in case the leaf server has a lot of load,
and you want to assign some of the shards in that leaf
to some other leaf. What you can do is continue
serving requests on this leaf. Meanwhile, migrate
the data from Colossus to this new leaf. Once the leaf is ready,
after a second or two, You can stop answering queries from this leaf
and answer queries only from this leaf. Okay, so there is a period
where both leaves can respond to queries, but that helps avoid request latency
that keeps the availability of the system high. In case there's any problem
while migrating data. Well, that doesn't reflect on the client. These two other things which increase
the availability of the system. One is when a root
is trying to get a query from a zone. If the zone is not responding
for the first five seconds. And let's say
the request timeout in total is 10s, then what the root expects is the zone to start
giving partial results. So this is called a soft timeout
in case you do not give me any results in the first five seconds.
I'll cancel the query. If you start giving me results
for the first five seconds, then I'll wait for you to complete. I will wait in total for 10s. That's my request timeout. But my soft timeout is just five seconds. So in this way
I'm not depending on you too hard. I can go and hit some other zone
if needed, or at least I can feel the query
and tell the client that you know it didn't work out.
You can try again after some time. The other thing is,
if a zone is trying to query a leaf and the leaf is not responding,
then it can start hedging its bets. Meaning,
if you know that both of the leaves have the data,
Then you send the query to the first leaf. Wait for a second. If there is no response,
send the query to the second leaf. Also, you do not wait for an entire 10s
before this fails and tells you I'm sorry. The zone at second number one and second
number two can query the other leaf. Get the response quickly. Even if you have the same
repeated response here, you just ignore it and you can send back the response
within two seconds instead of ten. So that's it for Google. Monarch. It's an in-memory time series database
which stores petabytes worth of data and is able to respond to queries
in tens of milliseconds. Also, it has some dependency on Colossus, on Spanner, on maglev,
which is the load balancer at Google, but it doesn't have any hard dependency
in case things go wrong. This is a quote from a Google engineer
if things are literally on fire, monarch is still running
If you have any doubts or suggestions on this video,
do let me know in the comments. And if you like this kind of system
design content, check out interview ready. I'll see you next time.

---

## 20. Zanzibar: Google’s Consistent, Global Authorization System
**Channel:** Gaurav Sen | **Views:** 27K | **Date:** 1 year ago | **Duration:** 17:02 | **ID:** 9gvJHf9FqmM
**Link:** https://youtube.com/watch?v=9gvJHf9FqmM

### Transcript:
Hi, everyone. This is GKCS! Today
we are talking about Google Zanzibar. This is a system
which is written in 2012 at Google. But the paper is from 2019. After a lot of optimizations
and challenges that Zanzibar is solved. What does it do? It is an authorization system. you might have seen
this when sharing documents at Google. So whether it is Google Drive
or Google Docs, when you say share by link,
that is what access do they have? Is it your access or editor access
so editors can change the file
while viewers can just view the file And there is one hidden permission
in Zanzibar, which is the owner. Owners can both edit
and view the document, and they can also delete the document
if they want. So they have the maximum permission. Okay. So you see that in this stack
as you go up your permissions reduce the benefit of
this is if you see that a person. Is the owner of document one. Then you know that they have edit and view
permissions. Also. now. Why is this a big deal? What is the problem? All you have to do is take a table,
where the users and documents and store that somewhere.
And whenever a person is asking for permission,
you just check on the table right? Well, for Google, they have to store trillions of records. These are the access control lists
that they have to store. So for a document Gaurav has view access
for the same document from Burma has edit access and for the same document
then the Modi has other access. So what happens then is you have
lots of records that you have to store. And when you need to fetch
those permissions, when you are trying to authorize a person, then you have to fetch amongst
trillions of records. This is terabytes of data. The second thing is. you have millions of queries, authorization queries per second. the only paper which comes close to this
in terms of scale that we have looked into,
is Facebook door right? It also has millions of graph queries
per second. You see that there is a hint of a graph
here. Also,
a person is the owner of document one. A person has edit access to document two. and similar
to how the scale is just massive. The third thing to point out
how big this problem is, is the number of distinct nodes
you have on this graph. You have billions of people, billions of people
using Google around the planet. So there are billions of users. And trillions. Of documents. Not every document is created by a user. Some documents are auto generated. Also,
some documents are created using scripts. So you have a huge number of objects. Edges and queries. In this system. And despite
all this, you want tremendous performance. Whenever you are trying
to get a document from Google, you want to get that response
in a subsecond. So maybe 500 milliseconds, 500 milliseconds is a total time
you can get to fetch the document. How much time
do you think you can give authorization in some milliseconds. Right. So you want the latency
of these millions of queries per second to be in tens of milliseconds. This is the first big challenge
that we face. The other big challenge is how reliable does this system need to be? If authorization fails, Google is down. All documents are inaccessible. So if Zanzibar goes down, Google is out. How often do you think this can happen? Google said that we can have around
ten minutes of downtime. Per year. Which turns out to be something like 99. .99 9% availability. Okay, fine. Lines of availability. And one clue that you have in terms of how is this system
going to be accessed, is you have 99 or greater than 99% of your queries. Read queries. most likely you are going to be setting the permissions of a document
when you create it. you at least have 99 read access
of that document of that authorization access control list. Before a change is made to the document, Now let us go back to 2012. You are the principal engineer at Google. And you notice that many of your products
Google Drive, Google Photos, they have documents which can be accessed
by different users in different ways. So God of may be part of the engineering team. And at the same time promote Obama. Maybe part of the engineering team, right. You can share a document, Maybe UPI technical document with all people
who are part of the engineering team. So the way you represent this instead of this graph
is through a single line relation. So it's going to be the upper document is having a relation of, edit. With everybody in the engineering group. and since you might run out of these IDs
you can also give a namespace. So in this way using text using
a single line you can define a relation. This relation defines this edge. Okay. If you want to define this edge
Gaurav belongs to the group engineering. Then all you have to do is just say. Org engineering. Has a notion of member. With Gaurav. Right. You see, everything after
the act is the source. Everything before the hash. The starting part is the destination. So Gaurav has a relation with engineering and the type of edge is member. in this way,
you can represent the entire graph which describes
the authorization permissions at Google. Now if a person asks for
who has access to this document, right. Who can edit this document? First what they have to do is they have to find all incoming edges
to this document. If it is an individual who is pointing to it,
then they get that respective permission. If it is a group,
then that group has to be expanded. But in this way
you can authorize any kind of request. If Gaurav asks for a view access
to a document. You check whether uptake is having a view
access to Gaurav in any way possible. So you spread out as a tree and try
to find Gaurav in any one of the nodes. Let's look at the read operation first. You have a source,
a relation, a destination, and a timestamp
That's possible to pass in the read API. You see there are stars around. Source, relation and destination. which means that they're optional. So if you pass all of them
then you're going to get whether this relation exists
or not in Zanzibar. For example. Does a user have edit access
to a document? If Zanzibar finds this relation,
it will say true, otherwise false. If you do not pass the relationship type
and Then you get all the relations between these two nodes. So get me all the relations
between user A to document B, Zanzibar will check
all the groups that user ID belongs to. Figure out the relations in between. And return all of the tuples
for the source and destination. If you just passed
a source, You will get all the relations that this object
has with every other destination. So who have access to this document
can easily be found using this API. You can also just pass in the destination,
all the documents that a person has access to,
or a group has access to. you see that most of the access
patterns are taken care of just using this read API. 99.9% of Zanzibar requests are read. and they basically use
a variation of this API. You also have write operations
which are extremely simple. Just pass in the source,
the relation and the destination. So you're adding access of edit
to user A for document D. Is a single API call. now, one thing you might have noticed
about the read and write APIs is
they have something called a time stamp. Which is what allows
data consistency in Zanzibar. the guarantee that Zanzibar gives is
if you have a write operation, let's say of timestamp 100 and the subsequent read
operation of time stamp greater than 100, then the write operation
will reflect in that read. If instead you have a read operation
which is less than 100, then there is no guarantee that the write
operation will reflect in that read. Now this time stamp is provided
by spanner, it is literally a time stamp. A globally ordered time stamp. I wonder why you are sticking around. But if you are, then may I suggest
a series of system design videos? And that will be released
over the next six weeks. Do check it out, I have it pinned in the top comment. Have a great day!

---

## 21. Google Dremel: Interactive Analysis of Web-Scale Datasets
**Channel:** Gaurav Sen | **Views:** 80K | **Date:** 1 year ago | **Duration:** 16:06 | **ID:** u8lKJWWVE0M
**Link:** https://youtube.com/watch?v=u8lKJWWVE0M

### Transcript:
Oh. Hello, everyone. We are going to be talking about
Google Dremel today, and that is a paper from 2008. Dremel
has been an extremely influential system. In fact, even now,
which is more than 15 years later, you will see that
Dremel is being used at Google by a system called BigQuery. It has been so influential that, well, DB awarded it the Test of Time award in 2020. 12 years after it was published. As a software engineer, it makes a lot of
sense to know about this paper. Now the first thing is what is Dremel? In 2008, Google had a lot of data. Its wealth of data,
which it wanted to analyze. They wanted to mine the data and product
managers, engineers, CXOs wanted to write queries on this data
to see what patterns they can use. Now, the problem here was that petabytes
worth of data takes a lot of time to scan, a lot of time to process,
and a lot of time to output. Usually, product managers. And CXOs want to fire one off queries. For example, a product manager at Google
may want to see how many people who take long rides, let's say Mumbai
to Goa stopover at restaurants for food. So based on this information,
maybe you want to serve contextual ads. We know you're on a long drive. Maybe we can give you an ad
for a restaurant which is on the way. This is just an idea. You're kind of brainstorming right now. You want to know the data first
to help you make a decision. But how do you query this data? 2008. The standard
way of doing things was MapReduce, which basically meant
that you would have jobs running. And these jobs are defined using code. Engineers would write this code, write
these scripts based on what they heard
from product managers. And once these scripts executed, you would get an output. In our example,
that would be the number of people who go to restaurants
nearby during a long drive. It's 56%. The product manager looks at this
and says, this is great. I want to now know in the last
three months what's the percentage? And before that, what was the percentage? So is it that this number is increasing? Are people more prone to taking
a restaurant nearby during a long drive? What do you have to do now? You have to write another job. You have to write code again. Basically, this product manager has
to go to a software engineer, explain to them what the task is,
wait for them to write the code. Wait for them to execute the code after the execution based on what you see,
based on the insight. You might ask a new question. The iteration time for
this was very large. This used to be in days. Okay. And if you would have dedicated engineers
just for MapReduce jobs, it would still take hours. Usually 1 to 3 days before
you could make any sensible decisions. That's a long time. CXOs had the same problem. Now put yourself in the principal
engineer's shoes. Eight Google. You have a lot of product managers
complaining about engineers being slow or complaining about the systems
being slow. Sometimes this MapReduce job fails. You have to restart it. It's it's a nightmare. And you have engineers complaining
about the time being wasted by product managers because half
the day is spent just mining data, and the rest of it is spent talking
to PMS, understanding the requirements. Google decided that they need some sort of interactive analytics system. Interactive,
meaning you want to get results for any query within a minute. The second thing you want to do is free up
the software engineers who are currently
just writing MapReduce jobs. You can utilize them by putting them
in different teams, and you can provide an interface to the product managers such
that they can query the data themselves. This will remove one layer of dependency. The software engineers no longer need to be consulted
before any kind of query is fired. So you want to remove. The dependency. How do you do this? One way would be to give
an extremely detailed interactive analytics tool
where a product manager without any coding experience
can easily find queries. What kind of tool will that be? Most product managers know SQL at a high level, at least. And if they don't,
they can hire a data analyst. They can use a team of data analysts
who are great at writing SQL queries. Okay, so this is much cheaper. You don't need to have software
engineers writing MapReduce jobs. You can have data analyst do this, or you can have the PMS themselves
writing the SQL queries. This was one major decision
which has really helped Dremel become very popular
in the analytics space. And for interactive analytics, answering
queries very quickly within one minute. You can't do this without looking
at the access patterns of the system. How is this system being used? So usually the system is used for
getting count queries statistical queries. This is a great insight. CXOs normally don't want to get the rows. I mean, the people who actually went to
a restaurant that doesn't matter to them. They want the count aggregate percentage. Stuff like this
that helps them make decisions. So you're mainly looking for
statistical data when it comes to queries. And usually this data is distributed across systems. So you need to filter
through these systems. And then aggregate the data. So these two parts filtration and aggregation
have to be extremely fast. You want answers within one minute. Filtration and aggregation have to happen
blazingly fast. Let's understand how this happens. So this is the query
architecture of Dremel. You see that you have clients
who are product managers using a dashboard or using some sort of interactive user
interface. The fire query
which goes to the query manager okay. The query manager is part
rate limiter, part load balancer. It finds which shard should be hit based
on how much load is there on each shard. If you do not know about sharding,
please check out the video. It has a double
roll. Ha ha ha ha ha! Right. So you have a query manager
which is sending queries to the root. And the root node, as you can expect, is the root of a tree. So this is going to aggregate
all the results and is going to return a response
when the query has finished processing. What the root does is
it looks at the query, looks at those shards
which have to be hit for this query. So each shard manages a range
a key range, little k one to k 1000 here. And you have k greater than 1000
managed here. If you want keys 101,100 then the query has to flow to both nodes. What shards? What are these shards? Are these logical entities? No, they are physical servers. This shard then recursively,
internally again queries its sub shards. So you get the query of 100 here. Maybe the first 500 exist here. And the next 500 exist here
because 100 is less than 500. You do not need to query the
shard. So that's some saving. And so k 100 will eventually reach the leaf node
where it belongs. And the leaf
can pick it up from its local disk. If it has it. If not it will go and pick it up
from a distributed file store. In 2008, that was Google file system GFS. You might have heard of this. Will pick this paper sometime. And right now the newer version of that
is called Colossus. Okay. Interestingly, most systems at Google need some sort of store which is managed by Colossus. They need network. Capabilities, which is powered by Jupiter. They need compute and memory, which is powered by Borg. This is inside Kubernetes and they need some config set up which is taken care of by spanner. So amongst
these for Jupiter is used by Dremel for network capabilities
and storage is also used. And these shards that you see
are definitely coming from Borg. So when you're making a query the query manager estimates
how much compute do you need? The compute is measured
as the number of machines into the number of threads that they have. So the total number of threads. Defines the compute power for this query. If you need more compute power,
you can increase this. If you want to reduce the compute power
for this query, you can do that based on that. The time taken by the query
will increase or decrease. Now, when the result is fetched from disk
or distributed file store, it is propagated
upwards to the parent shard and then it is propagated
upwards to the parent shard. You see I have added dots over here
very sneakily. That means that there can be
any number of levels. And the query manager is something
which suggests how many shards will be needed to effectively aggregate
this kind of a query. What's happening at a high level? If you have worked with segment trees or
interval trees is we are taking results. We are aggregating them,
putting them on the higher shard and we are going up the tree
till we reach the root. This architecture you see repeated
at Google many times a tree architectures. I think they like it because they also
have it in Google monarch. It's highly efficient because queries are usually answered in tens of seconds,
and therefore the clients. The users can make decisions quickly. They do not need to go to lunch
now for every query to compute. Instead, they can sit on their desktop. Wait for a minute. Maybe the loading goes on
and then they get a result, and then they file a new query
based on that insight. The system is also smart in the sense
that it has a prefetch cache, which fetches data relevant to the query
that you just made. For example,
when you say tell me the number of people who have visited a restaurant
while going on a long drive, it's going to get you data around
long drives, and it's going to get you data around
restaurants. Prefetch in cache. So the rest of the queries, the upcoming queries are most likely going
to fetch the same kind of data. It has a 95% hit rate. So you don't have to go
all the way down to the leaf. You don't have to fetch from local
disk, and worst case, you do not have to fetch from this root
file store. You can get from a cache with a 95% hit
rate, which really improves the latency. Another optimization that is very useful
is when clients. When product managers
don't want perfect answers, they are okay with getting 99% accuracy or 90% accuracy. For example,
you want to know the percentage of people who in a long trip
have gone to a restaurant. You don't have to get 56%. You can be off by plus -2%. It's not going to affect you. But why is that important? If you have this luxury,
if you can make an approximate result, then the query manager tells a route
that when you have 98% or 90% of the results, give me a response. Don't keep the client waiting. So it's possible that L3 is down or L4 is taking a long time. We do not need to wait on all the leaf
nodes. We can give it a response
to the moment we are short enough. This opens up a lot of possibilities. If you want to see the top key results. So what were the top ten most popular YouTube videos? You do not need to go to the entire
YouTube video set. You can go through maybe 98%, 95%
and those last 2%. The latency is very high. So if you ignore them,
then you really save on latency. And the final optimization that Dremel brings is columnar storage. All data processed by Dremel
is stored as columns. The benefit of this is columnar
compression is much better, especially when you are looking
at aggregate statistics. For example,
if I have tuples like this where the name, country
and age of a person is to be noted. So this would be row one. The way I would store this would be. Next to this
I would attach row to name country, and each row three then would come here with name, country and age. If I wanted to do the average age
of my users, I would need to scan all of this data. I would need to sequentially read
all the data instead. If I could keep all the columns together each one inch to each three. Name one, name two. Name three, and country one,
country two, country three. Then the average age
would just require a scan of three data points
instead of nine data points. So faster scans would be possible
because of columnar storage. The other thing
which is really important is compression. If you have the same kind of data
being stored together, then you can use compression
algorithms like nonzero run length encoding to reduce the space
consumed by your data. This means you need less storage,
less bandwidth. So the processing is usually faster
but non-zero. Run length encoding has some issues. One of the things is whenever you have a block of zeros
and you want to query between that block, it's difficult to find ahead
when all the records are zeros. To actually hydrate this data,
you have to go up to the top header to avoid this. Google came up with its own compression
algorithm, which has inspired many other systems. Apache spark, for example, has picked up ideas here. The engineers at Twitter
developed this format. Now it's open source and it's
got even better algorithms than this. But the basic idea here,
if you know about Huffman encoding, is you take your data,
you spread it out like a tree. So a trip has an ID,
a trip has multiple locations in it. It has multiple users, zero to start. Each of those users
may have multiple interests. They have a country defined
or they do not have a country defined. The interest may have a type. So I am interested in burgers. I am interested in pizza and location
may actually be a polygon. So that includes space. And you also have a type of location. So it may be a restaurant,
it may be a playground whatever. What Google did is take each of these data
fields and compress them in a way that it is easy to decompress later
when you are querying for that data. It's going to be easy
to find the range that you are looking for and get the aggregate statistic. The algorithm for converting these objects
into a format which is suitable for columnar
storage is very involved. I went through hours of resources
and decided not to put it here. If you're interested,
I have the links in the description and if you want to know, is it
going to be useful to me as an engineer? Well, no. But if you want to play around
with the math, go ahead. Huffman encoding algorithm
for you know, choosing a path in a tree have some similarities
to the Dremel algorithm. So that's it for Google Dremel. It's a short, concise
paper. It's just eight pages long. That's why the main core ideas
would expand so quickly. If you have any doubts or suggestions,
you can let me know in the comments below. I'm trying to create a system design judge
at my startup called Interview Ready. Do check it out
and I'll see you next time. Bye bye.

---

## 22. TAO: Facebook’s Distributed Data Store for the Social Graph
**Channel:** Gaurav Sen | **Views:** 13K | **Date:** 1 year ago | **Duration:** 24:59 | **ID:** Dg07kVN4U28
**Link:** https://youtube.com/watch?v=Dg07kVN4U28

### Transcript:
Hi everyone!. In this video
we are talking about another white paper. It's Facebook's graph store. And the name for this is T.A.O which stands for the associations and Objects. As you can expect, associations means edges
and objects means nodes in a graph. So a node may be connected to another node. And this would be an association. In Facebook's case this is a social graph. So this could be a person. But if he checks into a hotel
that could be an association. So checking into a hotel is an action. And then this would be in hotel. In general these associations map events and objects map repeatable actions. A good example of this is comments. If you add a new comment,
the source will be the same, but the destination
will be a separate comment. So in this way, you're able to map objects into nodes and you're able to map actions
or any kind of relations to edges. Facebook has a very, very large graph,
a very large social graph. It comes in petabytes of data. Another challenge for Facebook is you have 1 billion queries. Per second on the social graph. This is a paper from 2013. So this is all pre pandemic pre
everything. So I'm sure this number
would have been x by now. Right. So we can assume that maybe
10 billion queries per second is possible. But the paper talks about technology which helps them reach 1 billion queries
per second. One interesting fact about
this is about 99.8% of these queries are read queries. If you have seen the white paper video
that we took for memcached that also has similar patterns, read queries on much,
much more frequent than write queries. So some optimizations
can be picked up from here. As you will see,
the association objects does it. Now imagine you are in 2013 and you are working at Facebook
as a principal engineer. A lot of the engineers
are complaining about. I try to store the graph
in my local memory, but I can't do it. I've started looking at databases
which perform well. When it comes to graph queries. One of them is new for J. But the challenge here is that
you need a billion queries per second. Doing this on
disk is going to be quite slow. So one thing that you can do
is try to keep this data, this graph data in-memory. Okay. So instead of new for J you're
looking for an in-memory graph database. It doesn't really exist at the scale
that you are looking at. Petabytes of data. There's nothing that. So you have to build something. Now you can build things from scratch
as a principal engineer. It's probably going to sound cooler,
but if you're looking to drive impact, then you want to use
the existing infra of a company, if you can, to meet all requirements. And at this point in 2013,
Facebook is a master of MySQL. They're very,
very comfortable with this database. And they have also built
an extremely efficient cache. Memcached. Memcached is an open source project,
but Facebook has made significant contributions to it, and they are experts
with this piece of technology. So if you are looking for a graph store
or in-memory graph store, if you could write a wrapper
on top of memcached. If you can use this as a store,
then you might just pull this off. That is the idea that the engineers
at Facebook decided in 2013 we are going to use memcached. We are going to have it backed by MySQL,
but we are going to write wrapper APIs on top of memcached, which will make
the cache behave like a graph store. So let us just note this down. The first thing we want to do
is we want low latency. And the way we are going to solve this
problem is by keeping things in memory. We also want to graph store. The way we are going to do
this is by having API wrappers over memcached. It must be easy to use as a principal engineer. Always look to build technology
which is easy to adopt. Easy to use, easy to understand.
You do not have to know the internal workings of a system
if you have to use it. Unless you do this, people are really not
going to use your system. In fact, this is one of the motivations
for creating the graph store. Facebook engineers would need
to understand how memcached worked. Memcache has its own onces. It works in a particular way. The engineers would need to understand how memcache works
and then file graph queries on top of it. A lot of common optimizations
that all of these engineers made were moved into a single graph store
by the senior engineers at Facebook. That's the major motivation. Most technology, most engineering products are made for ease of use
instead of high efficiency. Okay. Efficiency can be made, but
ease of use really needs design principle. Okay, so this is a core requirement. You are also looking at a high hit rate okay. You want to observe access
patterns in your system and then have your technology mimic or solve for these access patterns. There is no perfect cache. There is only caches which are designed
to solve a particular problem. Let's first pick this up. The API is you have to expose should make this field like a graph. They are creating, reading,
updating or deleting and association. This means when Gaurav sends a friend request to promote Varma, I should be able to use an API
which says and association. Gaurav. That is the source. Pramod. That is the destination. And then the type of the association
is friend request. Okay. This should be a simple API for me. I can also say
get me all the friends of Gaurav. So the source is Gaurav. The type of association here is friends. And if I want all the friends of Gaurav,
then that is fine. I just need to send this. But if I want the top 100 friends,
I've got it. Usually in a web page. When you see your friends list,
you want to see the top hundred most active friends on Facebook
or the people you talk to the most. So over there you can give a limit. You can also mention time ranges, meaning in the last 15 days
get me my top 100 friends. So maybe the most recently added
friends will come over here. That's now -15 days. This is the start time. And now is the end time. You can also paginate the requests. Just imagine you are watching your friend
list the top 100. Then you press on next. So it is going to be a separate API call. You could also get the count of friends
that Gaurav has. So if I want to know
how many friends I have, I don't want to go and fetch
the entire friend list and then count. I just want to keep that count somewhere. Okay, so these metrics
like how many friends do I have or how many places have I visited? They are useful not just for analytics,
but also for displaying to users. In this case, you just need
to send the source and the type. So the number of friends
Gaurav has type will be friends sources. We got that. This can also give you the number
of people who are checked in total. So you have a hotel in Las
Vegas that is now the source, and there
is various people who have checked in. If you find this query of count,
you're going to get the value of three. How is this exactly happening? I mean, how can you have source of Las
Vegas hotel isn't it person to Las Vegas? So Facebook does a clever thing here. It has bidirectional relations. So every person can see how many hotels
they have checked into. At the same time,
the destination has a inverse relation. So instead of checking
is going to be checked in. Apart from this, there are no other APIs
that targets gives. Okay. It's a very minimal API site. In fact, this can only give you paginated
responses. Is it the best approach? You have to remember that there's a
billion queries being made on this graph. Score a billion read queries. If you try to add a lot of functionality
to this production intensive graph store, it's possible
that its performance is going to deteriorate
and eventually people will stop using it. Adoption rates will be low
when adoption rates go down. Engineers spend time
building their own pieces of technology. You don't want to do that. You want to keep things highly performant,
which is limited feature set or basically limited API set. Now let's
see how the graph store at Facebook is actually made scalable and performant
using its architecture. Okay, so first thing is
that the graph store is backed by MySQL. We talked about this earlier. You can't have a single MySQL server
managing the entire graph store. Like we said,
bytes of data is a lot of data. And this is distributed across the world. So you need multiple MySQL nodes
running all types to scale out. And the second thing is
you have multiple core caches running. So it's a distributed store. Again. When a person queries for an object, they are going to. Go to the server. The application server at Facebook. The app server is going to be running
a client, a small piece of software. We spoke about
this in the memcached video. The client is going to make the API call for this object,
and the object is mapped to a shard, a shard. So you have multiple servers
managing different key ranges. Let's say key
one 2000 is what you have in total. So one two, 333 is going to be stored
here. All keys
between 123 33 will either belong here or will result in a cache miss
and will require a database call from 334 to 666. You have the keys here
and from 667 to 1000. You have all keys mapped here, so it is not necessary
that you are going to have 333 keys here. This is the key space. In reality,
maybe your side is not that big. So you can only store 100 keys. So the 100 most popular keys in this range
are going to be stored in each shard. Now you're looking for this object. If you go and query this shard right,
you have the mapping of each object to shard. If you do not find the key
you go and query MySQL. So this would happen in a cache. Miss. Also, if you are writing,
if you are writing a value so you want to add an edge. Gaurav is now friends with Remote Burma. Then you get a write operation
sent to MySQL. This keeps the architecture simple. If things are not found or if things have to be updated,
just go and hit the database. Everything else will work out by itself. You are, after all, using memcached. So memcached has its own ways
to take care of consistency. Now how does this client know
where this object resides? The shard to object mapping. How does the client know about it? You hash the object ID. To get a value. Let's say one two, three. And this value then is searched
in the ranges of the shards. So 123 lies in this range. That is reason
why you are sending it here. If you hash this object, maybe you get
a value of 400 that lies in this range. And when you hash this edge
or do you have an edge? Let's see. You get a value of 900. Okay. Hashing objects is pretty straightforward. You just have to hash the idea
of the object. But hashing edges is a little tricky. Remember that your API say that I can get you all edges from a particular source. So why do you want to keep all the edges
from a particular source? You want to keep all them together. If you want to find
how many friends God has, then you want to keep all of the edges
for God's friends in one place, along with the God of Node also. Okay, this is because of the access
pattern, the APIs that you're exposing. Usually you give a source. You give the type. With that, you can go
and search everything for that source. So ideally you want to keep the hash of the source ID. Used for routing the edge object to a shard. Let us clearly understand this concept. If you have an edge from a source person
one, two, three to a destination, post 345
where the type is like so. Person one two, three has like a post 345. Then which shard does this edge belong to? Well, if you have three shards and they have the ranges zero two, 200, 202, 400 and greater than 400 goes here. Then the source says that this edge
should belong to one, two, three. Okay. Assume that the hash of one, two, three
is also the same. In that case,
the edge will get stored over here. But there is also an inverse edge. There is an edge from post 345. To a destination of person 123 of type like by. This helps you find all the people
who have liked the post. That's the reason
why we have an inverse edge. But how do you store this? The source is going to be
three four, five. That is going to hit some other shard. So for every like you are having multiple shots that are being hit,
basically two shards are being hit. Now this is not a huge problem
in terms of write amplification, but the problem is that you have two shards
which are being hit. It's possible that this shard accepts the right,
but this one doesn't for some reason. Either there is a clock skew
or you know the shard is down. This shard did not accept the right. This would lead to data inconsistency. To avoid this, what Tau does is force
the edge. The initial edge. Anyone else can be taking this
initial edge. Let us say like the blue
one is the first edge to persist to the shard first. So once this operation is complete,
then the application server will say, now persist only after this response to one will you persist. Edge number two okay. So this is being managed by the client. Now the benefit of this is in case
the first shard fails to take this edge. Then you will retry.
And you keep retrying. Only after this response the client tries operation number two,
which is persist to this shard. But what happens if this shard fails? Okay, the first one went through,
but the second one has failed. So you have an edge for person to post,
which is the like edge, but you do not know. If you look at the post,
you can tell all the people have liked it because this person is missing. That would lead to data inconsistency again,
and this can't be avoided. Okay,
you can have a transactional relation. Also here you can make the client run a transaction
where it is going to revert this edge. But that is not only slow,
it's also complex in a distributed system especially. So what memcache client does is just leave
this hanging edge and eventually a cron job. Goes and finds all hanging edges and completes them. Okay. So there will be a retry of this short
three edge. Now there is a neat trick which tile uses. We had mentioned that the number of read
requests on 99.8% of total requests, which means for every thousand requests, you are going to get just two writes and 998 reads. The read operations that I have are very,
very large as compared to writes. I should really have a lot of read
replicas. If you have 1000 replicas in total in your system, then every write operation is going to result in 1000 replica shards
being affected on every write operation. We are going to be
taking all the shards in our system, and we are going to be propagating
this update. Let us say this
edge has been added to this shard. So you have a new edge. This event is going to be propagated
to all shards in Facebook. The reads on those replicas will be slow
because you will have evicted entries and the writes will be extremely slow. The write amplification
is going to be very, very large. So how do you avoid this? What you do is you instead
split it into two parts. This entire architecture, this entire
system is split into two parts. One is you have primary shards. And the second type is replica shards. They serve the same range. So 0 to 200 and 0 to 200. Greater than 200. This is the right shard. And you have another read shot over here. Whenever there is a write operation, you're just going to go
and hit the primary shards, okay? And the primary shards
are going to be propagating these updates using some sort of a message queue. If you have seen the memcached reader, you know
I'm not talking about a message queue. I'm actually talking about a
change data capture solution. In the case of MySQL. We mentioned that this is a build log. Facebook has written a wrapper
on top of this and called it mixed screen. This actually propagates
all of the events to only primary shards. So this shard will not get the event. But this other primary shard
will get the event. Now on every right you do not have 1000
replicas being updated. You do not have a write
amplification of 1000. You instead have a write amplification of,
let's say ten. Okay, because only 2% of the nodes need to be right,
nodes need to be primary nodes. The rest can all be read nodes. And in the case of Facebook they just have
one primary shard for a key. Okay, there are many replica shards for a
key range, but there is only one primary. So this allows you to have read after write. Consistency. And the way this is done is very,
very clever. We already talked about Max
actually propagating updates, but the other thing is whenever a client
actually connects to your system okay, you have a client here, you have a client,
you then never directly connect to a primary shard. This edge that you see
is actually never going to happen. All right, operations are first
sent to the nearest read replica. Okay, so let's take the red line
and let us say that the first write operation goes to a read replica. The read replica
then forwards it to the primary one. Primary has many read replicas, but a read
replica knows where its primary is goes. There. This read replica will always
forward to the primary here. The primary is going to actually
persisted in the database. Take the response
and give it back to the replica shard. So this shard is consistent. Okay, future reads on this shard will have the right reflected. That ensures that you have read
after write consistency. Now there's one thing that we should
discuss in a social media system, it is very common
to see viral events happening. You can scale your shard,
you can scale the entire graph store. But viral events means you need to protect
your shards also from too many requests. Okay. Things like rate limiting, back propagation, short
circuiting is what we are looking at. Facebook
does it in another interesting way. What it says is if you have a lot of heat
on a single shard, it's possible that everybody is suddenly looking
for a post from shadow. Come. Okay, so this is the source ID. Now Shadow can is a very famous person. The post will also become very famous. That post is going to have thousands
of edges. Maybe hundreds of thousands of edges,
which are likes, comments, shards and so on. Okay, so this node is extremely hot if you store all of these edges,
which in total maybe millions, millions of edges in a single shard,
then that shard is going to get super hot. It doesn't matter what you do
in terms of reads and writes, this shard is just abnormally hot for a while. To mitigate this problem slightly. You can read out by source plus type. So all likes on
this post are routed to one shard. All comments on this post
that is a different type of edge are routed to another shard
and all shards on that post. So source ID
plus type or outer two on the shard. It mitigates the problem in some cases,
but it doesn't in many other cases. The number of likes on a single shard
cure may still be very high, and in the worst case, there's
going to be a comment by Amitabha chan congratulating shard of comment something. The post was super hot. Anyway,
now you have a super hot comment also and maybe news
media is now promoting this. So even if you shard by source plus type,
it may not be enough. What do you do here? Just query the DB. Okay. You have a client
which is asking for this post. The shard is too hot. If the shard is failing,
start quitting the database. And you might think, well,
why don't you add more read replicas here. It won't help because if you add more read replicas, you have the same data
that is being stored in these shards. The problem is that you can't
store this post or this single comment. The problem is you can't store thousands
or lakhs of likes in a single shard. Okay, the amount of data is too much. You can't have all of this data
in a single shard. There's no point to try to push it
into a single shard. You have a LRU policy. If you try to host all of this data in this shard,
all you're going to have is thrashing. You're going to get like for Gaurav. Okay, you fetch it from the database, somebody else comes at the same time
from the US and they want to see a like
from their frame. So you go and fetch that from the database instead of having thrashing,
instead of having all of these evictions and very poor performance for the shard,
just query the database directly. You are going to get it from there anyway, that's it for now. This is a very interesting paper to me. It's one of my favorite papers
because I look at the system, which is a graph store,
and it feels like a graph store. It moves like a graph store,
but internally it is memcached. It's using max scale. It's using all of the algorithms that
memcached uses to build a graph, store. So instead of trying to build something
from scratch, Facebook built its own
graph store on existing technology. Thank you for watching this. If you liked the video, then I have a website called Interview
Ready where I teach system design. So I have a full fledged system
design course with over 300 videos. You can check that out.
Until next time, see you. Bye bye.

---

## 23. Scaling Memcache at Facebook
**Channel:** Gaurav Sen | **Views:** 20K | **Date:** 1 year ago | **Duration:** 31:53 | **ID:** uS8f5SSYDck
**Link:** https://youtube.com/watch?v=uS8f5SSYDck

### Transcript:
Welcome to this new series of white Paper
videos. Today we will be talking
about Facebook, memcached. As you can expect,
Facebook is a very large company. Instagram is owned by them,
WhatsApp is owned by them. They have a lot of data
and a lot of it has to be cached. Way back in 2010,
Facebook had a very specific use case for memcached to render their home page or in general, their pages quickly. And why is this a challenge? Because when you are trying
to get a home page, even on Instagram, when you're trying
to get your profile page, there is a lot of stuff
which happens in the background. Just imagine Brad Pitt has a post you want to see the funniest top comment,
the meme, the the joke there. So you come here, then you want to see what are people
replied to that top comment? So you come over here,
you get to see the number of replies. You can load more
if you want a lot of this stuff. Ideally you want to cache. Even if you don't get this all together
in the homepage, you want to keep them ready.
You want to keep them in cache. And so this entire tree
has to be cached per user. So this is a very difficult problem
to solve for many reasons. One is the amount of data is large. But even more importantly
this is no longer a single query. It's a longer key value pair query that
you're doing to get a single home page. You are getting multiple key value pairs. So this becomes a branching kind of operation where you spread out hit
multiple machines. This posts can be a separate service
on Facebook being managed by, let's say, ten engineers. Notifications is a service in Facebook. Messages is a service in Facebook. Each of these services are being hit. Posts
internally may have multiple services. It might be that
you get a recommendation service which just tells you
what should you see on your homepage? You may also have something
which is just activity. The number of likes, the type
of likes, the comments on every post. So you see that
the work of maybe dozens of engineers is being hit every time you are
trying to get your homepage. And all of these engineers
want to use a common cache so that they can get responses quickly. This is the primary
challenge we will be talking about today. It's discussed in detail in a white paper
scaling Memcached at Facebook. That's the. We are going to take the gist
of that paper and describe it today here. I've also taken stuff from different
talks, some by Mark Zuckerberg, some by different Facebook engineers
to explain memcache to indicate. So put yourself in Facebook's shoes. This is 2010. You are the staff engineer at Facebook, or you are one of the staff
engineers at Facebook. You get together, you decide that a lot of
engineers are doing the same thing. They need a common cache. If we could build that, then
our engineering team would move faster. So the first thing you want to do is you want to
create a cache which is used by all engineers or most engineers at Facebook. The second thing you want to do is,
of course take care of this use case. This is the thing which is motivating you
right now, making hundreds. Of concurrent parallel. Key value reads for quick. A single person ask for a homepage. You get hundreds of data points. The third thing that you want to do
is have low latency. There's really no point
of having a cache with high latency. So within ten milliseconds is ideal. And the final thing, which is discussed in almost every system design interview is
where do you line the cap theorem? Okay, let's discuss this for a while
and let's try to break some myths here. Today. There's a cap theorem. Think of you can either
be perfectly consistent or perfectly available
as long as you want. Partition tolerance. So if you are building a distributed
system, a disparate cache at Facebook, then you can choose
consistency or availability. Memcached is neither okay. When it comes to trade offs, in some cases it chooses consistency. In some cases it chooses availability. As an engineer,
this is something that you should know. And I see this happening a lot even
in, team discussions, design meetings, people talk about should it be perfectly
consistent or perfectly available. That's,
I think, the wrong question to ask. Depending on your requirement, depending
on what you want your cache to do, look at whether this use case calls
for consistency or this use case call. So I will be pretty. At a high level though,
when it comes to memcached. Facebook suggests that they will go for
a higher availability system eventually. Consistent. Okay, so very high
availability is what they are looking for. That does not mean perfect availability. They also try to make the system
as consistent as possible. Why is that? Because a cache which gives you stale
replies does not look like
a nice social media system. If on Instagram
your friend has reply to a post and you're scrolling
and you don't see the reply, that could potentially change the way
that you are responding to that post. Remember that this is going to be used
by hundreds of engineers. So you do not want to handicap yourself
by limiting yourself to high availability. Okay, this is a philosophical choice. What can you do to make this system be
used by many, many engineers at Facebook? That is the first question to answer. This is a people problem. It's interesting to think of. It's like a product problem for engineers. You are building an engineering product
for the engineers. In general, if you are looking
to get promoted to staff or senior staff positions, what you want to do
is you want to build systems which have tremendous impact in the organization
or outside the organization. Basically, you know, you make more money
or you save money for the organization. As an engineer, you're looking
most of the times to save money. How do you do this? If every engineer in your org
is going to create their own cash, that is going to cost the org, it's
going to cost Facebook a lot of money in terms of development,
maintenance, testing and just deployments. So what you want to do
is you want to create a caching system which is used by everybody. So you want high adoption rates. How do you do this. This is your primary metric
as an engineer. Everybody should use your system. Well one thing that is suggested
by many people is to do good documentation. Another thing which is suggested is do good error handling. Under the part
which is not really technical, but whatever is soft skills, you know,
you make strong connections. You let people know
you understand what the requirements are. But one thing that you really should
focus on, it comes from the side
that's a big thing is, the ease of use. If you're building a system
and it's easy to use, you can see that onboarding onto
the system is quite easy. Of course, one thing that I should mention
is you have to meet all the requirements or most
of the requirements of the engineers. If you are not going to meet
the requirements, there's no point in them
switching to your new solution of a cache. But we are going to talk about
ease of use here. And one way that you can do
this is whenever a person is connecting to your system, they are going to be connecting
using APIs. For making that request. You have to create objects.
You have to hit the API. You have to read the documentation. Can we make it easier if you instead
give them some sort of code? Let's say
the engineers are writing in Python. You give them a client library which they can import into their system,
let's say hash include. Or in Java
you would have an import statement on top. You would give them this library. The code would be able to compile
the library. The library would have an Http client. It would construct objects for them
as long as they pass in the parameters. It would be like a function call. It would just send the parameters,
not create a request object. And when the response comes from your API,
the object will be constructed. You have already taken
care of three steps for them. Now who's writing these libraries? Who's writing the library?
Who's writing the Python library? The engineers in memcached. They are taking the effort. Apart from this,
if you give them a client library, the API contract gets updated
automatically. They just need to update the client
library version and things work smoothly. This increases adoption rate. Makes life easy because engineers like everybody else are lazy. So this was an interesting point
of this book. Apart from this, also there's a few things
that the client library does. Like I mentioned that is compression. So if you're trying
to compress a bunch of values or if you're trying
to send requests in batch. This will be taken
care of by the client library. This is especially useful sending request
in batch because you are making a homepage request or a profile request,
you need to get multiple keys. We talked about the homepage
having the number of messages, the number of notifications,
the number of posts, the number of likes in those posts,
all of that stuff. All of those data points have to be hit with a client library. You can batch those requests. You can put those requests together,
make a single request to memcached with all of those keys. And when you get a response,
you get all the responses together. So the number of requests you are sending
is reduced, bandwidth is saved, compute is saved, and it just makes
your process more efficient. So your services are happy with all the
intelligence that you have on the client. And like I said, the adoption
therefore goes up. Now let's see how these API calls
are actually made by the client. So if you're doing a Get request
a cache doesn't get set first on this get when it comes to your web server, let's say you are trying to fetch
the number of friends that got a pass. Okay, so it comes here. Then you call the cache,
you say, get me all the friends of God. So that is a Get request. It's going to give you nothing
because the cache is initially empty. You're then going to go as a web server
when you get nothing back. When you get a null response,
you go to the database. In this case it is MySQL
because we are talking about Facebook. MySQL then gives you a response number
of friends God of has this, let us say 20. And this response is then populated into the cache. So you're going to say set
the number of friends God as equal to 20. If you are expecting the value
to be in cache, then it is your responsibility
to actually populate the cache. This is called a leukocyte cache. Meaning that the cache is separate
from the database, and the person who's managing the cache
is actually the web server. As an engineer,
you don't want to manage this yourself. You do not want to ask
for the number of friends. And then if you get a response,
then you do something. If you don't get a response,
you do something else. So instead, to make things easy,
this is managed by the client that we were talking about. When you call the client with a Get request, it's
going to do this in the background and eventually
just give you a response, okay. The other operation you can do
is set here. You are putting a value in cache. You're setting a value in cache. So someone just got added to God's friend
list. You want to update the number of friends
he has okay. You come to the web server,
you say, look, let's update the value first in DB, okay? So the green line shows what's happening when it comes to a right operation. And number one is update. Once the database is updated
and you get a response success. You will now go and delete
that entry for that key in the cache. So instead of updating the cache,
you are actually deleting entries when they are being updated
in the database. Why is this good? Because this is an important operation. So in case this API call fails, you
try to delete the value again and again. It doesn't really matter because you are just going to delete
one key from cache, which can always be propagated
from database. If you didn't do that, if you said that
instead said God of strange values to 21, then if the API call failed,
you would have to manage the retries. And if you have to manage retries,
there may be concurrent updates happening. So you don't take that headache. It's a very simple architecture,
a leukocyte cache, which is important. Facebook mentioned it in the tech
talk actually, which is using UDP. To make get requests. But using TCP to make set requests. If you use TCP. The benefit is for every request
that you make you get an acknowledgment. So you send the request. Number one you get an acknowledgment. You wait for it,
and then you send request number two, you wait for the acknowledgment.
Send request number three. The benefit of
this is the requests are serialized. If you're making set requests,
set the value of key 1 to 1. Then set the value of key 1 to 2. You will see the final output as two because the set requests are going in
order, you are waiting for the response to come back
before you make a new request. But if you use UDP,
you're really not waiting for a response. You say set the value of key 1
to 1 before the response can come back. Before you're sure that the request is actually reached them
or it has been processed. You say set the value of queue 1 to 2
so the final state can be anything. It is possible that the server gets this request first
because of some network issues. Maybe the first request failed or it gets this request,
but it takes time to process it. For some reason
it's pushed back in the queue. Whatever be the case, it is possible
that this request is processed before this one. So the initial value is set to two
and then key is set when this is processed to one. So the final state
is going to be given equal to one. And you're going to lose this right. In the case of Facebook that won't happen
because you are now making set requests using TCP. What about get requests. You're using UDP. So if you say get me the value of k one at timestamp 1T1 and get me the value of k one at timestamp
t two, but t two is greater than t one. What guarantee
can you give in terms of responses? Nothing. You have no guarantee that the value
that you will get at timestamp t two will be a later value than t one. It's possible at this request, get some
more fresh value of t one than this one. Okay. Because of the same idea
of processing out of order, what do they do
if they get an anomaly like this? If they get responses out of order,
they just drop the packets. If the packets are out of order,
then Facebook, the client treated like an error. Okay, so 20% of all errors in memcached
is actually just out of order packet processing.
In the case of Facebook, this is a worthwhile
trade off because they save 20%. In request latency. For Get requests. Now what's powering this 20% reduction
in latency? Mark Zuckerberg mentions that you don't
need to create connections in UDP, so that saves on memory. You can basically have more keys in the
same cache server as compared to earlier. So the hit rate is higher in the cache. The second thing is you don't have a limit to the number of keys
you can fetch in a cache. If you look at file descriptors,
then that's something like 65,000 per server. Facebook had updated this. The number of connections that a cache
could host was more than a million. So they went in the Unix kernel
and made those changes. But eventually they said that, you know,
we don't really need get requests
to go through TCP. Let's just use UDP. And the final benefit here is that
you do not have head of line blocking. If you know about Http 3.2, it uses Quic,
which is basically UDP as a protocol. The reason why Http has also moved to UDP is because you don't want
a single request to go to the cache
and then make everybody else wait. Let's say
you have 100 requests in the line. The first request is taking time. When it takes time, the rest of
the hundred requests also wait in line. If they can all go in parallel,
like in UDP, then you don't have any line blocking. So this problem of head of line blocking, you can imagine yourself
to be in an airport and the person at the start is taking
a long time to finish their counter query. And you are here with your luggage,
your flight might get missed. That's not going to happen. There's
going to be no head of line blocking. You will have all requests
going in parallel. So the savings are worth it. And the one thing you want to take away from this
paper is the way that Facebook has scale. Memcached. The title of the paper is also scaling
Memcached at Facebook. And after seeing this,
you will really feel like, wow, you know the engineers there. The the nuance, the approach,
the way that they looked at how users are using
this system is outstanding. So pay attention please. Facebook said
I need to scale my cache servers. I can only vertically scale to a point. I can't manage Facebook
with a single node. So I will have to horizontally scale
eventually. How do you want to scale out? Do you want to shard your nodes? You want to shard keys into different nodes. If you do this, then for a key range of let's say one 2003 nodes,
you're going to have key range 12333. So if you key 334 to 666 Tokyo and key 667 to key thousand served here. And as you add more nodes,
you're going to be taking the keys from some of these nodes
and populating the other cache. Okay. That's
how you're going to distribute your load. The benefit of this is
if a client has to fetch any kind of data, it knows exactly where
that point data exists. The second thing is you can have
more unique keys in your cache server. Just imagine that you have key values
from key 1 to 1000. It's not that all
333 keys can be kept in a single cache. So you're probably going to have 100
commonly used keys in this range being stored here. Okay. So each server can store 100 keys. It's serving a range of
333, but the top hundred are kept in cash. Similarly here you have 100 keys. And here you have 100 keys. So out of a total of 1000 total keys, you can serve 300. So your caching system, all of the keys are unique. So we should go for sharding right. Remember the access pattern the way in which your data is being used by users. What are people asking for? They're asking for hundreds of keys
together. They're asking for the homepage. When the client makes a query. They're not getting one key. They're getting hundreds of keys together. Okay. Understand this problem correctly. If you have a page that you're trying to
load that has a lot of data points, if you shard out,
all you're doing is you're spreading those data points all over the place
and you have to get them anyway. So instead of just querying one node,
you're now going to query ten nodes, because the number of requests
here are not reducing. They are increasing in fact. So the number of requests to all of
these nodes is also going to increase. The single problem
has now become a multi problem because of sharding. So Facebook didn't go for this. Facebook instead
went for the idea of replication. When you need to scale to ten x requirement,
you add nine more servers. Each of those requests can be spread out
to ten different servers, which can answer your queries directly. So Gaurav goes to fetch his homepage. He hits this node, gets a response
in ten milliseconds. When you go to get a home page,
you hit some other node. Get the response in ten milliseconds. If he had shouted out,
I would have hit all ten nodes and you would have hit
all ten nodes, right? So we scaled out in a way
which is according to the access pattern that we have. Our requirement was to get pages
aggregate information. Replication
makes more sense then than sharding. Now think about the time when
you have a massive number of requests. Let's say a celebrity has posted something
which has gone viral. Everyone is saying,
did you know what they said on Instagram? And everyone is trying
to fetch their profile page, or they're trying to fetch
that particular video. It's also possible
that a particular topic has picked up maybe space has sent a new rocket
and everyone is talking about rocket. Suddenly. This heightened activity
means more load on your services, which in turn means
more load on your caches. So how does memcache continue
serving requests despite high load? So you can scale up the caches of course. And that is what happens. But at the same time, you have to protect your caches
from being bombarded by requests. So you need some
sort of rate limiting queue. And the way memcache does this is sliding windows. So each client,
which is running on the web server, gives a sliding window of the number
of requests which are coming in. So these are cache requests. And you can think of this as a queue. So queue has the requests moving. Till the picked up by the client. And so you have all these requests
coming in here. To the server being sent to the client. And the client eventually is going to start
making these requests to the cache nodes. At any point in time you are going to have
a fixed sliding window size. So if a lot of requests flow in here,
you're going to start dropping them. Okay. So let's say the size of this queues 100. The 101 request which has not been
processed yet is going to be dropped. That's something you can do in some cases,
especially when it comes to caches. There's the idea that you can drop
the first request or one of the requests in the head,
because those are old anyway. Okay. So it depends on the policy. In this case, Facebook seems to have a sliding window,
which means you can drop them from here. You have to drop them from the back. Now Facebook's experience here is
if they have a large sliding window, then there's
a lot of congestion in the sense a lot of requests
have to wait for a long time. The request over here has to wait
for a lot of requests to complete first, which is not ideal. Like I said, if the request is very old, the client is going to retry anyway,
so why bother? In this case,
I'm not talking about this client. I'm talking about your mobile client,
which is actually making a request to the web server
so you can drop requests. Do not keep a large
sliding window is what Facebook is saying. Also, don't keep a small sliding window
because you keep a very small sliding window.
Then the clients keep retrying. Basically, the request comes from
a mobile device or a desktop. It reaches your server. If you have a large queue, then this person is happy for a while. Eventually this becomes old
and then the person makes a retry, which is sad. But if you have a very small window,
let us say just ten requests. Then on your initial request itself,
you're probably going to drop it. You're going to say, no,
I don't have enough space in my queue, which means this client is going to do
what? They're going to retry. They're not going to stop
watching Instagram. They're going to continue trying. So it's a fine balance. You have to have something
which is of suitable size. Not too large not too small. When it comes to caching, the final thing we look into for memcached
is fault tolerance in case a cache server is being overloaded
despite all of the replication that we have. What can we do? Facebook saw that most of the times
that this happens is when a new server is being pulled into the system,
or a server has been lost. Okay,
so there is a lot of heat on that cache. There's a lot of new keys
which are moving in. The way to avoid this
problem is by using an extra cash. So this is. And this is like a spare instance
in case your memcache server doesn't work. In case you get a fail here, then
you just go and query this bad instance. In the case of Facebook,
they call it a gutter. Okay. You can think if there's an
overflow of water it goes into the gutter. If there's an overflow of requests,
then you can just hit this bad instances. These are around 1% of all nodes on memcached, and they manage 99% of all failures. Failures are rare. So whatever failures are there, most of
them are managed by the gutter instances. The basic idea is these also connect
to MySQL instances, just like this memcached instance. But they are reserved. They are only used
in case you have a failure. So the kind of data that they have,
the data locality is horrible. Right. Any person who has a data failure is going
to go and hit the gutter instance, but it is a fault tolerance mechanism
and it's quite good. I mean, definitely works for 1% the cost. You get 99% for the failure savings. Finally, how is MySQL this single database able to serve the entire world for Facebook? A single database server can't do this. We scaled out memcached. These instances. This layer of DB
also has to be scaled out. Let's say
the Indians have one MySQL server and the Americans have another one,
and the Europeans have another one. How will you keep them in sync? One approach is not to keep them in sync. You have all the data
that is being updated here, not being sent here. If that happens,
then the Indians and the Americans are going to see different data. So if you have relatives in the US
and you want to talk to them on Instagram, you know, messages. That's not a very good experience. So you want to keep them in sync. Like we said, high
consistency is what we want. Very high availability is what we want. Facebook could have used two approaches. One is whenever
you're making an update to MySQL, you could have gone and try to make
these updates to the other SQL nodes. Also. This would require a fan out on the client
side, which is a bit extreme. Instead, they went for slightly eventual consistent system where you have
the Indian server take the right and then it propagates the right operation
to these two nodes. Okay. How does it do that? Well, if you have heard of something
called change log okay,
you might have heard of transaction log. Maybe this is a more popular term. In a transaction log you have all
the operations of a transaction persisted. You have all the commands there. So if you have a create
command in a transaction that's written with the details,
you have a select command, you have update, you have delete. All of this
stuff is written down in a log. If you take this log from the Indian
server, copy it here to the U.S. server
and execute these commands in sequence. You can guarantee that
the copy of the US server will be in sync with the Indian server. That's a very interesting property. Select is just a read operation,
so just ignore it. All of these data
update commands are put into a change log. And this change log is sent to different parts of the world
where you have your MySQL servers and they replicate these changes
internally. Even the Indian server of course gets the replication
from different parts of the world. In MySQL this is called bean log. The change log is called binary log
and you have all these commands. Then Facebook.
What it does is really clever. It takes this log file
and then, you know sneaks in its own updates like cache update. So it adds commands to the log file
and sends them around in between. It keeps the server okay. This is called make squeal. Make squeal is a piece of technology
which appends the logs and also propagates them
to different parts of the world. Okay,
so all of your changes are propagated. One optimization here. The last optimization when it comes
to scaling that we will discuss with scaling Memcached on Facebook is what do you think is more common? Read operations or write operations? When it comes to memcached, read operations are 1000 times more than write operations. Can you use this to optimize your system? These writes are really rare, so you don't need to have all of these databases
serving right operations. You can have one write node for 1000 read nodes, roughly speaking. So in the entire cluster of Facebook
you are going to have just a few right nodes, maybe one in India, one in the US,
one in Europe. But you are going to
have many, many read nodes. The benefit of this is whenever you're making a write operation,
it doesn't fan out. It doesn't have to go and write
to hundreds of database servers, a single database server. That's it. Okay. It goes here. And this database
server pushes an event to Max Queen. Max SQL then manages
the eventual propagation of that update across
all read and write nodes across systems. In this way,
you're able to scale your writes. If you didn't do this,
it would result in a thundering herd. All right, operations
would come and update all the databases, all the caches would need to be updated
quickly. No. That's okay. You know, few write nodes,
lots of read nodes. Eventually everything will get updated
because of Max Queen. So this is scaling memcache
shard Facebook. It's one of my favorite papers. And if you have any doubts or comments on this,
please let me know in the comments below. If you want to know more about system
design. I have a small startup
which is trying to build a system design judge at Interview Ready.
You can check it out. If you liked the video,
please hit the like button. I'll see you next time. Bye bye.

---

## 24. 5 questions in 4 minutes: Gaurav Sen interviews Hemant Pandey
**Channel:** Gaurav Sen | **Views:** 5K | **Date:** 1 year ago | **Duration:** 4:10 | **ID:** RxprFQberss
**Link:** https://youtube.com/watch?v=RxprFQberss

### Transcript:
what does an engineer really do at work I spend around 25 to 30% of my time writing code the rest all goes in design meetings architecture reviews sitting with PMS figuring out what needs to be done mentoring other folks so it's a nice combination of a lot of other things so where did you learn this H I joined meta uh I was very fortunate and lucky that uh I got a senior offer while I was pretty young I just had like three .5 years of experience I was definitely know not prepared for the scope I was taking into that but I had some mentors which really helped me uh realize what the culture of the company is and and how we can make estimates better how we can delegate better how do you motivate yourself and everyone around you to do something because very often I hear I find the work boring it's like never something you'll be able to you know fully satisfy all because everyone is looking for growth and they want to work on ambitious projects you try to find a balance I've seen a lot of people they have good career growth just because they did the work nobody else wanted to do it it creates a great impact story when someone is presenting that this guy or girl they handled the Privacy work streams all the security measures while some other like they might be building cool features but so is everyone doing that right are you thinking of more managerial roles in future future or are you thinking of more individual contributor roles one thing I like about being in ic is the flexibility right on an average two three hours of meeting per day other than these two three hours I can do whenever I want my work like if I want to do it in the night I can do that maybe right but I think for management it's a more rigid schedule as an IC you are dependent on your team's growth as a senior but it doesn't really have a significant impact on your career but as a manager you are what your team is I do want to experiment try see whether it's for me or not and then make the decision in very large organizations where there are thousands of Engineers how do you stand out what are the steps that a person should keep in mind have a kind of ownership mindset you're writing the code it's going to solve a problem it's your duty to test it thoroughly if it fails it's my responsibility second which is marketing your work keep a brag document weekly item list of what you did could be very small to small stuff in a three months you you'll realize that you have done a lot do you think chat GPT is affecting the job market do you think large language models or code generators are affecting the job market and uh if so then have you seen it at work now every company has their own uh versions of chat GPT internal gen models as well in which you can you know find code pointers pretty easily they'll also write a code for you like convert this Java code to python or you know PHP it's it's very helpful for me at least I think as it gets more normalized like everyone starts using chat GPD the beginner level tasks right for example you're given a problem and you need to code the solution these kind of things these kind of jobs or skills can be easily replaced by chat GPD so I think if you still upskill yourself it's still very valuable uh being a software engineer there there's a lot of stuff which goes in software engineering which currently chat gbt is not able to handle it there's a lot of human factor there's a lot of collaboration there's a lot of understanding the problems there's a lot of uh like things which you know like how the product would be perceived by the audience uh I don't think Chad GP currently has the intelligence for that so on that very positive note thank you hon for coming here and sharing your thoughts your experiences with us I hope to see your LinkedIn post keep coming wherever you go whether you're IC or em it's going to be very helpful for all of us yeah thank you go see you bye

---

## 25. Algorithm Deep Dive: Realtime Audio Matching In Shazam
**Channel:** Gaurav Sen | **Views:** 11K | **Date:** 1 year ago | **Duration:** 10:23 | **ID:** c1fJ0kKRNe4
**Link:** https://youtube.com/watch?v=c1fJ0kKRNe4

### Transcript:
In this video, we'll be talking about how Shazam is designed. Shazam is an app where users take some music and then send it to the Shazam server asking for what is the original song. When you're in a bar or in a restaurant, you want to know what song is playing. And that's the main use case of this app. Now, the important thing here isn't really the architecture that is behind this. The important thing is the algorithm. What you have initially in the request is a 10-second clipping of a song. And in your database, you need to choose a way in which to store original songs such that you can actually be able to match it with the incoming request and then give a appropriate response. Let's understand how we going to be storing these songs. The first thing we'll do is we'll try to define the song in mathematical terms. So a song is after all a soundwave and a sound wave can be represented using a graph for time versus frequency. The problem is for an app like Shazam, these clippings are taken in noisy environments or they're taken in environments where there is something else spoken like if there's a person next to you, they'll be speaking. So this frequency graph, the original one will be changed in the clipping maybe by something like this. There's a there's a loud sound of a glass breaking or something. So just one parameter is not good enough to define the song for us. We need something more robust. So instead we take multiple parameters. We are going to draw a graph of time versus frequency. We are going to draw a graph of time versus amplitude. We're going to draw a graph of time versus phase and so on. Taking multiple features makes the system more robust. The more features you take, the more storage you'll require. Just imagine when you're taking a lot of space, what you mean is when there's a comparison operation going to come in, you have a lot of space to compare it with. So usually if you are able to concisely represent your song, if you're able to describe your song in a short nice format, it usually means your search operations get faster, your storage requirements reduce. So that's our aim. We going to try to concisely represent this song, not as an entire wave, not as a, you know, two waves, but as a set of points. So if you have to choose some interesting points in this song, which ones will they be? What you're looking for are large variations in this song. like when there is a when the bell is played. So then there's a boom maybe over here in the song. So you want to actually note this point down because this is a special point. Around this there are really low points and at this point there's a really high point. Similarly maybe there is pin drop silence at this part of the song. Around these there's high points but over here there's a really low point. So you want to note this down too. You want to note down basically interesting points because despite noise, they are the ones which are likely to survive when you're recording the clipping in your mobile phone. So how do we go ahead and identify these points? You have the time you have the frequency being plotted in this graph and the color variations you're seeing are that of amplitude. So at this time with this frequency because it is blue it means that the amplitude with this time and frequency was high. This is because it's a 2D graph. I can't show 3D with the with the things coming out of the board, you know. But in a 3D way, you can actually see the amplitude in the Z axis, high, low, and so on. But with different colors, you can represent the third dimension also, which is amplitude. And you have X and Y for time and frequency respectively. The interesting points as we mentioned are points where there is high variation in the amplitude. So if there is blue to red, that's a high variation. If there is red to green, well that is variation and then green to red is also variation. But again red to blue that is high variation. So I'll note down all the points. So these are like transition points where the the music picks up or slows down. Both of them are easily able to define your song and each of them can be plotted now in this 2D plane where I just need to know the frequency at this point let's say f_sub_1 and the time let's say t1. These four points can uniquely identify your song. Let's try and get an idea by assuming that we got a search query for a audio clip. And if you have a clipping, it might be something like this. It just takes two of these unique points in the audio clip. Also, what I'll do is I'll draw the graph very similar to this. I will take the interesting points in that clip and I'll note those points down. So, let's say fx, tx, and f_sub_y, ty. Let's assume these are points x and y. Let's assume that we have these points for every song defined in our database as the frequency, amplitude, and time of that given point. So for point X, you have F_sub_1, A1, and T1. Now look at the amplitudes. Are these really necessary? Because what they're telling you is that there's a transition from a high frequency to low frequency. So A1 is blue to red and A3 is green to red. If you get a query for this song, then that clipping will have the interesting points defined by X and Y, but you don't really care about the change in amplitude at that point. So if it's green to red, red to blue, doesn't really matter. We are mainly concerned about whether the magnitude of the amplitude change is high enough for it to be marked. Hence, we can get rid of the amplitude values because if the point has been marked, it means that there is a significant change in amplitude. Now, X and Y are defined by the frequency and time. But the most important thing is that the time component is not fixed. When you get a clipping, you're not sure what is the offset of this given clipping. So it might be 10 seconds off. That means the difference between t1 and tx is going to be 10 seconds and the difference between t3 and y is going to be 10 seconds. Again, however, the frequencies of f_sub_x and f_y in the clipping are going to be the same as f_sub_1 and f_sub3 in the song. So to define any two points in terms of each other, we need the frequencies of those points along with the difference in time that they have. So that is f ofx, f of y and delta t for any two points x and y. So the uniquely identifying characteristics are right here for these two points and that is f_sub_1 comma f_sub_3 comma delta time. The chance of you having frequency f_sub_1 and f_sub_3 in two interesting points which means there is high amplitude change with the same time delta is very very unlikely. If you find the same frequencies f_sub_1 and f3 with the same time delta in a clipping this is the song you're looking for. So we'll take all the interesting points in the incoming clip and make pairs out of them. And of course we have to do the same thing in the database also. We have to take for every song all the pairs that you can make using the interesting points. So if you have n points you're going to have n into n minus one by two pairs which is something like n square pairs in this song which are each going to have their own first frequency second frequency and the delta of the time between those two given points. Now let's try to think about how we are going to be optimizing this. Try and use the principles of image processing or video processing to come up with something better. Well, if you take a clipping, it's going to be 10 seconds. And if you take a song, it's going to be something like 3 minutes. So, why not break this song into chunks of 10 seconds each? Let's say these are the chunks I have. If your query chunk matches any one of these chunks, you're good to go. But there's a problem. Your query chunk could be any point. It doesn't need to be neatly broken into the chunks that we have. You can see that your query might be from here to here. How do we handle a query which falls between two chunks? To compare a couple of points at the same time from the clip and from the original song, what we are going to do is we are going to take this original song and break it into chunks. So if there are four points, then I'm breaking them into chunks of three. The blue chunk and the green chunk. Amongst these three points, I can take any two points at a given time and compare it with X and Y which is from the clip. So if I have eight interesting points in the original song and I'm making chunks of three, then I'll have six chunks. Because you have three points, you can make only three pairs out of this. And since you have six chunks, you'll be able to make 18 pairs in total. In general, if you take chunks of P points in an original endpoint song, you'll see that as n gets larger, let's say n is equal to 100 and p is equal to 5, you see significant gains in terms of the total number of pairs that you need to create. And therefore, the number of comparison operations will also reduce because you have lesser pairs to compare it with. And this is all we need once the original song has been broken into chunks and stored in the database. All we need to do is we need to take our clip, find the interesting points, find the chunk having the maximum number of matches with our clip and this chunk is the answer that we need. The song which actually contains this chunk is the original song that we are looking for. So you have a clear advantage using this kind of algorithm because it's not just more accurate. It doesn't do wasteful processing while storing or while searching. Instead, it can take the points in a chunk and convert it into a single hash. This is also called a combinatorial hash. Each hash is like a key in a dictionary. So when you're searching for a chunk, you just search for that particular key in the dictionary. And the song having the most number of matches with keys for its chunks is the song that you are looking for. Since the order complexity of searching in a map is order one, we can expect the search operation to be quite fast. Let's recap our algorithm. What we have is the client taking a clipping of the song, finding the interesting points, converting them into chunks and sending it to the server as a set of hashes. The server then takes these hashes and then searches in its database for that song having the maximum number of matches with these hashes which is returned as a response. But the important bit is that all of this pre-processing for finding out the interesting points, taking chunks, finding their hashes and storing it in the database is done beforehand. If you have any doubts on this, do let me know in the comments below. So until next time then, see you.

---

## 26. Software Systems: What is a load balancer?
**Channel:** Gaurav Sen | **Views:** 18K | **Date:** 1 year ago | **Duration:** 7:37 | **ID:** NwR9Lq8qn8c
**Link:** https://youtube.com/watch?v=NwR9Lq8qn8c

### Transcript:
in this video we learn about load balancing at a high level if you're a software engineer and you want to know what is load balancing how is it going to help me well if you have multiple computers and you want to make sure that the load is distributed evenly so that none of the computers is overheated then this is what you want to do let's say you're a backend engineer who writes some code and this code is exposed using apis uh the apis are hit by multiple people around the globe initially your service is small the number of customers you have is less so a single computer maybe even the laptop you work on is sufficient as a server so you expose apis or HTTP any person with an internet address can come and connect with your computer and they're able to use the code that you have written for their purposes so at this point you have a server which is the computer you have and the clients are people who are connecting to your computer hitting the API and getting a response eventually as the number of customers increase there is going to be a lot of load on this system it may not be able to manage the number of connections it needs to it may not have enough memory it may not have enough IO whatever be the case at some point you'll need to scale up as your customers increase a simple way to do this is to buy a better computer let's say you shut down your current computer and you take a bigger computer copy the code there turn it on and now you have the same apis being exposed over the internet to a larger set of users who are happy because this computer has more compute power more memory things are working fine and hopefully this cycle is going to repeat you'll have more and more customers come to you they'll pay you more money but the problem is you need more compute capacity you need more strength in your system uh so you buy a bigger computer but eventually you will run out of the ability to buy a larger computer you can go all the way up to a super computer but for very large applications I'm talking about let's say Google meta and even you know medium-sized companies which are payment gateways a single supercomputer won't work apart from buying a larger computer which is vertical scaling the other approach you have to scale is horizontal scaling which is buying more computers and now the challenge is because you have more than one computer uh you have to Route the incoming request to one of these computers so what strategy should you apply it makes sense to distribute this incoming load to the existing computers evenly why because if you have a computer which fails then the blast radius is low the worst case computer crash is not very bad okay you lose at most half the load the second thing is if you have a lot of requests going to a single computer that computer is considered hot because there's a lot of requests which get queued up that Q wait time increases while in the rest of the computers it's it's green there's nothing happening there so a lot of users are wastefully waiting on previous requests to be completed while the other computers are sitting idle despite chugging that much electricity and this task of load balancing is handled by a specialized component called a load balancer what this does is for every incoming request it decides on which computer should this request be routed to it doesn't necessarily need to be between you and the clients between the servers and the clients it could be maybe telling the clients separately it could be telling the servers separately because the servers need to talk to each other also and there is load balancing there but at a high level there is a routing brain which decides the final destination of a request now there are some load balancing algorithms which are very common I'll go through the simple ones uh there are also other complex load balancing algorithms we'll meet them across the course the first load balancing algorithm that we talk about is a very simple one it's called round robin and all you have to do here is that you have a set of computers uh you go over them one by one for every incoming re so the first incoming request is sent to computer number one the second one is sent to computer number two the third one is sent to computer number three if you have just two then you know you'll take a modu or two and again come back to computer number one so in this way there is a iteration through the entire list and then you come back to the start and you keep doing this this helps you roughly evenly balance load a clear benefit of this is that it's simple another clear benefit is that you don't need to maintain any state as the load balance doesn't need to think about oh how much load is there on computer number one it just goes through all the computers according to a single current pointer that it has the second approach you can apply is a geob based approach all users from India are sent to the Indian server all users from the US are sent to the US server all users from Europe are sent to the Europe server and so on based on regions based on which computer is near you you are routed to that the benefit of this is that usually the response times are low uh there's also the clear benefit that you don't need to think about how much load a computer has you just look at what's nearby okay the response time of that was the least let's send the request over there one of the drawbacks could be that despite the US server having very little load and the Indian server having tremendous load you're going to take the rest of the Indian users and send them again to the Indian server so this doesn't do even distribution in case you have skewed load and the final algorithm we'll talk about is least connections least connections is interesting because here you have some state that is maintained by the load balancer okay so you actually note down the number of connections that each server has so that would be let's say 30 Connections in the first server 40 Connections in the next server when you have an incoming request you look at the server which has the least number of connections and Route the request there so from 30 that moves to 31 now you may have a drop in the number of Connections in the second computer it's possible that people left the service they logged off if you have a further drop eventually service a is going to be more heavily loaded than service B in terms of the number of connections and the least connection algorithm is going to send the next incoming request to the server having just 25 connections okay which is the second server now in the real world you usually have a hybrid approach and you may have multiple load balancers at a high level if you're looking for Google you go to the Indian servers over there you say hey I want to go to Google Calendar so then you find the least connection Google Calendar server and in Google Calendar you may have Services themselves like maybe a profile service it might be part of Google Calendar over there you might have a round robin so at a high level you have a large tree and each of the nodes of the tree have their own algorithm running that is very much possible in fact sometimes you have a vendor like AWS who's managing load balancing at a at a DNS level or at the application Gateway level and you have your own load balancer before the database before the cache and so on load balancing is a fundamental concept of computer science it comes up very very often in distributed systems uh and it comes up at every layer of the distributed system Whenever there is a set of resources whenever there's horizontal scaling there is the concept of routing which comes up and the concept of optimally using the resources that you have load balancing is a common technique if you have any suggestions or doubts on this topic please let me know in the comments and if you like the video please hit the like button I'll see you next time

---

## 27. Interview Question: Tell me about yourself
**Channel:** Gaurav Sen | **Views:** 8K | **Date:** 1 year ago | **Duration:** 2:09 | **ID:** erIWQL4zMZY
**Link:** https://youtube.com/watch?v=erIWQL4zMZY

### Transcript:
She's the CEO of Edelweiss MF, and she's not alone. Iif you asked this question in an interview, 
here's how you should answer it. Firstly,   think about some exceptional event in your 
life (preferably recently). Think about how   that helps you put forward your case to be hired 
in this company. Remember, you are here in the job   interview. You're here to showcase your skills 
or your competencies. If you can do that with   a story, then your chance of getting hired 
increases. If you give an exceptional story   that has no relevance to the job, let's say 
I talk about getting a first prize in chess,   but the job is a different kind of sales role, 
how is this related to the job? Not at all.   So you will have a great conversation for the 
next 45 minutes, but you will not get the job.   Because somebody else who is talking about the 
job, showcasing their skills in the interview,   is going to get hired. Now, from an interviewer's 
perspective, if you really are looking for the   best questions to ask, I'll tell you that this 
is a very poor question! This is one of the worst   questions you can ask. Because it is completely 
unstructured. The problem with unstructured   questions is you have no idea whether the answer 
is right or wrong. You're throwing darts at a   board blindfolded. Because even if the candidate 
answers it nicely, you don't know what nice is.   If they answer it badly you don't know what bad 
is. It doesn't have job relevance. And therefore   it has no meaning in a job interview. You can 
replace this with a better question. Something   which will help you make a decision for the 
next two years. Tou can look at a heuristic,   which is something which tells you roughly 
whether this candidate is a better hire or   not. Or you can use a substitute where you give 
them a scenario and see whether they are able   to answer the question correctly as for your 
requirements. The benefit of that is: (a) It's   going to be structured (b) It's going to be job 
relevant and (c) You'll have shorter answers, so   you'll be able to put in other relevant questions 
in the same interview. All the best, do well!

---

## 28. Caching in distributed systems: A friendly introduction
**Channel:** Gaurav Sen | **Views:** 77K | **Date:** 1 year ago | **Duration:** 11:25 | **ID:** zw7VwIlkPPc
**Link:** https://youtube.com/watch?v=zw7VwIlkPPc

### Transcript:
in this chapter we learn about caching caching is a fundamental concept of computer science in fact any system that you pick up any large scale distributed system has some form of caching in multiple places and often in critical sections so in this chapter we will dive into what caching is what are the benefits what are the potential drawbacks and how we can mitigate those drawbacks using tradeoffs let's take an example you have a user on Instagram who is asking for their feed their news feed so the message reaches the server that please get me my newsfeed the server queries the database says that for this user select star where user equal to so and so get me all the people that they're following and get me the posts of those people the response comes back and is forwarded to the client the overall time required for this is user to server which in our case is 100 milliseconds server to database which is 10 milliseconds database back to server this is the response taking 10 milliseconds and the server finally sending back the response to the client which is again 100 milliseconds so the total time here will be 220 Mills if you had to optimize this system what would you do there would be two parts that you can look at the first is client to server communication and the second is server to database communication when it comes to caching on the back end we usually focus on the second part which is server to database in our case you can see that it doesn't have as big impact as client to server so that is also important we'll look at that maybe in some other chapter here we are focusing on the backend engineering side so there may be many many services connecting to the database if you can introduce some optimization here you will cut down this 10 milliseconds to maybe 1 millisecond now one optimization here is that similar users ask for similar feeds so for example a young software engineer who likes football and is in India will get a news feed a very similar news feed can be given to another young software engineer who likes football in India so you can group users into a single cohort and give them similar news feeds now when one user from this cohort asks for a news feed you generate it from the database the first time store it in local memory and give the response the next time when a similar user comes instead of querying the database you just query your local memory right because you have this information stored instead of recomputing it instead of recalling the database you take your already stored result and give it back as a response and so the whole idea behind caching is reducing repeatable work through storage instead of doing the same competition again and again you store it in local memory give it back as a response and usually caches are much faster to query than a database because caches are closer to your system here as an example if you take the cache query time to be 1 millisecond and the response to be 1 millisecond if all of the queries can be answered through cash it'll be almost 10% in terms of savings and this idea can be extended even to the client even to the mobile device that you have when you fetch your news feed and you get a response if the user is scrolling their Newsfeed again and again they come back they keep their phone they come back again you can reuse the newsfeed that you have already fetched from the network so instead of making a 200 millisecond call store it in your local device in a mini cache inside the phone and now you'll see that the response time of the app has gone down from almost 200 milliseconds to 2 milliseconds okay this sounds like magic uh and of course it is there are drawbacks of caching and there are some limitations to caching that we'll talk about but at a high level caching reduces latency by just using more storage so natural question here is why don't we take the entire database that we have and put it in memory put it in Cache for small systems that makes a lot of sense if you have some static data which is in GBS it makes sense to just take all of that data and put it in the cache if it's being queried off of but for large databases fitting terabytes or petabytes of data into memory is just impossible right uh you may fit in a terabyte of data in memory but it'll be expensive what happens here is you start to optimize on the things that you store in Cache you have to take a part of the database a section of the database which is most frequently used Put It In memory so that when a user is quering for some information it's highly likely that the Cache can serve it it there's a distribution of how many people go to the cach and how many people go to the database so how many popular queries versus unpopular queries based on that you have the final computation let's say 90% people go to the cash 10% go to the database you'll see that in the end you will save less than 10% right 2 or 4 milliseconds so now your job as an engineer is to look at what data is going to be queried so you have to do some sort of prediction here and then store that in cash so that when the client actually call for the data it's already in cash and for that we have to ask ourselves two important questions one when there's an update to the cache how do we manage it because the cache is a copy of a database now when there is an update you will have to update the database and the cash together okay so do you do it together do you do it later there are many strategies here we look at all the right policies and the second part is what data do I evict what data do I kick out of cash if there is an overflow the reason for this is your cash memory is limited and your database is much much larger if a new video has become viral in your system where the video is in the database and all the users are quering for it you want to move this video into cash but your memory is full so what do you do you have to kick out something you have to evict some video already existing in the cache to bring in this new video this is a very common operation that the cach has to perform and so you need a particular policy and algorithm which tells you what video should I kick out okay what data do I evict that's called a cach policy that these two questions form a cach policy you might have heard of some of them least recently used least frequently used uh there's a lot of cash policies out there some of them are machine learning based also as a software engineer the most important ones to understand are least recently used and Le frequently used we'll talk about a few uh in this chapter later and as for right policies we talk about all of them in the upcoming lessons so we clearly know the benefits of a cache you know saved computation always sounds good low latency sounds good are there any drawbacks uh I always find drawbacks interesting because when it comes to such a fundamental component it's almost inevitable to have a drawback but we kind of ignore it and we try to mitigate it but it's good to know the drawbacks what if your cash is not storing the data that is being queried by users in that case all that will happen is that the request will come to the server the server is going to check the cache it's going to find that the data entry is missing it's going to go to the database and get the entry all that happened was this wasteful additional computation which is going to the cach and coming back so an unoptimized or a poor hit rate of a cache is actually going to hurt your system one scenario where this may occur is if you have your clients squaring your data in a sequence let's take 1 2 3 4 as a sequence and let's say your cache memory is limited to just three elements so the first request comes for one the cash has the entry missing it populates from the database gives back a response one is now in the cach then you have two then you have three and at four you have something interesting the cash is overloaded you query the data for from DB the DB gives you that entry and now you have to populate the cash what do you evict well the least recently used entry is one so you evict one you put in four and now now the client asks for one you go back to the cache you see that one doesn't exist you populate one from the database the entry which is eved is two the client asks for two then right so the client is going in a sequence and because of that because of your caching policy you're are having something called trashing where you're doing useless work you're doing a lot of evictions and loading into cash but none of that is helping your system it's not reducing latency it's increasing latency and it's wasteful memory usage the second problem is a much more well-known problem we'll try to mitigate it throughout the rest of the chapter in fact so uh the problem is eventual consistency if you have a copy of a data then the copy has to be updated along with the original source of Truth so in our case in most cases the database is the source of truth right the data that the database stores is the latest copy uh the cache has a stale copy or a working copy that you can do with I'll take an example here let's say you are seeing the number of likes on a YouTube video for every added like there's a query to the database but maybe the cach is updated every hour or maybe every minute right it doesn't need to have the latest number of likes in cash that helps reduce the work on the cash side but the drawback here is that the data is not true now if you have Financial transactions which are running caching systems then you may see older entries you may see stale entries which could cause problems okay so this is known as eventual consistency eventually the cash will be consistent but when well that is determined by the policy that you use as we'll see now the last part about caching is where do you place the cache do you place it in your servers so that will be an in-memory cache this can be a map which is running along with your application or you could place it in the database so the database is getting queries commonly used queries are going to be cached by the database itself in its server or you can have a global cache it's an external system it itself is a cache server which is being queried by API calls get and put by the rest of the services that you have in your system and this cache is independent it can scale independently it may be written in a different programming language uh if you change the algorithm of the cache there is no need to redeploy the code on your servers so there are certain benefits which one would you choose typically in a large scale production system all three are applied there's some inmemory data that you want to store you want to basically cache data across the system even on your client device you want to cash some data your database itself will have a small cache automatically as a blackbox we don't know about it but databases usually have a small cache for queries but as a software engineer what you are going to be concerned with most is having a distributed cache for a large scale distributed system the reason for this like we said is the cach can scale independently its deployments are independent and multiple Services can use the same cache all of that logic all of that algorithm without having to code it themselves so concluding this introduction to caching basically they save time but the caching policy matters and the placement of the cach matters depending on your system you need to make the right choices

---

## 29. What is a CDN (Content Delivery Network)?
**Channel:** Gaurav Sen | **Views:** 79K | **Date:** 1 year ago | **Duration:** 5:43 | **ID:** b4_6thkYZXs
**Link:** https://youtube.com/watch?v=b4_6thkYZXs

### Transcript:
In this video we talk about
content delivery networks. These are things which make
your system cheaper and faster. So that's the end result,
and to know about that, one of the prerequisites is
to know about caching. Also, some knowledge about the
distributed systems is useful. So if you haven't gone through a high
level of what a distributed system is, or what caching is, then go through those
videos first. Then we'll come to this. So let's say some users want to connect
to your website. I'll take interviewready.io, as an example here. They first
resolve the address with the DNS. Then ask what the www.interviewready.io maps to. They get an IP address. Now they
try to connect to that IP address. So with a very simple system,
we will keep a server here, which is going to serve web pages. So the page that you see rendered on
your browser is going to be an HTML page, and that's going to be served
by a machine called a sergo. I think the HTML web pages are
being stored in its file system, which it can read and
return as a response. Since this is a common operation, you
want to do this operation quickly. And so one of the things that you can
use concept and computer science is caching. You can keep the web pages in memory or
you can keep them very close in local storage itself instead of keeping
it in a distributed file store. And when a person asks for a
page, you just return it quickly. The problem with this approach is
that to get a webpage takes time. If a person is connecting from Japan,
if a person is connecting from the us, if they're connecting from India, there is no single server which is
going to be quick to connect to. So let's say you have the server in
India and most of your clients are from India. For the Indians, this server
is going to be reasonably fast, but for the Americans, they have
to connect from across continents. So the latency for the pace to be rendered
on the browser is going to be very high. If you move it somewhere centrally, then both parties are not going to be too
happy and people in Japan may be quite unhappy, right? So there is no single grace in the world
where having a server is going to make everyone happy. It's going to cost
latency to some of the parties. The second problem is that you may have
local regulations which say that the data of this country is only going
to be displayed in that country. For example, if you have certain
movies that you can only show in India, you can't show that in the us.
You can't show that in Japan. Then you want some sort of local
storage for that country. Similarly, us may have some movies which are
allowed to be air only in the US region, not in India. And so for these
reasons, we can take our cash, the large cash that we had connecting
to the suburb and distribute it into smaller chunks around the globe. So kine, which is make in Japan, can be closer
to n Kine, which is make to India, can be closer to India and so on. The benefit of this is
that this is much faster. If the Americans want
to connect to a page, they no longer have to
go to a server in Japan. They can just connect to a local. Server. This is very important
when you're running a business, if there's a delay of even half a second.
Most users, they use a lot of trust, and this is two studies that Amazon and
Google have done that if you're able to render the webpage quickly on the browser, people feel like this website is very
professional, so speed is important. The second thing is that you
may have some local regulations, and we talked about those can be
met individually in the local caches themselves, and you're able to serve
content which is relevant to the user. So there may be movies which are popular
in India but are not so popular in the us. Since this is a cache, it can't store all the movies that
you have in your file store behind, you're going to keep only relevant
data in these local caches. Important thing to remember is that
this cache is very similar to a server. It is actually a server. You
can connect to that IP address. You can hit an API and it's
going to connect to the response. So it is running a server
internally, it has a file system, and that file system can be
manipulated by the mother server. This entire solution is called a
CD N or Content Delivery Network. CDNs usually are made by large companies
because it's not easy to take your servers industry around the world. It's definitely not easy to do this in a
way that you can make a business out of it because the servers have to be cheap
so that you can charge businesses less and they also have to be fast so
that your customers are happy. The best CDN solutions
provide three things. One is that they have boxes in many
cases close to their potential flights. They're able to follow
regulations quite well. So you don't have to as a business
create these rule engines. The CDN is quite efficient at that, and the content patient in
the CN is using Make Easy, if you see the HTML page is that section
of show the server doesn't really want to make an H TM L page, and then the CDN know ideally wants to
just put it in the store and have it even triggered automatically. One example
of A CVN will be Amazon CloudFront. It's cheap, it's reliable,
it's easy to use. We actually use it at Interview
Ready, so I can kind of vouch for it. The best thing about I think, CloudFront is that it has integration
with Amazon S3 when you just have to make a new file and the event
is triggered. As a engineer, you don't have to manage this. So most cloud solutions like GCP
Azure will give you this anyway. All you have to do is think about
what data you want to send to the cd. Usually this data is static
data, like videos, images, files, so that's it. That is a
content degree network. It is a black box which stores
static content close to all of your clients. It's usually very cheap and very, very efficient for fast data access.

---

## 30. How to get promoted to Senior Software Engineer roles
**Channel:** Gaurav Sen | **Views:** 14K | **Date:** 1 year ago | **Duration:** 5:51 | **ID:** _ayi1qsAo3o
**Link:** https://youtube.com/watch?v=_ayi1qsAo3o

### Transcript:
hey guys in this video I want to talk about how you can get promoted to a senior engineer so if I have to hire a senior engineer or if I have to get someone promoted to senior engineer these are the skills I'm looking for also I'll be speaking with my perspective as a software engineer at Uber and DTI previously U this is what I have seen and this is what I have heard from senior Engineers so let's start with an example uh this is roughly 5 years ago when I was working at Uber we had a database which was costing us a lot because its performance was very very poor and when we are trying to you know improve its performance all we could do was scale it out so we are buying more and more machines and eventually someone from the infra team came and said that guys your cost database cost is like really high we need you to bring this down so our engineering manager told us that uh we need to optimize our DB queries we need to somehow make our system more efficient so two answers came okay one of them was from my colleague he had as many years of experience from me is ex Microsoft guy joined Uber obviously very smart uh he had this idea that maybe we can use Predictive Analytics so when a user logs in we look at their history the last 10 queries that they have run and then what we do is we predict what kind of query they'll find now like Netflix you can think of movies being fetched uh in the ISP box close to your close to your country the second person had an idea which was is use a cache when a person fires a query cach the query next time if it is reused we will uh make a saving if it's not reused eventually it'll get kicked out of cash which idea do you think was selected okay the second idea was selected it was much simpler it was much faster to implement and I'm taking this example it's an extreme example but the second idea was from a person who who's currently working at Google as a senior engineer and they are famous for creating crud apps with this simplest possible code okay there's nothing complex about the code that they write the only thing that they are well known for is they keep Solutions very simple and their Solutions are reasonably well tested okay so from this example I think you you're getting a general idea of what senior Engineers are like uh when given a challenge when given a problem they try to find easy Simple Solutions uh simple is extensible simple is easy to explain simple is usually quite cheap also so that's what they choose that's what senior Engineers choose and they make sure that the solution nuts so maybe they don't have 100% test coverage but manually they'll check if their solution is working now as an engineering manager you are not very concerned with numbers like test coverage okay you you may be interested if someone puts pressure on you but primarily you're interested in performance that if code goes to prod it doesn't create a scene and you have a reputation as a manager to maintain so things don't break your reputation indirectly is being set by your senior Engineers so if your senior Engineers have a reputation of their code not breaking eventually your reputation will also be the same thing and lastly senior Engineers are not very bothered about learning a lot of new things so this might sound counterintuitive but they really care only about the business impact if this project however boring it sounds is going to save $10 million they'll go for it they don't care if they're going to create a crud app they don't care if they have to fire a query they have to just rewrite the query they'll do it boring work work that no one else wants to pick up as long as it's going to make their you know senior senior very happy in terms of just the cost savings or sometimes bringing an opportunity they'll do it okay so complaining the least when it comes to poor apis for existing poor code for poor design that is a Hallmark of a senior engineer again they look at really horrendous systems and they're able to control their emotions regulate their emotions and go ahead and perform like professionals you know uh it's something that I mean when you think of doctors right you look at people who who have not taken care of their body for maybe 10 15 20 years even dentists they look at the teeth of people like me right and then they say that what's been going on here but they're professional they look at the problem and they look at what are the possible solutions given this context and they go ahead and implement the simpler solutions that they can so in short if you're looking to get promoted to a senior engineering position one do boring stuff if necessary two keep things simple keep things easy to understand easy to explain easy to test also and three build a reputation for Reliable code reliable projects if you say this project will go on the 30th it will and most likely it will not crash on prod even if it does uh you will check the logs and you'll fix it quickly so your word has a lot of weight and eventually you'll see this being reflected in your manager's behavior in your peers Behavior you are going to be getting the plum projects also but even more important L you going to get the projects which make an impact which people care about which leads to Promotions so all the best thank you so much for watching this do let me know your comments this is my perspective and what I've observed but it's possible that you have observed something different uh at work so let me know I'll see you next time bye-bye

---

## 31. This is why Senior Software Engineers aren't clearing interviews
**Channel:** Gaurav Sen | **Views:** 138K | **Date:** 1 year ago | **Duration:** 3:35 | **ID:** qYuW0xuX2YY
**Link:** https://youtube.com/watch?v=qYuW0xuX2YY

### Transcript:
hey guys I just want to share some thoughts on the software interview process I think there are three fundamental flaws that we have right now and we can all work together on that as a community the first problem that I see is that uh there's a very strong focus on reducing the number of false positives in an interview process so all the people who go through this filter of interviews deserve to be in the company that's the idea false negatives are not focused on if someone is removed in the interview process and they deserve to be in the company that's not that big a problem you'll get someone else this is the general approach the problem I see with this is you might lose out on some really really good candidates like if you have lenus or if you have promode Verma coming to your interview and you ask them to prepare for DSA they may not do that and they may not clear your interview process uh which is going to cost you a lot potentially you're going to lose a lot more than maybe 2 3 10 false positives could have uh hurt the company the second problem I see is that there is a lack of difficulty in the interview questions what I mean to say by that is the interview questions are a they're not job relevant okay so there is no complexity real world problem in the interview question and B uh they are not at all subjective most of the interview questions are extremely objective like you have a binary tree uh and you have to find the largest element that's okay I mean it helps reduce bias but reducing bias for the sake of reducing bias is really not helping anyone you want the best candidates uh for that some subjectivity and bias may be necessary and I see that the interview process talks about college level algorithms to even people with 10 15 20 years of experience I think that's irrelevant uh and testing them on those skills is going to cause fundamental problems it's people with simple analytical skills who will be able to get through your interview process people who are not interested in doing that will not prepare for the 3 months required and therefore they will not clear the interview and the final weakness I see is senior Engineers are finding it harder and harder to Showcase their skills because the skills that will be expected of them are really low level like basic college math problems so they are not able to differentiate themselves in this process you're taking people who are able to clear this process which could be even a college student right in that way you're losing out on this awesome Talent if you want to change this if you say that okay from Tomorrow onwards I'll start asking hard questions fundamentally your compan is pushing for low bias for more objectivity for more data Gathering I'm talking about Google Microsoft Facebook all of them are about reduce bias gather more data and become more objective in your processes if this continues I see a lot of Engineers who are not necessarily fitting into this interview process but are super interested in Tech and good at Tech move to different companies so these are my thoughts on the interview process uh the first thing is I mean do you think it's true do you think it makes sense or have I missed on some major points uh and the second thing is if you agree then do you see any kind of solution around this because I I don't see an easy solution around this I see a fundamental change in our thinking required and then we'll have to create tooling uh to to match our requirements to get the best talent uh in the industry so thank you for listening and thank you for sharing your thoughts I'll see you next time bye

---

## 32. 30 [Software Engineering] research papers you should read
**Channel:** Gaurav Sen | **Views:** 13K | **Date:** 1 year ago | **Duration:** 21:49 | **ID:** kVP1qM9zgaA
**Link:** https://youtube.com/watch?v=kVP1qM9zgaA

### Transcript:
hey guys this is gkcs in this video we'll talk about 30 white papers which are worth reading if you're a software engineer I've gone through about 100 I've ranked them scored them and the top 30 are what we'll discuss in this video so let's get started number 30 is scalability at what cost coost is in caps that's a acronym the basic idea here is when we are talking about scaling a platform scaling a service we think about horizontal scaling which is adding more servers so whenever request comes in you can load balance it to the right server the hope is that overall your system is going to react faster latency will go down but this paper challenges that supposition it talks about mainly graph algorithms which tend to perform much better in a single note than a distributed environment many of the assumptions that you have around distributed systems are broken here it's definitely worth the read it's a very easy paper to read also it's not too dense as compared to the rest of the papers coming up in the lineup good paper to start with number 13 number 29 is detection of Silent data corruption this is a paper from Google it talks about basically anomal detection if you have hard Ware errors or if you have errors which you want to detect very quickly in software then this is a very interesting paper to read in general as a software engineer all these papers are good so you can go through it I would give it a score of prob me four out of five because it's quite useful quite good but there is that Hardware element which may not be very relevant to software Engineers good to know though number 28 is profit which is from Facebook it talks about forecasting at scale Facebook has a lot of data metrics that keeps coming in and you need to be able to accurately forecast what should have been the the right metric because if you want to detect an anomaly you need to see the difference between what should have been and what actually is so observed versus what was predicted now Facebook has this white paper where they talk about millions of metrics which are flowing into their system and then they have to in real time detect anomalies worth reading again I would give it a score of roughly four out of five because it's a pretty long paper and it's got some things around statistics which are not core core to software engineering still worth a read number 27 is Napa this reminds me of a Dragon Ball Z character I'm sure he didn't work at Google unlike the engineers who wrote this paper it talks about data analytics it talks about a lot of the product metrics which are at Google are very useful when you're trying to find patterns so Napa is a data warehousing analytics Solution by Google it was featured in BLB which is a very respectable conference so definitely worth a read I would give it a four out of five because it's extremely geared towards data engineering but definitely it's it's amazing so you can read it as a software engineer also number 26 is cubric this paper is from Facebook it talks about an in M analytics processing system when you are having distributed olap databases olap is a particular way in which you store data in a database if you have a lot of data then maybe you don't don't want to store all of the data you want to aggregate it and then you want to perform analytics on top of it that's what this paper discusses it's from meta again featured in BLB superb depth here little more towards data engineering sometimes I'll again give it a score of four out of five I'll give it a rank of 26 out of 30 but 26 out of 30 amongst the 100 plus papers I've read is a really really good rank definitely worth it read number 25 is near realtime server monitoring and root cause analysis it's a really long paper name you can probably get most of the idea of the paper just from the name root cause analysis monitoring so if there are problems in servers then Facebook who's written this paper wants to detect that quickly we talked about profit earlier which is a forecasting system this is identifying detecting errors and also trying to guess what the root cause is so one common technique of finding root causes for any problem is to ask many questions the yse the five y so if a server crashed you ask why did it crash and then you say there was a memory overload so why was there a memory overload because someone wrote code which was adding to a list infinitely why were there infinite additions because I didn't do rate limiting so in this way you really get to the absolute root cause it has some drawbacks also this approach but we'll not get to it for now let's talk about the number 25 paper monitoring and root cause analysis I'll give it a four out of five maybe because it talks again about techniques which are not used every day as a software engineer this paper is definitely worth a read number 24 is Presto SQL on everything as the name suggests they want to run SQL on various forms of data stores so if you have a graph data stored if you have a data warehouse if you have any kind of data file stored then ideally you learn just one language and you're able to query data all around the world that's a dream but for Facebook it's almost a reality in the sense that they have multiple data stores and what they do is they have connectors on top of these data stores which can be used to fire SQL queries on them Presto is the language you can can say or or the connecting thing which makes this possible it's worth a read as a software engineer it's very useful as a data engineer it's amazing I would probably put this paper as a data storage or data analytics kind of thing worth a read number 23 is foundation DB this is a paper from Apple engineering it's a open- source database from what I remember it's perfectly consistent database if you want it to allows transactions and it is a nosql database transactions plus no SQL has this new tool term called new SQL because earlier people used to no SQL doesn't have transactions now they both come together Apple has this paper which is quite interesting what's the best part about this paper is the way they tested the system making sure that their transactions work is quite novel and they have videos on that read the paper if you are super interested go and watch the videos it's nice engineering number 22 is F1 lightning this is a paper from Google and it reminds me of Formula 1 cars going at tremendous speeds they have also named it lightning so super fast but the fact is that this is more of a hybrid database that they have tried to build one is on transaction processing systems so real-time production systems and analytics also on top of it seems counterintuitive normally what happens in large scale distribut systems is you have one type of database which is optimized for real-time production workloads High consistency transaction support and there is another type of database which is basically rebuilt using this production data from time to time which is optimized for analytical workloads there are patterns also for this there's something called cqrs command query responsibility segregation so you have commands here and you have queries on this read optimized database let's not get into that if you take both of them together what do you get you get a hybrid and what's the hybrid called for Google F1 lightning worth a read interesting concepts of course nothing is perfect in the world so there are some trade-offs that they made here do check them out number 21 is from LinkedIn that's the only LinkedIn paper that I see in this entire 30 paper list and the paper talks about finding connection distance efficiently in LinkedIn if I am connected to a person and you connected to the same person and we are not connected to each other what's the connection distance between you and me it would be two so that would be one connection plus one more but what if you want to find a connection distance of two in this case you need to find all the people near you and then we need to draw that Circle even larger for the second degree connection and then we need to find matches it's a well-known difficult problem to solve LinkedIn hasn't optimized on the algorithm here but it has optimized on the software engineering part which is caching finding out which connections should lie in which box so you can run the algorithm efficiently in a single box rather than having cross communication across boxes amazing paper it also links to many other amazing graph algorithm papers definitely worth a read I would give it like maybe a five or five or four or five the only reason I'll dock a little bit of point over here is because it doesn't go into as much depth as I would like it to but it's a easy paper to read number 20 is tensor flow this is an extremely popular paper cited thousands of times written by Google It's featured in US n so you know that the quality of the paper is pretty good it's taken over a large part of machine Learning Systems definitely worth a read number 19 is the Monet strikes back this is an independent paper although I found it in the Google archives the idea here is that you don't always need microservices to scale your system you can do so with monets also and monets have certain benefits they are easier to code there's lesser complexity when it comes to deployment if you remember the first paper we talked about number 30 which was scalability at what cost this is its sibling in software engineering that would be in terms of devops this would be in terms of software engineering don't get too excited about having thousands of nodes running graph algorith here it's don't get too excited about thousands of nodes running your Production Services microservices are not always the solution M lets work really well that's the basic idea but worth a read because they give it in a better language than I can and I would say it's like a five on five or 4.5 out of five because very relevant very useful little less formal than I would like it to be little less talking about numbers than I would like it to be but an opinion number 18 is HP which is content delivery Network optimization by YouTube as you can expect the paper is from Google from the YouTube Team it talks about how they optimize their caching on the content liy networks when you're trying to fetch a YouTube video you sometimes hit an ISP who is connected with Google Google goes to the ISP gives them a box called YouTube Red you can think of this as a hard disk which has a bunch of YouTube videos which are ever green it's like YouTube's cash in the ISP the benefit of this is that you don't need to hit their servers every time most of the content is just placed in the CDN if you want the hit rate to be high you want your algorithm for eviction to be efficient for a cash Google found that lru lfu all of these algorithms exist but HP performs slightly better it's a great way to introduce yourself to machine learning worth a read for a software engineer I would say that it's maybe 4.8 4.9 out of five give it a shot from now on every paper that I talk about is excellent It's like 515 and number 17 is Monarch Google Monarch is a Time series inmemory database from Google the basic idea here is that you have petabytes worth of metric data at Google and you want to be able to analyze that data very quickly so you want to keep it in memory the problem though is that you also want to detect anomalies in case things go wrong Monarch has to respond even if spanner is out even if Google's file store is out you still need to be able to answer queries because if their Engineers are debugging spanner then they don't want a system which is dependent on spanner that's an interesting way to think how do you make a system so reliable or so independent that it doesn't need a database Google talks about it in Monarch many optimizations talked about in this paper when it comes to Time series and it's a novel kind of thing for a software engineer I would give it a five on five definitely worth a read although it's not very easy to read it you need to probably go through it once or twice or Thrice to get the general gist I would suggest taking notes separately in a in a notebook or on a notepad because that helps you visualize what these guys are doing number 16 is Dapper Dapper is a tracing system at Google so if you have a request which comes in and you need to trace which services this request hit and how much time they took and what was the response like normally what happens is you have these these logs and you have a central area where different Services post their logs and now if you use a request ID then you can search amongst all the logs together so they all come forward sorted by timestamp Dapper is a better system I would say or or a system which performs this at scale it's a system written by Google very interesting used for anomal direction and other things similar to request tracing worth a read number 15 is Gorilla DB this is one of my favorite papers actually it's a highly optimized time series in memory database created by Facebook it's now meta the basic idea was that you don't need all the data in the world to be persisted you just need the last 26 hours data to find anomalies which have to be reported immediately Facebook actually wrote a paper which talks about how it gets terabytes of data in their system and they are able to detect anomalies in real time number 14 is zanar this is a authentication system written by Google it's one of my favorite papers because it has so many practical optimizations which it talks about it talks about request collapsing it talks about hedging requests I've actually taken a live class about Zanzibar gorilla DB and these favorite papers of mine it's at interview ready I would recommend reading it though because as a software engineer often you're looking for some kind of optimization which is slipping through your fingers you have some ideas but it's not clicking zanzi Bardo works at a scale which is so large that they try to hit every single optimization that they can so it's a good listing of optimizations that you can use when it comes to request processing number 13 is mcash at Facebook this is talking about an advanced caching system by meta the earlier Facebook what I really like about it again is that it talks about a caching system which they have used from almost startup phase to a mature company phase that means they move from a small engineering team which is just trying to survive creating a social network which is scaling quickly to a completely scaled highly optimized social network cache there are systems which have been written on top of mcash at Facebook so definitely worth a read the optimizations are amazing it's a old paper I think it's written in 2013 and yet it talks about some of the amazing algorithms that you can use in your own cache it's inspired many other papers Uber for example uses a lot of ideas from mcash Twitter used M cache they used to call it twem cache I would say it's a base it's a foundation for many of the caching algorithms which are now visible in the world number 12 is seve is simpler than lru it's a bit of a weird name lru is a cache eviction algorithm s i v is actually an acronym here okay it's an eviction algorithm it's a very simple eviction algorithm almost as simple as let's say lru when you are out of space in your cash you have to choose an element to evict and the benefit of SE is that you don't need to jump around with your pointer you can just go straight ahead Mark Elements which have been visited already as visited and you push it forward in your queue it's like a priority queue in that way if it hasn't been visited then you evicted so it's got some principles from lru and lfu in the paper will give you more details what I really like about it is that despite all of the years decades of cash optimization researchers have not given up and have discovered simple optimizations which tend to outperform really complex machine learning techniques also so the paper is as you can expect it's a independent paper it's a research paper from a university it's a very new one definitely worth a view number 11 is also a caching paper this is the last caching paper that we are talking about but it's a analysis of hundreds of inmemory caches at Twitter I really like this because it's eye opening to some extent usually when we are thinking of caching we are thinking about read heavy systems when we talking about mcache or when we are talking about redis we're thinking about a specific way in which caches are used but in a very large scale distributed system you have various varied requirements this analysis talks about how cash performance depends on the expiry object size and right rate even more than eviction policy the previous paper was on SE an eviction policy which is awesome but this will bring you more in touch with the Practical aspect of things when it comes to actual access patterns for caches you have to consider a lot of things not just the eviction policy if you're an engineer 5 on5 surely number 10 is I think the only paper from Amazon in this entire list and it's excellent It's called firecracker it talks about virtualization you can think of containers microv BMS all of those principles are touched upon in this paper what I really like about it though is that when you think of serverless when you think of Lambda in AWS like you want to run your code without assigning a server to it how does that work for Amazon how do they do that in real time what are some of the Practical things they can do do they cash some of your container Properties or are they something else worth a read now I'll tell you that out of the nine papers remaining there's just two which are non- Google papers almost every paper in the top 9 that I have short listed in the top 30 is Google number nine is spanner it's a difficult paper to read frankly distribute consensus is difficult as a subject in my opinion I've read a lot of stuff around this papers Leslie Lamport has a website which talks a lot about consensus but even then it doesn't seem very easy to understand okay so as a software engineer don't beat yourself up too much for not understanding everything but if you go through it once you'll get a general idea of how things are working number eight is Dremel this is considered one of the best papers I think ever written it's by Google as you can expect it talks about very large scale data sets how do you run interactive analytics on them so interactive analytics is like you you're operations team person or a product team person and you come and you want to fire a query so it would be like Google analytics where you have some data and then you want to filter some column out or you want to aggregate something and you have to do this in real time so Dremel allows it now Dremel has inspired many papers it is an inspiration for Apache Impala and if you have checked out Google's big query service it runs on top of Dremel this paper has been featured in BLB definitely worth a read number seven is I think the world's most popular software engineering paper for sure which is Google file system you have probably read it if you haven't then you have definitely heard of it and if you haven't heard of it then please go check it out it's it's really nice the reason I'm putting it at number seven is probably because you know you have already gone through it I would say that a lot of the ideas in this were so awesome at the time that it came out that it's definitely worth a read many of the ideas have been ingrained into software engineering now like if you have joined software engineering after 2015 then you probably have heard of many of the concepts that this talks about but still it's worth a read it's worth just going through them again this is pre nosql hype pre machine learning hype preap reduce hype this is the thing where everything started so do have a look number six is big table again another paper from Google I said that you know there's just two non-google papers in the top nine we have reached six and gone through Google for a long time big below which is number six is something which is written on top of Google file system it's a no SQL data store for Google if you are storing especially web pages then it's super optimized if you have Google's crawler searches the entire web picks up pages from different places stores it for processing later those pages have versions so how do you store that efficiently these are some of the problems that big table had to face it's a very early paper by Google but still worth it number five we are in the top five and finally a non-g gooogle paper comes in which is from meta and it's Hive which is a warehousing Solution by Facebook it's very interesting I think it's now been open sourced the idea is that you want to store a lot of data and then you want to scan through that data efficiently Hive is an old paper it's on data storage it's an old paper again many of the principles might already be well known to you but it's worth looking into if you're a data engineer or a software engineer it's amazing number four is breal Regal is a graph processing system by Google it processes graphs in batches very interesting to read Because when you're looking at page rank algorithms or you're looking at any kind of graph processing which is done at Google scale it could be even social networks you know if you're thinking about emails who's connected to whom whether you should Mark something as spam all of that graph processing can be done by pral I don't think pral exists in Google anymore but the algorithms and the ideas are really really interesting definitely worth a look number three is the last non-g gooogle paper which you'll see in this list of 30 which is uh Facebook tow which stands for the associations and objects it's a graph process saying in memory meta system it's written on top of Facebook mcash one of the problems with mcash being used by Facebook Engineers for social networks was that their Engineers had to learn a lot about mcash so they extracted that logic they put a rapper around it but now is not just a rapper it's like a really really interesting complex practical rapper so worth looking into you can think of this as a graph database which is powered Facebook scale the last two papers are both Google they're a little less heard of the reason I put them on top is because they're very easy to read very interesting they pick a topic which is slightly different software engineering but slightly different so number two is moving beyond end to endend path information to optimize CDM performance it's a really long name but if you read the name carefully what it talks about is how do you get data efficiently from a CDN and usually we think that if you have connected to a CDN quickly then you'll get data quickly but the fact is a CDN is also just like a server once you connect to it you might have to wait in Q for a while and also connecting to it doesn't just mean the physical distance has to be low you might have a really long path around a CDN so how do you avoid that even though you able to send the message in a really straightforward fashion you might be getting back the message in a long roundabout path Google did some analytics around this and discovered that this is actually a serious problem we can talk about efficient cache algorithms we can talk about efficient connections but the fact is if the path is not optimized or if the Q size is too small for a CDN then you'll face serious issues worth a read if you're a network engineer and definitely worth a read if you're a software engineer the final paper is by Google it's probably the hardest paper I have read I had to check out their video read some other blogs but when you understand it it's like wow it's on load balancing the algorithm is called backend subsetting this is used by Google's autopilot system autopilot is the load balancer which gets requests and then forwards it to the right place for Google it's a difficult algorithm like I said if you know about consistent hashing if you know about round robin if you know about random assignment then it's good to start with if you don't know about it then you can check out the link in the description for consistent hashing but the main idea is that at Google scale request routing is super super super important optimizing on their load balancing algorithms can save them millions of dollars so they do a lot of research around this and they find the best possible algorithm which is a trade-off on complexity which is a trade-off on what happens if things go wrong so fall tolerance when things are going fine then what's the latency like so there's a lot of things that they consider here in this paper backend subsetting then they come up with the algorithm which is difficult to understand like I said but worth it when you do understand thank you so much for watching this video we talked about 30 papers which are worth your time most of them them to be frank with you are from Google a large section of the remaining papers are from meta that's what I saw after going through about 100 so papers on software engineering if you have been paying close attention then a lot of them have been on data analytics and data storage and reason for that is because recently there's a lot of focus on data analytics and data storage that's probably one step away from machine learning which is coming out recently right now we are talking about the nent stage of machine learning which is anomaly detection I've seen Microsoft Facebook Google talk a lot about anomal detection now I think that's the most practical place to put machine learning in software engineering to start with all the best though I hope you read all of them and I hope that they really add a lot of value to you I think that as software Engineers it's really worth your time let me know which is your favorite paper and if you have any suggestions on adding papers to this list do let me know I'll do that in the description see you bye-bye

---

## 33. Find the distance between friends/connections - LinkedIn System Design with @KeertiPurswani
**Channel:** Gaurav Sen | **Views:** 13K | **Date:** 1 year ago | **Duration:** 17:48 | **ID:** OXLDI8gibPw
**Link:** https://youtube.com/watch?v=OXLDI8gibPw

### Transcript:
hey folks welcome to this new episode of system design churcha uh we'll be talking about LinkedIn connections how LinkedIn stores them but most importantly how queries happen uh on LinkedIn so if you're searching for first degree second degree third degree connections how can LinkedIn get those connections to you very quickly for example I am connected to gorov and then gorov is connected to Blossom then Blossom is my second degree connection and suppose Bloom is connected to someone else then that person is my third degree connection [Music] we have across 1 billion users on thing that every person has around what thousand connections which is basically first degree connections is what we are talking about so these th000 people again connected to th000 people so that becomes 1,00 2,000 which is 1 million second degree connections and if we have to see third degree then it will become 1,000 Cube which essentially becomes our entire user base yes everyone right so if we have to see this can be our aim for today that if we have to find the third degree connections for everyone yeah if you get a query get me my third degree connections yeah the easiest way to manage this would be just Brute Force so in SQL it will look something like select connections uh from the connection table so select star connection where user uh their ID is equal to our current user so let's say current user ID is 1 to 3 and then we have the second degree connections select star from connection where user ID in this okay so because you want distinct users maybe you want to select distinct user ID okay um pretty simple you're basically firing one query and another inner query to to get all connection data if you do this I mean if you just fire this query it's going to take you order n Square time okay where n is the degree uh of or rather n is the number of connections that a person has 1 million nodes in any database is not fun to query it will take you uh hundreds of milliseconds to go through this if you do it for thousands of queries per second this is going to happen not only uh with people are trying to look for connections but it's also going to be many automated queries in your back end will need connection data so thousands of queries and you have hundreds of milliseconds if you want you it just isn't fast enough right so in terms of time it's going to be many seconds in total correct so yeah that'll be like hundreds of servers just managing these kind of queries and hundreds of servers not not exactly because you need a lot of database queries also so you'll have to scale up your database it's a very expensive way to do this it's not ideal right another way to see it like G told in terms of queries another way to see it in very simple terms if you're doing BFS on if the number of connections is n then for first degree it is order of n correct and for second degree it will essentially become order of n Square yeah right gor yeah and for third degree it will basically become order of NQ yeah now a question to all of you also I hope you are thinking it yourself as well that if you know we are taking order of n cube in BFS how can we optimize this a bit uh so a very simple and a very common solution is to do by directional BFS so let's assume kti has these people as their first as a first degree connections and gorov is somebody who she found on a search result so she wants to see how far gorov is from her uh in terms of connection hops so these are first degree connections these are her second degree connections we first come compute these people they help us compute second degree now we could compute third degree also and eventually fourth degree and then when we find gorov in the fourth degree we say gorov is a fourth degree connection but instead of doing that which is going to be computationally very expensive it's going to be order yeah four yeah so it's going to be like really really far away we instead start moving from the destination also so this is the bidirectional part of BFS from gorov we find his first degree connections and then we say okay is there a match between kti and gorov if there is then kti and gorov are at a distance of three right because there's if you find a match if these two users are the same then you know that kti is distance one away from this person gorov is distance one away from this person uh that means they are 1+ one 2° away okay uh but if that is not the case then you find the second degree connections of kti and then you see if there's any match if there is then you know that the distance between them is 2 + 1 which is 1 2 3 uh and four yeah now that we have this if you really want to find gav's uh I mean you want to find further connections then you can do the same thing let's say gorov has these people as their as his second degree connections and if you see a match here then you know that the distance is 1 2 3 4 fourth degree connection can be found so this really helps us bring down the order complexity from order n ra^ 4 like mentioned to order n Square so uh in terms of order complexity it can't be better than this unless you I don't know what machine learning or some unless you have that uh but the in terms of algorithm complexity this is acceptable okay because 1 million connections for a user uh will be searched so that's okay now even this is not good enough uh root Force approach has only optimized on the algorithm but there are some practical aspects which are still a problem firstly uh running a BFS or running a join uh on a table like you're going to run two joints one for gorov and one for kti yeah that's what basically this query is going to translate to in real time if you try to do this it will be hundreds of milliseconds again so that's not ideal uh what can we do to avoid this right even when we have to do BFS getting the data again and again from the DB like from the disk to memory and then Computing then doing BFS is expensive so one very obvious solution that should come to all of us is basically cashing now yeah again storing or all of this data on cash seems s right this is we are talking essentially about millions of people so how do we store the entire thing on cash is our next problem to think about yeah firstly you need to earn a lot of money like LinkedIn because you need to be able to afford all these cash servers interview ready will still take some time to get there but uh if you or rather of course when you are rich enough and you really care about query latency uh what you can do is break the Cas into pieces so you have a set of users who go to one cache say cach one uh set of users who go to another cache which is cache 2 another set go to Cache 3 the reason why we are splitting into multiple caches is because we can't store all of the connection data for all users in one cache if we are assuming 1 million connections per user and you have 1 billion users if this is really what we are uh assuming then it's going to be uh not 1 trillion 1,000 trillion entries so there's no way that a single cash can store that much yeah also uh to like simplify it even uh more a bit that we would be obviously storing all our users the first connections on DP but do we we need to store the second degree connections third degree connections on DP car what do you think do we need to store them no I don't think so I think this query is is good where you have like a single degree is good if you want to store second degree we can do that but I mean I would rather compute it in memory because the second degree changes a lot so the DB will need to have a lot of update queries also fired into it so instead just store it in a denormalized single degree way so gorov is connected to KI or gorov is connected to this user you have this information but you don't have second degree correct so this is what the table so basically in in disk we will have basically K is connected to these people gav is connected to these people not the second degree connections not the third degree connections but we have to compute them and keep them in memory right yeah so since we're already talking about databases it's it's good that we will quickly discuss a bit about which DB and which uh Cache can you use right so a very very common graph based databases are basically new 4J nepon uh which we could definitely use over here it is uh very much optimized for graph based queries uh there is basically also Cipher for to run queries which is very very good for all graphical queries like to to find the shortest distances like BFS and not it is very optimized for that uh coming to the caching part so interestingly redis also has something called redis graph so it is a wrapper on top of redis key store and they are trying to store like it recently came it is not like very old uh but they are basically trying to store the graph in memory and it also offers persistence but like because we have to deal with cash redis scff is a very good option over here actually that's a really good point KY if it is an inmemory DB then maybe running these queries is going to be super efficient on is yeah it's a great Point yeah this part is I think uh we are good here after this once we have found second degree connections there is another problem uh and the problem is if your cash fails if this breaks then what happens wa let's just say this cache one it failed so a set of users with their first connections or rather a set of users with their second degree connections was lost so to take an example them again yeah so now if you have to compute them again is that is that going to be fun basically every time you fire this query when you are Computing them at some point in time you have to go to the DB and do this it's unavoidable you're cashing because you're hoping that when the real query comes it'll be fast and plus you'll be able to reuse this data but the first time for the cach to load up it will have to fire these queries from DB so we don't have any fault tolerance if a cash crashes we have to rebuild it uh and that is affecting our latency so what do you think is a decent option also g i I think we missed discussing one very important point that when do we compute the second degree third degree connection like suppose when I send a connection request to you like do we compute at that time or when is it computed I think initially uh what we should do is we should keep all active user second degree Connections in Cache so this can be like a lru cache a person comes does stuff and then they leave and they don't come back for a while so this cash can have a replacement policy of lru MH when they come and they try to get the second degree connections we can compute it for them uh in real time and if I send a new connection request to you do we update at like do we update the cash at that time I think we should so for example if you send me a connection request and I accept then what should happen is keep these first degree connections update themselves and I just add this person and their connections their first degree connections to her second degree right that updation needs to happen in real time so anytime a person accepts a connection or removes a connection we should we need to do that now removing a connection is complex because it's possible that gorov uh is connected to a and K is connected to a and somebody removes me as a connection so if they do that and they're connected to kti they should still have that thing working for them so I don't know how this is going to be resolved but uh additions are easy comparatively removals are a little more complex maybe we want to do this like with a eventual consistent thing which is correct it's a background job that's constantly running yeah because it is not a big deal that if he see someone has second connection or third connection even if they are not even if they recently disconnected it is finally eventually say that okay they go disconnect yeah yeah first degree is a real problem but second degree is fine yeah yeah okay okay we have this we were talking about the fact that you know if a cash crashes then all of this is lost all of this uh all of this data has to be recomputed which is expensive so how do we do this efficiently so on cash startup we can start firing these these queries on the DB but that's going to be it is going to be intense I don't think it can be avoided what else can we do replication always the answer whenever something goes down yeah so like you said K so if you have replication so you have the first cach replicated multiple in multiple places maybe you have one in India maybe you have one in us one in Europe uh so the benefit of having this replication is u a dates are rare but reads are often you have fall tolerance so when if this these two caches are down you still have this one alive people you brought a very important point that if one cash is in India one cash is in us so basically you're also taking care of that if I if I am in India and I have to get information from the cash in us it is obviously expensive so replication solves that problem so it is helping us with latency as yes it it could yeah also like uh a lot of times people ask about you know how many replicas should we have so what is the ideal replication Factor according to uh if you are having it depends on a few things one is you if you want just uh fault tolerance then replication factor of one is also okay because if one crashes the other one is there so there is that uh primary replica kind of architecture where you know one is just taking updates and eventually it becomes consistent and you can do read queries on both that's one but if you're looking for like uh you know you're doing replication because you want to increase read or reduce read times so latency wants to you want to take it down so in that case you want to maybe geod distribute it or even if you don't geod distribute if you have them all in one place you can fire queries you can load balance between those replicas so like this is a this is a similar case right yeah yeah like I'm saying three but there's no reason why it's three uh I'm sure there are like a CDN for example is an example of replication Factor being like let's say 10 or something because it's there in many places on Earth but yeah if you're looking for fall tolerance only you're not really looking for latency then two is okay to just quickly summarize so we started with our capacity estimation we saw that okay there are 1 billion users we definitely checked out the brute force and we understood that it will not work out for us then we considered by directional BFS and even that would not be a very optimized solution so we talked about caching so I guess more or less we are done with this awesome see you bye-bye

---

## 34. System Design of a Delivery System like Zomato with @KeertiPurswani
**Channel:** Gaurav Sen | **Views:** 63K | **Date:** 1 year ago | **Duration:** 25:41 | **ID:** nHh3DnjnPig
**Link:** https://youtube.com/watch?v=nHh3DnjnPig

### Transcript:
hello everyone and welcome back uh gkcs today again we'll be uh discussing a very interesting problem so we'll be talking about delivery system to be precise now you could be considering swiggy delivery Partners or zpto Amazon any delivery Partners we be espcially focusing on how can the delivery happen so that will be our Focus point [Music] today we can first talk about the requirements in detail first will be math in basically we are considering the case where the restaurant has already accepted the order and now we have to we have to match a delivery partner and then we have to do the tracking of the delivery partner so these two are the major things that we will be doing today right yes in matching we are going to have some things to consider the most important is how much time is it going to take for the delivery partner to get food from the restaurant to your house how high is the rating of this delivery partner if they're high rated then maybe they should get more deliveries in the day uh and another thing which KY actually brought up is the sense of fairness or you know that the deliv partners don't get too exhausted uh if you have a person who's already made 10 deliveries a day then everybody else is maybe sitting so you're not utilizing the resources in the best way possible so when we do matching we'll essentially be considering these factors time seems like the most obvious one obviously the time should be very less but then these are also very important to consider like for fairness and and tracking is also a very interesting problem because here like if you have used swiy zato you must have seen that we can see the delivery partner approaching us and you can also see that which route are they using and how much time they are going to take and we can actually see them moving right so how does that happen and how does the communication happen will also be an interesting thing to solve yeah yes so of course yes uh so we have basically uh person who is who has placed the order so our delivery partner has to basically go to person's location and then there are basically restaurants right so there are restaurants or restaurant owners you can think of it like one entity and then of course there are basically delivery Partners right so if we start from assigning the delivery partner basically our restaurants are the one who are going to be uh like accepting the request and that is where our whole assignment is going to start correct so restaurant is where it is starting our request is going to start and U there's obviously going to be a service so what do you want to call it like delivery matching service yeah we can call Management Service Management Service yeah cool so the request is going to go from the restaurant to the delivery Management Service right that so and so request has been accepted and now we have to manage the delivery and then from here we have to take care of the rest of the things does that make sense yeah yeah just uh to clarify this Management Service uh can have many things to a delivery it can be ETA right how much time is it going to take for the delivery partner to reach your house that is also something that Su and zato show so and also it shows you a route it shows you which roads they are taking and coming 99% of the time they don't use it but whatever it's a nice blue line that you can enjoy uh but in reality uh I I mean all this is calculated but we are not going to be looking at it just now because it can get very complex we looking at a very specific part which is just Tracking not routing right not estimation we are just looking at tracking a Del partner cor it uh so since we have to manage the delivery Partners first of all I think we should be talking about how we are storing the delivery partners and how many delivery partners are there like a bit of capacity estimation as well what do you think yeah uh one concern that I would have here is how many people do we need to match with and would it make sense to cash them or are we going to fire skq queries what's that going to look like correct so quick capacity estimation so how many like if we consider a particular city right so how many riders are going to be there in a particular City and how many rough number of requests are we going to get let's say per day in Mumbai we get 1 million million deliveries which is a lot like one in 20 people order so that's uh that's insane 5% uh so 1 million deliveries that's just one city yeah so and now we know that there uh okay if if you want 1 million deliveries uh I think at most a person can deliver in a days like 10 10 yes Del yes yeah so that would be that would be I would say uh one lakh deliveries sorry one lakh riders in the city okay so there are one lakh Riders per City and making 10 deliveries in a day so 1 million deliveries all right and how are we storing these Riders so we'll obviously be storing per City Riders right that does make sense yeah yeah I think that makes a lot of sense you can have it City some location wise yes so let let's discuss how are we going to store these 1 lakh uh Riders first of all right uh per City database if we are considering so the common query that we are going to get first of all is the location of the drivers and like who are the drivers near this location correct that is the common query that we going to get from this database uh now there are possible DBS that we can consider we agree that the U that the schema is not going to change so SQL DB could have been an option but the query is going to be very complex if you use SQL DB so that doesn't make a lot of sense uh Cassandra would have been a good option or any colum the database could have been a good option but also here because we have to co uh Geo like according to the geol location what about something like quarries right that does make sense to use geospatial uh databases over here what do you think yeah I think it it would work maybe instead of thinking of a database in this particular case I we have to store the data somewhere so database is good but uh if you're looking for finding active Riders to uh you know to get them a delivery I think we should do it all in memory if possible okay so and SQL query know we'll just pull up all the Riders who are active and keep them all in memory and whenever a person asks for a delivery executive to a restaurant we uh we will see in our memory uh run through lists and then pick the best okay so that does make sense so we are keeping all the one lakh we'll be basically keeping them in memory itself yeah per City we will keep everybody in memory maybe we can Shard according to City okay uh so I have a couple of questions over here so when we keep the keep updating the location of the driver or of the rider so basically uh suppose we have this is the memory right and then we also have it in DB right so are we storing the location like how are we going to update it like in the DB as well or are we not going to keep the location the DB we are just going to keep updating in the memory uh we we should probably just keep updating in the memory and then eventually we can like in a asynchronously we can update the DB when we feel like okay okay so basically this is a right back uh cache right that we'll be writing in the cache and then we'll be updating as synchronously in the database does that make sense yeah yeah right so in the DB uh but we should discuss right that how would we store in which kind of DB does make sense over here what do you think which DB I would I would use because the DB is not going to matter I would use a SQL uh database which would just store the uh the you uh the delivery person's ID uh the location that they currently have and it yeah that's it that would be one table another table would be having all the ratings that people have given to this delivery person and okay another would have all the orders in which the delivery person is going to be mentioned but when we are running the query for matching we are going to actually do all this in memory so we will have to take a join on all of this stuff okay why why do you think uh different tables for ratings and for Rider ID location because they are all separate uh objects so a order is a separate object in that there's a delivery person uh when there's a rating the rating is given for food the rating is given for the dely person by a user so any kind of query that we fire might be on any of the columns so I don't want to put it in one place uh I want to keep it normalized and when we are running any match queries that time yeah we can process it in memory makes sense makes sense and also instead of uh storing exactly the order IDs here because we have to do the driver matching uh we could have like the number of deliveries the person has made in that day right in that working day so that we could store in one of those tables itself the basically these are the factors that are going to help us in delivery matching basically so in our cash if we think about it in our cache what all things do we have we have the rider ID the location the rating and the uh basically what did I just say number of deliveries per day on delies does that make sense yes yes so the the last quantity can be just incremented one by one as they get assigned more and more um rating we can calculate it in real time only numerator and divider changes and uh location other notification services and we can uh like basically uh notify all of these 100 driver Riders and then one of them have to accept it and then we are going to assign it yeah yeah okay to summarize till now the restaurant got the order excepted the order then delivery Management Service has to now manage the entire delivery a restaurant all the delivery Management Service now uh the delivery Management Service basically first thing that they have to do is matching so it access the cash the delivery matching service access the cash and then uh ran some algo and basically matched 150 or 100 drivers nearby which is basically a big number maybe in batches say 10 drivers then 20 drivers we basically they will be levels of the algorithm first level we are going to say filter out 100 drivers and notify 10 Riders and if one of them accept it then it is good to go otherwise we're going to notify the next time does that make sense uh K the 150 like where are we getting that from if there are one lakh Riders and are you dividing the city into small regions that's how you're getting 150 per restaurant okay so basically per location right per location like as for the location yeah okay so you're assuming that there will be like we will break it into such small regions the city I mean around the restaurant we'll have this Geo fence let's say where 100 150 people will be there at most okay yeah makes sense correct do you want us to discuss like Quarry again in detail or I think so they can refer to the Tinder match making video and refer this yeah if you guys haven't seen quar guys there's a there's links in the description you can check it out y cool it will help you proximity sense uh proximity information you can get from there okay yeah so this flow makes sense right that we have uh match the drivers and then we have basically send the notifications and now they have to accept and also we have to keep Now tracking the drivers so now I guess we can also talk about tracking a bit yeah we are making quite a few assumptions here one of the things is uh whenever Del management is going to update this cash for uh fairness for the rating of a delivery partner all of that stuff is happening in the background we are not looking into that uh they they're going to be done through API calls where this cache is consistently updated okay yeah tracking I think K is where we are now going to look into whether whether or not there is a delivery going on let's start discussing from why is tracking an interesting problem to solve firstly we have to keep updating the location of the rider in every few seconds right say 2 to 3 seconds we have to keep updating it so how do we do that now there are a lot of ways to solve it like long pulling short pulling websockets uh SEC there are multiple things that come into picture when we talk about real-time communication right so let's what do you think is the best betet over here cor first of all because we're polling every 2 three seconds I have in my personal experience I've seen that the rider on the screen there are in some place and then two or 3 seconds later they move quite a bit and then they move quite a bit so it's unlike Google where you have continuous updates here you have like every 3 three seconds so I I would think it is a HTP request they're polling long polling probably okay uh long polling but because it is basically in every 2 3 seconds you can have a persistent connection and you can keep like uh you know sending the request on over the same persistent connection you can save up uh instead of building the connection again and again you can use persistent connection and till the delivery happens you can keep updating the uh location like that what do you think yeah persistent connection but who's going to have the persistent connection is it going to be the uh the person who's made the pay or the delivery partner it should be delivery partner right yeah yeah makes sense actually not just after assigning even before it like basically every time the driver is available for delivery we should make sure that we have a connection with the driver and we don't have to keep updating it again and again because throughout the day whenever the driver is available for delivery it is going to be we have to track its location right yes so it does make sense right so as soon as the driver basically becomes unavailable we can stop the connection we can terminate the connection but whenever the driver is available we have to make sure the connection is there yeah yep y okay so there's a delivery partner and the connection is going to be with what service G what do you think I think the delivery part if they're going to have a connection it will probably be with delivery management because delivery management might want to keep that info so basically this uh same service itself because I know you hate making a lot of services uh no I yeah but also sometimes it's like totally necessary so for example delivery Management Service I don't know whether what is the deliv Management Service doing exactly it's doing a state transition of the delivery is it order Management Service something like that yeah it is like order Management Service but here basically see the matching part basically this matching service is doing right so rest everything basically this delivery management should be doing uh should it be keeping tracks of all the delivery Partners I think then it it should be some other place like maybe delivery partner where they are uh should maybe if you put it reaction if you think should I just remove this delivery Management Service and directly like it the restaurant should be talking to the delivery matching service the problem with that is a restaurant says Hey I've accepted the order then they say okay I'm ready with the order um so maybe a service should be in between uh whether we put two Services together is the thing but I I think they can be separate because this has totally different logic delivery partner though maybe we can send them to delivery management sorry they'll be matching service directly the one that you have yeah okay okay okay got it to basically to this service so they can also directly keep updating the cache yeah so here we are going to have our persistent connection yeah we can increase the size there's a 14 yeah yeah I do uh making sense right yeah this is this is good uh this is clear that delivery Partners only talk to the delivery matching service and the reason for that is because only the only people who are interested in where the dely partner right now is mostly delivery matching okay and correct when a user when a person wants to see where a partner is all they have to do is they have to ask the maybe the matching service or you can call it this thing can be called a rider matching or Rider Management Service actually instead of BB matching service we can call it Rider management so this you want Rider matching service cool okay this is better now color so so GV has made our diagram more clean uh more colorful and clear cool one thing I'll just do here is I'll just re name this to ryer Management Service uh or I'll just call it ryer manager now apart from this the one thing which is super important during tracking is location so the delivery partner is sending consistently the location to the rer manager I'll just call this Rider and the person wants to know where the rider is right now so where is the rider this can be considered as a API call I just increase that uh okay so now let's describe the API in a minute but if the API can pull the location then the person can see where they are so the writer and the person will be happy so let's increase the size uh in this get Rider location and the thing is the client the mobile client may not know where the user is so uh I have a user ID and I may have a order ID also I think I will and what I'm expecting as the respones I expect a rider location so so this again has to happen in every 2 3 seconds from B delivery Partners assigned till the delivery is complete correct so in that duration also do you think there should be a persistent connection because this has to happen in every two to three seconds no I don't think so uh there's no need of creating a connection every 2 3 seconds we are polling uh people don't watch the entire delivery they just see it for a few seconds and then they're gone so creating a websocket connection is not something I will do I'll just fire a request most of them will drop off in 2 seconds or 3 seconds after watching so HTTP request yeah okay so basically whenever the person opens the map only then this basically this uh this API will be called otherwise you're not going to have the uh basically long polling or web socket none of that you're going to use right yeah this this Rider location will be cached uh I I'll do that by having a cache of Rider ID to location uh and and then we have rating and number of deliv so this part is already taken care of this was the key for the right for the cach so I get the location and this I can what you said does make sense I'm sorry what you said does make sense for that if the user has opens and then closes right but do you think on the client side there should be like a check that if the user has continuously left it open then don't you think it is a lot of load uh that in every 2 3 seconds you're sending a network call and establishing a new uh a new connection no U all of this stuff is cached every 2 three seconds you're sending a a network call is fine if you wanted constant updates like a chat connection or something I would understand but okay now there can be two approaches to this one is if you see that the person has constantly kept the mobile open and you want to send them in a different route that okay this person wants to see the entire uh uh delivery so let's create a connection for them so it's more efficient we can do that I probably wouldn't because 99% of the people are not going to be tracking that Del Partners throughout so we can I'm making an assumption here if I see that the data is more on you know everybody sits and watches the delivery partner till they reach home then yes people create that I mean we make connections default then or if we see a significant amount of you know uh time is taken just through HTTP requests then also we can change yeah right interesting okay got it yeah okay so we have tracking then solved basically a person is asking where the rider is through this API call and getting it immediately matching KY I think you already described really well uh restaurants tell a delivery manager who then inform a writer manager that you know get me the best writers for this uh order get Riders Callen order basically the order contains a restaurant location also based on the restaurant location and the number of deliveries that day and everything else we select the best delivery person assign them to this order and now they can be tracked we haven't spoken about ETA we haven't spoken about routing uh the main reason for that is we can assume that that's being taken care of by some other service so let's say there's a routing service which people can connect with so maybe the rider can connect to a routing service and get the best R so we are actually done with uh Rider tracking and matching this is a super specific discussion I think we didn't get into any of the you know complimentary or auxiliary uh features that we could have gotten into it's a it keeps things focused very often in the interview also you're asked to build one part of the system you're not asked to build the entire system we focused on just delivery right not order management not creating profiles not inventory just delivery for a uh you know large scale distribute system like zepto or SGI or zato or even Amazon in that we focus on just one thing which is partner tracking and matching we did not focus on you know if there's a customer support issue or if there are other issues which come up like for example the route has too much traffic no we didn't focus on that we didn't focus on setting alarms that you know your partner will be delayed and all of that stuff this helps talk about the exact thing that either your team wants to talk about or the interviewer wants to talk about right it's always fun to talk about all the things that we know but to pick the problem and pick a specific part of the problem that is more interesting I think it's also easily sharable for you with your friends guys if you're watching this and your friends are looking for specific system design videos this series is built around that we talk about one specific problem and we solve it so thanks for tuning in and we'll see you next time bye-bye thank you so much

---

## 35. System Design of GitHub Code Search - SDC Episode 1 with @KeertiPurswani
**Channel:** Gaurav Sen | **Views:** 20K | **Date:** 1 year ago | **Duration:** 37:19 | **ID:** hI4_jVFiqes
**Link:** https://youtube.com/watch?v=hI4_jVFiqes

### Transcript:
hey guys this is gkcs we have kti pwani and today we are going to talk about GitHub code search it's very useful if you are debugging something you have a bug you know the log line of the bug all you have to do on GitHub is go type in that keyword and you get to see all string matches and so you can find the log line where there was a [Music] mistake I and K have already written some stuff here so that you don't have to suffer our thought process while we write this down firstly it's an exact search so you don't have things like you know if you're searching for Mouse then I will not search for mice although these two are similar terms GitHub doesn't care it looks for the exact string match also it is not fuzzy search as well it is not just similar words it is also like if there's a spelling mistake also like if it is uh instead of public if you suppose write pbu l i even then it is not going to search it has to be exact search yes yes so if if instead of writing public if you write we miss the B GitHub doesn't know it will search for puc uh not pu LIC absolutely U other types of searches which are more relevant U is all org search meaning all repositories in your organization so for example if you work at Facebook and you want to see only Facebook repositories being searched and then you have a specific repository search so maybe you are an engineer for a particular team they have one repository that they work on or you know you know the repository where the bug has occurred uh you can do a search over there so a single repository search is also possible K have you ever used this functionality I use it very often I also use it very everyone use I think every time you have a bug or you have an issue and you want to search for it I guess we all use it a lot yeah okay few more interesting things before we dive into the high level architecture number one how many files are we talking about right just to get a rough estimate of what kind of search effort do we have to put in so if you look at the total number of files GitHub has roughly 500 million repositories this is public information you can read the GitHub blog Link in the description 500 million repositories means if you assume a th000 files each that's 500 billion files if you assume that each file is really large which is 200 KB uh that turns out to be 200 500 terabytes uh which is roughly 100 petabytes this is a bit of a overestimate or it just looks like a really large number the reality is you're going to be searching in a repository most of the time so when you're searching in a repository you have 200 KB into 1,000 files that turns out to be 200 megabytes and then Ki suggested that we use an optimal order n algorithm KMP to search for a substring 1 MV of data takes around 20 milliseconds so 200 MV of data is going to take around 4 seconds the point of discussing this was just that searching just storing the entire thing as it is and then searching will not be efficient so that is why in this case discussing how are we going to store the data is very very important and uh that's a very important aspect in hld right so capacity estimation gives you an idea that what all things do you have to focus on absolutely yeah a Brute Force approach is going to get us nowhere 4 seconds is not the kind of latency that people are looking for so maybe we can start from there that how are we going to store the code also like repository wise or like you know how are we going to store it because here we said that in a single reposit is 200 million MB of data but then we know that some like they can be hotpots right that some will be huge repositories some will be small repositories so how are we going to store the code is probably somewhere we can start from let's try a basic approach let's say you know this is my desktop or laptop and we write some code here U after writing the code we commit and then we push changes so pushing is going to send it to some server GitHub let's say this is the GitHub file server because we are pushing changes uh okay so we are transferring file data here now GitHub file server has to store this file somewhere so that will be a file system uh let's note that down also when you're thinking about file system uh in cases like this I would suggest that we could also probably mention that we could use a file system like htfs because we get to use the entire Hadoop ecosystem and map reduce and Spark like uh these Tech will really help us in this system right this is a good use case for stfs yeah yeah because there's like you said there's going to be uh search involved there's going to be some processing involved uh and like d stands for distributed so GitHub has 200 petabytes of data to store there's no way a single file server can do that so um yeah totally agreed K this is great idea okay since we are talking about it since we are talking about the distributed part of things um how do we distribute it in a way that is efficient for the GitHub file server uh for this what we need to do is look at how is data stored and how is data retrieved mainly how is data retrieved because storage is there retrieval is often so on GitHub we are looking at the access patterns being for search at least it is get me all repositories in an organization get me for a single repository and get me all public repositories do you want to talk about the API like how what all information we are going to assign and what is expected to come back okay um K I see you have started this do you want to write that down yeah yeah sure what okay so we are doing get uh basically uh search in our repo right okay uh and what all things are we going to pass inside this we'll be definitely passing the word that we searching for yes the repo right and uh obviously the API Dev key uh the like basically we'll have to see whether the user has the has access on yes so user ID also uh then what is I think yeah repo along with that we we also have searches which are sometimes org wide right so do we want two different apis for that or do we want one uh API where we mentioned that this is this like repository wide or is this uh Aug wide I think we can uh use maybe the repo can be a array and so you have for the entire org but then you will have to first search all the repos in that or so the uh and then you know whether you have permission or not so instead maybe you're right or um you know just mentioning or or repo the type is better than sending it as an array correct so instead of repo ID there would be something basically some unique identifier which is going to tell whether this is like a repo ID or an or ID and that will be self-explanatory that okay this is a or ID or repo ID does that make sense okay so you're you are going to have this unique ID and it's going to have something like orgcore maybe the or ID is 1 23 okay okay yeah that makes sense uh stripe uses this it's really helpful for debugging guys and it's really helpful for um you know putting things together so you don't have to add additional parameters or you can always add a complex object but this is this is interesting we also have public searches uh and so like you mentioned kti maybe you can just say p u underscore orgcore so on yeah correct so actually essentially we can focus on one API I guess that that is like if we just talk about how this is going to happen that is good enough right yep yes and also uh since this is a get request I think a very important point that we should be talking about is pagination and filtering right because the response of this firstly can be huge they can like if you're searching for a say common word like include that is going to be there in all CPP files right so the result is going to be huge so how do we return that is also something import is also important so here suppose uh in the header if we have to do pagination we can also be sending like offset and page number that is one thing that we can do uh for pagination and then filtering that uh like when I said word so instead of sending it in payload I could also send it like in the query itself like question mark and search for this word so just fi that that is how the API can look like right yeah yeah I think we should mention that so we have this get request and there we have uh the response object we we should talk about that also but you have already mentioned that whatever be the response you we need some sort of pagination and offset all right so the response uh will obviously in the payload we'll have like a body like in that they will be there and we'll also mention in the headers that what is the uh page number and the offset so page number is the offset and the size the limit the size yeah okay uh KY there's another thing that so when we are getting this you know so what will the response object look like apart from this uh what are the each response what is each response going to look like like if you search for include like you mentioned we get the file name we get the file the line number I think they give you the column number also right so file name and uh okay so there's another thing that we should be discussing like when we search right so do we get the entire file data like because when we search if you say they see only four five lines right suppose in the same file include is used say 10 times right so is that like one search like are we returning the entire file or are we returning like four five lines around that and then just searching for it so even if it is like 10 times in a file like is it going to be one response or is it going to be 10 responses let's see um what I'll do right now is I'll just go to a GitHub repo and K that's a really interesting point I guess a product manager will come up with an answer for this that whether we want to uh see the the text in the response itself or is it okay for us to just get the location and then let's say it appears in 30 locations we query those 30 locations separately in a separate API I would personally choose to query it again yeah uh I'm not sure about you what would you prefer would you prefer to get them in a response or query them again query again you mean like within a file also when there are repeated ones no no uh if there are repeated ones in a file uh yeah I I would like to query because what happens with GitHub search is they give you uh some text before and after after it correct so so those are different responses so when we say give me 10 search results even if it is within a file those that will be like 10 results right yeah if it is within the file then we'll query the file just once and get the entire file and then we will just render the parts where the word exists so that rendering is happening on frint or on backend when so let me take an example so that it's easier for me to understand uh let's say we are searching for video here now you see that this occurs in the same file multiple times and it shows three more matches are there okay um there's one more match in the same file and here it occurs twice so what's happening is it's showing me uh text around the substring so from line number six and I can go and see the file if I really want to so in this rate me like so the 5 to 7 and 47 to 50 are these two different responses or is this one response what I would do is first I would go and ask uh where do they exist the video and it would all be different responses yeah right okay yeah all of them would be like so video is the search string it occurs in read me uh at line number six and at line number 48 and 49 and 50 so and then you know the character number would also be different column number would be something correct correct okay so let me just write it down so basically file name and then row number and column number right so basically within this file what is the uh row number and what is the column number both we'll be mentioning and also data around that like maybe three lines of data yeah if it was me I would actually make another query for this so you would tell me that uh line number seven of contributing.md uh character number let's say 20 starts with video so once I would get this information I would go and query GitHub again stating that you know this is the uh line I want please give it to me that is definitely one approach but don't you think you are adding an additional Network okay there are obviously pros and cons there's no right way to do it but if I do it because when I'm searching I know that I anyway have to show that in response why not just do it like just avoid the additional Network call yeah I would keep this file in CDN so it would be pretty fast and uh Access Control would be there in the CDN the reason I would do that is because I would separate out the concern of search from fetching a file otherwise what I'll have to do is I'll have to join the uh things together on the server side and then return a response I I I I agree with you I'm just for the sake of discussion so that others can also think about it uh I I agree that anyway we'll have to join and send it but even like after we get the file name row column uh okay so okay in the front end if I think of it like this that file names can come and row number but that is still rendering something like that that is the user experience is what you're talking about yeah yeah that so this rendering if it is already done by the server uh it will be easy for the front end but it will put a lot of pressure on the server is what I'm thinking if there's a public so if I'm searching for video uh and I say that you know get rid of this it's not a repo search anymore it's like a public search so there's 46.4 million files uh and I don't know how these guys are going to do the join on the server yeah all right okay so okay so this does make sense okay uh we'll have one API for this and then after from this response we're going to make another get request right and inside this we'll be basically doing fetch file right and here we'll be passing again the user ID and the basically the file name uh the row number and the column number correct and this again we can pass as query parameters yeah and it is going to go to a CDN right okay this looks good um this looks good like we said when we storing file in a GitHub server okay um we have this get request and now we want to get all the row numbers and column numbers so for for a particular um search string so is it okay if I rename this KY to search string sure sure sure yeah there's no way that we are going to wait for 4 seconds so just storing it in a distributed file system won't be enough we will have to do something else so here we have one approach which is basically doing some sort of pre-processing uh when you're searching for let's say include then if you have already processed the files in a way that include is easily searchable in the files then it's really going to help and I think kti you already mentioned this did you uh try yeah yeah yeah yeah so let's say that this is the search engine okay first thing that the search engine needs is it needs to build some sort of a data structure like a tri on top of files so it needs to be able to pull data from these file servers and create a triy so how is that going to look like let's take an example let say we have yeah ah okay a couple of things to consider over here so this try is going to be per repository or per org yeah I I think that's a very interesting question I think if it is per Repository uh it can help us and that's what we need uh if we need it per org then we can just aggregate all the search results from all the repositories that the org has and then return it but if the or has a lot of repositories that will be like again that will be intense so maybe we can cache that result okay so for a single repository we have discussed that okay there are this 200 MB of data uh but converting that to try I think we will be we'll be able to convert that to a few KB which we can easily store in a particular try right so that does make sense yeah the the thing the better good thing about the try is that it doesn't store all the words it just stores all unique sequences in the file so uh let's say let's take the example of include so that it's easy to understand this so when we are uh searching for include we are going to search for I and then we search for n uh meanwhile if there is someone who's uh searching for let's say I equal to so maybe this is a fall loop I equal to Z mhm then there's going to be uh some path for that yeah while include is going to have i n right so and in this way we can have the tri spread out we have i n and then include goes in this direction I and C if it goes all the way to l u d e then we know that the word include exists if it is I and d and then you have I that is India uh that will be a separate path in the tri so this the search is really fast for the number of letters that you have in your search word let's say five you need just five hops in the tree to uh find out whether it exists or doesn't exist in uh in a repository so this is order of length of your search string basically that is how the search is going to work super fast yeah you're right yeah y another very important Point uh guys like just how in Tri structure like in if you have studied in DSA how it is stored that in every trode We have basically a Boolean that is this the end of the word basically is Inc a word in itself or not but here our Tri structure is going to be even uh more smart in every node we are going to have that okay if this is I and D or Inc where all does it exist in which file and what is the row number which is the what is the column number so when we search and when we return the search there itself we can have basically this I in is present in this file name and in this row number at this row number at this column number does that make sense yeah yeah totally totally uh I'm just like noting it down uh so that what you mentioned is even more obvious let's say there is a code file and then you have this at line number line number 30 uh and 120 is the character uh is the column number and then you have another code file which has this at a different location that's what you mentioned right K uh yep yep okay so this is that's a really interesting point you're no longer storing Boolean as to whether characters end here or not or account count also sometimes tells you that you know how many characters exist here you're storing locations because that is what the access is calling for correct okay amazing uh we have this TR data structure which we are storing I think per repository because that is the bare minimum we have uh queries sent to us as search in the entire repository or all repositories of an or or public so I think bare minimum will be for an entire repository uh you have one triy correct okay let's let's note that down if we have it for an entire organization which might have hundreds of repositories we can do the search parall 100 times I think yeah yeah that that would work so parallel search would work and I mean if it's expensive we can cash it also because uh building the try is not going to be very I mean it's going to consume memory so if we want we can aggregate all the tries also all the repositories and keep it for every or we can actually because we're talking about cash we could also cach like commonly searched uh words results like for example error debug like so we could like uh lru cache is a good again this is a very good use case for lru cache it's a good fit over here right anything that is used a lot yeah that is used a lot yeah because when you're writing when you're debugging let's say um you debug for a while and then you're gone you're never coming back so if you're recently being used you're in otherwise you're gone there's no frequency so that's a good point okay we have this search engine which is using tries the question now becomes how does it fetch data from hdfs I think this will be happening like you mentioned uh you know hdfs has the Hadoop ecosystem with it so some sort of map reduce do you want to quickly explain what is map reduce for like beginers or yeah I'm I'm wondering whether we need map reduce or just you know it can fetch a file and create the try map ruce is a generic powerful uh design pattern when it comes to data analytics which helps um take large amounts of data and process them for example if you want to find nearby restaurants to recommend you can use a map reduce design pattern but in this case I think we have already pre-processed it so we might not need it but if we wouldn't have done the pre-processing then it would have been a good fit I guess yeah so okay here's the interesting thing like KY you just brought up a very interesting point we can do this in batch or if when a person uploads a file to GitHub file server maybe they can send an event to the search engine saying that this is the new file please go ahead and add it so that would work so maybe a message itself would work yeah yeah okay and meanwhile this is storage uh if they want this okay so we will probably go for this path not map reduce now we have the search part sorted uh is there something that we are missing uh okay to just revise it quickly could you just tell that okay this is how the get request is going from here to here exactly what is happening because it is happening in two requests right so I guess for further Clarity it will help okay uh right let's summarize we have a code search being done by a person a developer maybe it goes to the GitHub file server here the files are sharted according to repository or organization I think organization is a better idea we can have all the organization files in one place at the same time the file is added in a message CU which sends it to a search engine uh the search engine can maybe you know you just get a event here and then you can pull the file from the uh hdfs then what happens is this new file adds new nodes to the tribe okay maybe new places where Inc exist if you make changes to the file so let's say the file data is updated the same thing is done a new event goes uh the search engine fetches that event and okay that's complex yeah if you have updates can this drive work you will have some deletions and some additions some deletions and additions so basically in that node only like how you have stored right code code. pi and code code 1. Pi like over there itself you could just basically remove and add so yes the uh the if we have to talk about how complex that will be it will basically order of TS plus order of insertions basically yeah maybe in this try you know we can search for all the places where this this file exists we delete all those places and then we uh that would be actually more expensive than the number that depends actually on the use case because if num like how many times like you'll have to go through the entire try right in that case to see where all does code. Pi occur and then we'll have to see is there a change in this line or not that's true we'll have to go through the entire try uh and then find we have to delete this um that's true and we'll have to do it for the org try also if you have aggregated um that that can be a problem meanwhile uh and when we have to uh process that file that updated file newly updated file and go through the try again and add the nodes I think adding or processing the file is easy deletion is pretty expensive deltion requires us to go through everything correct uh yeah I don't know whether we should keep a data structure which is just storing all the positions where this file occurs in this tribe maybe that's a bit extreme maybe not I mean yeah updations and deletions often so it's not it's not something that we can ignore what would you prefer actually if I think about it it is an expensive operation right because if there are like four words in a particular line if I just change one comment itself you're basically changing eight places in a try that's a lot no but we can't avoid that because we have characters I mean the column number the row number everything has changed so I think an easy way to process is just to clean out that file uh in your repo and then you take one step up but the good thing is that you know uh this can happen asynchronously updating can happen asynchronously but because search is a very common operation it does make sense that we store and we optimize for that because uh the updates all the updates like we can do it we can probably use cafka and we can have parallelism over there and we can have basically we can do updates like asynchronously right but it does make sense to optimize for sech yeah so maybe for optimization we can have a mapping of where does this file occur in this TR because one file can occur only in one repo the file is a collection of repo so it can occur only in one try so uh having noting down all positions where the file occurs is maybe a way easy way for us to go and delete uh these entries and then just to reprocess the file so that would also work all right also we could use like a key values to which like like red is which has like basically caching also right which would actually make things very fast for us because Max how big like you know the the length of the try is not the try is not going to be that huge so storing it in a map doesn't make sense like it will optimize things for us yeah we can just read the try into memory and then you know it's going to be like I think an MB at most so cool that is also a lot I think KB is enough yeah yeah and yeah but we'll have to build that structure and then search through it so that'll think order okay great uh we have we have a way for additions deletions updations all of that being uh rendered in search very quickly eventually consistent system works here we don't need to be like millisecond response time we we can show older entries even if they're a few seconds old nobody's going going to you know update the file and immediately search for it so that's good uh finally we talked about this part of the get request is done we are looking at our second get request now which is fetching a file so uh when we fetching a file we fetching it from CDN we are mentioning the row number the column number and the file ID and so we expect the CDN to say okay the previous five lines uh from this row number and the next five lines from this row number is what I'll give you so you can render that uh code snippet yeah okay is there anything we should do here to optimize I mean does it help to optimize should we chunk the file so that you know the row numbers you fetch only those row numbers that you care about or is this network latency much larger than whatever the file size can be I mean it really depends on the use cases we could have something like give a chunk huge files like if the file becomes greater than this size we could chunk it yeah that's that's I think that's a great approach yeah so you have a bit of a hybrid approach where we uh we look at a threshold file size and if file is small get full file else send Chuck so because we are giving them the row number the CDN is smart enough to say that all right do I need to chunk the file and send you just a part of it or do I send you the entire file yeah okay okay and the UI then has to render so it gets the file and it renders on the client okay I think this is it uh do we have any other part to this we're able to store files update them search and then also retrieve the locations yep yep uh I think this does look good okay by the way let's just have a look whether this is what really happens okay the moment of truth let's search for stuff here uh wait we have Network let's clear the network let's search for video okay so we got suggestions again I'm just clearing this out this seems yeah yeah what is this uh responses the entire HTM response okay oh okay okay it's entire oh okay and they're giving you the they're giving all of this stuff yep so it's one instead of us like how we did two queries basically it is I guess one query right instead of two API it's one API yeah yeah can you show the request also like the headers and everything how is it going sure uh this is the request we did a search question mark repo and then the all or I think this is the is the query parameter just like we were talking about yeah yeah yeah and then uh the video Yeah and type equal to code yes you're right okay there might be other types interesting uh and then you have this as the preview so the response is HTML response oh okay and they have bit the whole response and given it back to the UI so it just renders it it doesn't even need to that's yeah okay so in the same uh thing you just get so how GV keeps uh optimizing for the server know that we should not load the server a lot see Server can do more yeah really I I thought that you know they'll they'll make oh look at this in fact yeah it's very obvious here yeah they have even given the dot dot dot has to do nothing yeah exactly and they've given the starting line number uh ending line number jump to line number and they have given the uh position also I think and the end also that's a lot of network call like so much of data being how big is this uh how big is it timing waiting for Server response it took 580 milliseconds that's not much compared to what it could have been because we waited for this and my network also comes in like it's not just GitHub which took 580 millisecs my airel also took some time so yeah cool so in reality it's much simpler than what we thought also it's actually this network all doesn't even exist yeah the second one we had actually discussed the pros and cons about having a second call and uh having one so basically there's no right and wrong that is how GitHub does I sure that they must have thought through more but then this also not wrong this is also like a good design I would say we picked up a relatively simple use case GitHub search and even for that you have to consider how to store files how to update files how to update your search data structures what data structur should we use where do we store the locations where uh substring occurs and what kind of apis we need to design so right really interesting engineering that we are looking at uh thanks kti for picking this and thanks for making this possible thank you so much for having me it is always a pleasure and uh this is a series guys by the way the next video will be on the other channel so make sure you check out the description and all the details are over there and see you next time let us know what other uh topic you want us to pick sure see you bye-bye

---

## 36. Latency Numbers Every Programmer Should Know - 1000x slow-down
**Channel:** Gaurav Sen | **Views:** 12K | **Date:** 2 years ago | **Duration:** 6:19 | **ID:** 4JSN0VpEv2I
**Link:** https://youtube.com/watch?v=4JSN0VpEv2I

### Transcript:
ERROR: 
Could not retrieve a transcript for the video https://www.youtube.com/watch?v=4JSN0VpEv2I! This is most likely caused by:

Subtitles are disabled for this video

If you are sure that the described ca

---

## 37. The Most Advanced Multiplication Algorithms: Why Karatsuba and FFT beat high-school mathematics
**Channel:** Gaurav Sen | **Views:** 5K | **Date:** 2 years ago | **Duration:** 16:01 | **ID:** w8sTGFKLf24
**Link:** https://youtube.com/watch?v=w8sTGFKLf24

### Transcript:
hi everyone this is gkcs in this video we'll talk about multiplication of two very large numbers specifically we'll talk about three algorithms and the last one will be fast for your transform let me give you a warning this video is not for everybody if you are a person who's interested in algorithms in general or a student who's learning fast for year transform then this video will be relevant firstly let's say that you have two numbers and you have to find the result of these two numbers okay when you multiply them the high school mathematics way of doing this is to note them down and then for each digit multiply the other number by that digit so 4 into 219 and 6 into 219 and because 6 is actually 60 so you multiply the result by 10 you take these two results and then you add them together which is an order n operation and the result is 14,16 the time complexity of getting this result was order n Square because for each digit you had to do a multiplication with every other digit of the second number n into n that is n s and this is a rather slow algorithm because you can do this manually of course and it's very easy to understand but the problem here is if you have really large numbers which you want to multiply together in those cases the time complexity of this is going to be very large another thing that you might want to do is compose two functions so you have a function f ofx and another G of X and there are many sound systems AI engines which need to compose two functions together in this case if you have nend features or end points that you need to multiply then it's going to be extremely long operation so here comes the saver karatsuba I thought it's a Japanese guy but it turns out he's a Russian no more but his algorithm stays with us when you you have two very large numbers and you need to multiply them you can actually do this recursively so you take the original number of 219 675 and break it into two parts one is 219 and the other is 675 so 219 is multiplied by 1,000 and then you have the remaining 675 added to it and similarly you have 64456 written as 64,000 + 456 so what's happened is you have taken some part of the number the last three digits and separated them from the rest of the number then what you do is perform standard School operations of a plus b into C plus d is equal to a c plus a d plus b c plus c remember that a here is just three digits long instead of 6 and you know it's an N Square operation so instead of 36 operations you probably going to perform just nine operations for a AC or ad or a BC or a BD there is one problem though as we'll see you take these coefficients use the standard formula and so you have 219 into 64 with 6 zeros in it you have 675 and 456 with no zeros in it appended and finally you have this middle term which is 675 into 64 + 219 into 456 which has three zeros in it in total you're doing four operations four multiplication operations as you can see the color digits and each operation is going to cost you n² by 4 the reason for this is because you have half the number of digits so when you square that you get n² / 2 square which is four but you're doing four operations so it's really not saving anything because 4 into n² by 4 is n² so the order complexity is still the same karat actually went back to this algorithm and at this point said wait I can optimize this further you see the middle term which has as multiplication by thousand that can be improved you don't need to do two multiplications over there in that thousand section instead you can take the left and the right terms and subtract that from the sum of the numbers you don't need to remember this this is just me explaining it so this is a single multiplication operation where you're taking the sum of the two numbers digits wherever you made the partition from there you take the sum and then you do one multiplication of these two sums but the major benefit is that instead of four multiplications you have now converted this to just three so you have now 3 n² by 4 for one split and this is a recursive algorithm right because you can take the multiplication inside which is 219 + 675 and 64 + 456 whatever two results you get those two are also going to be multiplied and again you can apply the KATU algorithm over there in fact you can apply the katua algorithm to every multiplication operation here so the benefit is recursive it's not just n² into 3x 4 it's n ra to the^ log3 with the base 2 which roughly is n ra^ 1.5 now this was further improved by tomb and Coke and it's called tomb Coke algorithm for that these guys actually took the karatu algorithm and made it a more generalized algorithm so instead of taking a number and breaking them into two pieces you can now break them into multiple pieces 21 9675 is broken into three pieces let's say 21 96 and 75 each one having their own exponent of 10 and again 644 56 is broken into 6 44 and 56 the benefit here is that if you break into smaller and smaller pieces overall time complexity reduces having said that there's a large constant Factor here so it's only done for very large number if you use Java it has something called Big integer and big inte teer actually says I use karatsuba initially for medium numbers and for large numbers it uses tomb cook which has a Time complexity of 1.4 64 approximately this is not as important as you might think the constant factor is really large here 1.4 is where you're looking at now all of this is great you can multiply numbers effectively this way but what about polinomial multiplication what about a general equation like a of X and B of X which have to be multiplied to get C of X we talked about certain use cases where you want to compose two functions so in this case you have stuff like this 2 into x^ 5 plus x^ 4 + 9 into x^ 3 and so on multiplied by 6 into x^ 4 + 4 into x^ 3 and so on this is a hard operation because you're no longer looking at just one large multiplication you're actually looking at two functions being multiplied and therefore any point that is spread into this function has to give a resultant product answer so what can we do one thing we can do is start plotting points and basically what's happened now is you look at the first equation and the second equation and you think about them as graphs the first equation can have n number of points plotted for it the second equation can also have n number of points plotted for it and C of X then turns out to be every plotted Point multiplied by the other plotted point a of X for 1 into B of X for 1 will give you C of X for 1 so if you feed in the values of X in A and B you will get the resultant values for C and why are we doing this because now you can get back that equation you can get C of X by using the points plotted over here it's standard stuff for a one degree equation you need two points for a two degree equation you need three points if you have three points on a plane then you can draw a second degree polinomial through it similarly cubic polinomial require Four Points to be plotted with that you can do this now what about a polinomial having n points and for us n is equal to 9 because the first polinomial is of degree 5 and the second polinomial is of degree four so we will need 10 points 5 + 4 is 9 + 1 because you need an additional point will give you 10 in general if you have two polinomial of n degree then you're looking at 2 n + 1 points and so basically if you're looking at a 10° C of X then you're looking at 11 points of a of x 11 points of B of X leading to 11 points of C of X and with these points you can get back the equation of C of X you don't need any more points if you have lesser points you'll overfit or basically have a wrong equation but if you have more points than it doesn't harm you knowing this this is our algorithm or this is our strategy take a of X take B of X find 2 n + 1 points for each map these points onto a graph then take the multiplicate of these two that will give you 2 n + 1 points for C of X and then using those points using interpolation get the equation of C of X it's a rather simple idea instead of working with numerical values you're now trying to plot them onto a graph and then getting the graph points into an equation and because we need at least 2 N plus one points and you know earlier our worst case time complexity was n Square you know that we have to perform better than n square at least 2 N plus 1 points have to be found so each operation in these 2 n + one have to be fast if you're taking order and operation time over here then it's useless because order n Square was there also what's the point of doing it over here Tom Cook will be very disappointed with us so over here the amazing algorithms that we usually have where every point is optimized is not going to happen can't do better than this instead what you're looking at is amortization where the the work you do for some points will end up doing half the work for other points so maybe you find the first three points and that does half the work you needed to do for the rest of the seven and in the rest of the seven when you found the first three amongst them the other three just became apparent this is called amortization where it's not that the work is distributed equally but some work results in the future work being taken care of great example for this is caching or dynamic programming where when you pull out a value it's pretty expensive but future values are fast to calculate because the initial values have already being calculated instead of looking at a of X and B of X which you can't really do much about you look at the First Column which almost all of us miss out on right when you're doing a multiplication of two equations you're not going to think of hey what kind of points should I plot on the graph what should the values of X be should it be 1 2 3 4 5 okay it can be yeah it will work but you can come up with a more clever idea now you need 11 points and you need to choose these 11 points carefully okay so let's just note them down as W1 W2 W3 and so on okay these are substitute values these are are not exactly 1 2 3 4 5 6 what kind of numbers should we choose here should we choose prime numbers should we choose fractions the interesting thing that we said is we want to amortize our effort future numbers should depend on initial numbers and here one idea maybe fast exponentiation where x ra^ 8 depends on x^ 4 being done twice that's an interesting idea where does exponentiation really help you and the answer here is complex numbers in complex numbers let's take an example you have numbers defined as vectors on a 2d plane and it will become apparent why this is so cool because when you multiply two complex numbers what really happens is that the length of these two numbers are multiplied so if that's X and Y then they become X into y but interestingly the angle is summed for every multiplication operation you have one addition of angles and you have a multiplication of the length of these two numbers now we don't want to do multiplications those are expensive so let's just make x and y equal to 1 that means that for every multiplication all we are doing is we are adding this why are we doing this again let's come back to the original point we saw that choosing the points cleverly might help us reduce the amount of effort we need to put in and so that's why we are going for complex numbers where every multiplication can be converted into an addition and also these angles of complex numbers what should we choose them as should we keep it at zero because 0 plus 0 is always going to be zero that won't help much because you won't get any distinct values then what we can do is say okay if 2 n + 1 Roots have to be found let's take the nth Roots at this Point what's happened is you saw that multiplying two complex numbers leads to a rotation and we are saying that we want to rotate 360° at the end of finding 2 n+1 points so that's what this will look like 2 n + 1 Roots where the first number makes an angle of 360° divided by 2 n + 1 second one is 2 into whatever that angle is third one is three into whatever that angle is and so at 2 n+ 1 you have a 360° full circle okay what's the benefit of this why did we choose these numbers we know that the multiplication of these two numbers will always lead to a vector having unit length and the second thing is it has some interesting properties because you're jumping by a particular factor of 360° right if you jump once you get an angle Theta jump twice get angle 2 Theta and you jump 2 N plus 1 times then you get an angle of 360 that means that if you have K jumps taken with this unit Vector so if you have taken let's say three jumps and you have another Vector which is k + n by 2 so if there are 10 jumps in total to complete 360° so every jump is basically 36° if you take three of them 188 de and 8 of them which is 288° right 108 288 are diagonally opposite they're off by 180° so Theta and 180 + Theta when you square these two numbers What's Happening Here is that Theta is being multiplied by another Vector Theta so that is 2 Theta because this is a complex number so you just add the two numbers 2 Theta what happens to 180 + Theta 180 + Theta is 180 + Theta into 2 which is 360 + 2 Theta 360 it takes a full rotation and then goes 2 Theta so effectively these these two numbers which are totally opposite each other when squared give you the same number that's one interesting property this can help and how does it help because when you have a point to plot 2 into x^ 5 plus x^ 4 and so on you can convert these exponents into something like this where you have 2 into X rais to the^ 2 + 3 so halfway is 3 6 being the degree of the polinomial and now what that means is if these exponents start getting squared I'll have to perform lesser operations overall yeah that's the basic intuition the second thing is if you have a unit circle split into eight points and the current point that you're plotting is number two 2 into K divid by 8 K here is 360° so 2 into 360° divid by 8 instead of this I can look at it as 2 into 360° divided 2 into 4 that gives me 360° divid 4 okay so if you split into eight pieces and you're going at the speed of two versus you split into four pieces and go at the speed of one it's the same thing now how does this help again come back to the equation where you're plotting from point number six you have the equation on the right where the odd exponents have been put up and even exponents have been put down take X in common from all the odd exponents and effectively what's happened is you can substitute the value of x² by P okay why am I doing this why am I substituting the value of x square because now I need to go at only half the speed around the circle compared to previously okay remember that if you're going at x^ 8 then you need to take the circle and split it by eight pieces because that's the number of rotations you have to make to complete the circle if however you're going at X squ speed then you're going at 2x the speed in terms of rotations and so P will only have four pieces to the circle again the intuition here is that this property helps me reduce the number of computations I have to make overall combine these two properties help us perform the plotting of points on the graph efficiently so coming back to the original problem you have a of X and B of X and you want to plot 2 N plus one points for each one you see what is the nearest power of two with 2x + 1 so let's say in our case it was 10 I think so we are going to go for 16 and so now you have to plot 16 points on this graph to get back C of X remember that plotting more points is not a problem less points is problematic so 16 points when you need just 10 is fine and the first point will be like this 2 into w^ 5 + w^ 4 + 9 into w^ 3 remember that W is basically the nth root of unity Shuffle the terms put all the odd exponents here and the even exponents here take one common value of w from the odd exponents make all the powers even and just put them one on top of another and now you can substitute the values of x² to p and this is recursive thing because you can take values inside this equation and again Shuffle the odd and even terms the value of P comes in common on the left hand side and all the exponents of P are again even that can be substituted again for Q and so this keeps happening for the second point the third point the fourth point the fifth point is interesting because it has W with the power of 20 remember we need only 16 points so at 20 you have taken a full circle so w^ 20 becomes 20 - 16 which is 4 okay so the numbers get crunched down and so this technique is extremely efficient it actually came out long before the katuba or the tomb Coke algorithm came out 1805 it's by a very famous mathematician Goss if you know about mathematical induction this is the person and the fast for your transform has incredible time complexity which is n log n into log log n log log n basically means you have a number of size 10 when you write down the size equal to 10 you need two digits to say one and zero right the 10 that is log log of the number so it can be ignored it's a very small factor the fast for you transform is n login we are adding this additional complexity because we end up multiplying the numbers on the 2D plane and so those are the multiplication algorithms that you may know about I personally think it is interesting to know about these algorithms they'll help you appreciate some of the contributions that are out there and the second thing is I think it opens up your mind to new things having said that this is definitely not an interview question or something that you want to ask on a test right it's something that maybe Engineers would like to know about at a high level so thank you so much for watching this has been fun for me to understand I I hope you understood if not if you have any doubts or suggestions you can let me know in the comments below I'll see you next time

---

## 38. The painfully outdated practice of software interviews
**Channel:** Gaurav Sen | **Views:** 15K | **Date:** 2 years ago | **Duration:** 7:20 | **ID:** Pu46rRtd1MQ
**Link:** https://youtube.com/watch?v=Pu46rRtd1MQ

### Transcript:
Hi Everyone! This video is more of an opinion piece. I want to share this opinion with you so that I can get your thoughts
and your feedback. Hopefully by the end of it
we'll understand each other and through this discussion,
this community will be able to come up with a solution
which makes sense to all of us. My observation in the last few years
is that softer interviews are broken. They don't do what they intend to do and
they are much harder than they should be. I'll just give you some statistics, Right. The average preparation time for software
interviewers is three months. Three months is a quarter of a year,
which means that if you are starting to prevent now in October,
you will be giving interviews in January. And that's a lot of time, especially if you are in a senior
position. You know, you have wife, you have kids,
you have a lot of work pressure and then you have three months
that you to prepare on. Totally irrelevant job
interview questions. So the process is really, really long
and on the other side, for companies, the problem is
they want people with job relevant skills. They want to test you
on your workplace capabilities. But what happens
is for every open position, they have hundreds of applicants,
hundreds of people who send their resumes. Even if you have an idea sponsored, you have a large number of candidates
who pass this. And as you may feel that this what we do,
this people on is time complexity, which I mean, as an engineer,
you really come across the structures and algorithms problems at work. Yes. If you know it, it's good. But that doesn't mean that
you need to know this to get a normal job. Okay. For startups, mid-sized companies, many,
many positions in large companies, these skills are being tested
by LeetCode right now and HackerRank are totally relevant,
absolutely irrelevant. I'm telling you, as a computer programmer,
there are people who leave their job because what you test
them on is not relevant to the job. They are bored because they like math
and you ask them engineering, they don't care. They're going to leave. They want to research it. That's that's what I have experienced
as a complete programmer and also training as is so much harder. You know, we know nothing about it. So we are here in the job
and now you start teaching us spring and everything else. We don't know anything about frameworks. We don't know anything about you
to be like 40. We like writing binary search, so spend
the next three months not training us. So that's the problem right now. And I'll tell you why this is the problem. I mean, before we look at the future, we just need to look a little bit
in the past to see what's going on. 2000, 2 to 2000. Well, tech, Heidi,
usually used to be around MCU. You would be asked questions
on a programing language like what does this keyboard do? Or if you write this code,
then what has happen? Talk about exception handling. Talk about what volatile means in Java. So this is more knowledge based. There's nothing that has been tested. You are not asked to demonstrate
your skills. In 2013, things changed. What came in was the idea
that you could remotely execute a candidates good at very cheap rates. So a candidate can come in,
write some code, and you can test this on your server
to check if the code actually that's you could also set time limits
to see whether the board is efficient. So problem solving is something that
you could check out really efficiently. This is also the time
when a lot of computer programmers started doing really well because they would
practice with remote code execution and they could solve problems efficiently
and give answers. So computer programing
became a way to get jobs, which is funny. Like, but this is what happened. The tool
which came out was an automated test, so you could scale hiring
using this in software engineering. Now, in 2024, this method is broken. There is little to no relevance
that computer programing has to your daily work. And when you are talking about it,
it caused problems medium hard. It's more of a joke. You can also ask people, you know,
how many petrol bombs exist in your city. It's an estimation question. It's a question. It is objective,
but it has no relevance to your job. It has nothing to do with your workplace
capabilities. So what can we do? How do we hide the right candidates? And this is where we need a tester
which is automated so that it can scale. And it has like zero bias, which tests
candidates on their engineering skills, like making sure that systems
don't collapse, like making sure that concurrency
is both implemented and managed. So make the engineers think like people who are writing API contracts,
implement those EAP contracts and then bring in real world
engineering problems to the tools that they're like, okay, this is the next generation
of software interviewing. And so instead of awarding them, it's
going to be a software jungle. And at the start of my book
interview, ready, we have two tools which are going to be
testing you on your engineering skills. And the way does
it is by asking you to write code. You write code and the code has to be 5000
if things fail, if the system that you're connecting to
did not give it a sponsor, it was to still you have to do something about it. You either have to give a retry
or you have to propagate the error back. Okay, So we'll be testing you on that. There's another type of thing. If the system is a little slow, then shouldn't
you apply some sort of concurrency? You shouldn't utilize our resources,
your network to the maximum. So we are going to be looking at
is in both programing also the second thing is a system design judge. The first version of this system design
judge is already available at interview Ready. You can try it out now. I'll have a link in the description
by completing this design. You know exactly what each component
means. So that is the definition. You understand
what the meaning of a component is. And the second thing is
you know where to apply a component. So if you see something missing and you
add a cash to it and you see it's correct, then you not only know what the cache is,
but you also know where the cache is applied. The future versions of this tool
are going to be even more advanced. And the longitude for
this is 21st November. I hope to be able to get your feedback
quickly. So, you know,
we probably started the beta program and you can share your feedback with us and then we'll go back and forth
and back and forth. There's a lot of people
in India and abroad who are not able to crack interviews because the interviews
are totally irrelevant to their job, you know, And in fact,
they don't even find a place where they can bring themselves
better for their job. They don't have mentors. There's an accent problem.
There's a language problem. If you build tools,
which is going to test them on that job, relevant skills,
then they can train them themselves. They can self practice
with this kind of a judge. And for companies also, it's great because if you're doing things
which are relevant to your job and because of that, you get the next job,
they save on costs. So I've already spoken to people
from the Indian Mobile Congress who will stock up school from more than 50 companies right now, and
most of them are super excited about it. But I take it with a pinch of salt
because being super excited and actually signing a contract
are many different things. But, you know, I've had lots of people
from various companies, including Fang approach and say that this is something
that we absolutely need shows a demo is that. Thanks so much for watching.
I'll see you in the comments. And amongst them you want to choose the candidates
who have the right skills, but to engineer these skills are like,
can they write fault tolerant code? If the database crashes, can
they do retry making sure that the code is not only logically correct,
but when it runs valid is still correct? And finally, efficiency. Efficiency doesn't necessarily
mean time complexity right now. You know, we try to excuse ourselves
saying that or by doing it, such as not go to these problems,
we know about efficiency. No, you don't. Practical efficiency is very,
very different. I'm not even talking about cost here. I'm talking about literally value programs
or concurrency. None of that is tested right now
in engineering. This. Okay? There'll be a lot of people
who'll argue with you that, hey, all the research papers
have been made on that. You know, there's deep engineering involved
and you need these data section algorithms for them. I have two things to say. One is that you have centered
your yourself research, deep research. That's when you need algorithms. So it's not required for every entry level
position that you're looking at or even for a senior engineer
like you don't need that kind of thing. Secondly.

---

## 39. How ANOMALY DETECTION works in time series using the Holt-Winters Algorithm
**Channel:** Gaurav Sen | **Views:** 6K | **Date:** 2 years ago | **Duration:** 4:30 | **ID:** 57gdH1n0yg0
**Link:** https://youtube.com/watch?v=57gdH1n0yg0

### Transcript:
hey everyone here's a simple algorithm to detect anomalies in your system if you have some metrics that you're tracking as you can see here you have an X and A Y axis where the Y is plotting values and X is on time so every second we are plotting a value initially it's 100 and it goes all the way down to zero now you can think of this as video retention time so for a given video in the zeroth second there's 100 people watching out of 100 and in the 100th second there's nobody watching because the video is like say 100 units long now the challenge is how do you find interesting anomalous points on this video now you can do this manually you can look at instant number 84 and see that there's something odd over there despite the entire graph being a smooth decline there seems to be a bump over there so maybe there's something interesting happening there maybe something confusing because of which viewers are watching that again and again but this is a manual pattern matching task which cannot be scaled out so what you want to now do is find a mathematical approach for detecting anomalies and the approach is simple you want to find points where change is odd okay where the change is not smooth it's a spike or a weird opposite direction change so the first thing we do is we start noting down the changes in this graph so for every point we see whether there's an increase or a decrease compared to the next point now the entire graph is smooth and you're seeing that the slope is negative which means if I take a Dy by DX if I differentiate this graph if I try to find the rate of change in user retention then I'll get something like this which is roughly constant yeah you see most of the graph when it comes to rate of drop off or the Velocity in physics is constant now in some businesses you have consistent rate of increase depending on the number of users you have so for Facebook when you say Network effects uh if 10 people join it's easier for the 11th person to join and when the 11th person joins it's even easier for the 12th to join so at this point you see that there is some sort of acceleration it's an exponential growth and this is common if you have some sort of social network or referal program right so what we can now do is differentiate this rate of change again to get acceleration so at this point it will be something like what is the change in drop off that gives you this acceleration graph which is roughly zero in some businesses which are having exponential growth like we said this acceleration may be non zero but it's going to be a flat line because acceleration usually is constant if you have a stable business it's supposed to be constant but good thing is if I differentiate this graph again right I have done three differentiations till now one is velocity one is acceleration and now the final one called in physics jerk is a very weird graph any nonzero value here means that there is changing acceleration and if you're in a bus and you have a sudden jerk that's where I think the term is inspired from you have a jerky reaction and so the non-zero values you see here correspond to anomalies and have a look at time stamp number 180 you'll see that the original graph showed that there's something odd there and the anomaly has been detected at that time stamp so now mathematically instead of manually you are able to detect anomalies you can do this through a computer which is just going to differentiate the graph again and again till it finds anomalies and a better example would be over here you can clearly see spikes in this graph you differentiate it once you get this pretty spiky graph in terms of velocity also but like we said we are doing this in a mathematical way so we just differentiate it again get a super spiky graph in terms of acceleration and finally the last differentiation gives us all these anomalous points we can have a threshold value after which we report these points these jerky points as anomalies so you can see that again time stamp 80 time stamp 30 and 48 are pretty strange and the original graph shows that so this is how you can detect anomalies in real time if you're more interested in observability anomalies logging then a new chapter at interview ready is coming out which is going to dive into this in detail that will be released on the 5th of November and I hope to see you there all the best I'll see you soon

---

## 40. 20 AWS services you should know [as a Software Engineer]
**Channel:** Gaurav Sen | **Views:** 32K | **Date:** 2 years ago | **Duration:** 19:33 | **ID:** tNbMyQGGyYM
**Link:** https://youtube.com/watch?v=tNbMyQGGyYM

### Transcript:
hi everyone this is gkcs in this video we'll talk about the most popular AWS services that you should know as a backend or even front end engineer the reason I'm saying this is because if your organization uses any Cloud solution provider you'll be able to relate to this video and if you're thinking of starting up then this video should be very relevant to you because many of the services that I'm talking about will solve problems that you're looking to take care of on the tech side so by the end of this video hopefully you'll not have to reinvent the wheel and you'll also know how these Services work internally by just going through the links in the description all the best let's start number 20 Neptune Neptune is a version of neo4j that is managed by AWS and the benefit of this is apart from it being open source you have NE 4J having clear apis well documented apis AWS manages the deployment of new 4G you can scale easily you can set up alerts alarms you can monitor performance you can easily take care of Hardware faults software upgrades are taken care of everything which is standard in a Cloud solution provider is wrapped around NE 4J and provide it to you the reason I'm putting it at number 20 is because it's probably the least likely thing that you're going to be ending up using unless you have a need for a graph database unless you have some sort of social network or location based application you don't really need to look into it you just need to be aware that AWS has a solution number 19 Cognito Cognito is aws's authentication mechanism authentication basically means that is this person who they claimed to be so there are many ways to do this one is single sign on SSO there is oo which is extremely popular there's JWT based authentication this is again very popular but as an engineer you probably don't want to get into this you don't want to reinvent the wheel you can use AWS Cognito to make sure that authentication happens seamlessly and is entirely managed Again by AWS making sure that the scale and the right security mechanisms are being used number 18 time stream time stream is a Time series database offered by AWS I'm not sure exactly what they're using underneath is it influx DB is it open tsdb or is it their own database having said that it doesn't really matter much you can fire queries on this database to to slice data across time common problems with the time series databas is you need to get aggregated metrics you need to be able to get the recent metrics quickly and so time stream is a wrapper around all of these complexities provided by AWS along with of course all the Cloud solution provider benefits that you have it can Auto scale it has software upgrades everything number 17 open search open search is a teex search solution provided bys it uses elastic search underneath elastic search as you know scales really well it's got some amazing algorithms to find a substring or a text which probably exists in some other document so if you're writing any kind of a search engine it makes sense to have elastic search if you're also trying to find let's say common comments or discussions that you want to bring up in your search elastic search is a good option AWS makes a rapper around it charges a lot of money but you know open search is something that may make sense if you are a search first application if not there are ways to write simple queries and try to index things in a relational database also but if you have decided to go go ahead with elastic search then open search is a pretty good option number 16 Lambda Lambda is a way of saying serverless in AWS serverless for those of you who don't know is basically you have servers which you don't know about your code runs on a server that server is being managed by AWS if you write serverless functions the idea is that if a incoming request comes to AWS they're going to take your code bring an instance which can run that code accept this request process it and give a response all of this seamlessly it might look like magic like okay you have an incoming request and in real time you bring in some compute power to answer the request at the scale of AWS this is roughly possible also of course there are many optimizations around this you might have a very small instance running requests and as the number of requests increase you can scale this easily so Auto scaling is perfect when you have Lambda the only drawback though is that Lambda tends to be a little more expensive than taking an ec2 instance with reservation so it's not an on demand instance you have a ec2 instance that you have taken for 6 months or 12 months so you pay accordingly but the cost of a ec2 instance is much cheaper than a Lambda having said that if you're a startup and you want to quickly grow then Lambda makes sense because you really don't know how much the scale is going to be initially so Lambda can take care of the scaling problems and also the uncertainty problems while you focus on the business problems number 15 Kinesis Kinesis is something which is very commonly used in medium to even small organizations where data exists right uh if you have users performing certain actions those actions can be mapped conceptually into events so a user clicked on this button make an event out of it and send it to a stream you can think of a conceptual wrapper around it you can think of a stream of events that are being sent to this place that is kinesis the destination of these events will be some sort of data store so that is usually a file store system which is S3 and then you can run analytics on top of these events so how many users have clicked on this button in the last 7 days and are from India this is a pretty expensive query you probably don't want to hit your main database with this so so instead you have these events that are being streamed into a file store and then you want to run analytics on top of it number 14 Glacier AWS Glacier is a solution for people who store a lot of data sometimes you store data for auditory purposes making sure that you know you don't miss anything but you never going to read this data I mean even if you read the data having a 24-hour latency is fine so for example if you have any compliance issues the police comes to you and says that I want all Financial transactions of this person so it's okay if you can respond in 12 to 24 hours now this kind of data is not beneficial to the bank it's just being stored for compliance reasons it makes sense to store it in cold storage places which are going to be rarely accessed very cheap hard drives as long as the data is guaranteed to be durable and so Glacier is extremely popular when it comes to storing less frequently used data another use case is when you have a high quality High defin video let's say you are live streaming a cricket match and so you're getting 8K footage but maybe nobody in the world is watching 8K video Even if you can have the 8K video Seen On TV you don't want to give them the 8K video because it's going to cost a lot when it comes to bandwidth requirements in these cases you want the original footage somewhere just in case but at the same time you want transformations in different resolutions and formats of this video being served to users so the original footage is then stored in glacer and the copies are stored in S3 or even kept in a video cache and so Glacier is a popular solution for storing data that will be less frequently accessed number 13 simple Q service sqs or simple Q service is basically a q service if you have worked with message cues then sqs is probably what you want to go for it provides functionalities of pushing to a queue and pulling from a queue very useful if you want to have a set of Publishers and a set of subscribers if you're going for event driven architecture again the benefit of sqs is serious because it's a reasonably cheap solution and it scales very well at this point in time if you're using Apache Kafka to manage your event streaming sqs may be a alternative that you can go for Kafka has many features built on top of it and it has certain benefits I would say the documentation around Kafka is also pretty strong but as a startup you don't really need those many features so uh you can go for sqs number 12 data migration service DMS or data migration service is surprisingly useful because in the life cycle of an organization it's inevitable you have to migrate your data from one place to another and this is probably the scariest kind of operation that you can pick up because as an engineer if you screw this up not only can you have your customers feel upset because they are not able to access your website but you can actually lose data which is terrifying it's not just losing customer data which is a problem but you might put your whole system in an inconsistent state so managing this is a challenge and doing this manually is firstly prone to error and secondly very tedious so DMS is a solution that AWS offers to move data from one place to another seamlessly and if you're a medium to large organization it makes a lot of sense for you to just utilize this solution which is given off the shelf if you're a startup maybe you will not be able to aail this solution frankly because DMS is available for large Aurora instances and we at IND could not use it but if it ever comes up it's going to be a very good day number 11 Dynamo DB Dynamo DB is a very famous Solution by AWS but I don't know how popular it is amongst small companies so I'm putting it at number 11 the basic idea is it's a database which is a nosql database it can scale enormously well there are some other benefits also you can actually have multiple indexes in this database one is a partition key which helps you understand how you're sharding your data and another is a sort key which helps you order records in a partition of Amazon if you don't know these terms check out the links in the description sharding is well explained on this channel and so is indexing and so if you need a nosql datab base it makes sense to just use what AWS already offers you Cassandra is let's say heavily inspired by Amazon DP which is fine right there's an open source solution out there and then there's a close Source solution which is built by Amazon the thing which might Val of it is cost in fact AWS also asks you proactively to go for an SQL database instead of nosql database if you are a startup and even a kind of a midsized organization so that's the reason why this is at number 11 otherwise it's an amazing solution for large organizations number 10 elastic cache elastic cach is a super easy to understand solution it's a very common solution also you just need a cash so why would you write your own cach just use awss cache it is compatible with redis it's compatible with me cach two most popular cash implementations out there in the world and the benefit of this is it's fast it's scalable everything standard with a Cloud solution provider only drawback that I would see is sometimes if you're looking for an in-memory cache and you want very high control or you want your own custom algorithm maybe you just want to write the cash yourself that's what we are doing at interview ID also the startup that I'm working in but if I needed a global cach there was no way that I would deploy my own or you know go for a third party solution I would just use elastic cache number nine simple email service simple email service uh has a sister which is called Simple notification service both of these are extremely similar they let you connect with customers with end points through awss apis and if you're doing any kind of marketing or you're sending an OTP to people through email SCS is probably the cheapest solution you can get you can host your own solution also there are open source Solutions which do that but again the problem that I see with this is that you need your own devops you need your own optimizations SCS is entirely managed scales really well we use it for for our marketing campaigns we use it for the otps that we send to verify email addresses and even if you send it like 50,000 emails together SCS is smart enough to scale quickly but also patches them internally so that your request passes up to SS and then it manages sending those emails I also mentioned SNS which is simple notification Service uh the idea here is very similar it sends smss to people if you want to send marketing smss then I think you need permission from some place but if you're sending transaction smss like OTP it's very easy to do number eight elastic load balancer elb or elastic load balancer is a very common popular Solution by AWS heavily tested is really easy to set up the basic idea is you need some sort of a load balancer in your system as long as you have more than one server and so even if you don't have a server and you want to just be sure tomorrow you want to build a cluster of just one and have elastic load balancer pointing to that cluster head it's usually a good idea because you can scale quickly the load balancer basic job is to take incoming requests and decide where to send these requests elastic load balancer is probably the solution you want to go for please do not build your own balancer if you're using something like engine X then that's great you can go ahead continue using it but if you already have elb then most of the problems are already solved here number seven Cloud watch Cloud watch is a complete solution by AWS when it comes to monitoring and logging so if you have certain Services which are running in AWS you don't have to set up monitoring by yourself cloudwatch is already doing that for you automatically so when you take an ec2 instance it's not like you have to tell that please track the amount of memory that I'm consuming or please track the number of iio operations I'm making it's amazing cloudwatch automatically tracks that and logs it the other thing that you can do is set up alarms in cloudwatch so if you have a problem if a server goes down or something you can get a notification on a channel like slack and you can just go and quickly restart that instance the other thing that cloudwatch offers is logging this is very common for engineers to debug or Trace problems if you're running multiple servers it makes a lot of sense to have a centralized place which takes all these logs cloudwatch provides that but even if you're running a single server it's very easy to just integrate your log wherever your persisting logs that log file to a cloudwatch stream and then you can comfortably watch it without having to SSH into a box you can just go to AWS and look at all the logs in one place number six API Gateway API Gateway is a solution that we have already talked about in one of the videos before you can check the link in the description the benefit of this is that you can expose all of your applications apis in one place manage all the versioning and scaling automatically so it's a very commonly used solution and that's why it's at number number six it's pretty high up there number five Route 53 Route 53 is the DNS solution provided by AWS this is absolutely essential if you have a startup which is using ec2 instances and maybe a UI which is deployed through AWS S3 without R 53 you don't know what IP address you have to hit when you hit integrated. so if you purchase a domain name let's say xyz.com that domain name has to map to an IP address a public IP address that people can hit to now this IP address happens to be an instance of awss because you have taken the solution from there the mapping can be done by you manually but it's much easier to just offload this again to AWS and say that in case you change things behind the scenes automatically my users should be pointed to that IP address through domain name servers and that is managed entirely by Route 53 from AWS number four cloudfront cloudfront is a CDN solution provided by AWS the basic ideas is these are geod distributed caches so if your users are split in India and us and you serve movies to them the movies which are popular in India may not be popular in Us in fact the movies which are popular let's say in Maharashtra may not be popular in Telangana so you have different regions inside a country and what you really want to do is you want to take data which is relevant to those regions and move it as close as possible to the region itself that is a Content delivery Network yeah you have distributed the data according to their relevance what you don't want to do is you don't want to build this yourself of course that makes no sense but even a third party solution like Akamai although it is great has certain setup challenges that you have so in instead Cloud front is extremely easy to set up all you have to do is you have to use the file store S3 set up the files and the entire bucket which is like a folder in S3 can be picked up and moved all around the world through this CDN solution number three RDS RDS or relational database service is basically database service if you have some sort of SQL data that you want to store or something that you understand quite well where you can run SQL queries easily then you are looking for RDS it's compatible with post Grace and MySQL when I say compatible means that you can run my SQL and post Grace and internally whatever data structures that they're using can be used by post Grace so you as an end user only care about persisting and retrieving data you don't care about which instance is storing it and stuff like that on top of this there are multiple options that you have when setting up RDS you can do this over elastic block storage you can use Aurora which is more like a design pattern of databases you have high availability and high durability because you're using multiple instances when you're using Aurora it's a bit more expensive because you know you have six copies of the data distributed around the world but it is worth it if you care about your data in a serious way uh so we currently use Aurora at interview ready and we have found it to be totally seamless there's never been a problem with persisting data or making sure that it's available number two S3 simple storage service or S3 which is the more popular term is like a file store internally you don't know what it uses because it doesn't really matter all you care about as a end user is that if you store files or any kind of data in S3 it stays there right it's highly durable and the other benefit about S3 is it's extremely cheap not as cheap as Glacier which is a variant of S3 but it's so cheap that it makes sense for you to take all of your analytics records and just persist it over there if there are certain logs that you want to purist persist in S3 there's video you want to purist persist it in S3 S3 is extraordinar cheap very reliable scales almost infinitely you probably use it currently or a similar sister solution from gcp or Azure number one ec2 ec2 is the backbone of AWS it basically is a server service if you want to run your code you have to run it somewhere so a server is the kind of place that you run your code in and then you need file storage over there so you need a place to store your code you need an operating system which is hopefully already installed so ec2 is the building block a server in your architecture ec2 has many variations also inside it this is primarily because different companies have different kinds of use cases so a wants to provide you as much options as you possibly can have and also confuse you along the way maybe there's general purpose instances which is probably what you want to do as a startup you don't want to you know make too many guesses but there's also memory optimized instances and there's compute optimized instances so if you need a lot of memory in the instance that you're running this is possible if you have a lot of static data right you want to cach everything then you want to go for a ec2 instance which is memory optimized and if you have a lot of computation that's happening so you have maybe not that much memory that you need but you're performing some computations which are massaging the results and giving responses then you can go for a compute optimized instance again just to be sure unless you are absolutely certain that the data that you are dealing with is of a particular type a general instance is what you want to go for as a startup you might also go for a Lambda solution a serverless solution like I said ec2 has many benefits but those benefits also exist in Lambda and the major benefit of Lambda is you don't over engineer or you don't over provision or underprovision Lambda Auto scales very easily you can also apply Auto scaling to ec2 but then the cost differential is very low between Lambda and ec2 so these are some of the services that AWS provides that you should know as a software engineer the benefit of these is quite obvious they are managed entirely you can focus more on engineering or business problems instead of devop and Hardware requirements in an organization even large companies like Netflix and Raaz a pay use AWS behind the scenes to make sure that they don't have to worry about everything under the sun when they're running their businesses for small and medium organizations it almost makes no sense to go ahead and have your own managed instance I know that zeroda is a exception to this but zeroda has an extremely strong technical team and the choices that they have made may not be aligned with what you believe or what you're doing currently in general the best idea seems to be to offload the problems that you're currently facing in terms of tech to AWS or gcp or Azure the most popular solution out there is AWS and so that's the one I recommend so thank you so much for watching this is all I have for AWS Services many of these Services can immediately be integrated in your organization very quickly AWS is very well managed scales very well has perfect software upgrades has a lot of benefits because you can also you know monitor your services automatically and if you ask me there are very rare cases where you need to manage your own instances in this day and age instead of just offloading all that problem to Cloud solution providers like Amazon web services if you like the video hit the like button and if you want notifications for further videos like this hit the Subscribe button I'll see you next time

---

## 41. System Design of a Startup: How to host a website with AWS
**Channel:** Gaurav Sen | **Views:** 23K | **Date:** 2 years ago | **Duration:** 20:01 | **ID:** M3PWvOETU4g
**Link:** https://youtube.com/watch?v=M3PWvOETU4g

### Transcript:
hi everyone this is gkcs in this video we'll be talking about how Tech runs in a startup if you're running a small organization or working in a startup or small organization you should find this video extremely useful if you're working in a large organization then some of the principles that are being spoken of here will be very relevant to your engineering or product managers I'll be taking a war story which can help us understand how a typical startup works this is specific to interview ready which is a edtech startup but most of these learnings can be generalized and used in your own team or organization so let's go back to 2019 September this is roughly 4 years ago and I was working as a software engineer at Uber but I also had this side hustle or passion of teaching computer algorithms and system design on YouTube eventually the channel became large enough for me to decide that this passion of creating videos and making them as concise as possible and easily consumable and all that good stuff is something that I can make a company around so the first thing you need to do to make this work is actually have a website and a website is nothing but a namespace like interview is a namespace you you can purchase it you can rent it out from people who host Nam spaces so you can think of people having addresses all around India and someone having a registry of everybody's address so Yellow Pages or Google if I want to connect to a person I have to go and read this book now one thing you can do is you can charge me every time I read the book but people don't like that so instead the person pays to have their address hosted in the book interview ready goes and pays somebody a company so that users can find them in this book very similar to how Yellow Pages used to do things and my company's name was integr doio that got registered on GoDaddy and then what happens is if anyone Types on their browser interview ready then GoDaddy says oh I know who you're trying to connect to here's an IP address which actually hosts interview ready so that IP address is of course provided by me I say that if someone is trying to connect to interview ready just hit them on this IP address now that's the easy part what should that IP address be hosting our server something which can be spoken to you know you can fire HTP requests on the server and get some responses and also there needs to be web pages that people can see on their browser so who's going to do all that now I could create web pages and host them I could also have my own server you know local server and host it but that would be Madness or I should say that would be Reinventing the wheel which AWS or Azure or gcp have already made the crazy thing is I don't even need to host my server on AWS I can take this entire problem of Hosting videos login and log out and payments and go to a known solution provider and these Solutions were being provided off the shelf by a company called think they would charge you a particular commission for every person who would sign into to your website and I think there was something else also there was a base rate that they would charge but it was much lesser than me going and hosting an entire website because I'm alone at that time it's a one person company hosting courses then was managed by a server in thinkific people would connect with the server because the DNS pointed over there and for static Pages which are website Pages there was a CD again managed by thinkific which people could connect to and download the web page so all the static images and text content can be picked up from here all the dynamic content of login or writing comments would be handled in the server which would be backed by database surely now this led to serious problems uh I I should say good things also before I start with the problems the good things here of course were that I had to manage very few things I didn't need to manage servers I didn't need to manage video hosting I didn't need to manage uh web pages and I didn't need to manage payments support to some extent was handled already and many of the features that come up with the built website were there some of which I was not using but then they were there I could expand into that now let me come to the problem firstly payments was a real big issue think if it supported only two types of payments and PayPal was Indian stripe was an international payment I couldn't change payment methods if there were payment failures I couldn't do anything about it I would have to personally ask people to go and pay on my PayPal link and this is a real big problem because many of the Indians who were coming they didn't want to pay through PayPal they wanted to pay through UPI or any other method while the Americans who were coming in wanted to pay through PayPal okay this might sound like how is this a tech problem well it's a problem which will take down your startup if you're not serious about it customers are not going to be interested in the tech at all they are interested in watching the videos so initially this payments itself the whole thing is a problem the second part was that the website was absolutely horrendous okay and I'm a backend engineer I suck at design and I'm even worse maybe at implementing the UI pages but that doesn't mean that the customers have to suffer because of my incompetence what I really needed to do was to make web pages responsive and good for incoming customers and that meant that I would probably need to Outsource this problem to a freelancer or hire someone full-time who would maintain a website the initial approach was to actually hire a freelancer for about 1 month to redesign the website so from this CDN host hting all web pages by thinkific we moved to our own CDN solution which was AWS Cloud front okay it was backed by S3 which are which is a file store and we made our web pages there which were far better much more appealing for users they were also a little mobile friendly and the other thing we did is we took all server calls directly from thinkific to our own server okay we put our server in between we said that if you ever need to make payments we have razor pay PayPal strike just register on our website and once you made a payment we are going to be redirecting you to think if to watch the videos okay it was a seamless integration and users would hardly come to know that you know there's something backing this website but even the simple rapper give us a lot more control we knew which users are coming on the website they're dropping off more Payment Solutions were provided our own CDM was hosting web pages so we could SEO on them more effectively we could change web pages the way we wanted and it gave us the confidence to say why do we even need think if when we have the engineering talent to actually build it ourselves so then we set up a cicd solution which is continuous integration continuous deployment the basic idea is that every time you write some piece of code you want to actually test it on prod or staging before you work on the next feature it's probably the most important part if you're thinking of anything Tech in a startup constantly when you're making changes you want to see the changes happening and being rolled out to your customers okay you don't want to make a deployment once in a month or twice in a month because the changes then are very large especially in a small fast moving organization so if you set up cicd this might be a Jenkins thing might be through GitHub actions that's how we do it every time you merge something to your main branch you're going to see changes on your website which is absolutely perfect because of this we were able to quickly move features out of thinkific into our own platform it gave us a lot of control and we were more confident about writing more features now because we were starting to get practiced in Tech the next thing that came up was simplification why are there so many moving components in this system can't we just put them all together the microservices and the databases we had around different things different business requirements payments discussions we all moved into one thing there a now and we entirely got rid of thinkific we just moved out all the features from thinkific and added them to our current database we also added a cache before crunching the entire architecture to make it much smaller right our ec2 instance was I think medium or large I think it was large and large was like ridiculous like you don't need that kind of scale with 15,000 users I think at that time we had something like 3,000 users so we decided to move to medium and from medium we have actually I think moved to small now so we have 15,000 paid users and small works perfectly fine there's no shame in saying that that oh I need a small server you can take it as a matter of Pride that it's so optimized that you need a small server and the second thing is we had this cache which is also an external cache and we decide to move this into the server itself you don't need a redis deployment you don't need anything outside you don't need elastic search you can have it in the database just keep crunching your architecture till it becomes simple to understand and also everything is put in one place the deployment Cycles become easy bit of a hard lesson but it was a worthwhile lesson for us looking back also you don't need crazy tools like there's a tool called pager Duty it makes a lot of sense for large organizations but for a startup if you have a problem slack should be enough interesting business use cases or even Tech alerts can be sent on slack so maybe your instance is having more than 50% memory consume send a slack alert someone made a payment but record was not persistent in the DB send a slack alone your team will be there somebody is going to look into it and solve the problem the same idea was also applied in MailChimp it's a marketing platform you moved to Amazon SCS it was much cheaper log rocket was another solution it was like pretty expensive I think I think we were paying at one point almost 20 or 40,000 per month and Clarity is just free so now let's see how code is actually deployed and reaches end customers the funny thing about this is that in large organizations this process is so smooth that Engineers are not even aware of what's going on in the behind scenes you know it's abstracted out so when you merge something to the main branch it just happens by Magic but we'll see what's under the magic right here firstly you have a code repository for us it's GitHub if you're writing front end code on GitHub we have a workflow file which pushes this code to S3 S3 is a file store you can think of these as some Cloud Server storing your files in directories and we have a directory for interview ready UI which actually takes these files just replaces everything because we did a g pull now S3 is globally distributed but it's not as fast as you would like it to be it's not on the edge as much as you would like it to be so what you need is a CDN or a Content delivery Network solution these are servers which are distributed all across the world if you're looking for some sort of static content then these are really fast they give you responses really fast you might know about arami but again we are using mostly AWS Technologies here so from S3 we publish these pages to cloudfront and cloudfront has a really weird URL it's like d44 cloudfront neck nobody in the world can remember such a complex URL so of course you want a easily visitable page and so your DNS server the thing that we talked about earlier from Gaddy has to point to this cloudfront URL because that's where your web page is so people who are going to interview.io are saying give me a web page for interview.io and what needs to happen then is the DNS needs to say go to this CDN solution you will get the web page and again because we are using primarily AWS Technologies we have moved from the goary DNS resolution to Route 53 which is a DNS solution provided by AWS important to note here is that the domain is still owned by GoDaddy so I still have to go and tell GoDaddy that hey please point to Route 53 which is AWS and route 53 then says okay I know where interview.io is it's in this cloudfront solution this is how a person accesses the front end of interview ready the UI Pages similarly when you're writing code for the back end this is a separate repository again hosted on GitHub you have a event listener running on ec2 so an event listener you can imagine it to be like an API endpoint you make a request that hey there is some code change and then this server says okay code change has been noted I'll do a git pull after you do a git pull you of course restart the server and your job is done it's as good as a deployment you also need to go and tell the DNS again that if somebody's trying to access the server of Integrity not the web pages but the server trying to hit an API then we have configured it such that it is api. integrated. i/ the service name and so on api. integrated. needs to be an IP address and that IP address has to be stored in Route 53 but to bring in some fall tolerance and to bring in some read Direction in case you want to add more servers ever in a startup what you can do is have some sort of a load balancer in front we are using elb uh which is elastic load balancer in Amazon again all of these Technologies the things that you see in colorful boxes are all Amazon okay the icons are also picked up from them the basic idea is when a person tries to connect to api. inter. they'll go to the Route 53 server that will tell them please go to this load balancer and the load balancer will say all right fine go to the ec2 instance so that explains how the front end and backend code is being deployed important to note is that as Engineers you don't really care about load balances or the DNS these things are done manually by the IT team in a startup that it team is us but every time you're writing code you don't need to care about hey is the elastic load balancer on or is rounde 53 working you just push code to the main branch and the moment that happens it's going to be hitting an action listener is what they call it on ec2 and you can assume that your code is deployed okay now let's look at the entire request flow end to end of a person coming to a website initially they type the URL on the browser uh that goes to Route 53 53 then says okay go and hit the cloudfront solution because that's where you'll get the web page the web page in itself may have components or iframes that it's loading from Vio that's loading from S3 S3 is the file store that we talked about it doesn't just store web pages it can also store any kind of PDF files image files that you have which you may want to share with the user so this might be a profile image also also you need some sort of integration with any kind of payment Gateway that you're going to use for example stripe PayPal razor pay they give you client side code that you can load in that sense of course there's a lot more complexity there's Google analytics that you want to bring in you might have some SEO tags and all of this complexity is wonderfully encapsulated by the front end which loads different frames loads different tags based on what you want but at a high level these are the pieces of technology which are there in the front end now coming to the back end if you're performing some sort of action on the UI let's say you're trying to log in it needs you to go and hit an API on the backend so first you go to Route 53 ask that you know I'm trying to connect to api. inter. Route 53 says go and hit the load balancer it knows where you're trying to connect to the load balancer then takes this request forwards it to the ec2 instance that we have ec2 then may or may not hit the database okay we also have an inmemory cache like we said earlier we don't have a global cache redis and this RDS instance is managed by AWS so we are using postrace here and a managed postra instance the benefit of that is replication is managed there's a cluster for read and write and if it goes down then AWS says that fine I'll bring it back up if you're going to accept payments then you need to integrate certain payment Gateway apis we use stripee razor pay and PayPal the interesting thing here is that if your API call to razor pay is taking too long that is okay razor pay can come back to you by hitting your web hook web Hook is like an API that you are exposing so you're saying accept payment to Razer pay Razer pay will process the payment and after some time hit an API of your own it may not give a response to the original request or it will give a response saying that okay fine I got the request I will process it later here there are some product issues which can come up a client who's just made a payment is looking forward to accessing the course and it may take up to like 3 or 4 minutes for them to get course access which is not a big deal but it is possible ideally what you want to do is you want to choose gateways which do this very rarely and all three of these are quite rare when it comes to a delayed payment interestingly if a person is hitting your web hook and saying that the payment is successful then how do you ensure that this is really strip or PayPal sending that payment notification because if I'm able to get your web hook then I can just hit that address and say gorov has purchased the course and all my friends have purchased the course like 100 more people the reason this is a little secure is because you have something called a secret stripe gives you a secret saying that you know when I talk to you I have my private key I'm going to sign this request with my private key and you can ensure that the person talking to you is strip because my public key is published in the world you can have a look at public private key at interview ready a lot of the security mechanisms are already covered there for marketing we use SCS which is simple emailing service in fact we have marketing email sent through Amazon pinpoint which is a service on top of SCS if you're directly sending emails from the server use SCS if you're going to be sending campaigns or well caught through HTML emails you can use pinpoint all of these services are monitored by cloudwatch cloudwatch is a service again provide by AWS what it does is it monitors the health and metrics of these different systems you can also publish logs on cloudwatch that's what we do through ec2 and you can set up some sort of alerts also like I said we have have simple slack notifications but you can I think also have SMS and email notifications telling you that something is terribly wrong so finally you move from this architecture to this architecture as a startup founder or as a person working in a small team you might actually prefer this I personally would also prefer this but this complexity brings in some benefits one is control you have individual control over each of these components and if you see that there's something cheaper out there or something better out there you can just move that component out and bring in a new one the other thing like I said was cost cost is significantly lower for these kind of architectures because when you have a managed solution they charge a premium but when you have components individually being managed by you the benefit is you can see how your website behaves and based on that choose the kind of technology that you need I'll take an example E2 instances some are intensive in terms of IO some are intensive in terms of memory for a edtech website nearly all the requests you'll receive are going to be common okay for a social networking website you have different posts different comments different likes for different people you have to give them different recommendations so caching is beneficial but caching is not universally beneficial for an edtech website it's pretty much the same content for everyone so if you can cash all the content and all the comments on that content very rarely do you need to go and hit your database so you can have memory intensive machines which will end up costing you a little lesser than otherwise similarly emails if you are going to use a service like MailChimp or a service like let's say HubSpot their charges are very very large significantly higher than Amazon pinpoint which is in my opinion as good as MailChimp I'm not very sure what exactly you need to do with the marketing thing of course you should compare these Technologies yourself but in terms of cost I don't see anything cheaper than Amazon SCS with that in mind why don't we just take our payment gateways get rid of it and have our own payment Gateway why don't we build one that is a problem because the kind of Regulation you need over there the kind of complexity that you bring in and the security mechanisms for these payment gateways is significant having said that though Banks provide pay payment gateways now to end customers like us so we might make that decision that why do you need to use a payment Gateway for the rest of your life directly go and hit the bank I have seen the rates it is cheaper and it makes sense at our scale though the cost of 10,000 or 20,000 rupees more is not worth the headache that we'll take to migrate from payment gateway to the bank's payment Gateway and so there are five main points I want to leave you with the first one is iterate don't do everything together do it step by step improve versions second one is work with what you have you don't need to bring in more Technologies you don't need fancy techy thing to solve a problem it's possible that you can have a simple piece of technology which is going to scale tremendously which is up to one lak or 10 lakh users so you don't need to move third think Beyond Tech it's not necessarily that every problem has to be solved technically that you need a server with an API which is going to automatically find the right solution it's possible that you do something manually it's possible that you don't do something it's possible that you do Outsource something a lot of this is around solving problems but not necessarily through Tech so you're focused on solving problems but it's not Tech problems that you're looking for fourth is estimations if you're unsure about you know is this going to scale what's going to be the cost like isn't this something I should move inhouse estimate estimate for the next six months don't estimate for the next 5 years because your startup may not exist then and finally you have Outsource if you can Outsource a problem and it turns out to be cheaper just do it yes I said things about control yes I said that cost usually is lesser if you bring things in house but that does doesn't mean that it's always going to be the case sometimes when you Outsource something the initial cost is so low compared to you building the solution that it makes sense to just Outsource and see what the cost is going to be like it's easier cheaper and maybe a little less lost opportunity if you go for outsourcing your problems at the start so thank you so much for watching this this has been a rather detailed video on how startups work when it comes to the tech side of things if you have any suggestions or would like to discuss this further I'm in the comments below you can share your thoughts and opinions I would love to hear them until next time see you bye-bye

---

## 42. 20 Whitepapers that changed the world [For Senior Software Engineers]
**Channel:** Gaurav Sen | **Views:** 142K | **Date:** 2 years ago | **Duration:** 17:25 | **ID:** WWGM4hY34pI
**Link:** https://youtube.com/watch?v=WWGM4hY34pI

### Transcript:
hi everyone this is gkcs in this video we'll be talking about 20 white papers that you must know as a back-end engineer especially if you are in a senior engineering position or staff level position the benefit of reading a white paper is that you get to know the implementation details and the Practical aspects of Building Systems so most of the trade-offs that are chosen when building a system come from the product requirements of the system in the case of these white papers the product requirements are being decided by other Engineers who will be using that system for example you have the system at meta which is called memcached like it's an open source software which Facebook has modified for their own use one of the problems they're facing was scaling so they need to deploy many nodes of map cache challenges of routing routing one thing which came up was should you choose sharding over redundancy sharding basically means you have a key space and that key space is divided into sets each set is given to a set of servers and redundancy means that you have the same key space being handled by multiple servers simultaneously the problem here with multiple servers is that they may be eventually consistent and also the cost of managing multiple servers for a small key space as you see this problem is not as big as the other problem of starting for Facebook because they had a concept of aggregate queries so when a client request would come for let's say the profile the profile also had friend connections it also had likes on a post a news feed so it was a complex query hitting multiple shards and so splitting the key space would have only made things worse for them so this is an example of one trade-off each of the papers that I'm really talking about are really interesting and you should have a look so let's start number 20 monolith this is a real-time recommendation system white paper this is from Tick Tock their Engineers have found a way to give recommendations to millions of users in real time so one of the problems with any recommendation algorithm is you have a set of users you have a real-time component to it and a batch component to it but the recommendations in the real-time section are not very good model that found a way to embed features of users right the basic idea here would be that gaurav likes to watch let's say chess videos and a person who likes to watch chess videos may also like to program so an embedding can be thought of as a point in a n-dimensional space gaurav has a particular age so that is the x-axis gaurav is a male that's a y-axis gaurav is from India that's on the z-axis like I said he likes watching chess videos so probably you're watching chess video maybe a alpha axis and so on you have n dimensions in this gaurav is a point and people who are close to him usually tend to watch the same things how do you efficiently embed gaurav in a space and also give him recommendations is a serious problem in many of these useless news feed applications so as an engineer it makes sense to look at the kind of scale that you're dealing with 19 flexi raft this is a paper by meta it's a very interesting paper because when you look at the raft algorithm you have this concept of Quorum where a majority of the nodes agree on a particular value the problem with this is scalability if you you add more and more nodes a majority of those nodes have to agree on a value it's not easy to do and also it doesn't make sense when you have a globally distributed system the Indian servers have to agree to the U.S server's value maybe the Europe servers also have to come in so a global system of Quorum is not what you're looking for you're looking for a tree like structure where the Indian surgery on a particular value and they have a leader who talks to the leader of the US who talks to the leader of Europe this tree hierarchy also needs to be roughly consistent so Facebook has come up with this algorithm called flexi raft it's really interesting to look at I think it will also give you an idea of how raft Works internally or if you are really into it paxos we have discussed that in interview ready also pretty useful to know how this good consensus Works number 18 is spanner spanner is also around dispute consensus but it's around how a database can work how it can give you strong consistency guarantees how it can offer transactions and spanner is a very popular example for a Geo distributed database which is strongly consistent and also highly available Google has spent millions of dollars making sure that their clocks are all in sync and it's a feat of engineering which is worth looking at spanner is expected to survive the worst of faults even if things are on fire there's an expectation that spanner is going to be up so it's good to look at what kind of fault all mechanisms Google has employed number 17 Minesweeper Minesweeper is again meta it's a root cause analysis system you can imagine this to be something which identifies what caused a problem so you have anomaly detection if you have any kind of a smooth graph if it's a straight line one differentiation will make it flat if it's a parabola two differentiations will make it flat but if it's not if it's a very complex graph with anomalies three differentiations will show you all the problem points okay and you can catch them and say that these are economies once you have detected these anomalies how do you identify what caused the anomaly you are probably going to look at factors which are highly correlated to the graph that you're looking at a change in the contributing factor is probably what has caused the final change that you're seeing in your business Matrix if you see sales are low but actually what has really happened is Landings on the website alone then you should probably focus on The Landings instead of trying to fix Minesweeper is an automated system it's really interesting to think about how much automation can help you for a startup of course it doesn't really make sense because you can do this manually but in medium to large organizations it makes a lot of sense number 16 Cassandra Cassandra is an extremely popular database it talks about how the database uses the cluster architecture the gossip protocol how it chooses certain trade-offs like consistency or availability however Frankly Speaking did give me Vibes that you know it's an open source clone of Amazon dynamodb it's totally fine I mean I totally understand open source Technologies are very important it's important to have these possible solutions for us small companies to leverage but as a white paper yes it probably is not the world's best white paper having said that as an engineer it's worth reading number 15 Foundation DP Foundation DB is really interesting because the kind of testing techniques that they have employed to make sure that their transactions work in this nosql database are novel right the stocks also on Foundation DB other thing is that it's a key value data store so that's the most popular kind of data store when it comes to you know SQL databases and it's worth the read when it comes to highly consistent systems which are also scalable and it's a paper by Apple so there's some diversity in these white papers number 14 Amazon Aruba Aurora is more like an architecture pattern that Amazon uses when it comes to managing databases so the key factors here are scale Amazon wants to scale enormously and they also want to give you very high availability so how do they ensure that how do they add and remove nodes seamlessly how do they also hide the complexity of Aurora from their clients you want to give some sort of customizability but you also don't want startups to break their heads while using your system so it's an interesting set of trade-offs that they have picked up in this paper and it's definitely worth reading number 13 tackle brackle is a system by Google this is a graph processing system it's not necessarily maintaining graphs but finding patch atoms in graphs so page ranking algorithms finding out interesting websites ranking those websites all of this is usually done in batch it's a very old system by Google which gives a good idea of how it probably works behind the scenes once you know this you might have a decent idea of how SEO works for Google in fact some of the aspects for the pregnant people are very practical so it makes sense as an engineer to read this quite well number 12 Apple Dapper is another system by Google it's a tracing system if you have a request which is going through possibly hundreds of services then it's very difficult to trace that request to find out what happened at what point in time Dapper is probably the first step when it comes to root cause analysis for example you probably can't take all requests you want to do some sort of sampling of requests you don't want to log every line of the request you want some points which when reached trigger an event and say that okay this thing happened to this request okay especially at scale it doesn't make sense to log everything one interesting thing about Dapper is that whenever a system tries to integrate this service engineers at Depot check whether you are hitting it the right way because you shouldn't be impacting the rest of the services at Google so it's not just code reviews now it's actually inter-system code reviews number 11 chubby chubby is a system very similar to Apache zookeeper Google came up with this system for disputed locks and that's a fundamental component of any kind of transaction or any kind of leader election that you have internally it employs paxos paper doesn't talk about paxos anymore instead it focuses on the Practical as of implementing such a large scale distributed Locking System for example what do you do you probably use a file system to manage the logs you need some sort of notifications to be sent whenever a lock is held or released if you want a high level understanding of paxos interview ready has a lesson on that 10. mega store mega store is a data store at Google which provides relational database semantics so Google usually goes for nosql but Megastore is a highly scalable highly reliable system which gives you asset transactions and also an rdbms like feel it's interesting to look at what kind of trade-offs they have made here again and also how they've tested the system how they make sure that what they have built actually works in such a large environment what I found interesting was that internally Megastore uses big table which is a nosql data store how do you map rdbms to a nosql data store makes you feel like how databases actually work you have a very simple let's say Hardware system or a file system which is back all of your data even in the database so how do you build relational data on top of something which doesn't provide you that right how do you build indexes so Megastore is definitely worth it number nine big table big table is a fundamental database solution for Google it's a nosql data store it's actually something which Powers many of the systems in Google including I think the search engine you have multiple versions of the data that can be stored so if you have an older version of a page and then you have a newer version of the page you can have all of that in one data store called bigtable many of the principles of bigtable like hot shots and keeping multiple shards consistent is now considered common practice but when it was made it was a really big deal and of course the ideas are very intelligent it's a very practical database solution that Google came up with at a time when nosql was not a very common solution number eight map reduce the map reduce architecture is one of the most important core architecture pieces that any data engineer or software engineer can look at as the system scale you have very Services storing data and this data needs to be processed for analytics reasons recommendations sometimes just for storage archival how do you do this efficiently with commodity Hardware more than a decade ago when Google came up with a solution of mapreduce it was extremely normal and very intelligent in fact immediately open source Solutions started coming out using this kind of an architecture which is absolutely amazing if you have seen Apache spark or Apache Hadoop they end up using mapreduce or some variation of it internally it's a must tweet for engineers who should know about this architecture because some of the concepts are in fact now used also in programming languages Java has this concept of mapping filtering reducing and at interview ready we have explained this architecture in detail number eight Google file system this is probably the world's most popular technical white paper when it comes to software Engineers Google file system is a way in which Google stores data it doesn't necessarily need to be file data bigtable for example uses Google file system so it forms a basic layer on top of other high level system and for Google I'm sure it makes a lot of sense to build their own file system how do file system is something you might have heard of there are tremendous similarities when it comes to Hadoop and Google Google came out first and I think Hadoop has taken inspiration again which is totally again like I said fine you you need open source Alternatives and solutions for your own systems but the original paper is very well written uh it's very easily understandable and the trade-offs which are made to ensure that this file system is consistent and performant makes a lot of sense it's a must read for engineers number six Tau t-a-l or Tau from meta is a very interesting system which is basically an in-memory graph database for meta it makes a lot of sense to have an in-memory graph database because they have the social network that they want to pass to map this information you could use relational databases you could use nosql databases you can try to hack your way through through adjacency lists but none of them really work at scale so instead they have a dedicated in-memory graph database called Tau and some of the Practical considerations when it comes to keeping this data consistent and highly available are absolutely amazing tau is I think an engineering Marvel like you should as an engineer definitely read up on it number five memcached memcached is an amazing Solution by Facebook the best part about this is the practicality of their decisions I think we touched on this earlier but there's a ton of of trade-offs and a ton of optimizations that Facebook has made on memcache should you use TCP or UDP well it depends on the situation should you go for sharding or application like we said it depends on the situation here they chose the application so there's a ton of trade-offs a ton of practical applications that memcache at Facebook has and the white paper is definitely worth the review it's probably the top five papers that you can look at number four Monarch Google Monarch is a Time series database the reason why I'm mentioning this so high up is because Monarch is again a very practical database something that Google uses at scale with very high reliability to monitor their systems Monarch is expected to run even if all the other systems have gone down including their database if the database is down Monarch is supposed to say hey the database has gone down now how do you do that right because to some extent you are going to be tracking your patterns and anomalies through database graphs so you have to keep everything in memory and as a Time series database at Google scale that's a ton of memory that's in petabytes the byte paper is absolutely amazing it's definitely worth the read number three gorilla DB gorilla DB is not a database it's an in-memory database you can call it a cache and it's a Time series database Facebook again does something similar to in fact you'll see them come up with the same logical conclusions both companies Google and Facebook created their own time series database Monarch and gorilla and then eventually they say that we are going to be doing something different so Facebook says the recently timed events are the most important ones and Google says I'm not going to make that assumption and because of that they have trade-offs they make architectural decisions which are different right but Facebook for me I I find them really interesting in the sense that they they choose performance very often they choose practicality very often for a startup it makes more sense or they resonate more with me so their white paper was a personal preference I think Monarch is of course engineering by is more of a marble I would say but yeah gorilla is definitely both leading behind the scenes it uses open tsdp so it kind of cheats on the persistence side and it's in the top three papers that I would go for number two Amazon dynamodb this is a very popular database Solution by Amazon in fact I think it propelled their engineering Fields complex algorithms like resource level algorithms so when it comes to Mercury to make sure that data is moved from one place to another consistent hashing and all of this actually implemented dynamodb has extremely high levels of availability it's very performant its consistency is also pretty amazing and it's a solution that is offered by AWS to everybody in the world it's one of the most impactful papers in the world so it's worth looking into number one what Zanzibar this is a system by Google it's been open source now the reason I'm mentioning Zanzibar on top as the best paper probably that you can read there are so many practical optimizations made by Google to make sure that their authentication system runs efficiently the algorithm for authentication you know the the data schema or the apis is just hardly one page that's the idea that this concept then comes optimization or optimization or optimization and I'm like really impressed by Google that they made this open source that you can actually use this 90 you probably either won't need it or you can just go to gcp which probably uses it internally you don't really need to build it but the aspects around rate limiting the aspects around fault tolerance when it comes to Zanzibar are absolutely mind-blowing some of these Concepts I had explained at interview ready in the rate limiting chapter the first one and then I got to see that Zanzibar is implementing them in reality and at scale right so it's interesting to see how Theory meets practicality but but when you are at let's say a billion users making billions of requests per day it's definitely worth the read for every engineer do check it out so that's all I have for the white papers that you should read as a software engineer the papers are neatly organized and put in one blog post the link is in the description do check it out let me know what white papers you like with a short description of why you like it maybe you know it talks about trade-offs practicality the scale the ease of understanding the paper and if you found something particularly interesting we can actually have a discussion on them in the comments below until next time I'll see you bye

---

## 43. Design Patterns for High Availability: What gets you 99.999% uptime?
**Channel:** Gaurav Sen | **Views:** 32K | **Date:** 2 years ago | **Duration:** 13:08 | **ID:** LdvduBxZRLs
**Link:** https://youtube.com/watch?v=LdvduBxZRLs

### Transcript:
hey guys this is gkcs in this video we'll be talking about availability in dispute systems specifically we'll be talking about how to make systems more and more available this is something that Engineers fantasize about but the idea also is that we want to bring in some practicality keeping in mind the cost and the complexity that you introduce when you're trying to make your system extremely reliable or extremely available now depending on your organization you may find certain levels of availability acceptable for yourself if you're a startup or a medium-sized organization I mean to say a thousand to one lakh users usually two nines of availability which is 99 to four nines of availability is totally fine you have scheduled down times you have unexpected down times 99.9 is let's say the minimum if you have three and a half days when your system is down it's really going to impact your reputation even as a startup people will consider you know if I purchase this thing for three days in a year I won't be able to use it what if those three days are when I really need it and also of course you lose customers the moment they see that your page is down they don't say okay I'll come back tomorrow they just say oh okay let's never come back here again for medium organizations having a downtime of one hour a year is totally fine you may have the scheduled downtime you may have it unscheduled people will not be too upset with you for such a problem the way you do this is making your systems highly reliable either using a Cloud solution provider or investing heavily in your own engineering this means that you remove all single points of failure through redundancies or cluster architectures and most importantly you have monitoring systems which ensure that you are able to catch an error quickly and then look at resolving it finally you have mature companies who are highly reliable this is at five to six nines Finance is I think a practical situation where you have Google Facebook Amazon five minutes of downtime a year is fine worst case scenario you're down for five minutes it's not that big a deal you can also aim for six nines of availability which is almost no downtime in a year if you spread across the entire year then a person may not even able to understand when the system is down they're just going to hit the refresh button and see this website is back up they'll feel like oh it was a problem with my network connection instead of you know your server after this comes a little bit on the theoretical side for app developers but it's very practical if you're building a pacemaker or some sort of a medical system which I can't go down for three seconds also right if your heart starts beating for three seconds it's a really big problem in that case you are looking for very high level of availability in fact zero downtime systems is something you might want to look into a GPS is an example of zero downtime system you also have predator drones which are flying around in the sky if they are knocked out for a minute then they're just going to collapse so in these cases zero downtime or very very low downtime systems is what you're aiming for so how do you choose what you should do let's take a what story let's try to understand what concepts or principles we should apply when we are faced with this situation practically this is our startup interview ready we have one server which is running a monolith application we have one cache which is an in-memory cache so the cache also runs on the server there's no radius or anything we have CDN yes that is cloudfront which is backed by S3 and most importantly we have a database which is postgres and this server was hosted in the US the reason for this is basically we did it wrong as a startup we were trying to spin up a database and we chose USA region yeah that sounds pretty fast let's just add it but most of our customers are from India if there are customers in the US we try to Cache responses in memory and serve them quickly but since 60 to 70 of all requests come from India it makes sense for us to have the database in India to reduce response latency so what do you do so at this point we made a decision to migrate the database we had in the U.S to India and here's the step-by-step process the first thing we did was to test whether this is possible on staging so the database in U.S was migrated to a staging database in India and this went smoothly this was not very hard we had to read some documents in AWS and we took about a day to do the next thing we did is just migrate the database from USA to India keep in mind that this is not real time because this Indian database now has all records up till this point but the server is still pointing to the US database so all new users are still being onboarded over there you just have most of the data the last two years of data all in India but two years and three days is now in U.S so you're missing on those three days and so these databases are not consistent at this point there were many ideas to improve the consistency between the U.S and Indian database one of the ideas was to keep a trigger in the U.S database which says whenever there's a create update or delete in this original database you can send that request to the Indian one another idea was to use a third party change data capture solution uh the idea was to use a AWS in-house data migration service but we kept things as simple as possible we'll run an SQL query later yeah we don't need a trigger we don't need bin log from MySQL we don't need anything just need a simple SQL statement now we need to switch this pointer in the server from the US database to the Indian database so the second part of the migration comes in which is downtime so what we did is we first saw how much downtime do we need to migrate all the records for like a day from USA to India and we saw that it's a startup it takes less than a minute but of course we connected with users and said that you know there'll be a downtime 15 minutes took some buffer and then we updated the website Banner saying that you know the website is going to go down in three hours and then 2 hours 59 minutes and then so on and so forth we also had a email notification that we sent to All users timely chose was pretty interesting we chose 2 pm Indian time week day interview ready means that people are preparing for interviews they don't usually do that in office at 2 pm right lunch time so that was a good time for us also everybody in the USA is sleeping and everybody in India is awake but they are not working on the interview preparation the benefit here for us is that our team is well awake so I don't need to call them at 2 am in the nighttime necessarily and the fourth thing is we had a war room a war room is a place where all of us get together for us it was a slack huddle where we ensured that the things are working fine finally we made this transition from the US to Indian database and here we kept things as simple as possible a single SQL query migrated all the differential records from USA to India and then we killed the USB database we saved some costs there now if you're looking for principles that highly available systems employ here are five which can really help you the first one is Simplicity or Perfection you don't want zero downtime system for most applications you don't really need it or there is absolutely no difference between the data here and the data here even for a split second you don't need that you don't need that kind of consistency in certain cases you can take down your system for three hours and nobody will notice or in certain cases you can take down your system have a crudely eventually consistent system running in place maybe your cash is serving all the requests and nobody will notice the second thing is downtime over loss if you're going to have data loss as a result of some flashy algorithm it's better to sacrifice availability than durability in general users like their history or their data to be recorded in your system they're okay seeing the system is down for five or ten seconds but they're much less happy if they see that something that they did has been missed also you want lesser moving Parts generally what happens is whenever a person is thinking of high availability they just add more redundancies like okay this is going to have a primary replica architecture this is going to have another failover under the backup if you have many moving Parts in your system often what ends up happening is the chance of it failing increases and usually redundancies don't bring in an increased chance of failure but they're useless what you ideally want to do is keep your system again as simple as possible so the number of lesser moving Parts you have the number of lesser things you have to think of the more reliable your system is the fourth idea is relevant to medium to large sized organizations in my personal opinion right it's chaos engineering or practicing failure a concept has been popularized by Netflix who say that if a part of your system fails that is perfectly normal in fact it's so normal that you should practice taking down a part of your system take down one server in your system right that's chaos monkey take down a region in your system okay that's that's I think chaos gorilla and then you have a bunch of these failure tools which you can employ and consistently your system is made to fail to check whether it can recover from that failure in production in this way of course you can be extremely sure that your system works under heavy load or unexpected circumstances for a small organization like a startup it's best to either take these benefits from a Cloud solution provider like AWS or you can ignore it for now you know some downtime for a startup as you see is maybe not that big a problem number five is incident reports and root cause analysis this is usually useful for large organizations where the context is sometimes lost or there are lessons that you can derive from every failure in Google or Uber or Facebook whenever there's a issue a report is made in which a detailed analysis is given as to why this incident happened there are some techniques for this like five wise and the root cause is identified the idea is to tackle the root cause of the problem not necessarily the symptom but the core problem creator let's say you have this system where clients are connecting to your server which is backed by a database and one of the clients has an issue it cannot connect to your server because of some Network problem practically as a person if you have a problem with one of your routers at home you may have a backup router which you connect to or you connect through your mobile network networks also use backup routers which redirect your request to Any Given server so let's say you're trying to connect to IP address 1925200 if one of the routers which promised you a path to that address fails then you can try the next router which says that yes I also have a part to that address so the idea here is redundancy if something fails then you have a backup route one thing you have to consider is cost there's lots of algorithms here minimum spanning tree includes planning tree with faults many practical aspects of graph algorithms can be brought into networks networks are a mature concept and because the costs are so high for getting the routes slightly unoptimized also that it makes sense to use these algorithms here but concept is pretty simple you just want your systems to work with the minimum cost possible and low latency of course you can also have a problem in one of the components of your own system let's say your server crashes here the usual idea is to have some sort of real-time redundancy which means you have multiple servers which are serving requests and if one of the server crashes or is unable to respond to your request you retry to another server a concept of retries here but there's also the concept of load balancing the Indians are probably connected to the Indian server if they are unable to connect then they go and hit the US server the benefit here is that you can add and remove servers from your configuration dynamically here so if there's too much load on one of the systems it dynamically routes to another system finally you come to the most dangerous kind of fault that you can face as a engineer which is your database is collapsing so in that case usually you have a redundancy mechanism which is a replica so while this DB is running it constantly sends messages to a replica the replica is consistent with the primary database so when there is a fault the replica can be promoted to primary and the server can redirect all requests to this replica which now takes all read and write requests the benefit of this is that the switch is really fast it's a very common architecture so most Cloud solution providers provided I wouldn't say most I would say all Cloud solution providers which are worth using provided AWS gcp everybody does in fact many systems also use this read replica they don't let it go to waste you have servers which are connecting to this read replica to do select requests on your database I know there's a create update delete you send it to the primary always you could also go for a cluster architecture here in databases this is the main idea of distributed systems most nosql databases provide this Amazon dynamodb Cassandra one of the problems with this is usually these systems are eventually consistent and they also have their own set of complexities as a small company or a startup you don't really want to do this but yeah as a large company it makes a lot of sense to invest in these kind of solutions now another place where there may be a fault and your availability doesn't really matter is caches so if your cash let's say is not responding to a get request it's all right you know you can call the database and get the request you're basically paying more money you're having high latency for doing this kind of an operation but in some cases that's okay you expect the cash to recover by itself if the cash doesn't recover you can rebuild the cash just restart the server which is hosting the cash or clear the cache using some sort of remote procedure call to the server and you're back in business so that's it for availability in distributed systems this is an interesting concept if done right then it can really help you if done wrong it's a bit of a problem and as an engineer it makes sense to either reuse some of the already highly available systems out there and if you can't then it's good to have a principled approach to this problem thank you so much for watching let me know if you have any doubts or suggestions you can leave it in the comments below until next time see you bye

---

## 44. Tech that DOESN'T WORK for Start-ups and Mid-sized companies
**Channel:** Gaurav Sen | **Views:** 20K | **Date:** 2 years ago | **Duration:** 11:49 | **ID:** AkQ9YVp21C8
**Link:** https://youtube.com/watch?v=AkQ9YVp21C8

### Transcript:
Hi everyone. This is GKCS. In this video we'll be talking about some
of the less useful tech advice that is shared amongst all of us engineers, especially for startups
and mid-sized companies. If you're working in a large organization, most of this advice will
not be useful to you. So you can watch this as a
entertainment piece or as something that you could possibly find
useful when you join a company. At the end of this video, you should have a set of red flags
which go up if someone mentions one of these jargon pieces to you when
you're working in a small organization. And this video will really be successful
if by the end of it you have a general red flag, which goes up whenever a person talks
about things that you don't really understand are in hype and
seem to be useful possibly someday in the future. So let's start
with some pretty bad tech advice. Number five, containers. Containers fall perfectly in the category
of, it could be useful sometimes, but it's probably not
going to be useful to me. The reason I say this is because
containers have amazing facilities when it comes to autoscaling, when it
comes to complex deployments, when it comes to scheduling deployments,
when it comes to managing a cluster, none of which are usually relevant
for a startup or a mid-size company. The only place where I
have found containers to be
actually useful is when you have a team of let's say five or more
developers who are locally testing code. And for them to deploy it
locally becomes a bit of a hassle. So you having a container which you can
share with them and they can deploy on the local machine and test helps. So all the best practices for containers
may not be relevant for your startup. In fact, I would say it's highly
unlikely to be relevant for your startup, and it is unlikely to be relevant
even for a mid-size company. The drawback here is that containers
usually add a little bit of complexity to your architecture. They also add some latency a
little bit to your architecture. They take up a little more space. None of this is really going to affect
you as a small company because your tech costs should ideally be really low. So adding a layer of containers really
is not going to explode your costs because the costs are
manageable, but it is needless. So in the range of useless to terrible, I would put containers somewhere
around useless. Number four, no sql, no SQL databases are
far better than SQL databases. But the caveat here is that SQL
databases are far better than no SQL databases. You see, it depends
on what the use case is, but I'll give you some good news. It doesn't matter if you have a startup
or if you have a mid-sized company, it does not matter what kind of database
you use. Yeah, you might feel like, oh my God, what do you mean? It
doesn't matter what database I use. What if it's a tech startup? Yeah.
Yes. In certain exceptional cases, it makes sense to truly understand
how the database is running. In. Most cases where you're
providing customer value, they don't care how you are storing
your data. When you go to Google Maps, you don't think that, oh wow,
there must be a graph database, and if they're not using a graph
database, you don't get irritated. You're just focused on the latency
of you getting a route. Now, what would be a use case for NoSQL Scale? Easy schema change, no joints. Yeah, all this are totally irrelevant for
you as a startup. Scale for a startup. Firstly, I mean, what are you
talking about? You have 10,000 users. We go get some users and
then we talk about scale, but the other two problems of schema
change. What do you mean schema change? Just fire an alter table
query 10 times, 20 times. If you have a very large table, then what you can do is fire alter
table query at 2:00 AM in the night, you take a table lock, make the schema
changes, it doesn't matter and joins. You can cache some of the popular
queries that you have in the startup or mid-size company if you cannot
cache it for God knows what reason. You want extremely consistent data
de normalize your tables in sql, and you are as good as no sql. The only use case that I have seen of
no SQL in Startups is because the tech team, the developers are
comfortable with no SQL instead sql. So they go ahead and use no sql,
in which case it's okay. I mean, I don't want you to learn
about SQL right now. If you're very comfortable with a
certain database, go ahead. Like I said, the data store doesn't really matter. So in the scale of useless
to terrible, I would say no. SQL is later on a bit painful because
you end up doing things which you don't really need. So we can give it
a rating of mildly infuriating. Number three, microservices.  microservices have been
under a lot of scrutiny recently. The benefits of microservices,
which are continuous deployment, isolation of concerns,
pinpoint scalability, parallel development don't really
affect you in a small organization. You can do this by yourself anywhere.
And if you have a team of 15, like 15 is a pretty large
team, how do you manage that? You can have a modular monolith, right, which is like a microservice
of one service . It's a, it's a monolith where all the
code is placed in one repository. If multiple people are working
on different pieces of code, as long as they don't touch each other's
code, you're fine. Your team is fine. Unlike containers, microservices can actually
harm your organization even
for a small company where the development speed goes down because
you have a bunch of microservices, sometimes written in different languages
with their own different flavors. If a dev leaves your organization, you don't really have the standard
setup so that when a new dev comes in, they are able to understand the overall
architecture and the microservices that you have in your company. So it's best
to just have one place, one monolith, which is hosting all of your code and
keep the context wrapped up in one place. Giving a rating to microservices. I
would say it's something like hurtful. It's bad, it's not horrible, but. It's, it is bad. Number
two, quality obsession. If you have a mid-size company, I'm
talking about 10,000 to one lack users, having stringent code reviews, trying to standardize the way in which
you write code and testing large pieces of code may not be able to give you the
bang for buck that you're looking at. Developers will end up spending most of
their time working on existing features, eradicating bugs, which
would never have come up, instead of focusing on
customer requirements and
building capabilities that the startup actually needs. If you're working in a startup where
most of the work is around reviews, documentation, extensibility
and test cases run, I I'm being frank with
you because you know if, if this is what they're focusing on,
what else? What comes after this? Do they have any plan? Ask them, you
know, do you have any features coming up? Do you have any products coming up? Because if we are just going to be
focusing on this, when users don't exist, it means that the money's running up. The only time I would focus on
code quality in a startup is if it is an important piece of code. Like if it's a core system that you have
and you know that it's going to last for at least six months, yeah, writing
test cases makes a lot of sense there, but unless most of the cows are
walking through that piece of code, just ignore it. Use it like a graveyard.
No one goes there. We don't care. Our code quality's fine. When
you're doing code reviews, you focus on three things only. One
is correctness, second is readability, and the third is extensibility.
Do not focus on things like, oh, these are the best practices, or this would be the perfect
design pattern to implement here. No one cares about your design pattern
when you have like 10,000 users, right? Because what you need to do is you need
to shift the code and see whether users are finding it useful. If they find it useful and you have one
lack users or 10 lack users tomorrow, that's when you can focus
on your code quality. So giving it a rating of how bad it
is, I would say it's more than hurtful. It's actually painful to your
team because it feels so innocent. I'm just trying to improve the
code quality. But in reality, what's happening is your features are
getting slowed down and you're looking more in terms of art than
implementation. Number one, automation. This can kill startups.
This often kills startups, and unfortunately most of us engineers
have unhealthy affinity towards automating things which occur repetitive. The best example for this
would be customer success, where you have a person
who's talking to a customer. Now the cost of losing
a customer is very high. The benefits of providing a
great service are very high. You could say that chat, G P t
will take care of this for me. So let me just integrate an a p
i, but chat, g p t is an idiot. It can't really talk to a customer
and understand their true needs. It speaks well. It doesn't have a brain. So what ends up happening is you lose
customers because you are automated most of your system. And of
course you can scale, you can scale a bad product as much as
you like. Your customers are not scaling, but your tech definitely is scaling
parts of that process, like setting. Up a appointment, maybe that can,
that scheduler can be automated. So whenever you come across a use
case where you can see automation as a possibility, I would suggest
you go through this checklist. Is this going to continue long term? Is my automation actually going
to help the company? Two adoption? The people you are creating the code for
really need to love what you're built for them. That's the only
time they'll actually use it. So if you automate a mailing engine
and the marketing team doesn't like it, then your product is useless. No one is going to actually be
working with that marketing engine. They'll still go back to the c
e O and still ask them for, Hey, can we user off the shelf solution three, is it extensible tomorrow
when the requirements change? And they'll do you see at least
the most critical parts of that code being extensible? So if you're writing a mailing
engine for existing customers, can it tomorrow send emails to a set
of customers who are from a different platform? It's best to talk to the product team or
the c e o in your company in a mid-size company. I mean, there's just 20, 30
people. So talk to them and ask them, do you see this happening
in future? If it is, make sure your code is a
little extensible or cost. What is the cost of you
actually building this service? If you are going to take half a month, that means it'll take you roughly one
week to test the system comfortably, and then you'll also have to
maintain it. So what is the cost? How much time investment are you doing?
Could you be working on something else? And number five, which is the most
important? Time saved long term, which is six months,
right? Or at most a year. How much time do you think will be
saved by doing this piece of automation? If it takes you three hours every
day to do this and automating, it'll convert it into one hour every day, that is amazing that automation
is necessary for the company. But if it takes you one day
a month to do something and it'll take you half a
month to automate it, it doesn't make sense for a
startup or a mid-sized company. So in a scale of useless to terrible, I would say this is absolutely
terrible if done wrong, automation, just to clarify, can be very, very
useful to your company when done right, but when done wrong, it SAPs
the blood out of your company, makes development much slower
and complex and loses customers. So that's it for this video. I hope.
Now you have a set of red flags inbuilt, which tell you that this tech may not
be necessary and therefore we are not going to adopt it until we find a good
reason for it. You can explore the tech, but you don't need to adopt it
before you're sure. Of course. All of these opinions
are a bit controversial, and I may be wrong in quite a few of them. So let's have this discussion in the
comments below. Let me know your thoughts, let me know your suggestions.
Let me know your viewpoints. If you like these kind of
videos, hit the like button. And if you want notifications
for further videos like this, hit the subscribe button. I'll
see you next time. Bye-Bye.

---

## 45. Authorization across Distributed Systems: The OAuth Protocol
**Channel:** Gaurav Sen | **Views:** 33K | **Date:** 2 years ago | **Duration:** 16:19 | **ID:** 65-6asTjuB8
**Link:** https://youtube.com/watch?v=65-6asTjuB8

### Transcript:
Hi everyone. This is GKCS. Today we're going to be talking about a
very useful method of authentication and that's called OAuth, which is
open authorization. As you see, authentication authorization
are not exactly the same, but by the end of this video, you'll know
why they end up doing the same thing. So here's the example. You have a bunch
of websites that you are a part of. This could be Google, Facebook, LinkedIn.
Most of us are part of these websites. So remembering passwords for
these websites is a challenge. Every time you go to a website and
you are asked to sign up the biggest hesitation that you have is, oh my God,
I have to think of another password now. So some of the common solutions
found around this is, Hey, how about Chrome suggests
you are difficult password, so you don't have to remember
it. Chrome stores everything. You can also have an
external password manager, which manages all of your passwords,
especially around bank passwords. Maybe you trust a password manager more, but even this is not actually that
good a solution because eventually you end up having, let's say 15, 20, 30 passwords that you have to
either manage in a password
manager or you have to remember mentally. And the problem
is especially acute for a startup. A startup has to sign up
users has to onboard users, and with such hesitation towards
creating a new username and password, you want something that leverages the
existing infrastructure of Google or Facebook or LinkedIn to take
away your signup problems. Let's say you have a user who comes
to you and says, I want to sign up. Instead of signing them up manually
through a username and password, you instead say, Hey, if
you are a member of Google, which you probably are why don't
you gimme your email address, which is registered on Google?
And the user says, alright, if I don't have to remember my
password and username ever again, I would give you my email and I will
trust Google not to share any information, which is part of my Google account
that you don't deserve to see. At a high level, it would be like, if someone asks me for my
previous employment details, and I tell them, instead
of me furnishing them, why don't you go and talk to my previous
employer and then I trust my previous employer to not share my personal
details like payslips or, you know, my performance reviews. So just like that, we actually take this
request of login to Google. So Google internally checks whether
this user exists in its database. If they do, Google then goes
back to the user and says, look, there's this new website,
this startup interview ready. It wants to see what your real
name is. Should I allow it? Now you say, yeah, sure, go ahead.
They just wanna see my real name. I'm ready to keep that. So
Google name returns, okay. The real name is G K C S.
Now as Interview ready, what does this information tell me? It tells me that you're a
registered person at Google, and your registered email ID is
some Gmail id, which you gave me. So I have your email id, I have your name, and I know that you're a verified user
by Google because Google verifies all the email addresses. So
most of my job is done. I don't really need your
password. The next time you come, I'll do the same thing. I'll
go to Google Ask, you know, there's this person with this email
ID who claims to be your user. Why don't you go and check with them
whether they really are your user? So interview Ready now has a
new user entry with username, no password, but user profile details. Now we go back to the user and say that
we have verified you through Google. And so here's a session token, which you
can use for the rest of your session. All subsequent actions from this user
will use this session token tomorrow. If you want to revoke access from
Interview Ready and say that no iReady has done something shady, we need
to immediately stop access. Google is going to say that
that token is now invalid. So iReady will no longer have
access to your name in case of name. It's like harmless. But let's say you
gave permissions for your Google Calendar, and we are able to set events. If you see something shady
and you go and tell Google, stop allowing access for Google Calendar
interview Ready cannot make updates to your calendar. So in this
way, your data is protected, your services are protected,
your Google services, while you are able to give the minimum
information that is needed for integrity to work. Finally, if you want
to log out of this website, Google doesn't need to know about it. The website itself manages
the logout and the login. The only thing that has been
outsourced is the registration. So here's a war story, which
happened in March, 2022. We were having roughly 50 signups per
day in my startup interview ready. And what we realized is most of the
users who were dropping off were mobile users. And apart from that, you know,
they were going through the page, they was looking at things,
and when it came to sign up, many people were dropping off. So how do you make the signup page more
appealing was one of the things that we thought, and that's where
OTH came in as a solution. We implemented OTH and deployed
it on the 15th of March. You can see that the numbers
before that were around 50 per day, and this is what happened.
Signups exploded, right? You can see on 15th March they became
almost two x the number of signups we had earlier. We also heavily promoted
the website just after that, which shot up our numbers. But when
it gradually came down to normal, it was still much, much higher than
what it was. You can see in April, which is the worst month, we were still doing far better than we
were doing in the start of March in terms of signups. And primarily this is because users were
finding it much easier to just click on a few buttons and enter the
website. In our experience, implementing OAuth was a one-time
effort, one-time investment. If you want to implement OAuth
for one system like Google, it'll take you some effort, but if you want to add LinkedIn or
Facebook or any other kind of auth, the flow is pretty much the same. So it's not much harder to add
an auth flow after that. Also, the benefit is that you don't need
to do user verification anymore. You don't have to verify their email
addresses because you just offloaded that verification flow to these popular
websites, which have done it for you. Finally, you don't have to maintain their passwords
in case a person comes after a year and has completely forgotten the password. Instead of them resetting the password, they're just going to click on a few
buttons and again, go into the website. The only drawback that we have seen with
OAuth in a practical standpoint is that sometimes people sign in on Google
through a different Gmail account and they have created an account already
at Interview Ready through a different Gmail account. So what happens is
they say, Hey, I purchased the course, I don't have access to the course
anymore, so can you check? And then we, you know, see that it's come
from a different email address. So then we can connect with
them and tell them, you know, are you the same person because your
invoice email is something else. So that's a bit of a
manual reconciliation, but it's totally worth the
increased signups. Awesome. So what are the advantages of
having OAuth in your system? One of the things is you have
now completely outsourced
the implementation of oth, whether it's testing,
coding, debugging, you know, in general there is some maintenance,
some feature you want to add. All of that has been given
to Google or given to Meta. You might want LinkedIn based on what
kind of platform you're creating. One of the things is if you're creating
a platform for software engineers, maybe you want to give them GitHub access. But if you're creating a
platform for designers, maybe you want to give them Adobe access. So the vendor who you go to for auth
changes depending on the product. The second thing is this is standardized
behavior. Auth is a protocol, so you will do things in a particular way, so your implementation becomes
a little straightforward. You don't have to think of, oh, how am I
going to salt and pepper this password? How am I going to store this
password in a safe, secure way? All of that is already handled, again,
outsourced. It's standardized behavior. You can expect certain things to happen. The third is the biggest product
benefit. Easy user onboarding. Building a small wa story at the
end to explain this even more, but the idea is that users find much
easier to just use existing accounts instead of creating a new
account on your website. Other, the major benefit that OAuth
offers is mobile device signups. This is not something that
the specification on the
protocol does by itself, but it's a very big side effect
because when people on the mobile, they do not want to type
in username and password. They just want to click
and click and sign in. So any mechanism which does that, one of them is worth really helps a
user get onboarded quickly. And finally, there's possibly deeper user
insights. This is a bit shady, but if you want to know
a lot about your user, then one of the things you can do is you
can ask a lot of permissions by sending the authorization request to the user.
And if they give you the permission, then you have access to a lot
of their information. Like, who are they access to their calendar,
access to their portals, possibly. So if you need more
information, you can do this. But if you are caught while you are
trying to take more information than you really need, that's a
really bad user experience. They're probably going to run
in the the opposite direction. What are the potential drawbacks here? One of the things as a business
is you have absolutely no control. So if let's say Google is having an
outage, then you are having an outage. If meta is having an outage or LinkedIn
is having an outage in their odd systems, you cannot have users
signing up to your website. Okay? That's a pretty big problem. The second thing is you have
very little flexibility. If you want to ask for
more data or less data, you better hope that that platform
contains it. If they don't contain it, you could separately ask the user, but then the whole signup
process becomes long anyway. So you might as well have them entering
the username and password and getting all the data in one place.
Finally, if the platform, let's say LinkedIn says that,
no, you are a shady website. I'm not going to be allowing
you to hit my APIs anymore, then you have no reconciliation. You
can talk to the website and say that, I'm sorry can you please let me
access the rest of the users? But they could just refuse. It's a private
company, there's not much you can do. You could take them to quote, but then you're losing users
while this is happening. The second major drawback of this
is user data is often shared. So let's say you provide a particular
service to your users who log in two days later, they get to see
ads from all your competitors. Why? Because Google sees that this
person went and visited this website, they also logged in. Now
if we show them ads of a competitor, it's possible that they'll
go and purchase that product. So there is data sharing, which as
a business you may not want to do. The second thing is the customer may
not want their data to be shared. Maybe they don't want to see ads. Maybe they don't want Google to know
about their interview preparation or about their personal life. So that really
can't be avoided because of course, Google knows. Okay if you're
going to be using auth. And the final major drawback here is
that you have a little signup control. You can have a potential
loss of user data. Let's say I have a Google account and I
log into your website. Two days later, the Google account is deleted. Okay?
Now how do I log into your website? How do you know it's me, right?
I have no access to that email, and there's no other way. I don't have a
password that I can tell you that, hey, it's just me. So I have to either manually connect
with your support team and convince you somehow that yes, it was me, or I need
some mechanism to reset the password. Maybe through my cell phone I
can share an O T P with you, which will bring in two
factor authentication again, so that I don't lose access to my product, and you don't lose
access to your customer. So that's it for open
authorization called auth. It's most common use
case is authentication, which is checking if a user
is who they claim to be. And the strange way does it, is through
authorization. Hey, gimme your name. Oh, you gave me the name. That means
you are a user of that website. I think it's a net positive because it's
easier now for startups to onboard new customers. There are some drawbacks, but as a
startup or as a medium sized company, maybe that's not something which is very
big for you. Thank you for watching. If you have any doubts or suggestions,
you can leave them in the comments below. If you like this video, then please
feel free to hit the like button. And if you want notifications
for further videos like this, hit the subscribe button. I'll see
you next time. Take care. Also, if you're looking for more detailed
videos on disparate systems, I have these set of videos already
created, and if you're ready, I'll just explain what they do and
then, you know, if it's relevant to you, you can go ahead. And
these are all paid videos. So it's worth the investment
if you are currently working in an organization. So one is the basics of dispute
system security verification authentication, authorization.
What are these terms actually, what do they really mean? Then comes the first type
of authentication mechanism, which is token based authentication.
After that we go for ss, s o, and OAuth is, like I said, authorization, which means you have been given
the permission to do something. And authentication means you
are who you claim to be. Okay? they are different
concepts, but in security, sometimes they get mixed up. I mean,
if you are being given to do something, then I already know who you are. Right? So that's described more
in detail in these videos. A single sign-on is something
which your company probably does. If you're a large organization, you'll have your own at the rate
company name.com.io and the benefit of single sign-on is that your
company owns your membership. Your, you are a resource for the company. And that resource has been given
access to a particular, let's say, course or a particular product. Okay? So as long as you have their email id,
the authentication happens on their side. This is described more with detail
and animations in these videos, there's something called access
control lists and rule engines. Very, very important concept. If you're looking
at very large distributed systems, for example, Google's Ziba, which is Google's authentication system
it has now been open sourced uses access control lists and rule
engines. There's also a w s, which at scale has to handle security
groups and various other problems. So that again, is a
variation of this solution. You also have a general
concept of hackers, or let's say malicious or
not very careful developers who could bring your system
down and DDoS attacks, which you have to guard
against in general. So those attack factors have
been described in this chapter. One interesting practical
question, which is asked often is, how would you protect the videos
that you have in a CDN? For example, if Netflix has a bunch of videos which
are all copyright then, you know, how do you stop a user from just going
and downloading the resource from their browser? Yeah, as long
as they have the token. So what kind of security
mechanism would you put in there? Or even for a live video, like let's say Hot Star is broadcasting
a cricket match, and that time, what if you take your token and
share it with all your friends? What happens then? So this has
been tackled to some extent. It's not a full d r m solution, right? I'm not talking about how do you ensure
that nobody copies the original video and shares it with friends. That would
be a digital rights management question. This is more of a security
mechanism that you are going to stop malicious or unauthorized users from
accessing the resource after the resources accessed. Anything can happen that
is described here. And finally, there's a quiz just to make sure that
you actually understood the concepts that were explained. So this is
a pretty useful chapter. It's one of the chapters in Interview
Ready. We have more than 20 now. 21 is coming up on Friday, which
is on distributed consensus Paxos. So I just wanted to, you know,
keep you guys in the loop. There's more than two 20 videos right
now on system design at Interview Ready. So recently there's been a lot of new
videos which have been added. Like I said, purchase it only if you are currently
working as SD one or about if you're an intern or if you are in college. These videos are not what you
want to invest in right now. Watch the free YouTube
videos. You're doing great. And if you're currently
working, yeah, I mean, it makes sense for you to invest in
more depth and concise set of resources. Thank you so much for watching this.
I'll see you next time. Take care.

---

## 46. How Stored Procedures make databases FAST
**Channel:** Gaurav Sen | **Views:** 21K | **Date:** 2 years ago | **Duration:** 12:31 | **ID:** AYUnaErhdS8
**Link:** https://youtube.com/watch?v=AYUnaErhdS8

### Transcript:
hi everyone this is gkcs in this video we'll be talking about stored procedures stored procedures are very similar to apis or functions which are stored inside the database hence the name the idea is that you can have inputs that are passed into these functions and you get outputs from these functions it's not important to think about what language this function uses usually it's in SQL but you can Define stored procedures using Java using python using golang all of this is dependent on the database itself also who does the compiling of this function who executes this function the database always okay there are certain benefits of stored procedures as we'll see and there are certain drawbacks some things to keep in mind though are that the person who's calling this function is usually a server you don't have a client calling a database function directly just like you don't have clients directly manipulating data in the database the second thing is that how do you pass this API call between the server and the database there's usually a special client that is a small piece of software running on the server which tends to talk to the database this is the place where you define what kind of query you're going to run for example if you're saying select start from profiles that's a query which has to be sent to the database and then the results have to be returned a stored procedure is very similar in this you'll say let's say get profiles and which kind of profile should this user be able to see so user ID will be the input and the output will be all of the profiles that I should be able to see so when our stored procedure is actually useful now let me share with you a real world example this is way back in 2015 one of my friends was trying to build an app uh for personal loans and the idea was that you might have run out of you might have run out of your close relatives and everyone but relatives of your relatives may still be willing to give you a loan so as crazy as the idea sounds the basic idea is very simple you have a set of friends a set of people who you know so they are your connections first level connections and then there are second level connections who are the connections of your connections so one transitive relationship the idea here is that if you can find that larger circle of friends or friends then you can suggest a loan to be given to you but the problem was that when they were trying to run this query it was taking too long it was taking I think uh about an hour or something in there in the database so they came to me and they asked me for an algorithmic optimization uh and this is what I suggested to them eventually so they had a server and the server was getting this request of get friends or friends with a user ID then they were making a query to the database to find all the friends of this user ID this is the original user let's say me now that was returning a response of three friends friend one friend to friend three and then what is happening is iteratively we're going over the friend list and getting the friends of each friend who's a direct connection so what's happening now is the second order response is going to come back and this is happening let's say for one person one person had around 50 or 60 friends uh you would be running this 50 or 60 times finally when all the friends were together they were put into a single set and then after you know removing duplicates and putting them in a sorted order there would be a response but the response as you know was taking very long it was about one hour so my first suggestion to them was to use uh optimize algorithm for this this is a graph and the graph has a set of nodes you are basically trying to do two traversals so I suggested to them to have a bi-directional breadth first search here you have nodes on each side friends and friends trying to connect with each other instead of an order n Square query this becomes an order n query this is all Theory though because in practice it didn't change the runtime the runtime was still one hour and that made me feel a lot of surprise like I was like what it's still as slow as ever I asked them the size of their inputs the size of the inputs were very small it shouldn't really have mattered everything should have happened in one second I think the number was something like 10 000 or or one lakh which is 10 raised to about five so BFS should have both it didn't work that's when I suggested that hey why don't you just cash the results this was super effective it worked out really well uh there was a happy path where you would just query for your friends or friends as a user and you would get a response in a second so their average response time actually went down to less than a few minutes the only problem though was server restarts Whenever there was a server restart we used to have a cache Miss because the cash would get evicted and we would have to fetch from the database again that would take about an hour to respond and one of the solutions was in the night at two o'clock every night we can just restart the server any kind of deployment will be done later in the night any kind of cash refreshing will be done late in the night that is their idea um the other problem uh which is over here is that if your server crashes then if it's an unexpected crash then you have no choice you have to go to the database and put the entries my suggestion here was to use a global cache that the cache does not get scrubbed out but this also didn't feel good because you didn't have fast updates in this cache one of my friends at this point said that hey instead of a global cache why don't you have a in-memory database itself so it's like a cache after all uh and that's when it struck us something is terribly wrong with around 10 ways to about five entries if it's taking an hour to run a BFS that makes no sense even then Hardware was enough to run 10 business and queries per second so here's when we started thinking finally and we start tracing the problem so we started you know writing down sop Ln statements uh after pretty much every four or five lines of code and we realized where the problem is occurring our first query to the database was get friends user ID this would take about one second the response would give us friend one friend to friend three in fact we would have hundreds of friends for certain cases then we would make another query and this would take about one second to respond and then again another second so what is happening is that we were making a cross-continent call every time the query was being run we were hitting a database in the us and our server was in India the second problem was that we were making too many requests to this database the firewall found our activity to be pretty suspicious so it started blocking these many requests coming in suddenly from from one server in India so it's strange I mean maybe the firewall didn't need to behave this way because it was a server of the company but it happened however it's good because by making the runtime so large obscenely large one hour it actually helped us focus on what is the core problem which is these many Network calls and the idea came up then stored procedures you know why don't we just run this entire algorithm of prep first search in a stored procedure so this will be a bunch of SQL statements you do an inner join on the friends table and you find your friends or friends that way then you return a response and everyone is happy this worked out this worked out really really well our customer was pretty happy when they saw that we were able to give responses in a second they asked us not to implement the cash they wanted completely consistent responses sometimes when you're talking to people who are let's say not very techy and you tell them that hey sometimes the response may not be what is being reflected in the database they they instead tell you just simplify things don't tell me that sometimes things can go wrong and sometimes things will go right the moment I make a change in the database it should reflect in the front end and so this is the kind of solution they wanted no caching just stored procedures as you can see there are many benefits of using a stored procedure the first one is that there is a certain uniformity in performance whenever you're saying get me the friends of friends it's always going to take you almost the same time you don't have any set of heavy users who have millions of friends or you don't have light users who have just a few friends and so you optimize for each type of user no that's not necessary just run one query encapsulate all of that complexity all that logic into a single slot procedure run that in the database get a response it's almost always going to take the same amount of time and the scaling also that has to be done is depend on that single encapsulated operation not on a bunch of queries that different servers are making from different places okay the second thing is that you don't need any external two-phase commit to be done if you want the operations to run atomically many databases offer transaction support asset guarantees so you can have Atomic operations running and you can roll them back easily in the database itself you don't have to manage that through the application the third Point again is very similar uh consistency guarantees in an application are usually harder to enforce databases are specialized for this you can have read committed or serializable isolation in the database itself run the stored procedure everything will appear in the way that you want it appear the fourth point is quite interesting you may have a strongly connected network of friends so each friend is a friend of everybody else so if you have 50 people that would be roughly 2500 total results that you would get from the database after 50 queries but if you run the query in the database you're going to just get 50 results back because it removes the duplicates by itself and filters through things by itself so the network cost here is also lesser and finally number five of course is that you have fewer round trips you just make one query instead of 50 queries this is probably the biggest benefit and the most common reason why store procedures are used there are also certain drawbacks to stored procedures the first one is that the application must know and also create a stored procedure so either it's a database administrator somebody with the permissions to go and create a stored procedure we'll go ahead and do that and then you have a application engineer who's going to be calling that stored procedure they can't really make easy changes to that database if it's you know if there are permissions behind the database or if they don't know how to go and change the language of the database this is going to be a problem the second thing is your application specific or business logic changes start moving into the database so this is usually done by the application engineer who are going to write really bad code it's going to be difficult for them to maintain their SQL standards that are set by the DPA or the DBA will say okay I will do it for you but I'll do it after three days so development time becomes long it's also hard to read these stored procedures for an application engineer it's hard to debug for them because when they look at SQL instead of you know the language that they're comfortable with it takes them more time also error responses get really difficult in an application it's easy to identify where things went wrong and return the right error code with the you know error message but in a DB when things go wrong uh it could be anything you get SQL error codes so those have to be mapped into application error codes and that is tedious it's not easy to do uh after a certain point in time it starts getting tiring because you have to have this SQL dock next to you and the application Dock and STP codes SQL codes and the mapping and the absolute funny point is that this is database specific so some DBS will offer you Java support some DBS won't if you change your DB which is God forbid you don't but if you change your DB then you have to write those stored procedures again right while in an application you just copy paste code in a DB it's a little more tedious so that's it for stored procedures it's a very simple concept and it helps a lot in certain cases where you have multiple queries that you have to fire in the DB and there is some complex logic which you want to offload onto the database itself always try to Cache things if you can before there may be a algorithmic optimization to be done but in some cases it makes sense to reduce the number of network calls that you are making and just let the DB do the work thank you so much for watching I'll see you next time

---

## 47. Garbage Collection Algorithms in Java: Concurrent Updates with Optimistic Locking - Part III
**Channel:** Gaurav Sen | **Views:** 10K | **Date:** 2 years ago | **Duration:** 10:03 | **ID:** cX8cgAC4ZAc
**Link:** https://youtube.com/watch?v=cX8cgAC4ZAc

### Transcript:
hi everyone this is gkcs in this video we'll be talking about garbage collection algorithms specifically in Java but even if you're coding in golang or C plus or python many of these garbage collection algorithms are applied behind the scenes for some of the libraries that you're using for example elasticsearch and the second thing is these algorithms are generic so they're used in Python they're used in golang uh it's very very useful to know about them and how they work so that you can predict the behavior of your systems now part one and part two of this series have already been posted and they were posted two years ago so we'll have a short recap just to understand things if you have gone through them and you know them well you can skip the next minute or so of the video but yes there'll be a lot of learning in this video okay for a recap the first part of garbage collection is garbage identification what you need to do is identify objects which are dead in memory so any object which is reachable becomes green all right and when there are no outgoing references to this object it becomes black so this is exactly depth first search okay you have things in the stack and objects which are reachable are in the stack uh once they're done processing there are no more outgoing pointers from that object it becomes black and eventually you just have black objects and white objects all white objects are discarded black objects are kept so this is also known as the trical algorithm you have black gray and white have any color that you like but three colors is what you need now this algorithm is very efficient uh it is an order n algorithm it runs through all the objects in memory and tells you which objects are alive you can speed this up maybe by using Python's idea of reference counts but reference counts has its own set of problems you couldn't have Cycles in Python and so the reference count of all the objects in that cycle can be one how do you detect a cycle so this makes the garbage collection process complex it's not something that Java has gone for Java has gone for a simple practical algorithm but they also need to speed up garbage collection because as long as your garbage collector is running your application is not running and so very often you'll hear staff Engineers talk about this system is having a garbage collection cycle so why is that so scary well it stopped for the next 10 seconds oh my God so that's pretty big I mean all of your requests stop for 10 seconds maybe many failed some of them were waiting and then many others came in the the 10 seconds so there's a country herd problem so this is one thing that you really really want to avoid that's the reason why you want to understand the garbage collector also well the three things you can do to speed up garbage collection the first idea is to look at the patterns of garbage collection and see if you can find optimizations there and here comes the generation hypothesis younger objects tend to die frequently while older objects tend to stay around so you spend most of your time looking for dead objects in the first few garbage Cycles eventually if they haven't died then you expect them to live for a long time and you move them to a older generation here you spend lesser time looking into these objects because the chance of one of them freeing up memories look this doesn't work in some cases for example caches where older objects tend to die and younger objects tend to live for a while so allow you caches we also saw doubly linguists which could create problems in terms of nepotism I would again suggest you to go back to the video to get a better idea of how these problems occur and what is being done to solve them the second idea was to introduce concurrency here this is a natural step because you have a large graph and you can parallely or concurrently look at the objects and see which objects are reachable the problem with this is that if you're running a concurrent process like garbage collector and the application the application is making changes to the memory while the garbage collector is going through the references so there could be problems here as we discussed in the previous videos around this week found a solution for jit which is just in time compiler injecting some code and making sure that any reference that the garbage collector deems as Dead or Alive has to go through some checks the third idea that we came up with was to split this entire graph into regions you have hidden objects in one place you have old objects in one place so old generation Eden uh Survivor this idea of splitting a graph into pieces and finding out which objects point where using a card table also helps us speed up garbage collection because one you have smaller spaces that you're looking into if most of the objects that are dead you are likely to find maximum returns by looking into that space so you split the whole region into spaces and the second idea was that compaction is easy now because you have let's say 2048 spaces it's easy for you to collect some of the spaces and move them into a new one now we come to the final idea of having concurrent compaction concurrent compaction is especially difficult because whenever you're compacting objects into one place you're effectively doing a right operation you're doing a copy right so when you're doing this it is possible that the application goes and reads this old object when a new object has already been created okay so you may have two copies of the object and you can have dirty weeds as an example let's think of an object which has these variables A and B and it has a reference also R uh and it's got some headers these headers have some information about you know what type of object is it so the application is pointing to this object uh and now the garbage collector wakes up the garbage collector goes and says all right I need to compact things I need to put all objects together in one space you this object go over there okay but it can't send it over there it has to copy it and then go and delete the reference later so it makes a copy and then suddenly the application wakes up this is a concurrent program remember that you have the GC getting some time uh time slides from the operating system to do some job in which case it was able to copy and just after the copy the application got a Time slice and now it can do something and what does it do it makes a change it makes an update operation a from minus one became seven this is a problem because when the garbage collector wakes up it's going to change the pointer and now a is no longer equal to 7 is equal to minus one you have a loss right okay how do you avoid this this is not acceptable you will have rights which are being lost by the application and here you can use the concept of a forwarding pointer this is a very interesting idea you have an object which is a plain Java object the moment the garbage collector wakes up the first thing it does is it goes and adds forwarding Partners to all objects okay and initially the forwarding pointer is pointing to yourself so you are the right object okay the forwarding point is the source of truth it's pointing to you so you have the right object now the application can now wake up and say that listen I want to update this value this field a to seven but it can't directly update this value it has to create a copy of this object because you have forwarding pointer means garbage collection is going on it's too risky to make this update I'm going to create a copy of this object and then I'm going to try to update it but the moment you do that when you copy this new object there might be concurrency there might be another thread which says listen I want to update the value of a equal to 20. okay so you have multiple concurrent right operations and a garbage collector also running this is typical standard thing in any any application now both of them will try to set the value of the forwarding pointer to their respective copy so the first application is trying to move it to the first copy the second one is trying to move to the second copy but only one can succeed and to do this you have the concept of locking which is a compare and swap operation so one application will win the other one will lose the winner gets to make the change the loser aborts their operation and retries so on the retry you see that the forwarding point is pointing to this Fresh brand new object of equal to seven update the value equal to 20 in that and so you have a consistent world view eventually the garbage collector will wake up and say that the forwarding pointer is pointing to this new object the other objects can be eliminated so this way you have concurrent compaction also now the two garbage collectors in Java which do concurrent compaction one is Shenandoah it has a single generation it doesn't believe in the generation hypothesis and the second one is zgc of course if you are looking for a non Oracle implementations then you can also go for C4 what they claim is that it's a better garbage collector than anything out there Shenandoah and zgc seem to be heavily inspired but uh that's my personal thought my final comments on this will be the generation hypothesis is useful in most cases you need to look into what uh the situation is if you are using caches maybe generation hypothesis is not very useful otherwise it's a great Tool uh it saves you a lot of looking into the second thing is concurrency can reduce your pause times significantly your application latency will go down if you have concurrent compaction concurrent evaluation of the graph remember that these are still trade-offs you know what you should do if you have a background process which doesn't have any problems in terms of responding in time a simple Mark and sweep garbage collector okay because concurrency is just going to eat into your throughput and nobody cares about your latency unless you have like hours of latency that's not going to happen garbage collection is a fast process and it usually takes less than a minute so you can go for the old algorithms they are going to actually give you more benefits having said that though most of these new algorithms make sense in the production environment with real-time traffic all right that's all we have for garbage collection thank you for watching if you have any doubts or suggestions on this do let me know in the comments and also if you like the video please hit the Subscribe button please hit the like button I'll see you next time bye

---

## 48. How 100 milliseconds cost Amazon 3 BILLION DOLLARS: Latency, Concurrency and Parallelism
**Channel:** Gaurav Sen | **Views:** 59K | **Date:** 2 years ago | **Duration:** 6:22 | **ID:** I8FeITQvLAk
**Link:** https://youtube.com/watch?v=I8FeITQvLAk

### Transcript:
hi everyone this is gkcs in this video we'll be talking about asynchronous programming if you are a front-end or a back-end engineer it doesn't matter asynchronous programming is a core part of Computer Engineering and the reason why it's so important is because every application that you write uh has if it is even slightly complex has a set of background tasks that it has to do so for example if you are working in a pizza shop and you had to accept a Pisa order so at this time you accept the piece order but you don't necessarily need to start working on it immediately there are already some pizzas which are in the oven which are being cooked right now maybe you start preparing the toppings for this one so there is a feeling of multiple things happening at the same time and you're not waiting for a task to complete or a response to come back before you move to the next one and why is this important well firstly of course one person can do a lot more so this saves costs it also reduces the let's say technical footprint that you need but even more importantly customers love this customers don't want to be waiting in the line you can just tell them that hey you can come back later and your order number is certain so so that's exactly how you can think of a computer also saying that okay I'll work on this task later and when I'm ready I'm going to show you the result 10 and this results in higher customer satisfaction there's many studies on this Amazon discovered that if you reduce your latency by 100 milliseconds you actually increase Revenue by one percent one percent of Amazon's revenues a lot of money Google saw that if your search page takes 500 milliseconds to respond users are 20 less likely to actually pick up that search result 20 of your business blasted away in half a second because the user didn't really like the the response time so the more responsive you can make your pages the better it is there are two major ways in which you can make a program asynchronous the first one is concurrency so an example of this would be where you are taking an order from a customer and working on Topics by the time that the next customer arrives you can go on working on your topics but when the customer does come to your counter you stop whatever you're doing and address the customer first okay and when they are given the order you say okay I'll get back to you in some time they leave you get back to the topics so one thing is happening at one time you're doing only one thing but you're able to switch between tasks again and again the second type of asynchronous programming is parallelism uh here it's pretty simple let's say instead of one counter you have two counters or you have one counter which is just dedicated to taking orders and there is a person who just prepares Visa topics this is a little more expensive as you see the problem here is what if the person is not getting any orders or what if the piece of toppings are really fast to do so you you do them but you're not busy so you have these processes waiting which is a waste of time and resources but the benefit of this is that while an order is being given you can continue working on the pizza topics and you can have a mix of both of this concurrency and parallelism where you have two people taking orders in the counter and whenever they're getting time they're able to work on the topics so there is concurrency and there is also parallelism usually in the real world you have a mix of concurrency and parallelism where you are able to get the maximum throughput which is the maximum amount of work that can be done through a processor by having concurrent processes and you also have parallelism so that the latency is low and you might have some customers in India some customers in the US so you have a server for all the people in the US which is running in parallel with the server in India now for some potential drawbacks one of them is that if you have too much concurrency where you have a huge bunch of threads which are working on few tasks then all that's going to happen is that there's going to be context switching from time to time so a person is not able to work on a task long enough before the context switch costs them right so if you have many threads especially the problem is you are trying to do many things at the same time and all you are doing is moving from one place to another instead of actually doing the task so this is called thrashing in operating systems you have a thread or a bunch of friends not able to do anything because all they're doing is getting preempted out the second thing drawback is that if you have a lot of parallelism you may be wasting resources so the cost of this is of course High and the third thing is developers find asynchronous programs harder to understand or manage the problem is you're writing one piece of code and this code is running with parallel copies so in some line of code over here you might be changing a variable x equal to 10 and on another line of the same code you may have the variable X being set to 20. now if both of them run in sequence everything is fine but they could be running parallely or concurrently so they might overlap with each other and the problem here is you don't know whether X will end up being 10 or 20. there are many language constructs which are created by languages like Java golang recently there have been improvements in terms of rust rust has its own mutexes before you can actually take control of any variable and Scala uses just immutable objects so the idea here is that you have a lot of problems that programmers have to deal with uh during debugging or maintaining code which is trying to be addressed by language constructs but the benefit is so large the customers love low latency apps so much that it makes sense to do this some examples of concurrency as an engineer are going to be running some worker threads in your Chrome browser which are going to be doing background tasks this is not going to be you know taking up your main thread on the browser so the user has a more responsive web page to see another example on the server would be multiple parallel requests being sent to the database maybe these requests are not related to each other you might be making multiple requests to let's say the database and also to another service and another one to a file system so this would be asynchronous programming where multiple things can happen together so that's all I have for asynchronous programming if you are an engineer it doesn't matter whether you're front-end backend you should definitely know about the subject until next time see you

---

## 49. Impeccable API Design: What you MUST CONSIDER before deploying APIs to production
**Channel:** Gaurav Sen | **Views:** 30K | **Date:** 2 years ago | **Duration:** 8:29 | **ID:** FqljO9B5grM
**Link:** https://youtube.com/watch?v=FqljO9B5grM

### Transcript:
hi everyone this is gkcs in this video we'll be talking about application programmable interfaces or in short apis the key word here in this full form is interfaces the easiest way to think of this is functions you have a return type you have the method name itself and you have the arguments that you're going to pass into this function you can code in golang python in the back end and you can code in JavaScript and ASP on the front end and still it will work the best examples of apis that I have found is actually from the Indian government so you have contracts literally documents PDF files written by the government mentioning exactly what you're going to get as a response if you hit the assistance so how do apis fit in the larger scheme of things well firstly you have somebody who's going to call this API this green desktop over here which has loaded a web page the web page is let's say integrity.io and you click a button the moment you do that that's an action which requires some sort of data so the code running on your mobile device on your web page is going to use JavaScript to create a request object and send it across the wire the gateway then looks at what API has been called by this request I mean where is this request to be routed we have spoken about this in the previous video of API gateways you can expose apis using rest or graphql both have their pros and cons graphql is a little more popular these days because it just sends you the data that you need to get and you also need to just send the data that you want to change so that's pretty good rest has some other benefits like HTTP caching so you might want to use that also similarly you might have external systems which you want to connect to so if a payment has been made to PayPal then I want to know when the payment was completed and what is the amount right you know for what reason so this is done using web hooks which are very similar to apis but you subscribe to webbooks okay the benefit of this is that you don't need to keep pinging PayPal saying that you know do you get any payment did you get any payment it's not polling if you're going to get the response when there is a response so what makes a good API here's a checklist that you can use to just go through your apis and clear your code reviews with flying colors the first thing is atomicity autonomicity means that you do an operation either entirely or don't do it at all so if you are loading let's say a value to cash so you go to the database get that value put it in the front of the queue if it's a lru cache and then send a response if any of this fails in between then everything should fall back so when you got the value from the database and you were not able to put it in the front of the queue maybe don't give back a response Okay the reason I'm saying this for cash it's not that important but for some operations you have multiple things happening together and you want either all of them to go ahead or none of them to happen it's easy to debug such operations the second thing is idem potency item potency means that if you make the same request multiple times to the same system the operation is performed just once okay important to note is that if I say add 10 Rupees to my balance and then I say add 10 Rupees more it that doesn't mean that it won't go to 20 that will go to 20. but if I give a ID of 50 Okay id50 add 10 Rupees to my balance then I send the same request with id50 the server knows that I have already passed this request I've already done something with this request so I don't need to pass it again I can ignore all the operations that are to be done and give back a response saying it's a success I had done this earlier the third thing is errors errors are extremely important in fact they Define the adoptability of API like people are not going to use your API unless they feel like the errors are clear so clear error codes 200 means that everything is good anything in the 200 range 200 to 299 uh anything between 400 to 499 means that something went wrong and it's probably a permission issue or it's an issue on your side I couldn't find the object uh anything above 500 probably means that the server messed up maybe the service is down it's unavailable so that's the basic ranges these are common HTTP codes that you would be wise to adopt in your own apis the second thing is if you're sending back error responses please make them human readable one of the things that happens is you have this error and then you have all of the application stack printed out for the client to see that's firstly a security issue but the second thing is the client doesn't know what went wrong I mean did I send a null object somewhere now I have to run through my logs and check it's much easier to just tell them exactly what random okay uh and this is one step ahead you can have not just descriptive but prescriptive error messages and hey your username is too short we can't allow that in the system instead of saying username not allowed what does that mean you tell them what they need to do to get the thing done correctly this is especially useful if you have B2B Communications businesses are communicating with you which are they're going to open their logs and they're going to check the responses of your API right uh they don't have a UI to play with they literally depend on your error messages that's the only thing that they can see the some of the other things that you can do to make your apis smooth is uh use the open API specs these are really good uh using swagger usually does this automatically Swagger will also generate the documentation around the API like the basic documentation around it for you and if you need to test an API you can use Curl or Postman postman has this nice wrapper which is better than curl in my opinion of course uh Postman is a full-fledged UI so that you can test your apis now here's a war story which is a true story and unfortunately this happened when we were using a third party application to connect with aadhaar the system that I just traced so this third party application sucked to put it simply it was a B2B application in which case Engineers are expecting your error messages and your API responses to be correct okay to be according to the contract that you have mentioned unfortunately uh people were writing success sometimes with the capital sometimes the small sometimes in all caps so our back end was breaking because the string matching eventually had to be that match equals ignore case so that was same the other thing which was I think much worse was that we were getting responses with 200. so HTTP 200 means that everything is fine and the response was error username not found like if it's 200 the application will think that things are fine the client libraries which send HTTP requests get back responses and take that as a completed future as a you know like if you have a promise in JavaScript then that has successfully completed and these guys are going to send an error response in that so whenever you're sending responses please use the codes correctly the codes are extremely extremely useful because uh the other person's application might be depending on your error code not on the message that you have finally when we integrated the system we realized that the bytes being sent to this third party were being sent over the wire so this is aadhaar information so that's pretty confidential you can think of it as Social Security right you have your Biometrics being sent without encryption so we did that we had to talk with them this is a person to person thing it's not really that you write your contract but whenever you're reading the documentation you should check what they're expecting and if the expectation is weird and is not good for the users that you have on the other side do bring it up do let them know that in the documentation itself in the API itself I can see problems forget about your internal implementation so that's all I have for today I hope you write some good apis I hope you test them well and I hope you have the documentation written well so that the front-end engineers and other clients who are using your apis are super happy with the documentation and testing uh and if they're not then well you can tell them I'm working on it until next time see you bye

---

## 50. What is an API Gateway?
**Channel:** Gaurav Sen | **Views:** 83K | **Date:** 2 years ago | **Duration:** 15:02 | **ID:** RbMxB_Cyx6A
**Link:** https://youtube.com/watch?v=RbMxB_Cyx6A

### Transcript:
hi everyone this is gkcs in this video we'll be talking about API gateways this is a common design pattern used across distributed systems and across companies to accept requests which is basically expose your internal apis to the external world so before we start I just want you to understand where the placement of this API Gateway is in this architecture you have on the extreme right databases which serve you data you have on the extreme left these client devices which is mobiles and desktops but the API Gateway sits right here in the middle okay uh between payments posts and any other internal micro services that you have you don't want these microservices to talk to the external World directly you want some sort of extraction of common logic and you also want to bring in some security so one of the things that you can bring in is a guard which is like a Gateway and you want to expose the apis that payments and posts wants to expose to the outside world through this Gateway okay the benefit like we said is number one when requests come in here you can go for authorization is this user is gonna allowed to make this request to the payment Service uh you might make the argument that payments should take care of that logic but some kind of authorization authentication is common across services so that logic can be extracted out and put into the API Gateway itself the other thing you might want to do is you might want to transform this request so for example you have a Json request sent by all clients and this Json request has a lot of fields which may or may not be relevant to a service so clients don't want to change their code from time to time they don't also want to you know create requests according to each service they want to create generic requests for every service and just send that across but the Gateway can construct that request and see if a service like payments or posts wants that request in a particular way so you can transform the data you can massage the data you can add a user agent you can do lots of stuff here the other thing is validation just making sure that the request is correct or incorrect so the benefit of the Gateway is that it's talking to internal services so payments can tell the API Gateway that hey I want a request in this format these things are compulsory these things are not compulsory you could like I said expose this directly or when you get the request you can validate the request internally the benefit of doing this on the API Gateway though is that the request fails immediately you don't even get that request on your side so you may or may not do validation on the Gateway you could do it on the payment service also another thing is weight limiting this is a possibility I should put stars on validation and rate limiting because you may or may not do rate limiting on this side if there's a lot of requests coming in someone's trying to flood your server or DDOS attack API gateways are ideal to handle that attack to write codes so that you don't allow too many requests coming from one user whether maliciously or just because there's a bug in the client other thing is routing you get a request and then you have to figure out hey where does this request go to so if you have something like integrity.io slash learn that will go to the learn microservice slash something so that will hit an API in the learn microservice okay so in our example here you might have internet ready slash posts slash comment question mark comment ID equal to one to three so what happens here is that you hit the posts microservice and then you go to the comment API in the post micro service and then you also pass in this parameter one two three so post knows that I have to go to my database get that exact comment of one two three because the API of comment has been hit and then it gives a response to the API Gateway which turns to the client so that's how you do the routing here the benefit of this is that the API Gateway knows the routing exactly the clients don't need to hit different servers based on different requests they don't need to do any kind of DNS lookup they know one server hit it and it will figure out where to send the request to finally load balancing this is also a benefit a possible benefit I should say of gateways when the request reaches the Gateway it might see that there are multiple machines which are running the post service so you have five machines which are on your post service which one should I send it to so the one with the least load or maybe the one which got the request uh the earliest so you send a request to one two three four five the next request should go back to one because one got it a long time back so maybe the load on that server is low but depending on your load balancing policy uh you'll see the Gateway behave in different ways like I said this is also star it may or may not do this it might do this entirely randomly hit any node that you see um it might also be smart that it has a health check it knows that which nodes are live or not but after a certain period of time you're seeing that a lot of logic and a lot of complexities coming into this single Gateway it's like a like a super person so at that time you probably want to extract out some of this logic from the Gateway also and move it into different services for example this load balancing can be a different service itself and that could maintain the routing tables also so it would be a service registry now a lot of stuff happens when a person makes a request to a Gateway also it's not as simple as just hit an HTTP request and get a response uh firstly these gateways can scale horizontally so which Gateway should you hit is a question should I hit the API between India staying in India or should I hit the one in the US so it kind of depends because the US one is really far but if the Indian one is overloaded shouldn't I hit the US One this is tough and who's going to do the load balancing if the API Gateway is responsible for the load balancing so in this case uh there's a helpful system which is DNS DNS is not a part of your system usually DNS are part of the internet backbone uh these servers map domain names which is like api.integrity.io to an IP address so 192.1.1.1 so this is obviously not the IP address that we are at but if you type in a URL facebook.com integrator.io google.com this will map to an IP address which is literally a machine on the internet which can be connected to but remembering IP addresses is insane humans don't do that so you need a label for that IP address which is a domain name you can purchase this GoDaddy is a popular website I purchased it from there and then you need to have a DNS uh so something which Maps this domain to the IP address again GoDaddy does this because it's it's their business across this costs them some money uh this is like you renting out some land you're saying that this label is mine this trademark is mine nobody else can come to it but really there is nothing stopping a person from mapping any address to any other IP address it's just that everyone trusts GoDaddy and therefore when you make a connection request you usually connect with known DNS so if I come in and I am able to somehow hack into your computer or hack into your router and I force it to send it to my DNS I can take facebook.com and send it to my website okay uh this is harder than it looks but yes it is possible and so that's interesting just wanted to put it out that I don't know why the second thing is cdns before you connect to the API Gateway a lot of the load can be taken away by cdns these are content delivery networks the basic idea being that if you have anything which is static if you have images or video or things which don't change file information usually then you can serve that using a Content delivery Network the name is a little deceptive content will be networks are Again part of the internet backbone they are spread across the world and these are like small databases or small caches which can store all of your static data uh usually people put their web pages which are static and images and videos like we discussed in a CDN they're faster because they're close nearby uh when it comes to making a request you instead of hitting the API Gateway of the server you can just hit these cdns and get responses much faster there are certain challenges you might be thinking about hey how does live streaming happen if the data is being streamed live created live on this this service let's say a hot start then how is it being sent to the CDN very quickly so uh that's an interesting thing we have a free chapter on interview ready you can check it out but uh cdns are responsible for taking away a large part I would say 90 of the traffic that would otherwise go and hit a server especially for streaming and image heavy websites so that's how clients connect they hit a DNS figure out the IP address go and hit the API Gateway if they have some static information then usually the web page itself says that go hit a CDN URL which is packed by some sort of file store in reality if you have something like AWS this is what it looks like you have this Gateway service in the center but really 90 of your traffic will go to the CDN over here which in AWS is going to be Cloud front it's backed by S3 S3 is a file store you also have a DNS sorry AWS it's a big company uh called Route 53 and you can basically store your mappings from domains to IP addresses as you can see most of these Solutions are provided by Cloud solution providers gcp also has them Azure also has them AWS is the most popular uh and that's the reason why I'm showing you these and if you're setting up something for your startup or for your site project it makes little sense to go ahead and create these by yourself because uh unless it's a side project right and you're doing it for the heck of it you're doing it to learn things these Solutions are super scalable super tested uh it makes sense to focus on your product and your USB instead of going ahead and building these things again okay I want to leave you with a war story and one of the reasons why maybe API gateways is a thing of the 2010s now uh what used to happen is we were using an AWS Gateway and we're using everything else also over here s3n uh Route 53 and cdns cloudfront what happened is we had services in the back end which used to connect with the Gateway but one thing which is not discussed usually is that these Services have contracts the API is literally a contract so if you send the request you get a response but what if a new type of request has to be added what if a new API has to be added what if the API has changed so in these cases there is a change in contract and therefore the API Gateway needs to be informed of that and it needs to reflect those changes so how do you do that by restarting restart the API Gateway uh this is tremendously irritating uh not just for clients which will probably see their connections getting you know re-established it's developers who lose a lot of time if you have a person in the payments service okay I am working in the payment service I make a change in my API now I need to deploy this it's not just that I need to deploy my service I need to go and talk to the engineer in the API Gateway service and tell them please could you change uh some of the code in your in your gateway service so that is tedious eventually what you do is you have these setup dependencies which are client libraries for each service and what you tell them is okay there's this file out there in git it's a public file go and make those changes and when you deploy your service tell me to deploy mine and automatically I'll pick up the right dependency version okay even if you don't understand this at a high level just understand that you know you have a contract and the contract has a version so as long as you change the version of the contract my service is going to work fine I mean everyone will hit the API and see the new version come up and this used to happen for four five six services and you have continuous integration continuous deployments and so every time there was a deployment to be done on any of the internal services there was a restart required on the API Gateway and that's crazy right in fact one of the new Services came in emails which had a bunch of apis and a bunch of internal systems which were you know doing this and Gateway Engineers got crazy they used to spend like 20 to 25 percent of their sprint times just maintaining the service or just restarting things so one of the things that has happened is firstly you don't want to put in a lot of the logic of a lot of the services in this Gateway you can extract out load balancing like we said you can extract out even an outing to some extent uh rate limiting of course can be extracted out and you can put this in a sidecar it's part of the service proxy design pattern we'll talk about that some other time I'll share some links in the description but a sidecar can actually manage a lot of the common things that we were trying to stop into today okay the other thing is authorization you don't really need authorization in the Gateway you can have that as a separate service and if you need to Cache some of the responses of that service you can also do that this is explained in interview ready what happened now is that most of the startups and the medium-sized companies that I'm seeing are moving into service mesh and even better is that many of them are starting with monoliths they're just starting with I don't need a full-fledged API Gateway I just need an ec2 instance everything else is either going to be managed by AWS or is going to be in the same service so that's also an interesting development uh you know all the hype that we had around microservices is it has matured I would say so only people who need to use them are going and using them so thank you so much for being a part of this I really enjoyed talking about this critical system which is part of most dispute systems even now and it's really got its own pros and cons so depending on your architecture you would maybe decide to go ahead with it or go ahead with a service mesh like I said the bandwagon is not something that you want to sit in unless it's taking you where you want to go until next time see you bye

---
