# Steve Brunton Long-Form Transcripts

50 video transcripts.

---

## 1. Bayesian Updates and Conjugate Priors
**Channel:** Steve Brunton | **Views:** 4K | **Date:** 3 days ago | **Duration:** 17:38 | **ID:** GqSX-8AQL90
**Link:** https://youtube.com/watch?v=GqSX-8AQL90

### Transcript:
welcome back so we're talking about beian inference and in particular how we take a prior estimate of our model parameters Theta and update that estimate with new data X to get this posterior distribution this is kind of the central idea of beian inference in this beian update here uh and I want today to tell you about something called a conjugate prior which is a really really special type of Prior that makes this updating procedure a lot simpler okay um in general most of the time my likelyhood function my prior distribution and my posterior in at least in the machine learning context are probably messy distributions messy functions that don't have names they're not going to be beri or you know binomial or gausian or whatever they're going to be some weird distribution Based on data and those are going to be harder problems to do this update but in this simple case that my likelihood and prior distribution do have name distributions then there's a really really nice way of doing this updating uh based on this conjugate prior so I think it's important to understand how to do this in the case where we have SIMPLE distributions where things work nicely so that we understand how things break when we go into the more complicated case where these distributions are really nasty and we have to do machine learning or Monte Carlo or empirical distributions things like that so we're going to start in the case where things are nicely behaved and Simple and Clean okay and so the idea of a conjugate prior um I'll get to that in a minute the whole idea of bean uh statistics and inference is that instead of taking a probability model of of the likelihood of my data given my model parameters we do this beian inverse the statistical inverse and we're trying to estimate the probability of my model parameters given my observed data these model parameters could be the mean and standard deviation of a normal distribution they could be the probability of you know getting heads with a coin it could be the weights of a neural network um but what I'm trying to do is from observed data I'm trying to update my model parameters Theta and I want a distribution for those model parameters to do things like uncertainty quantification and propagation and forecasting and so the this is like the the basian uh inverse like this is the formula this is BAS formula and this P of X down here is essentially just a normalization constant to make this product a proper distribution with area under the curve equal to one so very often we write this in the following way we say p of theta given X this is my posterior distribution we say that this is proportional to the product of just the numerator terms the likelihood P of x given Theta times the prior P of theta and we kind of conveniently disregard this uh normalizing constant in the numerator that's uh you know you should think about why that's okay and why this is not that big of a deal but approximately speaking our posterior can be thought of as proportional to the product of our prior and our likelihood okay and this is going to be a really really useful approximation or idea that we're going to use time and time again is this kind of simplification here and so the idea is in this Bean update we have a prior we have some prior knowledge of the world some prior belief in our parameters Theta but we're going to keep collecting new evidence X new data X and we're going to be updating that prior into this so-called posterior the probability of theta given my new observed data X and so then once we have collected that new data point that posterior becomes the prior distribution for the next iteration and then I collect another data point and I update my my prior with that data I get a new posterior that becomes the prior for the next iteration and so on and so forth this is the beijan update we talked about earlier and so at each step we're basically going to be multiplying these two to get the new posterior and here's where uh this idea of conjugate priors comes in it's a really simple idea actually if I take my prior distribution times my likelihood to get my posterior it would be nice if my posterior is a nice distribution that's the same in the same family of distributions as my prior because this posterior is going to become the prior for the next iteration and so let me give a really really uh concrete example in the case of the coin flip um problem we're going to actually look at this python code in just a minute where we are trying to the probability Theta of it being heads so for a Fair coin that would be 0.5 and we're going to keep collecting new evidence of new coin flips we're going to observe heads and you know tails and and on and on and on every time we collect that new data and update our posterior then it's going to become the prior for the next iteration it would be very convenient if this posterior and this prior have this live in the same family of distributions if they have the same parameterized distribution so for the coin flip our likelihood function is a binomial distributed random variable the number of heads uh given n flips is a binomial distribution in fact maybe I'll actually even write that down so it's binomial so for the coin X is going to be uh what's called binomial uh with n comma Theta Theta is the probability of getting heads um so let's say 0.5 for a Fair coin n is the number of coin flips and you'll remind yourself that this equals n choose uh H the this is the total number of flips this is the expected number of heads Theta to the H uh 1 minus Theta to the N minus H this is literally the probability of the number of heads equaling some integer H that's that's this probability this is the likelihood function and it's a binomial distribution for a coin flip then the prior that is a good conjugate prior for this likelihood is called a beta distribution so then our prior should be Theta is distributed as a beta random variable and I haven't shown you what a beta random variable is yet in the next lecture I'll probably derive you know what the beta is and give some properties and show that it's a good conjugate um conjugate prior but it has two parameters Al Al and beta and it's defined approximately as you know the probability um of theta equaling some value given Alpha and beta is going to be some constant some normalizing constant this is just a number it's has to do with some gamma functions times um this value to the alpha minus one * 1 - Theta time to the beta minus 1 it's kind of a general ized probability distribution that's very closely related to this binomial distribution and this is what's called a conjugate prior and so here's what this means this means that if my if my prior is in a is beta distributed a beta distributed random variable and I multiply it by a binomial likelihood the posterior is beta again which means I can plug it right back in as the prior for the next iteration and it's still beta I mulp by by binomial it's beta again then I plug that in for the next iteration it's still beta distributed multiply by binomial and it becomes beta so that's the idea of a conjugate prior is essentially um a conjugate prior a conjugate prior U distribution will uh remain the same distribution when multiplied by the likelihood by the likelihood and that makes our calculations way way way easier uh when when this product is in the same distribution as the prior it makes this iteration super super easy when we don't have a nice prior that's that has this property this calculation becomes a mess I'm going to show lots of examples of how to deal with that but in the case that you have a nice name distribution like a binomial distribution there's often um a conjugate distribution that's a good choice for the prior and a beta distribution is a very flexible distribution has lots of properties that allow it to be very tunable so that this prior has a lot of flexibility of modeling different uh probability density functions of theta that are realistic for binomial distributed data so this is a good prior for this type of likelihood um another really important one is kind of if you have gausian likelihoods then gausian priors are conjugates so basically gaussians um are conjugate with gaussians that's a super important property um in the next video I'll probably show you that this is conjugate to this I'll probably actually go through and show that if you multiply these you get another beta distribution that's good to see and you can convince yourself that the same is true for gaussians if you multiply two gausian you get another gaussian this is actually easier to show and so these are two super super powerful classes of of of conjugate priors for two of the most important distributions there's conjugate priors for pran distributions there's conjugate priors for exponential distributions and in a future lecture I'll show you there's actually an Uber set of distributions where all of these are like special cases of this Uber distribution called the exponential family and that Uber distribution has kind of an Uber set of priors and so it's kind of a nice Theory at least when you have well- behaved named likelihood functions you can probably come up with a good descriptive prior that makes this update really really easy it's not a complicated idea this is really all that there is to it um and maybe right now what I'll do is I'll show you we'll go back to that example um of the coin flip that that python code and we'll just see how a beta distribution is super super easy and the the really cool thing about this um will build intuition over time the update when I update my prior so I literally take my prior times the likelihood of the new data this is the the new data evidence to get my posterior the way I update the the alpha and beta of my prior is I literally add how many heads or tails to to Beta or Alpha so if I get a if I get a head if my evidence is a head I add one to Beta if my evidence is a t I add one to Alpha if my evidence is three heads and two tails I add three to Beta and two to Alpha so it's super super easy to update this it's like trivial to update my prior based on new evidence with this particular pair of likelihood and conjugate prior so that's how easy it is the update is literally just like adding the evidence to these parameters and this distribution will like warp until it eventually is a pretty good estimate of the distribution of theta the probability of of my head my my coin being a heads let's fire this up and see what it looks like and in the next lecture we'll we'll do some math on the board okay so this is um the example we looked at before so this is just my python code um where we essentially are going to start with a uniform prior and the nice thing about the beta distribution is that if I have uh beta um with Alpha 1 and beta 1 this is a uniform kind of a uniform so I can start with a uniform prior of um beta equals 1 Alpha equals one and then I can update with sequential coin flips we're going to flip coin after coin after coin and it's is just done randomly here um I think you know I have um this sequence of coin flips down here heads Tails heads Heads Tails heads Tails head whatever um and you'll see this little code here Bean update that's everything happening down here basically you know we're going to see if we get heads or tails and we're going to add the number of heads to the alpha parameter and the number of tails to the beta parameter I think I must have told you unfortunately the exact opposite sorry about that like the number of heads gets added to Alpha the number of Tails gets added to Beta but it's that simple you literally like the number of heads is an integer and the number of taals is an integer and those just add to these parameters it's that simple to update uh my prior distribution and then um you know that gives me a new posterior and then that posterior becomes the prior for the next batch of data and that's the whole thing everything else is just you know code to plot and to sequence through a bunch of coin flips so let's run this thing okay so essentially um this nice little code here says you know after observing ahead now I've added one to my Alpha parameter after my second flip we got a tail so we add another one to our beta parameter after the third flip um it's a head so you add one to the alpha parameter and so on and so forth and then we are plotting this beta distribution this probability of of theta given that new evidence after each of these flips and you see that it starts with this kind of blue uniform and then it immediately starts to shape into this nice unimodal distribution centered at about theta equals .5 so this is very reasonable um of convergence to a reasonable uh probability distribution for our parameter Theta with very little evidence with eight coin flips okay um and and now you see that that to update this is Trivial because we're choosing a beta distribution for our prior a conjugate prior makes this trivial to update the parameters um so we can run our nice little code here now to do a 100 coin flips um and do the same thing and we're going to plot on uncertainty um of this distribution kind of standard deviations and means so let's just go here and make sure that's actually plotted I'm using this cool command um that animates it on the screen so you can use a slider bar to like watch the animation you could also save this as a gif or a movie if you wanted to but now we see here this is like the original prior distribution is just uniform with you know a mean at zero and some standard deviation and as we walk through as we collect more and more data very quickly this thing starts to become a nice unimodal you actually see early on probably there were a bunch of Tails Tails Tails probably a few taals in a row and then it starts to average out to something much more reasonable and you can also see that the um the variance or the standard deviation of the fit is getting Tighter and Tighter so here we're plotting uh the probability mean and it's one standard deviation plus or minus and you can see that it's converging to the true value of 0.5 and the variance is getting smaller and smaller this is really simple and every coin flip I'm literally just adding if it's a heads I add one to Alpha if it's a Tails I add one to Beta like all of that 100 lines of code is just to plot this the update is like one or two lines of code almost trivial okay and if you run this for even longer if you run a thousand coin flips you see that um you know eventually the distribution gets even tighter so same idea it gets Tighter and Tighter and Tighter um around this this average value of theta equals .5 so really really simple when you have a conjugate prior updating you know this posterior becomes kind of trivial this is in the same distribution as the prior and then the update also becomes trivial because this posterior because it's a beta distribution can now become the prior for the next iteration so this is hopefully a really simple example of why you want this notion of a conjugate prior um gaussians are conjugate to gaussians that's super useful beta is conjugate to binomial and there's a whole family of conjugate priors for a whole large class of name distributions we'll talk a little bit about that later I'll show you how to actually derive um this property and and what the beta distribution looks like and things like that in the next lecture and then we're going to go pretty soon what happens when we don't know these functions and we have to estimate them in a procedure called density estimation okay thank you

---

## 2. Bayesian Inference: Overview
**Channel:** Steve Brunton | **Views:** 13K | **Date:** 6 days ago | **Duration:** 30:16 | **ID:** XCEpIBqKogo
**Link:** https://youtube.com/watch?v=XCEpIBqKogo

### Transcript:
welcome back I'm Steve Brunton from the University of Washington and this is a new kind of short course on beijan inference in statistics and machine learning you can think of this as a piece of this broader overview of probability and statistics or this could be a standalone probably about 5 hours of dedicated material on uh this kind of beian inference uh that we use all the time in machine learning and statistics so this is the overview video I'm going to give kind of the mile high uh overview of what's the big idea in beian inference and how we can use this to take data and build models from that data probabilistic models uh and I'm going to in this lecture you know kind of give this overview of the big idea of ban inference I'm going to show you some really brief uh code examples in Python we're going to revisit these a lot later so I'm just going to give you a teaser um of how to do this in Python and then we're going to talk about you know the pros and cons of this approach and give a rough rough outline of what what you're going to see in this uh short course so I'm pretty excited um let's Jump Right In so the big idea here is in kind of classic probability what you would do is you would build some model of what you expect your data to look like the probability of of having some data x given some model parameters Theta so for example if my model my probability model is that my data should follow a g I or a normal distribution with some mean and standard deviation those would be the parameters and that would specify the likelihood the probability of finding my data at a particular value okay this is kind of the classic probability approach I'll just write that here this is kind of probabilistic and what beian inference does or beian statistics is it flips that on its head it says now what we're going to do we actually collect data from a system we have measurements of a random variable X some some process X That Is Random we have data and we're now trying to build an inferred model a probability model of what's the likelihood of finding a specific set of model parameters Theta given that data so this is what we call a statistical inverse problem in fact that's one of the ways you can think of basian Statistics this is kind of the basian or the statistical inverse is that probabilistically we have a model and we that gives us the likelihood of finding our data this particular value the inverse is we have data what's the likelihood of our model having the parameter values Theta and bean uh statistics is the way that we write down this probability in terms of the things we have so this is equal to the probability of x given Theta times the probability of theta itself divided by the probability of X now I have derived this before um carefully in a previous video using conditional probabilities so I'll put a link to that if if this looks unfamiliar to you but this should be a pretty familiar concept at this point this is essentially the beian way of writing this this statistical inverse uh in terms of things that we might actually be able to measure um and so we know that P of x given Theta this is what we call our likelihood it's literally the like likelihood uh of the data given the model parameters P of Theta is what we call the prior it is our prior beliefs on this distribution of theta so we might have a really strong prior we might have a lot of preconceived notions about what this Theta is or a very weak prior very loose preconceived notions so for example if I look at a Fair coin like this quarter my strong prior uh on the probability of it being heads is that it's a fair coin and the probability of it coming up heads is about 05 or 50% so I'd have a pretty strong prior potential for something like a coin good um so that's the likelihood that's the prior and the thing we're trying to estimate this the statistical inverse is called the posterior um and this is kind of posterior and so beian statistics and basian inference is all about the prior how do we bake in prior knowledge how do we quantify prior knowledge about our probability distribution and then how do we update that prob probability of theta given new data or evidence X okay so that's the whole name of the game is building some prior distribution some prior beliefs into the statistical estimation and then updating those prior beliefs the posterior is literally my updated prior given some new data X and I could either get a batch of new data and update my my uh my posterior distribution or I could get my data you know sequentially I could flip a coin one at a time and every time I observe heads or tails I could update my distribution about what I think Theta is for that particular coin okay and in particular this is this gives us like an an iteration algorithm kind of um you know an optimization algorithm so that hopefully we eventually converge to a good distribution of the parameters Theta that are most consistent with that data X so that's the the name of the game we're going to demonstrate this on a number of cool examples that are uh simple like the coin flip example all the way to more relevant problems like linearly squares for data fitting and things like that and this is a Cornerstone idea in modern machine learning this is used all the time uh in machine learning so I'll point out um and maybe I'll mention here this is kind of the you know if this is the probability framework probability of data given model then the statistics version of this is the probability um of the model given in the data that's that's the statistical inference or inverse problem um good and um a couple of things I want to tell you right now is this so I I want to tell you kind of the pros and the cons of this approach and I also want to give you some idea of like what's a good prior how do you do this updating things like that so in principle um this is all about the prior P of theta that that's really like the the the heart ofan uh inference is that it allows you to take data which is evidence and prior beliefs and balance these two things so that's the first thing it's kind of uh maybe I'll do this in yellow so the first really big kind of idea here and Advantage is that beian statistics allows you to um balance what we would call our evidence or our data so our data um X maybe I'll do two colors here so our data X and our beliefs our prior beliefs uh our prior beliefs which we're going to call this uh P of theta okay and the good news is that in the beian formulation you have some flexibility in both it's not like I'm stuck with my prior beliefs and I'm dogmatic about those I can update those with new data and I'm also not stuck stuck looking at my data and only having that be my model of the world I do come in with some prior beliefs about the world that can make me more robust to maybe an unlucky draw of data so a really really simple example is if I take my Fair coin and I'm doing something frequentist if I'm doing something like a maximum likelihood estimator and let's say I flip the coin three times and I get a heads and I get a heads and I get another head so three heads in a row then in the kind of nonan world my estimate of the probability of heads Theta using something like a maximum likelihood estimator if I had you know heads heads Heads an mle a maximum likelihood estimator would say theta equals one the probability of heads is one and it would predict that all future coin flips are going to give heads which is kind of absurd it's kind of a comical example of how bad these uh these nonb approaches can get if you have an unlucky draw or a small sample size but Bean statistics and inverse is much more robust to this because you can go in with some prior knowledge I think my coin is probably Fair that's my prior and so even if I see three heads in a row I know that's you know it's not that unlikely given a Fair coin and so that doesn't shake my belief uh in the world if I got 50 heads in a row or a predominance of heads in a row that would be enough to update my my model of Theta and eventually I would start to believe that this is not a Fair coin but that would take some time based on my prior beliefs so that's the real ideas is that you're getting to balance these two and it's a really clever um approach it also allows you in the machine learning context you can have prior beliefs like physics I believe that the world is governed by physics I believe that there are you know it's a way of incorporating other prior knowledge like physical constraints and beliefs and things like that into sparse data context so if I have few samples but I know something about physics then a beijan approach can be a really really nice way um to balance that sparse data and my prior beliefs in a machine learning context so we'll talk more about that as well good um and then the uh kind of second clear benefit of this all the second clear benefit is that we get a distribution for Theta we don't just get a point estimate like theta equals 1 for a a maximum likelihood ES we get a whole distribution for what Theta is likely to be so we get a distribution a distribution for uh and I'll do this again in in blue for Theta and that distribution for Theta the fact that um you know my Theta might be in this case you know some gausian centered at 0.5 for the coin that allows me to propagate that uncertainty forward into into the future so I can use this in a dynamical systems context like let's say I'm doing weather prediction or climate prediction I can take my uncertainty my my kind of P of theta and I can forecast it into the future and see how that uncertainty grows in the future very useful for forecasting for uncertainty quantification lots and lots of things um and it allows me to make decisions under uncertainty because I don't just get a point estimate I know how how much spread how bad that estimate is how confident I am in that estimate that's all really really useful okay so I want to give you a code example here these are the benefits I'll tell you the disadvantages soon um but I want to show you a code example of actually doing this for the coin flip example and the last thing I need to show you um to do that is to introduce this notion of a Bean update so let me just do that really quickly um the idea is so aan update uh ban update this is a really really cool idea that if I have a system and I have some prior belief about the model some prior model some prior belief about the the parameters of that distribution and I start collecting data let's say we're going to do this coin flip example so I start collecting data I do coin flip after coin flip what I can do is each sequential time I gather new data I can take the likelihood of getting that data given those parameters that I I think I have times my prior divided by this total probability this is just a normalization constant to make this have a probability one so I can take my prior times my likelihood and I can update the probability of my parameter Theta given that new data point and then after I've collected that new data point and updated my probability of theta it can become the prior for the next iteration then I flip another coin and I get a new data point x and I can update that new prior into a new posterior and that updates my probability of my model parameters my model parameters Theta update the distribution of theta updates and then that becomes the prior distribution for the next iteration that's called a Bean update or an iterative process and it's really easy to write so what we would say is that at time step uh k+ one so we're going to have like you know we're stepping through this procedure we're collecting data um sample one sample two sample three all the way up to sample K k+1 dot dot dot so at sample k+1 the new post ior P of theta given X this is k + 1 is equal to uh the likelihood given my model uh at K times my prior distribution at time step K divided by P of X at time step K okay that's really simple that just means after I have one new sample my my K sample allows me to update my posterior and then this posterior distribution which is is a distribution on Theta becomes my prior for the next iteration the next data set I get and so the way we write that is we say p of theta k + 1 equals so my prior in the next iteration the K plus one iteration is my posterior Theta given X in the current iteration okay and what this does is this allows me to step through from k equal 1 to 2 to 3 to four and so on and so forth Gathering new evidence and to to build my posterior to update my my estimate of theta and then that posterior becomes the prior for the next iteration really simple idea this is just like when we do numerical time stepping in differential equations um it's the same basic idea we're updating and then iterating through this this procedure and we're going to talk a lot more about this um good examples of P's and Etc like what what are good prior distributions for a certain likelihood we'll talk all about this um in detail soon but I want to show you a code example to give you just a really really rough thumbnail sketch of how this works and kind of a teaser of some of the things we're going to look at in the next few lectures so let's uh fire up our Jupiter notebook and get going and I think I left myself a little bit of working space here for my head um okay so the first example and again we're going to talk through all of these examples soon and and and build this up so you don't have to like fully understand everything that's happening here and you can download this and play around with it yourself but the idea here the first first first demo what we're going to do is we're going to do a beian hypothesis testing we're going to use beian inference for hypothesis testing and the hypothesis is literally going to be is this coin Fair meaning it has a 50% chance of heads or tails or is it a biased coin an unfair coin and in this really simple cartoonish simple example a Fair coin is defined um as having probability .5 of returning a heads and an unfair coin the notion of an unfair coin is a coin that um I think has what is it a three CH a s uh a 70% chance of flipping heads and a 30% chance of flipping coins so in this kind of um scenario there are two types of coins there's a Fair coin with a 50/50 probability and there's an unfair coin with a 7030 probability let's say I have two coins in my drawer and I don't know which one I just picked up and these are the two options and now what we're going to do is we're going to flip that coin and every single time we flip that coin we're going to accumulate that information uh that data X to update my estimate of the parameter Theta which would be 0.5 if it's a fair coin and 7 if it's an unfair coin okay and so this is a really really simple way of doing it we'll we'll talk more about this later but the basic idea is you have to build this likelihood given the data you have um you know your prior um given those two hypotheses and you update your posterior for each new coin flip and we're starting off with a probability of hypothesis one being a Fair coin of 0.5 and a probability of hypothesis 2 that it's a a biased coin also being 0.5 and we're going to see as we flip coin after coin after coin these probabilities are going to shift and we'll learn if it's actually a fair coin or a biased coin and so we're just going to run this code it's it's already run um and basically you can see these probabilities converging so after you know uh the first flip it's slightly more likely that it's a fair coin after the second flip it's even more likely that it's a fair coin and flip after flip after flip you see that the probability just increases for hypothesis one until it's very clear that this is in fact a coin that that uh that is fair and there's almost 0% uh probability that the Theta is consistent with the unfair coin so this is just a cartoon of this iterative Bean process where you collect data and update your prior you collect data and you update your prior and over and over and over again this converges very quickly to a good estimate of um of the truth and here our our kind of Prior was just equal likelihood of it being fair or or biased which is kind of cool so the next example we're going to do I'm just going to walk you through these and then we're going to spend time developing these later the next example is slightly more interesting so now what we're going to do is we're going to say you know I have a coin and I have no idea of if like what the probability of heads or tails is it could be 50/50 703 65 35 802 it could be anything any you know kind of percentage of heads versus Tails for Theta Theta is literally the probability of flipping heads and then by accumulating data sequentially over and over and over we'll see that whole distribution um our prior distribution converge to something that is reasonable so in this next example we're going to do the same basic idea um we're going to flip a bunch of coins and we're going to go sequentially and take that data and update our prior into this posterior then that's going to become the prior for the next data set we're going to update it with our new coin flip and then that's going to become the prior for the next one and so on and so forth it's basically always going to be a for Loop and here um there's an important point we're going to come back to later which is there is this notion of a beta distribution let me see where it is in my code um so essentially we're going to use something called the beta distribution to represent our prior um and there's a reason we do that it's because our likelihood function for the number of heads given n coin flips is a binomial distribution and given a distribution for the likelihood there is a family of what are called conjugate distributions that are really good choices for the prior so for binomial the conjugate is called a beta distribution I I'll have a whole lecture deriving beta showing that it's a conjugate prior and whatever but it basically means that if I have binomial for the likelihood and I have beta for the prior then when I multiply these two together I get another beta distribution which means that it can plug right back in as the prior and multiply again to get another beta distribution plug right back in So this notion of conjugate priors makes it really really easy to do this updating um I'll show you how to find conjugate priors and I'll also show you what to do when you don't have a nice distribution and you don't know what your prior distribution should be but for here for coin flips it's a beta distribution so we're going to use beta distributions so let's just look at the output of the code we'll we'll derive this all later um in this example what we're going to do we start with this coin we pretend that we're like an infant flipping a coin and we have no idea what a Fair coin is we have no idea that it's 50/50 probability of heads and tails so we start with the prior distribution that is uniform uniform is in the family of beta distribution so it's a it's a it's a beta with a particular parameter value I think beta with alpha 1 and beta 1 is is a uniform distribution so we start with a uniform prior and then we start flipping coins and maybe we get a heads first or a Tails first and you can start seeing that you know as you ACC acculate that information I think for the first one it must have been a heads because this thing is skewed towards heads and then it starts to kind of as it collects information after flip after flip the distribution starts to converge to a relatively nicely behaved probably it's binomial or something like that distribution that seems to be peaked at a probability of 0.5 which is what we know Theta should be for a Fair coin so you can see this this kind of process of updating my prior with evidence and the and so essentially this is you know the posterior after each piece of data is collected then that becomes the prior really really cool idea you can even uh make a cooler animation of this so I can collect you know hundreds of of coin flip data and update it this is like a little bit more sophisticated coin with uh code with some plotting and here I've actually made a movie of the distribution and the average value the mean of that distribution with error bars with one standard deviation error bars so you can see that very quickly this thing starts to kind of converge to something that makes a lot of sense and you can also see that the error bars get smaller and smaller and smaller and it does Jiggle around because you know maybe I got a few heads in a row and it tilts this distribution eventually this will converge to a very very tight distribution I'm pretty sure I have that code too uh if I collect you know a thousand coin flips this will eventually converge to a very very very tight distribution centered around the correct value of theta equals .5 so this gives you a very intuitive kind of pictoral uh understanding of what's Happening Here in this Bean inference with this Bean update as I collect more information my my post my prior gets updated with that information over and over and over again and that gives me a Tighter and Tighter and Tighter distribution with less and less uncertainty uh for my parameters Theta really really cool idea very very useful and again it allows you to do this kind of mix of balancing uh data with your prior beliefs super powerful idea okay so where is this going we're going to develop those codes show you a lot more examples of when it breaks how it breaks um things like that so where is this going um maybe the the next thing I'll do is I'll just show some of the the downsides the disadvantages so the drawbacks these are the um advantages advantages there's some drawbacks so the drawbacks um are similar and related so if prior information is a strength it's also a weakness um so one of the big weaknesses is sensitivity to the prior um if you have a bad prior you have essentially a bad beian inference you need good priors to get you close so that you can kind of update uh in a smart way the coin flip example is a little misleading because you can start with basically any prior and it'll converge to the right distribution that's a property of like binomial and beta it's a really simple example in most of the real world in machine learning applications if you start with a bad prior it might really mess up your eventual estimate of theta so sensitivity to the prior is a big deal more than just sensitivity it's also very subjective um it's also subjective often times um when I pick a prior that might just be what I think the world looks like I might be building a prior sometimes people tune they hyperparameter tune over families of priors to get better fits that almost feels like cheating but there's this big sensitivity and subjectivity to the priors um and it can be you know hard to choose a prior and things like that that's a big one um another disadvantage of the beijan perspective is the computational complexity um the complexity especially computationally um these things can get very very very expensive especially if Theta is high dimensional um or if my model my likelihood is a very complicated function um you know some hierarchical probability model then the complexity of this computationally might be very very high um usually the posterior cannot be calculated analytically like in the example I should with the beta distribution there's like a really simple analytic update that I'll show you most of the time in most machine learning applications this is actually very hard to calculate and so we have to resort to things like um Moni Carlo um essentially bootstrapped estimates bootstrapping um and things like that um which are computationally expensive and difficult to implement in practice okay um and this is especially true when we have high dimensional parameters so this suffers from the curse of dimensionality um which we'll talk about also which means even moderately high-dimensional parameter spaces become computationally intractable very very quickly um so sampling this posterior um distribution becomes very expensive when you don't have when you have complex likelihoods um and high-dimensional parameter spaces and there's more and more and more there are solutions to these in the modern machine learning era there's a lot of solutions to these Monte Carlo is a big one we're going to talk about um sometimes we don't know the likelihood or the prior and so we'll do something called um density estimation instead of saying this is binomial and this is beta we're going to say this is the sum of some gaussians so a gausian mixture model um is another you know a gausian mixture model and density estimation uh density estimation for uh unknown P of theta and P of x given Theta and dot dot dot so if you have unknown distributions you can use this density estimation uh gausian mixture models is a popular one another one is called kernel density estimation um kernel density uh estimation KDE you'll see this all the time uh in machine learning and I'll actually give you an example for that coin flip we'll pretend that we don't know these distributions and we'll use a kernel density estimate to still do this ban update procedure and it works pretty well but that's like a one-dimensional baby example so this gets really hard in high dimensional parameter spaces like machine learning problems like this Theta might be the weights of your neural network your model might be a neural network and this might be a bunch of Weights this all becomes pretty intractable pretty easily and there are wraparounds and fixes and patches but I want you to know that this is not all kind of fields of roses with basian Statistics um Baye is one of the most popular perspectives in machine learning and I'll be honest I don't usually think about the world this way I think it is very useful and it is powerful sometimes it helps you with small data sets when you know something like physics or prior beliefs that's actually really cool but it's not you know the Silver Bullet for all cases like some people will tell you it is okay um it's especially good when you have small data or when you have complex probability models complex models complex likelihoods complex um models then beian uh inference and statistics is particularly good in these cases so for small data sets you need prior beliefs to regularize that data and for complex models um you also you know this is a very flexible modular approach here so things like climate modeling like literally modeling you know what the temperature of Earth is going to be like in 50 years um that climate problem is a great candidate where you know we do have we have one essentially uh example of Earth we have simulations but we have one true Earth um and we have very complex models so beian approaches are a great you know uh idea in climate Sciences okay anything else I'm going to tell you um this is the big picture so in the next few lectures we're going to talk about the baby case the easy case where we know the likelihood and we can build a nice family of conjugate priors to make this iteration uh easy we'll do that with the coin flip where this this is binomial and this is beta then we'll pretend that we don't know and we'll use kernel density estimation and Monte Carlo uh sampling to do this update so we'll show those and then in a whole different example we're going to do the same kind of basic idea of basian inference for a linear leas squares problem so if you have a lease squares problem where you assume gausian noise will show how lease squares maximum likelihood estimation and bean approaches compare and contrast and are similar and different okay so that's all coming up hopefully this is useful for you it's been pretty useful for me to remind myself about this stuff and kind of remember that actually beijan inference is pretty cool and pretty useful uh if you have uh you're balancing data and beliefs okay thank you

---

## 3. Properties of Chi-Squared and Student's t Distributions
**Channel:** Steve Brunton | **Views:** 4K | **Date:** 3 weeks ago | **Duration:** 10:10 | **ID:** so04ygeccwk
**Link:** https://youtube.com/watch?v=so04ygeccwk

### Transcript:
welcome back so hopefully in the last few lectures I've motivated why we need the students T distribution and the Ki Square distribution they're super useful for hypothesis testing um for for testing various hypotheses so the students T distribution is kind of a small n uh analog of the normal distribution for hypothesis testing if the mean of a distribution has changed when we don't know the the true standard deviation or variance and when we have small n we need to use the T distribution Kai squar distribution is super useful to test if two hypo two two distributions are the same if some data came from a distribution or not we use the Ki squar test to test uh that hypothesis I should mention that the kai squar test is what's known as a likelihood ratio test and those T they're related to maximum likelihood estimat um and they tend to be kind of optimal hypothesis uh hypothesis testing um test variables but that's that's a whole different topic that's pretty Advanced um you'd have to show that this data follows a multinomial distribution and that this is like the likelihood ratio test for that multinomial distribution that's kind of an advanced Topic in statistics I'm not going to cover that but just so that you're aware so in this lecture I'm just going to tell you facts about the T distribution and the kai squ so you know things kind of like you know this being a likelihood ratio estimate or or a likelihood ratio test um what do I want to tell you so I want to tell you about the Ki Square distribution first so um okay we know that if Z is a standard unit normal variable if Z is a standard unit normal then we know that the variable Z squared this is a random variable then the square of that random variable I can take functions of random variables this is equal to a Kai Squared Distribution with one degree of Freedom we have already had a lecture where we took this was when we were talking about functions of random variables we literally took um the PDF of a normally distributed variable we squared that variable and we showed that it has a new distribution and we called it the Ki Square distribution with one degree of Freedom so if we have a bunch of these variables U1 all the way up to unu n and all of them are Ki squared with one degree of Freedom the sum of all of these random variables U1 plus dot dot dot plus unu n this new variable we'll call it sum of UI this one is also Ki squ distributed but it's distributed as something called Kai squar with n degrees of freedom so this is how we Define a Ki Square distribution with n degrees of freedom it's just the sum of N kind of simple Ki squared distributions where each of these is just the square of a normal variable okay so this is where Kai squ kind of comes from and these higher degrees of freedom Kai squar are just the sums of lower degree of Freedom Kai squares okay and if I take Ki square with 3 degrees of freedom plus Ki squ with 5 degrees of freedom I get k squ with 8 degrees of freedom it's kind of a nice distribution in that way um and one of the other really important properties of Ki squ that you need to know I'm just I'm just kind of telling you stuff here um if you have this sample variance uh SN squar that's the sample variance divided by the actual variance of a like gausian and if I multiply this by n one this sample variance is a random variable because it's literally built out of my random my my my sample data X so this is a random variable this object here the sample variance divided by the actual variance the true variance times you know the sample size Factor this is distributed as Kai squar with n minus one okay that's a pretty useful um useful property that you should just just be aware of this thing is distributed as ki^ squ um it's pretty messy to show this it's actually really messy to show this if you really wanted to prove that these things are distributed a certain way you would use their moment generating functions you would show that these are equal the moment generating function of this and this are equal to each other that's how you would actually do it so that's another um kind of important property what are some other properties I want to show you um other properties so yeah I guess this one's pretty important Kai squ is a special case of a gamma function so a Kai squar n distribution is a gamma uh n over two and uh 1 over two so gamma distribution had two variables n/2 and 1 over two sorry uh sorry the gamma distribution has two parameters and if you plug in n/2 and 1 over two then this special case of the gamma function is the Ki Square distribution again you you can show this using moment generating functions or the PDFs um you'll remember that the gamma distribution this gamma distribution um it's essentially the waiting time uh the waiting time for the arth event of a Plus on process the arth arrival of a Plus on process arrival of a Plus on process and so it's essentially equal to the sum of a bunch of exponential distributed variables Omega 1 plus Omega 2 plus dot dot dot plus Omega R where these are each R exponential functions uh exponential random variables this would be gamma of our comma Lama Lambda this is gamma of R comma Lambda where R is the number of exponentials we're waiting for and Lambda is the degree of freedom of the Plus on process now why the kai Square distribution is related to this interpretation of the gamma that's a pretty weird fact that's not obvious at all but this gamma function which happens to be useful for these waiting times of Plus on processes is also useful for the Ki Square distribution the Ki Square distribution is a special case of the gamma distribution with these parameters and you might think through why is this how are these related it's pretty interesting um we know that the Plus on process is the limit of a binomial distribution and some limit and the gamma distribution the Ki squ is kind of related to multinomial distribution so Plus on is related to binomial distributions this is related to multinomial distributions there's some pretty deep connection there it's going to take too much time for me to to kind of tie all of those loose ends together so I just want you to know this fact maybe I'll have a video actually showing you know why this is true later it's kind of interesting okay um and then the last fact I want to show you I think it's the last fact is that the T distribution any okay any Z that's normal 0 to one standard unit normal and x s squared that is a Kai Squared Distribution with uh n degrees of freedom then this is a weird property but it's true then Z divided by this x^2 Over N square root this is random variable Z is normal x^2 is k^ squ this random variable is distributed as a student t with n degrees of freedom okay that's another interesting fact it's a weird fact but now I'm going to tie it back to to these properties here okay so um you can actually relate this to this this variable is a standard unit normal okay and if I take this divided by this you're going to get a factor which is essentially SN 2 over Sigma squ which is a Ki Square distribution so um that's where this Ki Square distribution normalized by n comes from so if I take my normal variable Z divided by the square root of this over n you can show that that's equal to this this and this is a t distribution with n degrees of freedom or I guess in this case it's n minus one degrees of freedom pretty interesting stuff so these are just things you should know about Gamma uh Kai Square distributions and T distributions but it is related to these very important test statistics that we've been building um for hypothesis testing so just things I wanted you to know this is kind of an advanced you know just details each of these requires pages of you know proofs and work to show that it's true but I'm just showing you these facts because we use these distributions a lot over here okay thank you

---

## 4. Hypothesis Testing Revisited: Normal, t, and Chi-Squared Distribution Tests
**Channel:** Steve Brunton | **Views:** 4K | **Date:** 3 weeks ago | **Duration:** 10:37 | **ID:** u793OrRvZBk
**Link:** https://youtube.com/watch?v=u793OrRvZBk

### Transcript:
welcome back so we've talked a lot about hypothesis testing and we started off with pretty simple examples but very quickly uh we built in a lot of complexity with the T distribution and the Ki Square distribution and so here I just want to do a really quick recap summary overview of hypothesis testing with the three main types uh of testing that we have discussed so far because this can be a little hard to kind of straighten out all of the details when to use what how but I want to kind of point out that hypothesis testing has a really simple kind of procedural uh formula and knowing when to use what test statistic for what hypothesis is actually not that complicated okay so we started with the most simple kind of hypothesis test which is uh it's literally called a simple hypothesis as opposed to a composite hypothesis where the hypothesis we're testing is we have some data X um some some samples from a system and we're trying to test the hypothesis does it belong to a normal distribution with uh a mean mu and some variance Sigma squar so the reason we use this was for example um to test the hypothesis you know did some drug or medical intervention change the mean of a population or did some you know marketing campaign change the average number of web traffic or you know average clicks per per day something like that but generally speaking that is a type of hypothesis um does my data adhere to a normal distribution with a mean mu this mean mu would be um you know in the case of um in the case of the medical example we're testing did this intervention change the mean and so the hypothesis the null hypothesis h0 is that the mean was unchanged that X actually comes from a normal distribution with my previous mean mu this is my kind of control group mean or my before treatment mean and if we have data X that's different enough we will be able to reject this null hypothesis and make some statistical assertion that that new data actually has a different mean that's that was the first hypothesis testing we looked at and the test statistics so all of these T's are what we call our test statistic we build a test statistic from our actual data we collect data an ensemble of n samples of data I equals 1 to n and the test statistic for this hypothesis for this null hypothesis is the sample mean xar just the average of all my data minus the nominal or putative mean mu divided by Sigma over root n where Sigma is the uh standard deviation of the distribution I'm comparing against and root n is square root of the size of my sample of data we've shown from the central limit theorem that this test statistic should follow a unit standard normal gausian distribution and so what essentially that means is that I can draw this standard unit normal I can I compute this test statistic from actual data this is a number a number little Z and what I can do is for this hypothesis I can define a P value a significance value let's say I want a p of .05 meaning I want to be 95% sure before I reject the null hypothesis I want strong you know I want statistical significant data significant data to support you know rejecting that null hypothesis and I can define a rejection region if my data if my test statistics Z is in this rejection region then I can reject my null hypothesis with that that P value that's that level of statistical significance so if my P value is 0.05 then I kind of have a 95% confidence in rejecting you know that that if I reject my null hypothesis I'm actually right okay and so you literally calculate this zv value based on your actual data um and you you know you see where that zv value lives with respect to this standard unit normal and if it's in the rejection region we say we reject the null hypothesis I'm just saying how we say this we reject the null hypothesis and that means that the alternative hypothesis that the treatment worked at change of the mean is true with some statistical significance given by the P value associated with this rejection region that was the most simple kind of hypothesis testing we've done so far now we have shown that this kind of assumes that we have access to Sigma the standard deviation of the actual distribution we're trying to compare it against and if you have access to Sigma nothing changes you do this this you know you build this test statistic it follows a normal distribution you build a rejection region and you test the null hypothesis okay nothing strange but if I don't know the variance or the standard deviation of my distribution if I only know mu then I have to do what's called bootstrapping this standard deviation this Sigma so instead of this Sigma here I have to replace it with SN which is called the sample standard deviation this is an approximation of Sigma that I compute from my data I literally compute the sample variance and I take its square root and that's SN this test statistic this test statistic if I don't know Sigma if I have to bootstrap it from the data this follows the students T distribution with n minus1 degrees of freedom now this T distribution looks a lot like a gaussian and for large n it actually converges to the normal distribution but for small n it has fatter tails and so its rejection region might actually be different I might actually get a different uh result if I use this rejection region versus this rejection region so for example if I don't know Sigma and I have to bootstrap it and I use a I don't have a large number of samples if n is small then I have to use the student T distribution and similarly I can build a rejection region based on this probability density function you know same P value let's say p equals 05 but now my T value might be just to the left of that rejection region and in this case we say that we fail to reject H knot which means that that we don't have enough statistical evidence to reject hot so H knot for all our intents and purposes we have to consider it a a a possibility that H knot is actually true that the mean did not change that the treatment did not work okay um and so this little difference in the the fatness of this tail for small n can make the difference between accepting or rejecting the null hypothesis so it's actually important okay and then the third type of hypothesis um that we've been testing is a really really cool and I really like this one it's whether or not our data does or does not belong to a certain distribution so here we're just trying to test did the mean change but down here we might want to test does it even belong to that to that distribution in the first place is my data normally distributed at all is my data Plus on distributed at all and so what we do in this case is we bin up our data and we bin up our distribution we build histograms essentially of the data and the distribution and we compare bin by bin the values The observed value and the expected value bin by bin and we compute this test statistic we call it X2 and this follows a Ki squar distribution with n minus one degrees of freedom so same idea I compute this test statistic and I can literally this is a number and I plot it in my Ki Square distribution I have a rejection region same P value same significance and if I compute this um test statistic called the Pearson Kai squ test statistic maybe my value lands here and it's not in the rejection region so I fail to reject the null hypothesis which means in fact that the null hypothesis is likely to be true and my data did come from that distribution so this means that my data did come from the distribution which is really cool so that's another hypothesis we can test okay um that is kind of the big picture overview of how hypothesis testing Works in these different cases I just wanted to put them all next to each other so you could see you know it's not like we're doing totally different things it's the same procedure you have a hypothesis a null hypothesis the opposite of this is our alternative hypothesis you build a test statistic from data and different test statistics you know depending on what we know and what we don't know what we're testing but you build a test statistic that test statistic has some distribution that we know and then what you do is in that distribution normal student t or ki^ squar you design a rejection region based on some significance value some P value and you calculate did my test statistic lie inside or outside of this rejection region if it's inside the rejection region you reject the null hypothesis and your alternative hypothesis is is likely to be true if you're not in the rejection region then you fail to reject the null hypothesis and you don't have enough evidence to say that that's this null hypothesis is not true cool okay really nice um just a couple of facts I probably want to tell you some things about the T distribution and the Ki Square distribution I'll probably do that in the next video because I'm guessing this is already getting long um but in the next video I'll just write down a couple of properties of this distribution and this distribution I'm not going to prove anything I'm just going to give you some brief hints some trail of breadcrumbs as to where these come from what they're related to some some things you should know about these distributions but this is why we're going to look at these kind of exotic distributions okay thank you

---

## 5. Student's t-distribution in Statistics
**Channel:** Steve Brunton | **Views:** 5K | **Date:** 3 weeks ago | **Duration:** 16:39 | **ID:** kQoPUR0hQNo
**Link:** https://youtube.com/watch?v=kQoPUR0hQNo

### Transcript:
welcome back okay so today I want to tell you about a really important distribution called the students T distribution which is particularly useful when you're going to you do hypothesis testing but you have a small sample size n so we know that if we have a relatively large sample size n then by the central limit theorem the sum of random variables of a bunch of identical random variables will converge to a normal distribution but for for small n there's kind of a correction that we need um and this is going to be related to the students T distribution so I'm going to derive kind of why we use it I'm going to show you in Python that as n increases the T distribution actually converges to the normal distribution you would expect from the central limit theorem um and that will be useful for hypothesis testing uh T distribution is actually useful for lots of other things but I'm thinking about it as something you need to know if you're going to do hypothesis testing and you have a small n often times instead of a normally distributed test statistic you're going to need a t distribution distributed test statistic okay so you're going to want to set up your rejection region based on this distribution instead of a normal distribution if you have a small sample size okay let's get into it and I'll point out um student the student T distribution um this is actually um this paper where this was introduced was published under a pseudonym student and that's why this name stuck okay so let's jump in um so let's talk about this in the context of a hypothesis testing problem so imagine we're testing a hypothesis so uh we are testing testing a hypothesis and let's say that the hypothesis is a simple hypothesis that after some some manipulation or some treatment the mean of my population has changed we've done this before we've looked at this kind of basic hypothesis test so we're testing the hypothesis um that after some uh kind of manipulation or modification some manipulation to my system the new parameter the new expected value is different than the old expected value um the mean of the system me has changed okay so for example um maybe I have a factory and I'm outputting parts and those parts have a certain you know expected success rate um of not failing um or not being recalled or whatever and I do something hopefully to improve the yield of my factory that would be a hypothesis I'd want to test did that man population or modification actually change the mean of that process okay and so what we would do is we'd set up a hypothesis test based on the old mean and the new data we'd collect data from the system after the manipulation and we test that it was the same or different than the previous mean okay so what we would do is we would collect new data we collect I'm just setting up this T distribution by reminding you of what a hypothesis test looks like we collect data um X1 dot dot dot to xn and this is going to be a small n for the T distribution to to matter we collect data uh and what we do is we collect a sample mean and uh compute xbar the sample mean which is 1 / n sum from I = 1 to n of each of these data points that we've collected and this sample mean is our new best guest from this data set of what the the mean of the system is what the new mean mu is and so the hypothesis that we're going to test is does this data come from uh the a system with the old mean or do I refute that hypothesis and assert that this mean has changed that this does not come from that distribution and so thus the mean mu has to had to have changed okay um so by the central limit theorem this um so we're almost to the the T distribution by the central limit theorem uh xbar is going to be distributed as a normally distributed uh random variable with mean mu and variance Sigma 2 over n um if nothing changed if mean didn't change did not uh change and so finally what this means is that we can actually take our data and we can compute this this mean and we can see where that mean lives with respect to this normal distribution and we can build a hypothesis test we can build rejection regions based on this normal distribution um and essentially test our hypothesis um of whether or not the mean did or did not change okay so the hypothesis um would be that these data is from this this mean value so the null hypothesis H knot is that the means the mean didn't change did not change and so we set up a test statistic so the test statistic for this hypothesis is X bar minus mu divided by the standard deviation or sorry the standard error Sigma over root n this should be just a complete recap for you we take this um this this new sample mean we subtract off the old mean divide by the old you know uh standard deviation divided by the root of our sample size and this is a test statistic that should be normally distributed with mean zero and standard deviation one so we can use this for hypothesis testing the issue here is the following we probably know me because we're trying to assert the hypothesis did mu change did the mean change so we probably know this value we know this because this is the thing we're testing did it change or not but we might not know the variance Sigma of the actual underlying true distribution we might not know this this is like the the variance of the actual full distribution that we don't know we don't know this is unknown probably if it is known just use this formulation if it's unknown if this Sigma is not known then we have to do what's called bootstrapping so in that case we have to bootstrap and we replace this unknown standard deviation with the standard deviation of our data What's called the sample standard deviation and so that's what I'm going to write down here so if we uh if we don't know this then what we do is we replace this with xar minus mu over this thing called SN / root n where SN uh essentially SN squar is the sample variance it's the variance of um all of my data which is equal to the sum from I = 1 to n of x i - x bar^ 2 okay this is just the definition of the sample variance so let's just zoom out okay we're doing a hypothesis test that the mean changed data did not change and by the central limit theorem we've we've derived all this before this is the test statistic we usually use in all of my previous lectures we've used this test statistic the new mean minus the old mean divided by um the standard deviation over root n that's normally distributed you can do hypothesis testing you can literally build um you know from your normal distribution you can build a rejection region let's say I want a 5% you know 05 P value rejection region and you can see does this test statistic live in that rejection region or outside of that rejection region if it lives anywhere else then that means the mean did not change but if it lives in this rejection region then the mean did change probably within that significance that that statistical significance but this assumes that you know the variance the standard deviation Sigma of the actual underlying distribution of the system we often don't have access to that and so we have to estimate that Sigma from the data we collected so if you estimate that Sigma from the data we collected that's called a bootstrap estimate and you replace this true Sigma standard deviation with a sample standard deviation computed from the sample variance this distribution here this variable is distributed as the T distribution with n degrees of freedom or t of n sometimes we say this is T with parameter n n degrees of freedom okay so that was a lot to get to to introduce the T distribution but what this means is that if you don't know the variance the true variance Sigma uh sorry standard deviation Sigma you have to replace it with the bootstrapped sample standard deviation and that is distributed as a t uh distribution now proving this is quite challenging I'll show you kind of why this is true in the next video like why this is a t distributed random variable we'll talk about why that's true but just for now you have to know that if you use the bootstrap standard deviation you actually have a t distribution not a normal distribution now the good news is for large n for moderately large n like n30 50 100 anything kind of bigger than 30 this distribution starts to look so close to a normal distribution that you can just kind of ignore this and use our normal easy test statistic up here but if you have small n and a bootstrapped variance or standard deviation you have to use the T distribution okay so now what I'm going to do is I'm going to show you a python code that actually just computes the T distribution for lots of N and plots them against the normal distribution so you can see the convergence then we're going to write down the actual probability density for this T distribution and then we'll conclude with some parting thoughts um really what I want you to know though is if you're doing hypothesis testing and you have a bootstrapped standard deviation or variance and you have a small n you need to use the T distribution that's the upshot okay let's now plot that the T distribution converges to the normal for large n okay so this is a pretty easy uh python code essentially what we're going to do is we're going to generate a bunch of T distributions with different degrees of freedom so one degree of Freedom uh two degrees 5 10 30 100 and we're going to plot all of those student T distributions against a standard unit normal that we think is a good approximation for Big N so we're going to do this uh we're going to run it and this is essentially this is the plot with good colors this shows so kind of um the white dashed curve at the very top is the standard normal distribution and you can see from kind of dark blue up to lighter yellow as n increases the T distribution gets closer and closer and closer to that normal distribution okay so again what this means is that for large n even if I have to bootstrap the standard deviation or the variance I'm probably fine using a normal approximation but for small n there's a big enough difference I might get into trouble so I need to use the T distribution if I have small n and I'm bootstrapping the variance good that was a really quick demo uh and so now kind of parting thoughts here um I guess I should actually write down the probability density for this T distribution but I will uh write down the thing that I think is really important which is how you use this for hypothesis testing so let's say I have um my gaussian distribution in pink and let's say I have my T distribution for a small n in blue it's somehow looks kind of like this it's got fatter tails and a lower um you know kind of middle of the distribution so blue this is my T pink this is my normal okay this is just a rough rough rough sketch if you're doing a hypothesis test where you would normally build like a one-sided rejection region on the normal distribution but you have a small n and you're bootstrapping your variance for your test statistic then you need to Define your rejection region based on this T distribution this blue uh distribution here because especially where the rejection region lives that's where the tails are where these distributions disagree the most so for small n and bootstrapped variance in your test statistic you have to use the T distribution for that that um that hypothesis test to reject that hypothesis I realize I completely fli the colors Here Pink here is T whereas blue here is T and vice versa but you get the idea okay um let's actually write down the PDF for the T distribution so the probability density function for the T distribution uh with n degrees of freedom um this is a t with n degrees of freedom is the following I'm going to write this down it's going to be a s we're going to come back and show kind of roughly why this is the way it is um it's equal to this gamma function evaluated at n + 1 / 2 remember gamma is related to factorial related to factorial uh specifically gamma of an integer is equal to n minus one factorial for integer for integers but this gamma function generalizes the notion of a factorial to any number you can take the gamma of Pi or 1/2 or whatever and it generalizes the notion of a factorial this is a pretty complicated function it's recursively defined based on an integral but in statistics it comes up all the time and just remember it's a function you plug in a number you get out another another number it's this divided by root n pi gamma of n / 2 we essentially need this to normalize the probabilities these are just numbers this is doesn't really matter this is a constant scaling Factor the thing that actually matters is 1 + t^2 Over N to the minus uh n + 1 over 2 okay and I'm not going to prove this but if I take the limit as n goes to Infinity this starts to look a heck of a lot like e to the something this looks like an e to the you know t^2 it's going to look a lot like a normal distribution a standard unit normal centered at zero so already this is just a normalizing factor to make sure the probability adds up to one this is already looking like as n goes to Infinity this is going to converge to the normal distribution you could actually write this down and prove that that would be a nice easy thing you could do um but this is the distribution you have to use for hypothesis testing when you have a bootstrapped variance for your test statistic and you have a small n okay thank you

---

## 6. The Chi-Squared Test : Are Two Distributions the Same?  (with Python Example)
**Channel:** Steve Brunton | **Views:** 6K | **Date:** 3 weeks ago | **Duration:** 22:44 | **ID:** 63S3FLISKMs
**Link:** https://youtube.com/watch?v=63S3FLISKMs

### Transcript:
welcome back so we've been talking about parameter estimation and fitting probability distributions from data using statistical methods and there's a very natural question that arises if I have data um XI like some collection of data and a fit to my probability density function some you know function f and I've estimated my parameters um Theta hat how good is this fit um this is sometimes called the goodness of fit um surprise surprise and this is a special case of a really really important topic in hypothesis testing so we talked about hypothesis testing before there's a really really important topic in hypothesis testing where the hypothesis now is are two distributions the same or different okay so the null hypothesis would be that these distributions are the same and if the data does or does not support that you can build a hypothesis test um to test if these distributions are or are not the same so we're going to use this notion of this specific hypothesis test um to see if two distributions are the same specifically to see if our fit with our estimated parameters is consistent with the observed data those are two distributions and we're going to make a hypothesis is this fit a good fit to this data and remember when you do hypothesis testing you have to come up with a test statistic and that test statistic has a distribution you set up a rejection region based on a significance or P value um the specific um distribution for our test statistic is called the kai squar distribution and we've seen Ki squar before it's literally the square of the normal distribution so if I have a variable that's normal distributed standard unit normal mean zero standard deviation 1 the square of that random variable is a simple Ki squar distribution so here we're going to use this Ki Squared Distribution this Ki squar test to test the hypothesis of whether or not two distributions are the same or different and we're going to do this on a specific example we've seen before so we've looked at this case of those alpha particle emissions that we think are a Pon distributed data set so the example we're going to look at specifically is the example where uh X is Plus on Lambda so we think that X is distributed as a Plus on random variable with some parameter Lambda and our estimate for Lambda we're going to call it Lambda hat here that's kind of theta hat our parameter Lambda hat is equal to xar which is the sample mean of my my data set it's literally 1 / n sum from I = 1 to n of all of my collected data it's the average value of my data that's the sample mean and we showed earlier through several different methods method of moments and maximum likelihood estimators that this is the best unbiased estimate of that Lambda parameter in this distribution okay so we know that that's a good estimate of the parameter if the data happens to belong to a pan distribution but now we're asking a more fundamental question does the data actually belong to a Pon distribution with that estimated parameter so we're going to code this up um in Python using the alpha particle emission data set that we looked at before and so we're going to use our fitted parameter Lambda hat and we're going to test the hypothesis that our data and that fitted Pon distribution are in fact uh from the same distribution they're the same distribution and we're going to use a Ki squar test to do that okay so I'm going to write out kind of how this works generically to do um this hypothesis test of whether or not two distributions are the same or different and then we're going to do this for the case of the alpha particle emission in code okay let's get started so uh maybe what I'll do is I'll just mention this Ki squar test that we're going to use is based on the the idea that our data um our distributions are our kind of two distributions that we're trying to fit can be bended like a histogram okay so I'm just going to I'm going to write out the kind of two equivalent Notions of this and then we're going to interpret it for our particular data so the idea is that you can bin your data um for our Pon alpha particle emissions you'll remember that we had these bins of how many alpha particles were measured um in a 10-second interval and so if one if uh if0 to 0 to two alpha particles were emitted it goes goes in this bin if three alpha particles were measured it goes in this bin if four alpha particles were emitted or detected um in a 10-second interval it goes in this bin and then the experiment this 1966 paper they repeated this experiment over and over and over and for something like over a th 10c intervals they counted how many alpha particles were detected in those 10-second intervals so that's the bin and then you have The observed number of instances in this bin The observed uh The observed and I really should be using a different um color here I'm going to call this variable um o I guess o uh n and then you also have the expected so this is my observed and my expected is from the distribution that I'm testing to see if this is actually in that distribution then there expected which I'm going to call en n uh and this is the expected value H and it's not the expected value like the E of it's like what we expect from this distribution expected okay good uh and so for the particular data set we're looking at um literally we're going to you know fire this up in Python and we'll see the data but the values The observed values of clicks from 0 to two um of there being zero two alpha particles in a 10-second interval this was observed uh I'll do this in pink 18 times the number of 10-second intervals where three alpha particles were observed this happened 28 times four alpha particles observed this happened 56 times dot dot dot and based on the pon distribution with the Lambda value that we fit the best fit Lambda value from before I actually have this tab ated you can you know verify it yourself the expected number of alpha particles in 0 to two uh the expected number of 10-second intervals where you would get 0 to two alpha particles this is uh 12.2 the expected number um of of times you would expect to see three alpha particles out of that total number is something like 27 the number of 10-second intervals where you would expect to get four alpha particles based on this fit um is 56.5 dot dot dot and this goes on um I think in this case there's like something like um how many bins are there I think that there are 16 bins of data here okay so this is just a way of tabulating your data and this is going to allow us to use the Ki squar test okay um I'll just draw one more thing here this is completely equivalent to plotting your data and your expected data based on the fit in terms of distributions okay so my observed data looked something like this I'm just making you know kind of I don't know exactly what it looks like but it's p on so I'm assuming it looks something like this this is my uh observed obsv observed and my expected based on my fit this is kind of you know my expected based on my FIT is some other distribution that may or may not be close to it this is kind of expected based on the fit based on the fitted parameters and so you can always go back and forth between is if you can plot if you can plot a histogram of your data and a histogram of your your fit then you can create this table and if you have this table you can create this histogram they're equivalent representations of the same data and so this is the starting point where we're now going to design a test statistic using the kai Square distribution and we're going to set up a hypothesis test based on that test statistic there will be a rejection region and then we're going to demonstrate this in Python okay this is kind of involved but it's also really really cool this is one of my favorite topics in statistics because it's so powerful it allows you to say if two distributions of data is coming from the same distribution let's say I have two data sets and I want to test are these from the same distribution you can run the Ki squar test on those two data sets if I you know if I have two um histograms of data from two different experiments I can say if they're from the same or from a different distribution using this test super super cool so now the idea here is we create something called the test statistic um and our test statistic I'm going to call it instead of a a variable Z like before I'm going to call it this bold x^ s that's what we call it often in ki^ squ um and it's the sum over all of the bins or all of the cells sometimes they're called cells because this is like an Excel spreadsheet um I'm just going to say all of the bins sum over all of the bins of The observed value minus the expected value squared divided by the expected value now deriving y why this follows a Kai squar distribution is very challenging this is not easy to show that this follows a Ki squar distribution but it does okay and the fact that this follows a Ki Square distribution allows us to use the Ki Square distribution uh to to do hypothesis testing we can build a rejection region and do all of the things we've done before on this test statistic and so literally what we do is we go row by row and we compute the difference squared the difference squar the difference squared you know divided by the expected value and we add all of those up and that gives us a number okay and this x SAR is said to follow a Kai squ distribution it follows a Kai squar distribution this is how I write Ki squar the distribution with d degrees of freedom now this is a technical point I need you to to like remember this this is important this is um D is the number of degrees of freedom and it's defined specifically as the number D equals the number of bins minus the number of parameters you fit minus the number of fit parameters minus one so in this case in this example you'll see that there are 16 bins and there's one fit parameter so this is 16 -1 - 1 in our case D = 14 for our Pon example so we're going to use a Ki Square distribution with 14 degrees of freedom I'm going to have another video in a couple of videos where I'm actually going to write down what is the Ki Square distribution with d degrees of freedom we're going to show that it's a special case of a gamma distribution um and it comes from the normal distribution squared we're going to have a whole lecture on what this is but for now it's a probability density function and it's has parameter D where D is the number of degrees of freedom that's what you need to know for right now okay very hard to show that this follows this distribution but if you take my word for it we can use this for hypothesis testing and so now we can build a null hypothesis I think I have enough room to do this so I think what I'm going to do is I'm actually going to build a null hypothesis so null hypothesis this is my h0 and my null hypothesis is that the two distributions two distributions these two distributions are the same that's the hypothesis we're testing and so our test test statistic here essentially tells us if it is likely or unlikely that this is true that's how hypothesis testing works so what we literally do is we look at our Ki squar distribution here is uh the Ki Square distribution kind of looks like this it has a really uh fat tail here I did a really bad job of drawing that so I'm going to do it again because it matters um the Ki Square distribution has a really long tail here and what this test statistic does is it says if I observed this value in this kid Square distribution where in this kid Square distribution uh does it live is it in the far tale of unlikely events or is it in the bulk of likely and so in the example that we're going to do in Python we're going to see um based on this Kai squ with d degrees of freedom you can set up a rejection region so this is the rejection uh reject region Based On A P value let's say of 0.05 so I want it to be a 95% you know confidence the 0.05 significance and what we're going to find is that the kai squar for our data this uh this this X squ test statistic this is our test statistic that's what it's called in hypothesis testing it's going to live somewhere around here so it's going to be well outside of the rejection region which is going to be pretty strong evidence that the observed data actually follows this fit distribution which is a really really cool way of saying that the alpha particle emissions are very consistent with a Plus on distribution with a parameter Lambda given by our estimate Lambda hat really powerful thing you can say in statistics okay so that was the Preamble let's fire up uh our notebook and actually see this in action okay all right so I have this uh kind of prepopulated and ready and we've we've already looked at this data set before so this is the alpha particles emitted U by a radioactive element um this this experiment was repeated a bunch of times and the number of alpha particles detected were bined essentially and counted okay and so that's uh this data we've already plotted this data and it looks like it could be plus on but we're not sure we're going to test that hypothesis here and we've also already done a fit um before so this is using the method of moments or maximum likelihood estimation we can fit this parameter and find that it's the sample mean so we do that uh here and now we plot the observe data in yellow versus the best fit Pon distribution in blue okay so that's the starting point now what we're going to do is we're going to to test the hypothesis that these are actually from the same distribution that's what I have plotted here we have our observed data and we have our kind of best fit data and we want to see are those the same distribution um one extra technical detail I need you to know this is actually really important the kai squared test statistic this test statistic only works well if the number of observed um count per bin is bigger than about five if these are very very rare then this is actually not a good statistic that's a super technical detail but you need to remember this when you do these these yourself this um only works if the numbers in these bins are greater than or equal to about five if they're really rare then it doesn't work and you'll look at this example you'll notice that our data set the first few bins 1 6 11 those are pretty small numbers so what I'm going to do and I've actually already done it here is I'm going to lump these first three bins of 0 count one count and two count into one bin this is allowed you can do this you can group your data um as you like and in that case I'm bending it so that my number of observed counts is well above five the minimum number where this test statistic Works technical detail but it's important here because I'm only you know um I'm lumping these first three bins together good so now we are ready to actually do the Ki squar test so that's the next code here um so we're going to import the uh Kai squared um kind of from scipi stats and we are essentially going to start building this Ki squar test statistic and then we're going to test it using the kai Square distribution with 14 degrees of freedom so that's essentially what we're doing here um the first uh bit here is just combining those first three bins into one bin so that I have a valid Kai Square test um then we're going to take our sample mean to get our best fit distribution here uh and so we have our poon probabilities and our expected probabilities um essentially this column here and now you can check this code out yourself make sure all this makes sense I'm kind of breezing through it but we're just verifying that this this makes sense uh and so we're going to do our Ki squar test statistic it's essentially um the sum of OI minus ei^ s divided EI The observed minus expected squar divided by the expected that's this test statistic here the number of degrees of freedom is the number of bins minus one degree of Freedom minus uh one so this will end up equaling 14 and then the P value um you know we're going to actually see where we land in this Ki Square distribution and get some significance of our hypothesis okay and then some plotting so let's plot this thing and run it okay so the output of this code is really really neat okay so it says that our Kai squ test statistic literally this x squ thing if you add all these values up you get 8.83 6 um so that's the the x squ value it lives right here in fact it's the uh Pink dash line right here the degrees of freedom is 14 okay that's consistent with what we wrote down here and the P value for this particular observation is 8414 so that means it's well outside of the rejection region where the P would be 0.05 so it's a very very good indication that the null hypothesis holds and down here we say we failed to reject the null hypothesis which means the data is consistent with a Plus on distribution this is a big deal This Is How We Do hypothesis testing of a much more General set of hypotheses like are two distributions the same or did my data actually come from the distribution I'm fitting super powerful this works for lots of distributions not just Pon and it's based on this Ki squared test statistic this is again the Ki squar distribution the rejection region and where our test statistics lands and we have pretty strong evidence uh to keep the null hypothesis and assert that the two distributions are in fact the same super super cool um I think what I'm going to do is in a future lecture we're actually going to do something similar to test if a data is generated with fraud using benford's law um so you can tell if you know Financial records were cooked by seeing if they follow benford's law distribution we'll do that in a future distrib uh future lecture um but this is a super super powerful idea so maybe what I'm going to do is just do a super quick recap okay we want to tell if two distributions are the same two distributions are the same uh and a really important special case of that is to see if our data is from the distribution we're trying to fit to that data so in the case of the pon data we think that the radioactive element Decay follows a Pon process but after collecting that data and fitting A Plus on process now we're going to ask the hypothesis asked the question are these actually from that distribution so you set up essentially a histogram or a table of the actual Bend values of that data and you use this this is called the um I think Pearson Kai squared uh test statistic and it follows a Ki Square distribution very hard to prove but take my word for it and using that distribution you can set up a rejection region and test whether or not your particular test statistic sck Falls in or out of that rejection region to reject or keep that null hypothesis really powerful way of doing hypothesis testing to see if two distributions are the same um okay that's it for now thank you

---

## 7. Consistency of Parameter Estimates in Statistics
**Channel:** Steve Brunton | **Views:** 4K | **Date:** 1 month ago | **Duration:** 10:24 | **ID:** 27wRPAg3H28
**Link:** https://youtube.com/watch?v=27wRPAg3H28

### Transcript:
welcome back so we've been talking about parameter estimation essentially a statistical method of fitting the parameters of a probability distribution from data and I want to introduce today this notion of the consistency of that parameter estimate Theta hat um so maybe I'll just write down uh kind of what we're talking about so we have some probability distribution uh of you know x given these parameters maybe this is a Pon distribution or a normal distribution and given some data some measurement data X I want to estimate I want to find the best estimate of the parameters of that distribution Theta hat so in the case of pan I'd be trying to estimate the Lambda parameter in the case of a normal distribution I'd be estimating the mean and the variance mu and sigma squar and this idea of consistency is super important it essentially tells us whether or not this estimate is unbiased or bias if it converges to the true parameter values or not in the large n limit in the limit of large data sample okay so I'm going to Define what I mean by consistency and then we're going to State a fact that the parameter estimate Theta hat obtained through the method of moments is in fact a consistent uh estimate of the parameters okay so uh consistency so we're going to say if uh Theta hat is an estimate of theta is an estimate of a true Theta of theta and uh this is based on a sample size of n based on a sample size of n okay then Theta n is consistent I'm going to put this little n here Theta n hat so just explicitly saying that this is based on a sample of sized n then uh Theta n hat is consistent if uh if it converges converges converges if it converges uh to the true value of theta to Theta and we say converges in probability so we've seen this before um when we looked at the law of large numbers there's this very like mathematical probabilistic definition of converges it means that um the distribution converges um in probability I'll write this out as math in a minute then Theta is consistent if it converges to the True Value in probability uh as n goes to infinity and specifically what we mean by converges in probability is a very mathematical notion it says that remember Theta hat is a is a random variable because it is a function of a bunch of samples which themselves are random variables each of these X's are random variables my my data I collect as a statistician I think those are random variables drawn from this distribution then this estimate itself is a random variable with a mean and a standard deviation and all of you know a distribution so for this estimate to converge to the true value means that the density function the probability of this being close to this has to converge so the way we write this mathematically is the probability of the absolute value of the difference between our estimate and the True Value being greater than uh than Epsilon so the probability of my estimate being more than Epsilon away from the True Value goes to zero as n goes to infinity and you could actually formulate this in terms of like a Delta and an Epsilon using like Calculus if you wanted but this is mathematically how to write this so consistency means that as n goes to Infinity the probability that our estimate is more than Epsilon away from our true value goes to zero for all positive Epsilon this means that essentially this distribution has to converge to the True Value Theta okay it means that the mean of this random variable the average value has to be the True Value and its variance has to go to zero as n goes to Infinity for this probability to go to zero that's what it means intuitively okay uh and then I'm going to State this uh fact about the method of moments um which I think is pretty useful is that the method of moments method of moments estimates we're going to call those Theta hat those are consistent okay this is a fact um fact I am not going to prove this um this fact it you know this is actually a pretty good exercise for you to make sure you understand understand the method of moments but I'm going to walk you through approximately how it works okay so the idea here is what you can show before you show that these estimates are consistent these estimates Theta hat are a function of my estimated moments these are my uh estimated moments remember the first moment is the expected value the second moment is the expected value of x squ and so on and so forth um these these higher and higher moments what you can show first what you need to prove first kind of a a Lemma if you will a Lemma is that the estimated moments are consistent the estimated moments these mu K hat are consistent meaning that they converge to the true moments in probability as n goes to Infinity uh they converge to the true moments we say improbability meaning it's this expression in probability they convert to the true moments in probability as n goes to Infinity now you've already seen an examp example of this remember the law of large numbers the law of large numbers the law of large numbers essentially is a proof it is a statement of this Lemma for k equals 1 okay this is a special case a special case for k equals 1 essentially showing that mu hat one the expected value the the mean this is the the sample mean um remember of your data this is the sample mean of your data 1 / n sum I = 1 to n of each of my random variables that estimated uh first moment or estimated expectation value um converges to the true mean of your data as n goes to Infinity we've already stated this and proven the law of large numbers uh remember we use um I believe you know marov and chubby chubs inequalities to prove this okay so what I would like you to do if you really want to understand this first off you don't need to prove this you can take my word for it this is a fact that the method of moments estimates Theta hat are consistent meaning they converge in probability to the True Value meaning that random variable its variance goes to zero as n goes to infinity and its mean value its expected value is the true parameter value we're trying to estimate if you take my word for you don't have to prove this but if you want to kind of make sure that you understand all of these Concepts the method of moments and the law of large numbers um you know kind of in general you can actually prove this by first showing that the moments the estimated moments uh mu K hat are consistent meaning that they converge in probability to the true moments and the first k equals 1 case is the law of large numbers so you can go back to that lecture you can watch how we prove that using Mar and chubby Chev inequalities and then you can use that to prove this for k equals 2 and three and four and for all K and if all of these M's are consistent then you can also show that our estimated parameters Theta hat are in fact consistent that would be a really nice exercise for you and if you can do that then you'll have really good Mastery over all of this material okay um last point I just want to make a couple of like little notes here so that I don't forget consistency essentially means that Theta hat uh is an unbiased estimate or estimator of the true Theta that's essentially what this implies is that Theta hat is an unbiased estimate um and that essentially also means that the expected value of theta hat equals Theta true the true value of theta okay um so that's what consistency means you can prove it for the method of moments this is the thumbnail sketch it's also true for the maximum likelihood estimate which we'll be talking about soon the maximum likelihood estimate is also a consistent unbias estimate of the true parameter values so really useful um and it's related to this law of large numbers and things we've looked at before okay thank you

---

## 8. Properties of Maximum Likelihood Estimation
**Channel:** Steve Brunton | **Views:** 6K | **Date:** 1 month ago | **Duration:** 14:00 | **ID:** QVF0oOh7s8c
**Link:** https://youtube.com/watch?v=QVF0oOh7s8c

### Transcript:
welcome back so we've been talking about the maximum likelihood estimation technique for estimating the unknown parameters of a probability distribution function P given some uh sample data capital x this is a really powerful method in statistics for parameter estimation that also generalizes pretty nicely to machine learning and beian statistics so today I'm going to give you some useful properties of the maximum like Hood estimation or estimate and talk briefly about how uh how these properties work and what they mean for using this in practice okay so we essentially have this log likelihood function little L of theta Theta are are our unknown parameters of our distribution we call the PDF the probability density function of our distribution Little P I think in previous lectures I called it little f it doesn't matter it's just the variable name that I've called this function and the data the sample data I have is capital x so that's an actual collection of data X1 through xn a sample of n data points and we're going to use that data to estimate this unknown parameter so the idea is that the likelihood function or the log likelihood function tells you what is roughly the chance or the probability the likelihood of observing this data capital x given that specific set of parameters Theta and when we plug in the data that these become numbers this PDF we plug in actual numbers for those variables X this becomes entirely a function of the unknown parameter and if we maximize that function that likelihood of the data given that parameter Theta then that maximum likelihood estimate Theta hat is our guess uh or our estimate of the unknown parameter Theta given the data X okay so this is a nice uh estimation procedure the properties I want to you today there are two really important ones the first property is that Theta hat is what's called consistant and consistent specifically means that Theta hat approaches Theta true whatever if there is a true underlying parameter let's say this is a pan distribution and there's an actual honest to goodness parameter Lambda that's that's you know was used to generate the data then our estimate will approach the True Value as our sample size n approaches Infinity okay so we get this nice convergence of our estimate to the True Value in the large data limit very very important um notion of consistency we want this kind of also means that our estimate is unbiased it's it's also means that our our estimate is unbiased and the method of moments Theta hat is also a consistent estimate of of theta okay so method of moments and maximum like Hood estimation both give consistent unbiased estimates of the true parameter values in the large n limit but they might converge at different rates these different methods there's lots of different ways of estimating parameters from data and some of them will converge faster than others meaning the the Theta hat might have more or less variance as a function of n for different methods remember Theta hat is itself a random variable because it's based on you know these random variables it's a function of random variables so Theta hat has a mean and a variance and consistency means that its mean value is the true value of the parameter the second property that I want to tell you and this one's really really cool is that our estimate Theta hat Theta hat is a normally distributed random variable in again in the large end limit is normal where the mean normal there's an L the mean is the true value so this is Theta true and the variance is 1 over n times this funky function called I of theta true okay I'm going to Define this right now we're going to Define it and show how it can be used but basically the thing that actually matters is that the Thea hat our estimate of the parameters is a normally distributed random variable maybe I'll draw a little picture here so our Theta hat is a normally distributed random variable centered around the True Value I'm going to call it Theta true and it has some variance that gets smaller as n gets bigger as n gets bigger the variance gets smaller and this gets to be a Tighter and Tighter estimate of the True Value in as as we get more and more data Okay so we've seen this before this is not a New Concept this is looks a lot like the central limit theorem it's different but it looks like the central limit theorem and it tells us a lot of information about this estimate it's very very useful and it allows us to do things like calculate confidence intervals so we can use this to calculate confidence intervals uh intervals on our estimates um Theta hat it also allows us to do things like design of experiments how big of an N do I need if I want my parameters to be estimated within a certain tolerance or percentage threshold um very very useful um to be able to put bounds on the variance of this distribution okay and so now I think what I want to do is Define this weird I function that I've kind of put in the denominator here this I function is pretty um pretty interesting so let's just write this out so I'm going to Define I of theta equals the expected value expectation value of partial partial Theta of my log likelihood um L of theta so I'm going to write it out explicitly log uh P of x given Theta okay so I take the partial of this log likelihood with respect to Theta and I take its expectation value squared this is how we are defining this I function now to actually show where this comes from is a little bit messy um maybe I'll do that in a future video but it's kind of an aside that'll take 10 or 20 minutes and it's pretty messy but it's it's some function that's useful it's the partial of of of L with respect to Theta essentially if you like this actually isn't that complicated to write down this is um maybe I'll do it in pink this is just the expectation of L Prime Theta squared okay that's what that is it's the expectation of LP Prime Theta um squared remember that the optimizing value Theta hat maximizes L of theta so L Prime of theta would be equal to zero so you can start seeing that this this has you know it's related to this optimization problem um and there's another kind of useful property here this value of I Theta is also equal to the negative expected value of the second partial derivative partial squared partial Theta of log P of x given Theta which again I can write as minus the expectation value of the second derivative of L of theta L Prime Theta okay so I'm not telling you where this I of theta comes from it is the expectation of L Prime squar that is what it is it's useful but this expression here that Theta hat is normally distributed around the true value means it's unbiased it's consistent and it says something about the variance this is computable that's the real upshot here is that this is computable and it says something about the variance of this estimate as n goes to Infinity as n gets large we can say kind of bound the uncertainty in our estimate Theta hat using this formula very very useful we can use this for things like confidence intervals now showing that Theta hat is normal very very challenging deriving this I of theta pretty messy what I want you to know are these facts these are useful facts about the ml okay it's consistent and more than that it's normally distributed with a calculable variance good and so this consistency is useful and this second property where we can compute the variance we essentially say that the maximum likelihood estimate Theta hat is ASM totically efficient and I'm going to Define I'm going to write it down and then I'm going to Define what that means so we say that the mle is ASM totically efficient ASM totically efficient which means that as for large n in the large n limit this will be the estimate that converges to the True Value faster than all other estimates you can't write an estimate that will converge of of the parameter Theta hat that will converge faster than the maximum likelihood estimate at least in the large limit in the ASM totic n goes to Infinity limit this is as efficient in data as it gets and this is a lot like in the fast 4A transform if you are more familiar with like engineering you know signal processing the fast 4A transform scales like n log n and what that fast scaling means is that for very large n it's approximately linear scaling which is about as good as you can do so that's what we mean by asymptotic scaling is that in the large end limit it performs about as optimally as you could hope for okay you can't beat this ASM totically it's ASM totically efficient in the size of the data set n now again very hard to prove I'm not going to do that I'm just telling you useful facts about the the maximum likelihood estimate um and this uses something important called The Kramer row inequality I'm going to tell you what that is so this uses the Kramer r inequality so you probably remember Kramer from linear algebra and determinants and things like that and the Kramer row inequality essentially says given uh IID data so identical independent identically distributed data they're from the same distribution and they're independent draws uh X1 to xn and an unbiased estimate an unbiased estimate of the parameters of the distribution Theta hat and I'm going to explicitly say that this Theta hat is a function of my random variables because it is X1 to xn remember up here this likelihood function we've plugged in our data so it is a function the maximizing Theta is a function of our random variables of our data so Theta hat itself is a random variable okay so given some IID data and an unbiased estimate of the parameter Theta hat then the kramarow inequality says something really nice about the variance of this distribution it says that the variance of our estimate this here is the variance of our estimate the variance of our estimate is always greater than or equal to 1 / n i of theta this is Theta true okay um and this is true for any distribution for any from whatever distribution these X's are drawn from this is true for all you know P of x given Theta that is smooth as long as the probability density is smooth this is true and what that says is that the variance of theta hat is always bounded from below it can never get less than this value here okay so it's always going to be worse there's always going to be more certainty or or equal to to this value it's either going to be more or equal to this amount of uncertainty or variance in this Theta hat uh distribution of our uncertain estimated parameter and because in the large end limit our mle estimate has exactly that variance that is the lower bound so you can't do better than this uh maximum likelihood estimate by the Kramer row inequality okay so Pro proving this super hard proving this pretty challenging deriving this messy that's all you know stuff you can look up in textbooks ask GPT go on the internet but I want you to see the big picture here that the maximum likelyhood estimate is unbiased and it's ASM totically efficient and you can compute its variance which allows you to do useful things like write down confidence intervals for your estimate super super useful properties of the maximum likelihood estimator thank you but

---

## 9. Bayesian Maximum Aposteriori Estimation (MAP): Extending Maximum Likelihood Estimation
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 1 month ago | **Duration:** 12:59 | **ID:** xgfexqYxrDU
**Link:** https://youtube.com/watch?v=xgfexqYxrDU

### Transcript:
welcome back okay we have been talking a lot about the maximum likelihood estimator which allows us to estimate the unknown parameters of a probability distribution using uh data so this is a method in statistics to estimate parameters given data and we have hinted that this maximum likelihood estimate is related to kind of aasan formulation or a basan version of this problem so today I want to flesh this out and make this connection more concrete so you can see how to go between uh an mle and kind of a bean estimation of those parameters and in future lectures we're actually going to code this up and do some examples okay so just remember um that the maximum likelihood estimation problem what we do is we take our probability density function and we take the the likelihood function essentially we take our PDF and we plug in our measurement data for uh the variables so if I have a gaus e to the you know- x - mu ^ 2 2 Sigma 2 I would take my actual measured data numbers that I collected and plug those in for my variables X and now I have something that's only a function of my unknown parameters if I take the logarithm of that probability density function I have something called The Log likelihood function and this tells me roughly the likelihood of observing this specific data data given those specific parameters and what we're trying to do is essentially tweak or optimize these parameters to find the maximum likelihood function okay we maximize overall of theta to find the parameters that are most likely or most consistent with the measurement data that we have access to now there is a big downside to the maximum likelihood estimation and that downside is essentially it is fragile to bad data and it doesn't allow me to include any prior knowledge or beliefs into these parameters let me give you a really simple example of a downside okay um so let's say that I'm trying to estimate the um probability of a of a coin being heads versus Tails so there's a single parameter p and you know for a Fair coin it would be 0.5 so data would be 0.5 for a Fair coin and a biased coin it would be somewhere between 0er and one so if I flip a coin if I flip a coin let's say it is a Fair coin let's say I actually know it's a fair coin um and I flip this coin uh three times and let's say each of those three times I just get unlucky it's not even unlucky it's just it happens sometimes I flip a coin three times and I get uh heads heads heads Heads okay I get three heads in a row that's the actual data that I have if I get three heads in a row the maximum likelihood estimate the mle for Theta hat would equal one it says that there is a probability of getting heads that should equal one you can go through and actually calculate this this is um these are each Bern random variables so you can actually compute this for nals 3 of three beri coins and you can convince yourself that with this data the maximum likelihood estimator will say that the coin is always going to flip heads for all future flips that's a really bad issue um of the mle is that if I give it a little bit of data and that data is not um you know I get kind of unlucky on the draw of that data I'm going to get a really really bad estimate and this is a problem with lots of estimation techniques ml are not you know are not particularly bad it's a problem with what we call kind of deterministic estimation techniques and so the solution to this is using aasan formulation the solution is the solution is use Baye theorem to incorporate some prior knowledge about the parameter use Bay to incorporate uh prior knowledge prior knowledge about uh about Theta okay so literally I might have a prior distribution of what I think Theta is maybe I think Theta is a Fair coin so for example my strong prior knowledge is that a coin is going to be uh you know a coin is going to be fair coin is fair so you know maybe Theta is close to 1/2 and this I'm being very very loose here I might say that it's a normally distributed variable with mean 1/2 and some variance there's lots of ways of of putting this prior knowledge in that's a whole you know deeper dive set of lectures but the idea here is that maximum likelihood estimation has this kind of canonical fault um this is a a cartoon example that shows how bad it can get but if we use Baye um you know kind of bean statistics we might be able to incorporate some prior knowledge about Theta to make it more robust to these bad unlucky draws so let's write down what that looks like so in mle uh we use the probability of x given Theta for uh for ML okay we use the probability of x given Theta we've Lo talked about this a lot but if we have a prior knowledge but if we have but if we have a prior knowledge a prior on Theta sometimes we just say a prior on Theta P of theta this is a distribution of what I think Theta is distributed as this could literally be you know a normal distribution around 1/2 that would be a prior Distribution on Theta if I think it's a fair coin pretty tight prior okay but if we have a prior on Theta we can multiply these two and we can get uh essentially P of x given Theta time P of theta and this is going to equal maybe I'll divide by P of X just so it looks exactly like we're used to looking from base theorem this is going to equal the probability of theta given X this is in a lot of circumstances a lot more useful um for a few reasons first off optimizing this function over Theta could be kind of messy this is a hard optimization problem um if I have P of Theta given X this is actually more of what I'm trying to do I have data so given data what's the probability of this value of theta so I I essentially also want to maximize this quantity over Theta this would be a useful thing um to maximize over Theta um and I'm just going to label these this is my prior um this is my posterior distribution um and then you know this these are the um the other distributions in in B theorem so if we have a prior we can get something that looks a whole lot like base theorem but we don't always know the probability of X we don't always have this quantity here so the useful thing kind of the the the thing that makes this nice for optimization is if we're optimizing over Theta if we optimize uh over Theta which is what we're trying to do over Theta P of X doesn't depend on Theta so essentially what we can do and this is a a handwavy argument but you can make this precise is that this quantity here this uh posterior P of theta given X is kind of proportional it varies in a similar way with Theta this means proportional to kind of kind of related to P of x given Theta time P of theta so roughly speaking if all I'm trying to do is find the Theta that maximizes this quantity instead of maximizing this I can maximize this and I will get the Theta that maximizes this that's really really useful okay so um essentially I'll just write this out so that it's really really clear so instead of instead of of doing kind of the max of the log of P given x uh of theta this is the mle we this is the the classic um maximum likelihood estimate instead of doing that we compute the max of the log of this quantity of the log of P of theta given X which is essentially I can plug in this expression into here okay this equals Max uh log of P of data given parameters times my prior Distribution on the parameters okay these are kind of equivalents this is called the map so if this is mle this is map the maximum a posterior estimation I'm going to write that out it's the maximum a posterior posterior estimator estimate the map estimate because essentially what we've done is we have replaced um kind of the likelihood function the log likelihood function in the mle with a slightly more informative log likelihood function that's being informed by the prior knowledge on Theta in this case that I think my coin is a Fair coin and we can code this up we're actually going to do examples for coin flips and this exact example and also for a Le squares estimation trying to estimate the slope um of a scatter of data points using uh maximum likelihood estimators and kind of beian informed estimation where there's some prior knowledge baked in maybe that the intercept is zero or something like that and so this is a really really clever and simple way of incorporating prior knowledge into the maximum likelihood estimation to make it more robust to kind of bad unlucky draws of the data and other things outliers you know malicious attacks things like that really really useful um idea here now this really relies ban statistics this sounds like this solves all of our problems it's nice but it has some issues you you better have a good prior if your prior is bad this is going to be bad okay you need a good prior for this to actually improve things that's for one often times you don't really have an unlucky draw or such a small data set so mle is not as bad as I made it sound usually it works really really well um you need a good prior for this bean version this maximum a posterior estimate to be you know good and there's kind of an interesting con nection also the maximum likelihood estimate can be thought of as a special case of the maximum OPP posteriori estimate when your prior is kind of maximally uninformative and if you are beijan in spirit you'll know that that means if my prior on Theta has kind of infinite variance meaning it's really a super uninformative super duper weak prior then this will actually converge to this so so mle is a special case of the beian version the map estimator when my prior is kind of maximally uninformative but if I have a good prior I can do better and I can incorporate that prior knowledge into the estimation problem using this beijan analog okay we'll see this more later this is a big Topic in machine learning optimization and statistics so we'll get into this um might take me a few lectures um but keep uh you know stay tuned for that all right thank you

---

## 10. PyDMD: A Python Package for Dynamic Mode Decomposition (DMD)
**Channel:** Steve Brunton | **Views:** 36K | **Date:** 1 month ago | **Duration:** 54:58 | **ID:** v33cL3o2Yuk
**Link:** https://youtube.com/watch?v=v33cL3o2Yuk

### Transcript:
Hi everyone. Uh so my name is Sarah Ichinaga. Um I'm from the University of Washington. Um and today I'm going to be talking with you all about the Python dynamic mode decomposition or PIDMD Python package. Um I come to you all as one of the many contributors and also as one of the current uh maintainers and developers for the PIDMD package. And I'm really excited to be talking with you all today about basically what PIDMD can do, how you can get started with it, and how you can use PIDMD to start analyzing your own data sets. Uh so let's go ahead and get started. So before we dive in though, I just want to review sort of what this video is going to cover. Uh so first we're going to start with some introduction and motivation. basically answer the question of uh why do we uh build mathematical models in the first place and why would we want to use methods like the dynamic mode decomposition um then we're going to get into a little bit of mathematical background basically just review very briefly um the dynamic mode decomposition or DMD algorithm basically talk about what does the algorithm do um and what kind of information does it provide us with um and then after that we're going to jump straight into the code uh we're going to basically talk about how you can use PIDMD to apply by DMD in practice. Um, and this portion of the video will uh include a coding demonstration. This uh this material will take up the majority of the video. Um, but yeah, so that's about everything and I guess the before we kind of get into specifics, I just want to point out that this tutorial um along with many many other tutorials will be available online at the PIDMD GitHub repository found at this link. So if you are interested in reviewing the materials later or learning more about PIDMD, I highly recommend you go here and check it out. Uh so yeah. Okay. So some motivation starting with motivation. Okay. So on the screen here I have a few examples of some real world time varying snapshot data. You know these are just a few examples. You can imagine that there are many many other systems that I could have put here instead. But the main thing that I want to illustrate with these is this idea that for many many many scientific and engineering disciplines time varying snapshot data is abundant and readily available a lot of the time. Basically the the act of collecting this this for many disciplines is actually the pretty doable part. Like for example if I'm studying a an evolving fluid or if I'm studying some kind of mechanical moving system there's a good chance I can maybe take a video of it for example. Um, if I'm studying, for example, the temperature of the ocean and I want to understand how that evolves in space and time, I can collect that data. I can collect the temperature of the ocean at various points in space and time and then I can get data sets kind of like this one right here. Um, however, although we have access to a lot of data sets like this for many fields, the problem is for many of these systems, we don't actually know the precise set of governing equations that describe these systems, right? Like for example, we don't actually know for example how the time derivatives of the temperature of the ocean will change precisely as time goes on, right? We don't actually have precise equations usually. Um but we would like to have precise equations a lot of the time because if we had access to governing equations, we could say basically a ton about our system. We can make future state predictions. We can understand how external forcing or inputs might affect a system. you know there's a lot we can say and we would like to know these equations but and so basically this um motivates the question of given access to time varying snapshot data can I somehow leverage that data and use it to craft mathematical models that can allow me to do a variety of useful tasks and help me better understands understand the systems that I'm observing right so this is the goal of what we're trying to do um and so what do I mean when I say build a mathematical model so let's take this fluid flow past a cylinder data set as our main example for now. Um, and let's say that this is the system I'm observing. I've taken I've gotten snapshot data of it. Here's my video. This is my data set. Okay. Um, and so really for basically all video data, you can really just think of this as um a collection of snapshots um right or a collection of frames, right? And I can think of every frame of this video as an observation of some state variable. I'll call it X. And a video is just an observation of X at time one, time two, time three and so on. And essentially this is what I have access to this data here. Um and what I would like to do or the goal when we say find a mathematical model is this idea of I want to find sort of a function f such that when f acts upon my state given by x, I want this to sort of give me a really good approximation of the time derivatives of the state. If I have access to f, I have my governing equations. I can make predictions. I can do all the things that I want to do. So this is the goal finding f. So how do we go how do we actually go about doing that? Um so that leads us to talking about the dynamic mode decomposition or dmd algorithm. So dmd is just one of many ways that you can go after the function f. It's certainly not the only way. Um, but for reasons that we'll get to later, um, DMD is actually DMD actually provides us with like one of the simplest sort of mathematical models or functions f that we can possibly get. Um, and so it's sort of one of those things where if DMD works for your data, it's kind of like why not use it? It's super informative and it's super simple in terms of the model that is. Um, so but before we sort of address why that is, let's go ahead and talk about the algorithm itself. Um, so DMD uh starts with you building a data matrix X. Okay, where the columns of this data matrix X contain your snapshots of the state. Okay, and so if we're still going off of that sort of fluid flow pasta cylinder data set, you can imagine that every column of this data matrix is going to be a frame of that video um every snapshot uh from that um video, but basically flattened into a vector so that these snapshots can fit within the columns of this two-dimensional data matrix X. Okay. Um once we uh make our data matrix X in general DMD seeks to find a decomposition of X with the following form. There's three major components to this decomposition. I'll kind of talk about them one by one first. So the first part of this decomposition is um this sort of spatial mode matrix um fi and we call it that because the columns of fi actually turn out to contain what we call the spatial modes or the dominant sort of spatial sort of features of the data set. Okay, the next one that I want to draw your attention to is this uh time dynamics matrix t uh parameterized by omega. And you sort of look at this matrix defined on the over on the far side over here. Essentially, every row of this matrix is a time series defined as an exponential raised to some corresponding frequency. As we go across the columns, time increases from time t1, t2 all the way up to our final time um um time point. Um and each row is parameterized by their own sort of um omega value. Um and so depending on what omega is, these time series can oscillate. They can exponentially grow. They can decay totally depending on what omega is. And when we perform DMD, we're trying to figure out what omega should be. Okay. Um and then the final component is this amplitude uh matrix or these amplitude values I should say uh B1, B2 all the way through BR. And these are going to tell us sort of the prominence of the spatio temporal features given by DMD. Okay. And so, you know, I'm I'm sitting here and I'm saying spatial temporal modes and like a lot. And so, you know, but what even what does that even mean? So, let's kind of talk a little bit more about that just gain a little bit more intuition here. So, suppose I have my fluid flow pasta cylinder data set. Okay. And I perform DMD on it and I get this decomposition right here. Um, so this uh decomposition, this is exactly like what we had on the previous uh slide just for reference. But really um one way that you can think of it is you can alternatively express this decomposition as the summation that I have written over here um and if you sort of look closely at it um essentially this summation it's a summation of r um it's a it's a sum of r sort of pieces and the i sort of term in the summation has its own um spatial mode vector fi ii. it's being um and here we're applying essentially an outer product of fi with the exponential time dynamics defined by the i frequency value omega omega i and then all of this this outer product is then scaled by the amplitude b and so essentially this is why we say spatial temporal modes every term in the sum is some outer product of a spatial mode spatial of the spatial features uh with corresponding temporal sort of um activity ity. And so this is describing essentially the E kind of set of spatial features that have their own sort of time variations. And then B is sort of then telling you because B scales this whole thing. It's then telling you sort of how important is sort of this spatio temporal mode in reconstructing this data set. Okay, the bigger the B, you know, the more that this contributes to the sum. The smaller the B, the less. And so it kind of gives you also some sense of hierarchical sort of spati temporal mode importance. And so more concretely if we sort of take a look at these individual terms after applying DMD to this data set what we find is that these spatio temporal modes when visualized look like this. And again DMD is telling us that this data set can be decomposed into a sum of our spatio temporal components where we have this spatial temporal component added with this spatial temporal component added with this spatio temporal component etc etc. This is thus giving us some kind of intuition for what are the dominant sort of spatial features and how do they vary in time and how do they what basic and how do they sort of make up this data set right here. Okay. So all right, awesome. The final thing I do want to say about DMD before we move on is this idea that when you perform sort of a de a decomposition like this, when you make the assumption that you can express your data like this, you are actually sort of inherently assuming that the dynamics of your system are linear. What I mean by that is we are assuming that the time derivatives of the state are given by a linear operator times the state. And when I say linear operator, I just mean a matrix. A a is just a matrix. Um and essentially the easiest way that you can kind of see or like the most intuitive way you can see that is if you can write the igen decomposition of the matrix A as the following. Um we actually know the solution to the system of differential equations analytically. We know it to be given by this. And if you sort of like offline kind of take a look at this sort of expression as um compared to the DMD expression, you'll find that this is exactly the same as the representation given by DMD. So again on top of sort of like um in an intuitive sense DMD tells us about spatial temporal modes that uh make up the data set but also you are literally finding a linear operator a such that a times the state is approximating your time derivatives of the state. All right so that is DMD in theory. Uh but what about in practice? Okay. Um so when you're applying DMD to your own data sets um it's totally okay for you to implement DMD yourself. Uh but I would like to point out that within the PIDMD Python package um there's already um implementations for a huge variety of DMD variants um extensions and also optimized algorithms. And on top of that, PIDMD also has data prep-processors and plotting tools. And so really when you if you use PIDMD to apply DMD to your data sets, it really just boils down to the following process. really just uh define a module that implements uh the DMD variant that you are interested in applying. Um you can then wrap your model in a data prep-processor if you would like to use one. Um you can then fit your model to whatever snapshot data X that you have. Um and then you can call a plotting tool from the plotter library and you can use that to sort of visualize the results of whatever DMD um process that you did. Um and really it just that's that's the whole that's the whole thing. Um, I also want to point out that PIDMD is constantly evolving because of work uh done by researchers in the field and so and we actually recently revamped the PIDMD package to contain new modules, new extensions, new algorithms and also some more tutorials. And if you're interested in sort of taking a look at sort of the recent work that we've done to revamp the PIDMD package, I highly recommend you read our recent journal of machine learning research paper um given down here. Uh but yeah anyway so given that let's go ahead and sort of dive right into the coding demonstration. So in this coding demonstration, we're going to be taking a look at um a synthetic data set that consists of these two uh spatial temporal modes given at the top right here. Um and we're going to show that using DMD and specifically PIDMD, you can take noisy signals like this one down here, this red signal at the bottom corner. You can take that and you can use DMD to recover the fact that this data set is um it's comprised of these two um spatial temporal modes. So let's go ahead and take a look at that. So let's open up our code. Um, nice. Okay, so we got the code pulled up now. All right, awesome. Okay, so this is going to be this is the Jupyter notebook that goes along with this um coding demonstration or this tutorial um and we're going to walk through it. There's a lot of um again this is going to be available on the uh PIDMD GitHub um in case you want to look at it later. Um there's a lot of uh documentation kind of walking you through like this notebook in case you would like to go through it independently but we are going to go through it together. Okay. So um first things first when you are applying DMD or applying PI DMD I'm sorry. Um you first need to import PIDMD. Um so there's a lot of ways you can do this. Um there's basically uh we do Pippi releases every month actually. But because PIDMD is constantly um evolving and sort of getting updated because research moves very quickly, um I personally would recommend that if you are installing PIDMD, you do so from the source code on GitHub. Um there's many ways you can do this. Um one of the easiest ways is to simply pip install with the git extension. And that is actually precisely what this line of code is going to do. And so I'm going to just go ahead and start off by running this so that we can import uh all the new PIDMD code. We're gonna Oh, yeah. Okay. So, that's going to go ahead and run. I'll just wait for that for just a second. Um, but the first thing we're going to do, um, in this notebook is we're going to define our synthetic data set that we're going to be playing with. Um, and so essentially, um, but before we actually define the math math, we need to start with Oh, wow. Look at that. Look at it go. We're going to start with some essential imports. Uh we're going to start by importing um numpy uh for computations and we're going to be importing um mapplot liib for uh visualizing results and we're also going to be defining an error computation function so that we can sort of uh get a handle on exactly how well DMD is able to reconstruct our input data. Um so let's go ahead and run that. Awesome. So we've imported. All right. So specifically, so let's get into some specifics. So our data set is going to be given or the clean version of the data set is going to be given by this function f of x and t. x denotes space, t denotes time. Um and f is going to consist of sort of like the contributions from both an f1 component and an f_sub_2 component. f_sub_1 will be uh defined to have a spatial component defined by this hyperbolic seeant function here. And it will also have time dynamics given by this exponential raised to 2.3 I. Um as time goes on. Um take note of the fact that this exponential is only raised to an imaginary component. So these time dynamics will be purely oscilly. There is no real component that E is being raised to. So there will be no exponential growth or decay. Uh just oscillations defined by this 2.3. Okay, keep that in mind. It's going to be important as we move on. Similarly, f_sub_2 is defined to have its own sort of uh spatial sort of um sort of structure and its own sort of temporal oscilly dynamics, but this time but for this one it's given by 2.8. Okay. Um there's a lot of stuff in writing but I will actually go through the stuff that's in writing. I I will actually say it out loud as we go through the code together. Um let me see maybe what no that's not okay. Yeah, I think the code is Yeah, code's good enough. Big enough. I mean, all right, let's go ahead and go through this. So, basically f1, here we go. We have a function f1 defining um our f1 com our f1 sort of contribution given um a spatial and a temporal grid. Uh we do the same for our f_sub_2 function. Um and then here as we go down, this is where we are going to be defining our data. So first we're going to say okay let us use let's use 65 evenly spaced collocation points in space and let us also use 129 evenly spaced collocation points in time. Okay. Um we are specifically going to be recording our data along this spatial and temporal grid given by this chunk of code here. Specifically we're going to be looking at values of x going from -5 to 5 and we're going to get 65 of those grid points evenly spaced. And we are going to use a temporal grid going from zero all the way up to four times pi using again evenly spaced time points using a 129 collocation points along the grid. And there we go. We feed the spatial and temporal grid to our f1 and f2 functions so that we um so that we define the contributions of f_sub_1 and f_sub_2 and x1 and x2 uh respectively. And then x our clean data matrix is going to be given by uh the contributions of x1 and x2 combined. Okay, so that's our clean data. For a little bit of added realism, we're going to be adding uh we're going to be adding actually a kind of significant amount of Gausian noise to this data. Just for the sake of demonstration, we're going to use a noise magnitude of 0.2. And we're going to take that and multiply it by Gausian random noise of mean zero. We're also going to ensure that there's an imaginary and a real component of this noise because the data set itself has real and imaginary components to it. Um, and then we're going to take that noise, add it to our clean data, and that is what we're going to define as X noisy. Okay, X noisy is what we're going to be giving to our PIDMD model. All right, awesome. And then here we just have some code that's uh for printing out some uh some sort of array information. But let's actually just go ahead and run this and sort of take a look at what this is going to generate. And so down here we have uh information on our spatial and our temporal grid as you can see. uh but in addition we are defining specifically uh this sort of x and t sort of numpy arrays with certain shapes. T is holding on to the times at which we collect our snapshots. But the main one I want you all to sort of keep in mind is the shape of our data matrix x. Note that x noisy is also going to be the same shape. Uh but the thing that I want to highlight here is this idea that x has 65 rows and 129 columns. Recall from our discussion previously, this is because we have 129 sorts of snapshots of our system. And for every snapshot of our system, we have in our case, we have 65 entries, 65. Why? Because we have 65 collocation points in space. We have 65 essentially features or variables for every snapshot that we have. Okay, so that's something to keep in mind. uh this is how X is going to be structured not just in our theoretical discussion but also as input for PIDMD models. All right. And so uh before we kind of get into uh applying PIDMD or DMD to this data set, we're going to u first visualize this data set along the spatial and temporal grid, let me go ahead and actually expand this so that we can see it a little bit better. Um yeah, so pretty much let me actually also scroll up just a bit. There we go. So, um, here we go. We have some plots of our data of F1, F_sub_2, our clean data set, which is F1 plus F2, and then our noisy data set over on the far side. And so, what I would like to point out is that this is a visualization of the whole shebang. This is all of our data across the entire spatial and temporal grid. This is giving us an overview of like what this data set looks like entirely. Um, along this axis here, we have our space, uh, our collocation points in space. Note that we're going from 5 to 5 as expected. And along this axis, we have the time axis. So we are going from time 0 all the way up to four * pi. And this is literally visualizing what f1 looks like across time and space. This is visualizing what f_sub_2 looks like across time and space. And so on and so on. This is what our data looks like on the grid. But it also is still a little bit it leaves a little bit to be desired. I would argue this doesn't really give us amazing amazing intuition for what this system is actually doing. Uh which is why in the bottom cell right here I've provided some uh movie pi code to generate sort of uh video versions of this data set. I will not be running it because sometimes movie pi can be a little bit finicky at times. But I will be showing you all a video uh that I have generated previously for this data set. And let me just go ahead and Okay, I think yeah. So I'm going to zoom out for just a second. Some kind of formatting here happening does not like my shape sizes. Okay. Yeah. So if I go ahead and play this video which is the same data set that we had visualized before just in video form. Um this is exactly what our data sets look like. So along the horizontal axes now we have um space our spatial collocation points X and what we are literally seeing is f1 f_sub_2 our data and our noisy data but seeing how they vary as time sort of progresses like visually um let me just go ahead and play that one more time for you guys. Let's see I will I will stop talking for a moment just like let you all take in what is going on. Okay. Um and actually so and like the thing that I want to point out is this idea again I will continue to emphasize this idea of spatio temporal modes in the data. Essentially we can think of f1 as its sort of spatial signature is the sort of hump that kind of goes like that kind of exists in this area here and it sort of moves in and out at its own pace which we should note is precisely defined by that 2.3i that we used to define this data set. Right for F2 it's a little bit different. Its spatial signature is a bit different. And it's got this little uh let me do Yeah, it's got this little sort of double hump sort of spatial signature and it is kind of pulsing in and out at a actually different frequency that's defined by that 2.8 I right and so you know these two these two sorts of features with their own spatial signatures and their own uh time signatures are being added together. we're we're polluting it with noise and we are basically saying can we use DMD can we use basically DMD to kind of reverse this process and figure out from noisy data that these are the two sorts of main components of this data set. Okay. And let me play that one more time. And you can kind of see like the noisy data set. It looks looks pretty confusing actually like but I will but I would like to emphasize that that is what DMD spoiler I guess DMD will be able to do it but anyway let's go ahead and sort of show that in action. Um all right so let's go ahead. All right. So that is the data set that we're going to use. Now let's actually start um applying uh DMD with pi DMD. Okay, so this is all the math that we discussed uh previously. I'm not going to go go over it again. This is just for uh reference for this notebook. But if we kind of scroll down, this is where we're going to start putting in sort of our PIDMD code. Um okay, so PIDMD is structured very modularly. So uh it's really similar to the way uh scikitlearn is sort of um sort of structured in the sense that you have objects or modules that implement uh methods. uh you initialize those you parameterize them and then you call a fit method and then once you call a fit method and pass data through that fit method then there's attributes that will be available to your model so just for anybody who is uh familiar with scikitlearn uh style sort of syntax or like um machine learning uh that's just something to keep in mind when using pymd it's a really similar situation um so that kind of leads us to and that leads us to talking about the first thing which is first we need to decide what DMD uh model we want to use or what method do we want to use. Um so uh there's a ton of variants out there. Uh the task of choosing a DMD variant can be quite daunting. Uh but in general um personally I highly recommend for just normal DMD applications uh that you opt for what is called the optimized DMD um algorithm or um another sort of related and slightly more sophisticated version of optimized DMD is BOP DMD which uh stands for the bagging optimized DMD algorithm. Um, it is a very noise robust optimized variant of the dynamic mode decomposition that is incredibly practical and is able to apply DMD on very uh noisy data sets. It is um it works even with unevenly spaced snapshots. That's not an issue here, but it's something to keep in mind. And so in general uh when applying just um more typical or just um sort of any DMD application in the real world it's the uh method I would recommend. And so if you want to apply bop DMD with PIDMD uh it kind of boils down to first uh importing the right module. So from PIDMD you want to import the module you want to use. So bop DMD is um as you might guess is is implemented by the bop DMD module. Um then once then the next thing you need to do just like with scikitlearn type models uh you need to initialize your model and parameterize it. So again recall so our toy data set consists of two spatio temporal modes. Um and what we would like to do is kind of say well I want to apply DMD but also I want to take into account the fact that there are two uh sort of dominant spatial modes sort of in my data. Um let me just go ahead and move this over to the side here. Um okay and so uh we can kind of do that by sort of passing in some parameters to our bop DMD model. So, uh, what I'm going to do is I'm going to call my bop my bop DMD pi DMD model. I'm going to call it just a lowercase DMD. I'm going to initialize a bop DMD model and then I'm going to parameterize it with SVD rank is equal to two. Now, what this is going to do is it's going to tell uh my bop DMD model, hey, I am anticipating two spatio temporal modes. Okay, that's how many I want you to learn as we go throughout computing uh DMD. Okay, so that's what that means. And then once we build our model then all that remains is to fit our model to some uh snapshot data. So specifically you need to invoke the fit method. Basically every pymd module uh implements its own fit method. Um and sort of goes about that differently depending on the variant. Uh so here we're going to call fit. Um this is going to perform the bagging optimized DMD routine. Um and then we need to give it our snapshot data. Specifically we are going to give it the noisy snapshot data that we have. And then also Bob DMD requires that we give uh we also provide uh the times [clears throat] at which we have collected our snapshots and that is stored within the time vector t that we defined. Okay, so I'm going to go ahead and run that. Um okay, and so it's going to give you a little warning. Um it's okay um to sort of disregard it for now. Sometimes uh the bop dmd uh implementation can be a bit picky about tolerances with its optimization and so it'll maybe throw this warning. But um sometimes and actually for a lot of cases um even if this warning goes up your fit is actually ends up it ends up being pretty all right. So I wouldn't really worry too much about this. Uh this is just kind of and this is kind of showing us okay so now we have a bop DMD model from pi DMD. So now what exactly are we working with now that we fit this model? Okay, so the first thing I want to point out is just and again just like really similar to scikitlearn models now that we've done fitting we have now have access to model attributes uh specifically if we recall with DMD we have those three attributes remember we have spatial modes uh frequencies that define the temporal um frequency and the time dynamics matrix and then we also have amplitudes B okay so let's kind of see how do we get all three of those components from a fitted PIDMD model so to get the frequency ies you just need to you can access all of that through the IG property. This is now going to contain something now that we've fitted our model. But if I run this uh you can see that what this is going to hold on to is basically a two element array uh that contains our igen values. We call this uh the property is called iigges because these are quite literally the igen values of the continuous time operator given by a which describes the uh the the um derivatives of the state. Um but also these are these are also those omega parameters for our time dynamics matrix. Okay, those are those omega one and this is like an omega 1 and omega 2. Okay. Um and you know we have two frequency values. I want to point that out. Why two? Well two because we asked DMD when we built our model, hey I want to build two spatio temporal modes. And so um as a result we're going to have two frequencies one for each spatio temporal mode. Okay. And let's kind of take a closer look at sort of like these elements here. So um if we kind of zoom in on the real components of these, we're going to see that these real components are very very small. They're like something like something* 10 theus4. You know, they're very small. But if we take a look at those imaginary components, what do we see? We see one of them is 2.79. So approximately 2.8. And then the other one over here is uh 2.29, which is approximately 2.3. So does that seem a bit familiar? Um yeah. So you'll notice that when we apply DMD um to this data set, we are finding uh frequencies with very small real parts and with imaginary components that correspond directly with sort of those frequencies that we use to parameterize those exponential time dynamics for the true the underlying ground truth spatial temporal modes. Right? So if we kind of go all the way back up here, I'll kind of show the equation just one more time as a like just to refresh on this. This is precisely related to the fact that we defined f1 and f_sub_2 to be there are time dynamics to be parameterized by these um 2.3 * i and 2.8 x i sort of components. And so what we are finding when we apply DMD is we are literally um sort of discovering that from data alone, right? Um but this is the first component. Now let's move on to some more components. The next component that I want to look at once you fit a DMD model, you now also have access to uh a modes and a dynamics um attribute. And so what modes is is modes is literally going to be that spatial mode matrix 5 that we were just talking about. Um and the dynamics attribute is going to be essentially that t omega matrix. It's that um matrix of exponential time dynamics parameterized by those IGEN values we were just looking at. And it's also going to be scaled appropriately by the amplitudes B. And so uh to get more intuition on this, let's go ahead and actually print this out. So let's or let's start by printing out the shapes, right? So like I'm going to say dmd.modes and then we're going to print just the shape. We're going to do the same thing with the dynamics. DMD.damics uh shape. Okay. And then let's go ahead and run that. All right. Cool. So these are the shapes of these two uh properties. Um and let's kind of take a look at this. So modes is going to or in our case modes is uh a matrix that contains 65 rows and two columns. Two columns because we have we asked for two spati temporal features and therefore or two spati temporal modes and therefore we have two sets of spatial modes that we care about. Um and then each of those modes has 65 features. uh 65 features because that is precisely how many spatial collocation points uh we are dealing with. Okay, so that's where the 652 comes from. And then for the dynamics shape, we have something that has two rows and 129 columns, 129 columns because that's how many snapshots we are that we have from our data. Um and so we have we have to account for the dynamics of all of those points in time for our snapshots. And then also there's two rows because we are accounting for the dynamics one set of dynamics for each uh spatial temporal mode. Okay. Um those are just the shapes but like uh you know given all of that context we can just go ahead and gain even more intuition by just plotting these out. So let's go ahead and do that. So um you can actually plot so since we know what our kind of collocation points in space are I can plot the columns of fi or the columns of the modes matrix against uh the spatial collocation points and so we're going to do exactly that. So dmdodes we're going to grab the first column plot its real component. So there we go. We're going to take the modes again uh grab the second um column this time and als and again plot its real component. These are going to plot literally we are literally taking the columns of phi and then plotting them out and seeing what they look like. Okay. And we're going to do a similar thing with the dynamics. Uh it's just that for the dynamics we want to plot it with respect to time. Okay, not space but time. And so then we're going to say, okay, give me the DMD dynamics. Okay, we're going to plot the first row and the real components of that first row. So like that first sort of exponential time trajectory, the time trajectory for that first spatial mode. And then we're going to do the same thing but for the second one. So D, oh D mix one, the second column, the second row, I'm sorry, and then the real component. And before I go ahead and run the cell, I also just want to point out exactly what else um is going on in this cell. So here um I'm going to be plotting in addition the sort of hyperbolic um trig functions that we use to define the spatial sort of um the spatial features for our underlying ground truth modes. So that's the first thing. Um and then I'm also going to uh be plotting some sinosoidal functions specifically cosine functions that are defined using that 2.3 and 2.8 sort of frequencies that we are using to define our exponential time dynamics for again for our ground truth dynamics. So we're just going to plot these. This is all going to appear on the bottom uh just for reference. But let's just go ahead and run this and see what it actually looks like. Okay. Okay. Nice. All right. There we go. Amazing. Okay. So what are we looking at? So let's break it down. So this first row is uh show sorry this first row is showing us basically the results from DMD. Again DMD is it only looks at the noisy data nothing else. It just sees that noisy noisy data and uh the time points and then it extracts this information. Down here are sort of those spatial signatures and time signatures uh that we were using to define the ground truth underlying system. So this is just for reference purely for reference this row here and what and what you should see basically immediately is that the these are exactly the same thing. These are the same thing and and let me let me just kind of elaborate a bit further. So here is our plot of the columns of the spatial mode matrix fi. And you see that these are exactly capturing these are exactly capturing essentially those sort of spatial signatures that we use to define our two underlying spatio temporal modes. They're the same thing like visually. On top of that we also nail those time dynamics. If we look over there at these these two plots here, we see that um DMD is telling us not only do I find these spatial signatures, but each of these spatial spatial signatures has a corresponding um sort of time dynamics given by these sort of oscilly signals um that are defined by those IGEN values that we that we printed previously. And you can see because in those igen values we capture those like that 2.8 a imaginary component and that 2.3 imaginary component we are nailing the correct frequencies as well at least when we compare it to um sinosoids with the same frequency. Uh note the there's a difference in amplitudes uh for this and again this is I will point out again that this is because the dynamics attribute of DMD of pi DMD models are scaled by amplitude. So that's kind of where that extra scaling comes in. But I still I cannot stress this enough that from data alone, PIDMD is re PIDMD with a BOPDMD model is realizing, hey, your data consists of these spatial temporal features, these two specifically. And it actually just totally nails it. Um, which is amazing. So awesome. I talk about this a little bit more in this little paragraph here, but anyway, let us continue. Continue. Okay, so finally, so we've seen the time uh the time frequencies and we've seen or we've seen the temporal frequencies and we've seen the spatial modes. The last thing we haven't looked at yet is those amplitudes and this is also similarly easily uh accessible. Um you can just call the amplitudes property on a fitted pi DMD model and print it out. And this is what those amplitudes look like right here. Okay. Um and so again, one amplitude for each spatial temporal mode. So we have two amplitudes, right? Um and the thing to take uh note of is that what this is telling you is this is essentially giving you some kind of idea of the importance of each of those spatial temporal uh features. Um because those amplitudes are kind of scaling those spatial temporal features and kind of showing how and kind of telling you how much they contribute back to that reconstruction of the data. Um but literally so um if we kind of scroll back up to look at our values just scrolling real quick just for a little bit of reference. uh our first igen value was that 2.8 frequency igen value. Um and our second one is that 2.3 frequency igen value. And so if I scroll all the way back back back to our amplitudes here, uh we're going to see basically then that means that this is the amplitude that corresponds with the 2.8 spatio temporal mode and then this one is the one that corresponds with the 2.3 uh spatial temporal mode. And so um you can literally interpret this as saying basically like this mode so this first mode is slightly more is ever so slightly more um kind of important than this mode or more dominant in the data set. Uh basically is one way to interpret this. This may seem a little bit silly and like not super informative, but if you're building a DMD model with many many many spatial temporal modes, they're you know looking at the amplitudes can be quite helpful in the sense that if you find that any of your amplitudes are incredibly small, then that gives you some idea of like, oh, okay, like this a this these spatio temporal modes that correspond with sort of really small amplitudes. This is just a this is just signaling to me that these spatio temporal modes aren't contributing much to my data. So maybe I can get rid of them or you know build a DMD model with less modes you know. So it it gives you so again like this is you know something to like to kind of keep in mind as you perform DMD in practice. Uh but anyway let's go ahead and continue on. Okay. All right. Okay. So now that we've seen the amplitudes, we have now seen essentially all of the components of the dynamic mode decomposition. We've seen the igen values which give us the time dynamics. We've seen the spatial modes and we have also now seen the amplitudes. So we have all the pieces of our decomposition. Okay. And so now let's get into sort of how you can use all of these components to get a nice data reconstruction. Okay. So um in the cell here I have some placeholders. Um I will fill them in as we go. Uh again, you can read the uh documentation blocks at your leisure. Uh but basically, I'm going to be plotting sort of the arrays that are inside of this list. We're going to plot the uh clean data and the noisy data and along with our reconstruction. Uh and here we're going to compute the reconstruction um error uh and we're going to compare it against the clean data set. Okay, so if I scroll back up to sort of our previous results, the results for specifically the uh the modes and the dynamics we find, uh if you can recall from our uh discussion on theory of DMD, um pretty much what we can do to reconstruct our data using these components is we can basically say, hey, I know these spatial signatures and I also know sort of how they should be pulsing in and out as time goes on, right? And so, you know, I can just basically take these and then, you know, use those dynamics and then sort of add them together and then get a kind of like a reconstruction for uh my data from from fitting. Um, and you know, you could just, you know, I I just showed you all how to like grab these components individually from the model. You can, you know, definitely just sort of compute that on your own. Compute these spatial temporal components on your own, add them together, and get a reconstruction. Um, but, you know, there's no need to do that. uh PIDMD models actually hold on to that information uh for you or they can do that computation for you because they have access to all of those components of DMD. Um and so really it just kind of comes down to if you want to have access to your reconstruction, you can just call your fitted model DM DMD and then you can ask for the reconstructed the reconstructed data and that's about it. Uh what this is going to do is it's going to basically multiply that um spatial mode matrix VI by its uh amplitude scaled time dynamics and that's ex exactly what this is. So super easy to access the sort of information. But let's go ahead and plot what that reconstruction looks like. And let's also um take a a look here at [snorts] what the error in the reconstruction is. So let's go ahead and run that cell. All right. Okay. So cool. Um let's scroll a little bit up so that we can see a bit better. Okay. So um as you can see, so again, clean data, noisy data, uh DMD reconstruction on the far end. And um I think the thing that I just want to point out is that um if you kind of take a look at this reconstruction, it's it's pretty good. It's pretty darn good. Um more precisely, the uh relative error of the reconstruction is about 5%. So it's not like amazing amazing amazing but at the end of the day this is a very noisy data set and also DMD is doing an incredible job at kind of nailing the fact that there are these two spatio tempmporal components. It's getting the dominant sort of features spoton. Um and you can kind of see that in the reconstruction when you compare it to the clean data set. Remember again, DMD only knew what had access to this and now it's saying that's what that's how I'm going to reconstruct your data. So visually that actually looks pretty awesome. And uh yeah, I guess that's like the one thing I want to point out just like getting reconstructions. It's literally using those components we just talked about, but you can access it through a nice uh PIDMD model property. Um and then yeah so let's sort of finish up by talking about some of the plotting tools that is offered by PIDMD. So you know I just you know took all this time to show you all these individual sort of components uh that PIDMD models hold on to and sort of how they relate to how they relate to uh our DMD theory and then I also showed you all how to like access those like bit by bit. Um but in practice like you don't actually need to do that. you can actually call uh one of the built-in PIDMD plotting tools and basically you can perform that entire process just uh with a simple plotting function call uh and I'm going to show you that in just a second again uh these blurs read at your leisure if you would like but um I'm going to just show you all that it's as simple as just calling this plot summary function. Uh so in order to grab plotters from PIDMD you simply have to say from pi dmd.plotter. So that's the sort of folder that holds on to all of our plotting functions we want to import. So we're going to import the plot summary function. Oopsies. Uh the plot summary function. As you can see, there's many functions inside of this um library. I'm going to specifically grab the plot summary one. Um but plot summary um basically the main thing that it really really needs is a fitted PIDMD model. And it's as simple as just saying, hey, give it DMD. As you can if you can recall, that's what we've been calling our fitted model. And that's all this function really requires. Uh we can but in this example I'm going to give it more information. Uh so first of all uh you can give it some more information about your your spatial and temporal grid. Um that'll help make the plots that are given by this function a bit more it'll help them be uh more informative. Uh so for example if I want to if I know the spatial grid I can say hey plot summary this is what the spatial grid is. It's given by what we call the variable x. Uh we can do the same for the temporal grid. Um and then we can keep going. We can even uh in this case I'm going to set the figure size um to be let's make it like about 126. And then [singing] uh I'm going to let flip continuous axes be equal to true. This is going to help us format one of our igen value plots which we'll be seeing in just a second. But let's go ahead and run this. Um, and I'm going to sort of pull this out so that we can see it a bit better. But as you can see, when you call plot summary, you get um this big figure with a bunch of subplots in it. Um, we're going to sort of look at these piece by piece. But actually, right off the bat, I'm sure you are already recogn you're already recognizing some of the components of this plot. As you can see in the middle row, let's start here. In the middle row, we have plotted our spatial modes. we basically see that we get the first mode which is like the double hump and then the second mode which is the single hump and then directly below we get the time dynamics that are given by those igen values that DMD has learned. So here um this is just E raised to uh that first igen value and then this is going to be E raised to that second IGEN value as time progresses. Okay. Uh note the color coordination though. So as you can see uh the titles of these plots uh mode one has a red title and also this dynamics title has a red is colored in red as well to indicate that these are the dynamics that correspond with this mode the red mode and as you can see this is also true for mode number two which is colorcoordinated with blue. The color coordination also carries into our igen value plots but before we kind of talk about those um in detail let's first address this plot up here in the upper corner which is the singular value plot. Basically what this is plotting is the singular value spectrum of the actual data matrix. Um and so if you kind of like look at what's happening with this these singular values in the first place, you see that there is two basically like major uh dominating sort of singular values within this spectrum. And this is basically indicative of this idea that perhaps two spatio temporal modes is enough to reconstruct this data set. And in fact for this particular case that is true. But I just want to point out that you can also see that through the singular value spectrum of the data matrix itself. Um and then furthermore um on the farthest IGEN value plot from me is the continuous time igen values. These are the igen values that have been held on to in the iG property that we uh were just um talking about. And in the middle plot here is the discrete time values. So essentially when we say discrete and continuous time we're referring to the type of operator that we are considering. So the continuous time operator is the one that describes the evolution of the time derivatives of the state. A discrete time operator instead describes um sort of like how you go from one point in time to the next point in time. It's discreet. Um and so there's a nice uh relationship between the discrete time and continuous time values. So we plot both of them just for reference. Um depending on your application, you know, uh you know, you might prefer one or the other. But I do want to point out that over there on the far end the continuous time igen values you see that uh we're plotting the real components against the imaginary components and we are exactly seeing what we were seeing before which is a small real component um but the imaginary component is described by what is approximately 2.8 and 2.3 okay so that's what that plot is and again the color coordination to show which value is associated with which mode and which set of dynamics. Uh the final thing I do want to note is to note the um the size of the markers of the igen value plots. So essentially the size of the marker is reflecting basically the corresponding amplitude for the mode. The bigger the marker the bigger the amplitude. And so in our case right uh you know the the markers are about the same size because our amplitudes weren't too too different from one another. But you can see that the red marker is slightly bigger because of its slightly larger amplitude. Um, so that is another thing that plot summary tells you just right off the bat. Um, and yeah, so that's everything about plot summary. Um, and we're just about ready to wrap up here, but before I kind of get out of here, I just want to talk a little bit about building complex models. So uh for those of you who are sort of um who are sort of familiar with uh routines and optimization, what bop DMD is literally doing under the hood in the PIDMD implementation is that it's solving um it's solving basically a variable projection with nonlinearly squares and it's it's basically performing a variety a like multiple like a single or perhaps multiple optimizations across the data. That is literally like what it's doing. I will not be getting into that in detail in this video. Um, but if you are interested in learning more, I highly recommend you check out our other tutorials for BOP DMD as well as for other extensions that use BOP DMD. Uh, many many tutorials for you to look at there. Um, but I just want to point this out because because of the way we're doing these like sort of complex optimization routines, there's a lot of customization that can go into this. So for example, you can ask bopdm models to run multiple optimizations over like sort of randomly selected bags of your snapshot like bags of your snapshots. You can basically say, hey, like build me a bop DMD model that still has a, you know, that's still looking for two spatial temporal modes, but what if we performed like a hundred optimization trials, we used 80% of the data per trial and hey, like what if as we did the optimization, we put in some constraints on the IGEN values that we're learning. In this case, what if we, you know, constrain your IE values to be purely imaginary because uh, you know, maybe you're expecting your dynamics to be purely oscilly oscilly, no exponential growth or decay, in which case you'll say, hey, like I want to throw away those real components, like get them out of here. Get them out of here. You can kind of make those sorts of adjustments with arguments like this. Basically the idea is that you can build these very these much more complex um modules by simply like uh customizing the parameters of your DMD models and then you can go ahead and perform the rest of the exact same pipeline we did before uh call the fit uh method on the noisy data and then just kind of throw all like figure out see like visualize all the results in a single uh plot summary function call and then here we're also going to like display the uh reconstruction error as well. So you can basically just do this whole process and it's going to take a second to run. Oh, boom. See, it's like already done. But like, you know, you can basically do processes like these. Um, and you know, I just want to point out that, you know, visually like, you know, this doesn't really there aren't really major major improvements that come from doing all of this for this particular uh synthetic data set. But I do want to point out that for much much more complex sort of applications of DMD, it could be the case that you will need more complex models. And I just want to point out that that is 100% an option when you use models from PIDMD. Um, and yeah, I think that's basically everything I want to say. Um, so there's some more there's some bonus exercises here in case anyone is interested in sort of tinkering with the code even more inside of this notebook. Um again notebook will be available on the GitHub um for PIDMD. Um but yeah if you want to learn more uh I highly recommend you kind of check out our tutorial suite. It's on our PIDMD GitHub. Um but um I just want to point out that you know like we have tutorials for various modules and various like interesting data sets and you know if you want to learn more please please check that out. Um, we also in addition to our journal of machine learning machine learning research paper, we also have a longer version of that paper on archive in case you want to read more like read beyond just the journal of machine learning research paper. Um, but yeah, there's yeah, there's tons of resources and super awesome. I'm so excited. I really appreciate you all just being here and listening to me talk about PIDMD. Um, and thank you so much for watching. Um, I'll see you guys maybe hopefully applying DMD.

---

## 11. Maximum Likelihood Estimation Example: Fitting a Normal Distribution with Data
**Channel:** Steve Brunton | **Views:** 8K | **Date:** 2 months ago | **Duration:** 15:53 | **ID:** x5GOUgCTkjM
**Link:** https://youtube.com/watch?v=x5GOUgCTkjM

### Transcript:
welcome back so in the last lecture we introduced this maximum likelihood estimation procedure to estimate the parameters of a probability distribution these parameters Theta given some data that we've collected X1 through xn so if we have a sample of data then this is a statistical method to find kind of the best parameter estimate Theta that's most consistent with that observed data and we do this by essentially writing down something called the likelihood function which is the likelihood of finding that particular instance of data given the parameter values Theta that we're trying to identify or estimate and in principle what we're trying to do is find the value of the parameter Theta that maximizes the likelihood function of finding my data given those parameters uh and the last little piece is that we usually take the logarithm of that likelihood because it's easier to optimize over so today I want to show you how to do this for normal distributed uh data set so if I have X1 through xn that we think comes from a normal distribution and we're trying to use ml to estimate the parameters mu and sigma squar we're going to derive that today just as another example of how to use maximum likelihood estimation good uh let's jump in so we say that all of our data is distributed according to this distribution but these are unknown parameters I'm just going to write down essentially these are unknown uh you know theta equals mu comma Sigma squ if I wanted I could say that the unknown parameters that I'm trying to estimate are these parameters and so we want to find some Theta hat some mu hat and sigma hat squared that kind of are most consistent with the data observed okay in some sense and I'm saying you know optimal optimization because we actually write this as an optimization problem uh which is kind of nice okay so let's get into actually computing this thing so the first thing is we write down our joint probability density for all of this um all of this data we say that um for a normal distribution F of X1 X2 dot dot dot xn given my parameters Theta and my parameters Theta are mu and sigma squar so I could replace this with a mu comma Sigma squ in fact I'm going to I'm going to try to actually be consistent with my notation here so given mu and sigma squ that we're going to be trying to estimate this all of these variables are IID they're identical independent random variables they're um independent and identically distributed according to this distribution and so that means that this joint PDF is the product of the PDF of each of these normal distributed variables independently so this equals the product from IAL 1 to n of the gaussian normal distributed uh probability density for each of these XI and that is uh 1/ Sigma < tk2 Pi if someone shakes you awake at 2 in the morning you should probably be able to write this down uh e to the minus um X IUS mu divided by Sigma squared okay divided by Sigma this is uh quantity squared and there's a 1/2 out front Okay so this is the probability density for the xif uh random variable it's 1 / Sigma < tk2 Pi e to- 12 x IUS mu over Sigma qu^ SAR that is the the formula for the density function of a normal with mean mu and variance Sigma squ and since I have n data points that are IID from a normal distribution The Joint probability because of Independence is the product of all of their individual uh density now what we're going to do is we're going to build our likelihood function we're going to literally plug in the observed data for all of these little XIs we're going to replace them with data big XI and then we're going to be trying to maximize uh we're going to find the MU and the sigma squared that maximize that likelihood function specifically the log likelihood function good um so the first thing I'm going to do is before I write in big x's and and actually build this this thing here I'm just going to take the logarithm of f um because I think that's going to help me out here okay so let's let's do that and I'm going to switch to Orange so the logarithm of this F function is equal to the log of this giant product here which is the log of a product is the sum of the logs of each of these individual terms so this is the sum from IAL 1 to n of the log of every everything inside of here and the log of everything inside of here we're just going to go piece by piece and do the log so the nice thing about the log is that logarithm of a * B / C is log of a plus log of B minus log of C it's really easy to take fractions and products and take their logarithm okay so the log of f which is a product is the sum of the log of everything inside and that's going to be the sigma on the in the denominator so it is minus log Sigma minus log Sigma minus the log of 1 over uh minus the log of < tk2 Pi which is - 12 log of Pi you can confirm that this is correct okay sorry log of 2 pi there's a two in there this is log of 2 pi okay um the log of e to anything is just that stuff so minus 12 x IUS mu over Sigma quantity squared okay that is the log of every of everything inside of here now what we're going to do is we're going to use this expression that we just derived and we're going to compute this likelihood function which is we're going to compute this log likelihood function little L of theta which is the logarithm of my likelihood function where it's now I plug in all of my data big X for all these little X's I want to make sure this is um yeah it's it's the sum of the log of f where now I evaluate at my data big X so it's the sum of log of f um here okay good so my L my log likelihood function is now just going to be a function of mu and sigma squ because what we're going to do is we're going to plug in data here and so all of these variables XI are going to become actual numbers and this is only going to be a function of Sigma and mu okay so this essentially equals log of f evaluated at the data this is my short hand for saying I take this expression and I plug in data here and this equals um the sum over this is minus n log Sigma this is going to be a constant um - n / 2 log 2 pi that's just a constant minus um this thing here which is going to be um I'm going to pop my 1 over 2 sigma^2 out minus uh 1/ 2 Sigma 2 sum I = 1 1 to n of x i - mu^ s okay and this is something that you can compute all of these XIs are just numbers so it's the sum of a bunch of numbers minus mu^ 2 okay that's really really easy okay this is my log likelihood function and now what we're trying to do is find the parameters mu hat and sigma hat that maximize this log likelihood function we want to find the MU and sigma that that make this as big as possible because that will be the parameter values that would be that would mean that this data is most likely to be observed given those parameter values that's what this means okay so to optimize this thing what we do is we compute the partial of L with respect to mu and the partial of L with respect to Sigma squar okay uh and I'm going to do that maybe I'll switch back to Orange just so it is a little contrast so we're going going to optimize we're going to compute partial L partial mu and we're going to compute partial L partial Sigma okay and then we're going to set those equal to zero and that will be the MU and sigma that maximize or minimize this uh log likelihood function okay so partial L partial mu um this doesn't have a mu this doesn't have a mu this term has a me and you can kind of uh work out that when I'm telling you is true this is going to equal uh the two cancels out I get one over Sigma 2ar times the sum of X IUS mu from I = 1 to n okay that's just taking the partial of this with respect to mu and the partial of L with respect to Sigma is a little harder but it's um this term has a sigma and this term has a sigma so of this with respect to Sigma is just - n/ Sigma derivative of log Sigma is 1/ Sigma this is a constant so it's derivative is zero and then I take the derivative of this with respect to Sigma and I just had this over 2 Sigma squar here so this is uh plus Sigma to the -3 power uh 1/ Sigma cubed times the sum of all of this stuff because that doesn't depend on Sigma it's just a constant as far as as far as Sigma is concerned um IAL 1 to n okay so this is essentially setting you know kind Computing these partial derivatives these kind of sensitivities of L with respect to the parameters and now I want to set these equal to zero to solve for the optimum values of mu and sigma okay so let's do that um we're going to set this equal to zero and so for this partial L partial mu equals z the only way that can happen is if um let's see essentially what we're going to do is expand this out um and actually write this sum out maybe I'll just do this um all the way so the sum equals um this equals 1/ Sigma 2ar * N I messed this up uh yeah n * X X bar this is just um the sum of all of my x i is the sample mean * n minus n * mu okay and the only way that this can equal zero partial L partial mu equals 0 implies that my xar equals mu that mu hat equals my sample mean xar okay I was a little fast here if you want you can pause and convince yourself I literally just expanded out the sum and the sum of the first term is n * xar the sample mean um because the sample mean is 1/ n * the sum of all of these XIs so the sum of all these XIs is n * my sample mean and the second term is a constant so if I add it up n times I just get minus n times that constant and we're trying to find the MU that that makes this equal to zero this partial equal to zero the MU we call it mu hat the optimiz mu that makes this equal to zero is Mu hat equals xar the best mle maximum likelihood estimate for Mu is the sample mean that's exactly what we got from the method of moments so this is good this makes sense now we do the same thing for Sigma we say partial L partial Sigma equals 0 partial L partial Sigma equals z this is a little more involved but we take this thing and we try to find a sigma that makes this equal to zero okay um and through a little bit of you know dot dot dot we get n over Sigma equals because this is minus I'm just moving it over um so this equals uh 1/ Sigma cubed * the sum from I = 1 to n uh and here instead of mu I'm going to plug in my mu hat which is xar this is x i - x bar squar okay and essentially now I'm going to solve for Sigma I'm going to multiply both sides by Sigma cubed and divide by n and I'm going to get Sigma squar equals 1 / n sum I = 1 to n of my data x i minus my sample mean xar squared and I'm going to put a little hat on this guy because this is the sigma that makes this partial l I Sigma equal to Z this is the optimizing value of Sigma squ is this expression here so let's just put a box around these this is uh these are the two mle estimates these are the maximum likelihood estimates for mu and for Sigma squar and you'll notice this is exactly what we got from the method of moments this is consistent with our our answer from the method of moments that's not always going to be the case but here it is the case for a normal distribution uh and for a pon distribution the maximum likelihood estimate is the same as the estimate from the method of moments now probably what I would need to do to really prove that this is that these values maximize the log likelihood is to also compute the second derivative and basically show that these are you know uh local Maxima in my parameter values and not local Minima in my parameter values and that would be a nice exercise for you to do is compute the second derivatives and verify that if you plug these in you get a maximum not a minimum okay so this is another example of how to use uh this method of Maximum likelihood estimation to find the optimal parameters mu hat and sigma hat in this case for a normal distribution based on some data um some some some sample data okay and you can use this for tons of distributions you can use this in machine learning where the distribution is parameterized as a neural network where Theta are the weights of the neural network you can use this all over the place and there's also beijan extensions to this which are really really powerful too okay so get used to doing this try this for another distribution um you know go through and make sure that you believe all of the steps of this math and that it's consistent with what we have written here compute these second derivatives to make sure you're maximizing the log likelihood not minimizing it um and you'll get really good at this really quick okay thank you

---

## 12. Maximum Likelihood Estimation (MLE) with Examples
**Channel:** Steve Brunton | **Views:** 21K | **Date:** 3 months ago | **Duration:** 23:46 | **ID:** rCdxlN6Ph14
**Link:** https://youtube.com/watch?v=rCdxlN6Ph14

### Transcript:
welcome back so today I'm going to introduce the concept of Maximum likelihood estimation which is a powerful method in statistics to estimate the parameters of a probability distribution from data okay um one of the reasons maximum likelihood estimation is so powerful is because it reframes this estimation problem as an optimization problem so we can use all of our powerful Tools in optimization Theory uh for parameter estimation in statistics this is going to be the basis of lots of algorithms in machine learning so you're going to see maximum likelihood estimates in machine learning all the time and there's also a really strong connection to beian uh parameter estimation and I'm going to make that connection towards the end of this video so I'm going to introduce what uh maximum likelihood estimation is uh we're going to work it out on an example of a Pon distributed random variable and then we're going to make that connection to Bay theorem and we'll have lots of more you know videos on on ML later okay but let's get started so we're going to start with some data so we're going to let uh X1 dot dot dot xn uh be our n samples from some distribution it doesn't have to be Pon but in this example these will be Pon variables so let these uh n variables essentially have a joint probability function have a joint uh probability function probability function and I'm just going to write this out and Define what it is so this joint probability function is some function uh of X1 X2 dot dot dot up to xn given the parameters I'm trying to estimate Theta so these are my unknown parameters I want to learn in the case of Pon it would be this Lambda parameter um but here I'm using a general variable Theta and this equals the probability of finding my first random variable big X1 equal to this specific value little X1 uh and so on and so forth so all the way up to my random variable n equaling this specific little value little xn given my parameters Theta so given a set of parameters Theta there would be some probability distribution these would these would parameterize a probability distribution like Pon or normal or Gamma or whatever and it would give me the probability of finding these random variables this draw of n samples having these exact numeric values so these are kind of um this is what I mean by a joint probability function now this might sound really messy now I'm picturing you know some horrific PDF that has a bunch you know n different little variables it's a really complicated function but it's actually a lot simpler than that one of the really nice things about maximum likelihood estimates and this formulation is that if these X's are I if they're in independent identically distributed random variables so um if these uh X's are uh i i d that means independent identically distributed then the joint probability is the product of each of those individual probability density functions for each of these random variables then essentially uh then we have uh F of X1 1 X2 dot dot dot xn given my parameters Theta is equal to the product of all of these individual probability distributions x i given Theta the product from I equals 1 to n so this remember this is a property of uh Independence um in in multiple variables of a of a probability density is that if uh you know X1 and X2 and X3 and all of these are independent then I can write this probability this joint density as the product of each of their individual density functions so let's write that up here for the Plus on just to make this concrete this is pretty mathematical let's see what it looks like up here and then we're going to derive the maximum likelihood estimator to get the best Theta given this measurement data so that's coming up in a minute but let's uh actually write out what this uh joint density function looks like for a Pon distributed random variable so here we would have again again this F X1 X2 dot dot dot xn given Theta is equal to the product from IAL 1 to n of all of the individual probability density functions um so this is f of uh x i given Theta and I should probably make a note that here this Theta is actually my Lambda parameter this is going to be Lambda okay and for a pan random variable we know what this probability density function is for a single Pon random variable and we're just going to multiply all of those probability density functions so this equals the product from IAL 1 to n of the PDF of a Pon which is Lambda to the x i time e the minus Lambda over uh x i factorial okay so the probability that my random variable big XI is equal to the value little XI these are integers for Pon is Lambda to that power e to the minus Lambda divided by that um specific value factorial remember these are integers integer factorial no big deal so this is actually not too bad this is the joint probability density function here that we're talking about in general for the specific case of a Pon uh distributed data set okay so now that we have this we're going to derive the maximum likelihood uh estimator and talk about some properties of it and we'll keep working this example over here good so essentially what we do is given this joint PDF we Define something called the likelihood function which is only a function of of theta so we Define um the likelihood likelihood of theta is equal to this joint probability density where instead of being functions of kind of these little variables I actually plug in my actual measured data set so this is f of big X1 big X2 dot dot dot big xn given Theta and so what we've done here is we've essentially taken this general formula this general formula for the probability density and what we do is we stick in specific numbers we obtained from our sample we had this measure sample we have data and we're trying to fit this parameter uh Theta you know using statistics and this data so what we do is we plug the values of this data into our PDF and now we have a function only of the parameters Theta and it tells us How likely was it to get this data given those parameters it's a likelihood function uh and it's only a function of theta and so now what we're trying to do is we're trying to find the value of theta that maximizes this like likelihood of the data actually having these values we're trying to find that Theta that maximizes this likelihood that's why it's called a maximum likelihood estimator and maybe I'll just draw a little picture here because this helps me think about it is let's say my data um you know looks like looks like this I have some you know some data some samples and what I'm trying to do let's say I know that it's a Plus on distribution but I don't know Lambda and so I could use different lambdas to try and fit different probability density functions and there is some Lambda value some some parameter value Theta that gets me kind of the closest to matching my data that has the most likelihood of me generating this data with that particular distribution that's what this is trying to do is find that particular uh kind of Lambda or Theta value that maximizes the likelihood of observing this data given that distribution okay and again um is equal to now the product um from IAL 1 to n of these individual PDFs evaluated at my actual data and what um the maximum likelihood estimator does is it says that Theta hat is the the Theta that maximizes this likelihood function it's the um we call this the AR Max uh of the likelihood function uh of theta so it's literally we do some optimization we find the maximum value of this function over all thetas and that Theta hat that maximizes the likelihood function is our best estimate for our parameter this is our parameter estimate um and the last thing I want to tell you is that typically for maximum likelihood estimation what we actually do is we actually minimize the logarithm of the likelihood function so we actually um introduce this L of theta which is log of the likelihood so you'll definitely be hearing this all over now if you're paying attention you'll hear log likelihoods and things like that you take this likelihood function and you take its logarithm and because the logarithm is a monotonic function well behaved the maximum of this like this log likelihood is going to be the same as the maximum of this likelihood and so actually we do is it's the argmax uh over Theta of this L little L Theta which is my log of my likelihood function so this is actually what we do in practice because it's easier to optimize this logarithmic likelihood function than it is to optimize the actual likelihood function and we'll see that very very clearly up here we're going to build this this likelihood function and we're going to show that the logarithm of it is much easier to optimize over and part of the reason that this is so much easier to optimize over is because if we actually write out the logarithm of this likelihood function the logarithm of a product of functions is the sum of those individual logarithms so if I take um I'll actually write it out so this is log of this product IAL 1 to n of f of x i given Theta but this log of a product is equal to the sum I = 1 to n of the individual logarithms of each of those individual easier smaller functions okay so the fact that we can take this kind of product joint distribution and write it in log form as a sum of logarithms it's often much easier to optimize these sums it's easier generally not always but it's easier to optimize uh a sum over a sum okay so that's the big idea here of Maximum likelihood estimation is that if our um distribution has a if our data has a joint probability distribution given some parameters Theta you can plug in the observed data that you actually collected to get a likelihood function of How likely it was to observe that data given the those parameters and then you optimize to find the maximum likelihood the parameters Theta that give you the most likelihood of observing that data okay and you can picture it kind of as sweeping through all of the puss on lambdas until you find the one that gives you the maximum likelihood of matching your actual data in practice we take the logarithm of that likelihood function and actually optimize that because it's a lot easier because our product of densities turns into a sum of log densities okay so let's finish working this out for the pisson example and you'll start to see kind of how the mechanics of this work very very general this works for lot of distributions even distributions that don't have names that are weird you can do this even for machine learning distributions you can do this optimization very very cool stuff okay good um so let's actually work this out so this is our joint PDF F and what we're going to do is essentially build this uh L of theta and this L of theta is going to be the log of the likelihood which okay I'm just going write this all out it's log of the likelihood of theta and what we do is we take the logorithm of this density where we've plugged in the actual data values into each of these variables XI okay so this equals um the log of f of data X1 all the way up to data xn given Theta okay good and here I'm being uh you know Theta is the general name for my parameter in the case of Pon it's Lambda so here this Theta is going to be lamba they're the same variable here you can swap them out okay good um and so this is going to equal the log of the product of each of these uh the each of these terms so this is equal to the log of the product from IAL 1 to n of uh Lambda now I plug in my actual data Val here eus Lambda time the factorial of the actual you know I data sample I have and this equals a big sum this is going to equal again the sum of each of these logarithms it's going to equal the sum from IAL 1 to n of the logarithm of this expression and the logarithm of this expression I can actually write down it is um the log of Lambda X to uh to the power x i is x i * log Lambda time e log of e to the minus Lambda so if I these products is now a sum and log of e to Theus Lambda is just minus Lambda okay minus Lambda divided by that's a minus when I logarithm it minus the log of this data point x i factorial okay so I've taken this this product and I've turned it into a sum of a bunch of things that add up now these this nasty product turns into a sum and remember we're optimizing over our parameter Lambda so this is just a number this is a constant this is data and XI is also just a number that's data so what we're really doing is optimizing over Lambda here okay and so what we do uh to maximize this likelihood function to maximize uh our log likelihood function L Theta what we do is we take the partial derivative of this with respect to Theta and set it equal to zero okay remember um if I want to optimize a function I'm looking for like a local Minima or a local Maxima that's a point where the first derivative is equal to zero it has slope zero at these Minima and Maxima points so to find the maximum I basically take the partial of this with respect to Lambda or Theta whatever you want to call this variable and set it equal to zero so to um maybe I'll actually say you know L of Lambda to maximize the log likelihood of Lambda I take um L Prime Lambda so I take the first derivative of this with respect to Lambda and that is going to equal what does that equal um that is going to equal the derivative of log is 1 over Lambda and the derivative of Lambda is just a constant so what I'm going to get is 1 over Lambda sum over all of my data minus this if I take the derivative of this with respect to Lambda it's just one and if I sum that up from I equal uh 1 to n then I get n here okay so let me just okay let me make sure that this is correct every single term in here has a log Lambda so I can pop that log Lambda out of the sum um and this you know also I can take or I can take its derivative and then pop it out of the sum so the derivative of this is one over Lambda the derivative of this is just minus one and because the sum is over index I I can pop those out and I just get the sum you know one over Lambda sum of x i plus um sum of -1 and that gives me 1 over Lambda Su overx I minus n if I do my entire sum and I take the derivative of this constant term with respect to Lambda it's just zero so this is really really easy this log is much easier to take the derivative and find the maximum of this and so now what I'm going to do is I'm going to set this equal to zero uh because that's you know I'm trying to find this maximum and so I essentially get uh 1 over Lambda sum overx I equal n and and I'm actually trying to solve for Lambda so what I'm going to get is Lambda I'm going to multiply both sides by Lambda divide both sides by n and I'm going going to get that this is 1/ n sum IAL 1 to n of all of my x i which equals xar my sample mean okay so this expression that we get out of the maximum likelihood estimation for um the parameter Lambda in a pan distribution ends up giving me Lambda this is really Lambda hat okay this is Lambda hat it's my uh my best optimal value for this log likelihood function it's equal to the sample mean this is the sample mean um and that is also the same estimate from the method of moments this is the same as the method uh of moments estimate and these won't always be the same but sometimes they're the same okay so let's just do a really really quick recap so we're doing the maximum likelihood estimation to find the best parameter value Lambda that best fits a set of measurement data these big X's that we actually measured we collected data and we're trying to find the Lambda that is best consistent most consistent with that data so what we do is we build our joint probability density function and we build this log likelihood function uh where we actually plug in The observed data and we get a function of How likely is that data given this parameter value and then we optimize that function to find the maximum the the parameter that maximizes this likelihood function and I think if I really wanted to be careful here I would point out that um this parameter we're optimizing over is the Lambda parameter in the Plus on distribution so here really anywhere you see a Theta you can replace it with Lambda and then and you know we're taking the partial of this log likelihood with respect to Lambda the derivative of L with respect to Lambda and we're setting that equal to zero because that's how we're going to find this maximum and when we do that when we go through all of that math we find that the best Lambda that fits the data is the sample mean which is the same estimate from the method of moments okay so this is first off you know a sanity check that we did our math right and we got a reasonable answer this is reasonable It won't always match but in this in case it does match and in principle this procedure should work for tons of different distributions and tons of different parameterizations of my distribution so this will work for normal distributed data I'll show that in the next video but this will work for lots and lots and lots of probability distributions all I need is a parameterization of my density function in terms of some parameters Theta which generalizes much better to machine learning applications where maybe you want to use a neural network to estimate this distribution and then these thetas are going to be the weights of your neural network so maximum likelihood estimation is a super powerful super General uh way of doing parameter estimation where you reframe this in terms of an optimization problem you're literally you have this likelihood or log likelihood function and you're maximizing over the AR argument of that log likelihood function good in machine learning sometimes you'll minimize the negative log likelihood they're exactly equivalent you can either maximize this or minimize it's negative it doesn't matter technically what I should have done is also computed the second derivative of this to show that the second derivative is negative that's how I would prove that I have a maximum not a minimum you can do that as kind of a homework exercise um good last thing I want to point out this is important um we essentially have um this notion of f ofx given some parameter okay and this is pretty useful so you know this is what we're using to build this likelihood function if I had some prior knowledge or some prior understanding of these parameters maybe I have some idea of what these parameters are uh maybe I'm flipping a coin and I'm trying to figure out what the probability of heads is my prior going in is that the coin is fair and that this is you know P equals .5 it's a fair coin so if I have some prior information about about my distribution Theta this starts to look a lot like the numerator in B formula if I took you know divided by F ofx this would exactly be um you know from Baye theorem and so this is probably very closely related or proportional to the beian inverse F of theta given X and this is actually a very very useful um probability density this is literally the prob ability of getting of of a parameter value being Theta given some data X so this might be easier to maximize over than this function and this is essentially how you take a maximum likelihood estimation problem and turn it into a basion maximum op op maximum op posterior estimation problem a map um maximum a posteriority uh estim estimation problem okay so we'll talk about that that'll be like a whole set of lectures I'll walk through um an example of a maximum likelihood estimator and then how you build in this prior information to get a beian version of this problem so that's all coming up soon thank you

---

## 13. Bootstrapping and Monte Carlo Sampling in Statistics
**Channel:** Steve Brunton | **Views:** 8K | **Date:** 3 months ago | **Duration:** 16:59 | **ID:** wsU7YLcPXmE
**Link:** https://youtube.com/watch?v=wsU7YLcPXmE

### Transcript:
welcome back okay we're talking about estimating parameters of probability distributions from data which is essentially a way of fitting those distributions to best fit that observed data super important topic in statistics but also relevant today in machine learning and specifically we're talking about how do you if you have a best estimate Theta hat for some uh underlying parameter of your distribution Theta how can you say something about the error in this estimate so this isn't going to perfectly match your actual true parameter it's going to have it's a random variable of its own because it's generated from uh from data which are considered random variables so you know what is the error in this estimate what is the distribution of this estimate um and this isn't only applicable to the method of moments this is applicable to maximum likelihood estimation uh Bean estimation the what we're going to talk about here this method of simulating to get an estimate of the error in our estimated parameters is ubiquitous in statistics and in machine learning sometimes for simple distributions like Pon and normal you can actually analytically get estimates for the distribution uh of this estimated parameter but in most cases either um the expressions are too nasty or they're not known or the distribution itself isn't entirely known this might be the parameters of a neural network so often times what we would do to estimate the error in our estimated parameters or to get some estimated distribution for these parameters is we would use Moni Carlos sampling or simulation and so I'm going to show you a couple of codes to do that today um for I think for the Plus on and for the normal distribution where we know the answer and you can also use this method when you don't know the distribution of this uh estimated parameter so just to recap the idea is pretty simple we take our estimated parameter Theta hat the estimated best fit parameter that gives us this kind of best fit PDF and what we do is we assume that that's the true distribution and we generate a bunch of simulated data so these are simulations of random variables from that distribution and we take that simulated data and we C calculate the estimated parameter from that simulation data and we can repeat this process over over and over hundreds or thousands of times typically where we take this fixed best fit parameter Theta hat and we generate kind of a a set of simulation data based on that estimated parameter and then we get kind of an ensemble of estimated parameters from those synthetic from the simulated data sets so if I did this process a thousand times if I ran a thousand of these Monte Carlo simulations for this fixed value Theta hat I would get a th000 kind of simulated estimates of theta hat and I could plot the histogram or the distribution of this random variable now clearly this is a little bit circular I'm using my estimate to build the distribution to get an estimate of the error in my estimate that's that's that's circular and that's a form of bootstrapping but it can be very very useful if done correctly uh and if you know what you're doing okay so we're going to show how this is done in simulation uh for couple of examples we're going to start off with that alpha particle uh radioactive decay example of a Pon process and if I have time I'll move on to estimating uh Sigma squared the variance of a normal distribution okay and at the end I'll come back to um this kind of cool notion of another type of bootstrapping that was introduced by Efron in the light the late 70s that's the Cornerstone of modern ensembling methods so uh maybe I'll just write a little note here that this is very very intimately tied to what's called Ensemble methods in statistics um and I'll come back to this at the end I hope good so let's uh fire up our Jupiter notebook here and start coding okay so we are going to look at this exact same data set we looked at before uh where the number of alpha particle emissions are are measured for a bunch of 10-second intervals so I think there's you know something like a thousand of these 10-second intervals um and in each of these 10-second intervals they measure how many alpha particles are admitted and they bin up um you know they count how many of those 10-second intervals were five particles emitted were six particles emitted or seven particles emitted and those are the bins of what we think is going to be a Plus on distribution so we know in the last lecture we actually anal uh built estimates for Theta hat for the pon random for the pon parameter Lambda here we're going to show how you can get you know another estimate just using this um bootstrap Monte Carlo simulation okay so just to remind you what the data looks like um this is um the actual data this is presumably Plus on distributed um we're pretty sure radioactive decay is Plus on distributed if we fit our best fit Lambda hat based on the sample mean of the data um this is how the best fit Pon data in blue matches the actual Pon data in uh in yellow so blue is the fit yellow is the data and now we're trying to get an estimate of the distribution of Lambda hat our best fit parameter using Monte Carlo sampling this is one of the cases where you can do that analytically you can just use the PDF and get a nice expression for Lambda hat and so that's actually nice because we know the answer and we're going to do it in simulation now and it's pretty easy okay so um this is the basic code you can of course follow along yourself um we have our sample mean from this data now we're going to do this bootstrapping procedure we're going to build a thousand simulations based on that bootstrapped PDF um using our best fit parameter um Theta hat in this case it's Lambda hat because theta equals Lambda for pon so what we're going to do is for each of these bootstrap experiments we are going to generate synthetic data synthetic data from this kind of bootstrapped PDF and from that synthetic data we're going to compute a synthetic histogram and a synthetic Lambda synthetic parameter estimate doing the same method of parameter estimation we did to get our estimate in the first place we're going to compute the sample mean of this synthetic data and now we're going to do this a thousand times so we're going to get a thousand sample means we're going to get a th000 Lambda hats and we can plot a distribution of all of those Lambda hats that's what we're going to do here and if I plot if I run this this is the boot the bootstrapped distribution whoops this is the bootstrapped distribution for the estimated Lambda parameter so what does that mean that means that I I had I I didn't have a thousand actual data sets I had one data set and from that one data set probably was pretty expensive to measure that from that one data set we built an estimate of our best fit parameter using the method of moments and now I am using simulations I'm bootstrapping to get this distribution of if that was the value of Lambda and I generated a bunch of simulations from that value this is the spread I would expect to see in the estimated Lambda values it's kind of a cool idea this tells me what I expect the variability of my lamba estimate to be based on my estimated Lambda that's what bootstrapping is okay and you can see that it kind of looks like a normal distribution which we're pretty sure it is because it's based on the sample mean which we know is a normally distributed random variable by the central limit theorem so you can go even farther um and you can do the exact same thing this is the exact same code from before but now what we're going to do is we are actually going to calculate the what we expect that distribution to be from the central limit theorem we know that that estimated parameter is based on the sample mean the sample mean is a normal distributed random variable by the central limit theorem so we're going to plot that bootstrapped estimate along with the central limit theorem estimate for Lambda and you can see that the estimate is actually really really good so the central limit theorem does a really good job of capturing that variability um that the bootstrap is showing and vice versa so in in this case we know that Theta hat is a normally distributed random variable by the central limit theorem because Lambda hat is just the sample mean and we know everything about the sample mean and you see that the bootstrap is doing a nice job of capturing that distribution and this idea works even when we don't know the answer for much much harder cases where we don't know the answer it still works so that's for that case I'm actually going to look at the normal distribution so this was the example for Pon for this um Alpha Particle example that data set um from 1966 let's do the same thing to get the distribution of our estimated Sigma squar variance parameter for a normal distribution this is harder this Sigma squared uh parameter is not a normally distributed random variable it does not uh follow from the central limit theorem because it's not just a sum of a bunch of independent random variables it's a more complicated expression for Sigma squar so let's go to that example here good okay so this is where we left off this was the the pon example so the next code we're going to do the exact same thing but to estimate the distribution of the estimated variance in a normal distribution same exact thing I have a data set I use the method of moments to get an estimate U hat and sigma hat squared using the method of moments and now I want to know how good are those estimates what are the distributions of mu hat and of Sigma hat squar I know the distribution of mu hat again is just it's a normal distributed variable because it's equal to the sample mean Central limit theorem applies Sigma squar Sigma hat squar is a lot nastier uh distribution it is related to the Squared Distribution so there is a distribution that will tell us something about Sigma squ but it's a lot Messier to derive that uh and to work with that so this bootstrap is going to be a nice way of estimating the variability and the distribution of this Sigma hat squared estimate so let's do that here we're going to you know estimate me and estimate variance from the data and then we're going to do a bootstrap sampling a mon Carlos sampling of a thousand simulations based on those kind of estimated values and we're going to get a spread of the sigma hat squares from those simulations so if I run this code we're going to get this as the synthetic bootstrapped distribution of the sample variance for a normal distributed uh uh data set okay and it looks kind of normal it doesn't you know I I could think that that's a normal distribution um I know for a fact we know that this is actually going to be following a Ki squar distribution so what I'm actually going to do in the next code is run this bootstrap to get this distribution and then use prior knowledge to try to fit a normal distribution and a kid Square distribution we're going to see which one fits better okay let's do this one more time good uh and the colors are a little bit nicer here so now what we're doing we're still trying to get an estimate for um Sigma hat squared which is a little bit nastier and we've done this using the bootstrap method so the gray histogram is the the histogram using the bootstrap method for this um this estimated variance the normal distribution in yellow is uh this is kind of what you would get from the central limit theorem and it's actually not a good approximation it's not terrible but it's not good it underpredicts it overpredicts the middle and it under predicts the taals um because the central limit theorem assumes kind of Independence but this variance has all of these kind of joint dependences and co-variances wrapped in because it's a nonlinear function it's a squared function um the kai squared fit in blue is much much much better so I haven't told you that the Ki squared is the you know the distribution that's related to this um this estimated variance but it is and here we can see that actually does a much better job fitting this bootstrap distribution if you want to say it a different way you could say that this bootstrap distribution actually does a really good job of fitting the true Ki Square distribution which is the analytic solution uh for this now this would work for really nasty systems where we have no idea what the true fits are where there is no Ki squar fit or no normal distribution fit to this estimated uh parameter Theta hat this will work in cases in machine learning cases where you have no idea uh what the answer is okay for this distribution so very very powerful idea um is this this bootstrap and now maybe the last thing I want to point out here is um there are lots of ways of doing bootstrapping and doing this kind of ensembling to get a bunch of um you know estimated variables to plot these distributions there is this method by um Efron in 1970 9 probably one of the most popular and uh wellestablished methods you don't actually have to do this Moni Carlo sampling if you have a big enough data set what you would do is you would take your original data so remember we had our original data X1 to xn we had a sample size of N and we use that to estimate uh Theta hat using method of moments or maximum likelihood estimate or whatever you're doing and the idea behind the Efron bootstrapping uh is to take and randomly sample with replacement from this data to create a new data set and if I randomly sample this with replacement over and over and over I get a bunch of data sets that have overlap but are different if I randomly sample you know 50 draws from this distribution with replacement I'll get a new data set of 50 random variables um you know and I can do that over and over and over I can do that a thousand times to get a thou an ensemble of data sets and from each of those data sets I can compute an estimate for Theta hat and similarly I can plot the distribution of those estimates that's the notion of ensembling from Efron that's a different notion than this kind of Moni Carlos sampling simulation uh based approach and there's a bunch of methods that do similar things we actually use that Efron version of bootstrapping when we estimate dynamical systems from a relatively small amount of data if I have a Time series of 50 data points I might randomly pull a subset of that data set and build a model like a DMD or a Cindy model and I might do that over and over and over again for different kind of uh bootstrapped data samples and I'll get a distribution of models of linear models or of nonlinear models and that can be super super useful for uncertainty quantification and also just to get better model estimation in the low data limit bootstrapping and ensembling is super super important and in this context it allows us to get an estimate for our um of the error or distribution of our parameter estimates even when we don't know the actual answer when we don't know the truth we can bootstrap uh and get an estimate of these distributions of these these random variables super cool stuff um okay good thank you

---

## 14. Error in the Method of Moments
**Channel:** Steve Brunton | **Views:** 6K | **Date:** 3 months ago | **Duration:** 18:41 | **ID:** 341Ecdkfb-s
**Link:** https://youtube.com/watch?v=341Ecdkfb-s

### Transcript:
welcome back so we've introduced the method of moments which is a way of estimating the parameters of a distribution from data so this is a method in statistics we've already seen uh for example for the pon distribution you can get an estimate of the parameter Lambda using data um and that Lambda hat is just the sample mean xar and similarly we have estimates for the normal distribution for the mean uh and variance and the rough rough aide here is you take your parameters Theta um of your your uh probability distribution and you write those parameters in terms of the moments of that probability density function so the first M moment mu1 is just the expectation value of x the second value the second moment mu2 is the expectation of X squar the third moment is the expectation of X cubed and so on and so forth and so at least in the simple distributions we often write the parameters in terms of these these moments of the probability distribution function then what we do is we approximate those moments from our actual measurement data so instead of the you know exact moment of this of the distribution we don't know the parameters of the distribution so we can't you know compute mu1 from the PDF but we can approximate it from data we can approximate mu1 hat as the sample mean of a bunch of collected data data and we can substitute that in as our best guess for the parameter this is our kind of best uh fit for Lambda and then the idea is that pan pan of Lambda hat is a pretty good approximation to the data this approximates the data okay this was last time so the question this time is can we estimate the error in our estimates of these parameter values so we have this estimate Lambda hat from data Maybe I had 50 data samples and I'm estimating Lambda hat can I get an estimate of that parameter the estimate of the error in that that estimate of the parameter uh from kind of probability Theory and the answer is sometimes yes and sometimes no sometimes yes you can and sometimes it's actually quite challenging so I'm going to write these down um I'll just kind of approximately write down sometimes yes and uh sometimes yes you can derive estimates of the error in our estimates sounds weird to say it you can get an estimate for the error in these parameter estimates directly from the probability distribution and probability arguments okay so uh sometimes yes we can derive can derive uh Expressions that are useful analytic expressions analytical analytic analytic Expressions um and we've already seen lots of examples of this for example um for a normal distribution okay so for a normal distribution for um let's say you know uh normal mu Sigma squar let's say x is a random variable that's distributed as normal with a mean mu and a variant Sigma squar we already know we know that um the best guess for Mew we know that mu hat is equal to the sample mean of my data that I collected the sample mean of my data okay um let maybe I'll just write down where xbar is literally the average of a bunch of data samples I equal 1 to n of a bunch of actual measurements of my data this is n Rand samples of my system or n pieces of data that are normally distributed from a normal distribution I average them to get xar the sample mean and that's the best guess uh or estimate of mu okay we know that but we also know from previous lectures that this random variable xar the sample mean is itself a random variable this is a normally distributed random variable normal and its mean is the true mean and its variance is the true variance Sigma 2/ n the size of my data sample so this gives me an estimate of the error in my estimate for for the for the mean mu hat literally my best guess for this parameter me is the sample mean xar and I know that xar is normally distributed around the ideal optimal value mu and more than that I know the spread of this normal distribution I know how much error there is how how how much plus or minus there is in this estimate it's based on the the variance of my distribution and the size of my data sample so I can make this thing a tighter estimate by collecting more data by increasing n okay so this is a case where yes we can derive an analytic expression we do know the answer to an estimate of the error in our parameter estimate some cases is it's much harder so as a second example uh maybe I'll do this in green as a second example um estimating Sigma hat squared this guy here Sigma I can say that my estimates I just use the sample uh moments I can put little estimators here um my estimate for Sigma squar for the variance of my distribution that is not normally distributed that's a weird distribution and it's harder to derive it's much harder to derive the analytic expression for how this is distributed we could do it and it turns out to be it's related to the kai squ um this is related uh to Kai squar the Ki squ distribution which is another probability density function but it's harder to derive an analytic expression for this error estimate um in the method of moments uh these these moment estimates okay so sometimes yes we can do it sometimes it's a lot harder and for other cases is there might just not be any close form expression at all there might not be a distribution with a name for how that parameter is distributed okay and so that's the second case so the first case was yes sometimes we can derive these expressions from you know the analytic PDFs sometimes we can't okay and in the in the cases where we cannot write down a nice well-defined expression for the error in our estimates we'll do essentially what's called Monty sampling or we'll run a bunch of simulations and bootstrap an estimate of the error okay so I'm going to write down how we do that and I'm actually going to do a whole code example in the next lecture uh for this the simulation based Monte Carlo bootstrap okay sometimes we resort to simulations uh sometimes we resort this is not a fun Resort we resort uh to simulations and these simulations are typically called Monte Carlo simulations okay uh Monte Carlo and these are good for estimating things that are really hard to calculate analytically if you have a fast computer you can just generate tons of simulations and build estimates of Statistics it's a super powerful really this is like what we do today um as Monte Carlo and um the the kind of really really rough idea here is you take your estimates you take your parameter estimates we're going to use Theta because we're going to say this generically so you um you take your estimate estimated parameter estimated uh Theta hat and that gives you an estimated an estimated um kind of best fit PDF um PDF probability density so we have the best fit probability density where we plug in our best fit parameters Theta hat and we got these Theta hats using the methods of moments we we got our Theta hats using this method and then what we do is we take this this probability density function and we run a bunch of simulations we pretend we generate a bunch of random data samples from this distribution assuming Theta hat is the true value so we generate a bunch of simulation data and we compute its estimated parameters Thea hat and we repeat repeat that process hundreds or even thousands of times generating um you know random data and Computing an estimate generating random data and Computing an estimate and in that way I get a whole bunch of I get a distribution for the estimated Theta hat parameters at least you know where this is the nominal Theta hat value so I'm just going to write this down so you run a bunch of simulations you run many simulations you run many Sims where essentially you generate data a bunch of XIs from this estimated PDF okay and then you take these XIs XIs um let's say that this is simulation uh let's say that this is simulation K okay you run K of these simulations maybe a thousand of these a thousand simulations where for each of them you generate 100 data points so a thousand simulations um and you generate 100 data points for each then what you do is you take that kith simulation and you get a new K estimate of theta hat so if I run a thousand simulations I'm going to get a thousand estimated Theta hats from this kind of simulated data now this is cheating this is called bootstrapping because I'm using my estimate to generate the data so this is clearly circular but it's a good way of getting a rough estimate of the distribution now I can plot the histogram of this Ensemble of theta hats this was you know maybe a thousand k equals 1 to a th of these and I might actually find a distribution uh of this Theta hat parameter and if it's you know a nice gausian distribution here it'll look gausian if it's a weird distribution it'll look weird whatever the distribution of my parameter estimates are this bootstrapping method will at least show you the shape and kind of the rough variance and you know behavior of that estimated parameter this is called um essentially a bootstrapped estimate this is bootstrapping um and bootstrapping here in this case means that we are estimating Theta hat from data we don't have the real Theta so we're estimating thing to hat from data and then we're pretending it's the true Theta and generating tons of simulated data to look at what the estimated data hat would look like assuming it's true so that circular reasoning where you use the data um to then generate more data to see how that fit behaves that's called bootstrapping and it's a super powerful method in statistics we use it all the time in machine learning we use it for the method of moments for maximum likelihood estimators for all kinds of things where you know we want to estimate the variance in some estimated parameter and there's no nice analytic expression for how that varies so we're going to have a code example of this in a minute in the next lecture what I want to do now is do another example where we can drive an analytic expression kind of method a for the pon distribution and that'll be the end of this lecture okay good so let's do that here so essentially um let's just do an example uh example of method a for pon Plus on Lambda so we already know Lambda hat is the sample mean and so the expected value of Lambda hat I want to look at essentially the distribution I want to know what the distribution of this variable is that basically means it's mean and its variance I want to like look at properties of this thing so I'm going to look at its expected value and its variance the expected value of Lambda hat is pretty easy it's just 1 / n * the sum I = 1 n of the expected value of um all of my x i I'm skipping steps here we know that Lambda hat is the sample mean the sample mean is 1/ n sum over all of the x's and if I took the expectation of that I can pop out the constant and the expectation of a sum is the sum of the expectations that's how I got this and each of these expectations of X is just uh is just Lambda so this is one n * n copies of Lambda this is just equal to Lambda so this is an unbiased estimate that's the first thing it tells us is that our um estimator Our Moment our method of moments estimator for Lambda Lambda hat is an unbiased estimation this is an unbiased estimator the next thing we want to do and remember this is what we did for this um for the mean of the normal distribution in our previous lectures we looked at its expectation it's variance and then we use the central limit theorem to find its distribution we can do the same basic ideas here okay so now let's compute the VAR the the um VAR of Lambda hat the variance similarly I'm going to use the formula and I'm going to kind of manipulate some things here so um it's the variance of Lambda hat which is xar which is 1 / n sum I = 1 to n x i and so the variance of this sum I can pop that constant out and it becomes 1 n^2 uh and these are all independent identically distributed variables so it's the sum of all of those variances of our x i IAL 1 to n and for a pan distribution just remind yourself the variance of that pan variable random variable is itself also Lambda so this is n copies of Lambda divided n^2 that equals Lambda Over N this is the variance of my estimate literally my estimate is has a distribution this is a random variable Lambda hat is a random variable because it's generated from random variables it's an estimate and it has a variance and if n gets bigger that variance gets smaller just like over here that's what we want we want it this thing to have a divided by n here and so we also know that you know Sigma Lambda hat is just the square root of this it's you know root Lambda Over N etc etc etc now just a subtle Point here if I'm trying to estimate this Sigma this variance I don't actually know the True Value this is just my estimate so because we don't actually know the True Value here we could plug in Lambda hat divided by n and that's what's called this kind of um we if Sigma means the actual honest to goodness true variance of this thing or standard deviation s is our best estimate based on the data we have this is a bootstrapped estimate again a bootstrap estimate of the standard deviation of Lambda hat notice that we took this value that we don't know and we replaced it with our best guess of that value Lambda hat that's a bootstrap estimate of the standard deviation of Lambda hat now this this circular logic you got to be really careful sometimes you can use this and you know and it works sometimes you can get yourself into trouble using bootstrapping so just be aware of when you are doing it and how you're doing it um and for the radioactive decay example that we're going to keep coming back to that um amarium 241 alpha particle decay in that example we get an S you know so for alpha decay example we have an S Lambda hat is equal to um this square root I think Lambda hat was about 8.36 our n was 127 there were 127 10sec intervals in that data set 127 and so if you take that square root the kind of bootstrap estimate of the standard deviation of Lambda hat is 0.083 so that basically tells me that I I expect about a plus or minus 1% kind of standard error in my estimate of that Lambda hat parameter using this bootstrapped estimate kind of a useful thing to be able to calculate it gives you some confidence in how good this parameter is okay so big picture we don't just want an estimate of these parameters we need to know how that estimate is distributed it itself Theta hat Theta hat is a random variable because you actually compute it using data and all of that data those are random variable so this is a random variable it has a distribution it has a mean and a standard deviation and so it's not only important to compute Theta hat the estimate we need to know what the properties of theta hat are is it an unbiased estimate does it have a spread how big is its variance how does that depend on N all of those questions for simple distributions we can usually say something about how those estimates uh are distributed what the error of those estimates are for more complicated distributions or for more complicated parameters like Sigma squar we might have to resort to Moni Carlo simulations to get a bootstrapped estimate and I'm going to show you how to do this in simulation in the next lecture thank you

---

## 15. Method of Moments to Fit Distributions from Data
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 3 months ago | **Duration:** 11:02 | **ID:** IZk0Iq2hI3c
**Link:** https://youtube.com/watch?v=IZk0Iq2hI3c

### Transcript:
welcome back so we're talking about parameter estimation and fitting distributions to data and now I'm going to introduce the method of moments this is maybe one of the simplest um kind of methods to understand it's really intuitive um and I think this is going to make a lot of sense to you I'm going to work this out for the pon distribution and for the normal distribution but I want to just State how the method of moments works first okay so given some data um and we're going to say that these are measurements of a system these are random variables from uh their IID their identical independent uh independent identically distributed data this is my data um and let's say that they come from the same distribution so that distribution is some probability density um of my variables given some parameters Theta we want to estimate the parameters so we're going to call this um estimate um Theta hat we want to estimate the parameters as some function of the data as some function um of of the data this is just the general estimation problem actually at this point this has nothing to do with the method of moments this is just how we State the problem of estimating parameters of a probability distribution the way that the method of moments works is that we're going to take these parameters and we're going to write them in terms of the moments of that probability density function so we assume that this PDF is known uh in the method of of moments we kind of assume the structure is known we assume the structure um of this relationship is known you don't strictly speaking have to but like you generally assume you're dealing with Pon or you're dealing with normal and you don't know what the Lambda or the MU and the sigma R and that's what you're trying to find so um what you do is essentially you write um you write Theta in terms of your moments in terms of the moments of the PDF not of your data these are actual moments of the moments um and we Define our generalized moments as Mu k equals the expected value uh of x to the^ K so mu1 is just the first moment the average mu2 is the second moment mu3 is the third moment and so on and so forth so we write Theta in terms of this and then what we do is we substitute in we calculate the sample moments and substitute those in okay then uh we replace the MU K with sample moments and these sample moments can be computed from the actual data like the sample mean the sample variance things like that the sample moments uh we replace mu K with the sample moments to get essentially Theta hat as a function of these mu K hat these um are kind of the sample moments these are the sample moments and this is my uh estimated parameters okay good um this is really really simple and I think if I show you a couple of examples you're totally going to understand how this works um so let's just do that right now okay so I'm going to start um I think with a Pon uh distribution so we're going to assume that f is Pon and we're going to try to learn Lambda then we're going to do the same thing for normally distributed data so uh the first example let's see if I can get all the way down here the first example is Pon so we're going to say X I is pan and I never know if I should capitalize P or not pan Lambda um and Lambda is the unknown parameter so this is kind of equal to some f of x given Theta and obviously Theta is Lambda my unknown um my unknown parameter okay good so the way we do this is we essentially write down Lambda in terms of these moments and we know from several lectures ago that uh Lambda this value is equal to the expectation value of x um this uh first moment mu1 okay the mean of the of the distribution and so what we're going to do is we're going to replace uh mu1 with the sample moment so we're going to replace um with uh lamb the Hat equals mu1 hat the sample moment which is 1 / n sum from IAL 1 to n of X of each of these XIs um which of course is equal to um you know X bar the the sample mean of my data so that's the best estimate here so Plus on of this Lambda hat is a fit from data okay really really really really simple okay we took our distribution we don't know Lambda but we can write Lambda in terms of the moments of the PDF okay so Lambda is equal to the mean uh value of the PDF the expectation value of x I don't know what that is but I do have data so I can compute the sample moment the first moment with my sample data which we call xar it's the sample mean and I can use that in this expression for Lambda so I plug in mu hat and I get a Lambda hat an estimate of my parameter that's best fit from data okay we're going to show later that as n goes to Infinity in the large n limit this is what's called consistent meaning that this estimate based on these moments will converge to the True Values of the parameters that's a really useful property in the large and limit moment based estimates converge to the true parameters that's really useful now how fast they converge that's a pretty important question we'll ask later let's do another example um example two normal distribution uh example two let's say that x uh I is a normal variable normal uh with mean mu and standard deviation sorry variant Sigma squar um and again this is equal to f of x given Theta where Theta is a vector um of mu comma Sigma squ okay so these are the unknown parameters I don't know mu I don't know Sigma squ but I have some data that looks normal so I'm going to try to fit mu and sigma squ from that data again we've already looked at this when we looked at survey sampling and the sample mean and you know the central limit theorem we we've already looked at this quite a lot and we're trying to estimate these using this method of moments so what we're going to do uh maybe I'll do this in green is we're going to write these two quantities in terms of my moments okay so we know that mu this parameter is equal to the expected value of x which is equal to mu1 okay and we know that Sigma squared is the expected value of uh my variable x s minus the expected value of x quantity squ this is kind of the definition of the Vari it's expectation of x^2 minus expectation of X quantity squar this is my second moment mu2 minus my first moment mu12 okay so I've written the parameters I care about in terms of my uh my moments of my distribution mu1 and mu2 and now I replace those with my sample moments okay so we're going to replace uh we're going to replace with sample moments so replace with uh mu1 hat and mu2 hat from data these are sample moments and I drew those terribly but that's mu1 hat and mu2 hat so mu hat equals mu1 hat and again mu1 hat is just the sample first moment um which is the the average of all of these divide you know 1/ n * the sum of all of these uh which we call xar the sample mean okay again we've seen this before if I want to fit a normal distribution and I don't know mu take all of my data average that data that's a pretty good estimate for Mu the the mean of the the the distribution same thing for Sigma hat squar Sigma hat squar what I'm going to do that's uh mu2 hat minus mu1 hat squared mu1 hat squ is just xar squ and mu2 hat is 1 / n sum from I = 1 to n of each of my random variables squared so this is mu2 ^ 2 minus xar quantity squared this is my meth method of moments estimate for Sigma hat squared so again just taking a step back what are we trying to do we're trying to fit we're trying to find the parameters of my distribution that best describe the data and the way we're doing it with the method of moments is we write those parameters in terms of the moments this assumes we know what the distribution is like we can compute the moments in terms of these uh these these values or we can invert that and compute these values these these parameters in terms of the fundamental moments mu1 and mu2 and then what we do is we replace those moments with the sample moments from our actual data we compute mu1 hat and mu2 hat hat from data and we plug those in for our expressions for our unknown parameters and that's how we identify these unknown parameters using the method of moments again just summary um this we will show in a later lecture that these are what are called consistent so in the large end limit um these estimates will converge to the true parameter values um but we do have questions about how fast they converge and what is their error for finite and we'll talk about that in a little bit okay thank you

---

## 16. Parameter Estimation and Fitting Distributions
**Channel:** Steve Brunton | **Views:** 12K | **Date:** 3 months ago | **Duration:** 24:13 | **ID:** 7XVA2JRzYoE
**Link:** https://youtube.com/watch?v=7XVA2JRzYoE

### Transcript:
welcome back today we're starting a new section in our statistics module parameter estimation and fitting distributions this is a really really central idea in data analysis and statistics and is especially relevant today because it's the basis of much of modern machine learning so the idea here is uh we're going to collect data from a system and we are going to try to find the best fit distribution probability distribution that describes that data and we might do this for example by taking a known distribution like Pon or exponential or normal and finding the parameters of that distribution that best fit our data okay so today this is the overview we're going to have a bunch of lectures on this topic uh I'm going to tell you kind of the classic way of doing this using probability models the modern way of doing this uh in machine learning uh and we'll have a code example um that I think is pretty useful that we'll use throughout this lecture series okay so let's get started so the classic approach I'll just write it here uh kind of the classic approach is you start with a a model of what you think your data is probably described by kind of you use first principles arguments and probability to build a model of your system so essentially uh we collect data so we collect uh data and we we use probability arguments and use kind of probability arguments probability arguments to guess or to posit a best model that we're going to fit to essentially posit um a distribution okay now for example um let's say we know that radioactive decay we think that this is governed by a Plus on process so in fact I'm actually going to write this down as the primary example we're going to look at so the example here um and I'm going to have a code in a minute is radioactive decay um radioactive decay where we will actually have data this is from a 1966 paper of amorium uh I believe um amorium Decay and we will have like data for how many atoms are you know decay in a certain interval of time and we're going to posit that this is a Pon random variable kind of how many um atoms decay in a certain fixed interval of time with some Lambda and so the idea here is we have a kind of physical or probabilistic argument that our data should be pan and there is an unknown parameter an unknown parameter that we are going to fit using observed data so that's what we mean by parameter estimation we're going to estimate this parameter from data and we're going to fit the distribution that best fits that data this is the classical approach and it's still super super useful today if you think you have data that's described by pan or exponential or gausian or gamma what any of these name distributions that gives you a very few parameters you have to estimate to fit that distribution it's really kind of easy uh straightforward approach to do that we're going to talk a lot about this even though what we ultimately want to do is fit distributions we don't know you know the distribution in machine learning so let's write that that down kind of the modern thing we would do uh and by modern of course I mean uh machine learning ml the modern approach is essentially we collect data and it probably doesn't fit a nice named distribution so we collect data same as before uh we collect data we always collect data because this is statistics this is kind of data analysis we collect data uh and it probably doesn't probably doesn't does not uh fit a nice named distribution so lots of examples of this um if you think about image classification or natural language processing um lots of examples in machine learning the data there is some underlying kind of joint probability density of the data but it doesn't fit you know plus on normal exponential things like that so some examples um are things like you know natural images um natural images um materials properties material uh properties there probably are PDFs that describe these data but they're probably not named distributions that we have learned you know out of our textbook uh turbulence is another good example um we know that there is a probability distribution for turbulence you can kind of measure and plot it but it's hard to write down a named distribution um for you know the distribution of velocities in turbulence uh natural language processing and so on and so forth many many many examples in this kind of second Paradigm where our data does have some underlying distribution but it's not like a nice um textbook that distribution and in all of these cases maybe I'll switch to yellow in all of these cases typically in the machine learning applications your data your kind of probability density function that you're trying to estimate this you know f ofx um it's going to be high dimensional um High dimensional so for um images usually you're dealing with megapixel or higher images so that's like a million dimensional Vector um representation of that data so it's high dimensional there's usually some messy joint probability between all of the pixels or all of the you know velocities or all of the different materials properties so kind of joint PDFs pretty complicated joint PDFs and sometimes if I think about these PDFs and kind of where the data lives the data lives in a fractal Subspace or manifold of this High dimensional measurement space so I'm going to put down some words like fractal um kind of nonlinear and so on and so forth these are complicated there's not going to be a nice distribution to describe these but we can still collect data and fit some distribution here we're going to fit the distribution um the parameters of a known distribution down here we might model the distribution as a neural network and in that case the parameters are the weights of the neural network or whatever other machine learning architecture you're using there will be some free weights that you optimize to best fit that data that's also a parameter estimation and distribution fitting problem classic and modern okay um good so these are some of the things we're going to talk about I want to show you a code example that I think is really useful um to get you thinking about what we are going to be doing then I'm going to write down the mathematical formulation of this problem and then that'll be the end of this lecture and there will be a lot of deep dives into these specific topics okay so let's do this code example and I got this code example from uh the textbook by rice which I think is a really good textbook um a lot of what I'm uh doing is kind of you know at least roughly follow some of the the the material in rice and so this is an example from Rice that was pulled from a 1966 paper where um the radioactive decay of um of a radioactive element is being um it's amarium 241 that's the radioactive element its Decay is being measured and trying to fit a Plus on distribution to that measured data because we think that radioactive decay is a plus on process okay so I'm going to tell you very briefly what the data is we're going to plot a histogram we're going to quickly quickly using quick and dirty techniques fit a Pon distribution and show that it's not a terrible idea and in following lectures we're going to justify our choices analyze the error do all kinds of you know proper statistics here I'm just getting kind of you know uh showing you a teaser of what we're going to see next so the data is actually super cool uh in this experiment they collected um about 10,000 guer clicks which means you know the Geer counter is counting the um every time an alpha particle is emitted from this amarium 241 this counter clicks and there are over 10,000 clicks and they measured the exact time between all of these clicks so they measured the time between about 10,000 10,220 uh alpha particle decays emissions and we know that the time between emissions is an exponential process and the number of clicks the number of emissions in a fixed interval should be a Plus on process so what they did was they bin this data into 10-second intervals so the number of alpha particle emissions in each of those 10-second intervals should follow a Pon process and then what they did all of those 10-second intervals they counted how many alpha particles were emitted in that 10-second interval and in the next 10 second and the next and the next and the next and the next and so the data here in uh this line observed counts what this does is it it says Okay um the first bin maybe I'll plot the data and we'll actually talk about it this way it's a little easier um so the first bin of data the zero bin that is how many times in a 10-second interval no alpha particle were measured and the second bin this this x-axis equals 1 here that is the number of times in a 10-second interval exactly one alpha particle was measured the next bin is how many times in a 10-second interval two alpha particles were measured and so on and so forth and you can see up here you know like in five bin five that says that there were about 100 110 intervals where five alpha particles were measured and so that's what this Vector of data is here this is the raw data from this 1966 paper and here we're plotting the data as kind of a histogram or a distribution okay and if you look at it it looks like it could be a Pon maybe it could be normal it's a little hard to tell we know that Pon starts to approach normal for large and but anyway this is what the raw data looks like and we're kind of trying to find the best Pon distribution that best fits this data okay so that's a very reasonable thing to do what is the Lambda based on this data that best fits that data so the simplest thing to do we know that Lambda is the um kind of expectation value of x it's the expected value of x the the average the expected average of of X and so over your sample data over all of this data we could calculate the sample mean and use that as a best guess for Lambda let's call that in fact we're going to call that uh Lambda hat equals the sample mean xbar that's a pretty good guess for the parameter um of this pan distribution and again I'm going super quick and dirty here just the the basic idea we're going to justify this choice later um but here what we're going to do is actually calculate the sample mean okay based on the data and then we're going to fit a Plus on distribution using that Lambda value that sample mean and then we're going to plot that fit with the actual data so let's do that now and now you can see the data and the Best Fit Plus on distribution so the Best Fit Plus on distribution is in cyan it does a really really good job of capturing this data it's actually super super accurate okay so this at least gives us a rough idea that we can take ideas that we learned in probability Theory like you know how the parameter Lambda relates to the expectation value or the average value expected for x and we can use that to get a best fit of this parameter based on our observed data okay and this actually does turn out to be a really good estimate for this Lambda parameter um we'll we'll derive that later but this just shows that it's reasonable to do that okay um there's other questions we might ask okay so that's um it for the code example we're going to come back to this example over and over and over again we're going to um you know do fitting and hypothesis testing on that example so we're going to we're going to see more of that later other questions we might ask the first question was you know what's the best fit parameter that best fits this data another question would be is Pon even reasonable is Pon uh a good fit um and so we can actually do a hypothesis test we can write down a hypothesis that the distribution is Plus on with this Lambda or is not Plus on with this Lambda and we can do hypoth is testing um and actually get confidence intervals and rejection regions and all of that as well so there's more um other questions we might ask um what is the error in my estimate what is the error in estimate Lambda hat um how large of a sample do I need to make that error smaller um is there a bias all of the things we asked in the survey sampling um and sample statistics we can ask here too so we can do hyp hypothesis testing we can build models for the error in these estimates and we can find um best parameter values good and in either case either for classical parameter estimation and data fitting or modern machine learning um distribution fitting in either case there is a mathematical way of writing this problem down that we're going to find very useful and all of the examples of methods to to answer these questions are going to be based on this mathematical formulation going to tell you right now okay so uh in either case so yeah let's just write this down in either case kind of the classical or the machine learning case in either case we parameterize some distribution we parameterize parameterize some distribution now that distribution might be a known distribution like pan or it might be an unknown distribution like a neural net the weights of a neural net might be the parameterization of our distribution so we're going to say that we have this f of x given Theta so um X is our our you know variables kind of the the the data um variables and Theta are are our parameters parameters okay and this is our kind of variables our random variables and this f of x given Theta is literally the probability that our random variable equals this value x given the parameters Theta so for example in this Pon example you know you could literally take the pon PDF as a function of Lambda and that would be this function x with um you know uh with respect given Theta so parameters so in uh for pan for pan Theta is our Lambda value for normal a normal distribution Theta would equal a vector of mu and let's say variance okay so whatever your distribution is you can parameterize it we're just going to call those parameters Theta and we're trying to find the Theta that best fit our observed measurement data and in a neural network in the machine learning version Theta are the weights of your neural network or the weights of your machine learning model that you're trying to tune or fit or optimize to best fit the data The observed data okay pretty easy so um the mathematical statement then is that we are trying to find Theta we want to uh parameterize some distribution and find uh Theta to maximize this probability to maximize the probability and in some sense to be most consistent with the observed data okay so if we literally find Theta that maximizes this probability of X of our data equaling x given those parameters that would be a maximum likelihood estimate so this is the method of Maximum uh likelihood estimation this is a very common um you'll hear this all the time ml maximum likelihood estimates this is a super super super popular way of finding a best parameter for a probability distribution Based on data okay so that it's really intuitively simple there's some PDF um maybe I'll even just draw a little picture here so I could have some PDF and let's say it's um you know a Pon distribution so I have whatever the the PDF of my Pon distribution is and I can vary that parameter Lambda so there's a whole family of distributions varying this Theta or this Lambda parameter and I can vary of those uh this Lambda to get this whole family of Plus on distributions and I have some data I have some actual measurement data and maybe my data you know looks essentially like this so what I'm essentially trying to do in kind of in in your cartoon in your head what we're trying to do is we're trying to to find the Lambda that makes the distribution F ofx given Lambda best match the observed data there is a Lambda that will be most closely matched um to that data and that's what the maximum likelihood estimator does it finds that best fit parameter uh Theta in the case of pan our parameter is theta equals Lambda okay so here Theta just is a generic parameter variable and then in specific distributions we'll use specific variables like Lambda or mu or Sigma Square good so that's the idea we're trying to find Theta that maximizes the probability of our data fitting that distribution that's that's how we say this mathematically and this should seem very very closely related to Bean optimization to beian statistics because it is so there is this kind of dual problem we have we know the probability density at least in the classic case we have F ofx given Theta and we're trying to find Theta but what we actually want we want the probability of theta given X this is like the beian inverse this is this is literally the basian inverse um the ban or statistical beian inverse if we knew the probability of a parameter given the data we could just um plug in the data and read off that parameter like that would give us the maximum you know likelihood estimate parameter but often times we just have this kind of uh forward model and we have to write it down as an optimization problem to find the best Theta I'll show you how to do this all in the next few lectures we'll show we'll derive the mle formulation we'll do it on normal and Pon we'll talk about the connection to Bay and how to incorporate priors into maximum likelihood estimation this is all coming up um there is kind of an alternative perspective that's also pretty useful so maybe I'll just write down you know this is a big one um maximum likelihood estimators is a big thing we're going to talk about another big thing we're going to talk about um another way of estimating these parameters given this distribution is called the method of moments um so in the method of moments of moments what we're going to do is we could express uh Theta in terms of moments of my probability distribution of moments um like mu K you know the mean the variance and the higher moments um you know let's say mu1 equals the expected value of x mu2 equals the expected value of x² and so on and so forth we could write our parameters in terms of these these moments for example we know that Lambda is equal to the first moment and we know in the normal distribution mu is equal to the first moment and sigma squared is related to the first two moments so we can write down these thetas in terms of these parameters and then we essentially use data we use our random variable data you know XI our actual sample data to estimate uh to estimate these M's let's call them mu hats and therefore we can estimate our parameters we'll call it Theta hat this is a really really popular easy method when you know your distribution when you can write down these parameters in terms of the moments of your PDF then you can then estimate those moments with data and then get an estimate of your parameters from that estimated that's what we did in this pan example we know that Lambda is related to the expectation the first moment of X so we computed the sample mean which is the data approximation to the first moment of x and we plug that in to get Lambda hat we we just did the method of moments in our code example so actually I'll probably show you this one first because it's easier to explain so this will be the first one and this will be the second thing I show you um and then a couple of other things that are important um distribution fitting is very closely related to hypothesis testing this question here is a pan even a good fit I can find the best Lambda that fits my data but what if my data you know isn't Plus on I can find a Lambda but it's still not a good fit is my D is my distribution a good fit this is related to hypothesis testing um hypothesis testing so we will uh do some examples of hypothesis testing in this parameter fitting uh and and distribution fitting um do the distributions match we'll use something called the kai squar test uh we'll talk about the k l Divergence um and so on and so forth there's a bunch of different methods to test if a distribution is actually matching your data okay so this is all coming up soon big picture is that we have data and we want to find the best kind of probabilistic distribution that fits that data um this is a statistics problem because this is based on actual data X you know these these these kind of random measurements of my system uh and we are going to do the method of moments maximum likelihood estimation we're going to talk about the bean connection and hypothesis testing and a lot of it we're going to do on this radioactive decay example that I showed you a minute ago that's all coming up this is one of my favorite sections super interesting stuff um stay tuned for more thank you

---

## 17. Could Tobacco be Good for you?  Two Sided Rejection Regions in Hypothesis Testing
**Channel:** Steve Brunton | **Views:** 5K | **Date:** 4 months ago | **Duration:** 12:20 | **ID:** znnim8MTl0c
**Link:** https://youtube.com/watch?v=znnim8MTl0c

### Transcript:
welcome back so we're talking about hypothesis testing and we're doing some examples we're just working through some examples of how you set up a hypothesis and test it Based on data and I have a really nice example um of a two-sided rejection region test that I learned you know 20 years ago when I was taking Dr John Quintanilla's class at University of North Texas in Denton and so I'm just going to walk you through this really cool example of a two-sided rejection region uh hypothesis test we've done a lot of examples of a one-sided region rejection region let's do a two-sided region okay I'm going to read the problem statement and then we're going to solve it it's a pretty simple um version It's a simple hypothesis the problem statement goes as follows last season in the NBA the average points per game were an average value of 94.8 one points per game with a standard deviation of 7.16 points okay this is just data from the season to increase scoring and improve kind of you know viewer uh viewer numbers the NBA enacted new rules to try to increase scoring but critics of these rules said that it would actually have the opposite effect and decrease scoring so in this case we think that there's a modification there's new rules and they might increase or decrease the average the mean scoring so in this case um we need a two-sided rejection region because there's a chance that we have increased or decreased the mean uh significantly okay so that's going to be a two-sided test and so the data from last season uh is here and then this season in the first 432 games uh the average points per game is 9469 okay um so you look at these and they actually look really really close 94.8 94.6 n too hard to tell if these are the same distribution different distribution same mean different mean we're going to use a two-sided uh hypothesis test to get some idea of whether or not it's statistically significant that something has actually changed good okay so um pretty simple let's write down the null hypothesis so generally we always write down the null hypothesis H null is that the new mean I'm just going to call it um do I want to call it mu2 or do I want to call it um let's say me um Tilda that's the mean from this season okay that the new mean is equal to the old mean uh which is 94.8 1 and the alternative hypothesis is that the new mean has changed it's not equal to the old mean it might be higher or lower okay the average scoring uh may be higher or lower but it's not equal to the old mean it's higher or lower okay so that's it um and notice that this is not this is in fact not the alternative hypothesis is not that mu Tilda is greater than 94.8 one that would be the null hypothesis if you're not trying to also um if you're not listening to the critics the critics say that it might decrease the score in if everybody thinks it's going to increase the scoring you might only test that mu is greater than 9481 but because some people think it's going to decrease and they have a plausible explanation for why it would decrease we're actually testing this blue hypothesis uh up here okay good so the null hypothesis is that the mean didn't change that's usually the null hypothesis is that nothing changed that there was no effect of your modification so now we build our test statistic this is pretty simple uh maybe I will do this in green so our test statistic is going to be Z and that equals our sample mean this guy uh X bar is our sample mean 432 is n that's the size of our sample uh 7.16 is Sigma the standard deviation of the underlying null hypothesis distribution and this is Mu and so our test statistic we usually take our sample mean minus our putative our nominal average that we're trying to refute that's the null hypothesis divided by the standard deviation over root n that's called the standard error is Sigma over root n because if n is really really large um it kind of squashes the variance of xbar and so we should have more confidence with a bigger n this should be like this should we divide by by by root n this is our sample statistic again this should be approximately normally distributed because xar we assume each of these games is independent IID that's a bad assumption but like let's just assume it's true then this xbar would be a gausian normally distributed variable with a center around some mean value and some spread okay so we know from the central limit theorem that this is a normally distributed variable so if I subtract the mean and divide by the standard error this is a unit normal um variable Z is from nominally a unit standard normal distribution and I can plug in the values now so this is equal uh to 94.6 n uh let's actually do this 9469 - 94. 81 is minus .12 divided Sigma is 7.16 * < TK 432 and you can plug these into your calculator this is going to give you a number that is approximately Min -36 standard errors we always say standard errors because that kind of tells us how far away a standard deviation in this unit normal would be plus or minus one and 36 standard errors is actually really in the bulk of the distribution it's really squarely in the middle of this distributions so I'm actually going to draw you know 36 is somewhere like right here very much squarely in the middle of this distribution of the kind of this is where the null hypothesis lives um in the middle here is in the null hypothesis um and these are our rejection region for a two-sided test if I want a P value of 0.05 if I want a 95% confidence uh in my alternative hypothesis for a two-sided test the rejection region are actually smaller each of them is only um 2. 5% um of the distribution so I'm trying to find the kind of standard errors where I get 2.5% on either side those add up to 5% and that's the rejection region so I would have to have a a z value of bigger than or less than uh 1.96 so greater than 1.96 or less than negative 1.96 to reject the null hypothesis I'm not even close I'm solidly in the middle of this distribution I fail to reject the null hypothesis so we fail to reject uh and so essentially what that means is that we really can't say we we don't think that this modification increased or decreased the scoring we think it had no effect at all these rules didn't change scoring um that's an example of how you would do a two-sided rejection region test um your rejection region gets a little smaller because there's two rejection regions so for 5% um you need each of them to have 2.5% which pushes them a little farther a little more you know 1.96 standard errors instead of 1.645 for a one-sided test and this number here this zv value of 36 of negative .36 shoot technically it's actually over here it's negative. 36 not positive 36 but again it's solidly in the middle of the distribution predicted by the null hypothesis so this is actually you know looks like this is generated from the original distribution nothing changed okay um that's just an example um of a two-sided test there's other examples I think I told you about the cigarette company example where maybe you're trying to test and see if cigarettes are um healthy so there's this this this cigarette case um where maybe you're trying to test you know if uh you have negative effects because of because of cigarettes you know people think that they have negative effects on your lungs and so you might have decided to create a one-sided test that you're trying to test you know are cigarettes harmful did you get a negative effect in uh in your population in your in your you know smoking group that would be a very reasonable thing to to do and that would set up a a confidence interval and a rejection region you'd have to be negative 1.645 standard errors you know to um to assert that that's true that cigarettes are bad for your health but very clever thing you could do if you are big tobacco is You could argue you could you could cast doubt in the following way you could say well cigarettes May indeed harm the population that smokes maybe cigarettes have unknown positive health benefits maybe they actually clean your lungs and have m iCal properties and so in the case that cigarettes could not only hurt your population Health but also might improve it that becomes a two-sided rejection region test and that becomes a more stringent test you need a you need a more rare uh zv value you need more standard errors you need to be farther from the mean of the distribution to reject that null hypothesis um that that cigarettes do nothing and so here you need to be at 1.9 6 and - 1.96 whereas here you need to be atus 1.645 and so if you have 30 people in your control group and and smoking group this change here might be enough to um to cause the null hypothesis to hold up that cigarettes don't do anything at all even if over here you would reject the null hypothesis and say that cigarettes actually harm you very clever thing that you can do with Statistics and again I'm telling you this so that you don't get into trouble doing this yourself and so that you know what to watch out for um think about what people's motivations are and how they're formulating uh their statistics there's another cool example from Rice's textbook on ESP extra sensory perception where you could do a test this is actually something you can do with your friends um you know get a deck of cards and you know randomly draw a card don't show your friend but let them guess what the suit is then you know reshuffle draw another one had them guess the suit reshuffle draw another one guess the suit you can do this 50 times 100 times whatever and based on the probability that they would do this at random you can compute how many times they got the suit correct and you can use that to test the hypothesis of whether or not your friend does or does not have uh kind of psychic abilities so that might be a fun homework problem or way of testing this yourself and I'm going to claim that that's a two-sided test because they might be more lucky than average or less lucky than average okay um good two-sided tests are important it's important to know the difference and when to apply them and again it always boils down to this test statistic at least when we're comparing means of distributions um and how many standard errors away you are okay thank you

---

## 18. Hypothesis Testing: Type I and Type II Errors
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 4 months ago | **Duration:** 10:06 | **ID:** 129NuU3A7rM
**Link:** https://youtube.com/watch?v=129NuU3A7rM

### Transcript:
welcome back we're talking about hypothesis testing which is a rigorous way of making statistical statements about whether or not some hypothesis is supported by your data okay we have talked about a few different examples so for example I could have some new wonder drug that you know cures cancer or you know is a weight loss uh supplement or something like that in which case I would have a hypothesis that with this drug there would be some measurable effect in a group that has been treated versus a group that has not been treated with that drug so for example I might expect that the average quantity the average um treatment success rate goes up when you take this medicine okay that would be a hypothesis that the the mean of some you know some random variable in this treatment group increases compared to the mean of that random variable in this group and we know that hypothesis testing essentially works in the following way you make a hypothesis and that's called the alternative hypothesis and you set up a straw man or a dummy hypothesis called the null hypothesis the null hypothesis is the hypothesis that nothing has changed and so then what you do is you test that null hypothesis you assume the null hypothesis you define this test statistic Z based on the the data from the treatment group and the control group so you take for example the um observed mean value from your treatment group minus the the the previous average or the u mean value from your control group divided by the standard error and this variable is going to be distributed as a standard unit normal random variable so if Z is above a certain value that means it's that many standard errors away from this kind of expected mean and that gives you some measure of How likely or unlikely it is to observe this data assuming the null hypothesis that it came from this distribution that there was no distributional change and so we've looked at how you can set up a rejection region if Z is bigger than a certain value then that means that you can reject the null hypothesis with some confidence with some P value in the case of a P value .05 that roughly means we're 95% sure that if Z is bigger than than is in this rejection region we can be kind of 90 5% sure that this distribution is different than this distribution we reject the null hypothesis and have a statistically significant uh result okay now I want to be really really careful about how I say this um we haven't proven that this distribution is different than this distribution or that this mean is different than this mean we have just supported that hypothesis with the data it's a statistically significant possibility that this distribution is different than this distribution and technically what we say if we have a p equals 05 rejection criteria meaning we we want kind of 95% confidence to say something you know about this alternative hypothesis what that means is what that essentially means is that if we pick P equals 05 and we go through this procedure and we did this you know a bunch a bunch a bunch of times okay like let's say you you had a bunch of these experiments in parallel you run you know a hundred of these experiments in different cities or something what this means is that 95% of the time if you reject the null hypothesis that rejection that the alternative hypothesis would actually be true and 5% of the time you would reject the null hypothesis but it would actually be true you would you would incorrectly reject the null hypothesis that's what we actually mean you have to these things very precisely statistically this P equals 05 this P value of 05 means that 5% of the time about you will incorrectly reject the null hypothesis if your Z lands in that rejection criteria that that's another way of saying it you could say it in terms of confidence intervals or you know how often I falsely reject the null hypothesis so that's what I want to show you here is this very like kind of useful diagram where what we have is the actual truth up here so either h really is true or H knot is actually false we don't know ahead of time like we don't actually know that's why we're doing these tests but you know in some cases like imagine that there was a truth and you ran all of these simulations what would happen and then there's the decision based on the collected data and this Z value you may choose to reject the null hypothesis if you land in this rejection region and you may fail to reject the null hypothesis if you land to the left of this rejection region okay and so every quadrant in this chart has a really interesting important meaning that I'm going to write down right now okay so if H knot is actually false if the distribution really did change my null hypothesis is false and I rejected the null hypothesis this is a correct outcome this is the correct outcome that means the test worked the way it was supposed to if H knot is true if the null hypothesis is true and there was not a change in distribution if I fail to reject the null hypothesis that's also a correct outcome that was a correct decision and these quadrants are where it gets interesting these are where you get different types of error type one error and type two error so type one error um type one error is where H knot is actually true there actually wasn't a change in the distribution but your data you got really unlucky and those statistical fluctuations were well outside of you know what you would expect and but but the distribution in reality didn't actually change you just got unlucky with your draw and you falsely rejected the null hypothesis you rejected the null hypothesis even though it was actually true this is called a type 1 error and this happens probability p% of the time this happens with probability p with probability P so in the case of a 0.05 significance value this would be 5% of the time okay this would happen 5% of the time and that's what we mean this is the precise way of saying it is that a P value of 0.05 means that 5% of the time if you reject the null hypothesis you will have done that incorrectly because the null hypothesis would actually be true okay the other kind of error this is called a type two error uh type two error It's On The Rise um type two error is essentially where you where where the null hypothesis is in fact false where there is a distributional change but you again got unlucky in your draw and it just happened to look a lot like your previous distribution where you failed to reject the null hypothesis even though the null hypothesis was false so a failure to reject hot when hot is false is also an error and this happens with probability uh probability beta sometimes this is called probability Alpha sometimes this is probability beta doesn't matter type one is definitely related to this P value and type two is related to a different thing called called beta so this P value is called the significance level so p is the significance level um and we've already seen this that if p is 05 we call that statistically significant if p is 0.01 we say it's strongly statistically significant it's much less likely to have a type 1 error beta is called the power of the test or actually one minus beta is the power of the test it's called that that's just how it's defined the power of the test and so you want beta to be as small as possible you want to you want to have a lot less of these um these cases here and these cases here you want p and beta to be small and this is not something I'm going to get into this is like a whole you know chapter in most statistics books generally speaking what you do is you design an experiment with a P value you set this P value this value here and then you actually design your test um and your hypothesis testing so that you minimize this B this beta so that you maximize the power of the test there are lots of ways of setting up this hypothesis testing and how you actually do the statistics and different ones will give you different Power of the test um so this is kind of a false positive for your alternative hypothesis these ones are false positives you you reject the null hypothesis incorrectly so you falsely say that your alternative hypothesis is true these are kind of the opposite um where you um you where the alternative hypothesis is actually true and you say that it's not true so kind of false negatives false positives false negatives very very important and this uh does a couple of things it allows us to say much more precisely what we mean by A P value uh in terms of this kind of false uh positive uh probability and it also points out that there is a different type of error this type two error that also can be controlled through different um hypothesis testing techniques and different statistics and things like that I'm not really going to talk about beta here but I just wanted you to be aware that this is a thing that uh matters in statistics and different hypothesis testing will give you different kind of powers of the test um okay good thank you

---

## 19. Hypothesis Testing Example: Salk Vaccine Trial
**Channel:** Steve Brunton | **Views:** 6K | **Date:** 4 months ago | **Duration:** 16:06 | **ID:** V3aYG8mLmkI
**Link:** https://youtube.com/watch?v=V3aYG8mLmkI

### Transcript:
welcome back okay I want to give a couple of examples of hypothesis testing that I think are really intuitive and helped me understand how this works uh when I was learning so these examples are from Dr Q at un um and I think these are really really great examples so the first one uh I'm going to do is this sulk vaccine trial for uh the polio vaccine so polio was kind of a devastating um disease uh in the like 1950s and around 1954 55 this new polio vaccine was developed and tested in a mass clinical trial okay so 400,000 children in this trial I'm kind of you know massaging a tiny tiny bit to make this a little easier but you know let's assume that there is about 400,000 children in the trial uh 200,000 were given a shot with the actual vaccine and 200,000 given a shot with a placebo you had to give them a shot that had a placebo otherwise they might know that they weren't getting the treatment and that might change their health outcome so this was a double blind randomized study the doctors didn't know who was getting the vaccine or the placebo the children didn't know who are getting the vaccine or the placebo and that's really important in these big trials to make it double blind and randomized okay and out of the vaccine group so um the vaccine group is essentially the treatment group we're going to label this treatment uh 57 of those 200,000 did in fact contract polio they ended up getting polio and of the placebo group that did not get the treatment this is the control group essentially uh 142 polio cases were reported so just by I it looks like you know there's almost three times as much polio in the control group as the treatment group so that hints that they're probably was some effect of this vaccine now the statistical question that we might want to ask is was this vaccine effective that's the public policy version of this question and I guess the more mathematical way of saying this would be did the vaccine decrease the rate of polio in the vaccinated uh treatment group that would be a more precise mathematical way to say it okay so we're going to show this is a really cool example there's actually lots of ways of setting up a hypothesis to test this and that's kind of interesting too we're going to set up one way um that I learned from Dr Q Dr John Quint Nilla and it's a clever way I like this this way of doing it okay so um let's write down the null hypothesis that's where we always start so the null hypothesis is that the vaccine was not effective so um let's say null is that the vaccine uh was not effective and we should already be thinking in our heads which of these tests are we going to be doing um we're going to do some we're going to create some test statistic Z that we want to be kind of a gausian unit normal variable and probably I'm going to use a onesided rejection test because we have a feeling that the vaccine should only help it probably won't hurt it probably won't cause more kids to get polio that's very that doesn't make sense from how vaccines how That vaccine works and so we would mostly be testing did the rate go down we're not testing if the rate went up okay now you couldn't switch tests after seeing the results that would be cheating you have to decide which test you're doing before you get your results but it's I think pretty reasonable to do a one-sided test on a vaccine that you think probably is only going to make things better and not worse okay null hypothesis is that the vaccine was not effective this is H not the null hypothesis and so now what we're going to do is assuming that null hypothesis we're going to build a test statistic so assuming the null hypothesis then there are a total there are a total of 199 of 199 polio cases out of the total uh 400,000 children in the trial and polio is a particularly nasty disease because it actually has an extremely low uh symptom rate you can have polio and only I think I'm getting the numbers a little wrong about one in every 200 actually shows symptoms of that disease so it can be transmitted and spread and the observability rate is very low so it's very hard to detect and it's hard to eradicate um and we'll talk more about that later okay but here the total number of polio cases um in the trial is 199 and under the null hypothesis these two populations are the same statistical distribution they're the same distribution they're the same as this distribution so each of these is kind of equally likely to get a share of this 199 polio cases if you kind of guessed you would say that about half of them would go this treatment group and about half of these cases would be in the placebo group clearly that's not what was observed but that's the null hypothesis that we're testing and so the way you write this down mathematically is that since it was a randomized test since these groups were picked at random uh and we're assuming this null hypothesis that these two populations are completely equal likelihood of Contracting polio then what we say that uh the number of children in the treatment group with polio so the number of children in the treatment group uh group with polio is a random variable X we're going to call this a random variable it's like given these assumptions and this mull hypothesis and the observation that we had 199 uh cases then the number of children in the treatment group with polio is going to be this random variable x and x is going to be a random distributed a random distribution it's going to be binomial with 199 and a probability of 1/2 now let's talk through this half of the population went into the treatment group and half of the population went into the control group so it stands to reason that if these are equal groups then half of the 199 polio cases would go to the treatment group and half of the 199 polio cases would go to the sibo or control group and that means that out of these kind of 199 coin flips for each of these polio cases you flip a coin and they would either go into the treatment group or the control group I mean these are human lives we're not flipping coins but you know this is the analogy of a binomial so 199 of these that are getting kind of randomly sorted into these two equal groups they're equal under the null hypothesis okay so half of them uh probably would go into each group so this is the distribution of x and so now what we need to calculate is how unlikely if x is binomial distributed would it be to actually only get 57 cases the expected value is 199 divid 2 just about 100 99 and a half of the kids if that's the expected value for a sample this large How likely would it be to only get 57 polio cases that's how we test the null hypothesis so we build a test statistic um essentially um so the null hypothesis is essentially that uh X is binomial 1 1992 that's another way of saying that's another way of writing our null hypothesis is our null hypothesis would be that the number of uh polio cases in the treatment group should be binomial with 199 comma 1 12 and so we set up our test statistic we set up our test statistic Z equals uh and the way you do this test statistic for binomial it's basically the same as for for this large of a n this binomial converges to a normal distribution so you could just replace this with normal uh with whatever the standard deviation and mean are that's totally fine and I encourage you to do that and show that it's the same but we essentially are going to build our test statistic and say that it's 57 uh minus 199 technically because it's binomial we do 199 and a half if you did normal you would get rid of that half it doesn't really matter it's not going to change the answer um divided by the um the number of polio cases times a half square root okay so this is uh 199 over H 199 uh < TK 199 * 12 you can convince yourself that this is the the sample standard error for 199 polio cases uh with probability of going into each of these groups of 1/2 this is essentially the standard error for this distribution um go back and remind yourself what's the variance what's the sample size you'll you'll get this okay um I'm guessing it's like n /2 and then you divide by root n something like that okay and so this is a number this is about - 5.95 okay about 5.95 so usually we write our our one-sided rejection region kind of in this to the right here in this case because I have a negative number because my my my mean got decreased we're actually Computing you know a left one-sided rejection region by symmetry it doesn't matter at all it's the same idea z my observed amount of polio cases under the null hypothesis is about six standard errors away from what you would expect what you would expect is 99 and a half polio cases that's what you would expect from uh if these if the null hypothesis is true if the vaccine was not effective then you would expect about 99 and a half or you know about half of them in this uh treatment group and The observed 57 polio cases is six standard errors away from the expected six standard errors if you look it up in your table if you look up the cumulative distribution function of 5.95 then the P value of this this has a P value of about 1 * 10- 9 so there's about a one in a billion chance that this was just random and the vaccine was actually not effective okay so this is extremely strong strong strong significant result that we can reject the null hypothesis so we reject H knot and that implies that the vaccine is effective okay very very cool this is um a great way of you know kind of checking how to do hypothesis testing and notice that we didn't use this n or these ends at all these are not the size of our sample in this uh test statistic the size of our sample is the number of polio cases so this is a this is kind of a clever way of turning this on its head is we're we're saying if the null hypothesis is true then these 199 polio cases should be equally distributed that's a binomial distribution with 199 comma 1 12 so that's a kind of clever way of getting a mathematical statement related to the null hypothesis where we can build a statistic okay um I would encourage you write down the write down the normal distribution this is approximately normal with some mean and some standard deviation the mean of course is going to be 99.5 standard deviation there's a formula for that and then compute this test statistic assuming normal and convince yourself that this actually is the number of standard errors away from expected very very very strongly significant result okay now there's a lot say about this there's a lot of um lot of ways of solving this a entirely different way of solving this my control group is so large that this number of infections 142 polio cases out of 200,000 Placebo um control group uh children that actually is a large enough sample to get a pretty good estimate of the rate of of polio infections per child and then what you could do is you could take that and say what is the chance of getting 57 given that rate so I could just I could basically take this as the population statistic and say what is the chance of this rate given this population statistic you could form a different hypothesis test um it'll come out to the same thing essentially but it'll be a completely different way of doing it and that would also be interesting and and uh kind of useful to do now I mentioned um polio was eradicated in uh in the US um in Europe in most of the world in uh you know after this trial it was their vaccines were given to every kid and it was eradicated there are still cases of polio popping up a few places in the world um as of my most recent knowledge of this you know five or 10 years ago Nigeria and Pakistan are the places that have um you know Resurgence of polio and there are concerted efforts for example in the Institute um for disease modeling um IDM that's here in Seattle to try to model and control polio to try to not just eradicate it in you know Europe and America but try to eradicate it everywhere in the world in Pakistan Nigeria and again because the conversion rate is so low it's very hard to monitor cases of polio without measuring the whole population if you do a good job of suppressing it with control by actually vaccinating a a handful of people then you know then your observation rate goes down and it gives the the disease room to spread while you're not watching now if you can take that population and vaccinate every single person you can eradicate it but we're talking about places that either don't have the medical infrastructure to vaccinate the whole population or where there's enough distrust uh that you know the majority of the population won't willingly consent to be monitored and vaccinated so that actually makes it a really hard modern modeling and control problem where there's you know a lot of Statistics a lot of dynamical systems modeling and a lot of control theory really hard modern engineering problem this is kind of the um fun hypothesis testing version where it's easy to calculate a super strongly significant result but today there's you know it's there's still people trying to eradicate polio in other parts of the world okay um cool example of hypothesis testing um with a large um large population being treated okay thank you

---

## 20. Lies, Damn Lies, and Statistics... P-Hacking
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 4 months ago | **Duration:** 19:14 | **ID:** Et9pORQHR2A
**Link:** https://youtube.com/watch?v=Et9pORQHR2A

### Transcript:
welcome back okay we've been talking about hypothesis testing which is a really central idea in statistics about making statistical statements about your data what distributions it comes from has something changed in your data things like that and one of the key ideas is this notion of a P value or a significance value of that hypothesis test so generally speaking we want small P values of 0.05 for statistically sign ific or 0.01 for strong statistical significance which roughly corresponds to having like a 95% confidence or a 99% confidence that your hypothesis is true and the emphasis on this P value has created a lot of incentive for people and researchers to do something called packing now there's a lot of subtle terminology here and I'm not going to um perfectly you know capture all of the nuances of all of the ways you would say this um I'm going to use kind of a big umbrella and say everything I'm going to describe as a form of packing sometimes people do pecking uh on accident that's quite common sometimes people do it maliciously or fraudulently sometimes it's a combination of both and if you want to be a really ethical honest good scientist you have to be super aware of these pitfalls and what can go wrong so roughly speaking packing is a bad way of doing statistics where you only report experiments that yield significant P values while ignoring or omitting non-significant results in all of the cases we've done so far in all of the examples there has been one simple hypothesis and it was pretty obvious how to test that hypothesis there was one test one hypothesis but lots of times if you collect a complex data set with lots of dependent variables and lots of outcomes maybe you're doing a longitudinal health study and you measure a lot of factors that could affect someone's health and you measure a lot of Health outcomes you could do tons of different comparisons and if you do enough hypothesis tests even just by chance maybe one of them will have a significant P value even if none of them are actually true even if there's no significance uh in that study so remember the P value gives you your rate of um I guess false positives so how often you would reject the null hypothesis even if the null hypothesis was true and if I run you know hundreds of hypothesis hypotheses and test them all just by chance get some of them that have a significant P value that's what pcking is so I'm going to give you some examples um of the most common ones and then we're going to fire up some python code and actually go through an example of one of my favorite um kind of examples of packing that's related to some of our earlier examples so very very quickly um kind of some of the most obvious ones are uh what's known as cherry picking um cherry picking or multiple comparisons um and it's essentially what I was describing um describing before maybe you have a data set and you run a bunch of hypotheses you hypothesize that the mean increases you hypothesize that the mean decreases you hypothesize that the standard deviation changes you run just a bunch of hypotheses on your data um and if you wait until one of them has a significant P value and you only publish that result but you don't tell people that you ran five or 10 tests that's cheating that's pcking you can't do that um another really really common one kind of related is this notion uh it's called Data dredging or fishing um data dredging sometimes called fishing going on a data fishing Expedition and essentially this is the most common in the Big Data era um in the Big Data era where nowadays we collect these massive massive data sets where there might be like hundreds or thousands of variables and if I do every point-to-point comparison of all of those variables I'm going to find spirous correlations I'm going to find things that are correlated in my data that have a significant very significant P value even if realistically those correlations are totally bogus just by random chance again the P value says that some of the time you're going to get these false positives meaning false spirus correlations so big data spus correlations huge um thing to look out for and the way you correct for both of these there are Corrections you do for the numbers of tests that you run if I run a 100 tests I have to adjust my P value um I have to normalize my P value if I run multiple tests or multiple correlations proper statisticians know how to do this but this is one of the most common pitfalls and then the one that I'm going to show you today um in in Python code is kind of a neat one when you're designing a test let's say you're trying to test um in our website example where we you know we had a website with an average number of daily visits and then we did a you know marketing campaign to try to increase the daily visits we want wanted to hypothesis test did the mean value did the average daily visitors increase we averaged over 30 days we did a sample of 30 days and averaged over those 30 days n equal 30 um and then we did a hypothesis based on that data if you stop your data collection if if I if I started at 20 days and then I calculated my P value and then I went another day and calculated my P value value and then I went another day and calculated my P value and I did that for 20 more days I could probably find one day where my P value dipped below significance even if uh overall my data my my results were not significant and so this idea of um kind of stopping your data collection this is actually a really pernicious one stopping data collection so it's very very natural um I feel like you know anyone who's run experim exp has thought about doing this every day you check on your experiment you check on your experiment you check on your experiment and you're kind of waiting for it to look good you know to to look significant and then if you stopped right there that's cheating okay you have to specify uh how long how many samples you're going to collect ahead of time you have to specify n ahead of time um this is a really really pernicious one and this is one that going to actually code up in Python good this is just some of the examples there are like whole studies on packing how to avoid it how what to look out for um here at udub jevin West and Carl Bergstrom are experts on you know they they wrote a book called calling  it's great um and they teach a class that essentially talks about these kinds of pitfalls that you can look for if you're looking at someone's data and what they're trying to convince you of these are common pitfalls um or ways of manipulating statistics so that they can say what they want uh and fool you okay so sometimes this is fraudulence sometimes this is ignorance sometimes it's a little bit of both let's code up an example and and look at these okay so um there's actually kind of a cute website um called like spirous correlation something like that let me find it um yeah if you just Google spirous correlations you'll find um you'll find this website it's pretty cool it just has a huge amount of data um over time so from 2004 to 2022 so some number of years they they measure a bunch of of data okay like I think hundreds or maybe thousands of independent things they measure over this time period and they can compute the correlations from every single uh between every single thing that they're measuring and because they have such a large number of of variables that they're comparing they find a lot of bogus spous correlations so this website is kind of um it's its purpose I guess is to try to educate people about spirous correlations and this data dredging fishing issue so um you know popularity of the first name Dexter with Google searches for Bing probably they have nothing to do with each other this has a significance A P value that's less than .01 this is strongly statistically significant if you don't correct for the number of comparisons um another one let's see we have a number of Articles Matt Levine published on Bloomberg versus nuclear power generation in France looks super correlated clearly these have nothing to do with each other okay again A P value less than 0.01 um this is maybe my favorite American cheese consumption with black rocks stock price again um statistically significant if you don't correct for the number of comparisons this you know is my favorite one so spous correlations data dredging fishing comparing lots of variables is a common uh a common issue you have to correct for the number of comparisons or the number of tests and I think that this website actually gives information about how they run this um let's just go up you know [Music] um let's see at some point they're going to say how many tests there are let's just see what it says um well if you go to this website you'll you'll you know um you'll be able to figure out like some of these there's you know this is correlation number 2734 so clearly they have a big set of of uh of variables that they can compare against each other so there are thousands of comparisons that they're running to get these significant P values okay um yeah the why this works um would be kind of where you would look at it so um okay so there are 25,000 variables in this database which means that you have you know this enormous number of comparisons so you're almost certain to find some subset of them with significant P values even though it's totally spirous and uncorrelated okay good um what I really wanted to show you is an example of this stopping data collection this is a really cool example and I was thinking about this when we were doing that website example that's when this kind of came into my head as an example where I could show you um a concrete example of of packing and so um this is actually a code I wrote in collaboration with uh chat GPT it's pretty easy to do um my original prompt was pretty simple uh I said I'd like to set up um a python script to demonstrate the danger associated with packing I want a code that generates random coin flips with a Fair coin and then computes the P value uh for the hypothesis that the coin is fair or not okay pretty simple and then what I want to do is I want to start with an N equals 20 and I want to keep flipping a coin until n equals 50 and for every single one of those extra coin flips from 20 to 50 I'm going to compute the P value and then plot the P value okay pretty simple idea GPT got really really close um but not perfect um so I actually modified the code slightly to fix it I'll tell you what it messed up um maybe at the end of this but I'll just show you the corrected code it got really close and later I asked it to correct the thing it messed up and it corrected it and wrote a really nice code so what we're going to do um we have essentially I'm using a random seat of 41 you'll notice GPT always uses a random seat of 42 I asked it why and of course it's because it's the answer to um you know the fundamental question uh of the universe right um I changed to 41 for this case and okay we have an initial number of coin flips of 20 so I need at least 20 to make sense of computing A P value so I'm going to start with 20 coin flips and then I'm going to go up to a Max coin flip number of 50 so I'm going to flip 20 then 21 22 all the way up to 50 and from 20 to 50 we're going to compute the P value and we're going to store that list of P values and plot it really really simple okay um so for the number of flips uh in N values so from uh 20 to 50 each time we flip a new coin a new flip we append it to our list of coin flips we uh calculate how many heads there are and we do a binomial test um to see what the P value is associated we think that a Fair coin is binomial with probability 1/2 and so we test is that number of heads consistent with a binomial distribu bution that's our hypothesis um that we're testing and we get a P value I'm glossing over a lot of this you should write down a null hypothesis and confirm that this is correct and we append that P value for that coin flip to our list and then we plot a bunch of stuff so let's run this code okay we run this code and lo and behold this is what we get so this is the P value versus the number of coin flips so on my 21st coin flip I have a P value of you know8 it fluctuates around it's not significant not significant not significant and then at some point around coin flip 33 because of just random chance because I'm testing so many times it dips below significance it turns out that just for this one time if I only stopped at 33 my results would look significant but for every other value of of n for you know from 20 to 50 coin flips I don't have a statistically significant result because my coin is in fact fair this is a Fair coin that we're flipping and so I should be rejecting I should be you know um failing to reject my null hypothesis my null hypothesis that the coin is fair is actually correct and this shows you if I stop my data collection when I get the result I want if I keep testing and testing and testing and testing what I've essentially done is a bunch of uh hypothesis tests and I've kind of diluted the meaning of my P value I have to correct for that number of tests if that's what I'm going to do and so designing your n ahead of time is super duper important if I specified n equals 30 or 40 or 50 ahead of time I would have gotten the right results if I was unlucky and I specified n equal 33 ahead of time I would have gotten the wrong result and that's expected sometimes that is what the P value means sometimes you're going to get false positives uh and false negatives that's expected but um this way you're much more likely to get the wrong result if you just wait until you get a significant P value um so this is kind of one example of a pitfall I think it's kind of a nice example because it shows um you know a really common gut feeling way of doing this which is just to collect data until you get a significant result totally cheating you can't do that okay um so how did GPT mess it up the first time well I wanted obviously a sequence of coin flips so you flip 20 and then you flip a 21 the 21st coin the 22nd 23rd 24th but you keep the previous sequence fixed the first time I asked GPT this prompt it incorrectly created a sequence of 20 flips and then a brand new sequence of 21 flips and then a brand new sequence of 22 flips which isn't what I asked for um it gives this kind of nonsensical you know uh P value where every single uh experiment was a completely different sequence of coins um the good news is it's really easy to to fix if you know what you're looking for so this is my you know uh corrected code I asked it I said you this is close GPT but I want to start with 20 coin flips and then each time I add a coin flip it's an addition to the previous coins already flipped so the first 20 never change and every time I add a new coin flip to the sequence I comput the P value with that modification it fixed the code totally nailed it and gave uh the example I was looking for okay so really easy to code this stuff up um make sure you know what you're looking for though and you can double check the answers because it did get it wrong the first time but it gave me a base code that I could pretty easily modify myself or I could ask it to modify it based on my correct my corrected feedback um and if you change the random seed this will change so if you use 42 um you'll actually get a case where I guess the first sequence was so nicely conforming to you know random chance that it never dips below significance but if I change the P value sorry my random seed to a different random number like 41 or 40 or 39 sometimes I'll get this spirous effect so try this for different random seeds 39 38 37 whatever and a really interesting question this is something that I was thinking about myself is if I started with an N of 20 and I keep increasing until I stop until I get the the result I'm looking for How likely am I how how does that modify my my P value how does that dilute my P value or set another way How likely am I to get the wrong results um if I do this kind of this version of pcking how bad is this can you quantify how bad of an idea or how bad this messes up your statistics that's a pretty interesting and hard problem that I would like you to think about okay pitfalls uh packing know what you're doing you get one comparison you have to design your experiment ahead of time including the number of samples including everything ideally you would publish that uh protocol or give it to somebody so that they can keep you honest and then you do that one test and you report your results if you're going to be doing lots of tests because that's you know you have a big Rich data set and you want to do lots of tests that is okay but you have to correct for the number of tests that you do that changes uh you have to normalize your P value it changes what significance means if you're going to run lots of tests okay thank you

---

## 21. Hypothesis Testing Procedure
**Channel:** Steve Brunton | **Views:** 11K | **Date:** 5 months ago | **Duration:** 18:01 | **ID:** WYifBkNg1r8
**Link:** https://youtube.com/watch?v=WYifBkNg1r8

### Transcript:
welcome back okay we're talking about hypothesis testing in statistics which is this notion that you can ask a very specific question did something change in my distribution in in my distribution of data or of some process that I'm monitoring and we can test that hypothesis and actually give a you know a number to how confident we are that either nothing changed or something changed using this notion of hypothesis testing so the procedure and I gave an example last time um I'm just going to recap the procedure here and talk about a few more kind of details and subtleties the basic procedure um let's say that you have some uh you know medical treatment some some new wonder drug you have a control group and a treatment group and you make a a hypothesis that this drug is effective let's say then your null hypothesis would be that there is no change in the treatment group having the the drug and your alternative hypothesis is essentially that something did change that your drug was effective so your alternative hypothesis is the thing that you want to actually prove if you think you have this this wonder drug and so what you do is you establish a null hypothesis it's basically the the straw man or the counter argument maybe nothing changed and your observed results are just the product of statistical fluctuations and variations you know there's random Ness in the world maybe your observed outcome is just you know uh within the expected range of variability you would expect in a statistical process that's the null hypothesis so the procedure here then is you assume the null hypothesis is true remember in probability it's a lot harder sometimes to compute the probability of something and sometimes it's easier to compute the probability that that thing is not true that's what the null hypothesis is so we assume that the null hypothesis is true um this is still from my last example where we had uh the website data so you assume that the null hypothesis is in fact true and then what you do is based on your observed data from this this treatment group or or you know kind of your new observed data after you think something has changed you define a test statistic of The observed change um like the the the new data for example in this case I'm assuming Maybe um the average value of something has has shifted because of my treatment or because of my manipulation then I would take my observed average xar my my data from this new um modification minus the expected average given that the null hypothesis is true if I assume the null hypothesis is true then I assume that my expected average is the same as my previous um average or the average of my control group and I divide that by the standard error um which is a quantifiable calc uh a calculable quantity this is essentially the sample standard deviation from the the treatment group or the the after manipulation group divided by the square root of the sample size um of that that group and essentially what this does we know that let's say we're trying to you know detect if there's a change in the mean or the change in the average value that's that's like the most common uh one of the most common things we would test with a hypothesis testing we know that the average value of this sample is a normally distributed random variable because of the central limit theorem so if I subtract off the mean and divide by the standard deviation or standard error I should recover this variable Z called my test statistic and it should be a normally distributed random variable with mean zero and standard deviation one this is a very very common thing we do is that we subtract off the mean divide by a standard uh error for a normal distribution to turn it into the standard unit normal form because here now if Z is particularly large we can quantify how big it is in terms of standard deviations or standard errors away from this expected average assuming the null hypothesis is true okay this is recap we we've done an example of this in the last in the last lecture so and this is from Act ual these are numbers that you compute xar is data standard error is from data the expected average is either um some previous knowledge about your previous distribution or it's data you collect from a control group so you can compute all of the terms in this equation here okay if I was being really clever I would have made this one pink and this one pink and this one blue because um this is my treatment group treatment group and control group um but you get the picture here and we compute this Z value okay now Z if we think that the average if we think that the you know average Health outcome or life expectancy or whatever if that mean or average value moved we let's say we we expect this to increase we think that our drug was successful so some average value of some quantity increases in my treatment group then we would um we would see a zv value ideally that's to the right of zero that would be an observed increase in the the the mean value after this treatment now the null hypothesis says that nothing changed and that that was just random fluctuations and so the real question is if I observe a zv value here let's say that this is my zv value if I observe some zv value I actually run the numbers and I get a zv value let's say it's like two I get a zv value of two so my observed mean is two standard errors away from my you know null hypothesis mean How likely is that to happen How likely is the null hypothesis to be true how uh how much do I believe that this observed uh Z is just the product of statistical fluctuations and my null hypothesis is in fact actually true so the way we ask this question is how small of a z value of um of Z do we need to reject the null hypothesis how small of Z would reject the null hypothesis okay and we'll remember the P value is the area to the right of this um this Z value in this standard unit normal cumulative uh probability distribution and P is the probability that the null hypothesis is false so p is the probability that it's the probability that Z is um greater than or equal to this value maybe I'll put um maybe I'll make this an alpha okay this is Su Alpha p is the probability that my Z value is greater than or equal to sum Alpha okay and this is also the probability [Music] that my null hypothesis is true okay so given the data um this P value is kind of my best estimate of the probability of my null hypothesis being true so if p is like 0.1 that means that there is like a you know a 10% chance that the null hypothesis is in fact true and that is too inconclusive I can't make a decision based on that like a one in 10 chance that that my results were the product of Randomness is not necessarily enough to act on but if my P value was um 0.05 that would say I'm 95% confident that my null hypothesis is false if p is .01 then I'm 99% confident that my null hypothesis is false so that gives me some way of asserting a statistical confidence that either my null hypothesis is or is not true that's what the P value is useful for and small P values make me more confident in rejecting my null hypothesis in asserting my alternative hypothesis is in fact statistically likely and so you have to determine that P value cut off ahead of time you can't just run your experiment look at the P value and then decide oh that's good enough for me you have to go in with um a predetermined value of P that you're willing to live with um to trust your alternative hypothesis okay so you essentially um you know for example you choose P = .05 as the uh rejection Criterion this would be the the rejection Criterion as the rejection Criterion criteria and what that means is that anything to the right of here if my Z is anywhere to the right of this where P equals .05 or let's say you know 5% if my Z value if my test statistic Z is anywhere to the right of this this value this um you know 05 P value this is what's called the rejection region and so usually what you do if you're you know a good statistician is you design an experiment you design an n a number of people in the controlled group a number of people in the treatment group you design a hypothesis you design you you specify A P value which sets up a rejection region then you run the test you sometimes you actually publish your protocol before you run the test so that everyone can keep you accountable um and then what you do is you actually then run the test you calc you get the numbers you calculate this test statistic and you see if it's in the rejection region or not if Z is in the rejection region then you reject the null hypothesis and your uh alternative assertion is probably true and if Z is to the left of this Alpha then you cannot reject you fail to reject the null hypothesis and your results are inconclusive okay that's how this works and so for this value of P equal 05 um you can actually look up in your you know statistics book or ask GPT or go to python or whatever you can figure out in a standard unit normal what is the alpha for which 95% of the probability is to the left and 5% is the right is to the right and that would give you a critical Z value um of Z greater than or equal to 1.6 for five we're going to say standard errors okay so if Z this is your critical um critical value so if Z is if if you collect your data you run your test this is your pink data this is your blue data if you calculate this Z value you subtract off the expected mean divide by the standard error and you get this this Z which should be normally distributed unit normal if Z is bigger than or equal to 1.645 you can reject your null hypothesis with 95% confidence if Z is less than this value you fail to reject the null hypothesis and if if I set my P value my my threshold P value at 0.01 I need strong statistical significance then my Z would be even bigger it would I would need more standard errors to assert to reject the null hypothesis with 99% confidence okay that's how this works so you can design um these rejection regions and rejection criteria based on how significant you want your results to be before you make some decision or publish those results and for some things you need you know really really significant results met uh some Medical Treatments you need strongly statistically significant results other things that are less critical you might be fine with 95% confidence it depends on the application okay good um what are some other things I want to tell you um this example I drew here is based on my hypothesis saying something about the mean the expected average of this distribution of these populations and having that mean change or increase so in my website example where I have a gorilla marketing campaign and my website traffic should have gone up afterwards I'm looking to see if my average website traffic before changed and increased so if xbar my observed website traffic after my marketing campaign is larger than my average website traffic before the marketing campaign that's implicitly assuming my my alternative hypothesis is actually that my average increased it's not that my average is different it's that my average increased and that's why we're looking for values of Z that are to the right um of some Alpha if I if my my marketing campaign could have failed let's say that my marketing campaign was risky and I could have either been really successful or I could have totally pissed people off and driven my traffic down then my hypothesis would be slightly different then there's a chance that my manipulation could have actually made the the mean lower than uh than before the manipulation and in that case we do something called a two-tail test where again we still have uh a z variable that is uh gausian we still compute the exact same Z variable it's still a gausian but now we open up the possibility that we could have increased the mean that would be part of my alternative hypothesis but we also could have decreased the mean this is also part of my alternative hypothesis so this sets up a different rejection criteria if you think that there's the possibility that your modification could actually hurt or decrease your observed um population mean or average value um this comes up in lots of places this is actually one of the common ways people manipulate P values is when they should have done a on tail test they do a two-tail test instead and it makes it harder to reject your null hypothesis um there are you know uh stories of cigarette companies doing this in you know when evidence was coming out that cigarettes might not be healthy for you the natural test would be you know that they that they actually hurt you that the that there is a one-sided possibility that they have a negative Health effect if you open up the possibility that cigarettes could also improve your health outcomes that creates a two-tail test and it makes it harder to reject that null hypothesis especially when you have a small n if you only have a population of 30 that change from a one-sided to a two-sided test might be enough to keep cigarettes you know without warning labels for another couple of years so two tail versus one tail tests um are important to to know the difference I'm going to give you a couple of examples of how to compute this um two test when the mean could be increased or decreased so we'll see that in a little bit for the case of you know um an obvious marketing campaign like I just paid for advertising and I expect my mean to increase then a one-sided test um is is very reasonable other thing I'll mention all of the tests I'm showing you all of the examples and what I'm talking through here is specifically for a hypothesis that my average value has changed that xar is different than than mu the the pre-modification um population mean there are other hypotheses you can you can test this is what's called a simple hypothesis because I'm assuming a distribution and I'm assuming that the parameters are known I'm assuming I know the MU the average before modification there are things called composite or complex hypotheses where maybe I don't even know what the distribution is or I don't know what the parameters are those kinds of questions would be like you know I just collect some data for Heights of people in America and I'm asking the question is this data normally distributed is it you know is that's my hypothesis is this data set normally distributed we would formulate that slightly differently that would be a different hypothesis we'd come up with a null hypothesis and we would test that in a different way we would use something called the Ki squared um test um to see if if a distribution matches another distribution that's a different test um this is a simple case where we're just tracking if the average value has moved and so often when you're designing these uh these hypotheses if you can formulate your hypothesis in terms of an average value of a population or some some measured value like the percentage of yield in a factory you know you want that percentage yield that average yield to increase then you can use this kind of simple hypothesis testing where everything makes sense and it's kind of easy okay we'll talk about more soon but that's what I wanted to show you for now thank you

---

## 22. Hypothesis Testing in Statistics
**Channel:** Steve Brunton | **Views:** 18K | **Date:** 5 months ago | **Duration:** 24:55 | **ID:** vVDahuv1bq8
**Link:** https://youtube.com/watch?v=vVDahuv1bq8

### Transcript:
welcome back so today we're going to introduce the concept of hypothesis testing in statistics this is one of the most uh kind of ubiquitous ideas out there so I'm sure you've heard of P values and packing confidence intervals that all has to do with hypothesis testing and it's how we make statements about how confident we are in some statistical property of some data set so um really common examples are things like let's say you want to test a new uh drug or medical treatment so you would set up an experiment where you have a control group and a treatment group and you would try to say something about you know did the properties of that treatment Group Change with respect to the properties of that control group is there a statistical difference in these two distributions that would be some evidence um of the effectiveness or ineffectiveness of that drug or medical treatment and similarly um you could have before and after some manipulation you collect data so maybe you have a factory producing um some product and before you change something in the factory you have a certain yield of you know um kind of successful products generated or faulty products and you change something in your production process and you want to tell did my yield change did my maybe average value of successful you know um products or non effective products did it change after my manipulation so these are the kinds of questions we ask and answer with hypothesis testing um has something changed in my distribution of my data now technically it doesn't have to be before and after I could just have a data set and I could ask a question is this data set um does it belong you know is it a normally distributed data set do these random variables come from a normal distribution or is the data distributed as Pon with Lambda equal 10 those are also hypotheses that I can test um and give a statistical confidence of how true um or How likely that statement is to be okay very very powerful we're going to get into a ton of examples and this is going to give us a lot of tools for how to use the probability we learned um to make really strong statistical statements about the real world and the data we observe uh from that real world so let's do an example um I want to start with um just a really really simple example we're essentially going to do um kind of AB testing where let's say you know I have some website and it gets a certain amount of traffic per day and after some guerilla marketing campaign you know I measure the traffic for 30 days and I want to tell did that campaign work was it effective did it shift the mean uh or average amount of users or or viewers per day okay so um we're just going to get started so we're going to say um this is just an example so we're going to have you know a a website um has an average um an average daily views or visits average uh daily visits and let's just say that this is I'm just going to pick a number uh 10,372 so 10,372 um visits per day we're going to say this equals mu okay this is the average um before manipulation okay and after marketing so after the marketing uh after the marketing campaign maybe you you know whatever sign up for uh you know a pro account on social media and you start you know blasting ads to take people to this website um so this is after manipulation after marketing we have to run an experiment we have to collect data okay so um we collect a random sample of 30 days so after marketing um we we sample for 30 days and find uh a sample mean of these 30 days a new average uh daily visits to that website we we find a sample mean of uh let's say 10,628 uh average daily visits and average daily visits with a sample standard deviation a sample SD of um I'm just making up numbers I I work this out ahead of time so it Works um of 42 uh visitors okay so just putting some underlines on here this is my n is 30 n is the size of my sample my sample mean uh xar is 10,628 and my S sample standard deviation is 402 so this is the basic problem just um we we had an old mean um or average value and we changed something we did some marketing after manipulation we have a new observed mean over some sample so we sample 30 days we assume they're independent that's a little bit of an assumption but we assume that each day is independent and random um for 30 days and we get this new sample mean and standard deviation so the question is did something actually change or was this change just due to statistical fluctuations and random chance is this expected based on this mean or is this uh really because of a successful marketing campaign that's the kind of question we ask and so the way we uh write this down statistically in terms of hypothesis testing is we state two different hypotheses there is What's called the null hypothesis that nothing changed so either a um the mean hasn't changed the mean uh has not really changed and The observed uh difference is due to statistical fluctuations and this increase um is due to statistical uh statistical fluctuations just Randomness fluctuations kind of expected statistical fluctuations we know that things are distributed and have a spread this is called the null hypothesis the null hypothesis you've heard about this before probably and we typically give this a symbol or a name often it's Capital H uh Subzero the null or zero kind of the the the Baseline hypothesis that nothing has changed and the other hypoth hypothesis the the kind of counter to this that's the complement of this from a probability standpoint is that um actually the mean has increased the mean has increased meaning that this observed uh sample average is unlikely to be due to statistical fluctuations so it's kind of um you know uh too large of a change for statistical fluctuations for uh for it to be kind of random and this is called the alternative hypothesis the alternative uh alterntive hypothesis and sometimes we give this a name we call it hcore a and I realize in a testing really that should be called ba a testing because it's before and after and after would be the a the A's and the B's don't don't work just you know uh anyway there are two hypotheses a null hypothesis and an alternative hypothesis and these are complimentary sets from a probability standpoint either a is true or B is true there's no other possibilities either nothing is changed or something has changed those are the two possibilities and so what we're going to do is calculate using essentially what we learned in probability and kind of models of uh of xar and things like that we're going to compute kind of a likelihood or a confidence interval or some some you know um significant an of How likely it is that the mean has not changed and that will either support or um or kind of refute these hypotheses okay and remember just like in um in probability it's often very hard to compute the probability of something happening like the probability that there's a change there's a million ways this distribution could have changed it could have changed the mean in lots and lots of ways to get this observed value this is almost impossible to compute this is actually really really easy to compute and so kind of roughly speaking from our probability um you know this alternative hypothesis has probability one minus the probability of my null hypothesis being true so I'm going to compute this guy and use that to say something about whether or not this distribution has changed okay good um and the answer to this question of has something changed we're going to use the central limit theorem so this xbar quantity this um xar is going to be a normally distributed random variable we know that as long as n is large enough and 30 is large enough then xar is going to be normally distributed around its value of you know 10 628 and it's going to have some spread some standard deviation or variance related to this sample standard deviation and what we're trying to figure out is does the mean is the actual mean close in this distribution to the sample mean or is it really really far away is it many standard deviations away that would tell us if it's likely or unlikely um that this was random chance or if something changed you're probably tempted to compare the difference between these two which is I don't know it's about um 256 you're probably uh tempted to compare the difference between the sample mean and the previous mean 256 with this sample standard deviation 402 and you might conclude incorrectly that this difference is small compared to this standard deviation so not that much has changed but what you actually need to compare against is the standard deviation of the sample divided by square otk of n okay so that's actually what you need to compare this Delta to 402 divided by < TK of 30 that tells me how many uh essentially standard deviations away X bar is from mu and that's what we're going to do right now we're going to go through the procedure of hypothesis testing and actually compute a number for how confident we are you know what percentage confidence we have that something either changed or didn't change good so the procedure um now we're actually going to get into uh the procedure of hypothesis testing Okay so we have a hypothesis that we want to test it's whether or not my daily average um visits of a website has actually changed because of my guerilla marketing campaign I have some numbers I'm going to actually be able to compute this and so there's some steps we first establish our null hypothesis um which we've done and we assume one we assume that the null hypothesis uh H knot is true hot is true we assume the null hypothesis um basically that the average the null hypothesis is that the average is still uh mu equal 10,372 and that this is you know kind of within the realm of possibility given this mean um that's the null hypothesis okay two we determine what's called a test statistic okay so two we Define a test statistic that essentially is going to give us an actual probability test um and again remember this xar is distributed as a a normally distributed random variable by the central limit theorem and so we're going to use a normal distribution um to test the statistic okay so we uh Define a test statistic and I'm just going to tell you what that is right now the test statistic is essentially this value Z which is the observed mean this is the observed uh xar minus the hypothesized mean the expected average so the observed average minus the expected average divided by What's called the standard error and the standard error is going to be this standard deviation divided by square root of N and remember if you need to go back to the lecture where we characterized this xar we computed the mean and the variance of xar and the standard deviation of xar called the standard error is just the sample standard deviation divided by square root of n so as I increase n that should tighten right should get smaller and smaller so I need to divide by sare root of n uh in this quantity so this is literally equal to xar minus mu divided by this sample standard deviation um I'm going to call it you know uh Sigma hat divided by root n this is going to be what's called my sample statistic and remember because xar is a normally distributed random variable we can subtract this mean divide by this standard error and now Z should be a unit normal distributed random variable it should be gausian with mean zero standard deviation one which means we can use our lookup tables and our cumulative distribution functions to calculate things about the likelihood of Z being less than some value or greater than some value okay um and so maybe I'll actually just put in some numbers here so um this Z is going to be equal to um this number 10628 minus 10,372 divided by 402 over < tk30 and this is approximately equal to uh 3.49 and we say 3.9 standard errors because that gives us some context what that means is that if the mean was uh was whatever um let's let's write this a little differently if the mean value was 10,372 then my observed value of xar being 10,628 would be 3.49 standard errors or kind of standard deviations uh away from that mean and 3.49 standard deviations is a lot that's pretty unlikely we're going to compute we're going to use our look up table and compute how unlikely this is but it's very unlikely anything more than like two standard errors is very very unlikely three is kind of you know super duper unlikely and so that's what we're doing here we assume the null hypothesis we Define a test statistic we say if the null hypothesis is true what's the likelihood that X actually follows this distribution you know with mean mu given this standard error and I get some some number of standard errors of xar away from me that tells me how likely how how kind of far away those two are good um and if you like you could also say I have a distribution around xar How likely is it that mu is in that distribution those kind of equivalent statements okay um and then what we do the third thing is we actually just compute How likely this is we compute um what's called uh this is three we compute The observed significance level compute The observed significance level and we call this P this is not you know capital P the probability it's Little P it's called the P value you've heard of P values before like 0.95 95% confidence 99% confidence that's the significance level or P value and so again by the central limit theorem we assume that we have this gausian distribution I'm just going to draw it again over here so we assume um that we have this gaussian distribution and because we've subtracted off the mean divided by the standard error Z should be a unit normal gausian and our observed value is way over here at 3.49 standard errors away from the mean of zero in this normalized z-coordinate and so what we're trying to compute is what is the error that what is the probability that we're 3.9 3.49 or more standard deviations to the right of this mean what's this probability here okay and so um you can compute what's the probability um that Z is less than or equal to 3.49 that's all of the stuff to the left of that and this is something you can look up in your uh your handy you know stats book or or you can um you know I don't know go to uh wolf from alpha or you know in Python in scipi do stats you can do this or ask GPT this is an easy thing to look up this is tabulature this is known and so I go to table two of my statistics book and I look for the probability the cumulative density function of a standard unit normal um that Z is less than or equal to 3.49 3.49 is 999 98 okay 9998 so this equals 9998 which means that there is a less than 0.02% chance that my sample mean would be this large or larger given this uh previous mean and this sample standard deviation so this is my P value my um actually my my P value is is the the small value um so so the P value is this little tiny number2 this is my P value and the probability it's the probability of this null hypothesis being true the probability of my null hypothesis being true is .002 that's my P value that means it's extremely unlikely that the null hypothesis is true so we say that we reject we reject the null hypothesis that is the way that you say it if you want to sound legit is that if your P value is small enough meaning that the probability that this data came from this distribution if that P value is small enough then you say that you reject the null hypothesis and that means if the null hypothesis is not true then the alternative hypothesis is probably true okay now we have not proven that this comes from a dist different distribution we have just said that it is very statistically unlikely that the distribution hasn't changed it's very likely that the that the distribution of average daily visitors has changed we haven't proven that it has but we've said that assuming the central limit theorem and and you know the data collection was correct based on our assumptions there's less than a 0.02% chance that this data came from the same old distribution where nothing changed so that's the conf that that's the power of hypothesis testing is that you can say you can put a number to How likely some uh hypothesis is there is a you know 0.02% chance that the null hypothesis is true um and you know a 99.98% chance that the alternative hypothesis is true okay good um now there are a lot of other things we still haven't said what the new mean is we don't know what the new expected uh average daily visits are this is probably my best unbiased guess right now um and it has its own statistical properties but this hypothesis testing didn't tell us you know for sure what the new mean was we could develop a confidence interval for you know if I wanted to be 95% sure that my new average daily values is between a certain level and another level I could build a confidence interval based on the statistics of xar but that's not what hypothesis testing does it just allows me to write down a hypothesis that nothing changed and either support or reject that null hypothesis um last thing about P values um so we want um small P values um are evidence to reject the null hypothe our evidence to reject the null hypothesis um are evidence to reject the null hypothesis H not and so typically if p is less than 0.05 we say that this is a statistically significant uh statistically significant you'll hear this a lot now significant we say specifically that ha the alternative hypothesis is statistically significant and if p is less than .0 one we say that it's strongly uh strongly statistically significant ha so if I run a medical trial if I have some new wonder drug for you know cancer treatment or for weight loss and I run a big test with a big n and I get a P value that's less than 0.01 um that would say that there is strong statistical significance in the hypothesis that that drug is actually effective okay and that's how you use this um this P value now there is a lot of danger people in you know research groups medical groups um all over the world uh because the P value allows you often times to publish your results or not publish your results to have people believe you or not believe you to have people spend hundreds of millions of dollars on your drug or not there's a lot of motivation to manipulate your statistics to get a P value that's significant or strongly statistically significant this is called packing it's a really really pernicious form of lying with Statistics we're going to talk about it in a little bit but at least in this simple example you can see the basic idea of how to form a null hypothesis how to how to take a hypothesis how to form a null hypothesis and then test that null hypothesis and actually get a number out of how confident you are that you either should accept or reject that null hypothesis okay thank you

---

## 23. Central Limit Theorem Example & Hypothesis Testing
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 5 months ago | **Duration:** 9:33 | **ID:** bOrihOzYXWA
**Link:** https://youtube.com/watch?v=bOrihOzYXWA

### Transcript:
welcome back okay I want to share this really really neat example of the central limit theorem that I got from Dr John quintella at the University of North Texas uh Dr Q is a legend in probability and stats and this is this is you know from when I took his class uh a bit over 20 years ago it's a really really good example okay so the statement of the problem is as follows a punter or a kicker in the NFL has his ially averaged 41 yards per punt with a standard deviation of eight yards so this is American football and the punter is the only person who actually kicks in American football with his actual foot what is the probability that this Lonesome Kicker in their next 40 punts will average at least 45 yards so their historical average is 41 yards what with a certain standard deviation what's the probability that their next 40 kicks are going to average at least at least 45 yard this is a really interesting probability problem and we're going to use the central limit theorem to solve this because essentially 40 is a large enough number of kicks that the central limit theorem is going to kick in okay good um so the basic idea is that we're going to introduce this random variable our uh mean we're going to call this x40 bar this is the sample mean of these next 40 kicks this is 1 over 40 uh times the sum from I = 1 to 40 of the random variable x i where XI is the distance of each I next kick or next punt okay so XI we're assuming is distributed according to this distribution with an average of 41 and a standard deviation of 8 we don't know what the distribution of the punter's kick length is it might be C it might be Pon we don't know but we do know it's mean and its standard deviation and that's all we need to compute this probability with the central limit theorem so this is our random variable um I'll write down some more facts in a minute but the basic statement is what is the probability that this uh x40 quantity this x40 bar the the average of the next 40 kicks is greater than or equal to 45 that's the thing we're trying to compute okay now we know some basic um some basic properties of this sample mean x40 we know that the expected value of um of the average next 40 kicks the expected value is 41 and we know that the sample variance or sample standard deviation is going to be related to this population uh standard deviation and the sample size 40 so we also know that the standard deviation of X bar 40 is equal to this standard deviation divided by root n this is 8 uh over < TK 40 okay so the variance would be 64 over 40 that's fine good um and what else do I want to know um yeah I mean each of these random variables themselves has an expectation of 41 and a standard deviation of eight and so that's pretty easy for us to compute these quantities we've done this in previous lectures so this is the information we need and so essentially what we're going to do is we're going to write down the central Li by the central limit theorem we're going to derive what this probability has to equal so by the central limit theorem okay essentially this random variable because 40 is a large enough sample size this should be approximately normally distributed with this mean and this standard deviation so this um so essentially we should have x40 it should have a distribution around the mean of 41 with some standard deviation some you know plus or minus Sigma and we're trying to figure out what's the probability that we're all the way out here at an average of 4 kicks um 45 yards per kick okay good and I mean you can kind of see like you're going to use a cumulative distribution and compute this area so this area equals 1 minus area to the left or this area here so we're going to take this random variable we're going to subtract the mean divide by the standard deviation to turn it into a standard unit normal and then we're going to compute the area to the left uh of this value which is some standard deviations to the right of the mean okay good uh so by the central limit theorem we have the probability that xar 40 is greater than or equal to 45 that's equal to the probability now what I'm going to do is I'm going to take this minus its mean divided by its standard deviation X bar R 40 minus its mean 41 divided by its standard deviation which is 8 overun 40 now this variable here let me make this um this is xar minus mean / Sigma you know whatever it's it's standard deviation this is normal 01 this is a normally distributed random variable uh mean zero standard deviation 1 and so it's the probability that this is greater than or equal to 45 - 41 / 8 over < tk40 or said another way it's the probability that my standard normal Z variable is greater than or equal to this quantity here um and if I plug in all of these numbers you're going to get four / by 8 /un 400 is 3.16 so we're looking for the probability that a standard unit normal random variable Z is bigger than 3.16 and this is 3.16 standard deviations that's way out there to the right okay so I could look up in my stats table what the cumulative distribution function is for 3.16 for the standard unit normal or I could type this into you know my Jupiter notebook into Python and get the cumulative density function at 3.16 standard deviations in a standard unit normal um this is essentially equal to 1 minus the cumulative density function evaluated at 3.16 um and I'll make a note that this is 3.16 standard deviations which is a lot okay and if you look this up in your kind of back of the statistics books tables you're going to find that this is is approximately 7.8 * 10-4 so this poor kicker has about a 1 in 1,000 chance of increasing their average punts in the next 40 punts to 45 yards given their historical punting average and standard deviation now this is kind of a cute example um obviously people can change weather can change you can get injuries these are not independent events and this is not a fixed distribution this is probably a Wandering distribution but if you assume Independence of the kicks if you assume that there's just you know kick after kick after kick are all distributed from the same um distribution then there's less than a one in 1,000 chance that the kicker can increase their punt average to 45 yards I think that's really cool um this is a great application of the central limit theorem it shows how you can compute something pretty interesting by you know creating this random variable realizing that 40 punts is enough for the central limit theorem to kick in the sum of all of these individual punts is going to be normally distributed and so you can subtract off the mean divide by the sample standard deviation called the standard error and now you have a unit normal random variable and you can compute exactly How likely it is for that to be more than 3.16 stand standard deviations outside um of you know of the mean and that's what 45 yards is to 41 yards um in the next 40 kicks 45 yards over the next 40 kicks is 3.16 standard deviations away from their historical average very unlikely one in a thousand chance easy to compute with a central limit theorem uh thanks to John Quinton Nilla if you see this video uh email um Dr q and tell him thanks that you liked this example okay thank you

---

## 24. Confidence Intervals
**Channel:** Steve Brunton | **Views:** 20K | **Date:** 5 months ago | **Duration:** 16:57 | **ID:** qTVdV8ITZfk
**Link:** https://youtube.com/watch?v=qTVdV8ITZfk

### Transcript:
welcome back okay so in the last few lectures we've introduced this idea of a random sample of a larger population and we've shown that the sample mean xar is a normally distributed random variable whose mean is the population mean and it has its own variance um this is by the central limit theorem and what this we hinted in the last lecture that the fact that this sample is normally distributed can allow us to make very precise statistical statements about the likelihood of xar being within some value of our true population mean mu so this is going to be codified in the notion of a confidence interval and confidence intervals are ubiquitous in statistics they're kind of the Duel of the hypothesis test that we're going to introduce next so this is very closely related to hypothesis testing um and this is a super important idea so I want to introduce it here in the context of um the normal approximation to the sample mean xar and how it approximates the population mean mu but this is a much more General concept okay so I'm going to State what it means in words then I'm going to draw a picture then we're going to show how to use it this might not seem 100% intuitive at first but it's going to get really intuitive really really quickly so a confidence interval a we say a p perent confidence interval let's say this is a 95% confidence interval for me it's a random interval you can just think of it as an interval for now it's it happens to be a random variable it's a random interval centered at our best guess xar that contains mu with some probability P perc so I'm going to say that again we have a p% confidence interval a 95% confidence interval for Mu is some interval it's X bar plus or minus some value so that mu is 95% likely to be in that uh xar plus or minus whatever value so we're trying to find that interval what is the size what is the the size of the interval around xar so that I'm 95% sure that if I you know repeated this sampling a bunch of times 95% of those times mu would be in that random interval okay so um maybe I'll I'll just draw a little picture over here um so we know that our sample mean uh xar is centered around me on average okay so so xar is a random variable whose expectation is Mu but if I do this sampling if I sample 30 individuals one time I'll get a value that's not exactly me it'll be you know within some expected it'll be within this distribution for xar and if I sample again I'll get a different value for xar and if I sampled again I'd get a different value for xar and that's what I mean by xar being a distribution and so what we're looking for a p% confidence interval is some interval around xar some interval plus or minus so that we essentially have have p% probability inside this range okay so there's P perc or P probability is inside this interval and what that means intuitively we don't say that there's a 95% chance that me is in this interval because this is a little bit uh philosophical but we think of Mew as a true but unknowable quantity it exists regardless of our sample our sample is an imperfect approximation to this true existent mu so we don't say that there's a chance that mu is inside our interval we say it a little bit differently what we say is that if we randomly generated xar and established the interval around that specific xar if we did that a bunch of times 95% of the time that interval would contain the population mean mu now those are those basically mean the same thing that basically means that there's like a 95% chance that mu is within this interval but we don't say it that way in statistics um and I think it's good to be a little bit careful about how you say things um but it does mean essentially there's a p per or a 95% chance that mu would be in this interval for any given xar that you sample um from your random sample okay now how do we compute that interval that's the real question how do we compute what are the bounds of this this is like you know plus or minus this is plus some quantity I don't know uh q and minus some quantity Q how do I compute this interval so that mu is in that interval p% of the time so what we mean uh I'm just going to write this the probability this is different than than this P this is my probability my big p my probability that xar minus mu is within this range kind of um minus Q to Q we want this probability to be equal to P okay we want this to be equal to p and we say that that's also one minus some constant Alpha okay so if p is 95% or 0.95 then Alpha is 0.05 or 5% okay these are both going to be useful so this is the mathematical statement we are looking for a q we want to find a q such that this is true statistically okay we know me we we don't know me but um we know the distribution of xar we know it standard deviation we know its expected value is me so we can probably and we know it's normally distributed so we can compute the Q that gives us this confidence interval P okay good um so a little fact that we're going to need um given uh a standard normal a normal 0 to one uh you can Define the cumulative distribution function so remember that if I have a standard standard normal then there is some value if you how do I want to say this um we know that the cumulative distribution function Fe of Z is the probability that my random variable is to the left of that value okay we know that F of Z this is the cumulative distribution function for this standard normal this F of Z is the probability that I am to the left that my value is to the left of that that Z okay that if I want let's say I want this area to equal Alpha okay then cumulative distribution function of Z is 1 minus alpha or P okay I'm just I'm setting up a a fact that's going to be useful up here in a minute and so you can invert this because the standard normal uh is well find and the cumulative distribution function is monotonic and invertible if I have an alpha I can actually back look up what is the Z that would give me this Alpha so I can say if there is an alpha I want if I want 0.05 or 0.01 I can look up the Z that will give me an alpha of 0.01 or 05 or whatever so we can say that there is some Z of alpha that will give me area to the right equal to Alpha okay this is um kind of obvious but I'm a mathematician I can create this function Z of Alpha and it's the Z such that if I plugged it into the cumulative distribution function I would get a probability of 1 minus Alpha to the left and a probability of alpha to the right okay that's the only real property we need to set up this uh confidence interval okay so let's do this uh maybe I'll do blue and orange okay so what I'm going to do is I'm going to take this PDF and I'm going to divide by the standard deviation or the standard error of xar to turn this into a standard unit normal distributed variable so that I can then use this formula and this uh kind of formalism in terms of the cumulative distribution of the standard unit normal okay so this is equal to let's see if I can do this this is equal the probability uh of some value let's say I'm not going to do this quite yet there's some xarus mu over Sigma /un n less than or equal to some value and I want this to equal p which equals 1 minus Alpha okay and so let me just draw one more picture here um or maybe I'll use this picture here what this means is that if I transform this into standard unit normal coordinates by literally just dividing by the standard deviation of xar this guy then what I'm really looking for is I'm looking for tails that each contain Alpha over two I want this tail to contain Alpha over two of the area and this tail to contain Alpha over two and if I have if I find the value where each tail contains Alpha over two then the area in the middle is 1 minus Alpha okay good that's that's easy so what I want is I want the cumulative distribution function where the area to the left is Alpha over two okay so this is going to be this z uh maybe I'll do this again in Orange this Z of alpha over 2 um I guess this is minus Z of alpha over 2 and this is plus Z of alpha over two now I want you to pause slow down convince yourself that what I Define this Z of alpha where you know the area to the right of that is Alpha over two that's what I want here I want the area to the right to be Alpha over two and I want the area to the left of this interval to be also Alpha over 2 and this is how I do it and so what this means this is actually my confidence interval for E for Mu being in this range xar plus or minus this stuff okay um how do I compute this okay and there's actually numbers this is pretty useful so for um P equal .95 this is 95% confident then that would mean Alpha equals 0.05 and Z over .02 sorry Z of .025 so this would mean my Z value is um so this would imply that Z of .025 is equal to 1.96 you can look this up in the back of a statistics book um this is something that you can pull out of python out of the you know whatever ci. stats um toolbox you can go to the cumulative distribution function of a standard unit normal and you can find the Z so that the area to the right of it is 2.5% and that will be a z of 1.96 if you like this is 1.96 standard deviations so this is plus 1.96 standard deviations and this is minus 1.96 standard deviations now that was all formulated in these normalized coordinates where I divided by Sigma over root n but I really just wanted to know what is the interval around xar that contains mu this is what I actually wanted so I'm going to write that down so essentially uh I can kind of multiply both sides by Sigma over root n and I get um a 95% confidence interval is xar plus or minus um Sigma over root n times this Z of alpha over 2 this is the useful formula this is my confidence interval this is my p% confidence interval and you can actually take that code that we were working through that Jupiter notebook and what you can do is you can actually remember how we we drew these random samples and we did it like M times or M was 100 we did this procedure like a 100 times in simulations you can actually compute this confidence interval for that xar and you can compute how many times did me actually lie in this confidence interval and it should be about 95% it won't be exactly 95 but it should be about 95% um so if you repeat this you know 100 times or a thousand times mu will be in this interval about 95% of the time that's what our confidence interval means very very useful and this Z of alpha over 2 is computable you can look this up from the standard unit normal cumulative distribution function very very very useful um again this is uh 1.96 for p = .95 and that basically means I take 1.96 standard errors so it's xar plus or minus 1.96 standard errors that is a 95% confident interval from you okay last thing we don't actually have Sigma that's something we don't know so you can replace this with the population sorry the the sample variance you can replace this um quantity you can replace this with um I guess Sigma hat over < TK n < TK 1 - little n over big n this is going to be a good approximation um did I do that right I certainly hope so um well okay this is an approximation for Sigma so I guess you take this whole thing divided by another root n but anyway you can take your sample variance you can replace this which is in terms of a variance I don't know with an expression in terms of a sample variance that I do know I'm not 100% sure I didn't mess up an N here so go back to the notes and look and actually see exactly what this correction is but the the moral the upshot is that you can uh you can replace this with a value that's computed from your sample data um and get a pretty good estimate for your confidence interval still okay um that's confidence intervals for now we're going to revisit this a lot when we do hypothesis testing this is a super important idea um that we're going to come up over and over and over with um later so you know let's say I change something I change uh voter rules or I have some guerilla marketing campaign and I think my population has changed I can test that hypothesis that my sample has a different mean by using these confidence intervals that's going to be hypothesis testing that's super important and that's coming up very soon okay thank you

---

## 25. Normal Approximation to Sample Mean
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 5 months ago | **Duration:** 19:41 | **ID:** Arbj9SoU9Cs
**Link:** https://youtube.com/watch?v=Arbj9SoU9Cs

### Transcript:
welcome back so we've been talking about how to use small random samples to infer information about a much larger population and we've seen that the sample mean literally the average of all of our samples xar tells us a lot about the mean of the population mu so we know that this uh random variable xar our sample mean has an expected value that is equal to the population mean mu which means it's an unbiased estimate of this population mean that might be something I want to estimate maybe I want to know you know uh I'm a political polling expert and I'm going to go ask a subset of Americans who they're going to vote for and I want to estimate the the total um you know mean of the entire population okay so we know that the expectation value of xar is equal to the population mean me which is very very useful and we also know that this variable xar has variance um that is related to the population variance divided by the sample size n and so what we know from the central limit theorem okay and and we're going to actually show this and and uh and give a code example and talk about how to use it what we know from the central limit theorem is that this random variable xar is actually normally distributed about a mean value of mu with a certain uh standard deviation or standard error given by Sigma overun n okay so I'm going to write this down formally we're going to say that this sample mean xar is normally distributed it's normal with a mean of mu and it has a variance of Sigma squar / n okay sometimes I use the you know curly n for the normal distribution sometimes I write it out they're the same thing it just means that xar is a normally distributed random variable this is um by the central limit theorem by Central limit theorem really really important result very very useful and we're going to bring back up that code I showed you earlier and we're going to you know now that we have seen all of these properties of xar we're going to reanalyze this and see if this makes sense and so what this means is that xar the sample mean is an unbiased estimate of the population mean with a standard error of Sigma over root n that's what we call the standard deviation of the of the sample mean it's called the standard error um and it's Sigma over root n good um technically the central limit theorem doesn't exactly apply to this case because the central limit theorem would require that all of these random samples X1 through X little n would be independent random samples and for a finite siiz population these random samples have a very very small covariance with each other because if I take one random sample my population shrinks by that one you know one element but if I have large n uh large population size then these are very nearly independent and the central limit theorem is a really really good approximation okay so you might ask yourself how big of an N do I need how big of a sample size do I need you know for all of our intents and purposes you know a big n of you know a few hundred or a thousand is probably fine and a little n of about 30 is a good heris for large enough for the central limit theorem to apply okay let's bring up the code example and look at the properties of this distribution um of the sample mean again now that we've seen all of these properties of xar the sample mean and then I'll show you a little bit more pencil and paper kind of Blackboard derivation of how you can use this to calculate things like confidence intervals how confident are you that the true mean mu is within you know some range of this uh sample mean xar so very very useful properties that we will be able to make very precise statistical statements using confidence intervals based on this uh normal distribution okay let's bring up the code we wrote earlier um I think this is um going to be a lot more in intuitive now that we have seen all of these properties of the sample mean and Sample variance so let's just bring this up okay um this is the kind of full code um from before where we are going to import some libraries you could set the random number generator seed to a constant so that this will be reproducible so every time you run it you'll get the same results I actually want every time I run this to get different results so you can see how things vary um as I change the samples um but remember the basic idea is that we're generating a large population where every element of the population happens to be sampled from A Plus on distribution with Lambda equals 10 so the mean value should be 10 now of course this population doesn't have to have a well-described formulaic probability density like a Pon this could be some gnarly probability density like voter preferences are not probably Pon or gausian or whatever they're probably much nastier than that but just to generate data it's really easy for me to generate um I think you know 10,000 a population where Big N is 10,000 draws from A Plus on random process okay so that's called Data population and then I take samples of size nals 30 and compute the sample mean and Sample variance and here's where it gets interesting remember this xar is a random variable so if I was actually doing this polling I would only get one shot at creating a sample and using these statistics to infer something up here but because this is a simulation and it's very very cheap to run I can draw a random sample once and then I can do it again and again and again I can draw this this this random sample of size little n a hundred times I can do a hundred of these random samples and I can look at the statistics of this sample mean xar that's what we're going to do here so m is how many times we draw these random samples of size little n um so our random sample size is 30 and we're going to do this 100 times to get a distribution of xar and then we're going to plot we're going to plot the histogram of xar that's this pink histogram here and we're also going to plot the normal approximation this Central limit theorem normal approximation with mu and sigma squ Over N okay and if in fact you can even see it the standard error here is computed um Sigma over root n and that's what we're going to use for our our standard normal so let's run this and see okay so this distribution this histogram is our um actual distribution of the actual computed X bars doing this you know random sampling procedure a 100 different times so you know I'm getting statistics on xar again in the field as a statistician you don't get to do this 100 times to get statistics on xar you have to trust your derivations and your math about how this this behaves but here in simulation we can do this a bunch a bunch of times and then you see this yellow curve here that is our normal distribution from the central limit theorem it actually looks pretty good it's not a bad approximation let's run this a few more times and just see how this changes okay I ran it again still pretty good I run it again still pretty good you can see that there's you know discrepancies it's not perfect but it's pretty good it's believable okay now how would I make this Central limit theorem approximation even better well I could increase the size of my population but I already think big and being 10,000 is big enough so I think my population's big enough I can make this a better approximation by having a slightly larger sample size so if my sample if I go from 30 to 100 so now I'm sampling more of my population then my central limit theorem approximation should be better so I'm going to run this a few times okay now this is my central limit theorem approximation let's do it again okay again now I think the other thing I want to do to show that this converges is increase the number of times I'm averaging over to make my histogram because that'll make my histogram smoother so so let's actually make this a lot bigger so I want more resolution in my histogram of xar so I'm going to run my simulation of random sampling a thousand times sample size is 100 and I'm going to run you know I'm going to get a thousand values of xar by repeating this process a thousand times and on a modern computer this is fast so I'm just going to do this and now we see that we have this beautiful um gausian normal distribution almost perfectly a with our actual histogram for xar so this is the power of the central limit theorem if my sample size is big enough let's say bigger than 30 but 100's better um you know 200 would be better still if my sample size is big enough and my population is is even bigger then the statistics of xbar xbar will be distributed as a normal variable with mean mu the population mean uh and variance Sigma squ over n where Sigma squ is the population variance and little n is the sample size beautiful agreement Central limit theorem super super powerful you can play around with this yourself and you know try smaller ends see how small you can make the sample size make this you know 15 or 10 or seven see how small you can make the population size see how these things vary um you know I would keep M big because that gives you a lot of resolution uh because you can run a bunch of of these vir ual experiments on a fast computer okay um good okay that was kind of what I wanted to show you here so now I'm going to go back um to the board and I'm going to show you how you use this property to calculate things like confidence intervals For You Know How likely is it that me is within xar plus or minus you know Sigma over root n or something like that okay so you ask probabilities like that okay good um and so I think the way I'm going to do this is I'm actually going to relate this random variable xar with this mean and this variance I'm going to normalize xar so that I can relate it to properties of a standard normal variable and maybe I'll just do this in uh in green so if I take xar minus mu sorry it's so squeaky xar minus mu divid Sigma overun n ided its standard error this should be normally distributed with mean zero and standard deviation one and this is a trick we've done over and over and over again is if we have a random variable that is gausian normal with a mean and a standard deviation you can subtract the mean divide by the standard deviation and it be becomes normal uh centered at zero with standard deviation one again sometimes I use this notation totally equivalent okay and here I have lookup tables and function calls in Python where I can compute things really really easily for the standard unit normal so what we're going to do is we're going to write something like um the probability that uh xar minus / Sigma /un n is less than or equal to some value a is going to converge to the cumulative density function of this standard unit normal this V function of a as n goes to Infinity for large n this is going to be a very good approximation remember where this is the CDF the cumulative distribution function for a normal variable means zero standard deviation one or the probability that um Z is less than or equal to Alpha for Z normal 0 to 1 okay this is something we we already know about this Fe function it's the cumulative distribution for a standard unit normal that's why we want to normalize xar so we can compute things in these easy Fe functions uh and so the probability this this is a way of normalizing it and this allows me to compute things like confidence intervals like the following this is a really really useful thing I can I can compute with this so what I actually want is I want to know what is the probability that xbar minus mu is less than some Epsilon value okay that's what I really want to know there's some true population mean me and there's my estimate xar my sample mean what are the probability what's the probability that my error is less than some threshold value Epsilon that I am willing to tolerate this is something I want to actually calculate this is how we build what are called confidence intervals for how confident are we that me is within xar plus or minus some wiggle room okay and I'm going to have a whole lecture on that the next lecture is going to be about confidence intervals I'm just going to sketch how you would do it here okay so this um is equal to the probability that um xar minus mu is either greater than minus Epsilon or less than positive Epsilon this is true and now we can relate this to Something in terms of the standard normal this is equal to the probability uh that my Z variable xar minus mu over Sigma root n uh let's just do this Sigma root OT n less than or equal to my Z variable which I'm going to call xarus mu/ Sigma TK n less than or equal to Epsilon Over sigun N this is equal basically to the probability that now I I I'm in the standard unit normal coordinates this is my Z variable so this is essentially the F function Fe of this value minus V of this value it's F of Epsilon over Sigma root n minus V of minus Epsilon over Sigma root n and I'm going to draw a picture here to convince you of this okay so I have uh my standard unit normal let's just do this okay and essentially there is some value Epsilon here so there's some you know minus Epsilon and there's some plus Epsilon and what we're looking at is you know what is the probability that my error xar minus mu is between minus Epsilon and plus Epsilon okay um and essentially what we do is we warp this into standard unit normal coordinates by dividing by the standard error Sigma over root n so we kind of warp this into this coordinate system and then it's the cumulative distribution function of this value minus the cumulative distribution function of this value I can literally draw that this equals um this minus this let's just draw this it's this cumulative distribution function where I include this left tail over here minus this cumulative distribution function where I evaluated it at minus Epsilon so this area minus this area equals the area between these two this is the CDF um of this plus Epsilon normalized minus the CDF of this minus Epsilon normalized and this is how you can compute the probability that your your error in your estimate is within some tolerance value Epsilon okay very very useful and it's related to things that we can compute and care about like the you know standard deviation of the population Sigma and the sample size n so I can actually make Epsilon smaller by making n bigger for example we'll see this in the confidence interval example in the next lecture but this sketches out why the central limit theorem is so powerful because it doesn't just say that the expected value of xar is Mu it allows me to compute the probability that my error is within a certain tolerance range often times we say you know 5% or 2.5% or 1% are kind of the acceptable error and then you can back out how big of a sample n do I need given an estimate of my population variance okay technically I don't have access to Sigma this is something I don't know but I do have access to Sigma hat the sample standard deviation the sample variance of Sigma hat squared and I can relate um the standard error of of xar to this computable quantity Sigma hat Square we did that in a previous lecture so technically that's actually what you would use to get an estimate of how large n has to be for this to be within some expected error okay good anything else I want to tell you um just big big big picture my sample mean xar by the central limit theorem is a normal distributed random variable where its mean is the population mean and it has a standard error or a variance that's related to the standard deviation or variance of the population those are very very useful properties for quantifying the error in my estimate how close xar is to me we can actually put very very tight bounds on that because of the central limit theorem super super useful in the next lecture we're going to uh formalize this idea of a confidence interval how confident are we that mu is within Epsilon of xar we can uh kind of formalize that notion of a confidence interval that's coming up next thank you

---

## 26. Sample Variance in Random Population Sampling
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 5 months ago | **Duration:** 11:38 | **ID:** yNnUVHfX5yQ
**Link:** https://youtube.com/watch?v=yNnUVHfX5yQ

### Transcript:
welcome back okay we're talking about random sampling of an unknown population so we take a random sample of that population we compute sample statistics like the sample mean and Sample variance and hopefully we can say something about that larger population from properties of that random sample we've already looked at the sample mean xar extensively so we know that the sample mean xar is an unbiased estimate of the population mean mu and we also know how the variance of xar behaves for example with the size of the sample and things like that but we haven't looked very much at the sample variance Sigma hat squar we don't really know where this comes into play for example does Sigma hat squar also provide an estimate of some quantity we care about is Sigma hat squared related to the the population variance Sigma squ what else can this tell me about the variance of xar the population variance things like that so just like to analyze the sample mean we looked at its expected value and variance we can do the same thing with Sigma hat squar so we're going to start by looking at the expected value of Sigma hat squar and we're going to see what is it an an unbiased estimate of what is it what is it estimating and we're going to use this fact here that we can write down Sigma hat squared in terms of a sum over my random variables x i and xar so I'm going to use the second formula here this is 1 over little n the size of my sample times uh the sum over every element in my sample uh X IUS xar the sample mean quantity squared equals 1 / M sum uh of x i^ 2 - x bar^ 2 okay this is actually the expression I want here so let's just double check that I didn't mess anything up um this is correct and we're going to take this sum and plug it in to this expected value here okay so I know that I can pop this constant out of the expected value so it's going to be 1/ n expected value of this sum and the expected value of a sum is the sum of all of those expected values so it's the sum of a bunch of expected values uh this is IAL 1 to n and it's the sum of the expected values of all of these quantities of uh x i^ 2ar - x bar^ SAR good and of course I can write this as the expected value of x i^ s minus the expected value of xar squ I can split this up into even smaller pieces so we're going to use a property that you know we should be really comfortable with that was the definition of variance actually down here the variance of a random variable X is the expectation of of x squ minus the expected value of x quantity squared this is different than this this is the expected value of x it's it's mean squared this is the expected value of the random variable x^2 these are these are different quantities and this is a formula for the variance we used this before okay so we're going to use that to get an expression each of these is an expected value of an X squar so each of these we're going to write as a variance plus expected value of quantity X quantity s you'll see when I write it out okay so this equals uh I'm going to give myself a tiny bit more room 1/ n Su I = 1 to little n of a bunch of expected values now the expected value of x i^ SAR again is the variance of XI is VAR x i plus the expected value of XI quantity squared that's this term here that's the single expected value of XI squ is variance of XI plus expected value of XI quantity squared minus this thing here minus same exact thing variance VAR of xar Plus plus the expected value of xar quantity squared okay now why am I making seems like I'm making my life a lot more complicated here but the nice thing is that I know I have an expression for the expected value of any of my random variables I have an expected value of xar and I have an expected value sorry I have a variance of xar I know all three of these quantities so this is going to be much much easier to work with Okay in fact I also know the variance of xar so let's actually write down all of the things we know the variance of any individual sample XI is the population variance because it's sampled from the population so this is uh Sigma squ the expected value of any XI is Mu so this is Mu quantity squared this is a mu^ 2 the variance of xar that was a little nastier for for finite Big N we have the this expression for VAR X which is uh Sigma squar over little n times our correction factor 1 - little nus1 over big n minus one that's VAR xar we derived that in a few a few lectures ago so you can go and you know check that out and then the expected value of xar is again the population mean mu xar is an unbiased estimate for Mu so expected value of xar Is mu and if I square that I get a mu^ squar so now I can write down this whole expression here this equals 1/ n time the sum I = 1 to little n of these M's cancel so I get a sigma 2 minus Sigma 2/ n * 1 - little n minus one over big n minus one okay and the sum notice that there's no index in here anymore every single term in here has the exact same value this value here so the sum over all of this from 1 to n is just n times this that cancels out that n and so this is literally just um Sigma 2ar Over N times this guy needs to pick up an N - 1 - little nus1 over big n minus one now we're just doing algebra uh and that equals Sigma 2ar Over N times this correction factor here okay so the expected value of my sample variance is related to my true population variance times you know some factor that has to do with the sizes of each of these population and Sample so this is really really interesting this this tells me a lot this means that I could build an unbiased estimator of my population variance by essentially taking my sample variance and multiplying it by the inverse Factor here that's really really useful and in fact I think I'm going to um to write that down immediately and maybe I'll do it in blue so if I look at um the expected value of I'm going to just invert this thing somehow um yeah of little n * Big N -1 over big n * little nus1 * Sigma hat squared you can convince yourself just plug this plug this in and you'll see everything cancels the expected value of this is our population variance our population variance which means that this quantity here is an unbiased estimate this is an unbiased estimate of Sigma squar remember we're trying to estimate things about the population like its mean and its variance from things we can actually measure from this smaller random sample and this says that if I have my sample variance If I multiply it by this correction I get a good estimate of my population variance so this quantity can be useful to estimate the variance of my population if I adjust by this correction factor and similarly remember we were looking at the variance of xar so VAR xar uh that's a really important quantity because it tells us how uh how kind of accurate our our estimate of population mean is if we use the sample mean so small variance means this is a very good estimate of mu the variance of xar um could be written as Sigma hat squar over little nus1 * 1 - and again you can convince yourself um that this is also true this is just Sigma hat squar times uh this quantity here now remember we already had an expression for this variance we said it was um sigma^2 over little n * 1 - little n -1 over big n minus one we already had you know this expression here but this was in terms of the unknown population variance if I didn't know that population variance I couldn't estimate the variation of my sample mean here this is written in terms of something I do have access to I can calculate this this is unknown this I can calculate from my sample so the sample variance Sigma hat squar tells me really really useful information about the population variance as long as I multiply it by this inverse factor and it also tells me something about the variance of my sample mean which is also very very useful okay so this is um you can kind of convince yourself that these are true just plug these in and you know write this out on a piece of paper and make sure you believe it but this is really useful too so now we've analyzed the sample mean and the sample variance and related that to important properties of things we care about now the only thing we haven't looked at is the very of the sample variance that could be interesting too you could write out you know a formula for that yourself that might be a cool homework exercise is you know just actually write out the the variance of Sigma hat squar and then try to think about how does that actually relate to quantities you care about Now spoiler alert if Sigma hat squar tells me something about the population variance the variance of Sigma hat squ is going to tell me something about how good of an estimate that is how much spread there is between uh this estimate and the actual population variance okay thank you

---

## 27. Random Sampling Without Replacement (Finite "n" Correction)
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 5 months ago | **Duration:** 12:15 | **ID:** IDvp3pMm16k
**Link:** https://youtube.com/watch?v=IDvp3pMm16k

### Transcript:
welcome back in the last lecture we showed that when we're looking at a sample a random sample of a large population you can look at the sample mean which means the average of all of your samples and that sample mean xar will have an expected value which is equal to the population mean and we also computed the variance of this random variable xar uh and show that the random variable xar has a variance which is approximately equal to Sigma s/ n where Sigma squ is the population variance and N is the size of my sample little n is the size of my sample and this is useful because what this means is that if I have a big population I can kind of draw a random subsample and say something useful about that population in terms of the uh sample mean xar okay and last time I mentioned that this formula for the variance of xar being Sigma squ over little n is an approximation for very very large populations when Big N the size of my population is really large and today this is a very technical video I'm going to show you how to compute the the um variance of xar not assuming large population size and we're actually going to get and derive this finite size finite population size correction term here so this is kind of a technical video but I think it's useful to see uh what assumptions we're making and you know how you would actually do this if you had a modest population size and remember if the expected value of the sample mean xar is me I want its variance to be as small as possible because that means that there's not much spread in xar around that expected value of me and of course I want my my sample mean to be a good estimate of my population mean okay so let's dive in um the big issue last time was when we wrote down the variance of xar we plugged in this sum into this variance and we made the assumption that the variance of a sum is the sum of the variances and that's only true if each of these XIs are independent variables but for a small population every time I I pull one sample every time I I you know measure one of these members of the population my population actually gets smaller for the next sample and then it gets smaller for the next sample and so on and so forth and that introduces a small co-variance between the elements uh of this random sample XI so I'm going to write down um kind of a little Lemma that is going to be important when we write down this expanded more correct version of this variance formula so the Lemma a LMA is just like a little theorem a Lemma this Lema is that the co variant of x I with XJ if I have two random uh variables x i and XJ and they're in the same sample then this covariance is going to equal minus Sigma 2 over big n minus one okay um if this is important if I does not equal J if I equals J then um then the covariance is just Sigma squar they're you know exactly co-varied uh and then how can I understand this this is actually a beast to prove and it's it's worse than what I'm just about to do um and I it's in my notes you can you know I'm going to have a copy of these PDFs uh online you can follow the details you know this is in books it's um it's a technical result that's you can prove but it's it's messy I want to give you the thumbnail sketch of why this is true the thumbnail sketch is basically uh um if you know if XI is sampled and let's say x i equals one of these little X's then new population is um has size n minus one it's a little bit smaller and the value of this random variable is less likely for the next random variable I've already if this one you know let's say that I'm polling people and they can say yes they're going to vote for this person or no they're not going to vote for this person if I've already sampled someone that was a yes vote the pool of yes votes is a little bit smaller for the next sample XJ um and the probabilities change a little and that's as much as I want to tell you about this right now this is just the intuition um this Lemma is true you can prove Pro it it's kind of a mess you have to do um a lot of conditional probabilities to do it and you know maybe I'll do that in a future video but just take for granted that the co-variance between these there is a small very small this is a very small covariance because n is still bigger you know n is Big N is still we assume that my population is not tiny so this is still you know Sigma Square divided by a relatively big number so the covariance between two random samples is small okay let's get into the proof so we want VAR uh the the the variance of xar and so variance of xar VAR xar technically is the co-variance of xar with itself this equals co-variance of the sample mean with itself and here I'm going to plug in this sum I'm going to plug in the the sum into both of these terms of the covariance so this equals the co-variance of 1/ n some I = 1 to little n of x i 1 / n sum I'm going to change the uh the index from I to J um of little XJ and now this is absolutely true there's no approximations being made this is true and if all of these X's are independent I.E if n is really really big then um then this will simplify a lot um to this expression but we're going to assume a small Co here okay so I can pop each of these 1/ n's out and this equals 1/ N squared times now this one I actually can just sum up all of these covariances this is the sum um from IAL 1 to little n from Jal 1 to little n of the co-variance of every x i with every XJ okay this is also true this is just a property of covariance go back and remind yourself that this is this is possible and legit okay good and so now what I'm going to do is I'm going to split this up into the case where I equals J in fact you know so they're equal and then we just return a variance and then I'm going to add up all of the cases where I is not equal to J so this equals 1/ n^2 time uh there are exactly n cases where I equals J so this is the sum from IAL 1 to n of co-variance of x i with x i plus the sum over all other cases all n^2 minus n where I does not equal to J of this covariance of x i XJ good now this is where it gets a little easier this expression here is just I have n copies of just the variance of XI of VAR XI because coari of XI with itself is just the variance that's how it's defined and here I have n * N - one I have n time nus one that's how many of these elements there are in the sun that's how many ways I does not equal to J is n * n minus one times this expression here for the coari cuz all these covariances are identical actually they're all equal to this times minus Sigma SAR / Big N minus one okay times all of this stuff okay and so now I can actually write out this and now it's just a matter of um simplifying and adding things up and of course VAR of XI this is just Sigma squar because we know that the variance of any indiv idual element is the V is the population variance so this equals uh 1/ n^ 2 * n Sigma 2 plus uh n little n * n -1 over big n minus1 * Sigma squar and there's a minus here so I can probably just uh this is going to make a mess um but this is a little minus here okay so I can pop my Sigma squared out this equals uh Sigma squared I in fact I can pop my Sigma squar out and each of these has a little N I can pop that little n out so I get Sigma 2qu Over N Time 1 minus little n minus1 over big n minus one and I sure hope that's my correction that is my correction good good okay so that's essentially the correction factor using this Lemma that these XIs and xjs are the slightest bit covariant for a finite population size Big N okay so this is how you would manipulate these things and get the right answer um I still haven't proven this it's really a mess and I don't think it's worth your time uh for me to go through two boards you know deriving this it's in the notes you can convince yourself it's true um if I wanted to just do the absolute rist sketch of why this is true we can write out the co-variance of x i XJ we can write um co-variance of x i XJ is equal to the expected value of x i and XJ of this random variable minus the expectation value of x i times the expectation value of x J This Is mu and this is Mu so this thing is obviously mu^ SAR and I'm going to claim this is very hard to compute but I'm going to claim that it's equal to uh mu^ 2 minus sigma^2 Over N minus1 okay and this thing you can compute this it's a real pain to compute this but you technically can compute the expected value of the product of two random variables and you can go through all the conditionals probabilities and and work out that it's equal to this thing and then you'll get your answer okay it's in the notes you can do this yourself but if you take for granted that XI and XJ have a very small covariance because if you remove XI from the population it changes the probability of XJ in a certain way if you take for granted this is true you can get this nice finite n correction to your variance of xar okay and that's useful we want to know what the variance of xar is because we hope that as little n gets large in fact as little n getss large this variance of xar gets smaller which is good because that means that as our sample gets bigger xbar our sample mean becomes a better and better estimate of the population mean mu okay thank you

---

## 28. Random Sampling in Statistics: Expected Value and Variance of the Sample Mean
**Channel:** Steve Brunton | **Views:** 15K | **Date:** 5 months ago | **Duration:** 16:07 | **ID:** Gg3d-rn9eEU
**Link:** https://youtube.com/watch?v=Gg3d-rn9eEU

### Transcript:
welcome back okay so we're talking about the theory of random sampling to say something about a large but unknown population in terms of a random smaller sample of that population this is useful all over in statistics and this is kind of an entry point to more advanced uh topics so we showed last time that you can have this population um which is kind of a large population its PDF may or may not even be known but it a mean and and a variance and then um the sample statistics if I take a subsample a little n subsample of that big n population those samples become random variables and the average of those random variables xbar um is hopefully an estimate of the population mean mu so the kind of uh sample mean should be a good estimate of the population mean under some circum ances and we can also compute things like the sample variance and so on and so forth so this opens up a ton of questions um all kinds of questions come up so question one um does the expectation of xar does xar equal mu we we've kind of hinted that this sample mean should converge uh to me in the as as little n gets bigger and bigger as my sample size gets bigger but can I actually show that the expectation of this random variable is in fact the population mean mu that would be very useful we're going to do that today another question um what is the variance of xbar meaning we we have a pretty good gut feeling that this sample mean should be gausian distributed for reasonably large n we know that from the central limit theorem this should be kind of normally distributed hopefully with a center around the true mean mu but what's the variance of that distribution is it a fat distribution is it skinny we want the variance of xar to be really really small because that means xar is a really really tight estimate of mu so this has implications um about the convergence of these values with n how fast is xar converged to me how efficient is it things like that there's questions you know are is there a bias is it is the expectation of xar mu plus some constant Offset you know is there any bias in my estimates those are all powerful statistics questions we're going to ask and answer those for this very very simple case of simple random sampling to iner things about a population but these questions hold much more generally in statistics in data analysis and even in machine learning okay does my you know if I sample data do I converge to a good model of a much bigger complex process okay good so we're going to jump in uh and we're going to start with the expectation value because that's always easier to work within the variance because the formula is simpler than the formula for variance so we want to show that um the expectation value of xar equals mu meaning that xar is an unbiased estimate of mu so we say that xbar is an unbiased estimate of mu this is statistics language for the expectation value of xar equals mu and there's no constant error so the x xar is unbiased meaning it it converges its expectation value is exactly mu okay so we're going to prove this now this is pretty easy to prove uh maybe I will do this in green so the expectation of xar um is literally I'm just going to plug this in to the expectation this is equal to the expectation of 1 / n sum I = 1 to n of each of my random variables XI now we know that we can pop this constant out and this the expectation of a sum is the sum of expectations so this equals 1 / n sum I = 1 to n um expectation of each of these XIs here's a really important fact that I need you to to believe and to know and I'm just going to write it down here the E for any uh for any individual X for any individual uh indiv individual sample XI the expected value of XI is equal to Mu uh and the variance of x i is equal to Sigma squ where mu is the true population mean and sigma squar is the true population variance this is super important any one of these individual samples it's expected value is mean mu and its expected variance is Sigma squar where those are the population values you can actually convince yourself of this pretty easily you can write down this expectation value um this I'll just do it for for the expected value and you can convince yourself also for the variance um this is the sum over every single possible n over all of the big n uh J equal 1 of all of the little values X J times the probability that my random variable x i equals little XJ that's just the definition of expected value of this random variable it's the sum over all the possible things it could be times the probability that it is actually that thing and there are each of these um the chance that I drew any one of these for x i is just 1 over n that's the probability so this equals the sum over uh big n of little X J * a probability of 1 over big n this is the definition of my population mean it's 1 / n times the sum of all of those little XIs so you can convince yourself anyway that each of these random variables each of these XIs their expected value is Mu and their expected variance their variance is Sigma squar you can think about it because each of these X's is pulled from this population so you can kind of say that uh x i is distributed according to whatever the distribution of my population was okay whatever my population distribution is each of these XIs is randomly sampled from that population distribution so anyway this let's go back to to what we're trying to show we're trying to show that the expectation of xar equals mu so we take our sample mean xar we plug it into this expectation and it's the sum of all of these little the the these random variables x i * 1 over little n the constant pops out the sum of an expect the expectation of a sum is the sum of the expectations and now each of these expectation values is Mu so I have um essentially this equals uh 1/ n time the sum of IAL 1 to little n of mu each of these is equal to Mu this is n * mu * 1/ n this whole thing just equals mu the expected value of xar is equal to Mu very very cool this means that xar the sample mean is an unbiased estimate uh of the population mean mu and hopefully as n gets bigger and bigger this expected value um sorry the this distribution of xar gets Tighter and Tighter and Tighter around this expected value you good um maybe I'll just draw a little picture so um probably I have some population distribution and I'm actually going to draw it to be kind of gnarly um but let's say it has some mean value some mu the sample mean xar by the central limit theorem we'll prove this later but by the central limit theorem xar is going to be a normally distributed variable about its expected value of mu so xar should be normally distributed with its expectation value centered around mu and we want xar to get Tighter and Tighter and Tighter we want the spread of possible X bars to be really really small around this value of mu as n gets larger that spread of course is related to the variance of this uh of this xar quantity so now let's talk about what's the variance of xar okay variance of xar tells me how good this estimate is for um increasing sample size little n okay good um this result makes intuitive sense now let's talk about the variance uh of xar so I'm going to actually prove a slight approximation what I'm going to write down is not the exact variance of xar it's an approximation to the variance of xar making an assumption that each of these X's is independent now remember we sampled without replacement so every time I drew a sample my population got a little smaller that technically builds in a small amount of dependence between these variables but for really really big and for really really big populations you can kind of assume that these are are independent and that's what I'm going to write down here and then I'm going to write down the correction for finite n for finite population size so this is an approximation uh this equals again I'm going to plug in this expression into xar this equals the variance of the sum VAR of 1 / n * X1 plus dot dot dot plus X little n and I'm just going to again remind you this is uh um this is if if these are independent samples then I can say this this is um actually sorry if they're independent samples then I can split these into the sum of a bunch of variances so I'll wait I'll I'll I'll wait to write down my Independence assumption in a minute um so my 1/n pops out as a 1 over n^ 2 that's how variance of a constant times a variable you can pop that constant squared out so this equals 1 over n^ squar times the variance of this sum and that is the sum of the individual variances that is VAR X1 plus dot dot dot plus VAR xn now I've used this assumption this is true if my X eyes are independent and that's true for very very large population size and much much greater than one like n a million or 100,000 or 10,000 this is going to be a very good approximation technically there is joint co-variance between these variables and so this step is actually not exactly true it's really kind of this is approximately equal to this for very large population size so be on the watch for me making those kinds of approx IM again we're trying to compute the variance of our sample mean we want that variance to be small it's equal now approximately to 1 n^ 2times the sum of the variances of all of those individual elements and the sum of those variances each of those variances are the population variance Sigma squar so I can write this now as you know each of these this is just um let's say uh this is n * Sigma s and so this whole thing is approximately equal to n / n^ 2 * Sigma squ that's Sigma squar over n and actually this is the result from the central limit theorem so I want you to go back and and check out that Central limit theorem uh video this is the result from the central limit theorem um that that if you have the sum of a bunch of independent random variables each with their own variance Sigma squar then the sum of those variables would have um this uh variance okay so this is actually all coming from the central limit theorem this is um I guess law of large numbers this is Central limit theorem good now I'll show this in the next video I'll actually go through the Gory details of deriving this in the next video but remember this is only true for very very large n very large population so for finite uh population size Big N technically this VAR X bar there is a correction and again I'm going to derive this in the next lecture there's a correction it's Sigma 2ar over n * 1 - little n minus1 over big n minus one okay and again and this is approximately equal to Sigma 2 over little n when uh little n is much less than big n when I have a really big population um and my sample size is small compared to that really big population then I recover this this very very good approximation to the variance of xar so for small populations and small samples you need this this finite size correction most of the time we're going to end up using this result from the Central limit theorem we're going to assume that our sample mean xar is a normally distributed random variable with mean mu and variance Sigma squ Over N where Sigma squar and mu are the variance and mean of our overall population so this xbar tells us a lot about this unknown population um so measuring this xar measuring all of this sample taking this random sample and Computing this xar the sample mean tells me a ton about the population and as n gets bigger and bigger and bigger this variance gets smaller and smaller and smaller meaning we converge uh to the true population mean with a relatively small sample n okay super cool stuff in the next lecture this is going to be a technical lecture I'm actually going to derive this finite n correction uh to the variance of xar it's pretty technical you can probably skip it if you like but if you want to know where it comes from um all write this out in terms of the co-variances um for the shrinking without replacement population okay thank you

---

## 29. Population Statistics and Random Sampling
**Channel:** Steve Brunton | **Views:** 21K | **Date:** 5 months ago | **Duration:** 23:45 | **ID:** OlkL1YatyHI
**Link:** https://youtube.com/watch?v=OlkL1YatyHI

### Transcript:
welcome back so we're just starting to talk about statistics um and we've introduced a lot of probability in previous lectures now instead of having a model for the probability of some event happening what we're going to do is collect data and see if we can infer things about that unknown probability distribution so the first uh kind of piece of the statistics puzzle that I'm going to present to you is the notion of randomly sampling from a distribution sometimes this is called survey sampling uh because this is how you would for example let's say you wanted a distribution of the heights of Americans you could go randomly sample a few thousand Americans measure their heights and hopefully you could say something about the much larger population from that small sample same idea with political polling you don't want to ask you know and you can't ask all you know 300 million people what their political preferences are so you try to do some random sampling of the population and you use that to infer um the the things about the larger population that you would like to know but it's too expensive to measure okay and so that's the notion here is that there is some large population I'm going to write this uh this some large population and there are actual values for all n of those population numbers if if this is the the height of Americans there would be a very large n hundreds of millions of people people and each of these X's would be an actual um height of each of those people probably measured in feet and inches if this was Europeans we'd measure it in you know um meters and millimeters good okay so there is a large population and the idea is that what we're going to do is we're going to sample a small subset of that large population so we're going to create a sample of that uh of that population and we're going to sample a smaller little n number of those people and and ask them a question or measure their height or whatever we're trying to to infer and each of those samples now is going to be a random variable because I randomly choose one of these big n people and I ask them and so there's some Randomness to how I generate the sample so I'm going to generate a set of random variables big X1 through big X little n where little n is the size of my uh generally much smaller sample okay so my sample size is small compared to my population which is often much larger um and my samples are actually random variables now okay so I should probably say I'm going to walk through kind of some theory about um how these sample distributions and population distributions are related then we're actually going to fire up some python code and generate some data and play around with it and see if our intuition for these things holds okay so the idea behind pretty much all of of Statistics really is can I infer something about a larger population or an underlying process from a smaller sample of data so this means data sample means data and these um X's are are random variables because I'm randomly sampling them from this population good um now things we want to tell about this population the distribution might be something like a gausian normal distribution for things like height um and maybe I would only want to characterize its mean and its standard deviation um or this population might have a really kind of gnarly probability distribution but the mean and variance and standard deviation are still going to be useful quantities so I'm just going to write that up that generally speaking I'm still going to want some mean uh and some some variance uh of this distribution and similarly down here I can compute a sample mean a mean of the sample data and the variance of this sample data and try to relate them or infer uh these larger population statistics and this is just the the intro there's going to be a lot more um building on this idea good okay so let's actually just write down what we mean by the population mean and population variance these are pretty easy to compute so the population mean um so so let's say population what we're going to write we're going to have mu equals literally just the average over all of these values we average them all up okay so it's one over big n that's how many you know elements there are in the population people were you know in the whole population sum from uh I equal 1 to Big N of these little x sub I that's it that's the population mean it's just an average over the population and the standard deviation the population standard deviation Sigma squared this is kind of just like what we defined for probability density functions for PDFs but here we're doing it over this this data we assume our data our distribution is an actual uh set of of numbers not just a function for a probability density so Sigma squar now is 1 /n times the sum again from IAL 1 to little n of the squared deviation of each of these X's from the mean so X IUS mu^ squar okay this is kind of exactly how we defined variance for a probability density function but now we're doing the sum over data and the mean of that data and I'll write down just maybe in uh in kind of orange here that this also equals uh 1/ n * the sum from I = 1 to n of the square of each of these little x i minus the square of the mean okay so the sum uh 1/ n yeah I guess that one over n multiplies both of these and I take the sum just over this x i uh squared guy here okay good um or actually no all of this x i^ 2 minus mu ^2 is in the SU here so anyway this is uh another expression and just like in variant we kind of expanded out um you know we we we expanded this out into all of its terms and canceled some out you can do the same thing here with data I want you to just convince yourself that this is also true good so these are the population statistics um maybe I'll just say population statistics and we also can write down the sample statistics and what we're going to try to do is relate the sample statistics to those population statistics so the sample statistics um are similarly almost identically um defined so our sample statistics are defined as the following so we're not going to use this variable mu or Sigma squ because those are already used so instead what we're going to do is we're going to call the mean of my sample we're going to call this x bar sorry my marker squeaky xar is similarly just the sum from uh the the average of all of these these sample variables so it's 1 over little n * the sum I = 1 to little n of all of my random variables okay so it's just the average of my random variable so you can imagine what we do is we actually grab a random sample so now these are numbers and I can average all of those numbers just like I did in my population and similarly I can Define the sample variance this kind of Sigma hat squared we're going to call it hat because it's not Sigma squared it's the sample variance this is going to equal 1 over little n sum I equal 1 to uh not not Infinity little n um of x i minus the sample mean quantity squared okay that looks pretty bad but that's a little n we're not sampling to Infinity because our sample is never infinitely large it's fine and we want to know can we this is something that we don't have access to we assume that there is some mean and and variance of our population but we don't have access to these we do have access to these sample statistics and what we want to do is see what can we infer about these blue quantities from these pink sample quantities um okay so I'm just about to show you a code of how we actually um you know doing an actual example seeing how these things relate I just want to write down a couple more facts that are going to be really important here um there are big n choose little n possible samples possible samples uh possible random samples and we say that each uh is equally likely now of course that's not really true if you're trying to pull um you know Americans about their voter preferences clearly there are biases in how you draw these samples if you go sample from a public library you're going to get a different cross-section if you call people on phones you're going to get a different cross-section there's all of these these biases that are built into to actual polling and actual sampling we're going to kind of gloss over all of that and just assume that all of these random samples are equally likely it's equally it's easy to randomly access a subsample of the population okay um and this is called simple random sampling so this is called um called simple random sampling this is called simple random sampling and essentially that also there's another assumption here which is every time I draw one sample X1 my population to draw from actually gets one smaller and as I draw my second sample my my population actually gets a little bit smaller so technically this is sampling without replacement um this is without replacement if you have a huge population um like the the number of Americans you know hundreds of millions of people this effect is negligible but if you have a much smaller population if this is a few hundred or a few thousand that you're trying to sample from this finite uh with without replacement um sampling does actually start to change your probability so we'll talk about that later that's just a detail and so there are so many questions we can ask for example it seems like in the limit that little n goes to Big N this sample mean should converge to the population mean so for example this is a random variable um each of these X's big X's is a random variable that means that the sample mean and the sample variance are also random variables they're functions of random variables so this has an expectation value and so does this this has a variance and so does this so what is the expected value of xar does it equal mu is the expected sample mean the population mean what about its variance how tight is that expectation how how how much you know wiggle is there in this sample mean compared to this population mean and how does that depend on little n and big n and all of these quantities really really interesting questions they're going to be super useful when we start characterizing populations uh from sample statistics good so now I want to briefly walk you through a python code we'll have a more chance to go through this later um when we start asking very specific questions and deriving specific answers we'll use things like the central limit theorem to talk about the distribution of this xar uh spoiler alert it's going to be normally distributed this xar centered at me that's going to be a key result uh in the next few lectures so let's uh let's do some coding now and I'll point out actually it's kind of interesting um I haven't really uh coded up probability and statistics for quite a long time I did most of this when I was a teenager in Mathematica so I'm a little rusty in probability and statistics in Python but I knew what I wanted to code up I knew that I wanted to generate a large population and draw random samples and calculate these statistics and in about 5 or 10 minutes with GPT I was able to get this really good skeleton of a code to illustrate these ideas so I'm just going to walk you through this um and then I'm going to end and then we'll dive into these very specific deeper questions in the next lectures okay so first things first um what we're going to do is we're just going to import our basic libraries here um numpy and matap plot lib then what we're going to do is this is kind of the core guts of the code we're going to um I'm going to sample my population out of a Pon distribution you can do any distribution and in fact the power of Statistics is that this population doesn't have to have a well-defined well-defined named nice distribution it could be some gnarly distribution of voter preferences or whatever um but for this example I'm just going to draw this population out of a Pon distribution because then we know the answer it's easy to generate data and it's easy to play around with these means and variances okay so what we're going to do is we're going to create a Plus on um random variable with Lambda 10 and we're going to generate a large population of uh 10,000 individuals 10,000 samples from that plus on distribution okay that's going to be called my data population and then it's really easy to draw a random sample or subsample from that using the uh random. Choice command so we're going to pull a little N subsample Out of My population and we're going to call that data sample and then from this data population um and data sample we can compute the mean the standard deviation um of both of these quantities I should probably have labeled the sample mean is xbar and the sample variance is Sigma hat squ okay so that's what this basic code does let's just run this um and it should actually pop out the answer so the population mean um of those 10,000 individuals is 10.01 186 pretty close to the True Value that was used to generate the data um and we have a population standard deviation here the sample mean that's a much smaller sample the sample mean is very close to the population mean and the sample standard deviation is close but not as close to the population uh standard deviation here I'm I'm outputting Sigma not squ but they're related of course and how big was my n this was for n equals 200 so that's actually already a pretty big sample of my population 200's a lot we know from the central limit theorem that n equals about 30 is close to what we need to start getting um some notion of the population um or some you know some notion that this is going to be normally distributed and we know that as little n increases these estimates should get better that's our intuition and we'll prove that in the next couple of lectures good but these are random variables xar and sigma hat are random variables which means that if I redid this random sample over and over and over if I resampled um from this larger population I'll get slightly different values of xar and sigma hat squ they will you know they they'll have their own distributions so it's pretty easy um to actually you know generate those distributions here I'm going to do that in a minute um I think what I'm going to do first this is um kind of a a side point what I'm going to do now is I am going to take my sample mean and I'm going to assume that that's the mean value of my my Pon distribution and I'm going to generate the best fit Pon distribution for my sample mean and I'm going to plot that against the histogram of my population my actual sample population okay let's run this this is kind of cool um so so the histogram the actual histogram here um it looks kind of metal it's got these weird Peaks here so it's this is one instance of a Pon distribution of my population that's my sample uh sorry my my population distribution there and the best fit Pon from my sample mean is this line This is the pon distribution from my my sample mean okay so I I took my sample mean I generated a Pon distribution and now I'm just plotting the PDF of that Pon distribution don't ask me why it's called a pmf I guess that's probability Mass function um but I call it a PDF and you'll notice that they're not perfectly in agreement but they're close it's not bad okay this is um this is reasonable agreement between my fit and the actual data and at the very top of this code um actually you can see it right down here this uh code has a specific random seed of 42 and so that is to make this reproducible you can run this over and over and over and get exactly the same results if you change that random seed or if you omit that line then the population will and Sample will also change from run to run and you'll get different agreements between these two curves okay so what I really want to do again because xar and sigma hat are themselves random variables is I want to repeat the process of randomly drawing samples I want to repeat this a bunch of times and I want to see how does xbar change from random sample to random sample now in the real world you don't get to do that you just get one random sample maybe this is really expensive maybe this cost a million dollars to collect this data you don't get to do it a bunch of times to look at its statistics so what we're going to do later is calculate what the statistics of xar are from first principles but here I'm just going to show you a plot because we can then in this cheap simulation example we can generate lots of these random samples and generate statistics for xar okay this is um you know an idea that's pretty powerful that in simulation there's a lot of things we can do that we can't do in the real world okay so in this uh version of the code here what we're going to do same basic Preamble but now what we're going to do is for we're going to write a for Loop and we're going to generate a bunch of random samples a bunch of times and we're going to compute these these Statistics over and over and over again so I think my little value of M here is 100 so I'm going to do this 100 times I'm going to draw 100 random samples and here I'm using a smaller n of 30 so these are small random samples of size 30 and I'm going to generate a 100 of these random samples and look at the statistics or the distribution of xar and interestingly this is what we get for the distrib tion of xar now it's unclear from this exact example exactly what this distribution is but we're going to show soon that this is the distribution you get from the standard Norm sorry not standard normal a normal distribution xar is a normally distributed random variable with mean mu you can see that its mean value is about 10 um so xar is a random variable that has that's normally distributed with a mean of mu and we'll calate uh what its standard deviation is as a function of you know little n and things like that so we'll see that as as little n gets bigger this distribution should get tighter in fact I think I can probably plot that now look at the bounds this is from 8 to 11 if I change this uh n to 200 like before we'll see that the bounds got a lot tighter now it's 9.4 to 10.4 so the kind of variance of my estimate of xar got a lot tighter it got a lot closer to Mu when I increased the size of little n my sample size so these are the kinds of things you can do in simulation really really powerful ideas here okay but the idea is that this starts to become normally distributed um I actually don't like my uh seed of 42 so I'm just going to remove this and try to run it again and I'm going to use a larger population of uh 10,000 here let's do this and this is another instance and if I run it again let's see uh I'll get an even another instance of this this random uh random variable xar and the last thing I'll show you now I'm I'm I'm kind of hinting at things I'm going to do in the next lectures I said that this xar is a gausian uh normally distributed random variable with mean mu and some standard deviation so we can actually um compute that normal okay so this is the normal approximation based on something called the standard error which is the population standard deviation divided by square root of N and we can compare this uh distribution here of of XS to the the central limit theorem normal approximation to xar and this is what we get here so you see in yellow this is the central limit theorem approximation of a gausian and blue is the actual distribution of xar doing this random sampling a bunch of of times to get this distribution okay so let's uh kind of zoom out here just um kind of going back we have this notion that we have a large population some large population and it has its own distribution we don't know what that distribution is necessarily we might but we might not and it has its own mean and variance if I can't actually measure all of those variables I might take a random subsample a random sample of a much smaller number little n and I compute its sample mean and Sample variance and what I want to do is say things about the population mean and variance from the sample mean uh and variance and we're going to use the central limit theorem we're going to use simulations um and we're going to use things that we learned in probability before to say things about the population in terms of these sample statistics very very powerful idea Cornerstone of modern data analysis all Al a Cornerstone of machine learning think about this this is data um that you're sampling and you're trying to build some model of a larger more complex distribution from that data this is very very much related to um machine learning as well okay all of that coming up soon thank you

---

## 30. Introduction to Statistics and Data Analysis
**Channel:** Steve Brunton | **Views:** 94K | **Date:** 6 months ago | **Duration:** 22:21 | **ID:** QIXUTsdj_oA
**Link:** https://youtube.com/watch?v=QIXUTsdj_oA

### Transcript:
Welcome back. I'm Steve Brunton from the University of Washington and this is the second half of a new course on probability and 
statistics This is one of my absolute favorite topics in all of mathematics it is incredibly useful. It's up there with Calculus, Linear   algebra and differential equations as one of the 
pillars of how we model the real world especially   how we model systems that are too complex to 
handle with our classical deterministic   methods. So this is the 
overview of the second half of the course on   statistics. We spent a lot of time... by the time 
this video comes out you've probably seen that   there's a whole series on probability -- I'm guessing about 10 hours of lectures on probability theory --    and now we're about to launch into the
dual topic of Statistics. This is where the   rubber hits the road. So probability is all about mathematical modeling, combinatorics, distributions   it's really elegant theory... so I'm actually 
going to write this down... this is all about   modeling uncertainty in the real world, building models and statistics is all about data
 so this is really important for us in the modern machine learning era as data scientists. Statistics is all about taking data and saying something 
about the probability model. So in probability you   assume you have the model, you assume you have 
the distribution that's known, and we don't know   what the samples or the data are going 
to look like, but we want to say what is likely   that's a probability problem. The dual of that, the flip side of that, is the statistics problem where   now we have data, we assume that samples and data 
are known, and we want to infer something about   the underlying probability model, the parameters of the system... something about the system... from data So these of course are kind of dual problems 
they're intimately related and so you need to know   these foundational probability concepts to do good statistics. but statistics is really where we start being able to make powerful predictions, decisions, estimations... and again the basis of modern machine learning is statistical data analysis. okay 
so um this is one of my passions I love this I learned this um you know over 20 years ago when I 
was uh at the University of North Texas from uh Dr   John Quinton Nilla so I want to give mad shout out 
to Dr Q uh again I'm gonna base a lot of what I'm   doing on you know what I learned from Dr Q's notes 
in uh the University of North Texas in fact I was   going back through this the other day uh brushing 
up on some topic like random walks or marob chains   and I actually found one of I think the first 
times I wrote down Igan Steve so I think that   this might have been I was sitting in this class 
uh back you know when I was 17 years old I think   that might be where Ian Steve actually comes from 
so anyway way um you know I want to give a ton of   credit to Dr John Quinton Nilla um who taught me 
essentially everything I know about probability   and statistics um so anything interesting and 
correct I'm saying is probably him anything uh   Incorrect and misleading is probably because this 
is 20 years later um but I'm going to specifically   Take This Modern perspective that what we really 
want to do is start driving towards Big Data and   really complicated or or nasty probability models 
that don't belong to the classes of easy classical   probability models that we have been analyzing 
things like normal distributions exponential   Plus on etc etc those are still super useful 
for tons of real world problems but there are   other real world problems where the probability 
densities don't have a nice analytic close form   uh expression and you have to learn them from data 
using machine learning so this is all going to   build towards that but we're going to start with 
foundational statistics okay good um so so I think   I just want to tell you kind of the outline of 
this class again this was about 10 hours broken   into two modules of intermediate and advanced 
statistics is going to be about the same there's   going to be kind of a core 5 hours that you need 
to know that's kind of the intro intermediate and   then there's going to be Advanced topics that 
are you know special topics and more um more   technical so you can kind of pick and choose your 
own adventure of how much you want to learn okay   but I really want to make this as targeted as 
possible so if you have 5 hours I want want you   to get the best 5 hours of probability or the best 
five hours of Statistics that gets you as close to   being able to use this as possible and if you have 
another 5 hours go deeper and after this there   will be a bunch of special topics things like 
stochastic differential equations marov chains   Moni Carlo optimization for beijan methods machine 
learning there's an unlimited amount of cool stuff   so I'm just going to keep adding for a long time 
hopefully okay let's get into it um so given data   given data of a system some things we can 
do some things we can do this reminds me of   a Deltron song things we can do uh and I'm just 
going to start going in order okay so the first   thing we can do um and we're going to start here 
actually because this is where the statistics is   the easiest just like in probability we started 
from the intro kind of baby steps and then we   worked up very quickly to some pretty advanced 
concepts we're going to do the same thing here   so uh we're going to do something called survey 
sampling so uh we draw a small sample from a large   population so if we draw so this is essentially 
another way of saying you know survey sampling so   this is called survey sampling uh survey sampling 
or polling and um the IDE idea here is what can   we say about the larger population from the small 
sample that we draw and how big is a big enough   sample to say things with statistical confidence 
about this larger population so some of the things   we're going to do for example there is this 
notion of a sample mean if I have this sample   I can take the average maybe I'm uh measuring 
you know um people's political preferences or the   height of an American you know like which clearly 
follows a normal distribution and I might draw   small sample of 100 people to try to say things 
about the larger population distribution so   there's this notion of something called a sample 
mean it's a really cool idea um you literally   take your small sample the the variable you're 
measuring and you take the average value it's   just the mean of your sample sometimes we call 
this xbar and in the last set of lectures in   probability this kind of culminated in something 
called the central limit theorem which showed that   this sample mean from Act ual data tends to be 
distributed as a normal random variable where the   mean of this normal distribution is the mean mu 
of the population of the true population and the   variance of this random variable is sigma^2 over 
n where n is the sample size sample size so this   is the kind of thing you can do with Statistics 
this is kind of where we're going to start off   we're going to take a small sample compute its 
mean and we're going to show with the central   limit theorem that that's a normally distributed 
random variable where mu and sigma squar are the   population mean and variance uh mean and variance 
and N is the sample size of the sample I took to   compute this mean this is incredibly powerful 
and this allows me because I have this variance   here it essentially says that this variable will 
converge to the true mean if I take the average   of a sample it will tell me something about the 
average of my population and the variance tells me   how close to the True Value I am how big 
of an end do I need for this variance to   be small how how much wiggle room do I have in 
this estimate of the true mean for a given n so   this tells me a lot of useful things it tells 
me how I might design an experiment if I want   a certain amount of accuracy or uncertainty in 
my estimate really really important and this is   a simple place to start is survey sampling okay 
good um and this is true for any distribution   of my data it doesn't have to be from you know 
normally distributed Heights I can I can take   samples of um a large population that has some 
weird distribution and that sample mean will   still be a normally distributed random variable 
by the central limit theorem That's The Power of   probability are things like the central limit 
theorem which are extremely General powerful   statements about arbitrary data and distributions 
so that's our starting point um two is going to   get even more interesting okay okay so this 
is just kind of laying the foundation with   some easy math that ties back to probability 
ties data to probability now we're going to   start doing hypothesis testing so testing um 
hypothesis hyp and this is literally called   hypothesis testing um you know and the hypotheses 
there are so many of these you can write down I'm   just going to give a few to give you a flavor of 
the kinds of things we're going to be able to do   really really powerful things um does a drug 
work okay so let's say that there's some new   super drug that is supposed to cure cancer or you 
know cause incredible weight loss uh does a drug   work or not this is something we can test with 
Statistics we can um essentially have a control   group and a treatment group and test if their 
means are different that would indicate that   the drug did something that's a hypothesis we can 
test using these distributions using literally a   normal distribution um did a mark marketing 
campaign work or not um so did a marketing campaign uh did a marketing campaign increase 
web traffic this is just an example um this is   what we call AB testing so this is um 
a testing um in like computer science   where you have you know you do a modification 
you change something about your website and   you see if people click on you know ads more 
that would be a AB testing a drug working or   not this is a control uh versus treatment group 
okay this is kind of you'd have a control group   and a treatment group other things you can do 
um one of my absolute favorites actually um   have been thinking about this a lot lately 
is are two distributions the same are two distributions the same uh and this is what is 
called the kai squar test um is going to tell   us that the kai Square test and the kai square is 
a distribution from probability that allows us to   test a hypothesis using data so that becomes 
statistics um really really important ideas   here about testing hypotheses with data based on 
probability models of how that data should behave   you can test lots of cool hypotheses and this 
again generalizes to machine learning when those   distributions are empirical distributions 
you can really think of machine learning   as having empirical distributions from data okay 
so you get empirical probability models from a   wealth of measurement data so testing hypothesis 
is going to be a big big deal here um and this   also allows you to quantify how significant your 
results are you don't just test these hypotheses   you get like a confidence of How likely the drug 
is to work or not like am I 95% confident in this   result am I 99% confident you get a notion of 
statistical significance uh so you can quantify   how significant uh a result is a result is okay 
um and this leads very naturally into something   called experimental design um super important if 
you are going to run a drug trial let's say that   you think you you have a new super drug or let's 
say that you have a new super composite it's going   to make aircraft lighter and stronger you've got 
a new material or a new drug something new that's   going to be amazing and you need to convince the 
world that it's safe and it works you need to   design a statistical experiment a data collection 
protocol and a hypothesis to test so that you can   convince people with some amount of significance 
of your result and that is all about designing a   statistical experiment to be honest to be accurate 
and to be significant so that you can convince   other people of the effect of some you know new 
drug or new material or new whatever it is okay   so experimental design is super important and The 
Duel of experimental design the significance level   that we quantify in a hypothesis test is usually 
called the P value you've probably heard of the   P value before a p of 0.05 is a statistically 
significant result meaning there's like a 95%   chance that you know I get the correct answer um 
if I if I say something happened and so what that   means is that a lot of people do bad statistics 
called packing where they do bad experimental   design they they do either through fraudulence 
or ignorance they do a bad experimental design   to get a P value that's significant even though 
their experiment was wrong okay so there's lots   of ways of getting significant statistical 
results by doing bad statistics I'm going to   tell you about those pitfalls we're going to 
code this up all of this you know we're going   to have examples in Jupiter in Python we're going 
to actually you know code up because this is data   and testing we're going to build code to do all 
of this and I'm going to show you in code what   packing looks like and what to look out for 
so that you can not fall into those traps of   fraudulence and ignorance okay super important 
stuff um and now the other kind of big part of   this that I want to talk about I think this is 
really really cool maybe I'll go over here so I   have a little more space is this notion of fitting 
distributions and estimating parameters so um kind   of the third big big topic we're going to talk 
about is fitting distributions and I'm putting   it here under machine learning because this is 
really the intro to machine learning fitting distributions uh and estimating parameters and estimating uh parameters good um and so probability essentially 
involves so probability involves the this   probability model this probability density 
probability of X my random variable given some   parameters Theta so I'll just label these really 
quickly so this is my uh data given my parameters   these are the parameters of my probability 
distribution so in the gausian example this would   be the mean and the standard deviation things like 
that statistics is the flip of this so statistics   is all about finding the probability of my 
parameters given my data so it flips this on its   head it's this notion that given data I want to 
find the best fit parameters the best distribution   that fits that data that's the statistics problem 
here and this really is uh very much a basian uh   perspective this is literally the beian inverse 
of this so we're going to use beian ideas a lot   in statistics because we're trying to kind of flip 
the Paradigm where instead of estimating what the   data should look like given a distribution with 
fixed parameters we have data and we're trying   to estimate the parameters from that data okay so 
that's what we mean um and we're going to look at   a bunch of examples here of how to do this things 
like um the method of moments you've probably   seen this before you might have method of moments 
very closely related to this sampling statistics   here you literally estimate things about your 
population from things like the first moment   the sample moment things like that um we're going 
to talk about maximum likelihood estimation Max likelihood uh estimation ml this is a big big big 
topic ml are a super powerful way of turning this   problem into an optimization problem which 
means we get all of the Power of modern   optimization machine learning and data to solve 
this problem so maximum likelihood estimates is   a big deal um and that's this also transitions 
very ni into the beian perspective we're also   going to talk about things like goodness of 
fit and hypothesis testing how good is a fit   so once I've fit these parameters how good 
uh is the fit goodness of fit and hypothesis testing um confidence intervals so once we get 
the estimate of these parameters we can also   give confidence intervals of of of kind of like 
what's the range of theta we think so not just a   fixed Theta but maybe I have a distribution of 
what I expect Theta to be that's kind of also   the beian perspective um I might have confidence 
intervals here uh confidence intervals on Theta   hat my estimate confidence intervals and 
hypothesis testing are really dual problems   related to this P value uh and then we're also 
going to talk about something super important   I'm just going to actually put this in pink 
because it's so important um is this idea of   bootstrapping uh and simulation bootstrapping 
and Moni Carlo simulation uh simulation is the   key word here so often times there's things I 
want to know about my statistical distribution   like I might want to know you know the variance 
of this parameter estimate Theta um and I can't   compute it using pencil and paper analytics so 
I'll actually set up a big simulation a Monte   Carlo simulation to get a bootstrap estimate of 
the distribution of my uncertain parameter and   again this is the basis of a lot of modern beijan 
statistics and beian machine learning is doing   Moni Carlo simulations and bootstrapping so this 
is kind of going to be an advanced topic that   Segways us into how to do computational statistics 
with big data and nasty distributions pretty cool   stuff okay um then I guess we're going to keep 
going I'm almost done topic four uh is going to   be you know all about beijan statistics um beian 
statistics and I'm going to have beijan statistics   kind of woven out throughout these lectures so 
we're going to get you know an intro to B in   this uh statistics module but realistically we're 
going to have a lot deeper dives into Baye later   in my optimization boot camp in physics informed 
machine learning beian Frameworks allow you to   take prior knowledge maybe I know something about 
the distribution or I know something about Theta   or I know something about the physical world it 
allows me to build in that prior knowledge to   these these statistical estimates that's a huge 
Topic in optimization machine learning physics   and for machine learning so this is also going 
to be something we cover a lot more later um a   good way to think about this is probability tells 
me a model of how I think a Fair coin or a biased   coin will behave as a bernui random variable we 
have a model for this and if I flip this coin 10   times then the number of heads is going to be a 
binomially binomially distributed random variable   and if I flip it a 100 times that binomial starts 
to look like a normal distribution by the central   limit theorem things like that the statistic view 
is a little bit different let's say I have this   coin and I flip it 10 times let's say it comes up 
10 heads in a row the Statistics question is do I   think this this coin is fair what do I think the 
probability is of getting heads versus Tails can I   estimate those quantities and those uncertainties 
Bean statistics is a really important way if I   flip a coin and it is heads three times in a row 
some of these statistics methods kind of will fail   and incorrectly assume that the parameter Theta 
of How likely it is to flip ah heads is equal to   one it's always going to flip heads and that's 
bad Bean statistics allows me to bake in prior   knowledge if I just see a coin if I feel a coin my 
prior pretty strong prior is that it's a fair coin   so even if I flip three heads in a row that's not 
going to shake my foundational belief in this coin   being fair it's going to take a lot more evidence 
for me to update my prior and say oh maybe if I   get 15 heads in a row [ __ ] this is probably not 
a Fair coin okay so Bean statistics allows me to   build in a lot of prior knowledge to robustify 
and improve statistics when I have that prior   knowledge now this relies on you having good prior 
knowledge bad priors cause bad statistics and then   you know dot dot dot there's going to be a lot 
more this is going to be more and more and more   so we're going to talk about tons of interesting 
Advanced topics that I find interesting things   like benford's law I love benford's law it's 
incredible uh marov chains uh are ways of kind of   merging differential equations and probabilities 
we'll talk about random walks um we'll talk about   you know gausian processes for again stochastic 
differential equations and and much much more and   Eventually, what we're really getting 
towards is modern statistics and data analysis   which we call machine learning: 
fitting empirical distributions from data.   I'm super excited to walk you through this... 
this should be about 10 hours of intermediate   and advanced topics. This is going to give you a set 
of tools like calculus, like linear algebra, like   differential equation to really model the real world and its complexity and its uncertainty from data  I'm excited to share this with you I 
hope you're excited. Stay tuned for more, thanks!

---

## 31. Proof of the Central Limit Theorem
**Channel:** Steve Brunton | **Views:** 16K | **Date:** 6 months ago | **Duration:** 26:24 | **ID:** nWadI0_u6QU
**Link:** https://youtube.com/watch?v=nWadI0_u6QU

### Transcript:
Welcome back. So today we're going to prove the central limit theorem and this is one of the culminations of everything we've been learning about probability theory. So we're going to synthesize a lot of things we've learned. For example, um the moment generating function is going to be used and lots of other facts to prove uh the central limit theorem which is one of the most important and central results in all of probability. and it's also going to be the foundation of lots of what we're going to do in statistics. So, I'm just going to state the theorem, uh, give kind of some alternative ways of thinking about it, and then we're going to dive into the proof. It's going to be pretty technical. Um, you know, this is kind of an advanced video, and I'll try to link to other concepts um that you'll need to know to build on. So, I'm not going to do a ton of review. I'm just going to dive in. Okay, so the central limit theorem is a surprising result that says that if I have a bunch of independent identically distributed iid random variables x1 through xn then if I take the sum of those random variables and that itself is a new random variable then that sum tends to become normally distributed in the limit of large n large number of of samples or or random variables. So in the the proof that I'm going to do, we're going to assume that each of these n random variables have mean zero and variance sigma squared and that they are all sampled from the same uh identical uh distribution and they're sampled independently. So this could be n coin flips, this could be n samples from a pson distribution, this could be n uh measurements of a physical system, measurements of the speed of light. Okay. Um and as long as that random variable has a mean zero and a variance sigma squared then this is this proof is going to apply. Now notice in my examples um actually the mean is not zero for the speed of light. The mean is not zero for a pson distribution and the mean is not zero for a berni uh coin flip random variable. All of this can be generalized very very easily to a mean mew a nonzero mean. It's just easier to show you the proof for zero mean iid random variables x1 through xn. Okay, good. So, and this is very surprising. It doesn't say what the distribution of these x's are. It just says that they have to have um they have to be sampled from the same distribution independently and they have to have the same mean uh and variance. Good. And so this sum sn is going to tend to be a normally distributed random variable in the large n limit. And so the way we mathematically say this is that the limit of the probability. So this is kind of notice that I'm using this uh big fee function here the cumulative distribution function of the standard unit normal with zero mean and standard deviation one. this S is not going to have uh standard deviation one. Okay? So I'm going to have to normalize it by its standard deviation which in this case is going to be sigma time the square root of n where n is the number of these random variables. So if I take SN divided by its standard deviation sigma time of N then that random variable will become normally distributed um with a standard unit normal mean zero standard deviation one. Um good and this is how we say it. We say that the the the cumulative density function of this random variable converges to the cumulative density function of the standard unit normal. Now there are some equivalent ways of writing this. I'm just going to before I prove it, I want to write a couple of more intuitive ways of writing this. Um, equivalently, you could say equivalently, you could say that uh Sn this SN is normal itself with mean zero and uh variance N sigma squared or standard deviation root n sigma. And that's kind of what we're using here is that if we divide SN by its standard deviation, it becomes a standard unit normal normal 0 comma 1. But Sn itself is a normal with mean zero and standard deviation N sigma squared. And it also says that the the average value of these uh which we're going to call Xar uh and we're going to define this as uh 1 over n times the sum of n. So this is just the average value of all those random variables. This is normal with mean zero uh and standard deviation or variance um sigma squared over n. Okay. So um these are kind of equivalent to this statement here. It's just that what we're going to try to do is show that the uh moment generating function of this random variable is equal to the moment generating function of the standard unit normal. So it's nice to to normalize in the statement of the central limit theorem. But these are completely equivalent statements. And I'll leave it as an exercise for you to show how this changes when we have a nonzero mean. When the mean of these random variables is some mew, how do these statements change? Okay, probably we'll have like a, you know, minus mu here or something like that. Okay, good. Um, so now I'm just going to jump into the proof and it's got a bunch of steps. So I'll go through them and then we'll zoom out and kind of summarize what what the big picture is. Okay, good. Okay, so let's start our proof. And I think um I'll just I'll just start going. So the proof and I want to give myself some room here because uh this is going to take a little bit of space. So I'm going to break this down into steps. The first step is that we're going to show uh is to state how we're going to prove it. Step one basically is uh we want to show that this random variable has the same moment generating function as a standard unit normal. So uh we want to show that the random variable I'm going to call it Z equals this thing SN over sigma root N. Um, and we want to show that that is standard normal with mean zero and standard deviation one. And we're going to show this specifically that by by showing that they have the same moment generating functions. So we want to show that this is true. And uh we will show we will show that they have the same uh maybe I'll put this in pink to highlight it. The same moment generating functions mgfs. And I had a whole set of lectures on the moment generating functions. If you don't remember uh go back and and watch those. But the moment generating function for the standard unit normal, the um m of t for the standard unit normal is e to the t ^2 over two. So we're going to try to build the the moment generating function of this random variable here. And we're going to show that in the n goes to infinity limit, it converges to this, which is the moment generating function of the standard unit normal. And because the moment generating function uniquely identifies the probability distribution, if they have the same uh moment generating function, then they will have the same probability density function. They'll be the same distribution. So this is what we're going to do is show these moment generating functions are equal and we're going to build this in stages. So this is step one is just stating how we're going to approach this problem. Um good maybe I'll just kind of switch colors throughout these different um phases of the proof here. Maybe I'll go to blue. So step two is what I'm going to do now is I'm going to let each of these individual x's have their own moment generating functions. And then we're going to build the moment generating function of this from those individual moment generating functions. Good. And remember we know at least the first and second moments of these moment generating functions. Good. We know the mean and the and the the variance. Good. So now what we're going to do is we're going to let um each of my x i's x i have a moment generating function m of t. Okay, each of these random variables has a moment generating function uh m of t. And they are all the same moment generating functions because they come from the same distribution. They're independently identically distributed. So they have the same pdfs. they're sampled from the same distribution. So each of them have the same moment generating function. And we know this property um that the m the moment generating function of a sum of random variables is the product of each of their r uh moment generating functions. So we know that the moment generating function of sn is the product of all of these n moment generating functions. So this is going to be written as uh m t to the power n. Okay, good. So we're we're doing really good so far. We don't know what the moment generating function m of t is. We're just going to call it some function m of t. But we at least know the first and the second moment. So that's useful. And we know that the moment generating function of sn is just the product of all n of these identical moment generating functions. That's pretty useful. Um okay, good. So now where do I go from here? Okay, just put a little line here so I can keep track of things. Okay, now um step three, what I'm going to do is I'm going to actually tailor series expand this moment generating function and I'm also going to um plug in this uh s over sigma root n. So I'm going to do this correction factor and show what that moment generating function is as well. Okay, good. So I think what I want to do here is now do my uh my tailaylor series approximation. Good. So um step three is we're going to tailor series um m of tailaylor expand m of t. And this is kind of cool because the coefficients of this tailaylor series expansion are in fact my moments. So we can say m of t equals m uh evaluated at 0 plus um t * m prime evaluated at 0 plus sorry my t's look a lot like my pluses plus t ^2 / 2 mp prime evaluated at zero plus dot dot dot dot dot and what I'm going to do uh is I'm going to just call that dot dot dot some uh some number. Okay, so m of 0 the first the zeroth moment is always one. This is essentially if you write this down, it's the sum uh of 1 times the probability. So that all adds up to one. So this equals one. M prime of 0 is just the mean. Okay, so this is also zero. Sorry, this is equal to one. This is equal to zero. Okay, because m prime of 0 is zero. This is zero mean. So if this was mu, I'd plug in a mu here. Okay, this guy is uh t^ 2 sigma squar over 2 because the mean is zero. Okay, so this is uh t^2 sigma squar over 2. And we're going to call all of these higher order terms. We're just going to call this um uh epsilon of order t cubed or higher. Okay, so all of these terms are higher order in this uh this t. Okay, so the third, the fourth, the fifth moments, I'm going to lump them all into this higher order term here. And um what we can do is essentially we're going to you know take the limit as um n goes to infinity and we're going to to show some interesting properties of how this moment generating function behaves. But I can of course also take this and plug it in here and take this to the nth power um if I wanted to. Good. Okay. So step four um there's a lot of steps to this so um bear with me. So now what we have is we have an expression for s our sum in terms of m of t uh the moment generating function of each of these and we can tailor expand each of those m of t's and get terms in terms of the the mean and the variance that we already know and some higher order terms. And so probably I'm going to plug this in here and take it to the nth power. But before I do that, I'm not just trying to show that Sn um is distributed as this normal. I'm it's easier to show that Sn / sigma roo N is the standard unit normal. Okay, so I'm going to have to transform this by dividing by sigma root N. And so there's a little identity that I think you should know here, which is basically if I have a new random variable y= bx, then the moment generating function of y equals the moment generating function of x times uh bt. And so what this implies is that the moment generating function of this uh this Z variable, the moment generating of this Z variable with respect to T is equal to the moment generating function of Sn evaluated at T / sigma N. Okay, so that essentially means that it's pretty easy to find the moment generating function of this Z variable, which has an easier distribution to fit by taking the moment generating function of Sn and plugging in T over sigma root N into this moment generating function. And just the last step because we know that it's equal to this simple m of t ^ n. This is m uh of t over sigma n all of that to the n power. Okay, good. So this is just a useful fact that allows us to take this slightly more complicated expression for this sum and normalize it by its standard deviation. And now all we have to do is show that this moment generating function is equal to the moment generating function of the standard unit normal. Good. So now I can use um this tailaylor series expansion and I can evaluate it at t over sigma / sigma root n and I can take this whole thing to the power n. And so we're super super close. We're basically there. Just a couple more steps uh and we'll have this proven. Good. So maybe I'll do pink now. Okay. So step five, this is where kind of the rubber hits the road is now I'm going to compute this m of t / sigma root n. I'm going to plug that into this tailor expansion. So I'm going to get an expansion for this inner term and then I'm going to take it to the n power. Okay, so m of t / sigma n is approximately equal to this tailaylor series expansion where I plug in this for t. Okay, so this is approximately equal or this is I guess exactly equal to 1 + 12 sigma^ 2 t ^2 over this thing squared which is uh sigma^ 2 n plus epsilon of all these higher order terms which I'm going to say you know there's still order t cubed but I'm just going to write down you know the the the third order term would be like this. Okay, so each of these is going to be divided by like an n the three halves, n the four halves, n the five halves, n the six halves and so on. So this is kind of my higher order terms. And this is kind of bad notation. It really should just be epsilon of t cubed. But I want to explicitly show that each of these terms has a bigger and bigger power of n in the denominator because when we take the limit as n goes to infinity, all of these terms are going to die out. Okay, good. Um these sigma squares cancel. And so this is going to be you know 1 plus uh 1/2 t^2 over n plus this epsilon dot dot dot. Okay all of this higher order terms. And of course this epsilon goes to zero as n goes to infinity. That's the really important part here is that this goes to zero as n goes to infinity. Okay. And now the last step is take this to the power n and take the limit as n goes to infinity. Okay. Um last step maybe I'll do this in yellow. Okay. Step six. Okay. We're going to take this expression to the power n and then take the limit as n goes to infinity. So the limit as n goes to infinity of my moment generating function of z of t is equal to the limit as again n goes to infinity of all of this stuff of 1 + 12 t ^2 / n plus this epsilon let's say epsilon subn n all of that to the power n the epsilon goes to zero as n goes to infinity and so this and it goes to zero fast so this is a technical point that I'm not going to exactly cover but this epsilon n goes to zero fast enough that we can neglect it and this equals the limit as n goes to infinity of 1 + t² 2 / 2 n ^ n. Now you'll remember that the limit of 1 + anything / n ^ n is just e to that t ^2 / 2. So maybe I'll write this down. Um kind of just a fact. Limit as n goes to infinity of 1 + a / n ^ n just equals e to the a. This is a definition of the exponential of a is this formula here. And so this expression here equals e to the power t^2 / 2. That is the moment generating function of my uh my z variable. And notice that the moment generating function of my Z variable is exactly equal to the moment generating function of my standard unit normal. So this is the proof. We've proven it. Um I'm going to put my little square down here. This is a big proof. So we get to use math notation. We finished the proof. Okay. So now let's just zoom out and summarize and make sure we still believe every step and that this makes sense. Okay. So we're trying to prove the central limit theorem that the sum of a bunch of iid random variables becomes normally distributed. So the sum of a bunch of uh iid random variables becomes normally distributed with a new variance that's related to the variance of each of those variables. And the way we state that more mathematically is that if we normalize this sum by its its own standard deviation, we say that that normalized variable z becomes a standard unitn normal variable. And we prove that by constructing the moment generating function of Z and showing that it converges and equals the moment generating function of a standard unit normal in the large N limit as N goes to infinity. Now we've done this for a mean zero, but you could also substitute in a mean equals mu and go through all of these steps and convince yourself that this is still true and modify these. That's a really good exercise for you to make sure that you understand the mechanics of what's going on here. Okay, so the steps now are to somehow construct the the moment generating function of Z and um and show that it converges to the st to the moment generating function of a standard unit normal. So the moment generating function of Z is related to the moment generating function of this sum Sn. And the moment generating function of my sum is the product of all of the moment generating functions of each of these X I. because they're IID, they have the same moment generating function. So the moment generating function of Sn is just M to the power N where M is the the MGF for each of these random variables. Good. This is kind of the the simplest step here. Now what we're going to do is we're going to try to get an expression for this m of t and then take it to the power n. And we're also going to have to do a correction because we don't actually want the mgf of of of this sum. We want the moment generating function of this normalized sum where it's normalized by its own standard deviation. We want this this Z variable because it has the simpler uh distribution. Okay. So what we're going to do this is kind of two steps that you could have taken this in either order. Um so first thing we're going to do is we're going to normalize this SN by its standard deviation and we're going to show that um the moment generating function of Z is equal to the moment generating function of S where you now evaluate it at T / sigma root N. So this is a nice easy expression here. You just are relating Z to SN. And similarly, we're going to tailor expand this little um simple moment generating function of my xi. Um and the moment generating function, if you tailor expand it, this is super cool. The coefficients of that moment generating function are the moments themselves. So the coefficients of the tailaylor series expansion, you'll notice this is the zerooth moment, first moment, second moment, and so on. So that's another intuitive understanding of what these moments mean is that they're coefficients in my tailaylor series expansion. Okay, so now we take all these pieces together. Um we can compute the um this expression for our Z variable is just all of these little m of t's evaluated at t / sigma root n taken to the power n. So so now we're taking these two facts and we're kind of plugging them into here. Okay. Um and what we're doing now, let's see where we have that. Um so we take this tailaylor series expansion we evaluate it at this t / sigma root n and we can expand this thing out and find this very very simple expression for the tailaylor series expansion of this individual normalized element. Um and this epsilon are all of the higher order terms in my moment generating function. And you'll notice that they all have bigger and bigger powers of n in the denominator. So these are going to go to zero as n goes to infinity. Finally, we plug all of this in to our expression for this moment generating function of Z, which is uh the moment generating function of each little element to the power n. We take the limit as n goes to infinity. And we have convinced ourselves that this epsilon goes to zero very very fast because it has big powers of n in the denominator. And we're left with the limit as n goes to infinity of 1 + t ^2 / 2n all of that to the power n which is exponential e to the t^2 / 2. And because z and our standard unit normal have the same uh moment generating functions that means that they have the same probability distribution function the same cumulative distribution function and thus we have proven the central limit theorem. Okay. So, I want you to slow down and convince yourself this is true. I want you to ask yourself what happens if the mean of these random variables is a mu instead of a zero. Basically, nothing changes. It's just a little bit more complicated to derive everything. And I hope that this is as satisfying for you as it is for me. This is kind of the culmination of, you know, our understanding of moment generating functions, probabilities of things uh that are independently identically distributed. And this is one of the most important results in all of probability and statistics. We're going to use this all the time when we start sampling data from distributions, like actually collecting data and trying to infer things about that distribution. We're going to use the central limit theorem all the time. So, it's really good to have a really strong intuition and understanding for why this is true and how we actually construct a proof. Okay. Thank you.

---

## 32. The Tail Sum Formula in Probability
**Channel:** Steve Brunton | **Views:** 7K | **Date:** 7 months ago | **Duration:** 9:04 | **ID:** XQYkD_fct1A
**Link:** https://youtube.com/watch?v=XQYkD_fct1A

### Transcript:
PROFESSOR: Welcome back. OK, in the last set
of lectures, we've been proving some pretty
heavy results and properties of random variables
and functions of random variables
like expectation, variance, things like that. And today, I just wanted to
show a fun, interesting property called the tail sum formula. So this is a lot less heavy. It's pretty easy to
derive, and it ends up being kind of a useful formula
and a little bit surprising. So here we go. So this is talking
about the expectation of a random variable
X. And I think it's worth stating
at the very beginning that we are assuming that X
takes on non-negative values. So we're going to say
that X is non-negative. So for example, X could be-- I'm going to do this for a
discrete random variable. X can take on values like 0, 1,
2, dot, dot, dot, and dot, dot, dot, but not negative numbers
like negative 1, negative 2. So for example, the
number of heads, if I flip a coin 100
times, that would be a non-negative
distributed variable. So if x is binomial, that
would be a case Poisson. Most of the examples we've seen,
X takes on non-negative values. So this is pretty useful. And so the tail sum formula says
that the expectation value of X, the expected value of X, is
equal to a cumulative sum of cumulative distribution
probabilities. So I'll write it down, and then
we'll talk about what it means. So it's the sum of
the probabilities that X is greater than
or equal to some value k. k is one of these numbers. And it's the sum from k
equals 1 to the largest value in this set, which is n. Maybe there's not
a dot, dot, dot. Maybe this is a
binomial distribution for the number of
heads that you expect to get if you flip 100 coins. So X can't be bigger than 100. So this would take
values from 0 to 100. So there's an upper
limit to the values that this random
variable x can take. So we sum over all of
those possibilities. We sum this formula here. And specifically,
this is 1 minus the cumulative distribution
function evaluated at a value k. Now, why is this true? This is not obvious at all
that this should be true? The expectation value is usually
written totally differently. So what I'm going to do is I'm
going to dot, dot, dot, dot. And I'm going to
actually just write out this expectation, the
old fashioned way, the way that we're
used to writing it, and then show that you can
get an expression that's equivalent to this new way of
calculating the expectation value. So the idea is
the expected value is typically written as the
sum from k equals, let's say, 1 to n. Let's say 0 to n in this
case because it starts at 0. It doesn't really matter-- of k times the probability that
my random variable X equals k. This is how the expected value
of x is defined, typically, for a discrete
random variable X, is this sum over all
the possible states X can take times that state
times the probability of X equaling that state. And what we can do, essentially,
is we can write this out in some shorthand. So we're going to say that this
equals the sum at k equals 0. This term is just 0
because k equals 0. So 0 times anything is 0. So we're really going
to start at k equals 1. And we get 1 times the
probability that X equals 1. I'm going to call that P sub 1. Plus 2 times the
probability that X equals 2. I'm going to call that P sub 2
plus 3 times the probability X equals 3 plus dot, dot, dot plus
n minus 1 times the probability X equals n minus 1 plus n times
the probability that X equals n. This is just kind of
brute force expanding out the traditional definition
of expected value. Now, the tail sum formula, this
is where it gets really cool. There's this kind
of geometric picture that we're going
to introduce here, where now what
we're going to do is we're going to say,
well, this equals P1 plus P2 plus P3 plus
dot, dot, dot plus Pn minus 1 plus Pn. So I've only counted
this each term one time. And that's all of the P1's. There's only one of them. But there's two P2's. So plus P2 plus P3
plus dot, dot, dot, plus Pn minus 1 plus Pn. Good. So now I have my two P2's, but
I have three P3's, three P3's. So plus P3 plus dot, dot,
dot plus Pn minus 1 plus Pn. And then this is
kind of triangular dot, dot, dot plus Pn
minus 1 plus Pn plus Pn. So in this way, because it's 1
P1 2 P2's, 3 P3's, dot, dot, dot n minus 1 Pn minus
1 and n Pn's, you can write down this
kind of triangular sum where you actually explicitly
count all of the terms in this. So you're breaking this
up into single terms. And now this is where it's cool. Pn is the probability that X
is greater than or equal to n. And Pn minus 1 plus
Pn is the probability that X is greater than
or equal to n minus 1 and et cetera, et cetera. P2 plus P3 plus dot, dot, dot
is the probability of X being greater than or equal to 2. So I'm going to write this out. Essentially, this
term is probability X greater than or equal to n. This term is probability
of X greater than or equal to n minus 1, et cetera, et
cetera, probability, dot, dot, dot. This one is
probability of X being greater than or equal to 3. It's P3 plus, P4 plus,
et cetera, et cetera. Probability of X greater than or
equal to 2 and probability of X greater than or equal to 1. And so this traditional way of
computing the expected value is this triangular
sum of probabilities. Each row is the
probability of X being greater than or equal to
the index of that row. And so if we take
all of this together, the sum-- it's this plus
this plus this plus this dot, dot, dot plus this
plus this-- this is exactly equal
to this sum here. It's the sum of all of these
probabilities of X being greater than or equal to some k over all
of the k's, all the non-negative or positive k's. And these are the opposite of
the cumulative distribution function. Probability of x being
greater than or equal to k is essentially 1 minus the
probability of X being less than k, where this is the
cumulative distribution function. This is the cumulative
distribution or density function of that random variable X. So these are useful
quantities, and it turns out that the expected
value is the sum of all of these reverse
cumulative density functions. That's really interesting. It has this kind of cool
geometric interpretation. We've seen sums like this when
we looked at things like-- I want to say the
Poisson and exponential. And some of the distributions
that we've looked at have this kind of interesting,
almost like geometric pattern. But here, it allows
us to write down this kind of new way of
computing or representing the expectation value. This is the traditional way. But if you do this
kind of cool math, you can write it in terms
of these cumulative density functions. That's it. That's all I wanted
to show you today, is just this kind of
cool, useful formula for the expected value
called the tail sum formula. Thank you.

---

## 33. Covariance and Correlation: Example with Gaussian Distributions
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 7 months ago | **Duration:** 5:29 | **ID:** upPn685IU_Q
**Link:** https://youtube.com/watch?v=upPn685IU_Q

### Transcript:
PROFESSOR: Welcome back. So in the last
lecture, we introduced this notion of covariance
and correlation, a really important
property that allows me to tell the joint dependence
of two random variables, X and Y. And I use this example of
these two-dimensional Gaussian distributions, kind of joint
probability distributions in X and Y, where you can imagine
throwing a dart at a board. You get kind of a Gaussian
pattern of density of where your dart actually hits. And if there is a
tight distribution-- I'm just going to draw
these again in contours. If I have a really tight
distribution in X and Y, this has high covariance,
high correlation. If I have a slightly lower
slope and a slightly wider distribution, kind of
fatter and less slope, this will be a lower
covariance of X and Y. And eventually, if I have it be,
perfectly, radially symmetric. So there's no
preferred direction. So it's just kind of
there's no narrow direction. Then X and Y have 0 covariance. They are, in fact,
independent random variables. So for independent X and Y,
the covariance will be 0. And I thought it
would just be nice. I've actually hinted at this
a few times that this joint radially symmetric 2D Gaussian
distribution, X and Y, are independent. And I'm going to
just show that now because I think I've been
really dancing around this. And I think it'll be helpful
to actually prove it. And this generalizes to what's
known as a multinomial Gaussian distribution or
multidimensional Gaussian distribution, a higher
dimensional normal distribution. So if I have a PDF,
let's say f of little x equals-- it would
be 1 over root 2 pi e to the minus x-squared over 2. I'm saying that this
thing is centered at 0 and its standard
deviation of 1 just to make my life easier. It doesn't have to be. And let's say that fy, the
distribution of my y variable, is the exact same. It's a unit normal
Gaussian centered at 0. This would be 1 over root 2 pi
e to the minus y-squared over 2. Then if I multiply
these two-- and this is where the
independence comes in. I'll switch colors for this. The joint distribution
f of x comma y, I claim, is just the product
of these two. So let's multiply these two
together and see what happens. I am claiming that this
is fx times fy of y. And that's going to equal 1
over 2 pi, 1 over 2 pi, times e to the minus. And if you multiply
these, you're going to get this exponent
plus this exponent because that's
when you multiply e to the minus
x-squared over 2 times e to the minus y-squared over 2. You get e to the minus
x-squared plus y-squared over 2. This is exactly
radially symmetric. This is a variable r-squared. So the density now is a
function of the radius away from this center point. This is what we expected. This is the distribution
of my 2D Gaussian, and we've just shown that x
and y are actually independent. So if I have a 2D
multivariate Gaussian, then its x and y components
are independent variables, meaning the covariance of
this x and y should be 0. So I encourage you to
actually simulate this. Throw a random dart according
to some Gaussian probability. You can do this with rand ends
with a normally distributed random variable in Python. Throw a bunch of random
darts and actually compute. Add this expectation
up using the sum. Actually, add up
all of those values and show that the sample
expectation is very, very close to 0. And this works in
higher dimensions. I can have a three-dimensional
multivariate Gaussian with x and y and z. I can have an N-D
multivariate Gaussian with a bunch of independent
or dependent variables. And I will get a
formula like this. And I can still quantify notions
of covariance and correlation between the various components. And so this is for
independent x and y. I could if these had different
variances, different two sigmas squareds on the denominator
of my x exponent here. If they had different
variances, I would get a stretched
out ellipsoid. And then if I rotate
the ellipsoid, then I'll get interesting
terms in this PDF that make them
jointly distributed. I'll essentially have to
rotate this thing so it's no longer rotationally symmetric. And then we'll find that the
covariance in these cases is non-zero. So that's something we'll
do either in a later lecture or as an exercise, is to
start looking at what happens. How do you build these PDFs,
these probability density functions when you have non-zero
covariance between x and y? But in the simple case of
a symmetric 2D Gaussian, x and y are independent
random variables, and the covariance
is equal to 0. Thank you.

---

## 34. Covariance and Correlation in Probability
**Channel:** Steve Brunton | **Views:** 23K | **Date:** 7 months ago | **Duration:** 19:34 | **ID:** QKPdk57y7Ck
**Link:** https://youtube.com/watch?v=QKPdk57y7Ck

### Transcript:
PROFESSOR: Welcome back. So today, we're going to
introduce a really important set of concepts that we're going to
use all the time in probability and statistics,
especially when we deal with data, machine
learning, fitting with data, fitting models with data. Those concepts are
covariance and correlation. So correlation is a term
that comes up all the time. You've heard that correlation
does not imply causation. Oftentimes, you try to see if
two variables or two events are correlated, or if
data has correlations. So the principal component
analysis, singular value decomposition, the basis of
higher dimensional statistics, is really very largely based
on correlation and covariance. And roughly speaking,
the covariance, correlation is
sometimes just described as a normalized covariance. So we're mostly going to
talk about covariance. Covariance can be
approximately thought of as quantifying the joint
dependence between two variables, X and Y. So we know that we can have a
joint probability distribution. We can have conditional
expectations of X and Y, conditional probabilities. The covariance kind
of talks about how does the variation in X
depend on the variation in Y? And we're going to
want the nice property that we want the
covariance of X with itself to just equal the variance
of X. That's going to be a really important property. So we want whatever we define
this covariance of X and Y to be. If I plug in two
copies of X, I want it to equal the variance of X. So let's define this. We'll talk about some
examples, and then we'll define correlation. Good. So the covariance of two
random variables, X and Y, is pretty easy to define. It's the expected value
of X minus its mean. We're going to
call that mu sub x. That's the mean or
the average value, the expectation value of
X. It's the expectation of X minus its mean times
Y minus its mean, where-- I'll just maybe
label this in orange. Mu x is the
expectation value of x, and mu y is the
expectation value of y. It's the mean or average of
y, the mean or average of x. And you'll notice
that this is almost identical to the
definition of variance. The variance of X is
the expectation value of X minus its mean
quantity-squared. So if I plug in two
copies of X here, I recover the expectation
of X minus mu x-squared, which is the variance of x. So this is good. At least this is very
close to the definition we're familiar with of
the regular old variance, of a single random variable. This is how two random
variables, x and y, covary the covariance of
those two random variables. This is a pretty simple thing
to compute and to work with and to analyze
and to understand. It's an intuitive
notion, is that the X-- we take the variations of the
samples, X, from the mean. So if I a distribution of
X, not all of the values will land perfectly on the mean. My expectation-- I have some
probability that they'll land away from the mean. There's normally some
standard deviation of X and the same for
Y. And what we do is we compute the expectation
of joint variations from their means. I, at this point, might actually
want to draw a picture for you. And then we'll write down
some properties of this thing. So what do I mean by covariance? If I have an x variable
and a y variable, and let's say that
my data looks like-- let me see-- if my
data looks like this. We're actually going
to code this up. We'll generate data. And I have a bunch of lectures
on principal component analysis. It's all about these kind
of covariances between two different variables. So you can go to that principal
components analysis, SVD, set of lectures if you want
to just immediately jump to high-dimensional joint
distributions and covariances, covariance matrices. But for now, just imagine
that I have data that is roughly kind of a Gaussian. Let's just assume it's
kind of a Gaussian, but it's an oblong Gaussian. So there's a
preferred direction, and it has a non-zero
angle in this x-y plane. So this collection of
data, if I actually-- I would compute its mean of x. Each of these has a
joint distribution. There's, there's a PDF in x,
and there'd be some PDF in y. And there would be some
joint distribution. And if I find the
mean value here, I could literally compute
how do these points, how does the variation
in x from its mean relate to the variation
of y from its mean? So if I pick a little
test point here-- let's pick a little
test point here-- this would be X minus mu x. And this would be Y minus mu y. And for most of these points,
if I have a large X minus mu x, I will also have a
large Y minus mu y because this thing
has a positive slope. And the fact that
this data kind of has that slope and this
tightness to the distribution indicates that
this data is going to have a large covariance. So there's a large
covariance in this data. Let me do another example. Another example,
let's say I have data where it's
a little bit less steep and a little bit fatter. So I'll try to draw something
that is just a tiny bit more-- so now I've got a wider
distribution and a little bit less steep of a
correlation here. So this would still have a
covariance between x and y, but it's less strong covariance. If I have a large positive
x variance from its mean, I don't expect as large of
a y variance from its mean. And then in the kind of
extreme case down here-- and again, I actually
encourage you to generate these kinds
of point clouds in Python and actually compute
this sample expectation. Compute this expectation
averaged over all of your 100 or 1,000 data points. And convince yourself
that this covariance is higher than this covariance,
is higher than this covariance, where down here, I'm assuming
that I have a symmetric Gaussian in x and y. Let's see if I can draw this. So it gets less dense
as you go farther away. So you have this kind
of symmetric Gaussian in x and y. this is probably
going to have covariance almost 0 between x and y. There's no correlation
between deviations in x and deviations in y. OK. Good. So this is just pictorially
what I mean by covariance. If I have a big
slope and a tight-- not very much spread-- I should have a
lot of covariance. If it is a lower slope
and a fatter spread, it'll be lower covariance. And eventually, if
I have no preferred direction and a lot of spread,
it'll be 0 covariance down here. And it doesn't matter where my
mean of this distribution is. I could center it anywhere
because we're already subtracting off mu x and mu y. Good. And I'll just label
here mu x and mu y. Good. So let's write down
some properties here-- some properties
of my covariance-- one of the useful properties. And I'll do this one
in orange, I think. So I'm actually just
going to expand this out. I'm going to multiply these two
and expand it out, and come up with a cool formula for
the covariance in terms of expectations of x and y. It's a pretty useful formula. So we're going to say
covariance of X and Y. I'm just going to rewrite
what we already have here. This is the expected value
of big X times big Y. This is a little dim. So I'm going to switch
to my brighter orange. Big X times big Y
minus mu x times big Y minus mu y times big X
minus plus mu x times mu y. This is just taking
and expanding this out into all of its four terms. Now we know that the expectation
value of a sum of quantities, even if there is joint
dependence between x and y, the sum of these, they split
into four different sums of four different expectations. So I can write this as
expectation value of XY. The brackets square versus
round doesn't matter. It's just whether or not-- I have too much
stuff inside of here. Sometimes I use square. Sometimes I use round. Minus the expectation. This mu x is a constant,
so I can pull it out of my expected value. So this is minus
mu x expected value of y minus mu y expected
value of x plus-- the expected value of this
constant is just this constant. It's just mu x mu y. Good. And I'll switch
colors again here. So this guy is just-- mu x is the expected value of x. So this is expectation of
x times expectation of y. This guy is expectation of
x times expectation of y. And this guy is expectation
of x times expectation of y. So all three of these
terms are minus expectation of x, expectation of
y, minus expectation of x, expectation of y, plus
expectation x, expectation y. So I get two minuses and a plus. This adds up to equal a
single copy of expectation of x times expectation of y. So this equals expected value
of my variable X times Y minus the expectation of X
times the expectation of Y. And so this is a nice property. This is a nice formula for
the covariance of X and Y. This is something
you can derive. We just derived it. That I can write my covariance
of two random variables, X and Y, in terms of these
expected values of X and Y. And you'll notice right off the
bat, if X and Y are independent, then this covariance
is equal to 0. We know that if X and
Y are independent, then this expectation is the
product of the expectations. And this term will
cancel this term. So maybe I'll just
write that down. Obviously, if X and
Y are independent, then my covariance
is equal to 0. Then covariance X, Y equals 0. Again, because for
independent, X and Y, this expectation splits into
the product, expectation X times expectation Y, which
cancels this term, which gives a covariance equal to 0. So if I have
independent variables, the covariance is
definitely equal to 0. The reverse is not always true. I can have a jointly
distributed PDF. I can have two
variables, X and Y, that are dependent on each other
and still have a 0 covariance. I can definitely have
a covariance of 0 and have X and Y be dependent. But if X and Y
are independent, I have to have a covariance of 0. If I wanted an
example of something that had covariance 0
but dependent X and Y, I would make X uniform on-- I would make X a
discrete random variable that's uniform on
negative 1, 0, and 1. So it has a 1/3 probability
of each of these values. And I'd make a Y variable
that is X-squared. So two discrete
random variables. Clearly, Y is dependent on
X. These have a joint PDF. They totally depend
on each other. But if I compute the covariance
of these two matrices, you can go through the math,
the covariance of X and Y. And this is actually
pretty easy. You literally just sum up over
the very few possibilities of X and Y. There's
three possibilities of X and two possibilities of
Y. The covariance of this is equal to 0, even though
X and Y are not independent. So that's just a really, really,
really easy counter example. If X and Y are independent,
then the covariance is definitely equal to 0. But if they are not
independent, you can still have 0
covariances sometimes. The reason is because X, this
is kind of an even function over an odd domain. And if I add up
all of these, I'm getting an equal amount
of negative numbers and positive numbers. You'll see. Just work this out. It's really easy. There's six things
you have to add up. The probabilities
are easy to compute. This is a pretty
good exercise here. Good. So other properties. We have definitely already
seen that the variance of X equals the covariance
of X with itself. And literally, if I just
plugged in an X and X here, I would get the definition
of variance-- the expectation of X minus its mean
quantity-squared. So this is a property
that's definitely true. We also have that the variation
of a variable X plus Y-- the variance, not the variation. The variance of this
variable z equals X plus Y is equal to Var X plus
VAR Y plus 2 covariance X and Y. So I'd want you to
convince yourself of this. I want you to
actually take X plus Y and plug it into
both places here. Expand it out and
convince yourself that you get variance X plus
variance Y plus 2 covariance X, Y. And then I want you to
think, how does this change if X and Y are independent? And how does it change
if X and Y are dependent? Pretty simple. If they're independent,
then this is 0. And you get 2 times. You get Var X plus Var
Y. If they're dependent you get this extra
covariance term. Good. What else do I want to show you? This is the main stuff. This is a way of quantifying
the joint dependence between two random variables. So if the two variables
are highly correlated, meaning that a variation in
X implies a variation in Y, there will be a high covariance. If there is a low
correlation between X and Y, there will be a low
covariance here. This is kind of
colloquially speaking. I guess I should
define what I mean. I defined covariance. Now I'm going to
define correlation. The correlation is essentially
just a normalized covariance, correlation of X and
Y. And I'll go back to pink for the probabilities. The correlation, we
define core of X, Y is equal to the
covariance of X and Y. It's equal to covariance
variance of X and Y divided by the
standard deviation of X times the standard
deviation of Y, divided by standard deviation of
X times standard deviation of Y. And the reason we
normalize by this is because I can actually
take this distribution. And I can give it
a larger covariance just by making all of
the numbers bigger. If I scale this
thing up-- remember, if you scale up a variable X,
its variance scales squared. It scales with X. And so if
I make this distribution just bigger, if make
my numbers bigger, if I convert from feet to
inches or meters to centimeters, my covariance will
be a bigger number. And so I divide by the
standard deviation of X and Y to normalize that covariance. So is just a
normalized covariance. And essentially, sometimes
we call this sigma xy. Sometimes we call this
covariance sigma xy divided by sigma x times sigma y. That would also be a way of
writing this if you like. And there's a nice property. This is not true of covariances,
but it is true of correlations. It's this nice property,
that the correlation of aX plus b and cY plus d is
just equal to the correlation of X and Y. So essentially,
what this means is that I can take my
distribution of X and Y, and I can shift it by b and d. I can shift it over
and up by b, D. And I can stretch it
out by a factor a and c in the x- and y-directions. And that doesn't change
my normalized covariance, my correlation. It will definitely
change my covariance. In fact, you should compute
what is the covariance of this transformed data. It'll be interesting. But the correlation
doesn't change when I do this linear
transformation of my data, which is pretty nice and pretty useful
property of the correlation. So that's why we
often want to deal with this normalized covariance. Super important property and
probability and statistics-- the notion of covariance
and correlation. This tells me some notion
of joint variation of two variables, and
this is going to be very useful in
high-dimensional statistics when we have a lot of data. Let's say I pull 10,000
people, and I ask them each 100 questions. I can find correlations
in their answers, and I can maybe infer
patterns in that data. That's the basis of principal
components analysis. Singular value decomposition--
that's a whole set of lectures later for linear
regression and multilinear regression and modeling. And this is the
foundation of that. Thank you.

---

## 35. The Lebesque Measure in Probability
**Channel:** Steve Brunton | **Views:** 9K | **Date:** 7 months ago | **Duration:** 6:21 | **ID:** j6AD6Dm9sSs
**Link:** https://youtube.com/watch?v=j6AD6Dm9sSs

### Transcript:
PROFESSOR: Welcome back. So I want to take
a little tiny aside right now because I made a
statement in one of my earlier lectures about the
moment-generating function, and I want to clarify. So I said this
moment-generating function is a very useful transformation
of your probability density function. In fact, it's the
Laplace transform of the PDF of your
random variable x. And I said that this
moment-generating function uniquely determines the
cumulative probability distribution, the probability
that your variable is less than or equal to some value x. Now this is weird. Why didn't I say that
this uniquely determines the PDF, the probability
density function? Why did I say the CDF, the
cumulative distribution function? And this is a really subtle but
important point about functions, in general, but especially
probability distributions, that it turns out that the
cumulative distribution function is actually
more general and easier to work with than the PDF. So the CDF, the integral
role of the PDF, is sometimes easier to work with
and more general than the PDF. So remember that this cumulative
distribution function, the probability that x
is less than some value, is the integral from
negative infinity to that value of my probability
density function f of x, dx. So for a normally
distributed variable, we get that nice,
sigmoidal error function for the cumulative
distribution, that phi function. And what I want to
point out here-- this is just a brief
aside-- not a big deal-- and we'll talk
about this later-- is that oftentimes my
probability density function can actually be pretty nasty. It can have delta functions
and discontinuities. So let me do an example here. So one of the things my
probability distribution can have is it can
have weird spikes. This pink marker is dead. It can have weird
spikes in this PDF. So this is like
a delta function. And where could this come up? I mean, why am I making
up some weird PDF f of x that has this normal
with a delta function? Well, it turns out if you look
at the statistics of the heights of men in the US, the
heights of men in the US, either on driver's
licenses or dating apps or whatever, you get a
pretty normal distribution. People's height is fairly
Gaussian or fairly normal. But people seem to
pile up at 6 feet tall. There seems to be this
preponderance of people that's exactly 6 feet tall. Now, of course, we
know statistically that's because there's social
pressure to be a certain height. And if you're close, if
you're like 5' 11 and 1/2, you're going to bump yourself. Even 5' 10 and 1/2, people might
bump themselves up to 6 feet. And so there is this kind of
big spike or discontinuity at a specific value. So even though height is a
continuous random variable, Gaussian distributed,
in reported heights, you get this big spike at
6 feet for men in the US. I don't know about
men in Sweden. It might be different. And so if I look at the
cumulative distribution function, this is
a nasty function. This has a delta function. This is kind of a
generalized function. It's a pain in the butt. But the cumulative distribution
function, this big f of x, is a little bit
easier to work with. So what this cumulative
distribution function does is it just integrates
from left to right. So it finds the
value of the integral to the left of some little x. And that's what it reports. And for a regular Gaussian,
we would get a sigmoidal error function. And we get essentially
the same thing here, a sigmoidal error function. But at this discontinuity,
we essentially get a little jump in the CDF. So I can have a discontinuous
cumulative distribution function. And that discontinuity is
nasty, but it's workable. I can write down this function. I can do stuff on it. I can compute. It's much harder to work
with these abstract kind of generalized delta functions. And lots of times, you
actually have this. You have this kind of
continuous distribution and this discrete point
spectrum of delta functions. Now, there's a
whole field of math, of functional analysis,
where you can handle these kinds of functions. You can integrate these. The basic idea, it's called
Lebesgue measure theory. And again, measure
theory because, typically, we're
measuring probabilities. So Lebesgue measure theory
and Lebesgue integration. It's an alternative
to Riemann integration for these nasty functions. But the basic idea is
that oftentimes we're going to work with cumulative
distribution functions instead of probability
distribution functions. So when we want to prove
the central limit theorem, we're going to
prove that the sum of a bunch of independent
identical random variables approaches a normal
distribution. We're going to prove
that by showing that the moments of
that sum converge to the moments of a Gaussian. But we're going to do
that essentially proving that the cumulative
distributions converge, not the probability
distributions. It's harder to show that
things converge when you have these weird properties. It's easier to show
that things converge in this integrated cumulative
distribution function because it's better behaved. For every discontinuity here,
it becomes even worse here. So integration
smooths things out, makes things better behaved. Just like computing derivatives
of noisy data makes it worse. But integrating noisy
data makes it better. Integrating your messy kind
of probability distributions makes them easier to analyze. So oftentimes,
we're going to work with cumulative
distribution functions, and this is just at least
a sketch of why CDFs often come up instead of PDFs. We'll dig into this more later. We'll talk about
Lebesgue theory. We'll talk about measure
theory and measure spaces and the more abstract theory. But I just wanted to give you a
little hint of why this came up the way it did. OK, thank you.

---

## 36. Additive Property of the Moment Generating Function
**Channel:** Steve Brunton | **Views:** 6K | **Date:** 7 months ago | **Duration:** 6:18 | **ID:** rn655n2JtgI
**Link:** https://youtube.com/watch?v=rn655n2JtgI

### Transcript:
PROFESSOR: Welcome back. OK, we're talking about the
moment generating function, which is the Laplace
transform of your PDF, very useful function for computing
things like expectations, variance, and higher order
moments of a distribution. And also, this is going
to be critical in proving the central limit theorem,
one of the cornerstone results of probability
and statistics that says that if you have
the sum of a bunch of id identical independent
random variables, there's some starts
to become distributed like a normal distribution. Very powerful
result. And the proof relies on the moment
generating function. So I want to give
you a property that I find super useful
and intuitive, based on what we know about Laplace
transform from differential equations. A property of the
moment-generating function. So we're going to
let x and y, we're going to let x and y be
independent random variables. X and y be independent
random variables. They do not have to be from
the same distribution, just two independent random variables. And they have two moment
generating functions. They have mx and my, are their
moment-generating functions. We have two random
variables, independent. They have two
moment-generating functions. And we are going to
define a new variable. So define z equals x plus y. And what we're going to say
is that the property I want to tell you today,
this is the property, is that the moment
generating function of z is equal to the product of the
moment-generating functions of x and y. It's equal to moment
generating function of x-- this is a function of t-- times the moment generating
function of y-- this is a function of t. That is the moment
generating function of z. So this is super cool. If I have two random
variables and I add them up, the moment-generating
function of their sum is the product of their
moment-generating functions. Now, this should make you think
about differential equations where I have the Laplace
transform of two signals and before, I would
have to convolve them. But now, if I Laplace transform
that, I get the product. So this is a lot like transfer
functions in differential equations and control theory. If you add up blocks,
then the transfer function is the product of those blocks
in differential equations. That's just an
aside in case you're comfortable with
differential equations. If you've never seen
differential equations before, this is just a new
property in statistics that happens to be useful. And what specifically
is useful-- again, I'm going to write down how this
relates to central limit theorem because that's why I'm
telling you all of this-- is that if I have a bunch of
random variables x1, x2... xn, and I define a
new variable, Sn, which is the sum of all of
these random variables, then this new sum, this
random variable, that's the sum of all of these. Its moment-generating function. The moment-generating
function of my sum is just the product of all
of these moment-generating functions. It's the moment
generating function of x-- sorry, it's so squeaky-- to the power n. And this is going to be very,
very, very, very useful when we prove the central
limit theorem, because we're going
to specifically be saying that
this sum converges to a normal distribution,
which means we're going to want to show that this
moment-generating function is the moment-generating function
for a normal distribution. That's how we're going to prove
the central limit theorem, one of the most important results
in probability and statistics. So this is the statement. This is the property. And I'll give you the thumbnail
proof of why this is true. So the proof is pretty simple. So the moment-generating
function of z is specifically defined
as the expectation of e to the t times my
random variable, z, which is the expectation
of e to the t times the sum of my random
variables, x plus y. Now, there's a few
ways you can do this. You could actually now
plug this into the formula for expectation. This is now going to be integral
over x, integral over y, to the t little x
plus y times the pdf. You could do that. And you can show that this is-- you get what you want. Or you can just write this
as this is the expectation value of e to the little tx
times e to the little ty, because that's how
exponential products work. And x and y are independent. So the expectation of this
and this are independent. And so this should give me
the expectation value of e to the tx, times the expectation
value of e to the ty. This is defined as the
moment-generating function of x times the
moment-generating function of y. I skipped some steps here. If you really, really,
really wanted to be careful, I would actually
start here and I'd write out the full integral
of this expectation value, and I'd show that you can split
that integral over x and y into one integral over
x and 1 integral over y, and that you'll get
these expectation values for that result in the
moment-generating function. This is just meant to be a
thumbnail sketch of this very, very important
property here that if I have two independent
random variables, they have to be independent. Then the sum of those
random variables, its moment-generating function
is the product of the two moment generating functions. Very, very useful. And we're going to
use this specifically when we prove the central
limit theorem in a little bit. OK, thank you.

---

## 37. Example of The Moment Generating Function
**Channel:** Steve Brunton | **Views:** 10K | **Date:** 7 months ago | **Duration:** 9:48 | **ID:** JjaOtHaDy9E
**Link:** https://youtube.com/watch?v=JjaOtHaDy9E

### Transcript:
PROFESSOR: Welcome back. Last lecture, we introduced
the moment-generating function M, which is the Laplace
transform of the probability density function for a
continuous random variable x. It has the very, very
powerful property that this
moment-generating function M can be used to generate all of
the moments of your probability distribution. So the first moment,
the expectation of x is related to your mean. The second moment, the
expectation of x-squared is related to your variance. The third moment,
expectation of x-cubed is related to your skewness. Fourth moment, kurtosis,
and so on and so forth. These give a unique
kind of fingerprint or unique ID for your
probability distribution. And this is a very,
very useful way of thinking of PDFs in terms
of their moments, their higher order moments. So specifically, I
wrote down this theorem. I'll circle this in pink
because this is what we're going to talk about today. This theorem is that you can get
the n-th moment, the expectation of x to the power n, where
x is a random variable. You can get this
n-th moment by taking the n-th derivative of your
moment-generating function and evaluating that at 0. This is going to be a useful
way of computing these moments. So I'm going to
prove this theorem. And then I'm going to give
you an example on the Poisson distribution. So the proof is pretty simple. The proof here is,
essentially, that the proof. What we're going to do,
we're going to write down the moment-generating function. I'm going to write this down
for continuous variables. This is also true for
discrete variables. So my moment-generating
function M of t is just this integral minus
infinity to infinity of e to the tx f of x dx. Nothing fancy here. This is just the definition. And we're going to write down
the derivative M prime of t. And I'm just going
to write this down. This is equal to the integral
negative infinity to infinity of x e to the tx f of x dx. Now, how did I write
this down so quickly? There's no chain rule. There's no integration by parts. There's nothing fancy here. This M prime is the derivative. This is the derivative
of M with respect to t, not with respect to x. So taking the derivative
of M with respect to t is really easy. This doesn't depend on t. The only thing that
does is e to the tx. And derivative of e to
the tx is x e to the tx. So super easy to compute the
derivative of this thing. Similarly, I can write down the
second derivative if I like. M double prime t equals integral
minus infinity to infinity. This will end up being
x-squared e to the tx f of x dx, dot, dot, dot. The n-th derivative is going to
equal integral negative infinity to infinity, x to the power
n e to the tx f of x dx. And now, if I evaluate
these at 0, e to the 0 is 1. And so what I'm left with
is a really nice expression. This implies that M
prime at 0 is just integral negative infinity
to infinity of x f of x dx. So this becomes 1. This becomes 1. This also implies M
double prime 0 equals integral negative infinity to
infinity of x-squared f of x dx dot, dot, dot. M n-th derivative evaluated at
0 is integral negative infinity to infinity x to
the power n f of dx. These are the definitions
of these moments. The expectation
of x is literally the integral of x times f
of x over all possible x. The definition of
expectation of x-squared is the integral of
x-squared f of x over all possible values of x. The definition of the
expectation of x to the power n is the integral of x to
the power n f of x dx. So this is by
definition expectation of x to the power n,
expectation of x and expectation of x-squared. So this is a proof
that you can get these moments, these
expectations of x to the power n really, really easily by
taking the n-th derivatives of your moment-generating
function and evaluating at 0. So this is just
a proof that this can be used for
calculating these moments. Very interesting. Very useful. Now let's do a
really quick example on the Poisson distribution. So we've already written down
the moment-generating function for this Poisson
random variable. Remember, Poisson
distributions are good for calculating how
often a rare event is expected to happen. So if I have light bulbs
failing, on average at a certain rate, and I
have thousand light bulbs, how many do I expect to
fail in the next five days? You can frame these as
Poisson-type problems. So Poisson quantify
rare events, and this is the moment-generating
function for the Poisson distribution. So let's actually do this now. Let's write down from this
moment-generating function. Let's compute the expected
value, the variance and so on for this Poisson distribution. So for Poisson, we have M of
t equals e to the lambda times e to the t minus 1. That's the
moment-generating function. So M prime of t, if I take the
derivative of this with respect to t. Now, again, you should pause. Use the chain rule. Remind yourself
that this is true, but it's a pretty easy fact
that this is e to the lambda e to the t minus 1
times lambda e to the t. That's just the first
derivative of this function. M double prime t is
e to the lambda e to the t minus 1 times lambda
e to the t-squared plus e to the lambda e to the t
minus 1 lambda e to the t and dot, dot, dot. You can compute the third
derivative, fourth derivative, and so on and so forth. This is the basic template here. These are the first
and second derivatives. And so I can compute expectation
of x as my first derivative of my moment evaluated at 0. So I literally
take this function, and s plug in t equals 0. So e to the t is all become 1's. This is e to the-- 1 minus 1 is 0. e to the 0 is--
this whole thing becomes a 1. This becomes a 1, and I
just get a lambda out. Again, I'm going kind of fast. Convince yourself if you plug
in t equals 0, this becomes 1. This becomes 1, and I
just get a lambda left. Expectation of x-squared,
similarly, is just M double prime evaluated at 0. So I take this whole big
expression and evaluate it at 0. Same thing. This expression
becomes equal to 1. All my e to the t's
become 1's if t equals 0. And I get a lambda-squared
plus lambda. So I get this equals
lambda-squared plus lambda. So my expected value of
this distribution is lambda. That's actually true. We derived this
lectures ago when we were introducing Poisson. This is definitely true. And now the variance
of X, which we know, is expected value of
X-squared minus the square of the expected
value of X. So this equals lambda-squared plus
lambda minus the expectation squared, is minus
lambda-squared. So the variance is
also equal to lambda. And remember, that's what we
derived a few lectures ago when we were working on Poisson. The expected value
and the variance are both equal to
lambda, which is kind of a fun and strange property. So I'm actually curious. I'd like you to do
this as a homework. What's the third moment? What's the fourth moment? What's the fifth and
sixth and seventh? I'm sure you're going
to get an expression like lambda-cubed plus
lambda-squared plus lambda and so on. You'll get this
kind of sequence. And then that can tell you
something about the skewness, the kurtosis. All of these higher
order moments are easy to compute in
this Poisson distribution. So moment-generating function,
this really powerful function, which is the Laplace
transform of your PDF, allows you to compute moments
like the expected value, expected value of
x-squared, x to the n, which are useful in computing
things like the mean, the variance, the skewness,
the kurtosis, the profile or the fingerprint of your
probability distribution. Thank you.

---

## 38. The Moment Generating Function
**Channel:** Steve Brunton | **Views:** 34K | **Date:** 7 months ago | **Duration:** 21:57 | **ID:** u0ku4bvp40I
**Link:** https://youtube.com/watch?v=u0ku4bvp40I

### Transcript:
PROFESSOR: Welcome back. So I'm really excited
today to introduce you to one of my favorite concepts
in probability, the moment generating function. So I remember when I was
learning probability ages ago, This was one of the
biggest aha moments for me that connected a lot
of different topics. So the moment
generating function is, roughly speaking, going
to be a nice function that helps us compute moments. Things like the expectation,
the variance, and higher order moments, things like skew
and kurtosis in a pretty nice compact formula. And it's also going to be
central in proving some of the most important theorems
in probability and statistics like the central limit theorem. OK, so what is a moment? In probability, the
moment of a distribution, the moments of a
probability distribution are the expected values of
my random variable x or x squared or x to the power n. So there are actually
infinitely many moments. There's a first moment, a
second moment, a third moment, fourth moment, and
so on and so forth. And they are the expectation
value of my random variable to the power n. So we've already seen examples
where this is super important. The mean is the first moment. The mean of my distribution
is the first moment. And the variance
of my distribution is closely related
to the second moment. It's the second moment minus
the first moment squared. And these are extremely
important for characterizing my probability
distribution function. So if I know that
my distribution is, let's say, a normal distributed
random variable x or a Gaussian, then it is uniquely determined
by the first and second moments. So the first and
second moments uniquely determine the mean and
the standard deviation. This is, let's say, mu plus
sigma and minus sigma, the mean and the standard
deviation of that normally distributed
random variable. But higher-order moments
are actually also important. There are lots of
distributions where you need more moments
to uniquely determine that distribution. So the third moment,
the expected value of x to the power 3 is
known as the skewness of the distribution. So if I have a distribution
that's a little bit lopsided, something
like this, it's going to have some skewness. So the Poisson
distribution, for example, is going to have some
non-zero skewness. If I have a distribution that
has some kind of back tails, I might need my fourth
moment or my kurtosis. The expected value
of x to the fourth. So I can draw a picture of that. Maybe I have
something that looks kind of like my
normal distribution, but I've got some bumps
out here in the tails. There would be some fourth
moment or some kurtosis in that distribution. And these moments are
unique identifiers of my probability distribution. It's a lot like the derivatives
of my function in the Taylor series approximation. So if I want to approximate a
function with a Taylor series, I can collect all
of the derivatives, the n-th derivatives
of my function, and uniquely write the Taylor
series for analytic functions. Same basic idea applies for
probability distributions. You can uniquely
determine like, let's say, the cumulative
distribution function and sometimes the
probability distribution function in terms of this kind
of infinite series of moments. So this is kind of like the
Taylor series for probability and statistics. Super, super fundamental
concept and very, very useful. OK, so let's define this moment
generating function which is going to allow us to compute
these moments very efficiently. OK? So I want to do this
in pink, I think, because I like my
probabilities to be here. So the moment
generating function is going to be defined in terms
of an entirely new variable. Usually these are defined
in terms of a variable x. Here we're introducing
a new variable because we're going to do some
transformation from probability space into this moment
generating space. And this is defined
as, I'm going to write it for a
discrete variable x and for a continuous
random variable x. So for a discrete
random variable x, it's defined as the sum
over all possible states x can take of e to the tx times
the probability density function p that big X equals little x. This is for x discrete. For discrete random variable. OK? This is just how it's defined. I'll tell you why
it's defined this way and how to use it in a minute. And for continuous random
variables, for x continuous, things like the normal
distribution or an exponential distribution or
gamma distribution, this is defined as the
integral over all possible x's. So let's say generically
from negative infinity to infinity of e to the tx times
my probability density function f of x dx. Now, first off,
those of you who have studied differential
equations, control theory, dynamical systems, you'll
recognize right off the bat that this is the Laplace
transform of my PDF. This is the Laplace transform of
my PDF, my probability density function f of x. Which is pretty wild that
this very useful function for approximating
these moments happens to be the Laplace transform
of my probability density. This actually maybe
shouldn't be so surprising. Laplace was one of the absolute
founders of modern probability and statistics. In fact, Bayesian
statistics, I think, should be really called
Bayesian Laplace statistics because even though
it was discovered by Bayes a couple
of years earlier, Laplace independently discovered
it and went way farther in developing it. So most of our modern theories
and language and thinking about measurement error,
probabilities, and statistics are actually responsible
because of Laplace. So Laplace must have been
thinking about this transform both in terms of probabilities
and differential equations. And there's some deep,
deep connections. If you think about
stochastic processes like radioactive decay, you
have a differential equation and a corresponding
probability density function. And you can take the
Laplace transform of both, and it means something. So a lot of deep connections. But zooming out, this
moment generating function is something you can compute. It's the Laplace transform
of your probability density function. And it has this very,
very useful property that the moment generating
function can easily help you generate the moments,
the higher-order moments of your probability-- of
your random variable x. So the way that looks, and
maybe I'll do this in blue. This is a theorem
I'm going to prove next time in the next video,
but I'm going to state it here. So there's a theorem that the
moment generating function, the n-th derivative of my moment
generating function evaluated at 0 is equal to this
expectation of x to the power n. This is super useful. So if I take the first
derivative of this function and evaluated at 0, I get
my expectation, my mean. If I take the second
derivative of this function and evaluate it at 0, I get
the expectation of x squared. The third derivative
evaluated at 0 gives me something
related to my skewness. Fourth derivative,
related to kurtosis. So all of my moments
I can generate, I can easily grab from this
moment generating function. Super, super useful
because these are quite difficult to
calculate generically. And once I have
this function, it might be much, much
easier to do this. And again, this is going
to uniquely characterize-- maybe I'll write this down--
this moment generating function m of t uniquely determines
the cumulative probability distribution. The cumulative
probability distribution. Specifically the probability
that my random variable x is less than or equal
to some little value x. OK? And this is something
we'll see later. Now, notice that I didn't
say the probability density that the PDF, I said the
cumulative distribution function, the CDF. There is a reason why I talk
about CDFs often instead of PDFs. I'll tell you later, but just
gloss over this fact and just say this moment generating
function uniquely determines the distribution, your
probability distribution. OK? And it's very, very useful for
computing these moments that are, again, the fingerprint
or the Taylor series kind of approximation
of your distribution. These uniquely determine
your distribution. Great. So I want to give
you some examples. How do you do this for Poisson? How do you do this for normal? How do you do this
for exponential? And next time, I'll
prove this theorem that my moments give me
these-- that my moments can be drawn from this moment
generating function. OK, good. So I think from now on I'm just
going to be doing some examples. Is there anything else
I want to tell you? I think that's pretty good. Moments are important. They uniquely determine
your distribution, and you can pull them out
of this kind of magic moment generating function which
happens to be the Laplace transform of your PDF. Pretty profound,
pretty powerful stuff. Let's do some examples. So I'm going to do Poisson,
normal, and exponential. So example, let's
start with Poisson. The Poisson distribution. So my PDF here, this is a
discrete random variable. So let's say x is Poisson. We'll say x is Poisson
with some lambda. And of course, that
means its PDF is going to be-- what's its PDF? Its lambda to the k e to the
minus lambda over k factorial. That's the PDF of Poisson. So the moment
generating function is going to be the sum of
e to the tk sum over k. This is my moment
generating function of t. So here it's defined in terms
of some dummy variable x. Here, my dummy variable is k
because that's what we normally do for Poisson. But it's this expression here. And it's not that hard to
manipulate this and get a pretty easy expression. So my moment generating function
is this, which is the sum-- I'm going to pull this e
to the lambda out of my sum because the sum is over k. This is e to the minus lambda
sum of e to the tk lambda to the k. That's e to the t lambda to the
power k divided by k factorial. I pulled out my e
to the minus lambda, and then I combined these
terms into e to the t lambda. All of that to the power
k divided by k factorial. Pretty simple stuff. Now, this expression
here, the sum of this thing to the k
over k factorial, this is the definition of e to the
stuff inside the parentheses. So this equals e
to the minus lambda times e to all of the
stuff in the parentheses. E to the, goodness. Lambda e to the t. This sum here over k,
this is the definition of the exponential of all the
stuff in this parentheses. So it's e to the lambda e to the
t times e to the minus lambda. So this equals e to the lambda. Do I have a minus sign here? Yeah, e to the lambda
e to the t minus 1. OK. So this is the moment generating
function m of t for the Poisson distribution. And I can take its
first derivative and evaluate it at
0 to get the mean. I can take its
second derivative, evaluate it at 0
to get something related to the variance
and so on and so forth. This is an easy function
I can work with. This is how you compute
the moment generating function of a discrete
random variable like Poisson. OK, let's try another one. Let's do a normal distribution. OK? Example two, normal
distribution. So let's say that
x is in normal. And let's make it really
easy on ourselves. Let's say it's mean 0,
standard deviation 1. I don't want to deal with some
hairy normal distribution. Just a basic standard normal. OK. We're going to write this out. We're just going to do it. It's not going to be that bad. And it's going to
save us time later when we want to compute
higher-order moments and do things like that. This is also really important
for the central limit theorem. So the moment generating
function of this PDF is the integral from negative
infinity to infinity of e to the tx times my PDF dx. So it's integral negative
infinity to infinity of e to the tx. And my PDF of my normal
has a 1 over root 2 pi. I'm going to pull that
out because it's just a normalization factor. 1 over root 2 pi
times e to the minus x squared over sigma
squared, which is just minus x squared over--
yeah, over 2 sigma squared. And since sigma is 1, my
PDF is just e to the minus x squared over 2. OK. So I pulled my
normalization factor out from my Gaussian
normal distribution. And this is the PDF of
my normal distribution. And this is my Laplace
transform integrating factor. So this is the thing
I need to compute. And pretty easy,
I'm literally just going to combine
these exponentials, do some really basic algebra
and integrate this thing. OK. So one tiny fact
that's going to help us do this is that x
squared over 2 minus tx, that's just the minus of these
exponents when I multiply this. This thing is equal to
1/2 x squared minus 2tx, which is equal to 1/2 x minus
t quantity squared minus 1/2 t squared. Really, really simple. If you take x minus
t squared times 1/2, and then you subtract
off the t squared term, you're just left with an x
squared and a 2tx This is really, really simple. Just expand your
polynomial, whatever. This is just an identity
to take this exponent here when I multiply these
two and write it in terms of these
squared exponents that are going to be a little
bit easier to work with. This is just an identity. And so now this integral here
is equal to 1 over root 2 pi integral minus infinity
to infinity of, let's see, this thing here, which is e to
the minus 1/2 x minus t quantity squared plus 1/2 t
quantity squared. All of this integrated
with respect to x. So this is tx minus
x squared over 2, which is the minus
of this identity. So I get the minus
of this identity, which is 1/2 x minus t
squared plus 1/2 t squared. We're just doing
integration now. And now I can split
these integrals up. I can split this
product up here. So this equals-- my e to the 1/2
t squared doesn't depend on x. So I can pull that
outside of my integral. So now I get 1-- I get e to the 1/2 t squared
times 1 over root 2 pi-- 1 over root 2 pi integral
minus infinity to infinity of e to the minus 1/2 x minus
t quantity squared dx. Now, this is the
probability distribution for another normally
distributed variable with mean t and
standard deviation or variance equal to 1. So this thing also has integral
probability equal to 1. If I integrate this from
negative infinity to infinity, the law of total probability
says this integral equals 1. And so my moment
generating function is just this stuff
on the outside. It's just equal to e to
the t squared over 2. This is my moment generating
function for a normal. Pretty simple stuff, OK? I mean, like there was a little
hairy math in the middle, but I think you followed. This calculus. It's easy. We know how to do this. And now we have this really
simple function for the moment generating function. This is actually a nicer
function than my PDF in a way. It's closely related,
but it doesn't have all my normalization stuff. OK, let's do one more
example before we close out. So the last example I'll do is
my exponential distribution. So now I'm going to do
example three, exponential. And my exponentially-distributed
random variable is pretty closely related to
radioactive decay and things like that. So that's where your ODEs
and your Laplace transforms are going to come
in if you really wanted to follow up on this. So the moment
generating function is, again, equal to the
integral, in this case, from 0 to infinity because my
exponential distribution only is for positive terms. And here, I'm going to introduce
a different dummy variable s for my Laplace transform
because my exponential already is defined with a variable t. And it's going to get confusing. So we're going to say this is e
to the st times my probability distribution for exponential,
which is lambda e to the minus lambda t. And now I'm integrating
this with respect to t. And now my moment generating
function is actually in terms of a dummy variable s. This is actually more
like a Laplace transform. Because my exponential we're
already using the variable t, I'm integrating out dt,
and my Laplace variable now is going to be s. And I'm going to get
a moment generating function in terms of s. Totally fine. You can call these
variables anything you want. And this thing is
really easy to compute. So I can pop my lambda
out, and I get-- what do I get? I get lambda integral
0 to infinity of e to the s minus
lambda times t dt. And this is really easy
to compute this integral. This is just how you do
Laplace transforms in general. This is lambda
over s minus lambda e to the s minus
lambda t evaluated at the bounds of
integration infinity and 0. So this is only defined
if s is less than lambda. If s is bigger than lambda,
this thing is going to blow up. We're assuming real
valued s for now. And so s has to be less than
lambda for this to work. So this is defined if
s is less than lambda. And if s is less than lambda,
then the infinity bound, this goes to 0. And the 0 bound,
this goes to minus 1. So this equals lambda
over-- it's times minus 1. So it's lambda over
lambda minus s. This is the moment
generating function for an exponential
distribution, and it's only defined for some values
s depending on lambda. OK, so three different examples
of how to compute this moment generating function. It's pretty easy for
discrete variables, for continuous variables. The functions aren't too nasty. And you can use
these to calculate the moments, the expectation,
the variance, the skewness, the kurtosis, the fingerprint
of your distribution for really, really a wide
variety of probability distributions. And again, last thing,
this will be useful when we start to prove
the central limit theorem that if I add up n
independent but identical random variables, if I add up a
bunch of the same distribution random variables, they
will start to converge to a normal distribution. We're going to use
the moment generating function to prove that. We're going to
show that that sum, that the moment
generating function of that sum of random
variables starts to converge to the moment
generating function of the normal distribution. So we're going to use
this exact result to prove the central limit theorem. OK. Thank you.

---

## 39. The Central Limit Theorem
**Channel:** Steve Brunton | **Views:** 19K | **Date:** 7 months ago | **Duration:** 10:57 | **ID:** ckkrS752tjU
**Link:** https://youtube.com/watch?v=ckkrS752tjU

### Transcript:
PROFESSOR: Welcome back. OK, so today I'm
ready to state one of the most important
theorems in all of probability and statistics-- the
Central Limit Theorem. So last time, we wrote down
the Law of Large Numbers and we actually proved it
using Chebyshev's inequality. And this is a very
intuitive statement that if I have
data, if I have data from an independent identically
distributed random variables, from n different, identical,
independent random variables x1 through X n-- again, these could be n
coin flips and dice rolls, n questionnaires-- you
ask n different people-- all kinds of things. The heights of n
different Americans, or n different Texans. It doesn't matter. This is n independent random
variables that you sample. Then the sample mean,
literally the average, the numerical average
of those n samples will converge to the
mean of the distribution that they belong to as
the number of samples goes to infinity. Very intuitive results. We have a gut feeling
for why this is true. OK? If I collect more and more data
from identically distributed random variables
and I average them, that average will converge
to the expected value of that distribution. Makes total sense. I should probably have
written sequence of identical, independently distributed
random variables. Sometimes this is called
"iid," identical independently distributed. And that just means that
it's the same fair coin being flipped n times. Now the Central Limit
Theorem is more powerful. It's a more powerful result,
and it's much more useful. What it says-- it's
the same basic idea. It says that this sample
mean, x bar, converges to mu, but specifically that
it is distributed as a normally distributed
random variable with a calculatable
variance and mean. So it says-- I'll
actually just write down what the Central Limit Theorem
says here, maybe in yellow. The central limit theorem has
the same basic assumptions. We have n identical
independent random variables. And what it says is that
the sample mean-- the sample mean, which again is just
x bar n equals 1 over n, sum i equals 1 to n of all
of my independent trials. It's just literally the
mean of all of my data. This is going to be a normally
distributed random variable. This is normal, with mean
mu, and variance, sigma squared over n. So the variance of
this sample mean is sigma squared over n,
meaning its Standard Deviation, the SD is just
sigma over root n. That might make you
feel more comfortable. This is the mean. It means that not
only does the sample mean converge to the expected
value of the distribution, mu, but it does so in a way
that as n gets large, this distribution
of sample means will start to be distributed
as a Gaussian random variable. It's a normally distributed
random variable. This gives you very, very
tight estimates on how good your estimate of
the sample mean is when you're dealing with data. And this is super important. So for example,
if you are trying to measure some
physical quantity, let's say you're trying to
measure the speed of light, or you're trying to measure
the mass of an electron or something like that,
something hard to measure. You might end up
doing 30 random-- 30 experiments. You might actually do
the experiment 30 times. And you'll get slightly
different values for the speed of light or
for the mass of the electron in all of those 30
different experiments. And what this says is that
regardless of what the actual distribution of these
random variables are-- maybe they're uniform,
exponential, Poisson, whatever they are-- if you add them up
and average them, that average value
starts to look like a Gaussian random
variable, where the mean is the actual mean of
the distribution, and the standard deviation gets
smaller and smaller and smaller as you increase the number
of experiments you do. This has profound implications
for modeling experimental error, how to do statistics
to tell something about the large population
from a small sample mean. And it's one of the most
important theorems in all of probability and statistics. This is one way of
stating it in terms of the sample mean, which is
from the law of large numbers before. I'll just give this
a little subscript n, because this changes
as n goes to infinity. We'll start to do some numerical
experiments on this soon. We'll actually compute this
thing for n increasing. We'll do this over
and over and over. We'll compute these sequences
for n equals, let's say 100. And then we'll repeat that
experiment maybe 50 times. And we'll see what
is the expected variance of this distribution. We'll show that it converges
to a normal distribution on a computer and we'll also
prove it using the moment generating function. The proof of this is
actually pretty challenging. It's going to take
me a little while to build up the
math to prove this. And the proof is interesting,
but it's not essential. If you can take
my word for this, if you can understand
how to use this result, you don't necessarily
need the proof, but it is quite interesting. And I will present that later. The basic idea is that it's
based on something called the moment generating function. Which, roughly speaking, the
moment generating function is the Laplace transform of your
probability density function. And the moment
generating function of a sum of random
variables-- let's say the moment generating
function is called M of t given some probability
distribution, some PDF, P of x. Then if I have the sum of a
bunch of random variables, this X n is essentially
the sum, the weighted sum of a bunch of random
variables, then the moment generating
function of that sum is the product of the
individual moment generating functions of the individual
independent trials. And so, what we're
going to do is we're going to approximate
this moment generating function of this
thing we want out of the moment generating
functions of the thing we have. And we're going to show that
this aggregate moment generating function converges to that
of a normal distribution. So, dot, dot, dot, more soon. That's the thumbnail
sketch that we're going to use the moment
generating function. It's a nice way of showing that
this PDF converges to this PDF. Actually, technically the
cumulative distribution of this converges to the cumulative
distribution of this. We're going to show that using
the moment generating function. Very, very powerful idea. Kind of an advanced topic. But I'm excited to
show you that soon. OK. This is one statement in
terms of the sample mean. And I chose to write it this
way because this connects to the law of large numbers. There is another
way of writing it, where you could say
that just the sum of all of these variables, the sum. We'll call S n equals just sum
from k equals 1 to n of x k. So I'm not dividing by n,
I'm not taking the average. I'm literally just adding up
all of these random variables. We can also say that
this sum, S n is normal, is a normally distributed
random variable. And now its mean is n mu and
its variance is n sigma squared, or its standard deviation
is root n sigma. So this and this are essentially
completely equivalent statements. But sometimes you're going
to see the Central Limit Theorem just stated as how
the sum of these variables is distributed. I think it makes
a lot more sense to think about how the
average, how the sample mean is distributed because
this is what's going to be useful
for understanding experimental error, design of
experiments, how big of an n do we want, do we need, if we
want, our variance to be less than a certain amount? All kinds of interesting
things there. How big of a sample do I
have to-- how big of a poll do I have to do to tell
the outcome of an election? Things like that. Those are important
concepts here. And it's all related to n and
to this sigma squared over n in the Central Limit Theorem. Now again, the really
profound thing, and I'm going to say this again
because it's so profound, this doesn't matter. It doesn't matter what
the distribution of X is. It doesn't matter what the
distribution of my X i's is. And that's a pretty wild fact. So it doesn't matter how
these are distributed, as long as they're
identical and independent with a mean and a
variance, you can make this very, very powerful
statement of the Central Limit Theorem. OK, I think that's essentially
what I want to tell you, is mostly just to
state it, to indicate that this is a
powerful generalization of the law of large numbers. The law of large
numbers just says that your sample
mean converges to mu, and that the variance
gets smaller and smaller as n goes to infinity. This says something
much more powerful. It says that this
variable becomes distributed as a normal
distributed random variable. It has a shape. And you can quantify its
mean and its variance in terms of the
mean and variance of these independent
random variables, regardless of what
their distribution is. Just super profound,
unexpected result, cornerstone of probability and statistics. We're going to use
this all the time when we do hypothesis testing,
experimental design, confidence intervals, basically
anything where we are using data and trying to
make some statistical statement about that data. OK, thank you.

---

## 40. The Law of Large Numbers
**Channel:** Steve Brunton | **Views:** 18K | **Date:** 7 months ago | **Duration:** 12:44 | **ID:** 0VoRWJMt6mk
**Link:** https://youtube.com/watch?v=0VoRWJMt6mk

### Transcript:
PROFESSOR: Welcome back. So we're getting to a
pretty exciting point in this short course
on probability theory, where now we can start making
some very general statements about large numbers
of random variables. So these are called
limiting theorems. And the first one,
the one you've almost certainly seen before
and is very intuitive, is the Law of Large Numbers. So we're going to
state this one today. And then we're going
to build on this and show a more powerful
result called the Central Limit Theorem soon. This is the first and simplest
in these limiting statements you can make about sequences of
random variables in the large and limit-- in the
limit of a large number of random variables. So let's get in. And we're going to use Markov's
inequality and Chebyshev's inequality for these results
if we want to prove them. OK, so I'm just going
to state it first and then we're going
to show why it's true. So given a sequence of
independent random variables-- I've got a bunch of
independent random variables. This could be n
different coin flips, so n Bernoulli random variables,
or n of some other distribution is fine, too. And let's say that each
of these random variables has the same mean, mu, and
the same standard deviation, sigma, or variance
sigma squared. Then the statement of the Law of
Large Numbers is the following. Given this sequence,
we can define something called the sample mean. The sample mean, which
literally means the average of all of my samples. Let's say I don't know a model
of this probability density. I don't know if it's Bernoulli,
or binomial, or Poisson. I don't have a model, but
I collect a bunch of data. Then the sample mean-- which I'm
going to define as x bar equals 1 over n times the sum of
all of my independent trials, from I equals 1 to n-- this sample mean will
converge to the actual mean of the distribution mu
as n goes to infinity. This will converge to mu-- and I'm going to switch
colors-- as n goes to infinity. So this is a pretty
common sense statement. This should make a
lot of sense to you. If I have a bunch
of random variables and they each have the same mu,
the same expected value, mu, the same mean value, and
there's some variance, then as I collect more
and more and more data and I compute the
average of that data, it should converge the data
average, the sample mean, should converge to the actual
mean of the distribution as n goes to infinity. So this is intuitive. This should be true. But we can actually now
prove that this is true using Chebyshev's inequality
that we derived earlier. So I'm going to write-- OK, so this is good. And there's actually a slightly
more formal way to say this. So I'm going to say formally
the way we would say this-- and I'm actually going
to prove this two ways. I'm going to give you a
thumbnail sketch of why this is true. And then I'm going to prove
formally why it's true. So formally, what this means
is the probability of my sample mean minus my actual
mean, the absolute value of this, the probability that
this is bigger than epsilon goes to 0 as n goes to infinity. So that's what we mean by this
sample mean converging to mu is it means that the
probability of my sample mean being more than epsilon
away from mu goes to 0. So I get within an arbitrary
epsilon of my actual mean with my sample mean
as n goes to infinity. So this is how if you
were a little bit uptight, you would say this. Good. And we're actually going
to show this on a computer. So we're going to
start very soon, kind of going from
our probability module to our statistics module. And in our statistics
short course or module, we're actually
going to be dealing with real collected data. So we're going to run
experiments on a computer. We're going to generate data. And we're going to see how
fast this bar converges to mu. We're going to run
this experiment. So we're going to demonstrate-- we're going to demo on a
computer with real data soon. OK, so we'll actually code
this up on a computer soon. But for now, we're still
in probability land. So we're going to prove
that this is true, give you some intuition. And then we'll build
some more complicated limiting theorems soon. OK, good. So how would I actually
prove this thing? Maybe I'll switch
colors a little bit. So how would I prove this? So proof. Since all of these
x's are independent, we know a lot about the
expectation of X bar. We know that we can compute
the expectation of X bar and it should be the sums of
all of these expectations. That's pretty useful. So let's just write that
since my X's are independent, then I know that the expected
value of my sample mean, X n is the sum of the
expectations of each of my independent
random variables. It's equal to 1 over
n, times the sum from I equals 0 to n of the
expectation value of each of my independent
random variables, X i. And we know that each of these
expectations is equal to mu. So that's good. So we know that the
expected value of x bar is equal to 1 over n
times n copies of mu-- this just equals mu. Equals mu. Good. So at least we know that the
expected value of x equals mu. But what this theorem is saying
is actually much more powerful than just the expectation
of x bar is mu. It's saying that as
n goes to infinity, the standard deviation
of x bar around that mu gets smaller and
smaller and smaller. So that's going to sound a lot
like Chebyshev's inequality. And we're going to use
Chebyshev's inequality in a minute. But I'll say this a
little bit differently. Let's just compute the
variance of this guy and see what it looks like. So variance of X n
bar, my sample mean-- again these are all
independent random variables. So we know how variance is sum. This is going to equal
1 over n squared. 1 over n squared
times the sum of all of my independent variances, var
of each X i, I equals 1 to n. And each of these
variances is sigma squared. So I'm going to add up n of
these sigma squared, divided by n squared. So this is going to equal
sigma squared divided by n. I have n copies of a
sigma squared variance. But the way that variance
is sum, I get a 1 over n squared factor out front. And you should-- if you don't
remember this, pause the video. Go back to the
lecture on variance and remind yourself
that if I sum up n things with variance
sigma squared, then I will get this
variance of the sum. And this is nice because
it has a 1 over n in it. Sigma squared is a constant. 1 over n gets smaller
as n goes to infinity. So this is kind of obvious
that as n goes to infinity, the variance of my
sample mean goes to 0. And what that means
is that I have a distribution of what I
expect to get for x bar, my sample mean. And as n goes to
infinity, that variance gets smaller and
smaller and smaller around an expected
value of mu, which is kind of what I'm saying here. As I increase the sample
size, the sample mean should converge to
the actual mean mu, and the variance
of the sample mean should get smaller and
smaller and smaller. Meaning I get closer
and closer and closer to mu as I collect
more and more data. This doesn't have
to be true, but it's a really reassuring and useful
property of sample means that they will converge
to the actual mean, and the variance
of that sample mean will get smaller and
smaller and smaller. So if you wanted to formally
prove this statement-- so this is kind of a
little hand-wavy. I didn't actually prove
this exact statement. If I want to do the formal
proof, then what I would use is Chebyshev's inequality. So formally, what we can
say is that the probability of this variable, x bar n
minus mu, absolute value, being greater than
or equal to epsilon, should be less than or equal to
the variance of this quantity divided by epsilon squared. This should be less than
or equal to the variance of my sample mean divided
by epsilon squared. This is just
Chebyshev's inequality. So this statement here is that
very useful Chebyshev inequality that we proved a
couple of videos ago. And this is the thing
here on the left. What I need to show now
is that this goes to 0 as n goes to infinity. And so, this quantity here
is equal to sigma squared over n times epsilon squared. This is sigma squared over
n times epsilon squared. And of course, this goes
to 0 as n goes to infinity. So this is a little
bit more formal. We're actually proving the
formal kind of definition that-- you know, the
probability of my sample mean being more than epsilon
away from my actual mean goes to 0 as n goes to infinity. And we use
Chebyshev's inequality to really tightly bound that. Very, very useful idea-- And maybe I should just
draw a picture here. Very useful idea again, that
if I have an actual mean, mu, and I collect a bunch
of random samples x, these don't have
to be distributed as Gaussian variables. They can be almost anything-- Bernoulli, Poisson, exponential,
gamma, it doesn't matter. If I collect a bunch of these
variables and I average them, that sample mean will start to
have a distribution that peaks around the actual value of mu. So this is my
sample mean, x bar. And if I have a small n,
it'll be kind of a broad peak. I'll have some variance. But as I collect more and
more n, as n increases, this becomes sharper
and sharper and sharper, tighter distributed around
the true average value of mu. Very, very useful result. And the next result will prove
the Central Limit Theorem, one of the most central and
important properties in all of probability and
statistics, goes even farther. And it says that as I
collect these variables and I average
them, this actually starts to become a normally
distributed random variable, regardless of what these
independent random variables are distributed as. No matter what their
distributions are, this sum is going
to start to converge to a Gaussian or
normal distributed variable with this mean
and the standard deviation. Very, very powerful. And this is actually the
basis of Monte Carlo sampling, random sampling, all kinds of
survey sampling and statistics. So sampling a small
population to infer something about a big population, one of
the most important ideas in all of probability and statistics,
Law of Large Numbers. And the follow on, kind
of big brother of Law of Large Numbers, the
Central Limit Theorem, which is coming up next. Thank you.

---

## 41. Chebyshev's Inequality in Probability: Second Order Estimates
**Channel:** Steve Brunton | **Views:** 14K | **Date:** 7 months ago | **Duration:** 9:44 | **ID:** otCHN3s52ho
**Link:** https://youtube.com/watch?v=otCHN3s52ho

### Transcript:
PROFESSOR: Welcome back. OK, we last time derived
Markov's inequality, which is a really
intuitive, simple expression for how much of a
probability density can be, how far to the right of
its expectation value if the random variable
is non-negative. And today we're going
to derive and state Chebyshev's inequality. This one is super
useful, and we're going to use this
specifically to prove the law of large numbers-- one of the most
important central results in probability and statistics
in the next lecture. OK, so Chebyshev's inequality is
a little bit more sophisticated than Markov's inequality. So remember Markov's
inequality states that for a non-negative
random variable, the probability of that
variable being greater than some value a is less than
or equal to its expected value divided by a. And this basically means
you can't have too much mass in the distribution too far to
the right of the expected value, because there wouldn't be enough
room left to balance it out on the other side of
the expected value, roughly speaking. This only uses the
expectation value, though. Chebyshev's inequality is
going to use the variance. It's actually going
to give you a result about how much the variance
kind of tightens or spreads. So this is, I think,
in my estimation, a little bit more useful. So I'm going to state it-- for
any positive number a, for any a greater than 0, then the
probability of X minus mu, the absolute value-- I'm going to again
write it down and then we're going to talk about it. The probability of the
absolute value of x minus mu, this is the deviation
of x from its mean, being bigger than
or equal to a, this is less than or equal to the
variance of my distribution sigma squared
divided by a squared. So essentially,
what this is saying is that I have
some distribution, I'm just going to
actually draw-- I think I'm going to
draw a distribution here because I like having a
picture in my mind of what I'm talking about. I have some distribution here
and I have some mean value mu. And my distribution has a
standard deviation sigma. Then the probability of finding
X minus mu, of sampling X and finding it some distance
away from mu, the probability that that distance
being greater than or equal to a, for some
reason, has to be less than or equal to the variance
of my distribution divided by a squared. This is a little less
easy to say intuitively why this is the case
than Markov's inequality, but we're going to
reason through it. And this is true for lots
of distributions, not just a normal distribution. This would also be
true if my distribution had some weird bumps
in it, presumably. This could be a weird
distribution that is not normal. But if it has this variance
and this expectation, then this is going to be true. This is an important
result. And so we're going to work
through proving it. And then we're going
to try to talk through, understanding a little bit more
about why this might be the case So let's prove this thing. So we're going to
introduce a new variable Y equals X minus mu x-- X minus mu squared. Yeah, good, X minus mu squared. And we're going to define
b equals a squared. There's going to be this a
squared popping out here. So we're going to-- this proof
we're going to go through it. And we're going to make some
assumptions that we're very convenient and non-obvious. It's not obvious why I
would do this to prove this. So Y is going to be
this random variable. And the probability--
we're going to try to relate
this probability here to some probability
in terms of Y and b. That's what we're
going to try to do. So the probability
that this is true, that X minus mu absolute value
is bigger than or equal to a, is the same as the
probability that X-- I can square both sides of this. This is an interesting property. You really need to slow
down and convince yourself. Gerry Marsden used to say,
you need to go to a quiet room or sit in the dark and think
about why this is true, and convince yourself. I'm going to state
something that's true. The probability that the
absolute value of X minus mu is greater than or
equal to a is the same as the probability of X minus
mu squared being greater than or equal to a squared. So I can square both sides
of this and this equality this probability is still-- these are equal. This is an a squared. I just really botched it
with my bad writing skills. This is an a squared. This is true. And now this is equal to the
probability that my random variable Y-- this is just
my random variable Y-- is greater than or
equal to my constant b. This is the probability
that Y is greater than b. And this I can use
Markov's inequality. So I know something about the
expected value of Y. That's going to be basically--
the expected value of Y is the variance. That's the definition
of variance of X. So I don't want to go too fast. I want to remind you
the expected value of Y is the expected value
of X minus mu squared. This is the definition of the
variance of X, which in our case is sigma squared. So we're going to
use this property. So the probability of
Y being bigger than or equal to b, the probability
of some variable being bigger than or equal to
some other number, is less than or equal to
the expected value of Y, to the expected value of
Y, divided by this value b, divided by b. So we just used Markov's
inequality right here. This is from
Markov's inequality. And now I know that
the expected value of Y is equal to sigma squared. And so all of this
equals-- this is all less than or equal
to sigma squared over b, which is just a squared. So the probability-- this
thing I'm talking about here-- this probability of X minus
mu absolute value greater than or equal to a
has to be less than or equal to the variance
of X divided by a squared. It's an outfall of
Markov's inequality in this new variable Y, which
is this squared deviation of X from its mean. And this is a really,
really interesting result. It's kind of like
Markov's inequality which says you can't have too
much mass of the distribution too far away from the
center, from the mean. This is saying if I
have a variance sigma, I can't have too much
of my probability density, too many of my points X
spreading too far from my mean. If I have too much
of my distribution too far from my mean, this
means too far a far away, the probability
of that happening has to be bounded to still have
this variance equal to sigma squared. That's roughly
what it's stating. These are both stating
that to have this variance, I can't have too much
of my distribution too far away from my mean or
else I can't have that variance. That's essentially
what this is stating. These are both super, super
useful theorems inequalities. We use them all the time in
probability and statistics. And soon we're going to use
this to prove the central limit theorem, one of the
cornerstone results in all of probability
and statistics, which states that if I randomly
sample from this distribution X over and over and over, and
I average those samples, that average will converge to
the expectation value of x. And convergence means
that my variance-- that my uncertainty will
tighten and tighten and tighten. My sample mean-- my average
over random samples of X will get closer and closer and
closer to this expected value. So we're going to do
something to bound the variance of the
deviation of that sample mean from the expectation value, and
that's how we're going to prove the law of large numbers. Thank you.

---

## 42. Markov's Inequality in Probability: First Order Estimates
**Channel:** Steve Brunton | **Views:** 14K | **Date:** 7 months ago | **Duration:** 8:09 | **ID:** onZSWfbTeho
**Link:** https://youtube.com/watch?v=onZSWfbTeho

### Transcript:
PROFESSOR: Welcome back. OK, so we're starting
to get towards one of the most important set of
results in all of probability and statistics, which is the
central limit theorem and also the law of large numbers. This essentially tells you how
probability distributions limit in the limit of
large N. For example, if I add up a bunch of
probability distributions, they will limit towards
a normal distribution. And the law of large numbers
states that the sample mean, if I sample a
distribution and average that sample, that will
converge to the expected value of the distribution. And there are some
really, really important mathematical theorems,
Markov's inequality and Chebyshev's
inequality, that we're going to need to prove
those limiting theorems. So Markov's inequality is
a really intuitive one, really simple, and I'm just
going to walk you through it. So it states that if you
have a random variable X, that is non-negative, so it
only takes on positive values, then essentially, the
probability that X is greater than or
equal to a, some value a, the probability that it's
bigger than or equal to a is less than or equal to
the expected value of X divided by that value a. Now, this seems a bit strange. Maybe it's true, maybe it's not. Why is it useful? I'll write down just an
example to build your intuition and then we'll prove it. So the example, let's say
that my expected value of X is equal to 10. Then what this means is
that the probability of X being greater than
or equal to 20-- so here 20 is a-- is less than
or equal to my expected value 10 over 20, which is 1/2. And so in words,
what this means is that if I have some probability
distribution function, let's draw my normal
probability distribution. Remember, X is
strictly non-negative. So it only takes on
positive values from 0. This is X. What this means is
that if my mean expected value is 10, at most half
of my distribution can be to the right of 20. So if I have-- I can't have more than
half of my distribution to be at the right
of 20 and still have enough distribution left
over here to balance it out, to have this expected
value equal 10. That kind of makes sense. This is very intuitive. If my average value is
10, I can't have that much of my distribution too far
to the right of some value because I wouldn't have enough
probability density over here to balance it out and
make it equal to 10. And this formalizes that in a
super useful simple formula. And in fact, my probability
being greater than 20 being less than or equal to 1/2, if half of
my probability is to the right of 20, it actually all has to be
stacked up here at 20 and then the counterweight has to all
be stacked up at X equals 0. So that's the limiting case. The only way I can have
half of my distribution to the right of 20 is to have it
be all at 20 and the other half at 0. If I have less than half of my
distribution to the right of 20, I can have it be
distributed a little bit and I can have my counterbalance
be distributed a little bit. So let's walk through
the proof of this. It's relatively simple. So the expected
value of X, we're just going to write down
this formula, the expected value of X-- and I guess I'm going
to write this down for a discrete
random variable X. But you could do it for a
continuous random variable, too. No big deal. This is the sum over
all possible values that this variable can take of
that value times the probability that big X equals that
specific value of x. And this is going to always
be this-- total sum here because X is positive
and the probabilities are non-negative-- this
is always going to be greater than or equal
to if I started my sum for Xs bigger than a. So if I take the exact
same probability-- the exact same
expression here, but I only limit my sum to being
values of X bigger than a, then this is always less than
or equal to this bigger sum. There's more things
I'm adding up over here and they're all positive. And this expression here of X
is bigger than or equal to a, this is equal to-- checking my notes here. This thing, if X is
bigger than or equal to a, this is also greater than
or equal to the same sum, X greater than or equal to a,
if I replace this X with an a. Probability of X equal x, I'm going to write
this out and then we're going to double-check
that every step makes sense. The expectation of X, this
is just the definition, this is always bigger. I'm adding up over all
possible values little x here. If I restrict myself to
only the values of X that are to the right of
a-- this here is a. This is my a value. If I only restrict myself
to adding up values to the right of a, this
sum is less than this sum because I'm adding up less
of these positive values. And I could replace this
X with a constant a, and up here X is always
bigger than or equal to a. So this is always going to be
bigger than or equal to this. If I replace x with
this constant a, this is always going to be less
than or equal to this expression here. And now I can pop this
a outside and I have this equals a times
the probability that X is bigger
than or equal to a. So that last step
you might have to pause and think about
it for a minute. It's not that complicated. I popped out my a, and then
the sum of the probability X equals little x for
all X bigger than a is just the probability that big
X is greater than or equal to a. That's exactly, like, this is
the definition of that sum. And then this expression here,
I can take this and essentially get this expression. So the probability here
is less than or equal-- a times this
probability is less than or equal to the expectation. So I can divide both
sides by a and I get this probability
is less than or equal to my expected
value divided by a. This is the proof. Very, very useful
theorem or inequality. We're going to use this to
prove Chebyshev's inequality in the next video. And then we're going to
use Chebyshev's inequality to prove the law
of large numbers. So this is a really nice
back-pocket theorem. And it's super intuitive. It says that if you have a
non-negative distribution and you have a mean value,
you can't have too much of your distribution too far
to the right of that mean, because you wouldn't have
enough distribution left to counterbalance. It makes perfect sense. And this is how you codify or go
through the proof of something like Markov's inequality. And there's tons of
theorems like this. So get comfortable with
what we're doing here because it's going to get
a little more sophisticated in the next examples. Thank you.

---

## 43. Two Examples of Expected Values & Functions: Temperature in C vs F, and the Kinetic Theory of Gases
**Channel:** Steve Brunton | **Views:** 10K | **Date:** 7 months ago | **Duration:** 15:26 | **ID:** fB6-lCdkEdQ
**Link:** https://youtube.com/watch?v=fB6-lCdkEdQ

### Transcript:
PROFESSOR: Welcome back. OK, I'm going to work
out two examples that involve the expectation
and variance of a function of a random variable. And both of these are
physical examples. So in this case,
we're going to assume that we measure some
variable for temperature in degrees Celsius, and we want
to convert it to Fahrenheit. Don't ask me why
you'd want to do that. But there's a relatively
simple linear formula to convert from x in
Celsius to y in Fahrenheit. You just use this linear scaling
a plus a constant offset b. And so we'll figure out
what's the expectation value of my measurements
in degrees Fahrenheit if I know it in Celsius. And what's the variance
of this new variable? And this is important because we
want to know, if I change units, do I have to
recompute everything? And if I change units and
offset, how does that change this expectation and variance? So this is kind of
an easy example. And then for a more
sophisticated example, we're going to look at the
kinetic theory of gases. So, of course, temperature
is just a mean kinetic energy of the gas in my room. And we're going to look at
the kinetic theory of gases where we have a random
variable x which is the magnitude of
velocity of a gas molecule. It satisfies Maxwell's
distribution. And we're going to try
to find the expectation value of the kinetic energy. So I'm actually just
going to write that down. The kinetic energy y is
going to be 1/2 mx squared. So x is the distribution
of my velocities. So my kinetic energy
has this distribution. And we're going to
find the expectation of kinetic energy given
Maxwell's distribution for velocities. So these are the two examples
I'm going to work right now. Let's get started. So this one's really easy. I'm going to start with the
expected value of ax plus b. And I'm just going to
write down some math and verify what I think
is the common sense answer that this should be
a times the expectation of x plus b. So let's try it. So the expected
value of ax plus b-- I'm actually going to
write this whole thing out. I'm going to assume x is a
continuous random variable. Maybe it's Gaussian distributed
or normal distributed. So I'm going to use
the continuous form. But you could do this for
discrete just as well. So this is the integral of
ax plus b times f of x dx. And we're integrating
over all of the domain of x, from negative infinity
to infinity if you like. Notice that here,
this expectation value of a function of x,
you take and you replace that function here with little
x in that expectation. So the regular, the
expectation of x would just be the integral
of x times f of x. The expectation of g of x is the
integral of g of x times f of x. I'm actually going
to write that down. The expectation of g of x
is the integral over all of x of g of little x times
my probability density function f of x dx. This is a definition from
earlier-- or not a definition a property we wrote down from
earlier that's really important. That's what we're using here. And because ax plus b is
linear, I can expand this out. And I can say that this is equal
to the integral of ax f of x dx plus the integral
of b times f of x dx. And b is a constant. I can pull this constant
out of the integral. And my integral of f
of x dx is equal to 1. That's the law of
total probability. This is just my probability. Density area under
the curve is 1. So if I multiply it by a b,
this had better just equal b. That's pretty easy. This one, I can pull this
constant a outside of this. Again, it has
nothing to do with x. So I can pull it outside. And then my integral
of f of x dx, that's just my
expectation value of x. So this should equal a times
my expected value of x. And so the expected value of
ax plus b is equal to a times the expected value of x plus b. And this is very intuitive. This is what we thought in
our guts should be true, is that if I measure in
Celsius or Fahrenheit, it doesn't matter. If I have the expected
value in Celsius, I can convert that expected
value directly to Fahrenheit and I get the expected
value in Fahrenheit. So I don't have to do
anything magic to go between these different units. I can either change all of my
data directly to Fahrenheit and then compute the
expectation value, or I can compute the
expectation value in Celsius and then convert to Fahrenheit. Order doesn't matter. And that makes sense because
this is a linear function of x, a linear transformation. That makes a lot of sense. Good. Let's do the next one. This will be slightly more
involved, but not really much. So now, let's look at the
variance of ax plus b. So var ax plus b is-- so var of ax plus b is
the same as the variance of my y variable, my
new random variable y. And that's equal
to the expectation value of y minus the
mean quantity squared. This is the expectation
of the squared deviation of y from its expectation
from its mean squared, this expectation value
beacuse this is just the definition of variance. And so now I can
plug-in ax plus b here. And I know this
expectation value here. So I can plug both of these
in here and expand these out. So I'm going to go
all the way over here. This equals the expectation
of ax plus b, that's just y-- minus-- this is going
to get a little hairy-- minus this expectation of y. And all of this I'm
going to squared. Minus the expectation of y
is a expectation x minus b, all of that quantity squared. And now you'll notice that
right away my bees cancel. And this is a good thing. If I take and I
just shift my data, I shift my distribution,
that shouldn't change the variance at all. That doesn't change the spread. It does change the mean,
but it doesn't change the spread or the variance. So these b's should cancel. That's intuitive. OK, good. And now I'm just
left with expectation of ax minus a expectation
of x quantity squared. And I can write
that as expectation. I'm just going to pull out this
factor of a. a squared times x minus the expectation
of x quantity squared. Property of expectation
values is that a constant-- I can pull out constants. So this equals a squared
times the expected value of x minus its expectation
quantity squared. This is just the variance of x. So this means that
the variance of y is equal to a squared
times the variance of x. So if I scale up-- if I change my units from
Celsius to Fahrenheit, and I scale up by a factor of
9/5, in these new coordinates, my variance actually
is going to be higher. My variance is going to scale
up by 9/5 quantity squared. So variance does get affected
by scaling your distribution. If I make if I scale this, my
variance apparently does scale. That's interesting. So this is important to
know if you are computing mean and standard deviation. But you're going to
be switching units OK. So we have all of
these classic examples of people going back and forth
between these units and missing something that-- some conversion factor. This is a pretty important one,
pretty important conversion factor here. But this all kind of
makes sense intuitively. Good. That's one example. This example is
a little hairier. And I'm only going to show you
the broad brushstrokes of how this works, because the
integral gets kind of nasty and it's not worth going through
20 minutes of nasty integrals here. But I'll give you
the basic idea. In the kinetic theory
of gases, there is this Maxwell distribution
that governs the probability density of finding a particle
of gas, a gas molecule traveling at a certain velocity x. So this is like the
magnitude of velocity or the speed of a particle
follows this Maxwellian distribution. Now, it looks kind
of like a Gaussian, but it's not a Gaussian. It has this weird
x squared out here. The variance is don't match. It's this weird function,
this Maxwell's distribution. And you can actually derive
this from first principles with entropy arguments. It's really quite beautiful. But that's a different course. So if we assume that
the velocity of a gas is distributed according
to Maxwell's distribution, then the kinetic energy
would be distributed-- kinetic energy would be
distributed according to this variable y, which is 1/2
mass times x squared. Now, remember, you can't just
get this PDF by taking this PDF and squaring it. That doesn't work. If you wanted to write down
a partial probability density function for the
kinetic energy, you'd actually have to start with
the cumulative density function and then take its derivative. That's a whole thing. It's an extra bunch of steps. But I'm going to write down
now what is the expectation value of this kinetic energy. And I'm going to, again,
broad brushstrokes, not exact. I'm just going to show
you how this would work. But this is a really
important calculation that people had to do
when they were developing the kinetic theory of gases. This is like, what's the
average kinetic energy? Well, the average kinetic
energy is the temperature. So this is a really,
really important quantity, this expected kinetic energy. OK, good. So the expectation value of y-- I'm just going to
write this down. It's a bit of a mess--
using this formula here is the integral
from 0 to infinity. Why is it 0 and not
negative infinity? Well, because I can only have
positive magnitudes of velocity. There can't be negative speeds. So integral from 0 to infinity
of the function 1/2 mx squared times my PDF in f of x dx. So now we're cooking. We actually have an integral. The expected kinetic
energy of the temperature is going to be whatever
this integral is. And look, it's just
an integral in x. It's a nasty integral in x. But it's an integral in x,
it's got definite bounds. So this is going to
pop out a number. Good. And so you could
write this out as-- I'm just going to
write a couple steps. m/2 root 2 over pi
over sigma cubed times the integral from 0 to
infinity of x to the power of 4 e to the minus x squared
over 2 sigma squared dx. Now, this is where
it gets pretty nasty. So there is a change of
variables that allows you to solve this integral. You could plug this
into Mathematica. You could use a
change of formulas and actually solve this thing. So I'll just say-- I'll tell you what the
change of variables is. Dot, dot, dot
change of variables, dot, dot, dot, where
the change of variables is u equals x squared
over 2 sigma squared. If you use that
change of variables, you get another
integral, which I'm not going to write out all
of the gory details. I'll write it out. Why not? It's 2m sigma squared over root
pi times the integral from 0 to infinity of u to the
3/2 e to the minus u du. And if you're a calculus wizard,
you'll know that this is 2m sigma squared over root pi times
the gamma function evaluated at 5/2. Now, the gamma function
generalizes the factorial to non-integer values. It's a very cool function. It actually comes up a
bunch in probability. There's something called
the gamma distribution. It's a really cool thing. But this gives you a number. You type this into Mathematica,
it pops out a number. And so now all of
this is just a number. And it turns out that number is
3/2 mass times sigma squared. So given that my velocities
of my gas molecules are distributed according
to Maxwell's distribution with this probability density
function, the expectation of my kinetic energy, which is a
function of my random variable, this function of my
random variable-- you go through all
the math, and you get this for the expectation
value of kinetic energy. This is the temperature
of your gas. Very, very useful. And this is fundamentally a
probability and statistics problem. This is physics. But we are assuming that our gas
is distributed kind of randomly according to some
distribution, probably governed by principles of entropy
and least action and things like that. But you go through
all of this math using things we've learned
from expectation values and probability. And you can actually derive
the temperature of your gas. These are just two
examples of how to work through expectation
values and variances when you have functions
of a random variable x. Both of these are
very physical examples of things you might actually
care about as an engineer. Thank you.

---

## 44. Example of Computing the Expectation and Variance of an Exponential Distribution
**Channel:** Steve Brunton | **Views:** 11K | **Date:** 7 months ago | **Duration:** 11:58 | **ID:** Fz9_yqdEt-I
**Link:** https://youtube.com/watch?v=Fz9_yqdEt-I

### Transcript:
PROFESSOR: Welcome back. OK, we've been talking about the
expectation value and variance of a random variable x,
and this conversation has gotten pretty
kind of theoretical. We've done a bunch of
math derivations given a lot of properties,
haven't done a lot of actual calculations. So today, I want to
do a simple example on a very common
distribution that you'll see all the time-- the
exponential distribution. So let's say that we have
some random variable T, and let's say that it is
exponentially distributed, exponential. And remember, the
exponential distribution has this lambda parameter,
the hazard rate. So this is the distribution
for the waiting times between Poisson random events
like getting an email or a phone call or a light bulb failure. Pretty nice common distribution. And the probability
density function for this distribution f of
little t, is equal to lambda e to the minus lambda t. Really, really nice,
well-behaved, smooth distribution parameterized
by a single-number lambda. And so what we're
going to do now is we are going to show
how to actually compute from scratch the
expectation value, I guess, of T and the variance of T. So whatever my
random variable is. It doesn't matter if
I call this T or X or Y. I can call my random
variable Steve if I liked. It doesn't matter. This is a random variable,
and it has a distribution. And we're going to
compute its expectation value and its variance. Let's get started. I'll draw a teeny
little picture here. The probability density is
an exponential function. That's what f of t looks like. Good. So let's just jump right in. The mean, the average is
this expectation value, and the expectation
value is defined as the weighted sum of
all of the values of T times their probability
of occurring. And so for a continuous
random variable like T and exponential
variable, this is equal to the integral
from 0 to infinity. Normally, this would be the
integral from negative infinity to infinity, but this is
only defined for positive non-negative T's. T is greater than or equal to 0. The expectation is defined
as t, the integral from 0 to infinity of t times f of
t. t times the distribution f of t dt. That equals integral 0
to infinity of t lambda e to the minus lambda t dt. This is not trivial
to integrate. It's not like one of the
ones that you know just off the top of your head. But it's pretty easy to
integrate using integration by parts. Let's see what colors
I want to use here. Maybe I'll do orange. We're basically going to say
that u equals t, and v equals e to the minus lambda t. And so du equals
dt, and dv equals-- we're going to say v is minus
e to the minus lambda t. So dv equals minus-minus,
is plus lambda e to the minus lambda t. And so this is
essentially u dv, u dv. There's a dt here. This is u. This is dv. And so we're going
to use integration by parts that is uv evaluated
at the bounds of integration minus the integral
of v times du. So this equals u
times v evaluated at the bounds of
integration, u times v. So that is te to the minus
lambda t evaluated at infinity and 0 minus the
integral of v du. So that's minus
the integral from 0 to infinity of v
du, which is minus. This is minus-minus, is going to
be a plus e to the minus lambda t dt v du. And this is easy
to integrate right. This is just an exponential. This is like first-year
differential equations. We know how to do this. And this guy is
also pretty easy. e to the minus lambda t
evaluated at infinity. Even though I have this t
out here, this decays faster. So the first bound is 0. And if I plug in 0 here, e to
the 0 is 1, and minus t is 0. So both bounds of
integration here are 0. This equals 0 plus a
minus 1 over lambda e to the minus lambda t, again,
evaluated from 0 to infinity. At infinity, this is equal to
0. e to the minus infinity is 0, and at 0, this is 1. And so this just equals
this evaluated at infinity minus this evaluated at 0. So it's minus-minus, is
a plus 1 over lambda. So the mechanics
are pretty easy. You're going to be
using your calculus. You're going to be using
your integration by parts or your substitution
factors, or whatever it is. But computing this
expectation value is a relatively
straightforward procedure. You just go through the
motions of writing down this integral, this first moment
integral, plugging in the PDF and doing some relatively
simple calculus to get to this expectation value. Good. And you can do the same
thing for the mean-- sorry, for the variance
and the standard deviation. So I'm just going to
write those down here. So if I have the variance-- remember, the
variance is Var T is going to be equal to the
expectation of T-squared minus the expected value
of T quantity-squared. This is the expected
value of T. So I can just plug in 1 over
lambda-squared here. But now I have to compute
this expectation of T-squared. So expectation of T-squared is
equal to the integral from 0 to infinity of-- now, I'm just
going to plug in t-squared here. Remember, there's this property,
the expectation of g of T, is the integral over the bounds
of integration of g of t, f of t dt. So I literally just
take this t here, and I replace it with the
function I'm computing the expectation value of. So if my function is t-squared,
I just replace t here with a t-squared. So this becomes a little
t-squared lambda e to the minus lambda t dt. And I'm going to let you work
out the kind of gory details here equals dot,
dot, dot, equals. And this guy,
expectation of t-squared is going to be 2
over lambda-squared. So this term is 2
over lambda-squared. This term is 1 over
lambda-squared. So minus 1 over lambda-squared. And so my variance
of this exponentially distributed random variable
is just 1 over lambda-squared. Pretty nice. And of course, that means-- I'm just going to
start writing these. So the expectation of
t equals 1 over lambda. Var of T equals 1
over lambda-squared. That means the
standard deviation of T is the square root of
this, equals 1 over lambda. That's pretty interesting. The standard deviation
is equal to the mean. So the mean value and
the standard deviation are equal to each other. So I want you to think
about if that makes sense. Is that what you expected? Is that weird? Is that partly responsible
to this memoryless effect of this distribution? I want you to think about,
does this make sense? Good. And maybe one last
quantity that I think is actually quite important
for you is the median. So the median value,
which is a robust kind of neighbor or cousin
of the expected value. The median of this
distribution, the median of T, is the value of little t such
that half of the distribution-- 1/2 of the weight of the
distribution is on the left, and 1/2 of the probability
of the distribution is on the right. This would be the median. And the way you
would find the median is you would find the cumulative
density function of f. And you'd find the point where
half of that cumulative density is to the left, and
half is to the right. So you'd find the
cumulative density, the little t where the
cumulative density equals 1/2. So let's just write
that out, f of t. The cumulative density is the
integral from 0 to t of this dt. That's equal to the
cumulative density. And I think this was one of
my homework problems earlier. But I'll just write it down. The cumulative density,
given this guy really easy to integrate. I think it's 1 minus e
to the minus lambda t. Yep, that's right. And the median T is the value
where f of t equals 1/2. So I'm trying to find the value
of t that makes this equal to 1/2. So if this equals 1/2, I can
subtract 1 from both sides. That's negative 1/2,
divided by negative. So now I have e to the
minus lambda t equals 1/2. And so I do log, divide
by negative lambda. And I get t equals log
of 2 divided by lambda. That is the value of t at which
my cumulative distribution equals 1/2, meaning
it's my median T. So my median value is natural
log of 2 divided by lambda. So it's interesting. It's slightly different. It's my mean times log of 2. It's a little bit
shifted as the median. And that's also kind of
an interesting value. So I just want you
to get comfortable. These are not super
complicated to compute. Sometimes you use
a little calculus. Sometimes I omit steps
and let you do this. But these are easily computable
for normal distributions, exponential distributions. Some of them are a little
harder than others. Pretty easy for Poisson. So that's a good
homework problem, is to go through all of
this math for the Poisson distribution to find the
expected value, the variance, the standard deviation,
and the median. And just be comfortable
that you can actually compute these things and
understand and analyze them. Thank you.

---

## 45. Properties of the Expected Value
**Channel:** Steve Brunton | **Views:** 15K | **Date:** 8 months ago | **Duration:** 10:18 | **ID:** 8rnzHE2UtoM
**Link:** https://youtube.com/watch?v=8rnzHE2UtoM

### Transcript:
PROFESSOR: Welcome back. So we introduced this
notion of the expected value of a random variable x
or the expectation value, and gave some formulas and some
intuition for what it meant. Now I'm going to tell you three
of the most important properties of this expected value. This is a function of
my random variable x. Three of the most
important properties of the expected value. We're going to use these
when we derive the variance and standard deviation. We're going to use
this all over the place in the next few lectures. Now, if you want an example
of how to actually compute this expected value for an
actual probability density function, I think one of
the next couple of videos will give you an example. So you can just
fast-forward to that if you want to see an example
first and then come back to this one. But I want to
start here for now. So the properties I'm
going to show you-- and I'm going to
state two of them, and I'm going to
prove the third one. The first property, and this
is maybe the most important property, is that if I have
random variables, x and y, then the expected value of
x plus the expected value of-- sorry, the expected
value of x plus y-- this new random
variable x plus y-- is simply the expected value of
x plus the expected value of y. And this is true for any
random variables, x and y. They don't have to have
the same distribution. They can be different. The expected value
of x plus y is going to be the
expected value of x plus the expected value of y. And this works for larger sums. The expected value
of x plus y plus z is the sum of those
three expectation values. Super, super useful property. And in fact, this is a good one
for you to just verify yourself. You can pause the video and
use these formulas to convince yourself that this is true
for a discrete random variable or for a continuous
random variable. That's pretty helpful. That's one property. The second property is-- and this one, again,
is super, super useful. If x and y are independent. And we know what
independent means. It means that the
probability of x, y equals probability of x
times probability of y. The joint density function
is the product of the two individual density functions. If x and y are independent,
then the expectation value of x times y is equal to
the expected value of x times the expected value of y. And I'll actually prove
this one in a minute. We will just write
down a proof for this. And this expectation is
not equal to the product if they are jointly dependent. This is only true if these
are independent variables. Really important. And three, this one
we're going to use in the derivation
of the variance. So that's why I
wanted to introduce it right now while
expectations are fresh. And we're about to go to
standard deviation and variance. If I have some random
variable y, which is a function of my
random variable x, then the expectation of
y, the expected value of y, which of course, is
the expected value of g of x, is simply equal to
for discrete time-- sorry, for discrete
random variables x, not discrete time--
discrete random variables. We essentially
take this formula, and we replace x with g of x. This equals the sum of g of
x times the probability of x summed over all of little x for,
let's say, discrete variables, for discrete x. And for continuous
random variables, this would equal the integral
from negative infinity to infinity of g
of x, f of x dx. This is not obvious. This one is actually not
obvious that the expected value of a function of x would--
you would just replace x here with g of x or g of x. That's not at all obvious. You can prove it, but it's
a little bit involved. And I'm not going
to do it right now. So I want you to just know
that this is an important fact. So for example, the
expected value-- let's just as an example. The expected value
of x-squared-- what I would do is I
would say at least if this is a continuous
random variable, this would be the integral
from negative infinity to infinity of
x-squared f of x dx. And this is the second moment
of my random variable x. This is a useful
quantity that we're going to use when we
derive the variance and the standard deviation. So this is going to be useful. That's why I wanted
to show you this. Property three is not
super-duper obvious. You can convince
yourself but just take-- if it doesn't look obvious,
it's because it's not. This one, you can
convince yourself of. And property two,
I'm actually going to derive right now for you. So property two. Let's say that I have
two variables, x and y. And I want this
expectation value. So the expected
value of x times y. This is a new function. This is going to
be-- and I'm going to do this for a
discrete random variables just because it's
a little easier. But you could do it
for continuous also. This is the sum
over x and y of x times y times the joint
probability density that my random variable
x equals little x, and my random variable
y equals little y. This is just the definition
of this new random variable. If I had a joint
distribution, it would be this
function, which is x, y weighted by the probability
of my random variable x equaling x and y equaling y. If x and y were
jointly dependent, they were not independent,
then I couldn't split this probability. But because they
are independent, I'm going to be able to
split this probability. So I'll make a very big caveat. If independent, then we
can do this next step, which is now I'm going to break
this probability up into-- so still summing over
x and y, x times y. Now I have the
probability of x equaling x times the probability of
my random variable y equaling the specific value y. And now what I'm going
to do is I'm just going to move
these things around based on what depends on what. So if I'm summing over x,
I can move my summation. I can swap the places of
my summation of y and x. And I can move things
around a little bit. Maybe I'll switch colors here. So this is going to equal a
sum over x times probability x equals x times my sum over y. And I should probably
keep my x out front here. I'm going to keep my x and my
probability of x and my sum times the sum over y of y
probability that y equals y. And you can convince
yourself that I can move these things around. This is again because
these are independent. This function of x has
nothing to do with y, and this function
of y has nothing to do with x because
they're independent. So I can swap these orders. This is just the
expectation value of y, and this is the
expectation value of x. This product here is
just expectation value of x times expectation
value of y. And you can use
similar arguments to prove this first
property here if you like. So really, really
important three properties. Linearity-- the expectation
of sums of variables is the sum of
their expectations. Probably the most useful. Expectation of a function
of a variable-- you just plug that function in
to the definition of x to the definition of expectation
you plug in that function where you see this x. And then for independent
variables, x and y, the expectation of the
product is the product of the expectations. Really, really straightforward. Really simple. I guess you could probably
generalize this one. Also, you could say expected
value of g of x times h of y is the expected value of
g of x times the expected value of h of y if x
and y are independent. And then you could use this
third property in here. So you can mix and
match these things. But I want you to
be careful and think about when the assumptions are
valid and when you can do this and how you would
compute these things. I also want you to
think about a case where x and y are
not independent, and I want you to come up with
an intuitive example of why this would not be true for a
case where x and y are not independent. Good. Thank you.

---

## 46. Variance and Standard Deviation
**Channel:** Steve Brunton | **Views:** 17K | **Date:** 8 months ago | **Duration:** 12:59 | **ID:** dmSRMYQsM8w
**Link:** https://youtube.com/watch?v=dmSRMYQsM8w

### Transcript:
PROFESSOR: Welcome back. OK, so in the last
couple of lectures, we have defined
the expected value of a distribution x,
this kind of expectation of a random variable x which
measures the center of mass of that distribution. For a nice well-behaved
distribution like a Gaussian, it is actually the most probable
and center of the distribution. Today, we're going to introduce
the variance and standard deviation of a
random variable x. So if the mean mu as
the measure of center of mass of the distribution,
then the variance of x-- and I'll define it in
a minute-- the variance in x measures the average
squared deviation of x from that mean value. This measures the
average square deviation of x from this mean value mu. And the standard deviation
is just the square root of the variance. So let me draw a really
quick picture here because I think this will help. Maybe I'll start in yellow. So let's say I have some
probability distribution function like this
nice Gaussian. Then the mean, the
expected value, is the kind of center
of this distribution mu. The variance is
how much spread-- what is the expected
squared deviation of x from this mean value mu. And maybe I'll also write
down the standard deviation-- the standard deviation
of X, SD of x. This essentially
measures the spread. And spread is a
non-technical word. We can define it as
a standard deviation, if you want-- the spread of
the histogram of the PDF of x. So for example, in the
Gaussian normal distribution, the standard deviation are
these plus or minus kind of sigma points,
plus or minus sigma where sigma is the
standard deviation, inside of which about
68% of the distribution lives within plus
or minus 1 sigma. 1 sigma and then you have
2 sigma, two standard deviations 3, 4, 5. So mu measures the
center of mass. Standard deviation
measures the spread. And the standard
deviation, SD of x, is just the square root
of the variance of x. So I'm going to write down
now what the formula is for the variance. We're going to show how it
works and how to compute it and then zoom back out and
talk about it with respect to these distributions. And this is a really,
really easy idea here. So let's start with
this variance of x and maybe I'll just do it
over here for a minute. So the variance
of x is defined-- this is the definition. So maybe I'll do like a
little triangle equals-- this is defined as the expected
square deviation of x from mu. It's a weird mouthful. I'll write it down. It's actually going to
be more sensible in math. It's the expectation
of my variable x minus the mean quantity squared. So we know that mu
is the mean value. It's the average value. But if my distribution
has some spread, if I randomly
sample values of x, they're probably not going
to be exactly equal to mu. There's going to
be some x minus mu. So what is the expected
value of the square of that spread, the square of
the difference between x and mu? What's the expected value of
the difference between x and mu squared? And that gives me an idea
of-- if I have really, really, really long tails or
a really wide distribution, this is going to be bigger
because I'm expecting x minus mu to be pretty large most of the
time that I randomly sample x. That makes a lot of sense. And we can essentially
derive a very useful formula. So this is also equal to-- and this is something we're
going to have to derive. So this is not obvious. This is something we
would have to derive, that this is equal
to the expectation value of my variable x squared,
the square of my random variable x, the expectation of x
squared, minus the expected value of x quantity squared. OK, this is interesting. I'll derive this
for you in a minute. This is a very useful quantity. This thing is hard to
necessarily work with. It's a little messy. This thing is a lot
easier to work with. Expectation of x is just mu. So this is just
minus mu squared. If I know the mean, I don't even
have to compute the second term. And now I only have to
compute this term, which is the second moment of my
probability distribution over x. So this is a useful property. So maybe I will
derive this now here. So the variance of x
is this quantity here. So var x equals
the expected value of x minus mu quantity squared. And I can actually
expand this thing out. I can do math on this. This is a function of
my random variable. This is just some g of x. And we know actually how
to compute expectation of g of x from an earlier video. But let's actually
work this out. So this is the expectation of
x squared minus 2mu x plus mu squared. And because of a really
important property of expectation values,
the expected value of the sum of three terms is
the sum of the expectation value of each of those three terms. So this equals
expectation of x squared-- I can actually pull
this two out but I'm not going to yet-- plus
expectation of minus 2 mu x plus expectation
of mu squared. Now, the expectation of a
constant is just that constant. That's really simple. The expectation of
that constant-- you can actually do this using
the formula for expectation. You plug in the expected
value of a constant. It's just the sum of
that constant times the probability of
all of the states. And those probabilities
add up to 1. So you just recover
the constant. This is kind of an exercise. Maybe I'll switch. I'm just going to write
some things down here. So this is just mu squared. The expected value
of a constant times x is just that constant times
the expectation value of x. So this is minus 2
mu expected value of x, is minus 2 mu squared. That's this term. And this expectation
of x squared is just expectation
of x squared. So all of this adds
up to the expectation of x squared minus
mu squared, which is minus the expectation
of x quantity squared. So that proves this
useful formula here that we just derived. So we essentially derived
from this this useful formula. So if you have the mean,
all you have to compute is the second moment this
expectation of x squared. And we know how to compute the
expectation of a function of x. This guy here, I'll
just write it down, the expectation of a
function of x like x squared. Let's say we're dealing with
a continuous random variable like a Gaussian here. This is going to be the
integral from negative infinity to infinity of x squared times
my probability density dx. So this is an easily
computable quantity. You just plug in
your x squared here. This is the second moment
of this probability density function. Second moment. And remember I said that
there are more moments. The first moment was mu. The second moment
is this quantity. There's a third,
a fourth, a fifth. There's an infinite
series of moments that characterize funky
distributions that have weird behavior
and asymmetries and things like that. And it's kind of like
the Taylor series. It uniquely identifies
your probability density. But if you have something
nice and well-behaved, like a Gaussian, it's
completely characterized by these two numbers, its first
and second moment, its mean, and its standard
deviation or variance. Its average value and the
spread of the function uniquely determines the Gaussian or
normal distributed function. So really, really useful. And this is something
we can compute. So in next example,
we're actually going to compute the expected
value and the variance and the standard deviation for
the exponential distributed random variable for a
Gaussian for a normal. So if x is a
normally distributed random variable with
mu and sigma squared is the parameters, which
I think the PDF for this would be f of x equals 1 over
root 2 pi sigma e to the minus x minus mu quantity squared
over 2 sigma squared, I hope. If this is the PDF, then you
can actually go the other way. From this PDF for this Gaussian,
you can show that the expected value of x is mu-- this is the
center of the distribution-- and the variance of
x is sigma squared. That's how much spread or
deviation from mu you expect-- squared deviation
from mu you expect to have in your distribution. Is there anything else
I want to tell you? Kind of a homework problem
I think you should know, you should do this yourself. Why is the variance always
greater than or equal to 0? I'm taking something
minus something. Why is this always going to
be greater than or equal to 0? I want you to think about that. Why is the variance
always a positive number? That's kind of a cool
question for you to ponder on. And then one other fact I want
to point out-- this is very, very important-- is if x and y are independent-- again, I always
want to write down what happens if you have
independent variables, it's super important-- then the variance of x plus y
is equal to var x plus var y. This is not obvious. You'd actually have to
show that this is true. But for independent random
variables x and y, this is true. This is very much not true
if x and y are dependent. So for example, var of 2x is
absolutely not equal to 2 var x or var x plus var x. I'm pretty sure it's
equal to 4 var x. So this is definitely not true
if x and y are not independent. But it is true if
they are independent. So taking a step back, mean
and either variance or standard deviation are very,
very useful ways to quantify the behavior of
well-behaved distributions like a normal distribution. In fact, they
uniquely characterize a normal distribution. And they are the
first of many moments that will characterize generic
funky, weird distributions. So this distribution
might need more moments to uniquely
characterize it, that generalize the notion of
mean and standard deviation. OK, thank you.

---

## 47. The Expected Value (Mean) of a Probability Distribution
**Channel:** Steve Brunton | **Views:** 32K | **Date:** 8 months ago | **Duration:** 15:24 | **ID:** CBgCR1kHSUI
**Link:** https://youtube.com/watch?v=CBgCR1kHSUI

### Transcript:
welcome back so today I am going to introduce one of the more important Concepts in probability and statistics that of the expected value of a random variable X sometimes this is called the expectation value um and it's kind of if you we're going to randomly sample from this distribution a bunch what would you think the average of those samples would likely be that's essentially what this expected value is and so for a given distri bution this is uh my kind of regular gaussian distribution over some variable X um in this case the expected value is actually going to coincide with the most likely value the kind of uh mean of the distribution mu but that's not true for every uh probability distribution for every random variable X sometimes you get counterintuitive or even misleading results and I'm going to tell you about that in a minute so approximately speaking the expected value is the center of mass Center of mass of your distribution um of your probability of distribution of your uh probability distribution okay this probability density function over your random variable X and the way we compute It Is by essentially taking a weighted average of all of the values of X weighted by the probability of actually finding that value of x so um I'm just going to write this out in math the expected value of x in I'm going to start with a discrete random variable something like uh bernui or uh binomial or Pon something that has a discrete number of elements and this is going to be we're going to sum over all elements of X so uh we're going to sum over all of the possible values this variable can take on and generally these are going to be like integers I'm just going to say like sum over all of K um the value x k that that this V the random variable could take on so I'm I'm adding up the actual value of my random variable times the probability of X equaling that uh that specific value X subk and if I wanted I could write this a little bit more uh carefully and I would say that this is the probability that my random variable x equals a specific value little XK okay so this is literally just a weighted average of all of the values little XK that my random variable could take on so let's say I'm flipping coins um you know I flip my fair quarter a 100 times um and my random variable X is the number of heads then I would sum up over all possible numbers of heads so if I flip it 100 times I could get zero heads one heads all the way up to 100 heads so I'd add up you know 0 to 100 are the values here times the probability of actually getting that specific number of heads which would follow the binomial distribution and I could read those values off of let's say Pascal's triangle for example so this is computable and it tells me my expected number of heads that I would be most likely I would I I wouldn't be surprised at all if I got 50 heads so I'm guessing this should be something like 50 for the binomial distribution with 100 coin flips I can also write this in continuous uh random variables things like my gausian normal distribution where X is a continuous variable and now this is going to be an integral so for continuous variables I'm going to have uh e my expected value of x is now just going to be the integral over all possible values X can take so generically from minus infinity to Infinity of x times my probability density function f ofx uh DX okay again just a weighted average of every little X that I could possibly take in this distribution times its probability of actually hitting that little x * DX okay um and so this is expected value for discret variables and continuous variables here um and there's another interpretation this is a very very very useful interpretation and again this right now I'm talking kind of his probability but there is this notion of Statistics if I actually collect measurement dat data from The Real World I measure a process I actually flip that coin 100 times or I go on the street and I ask a thousand random people what's their height um then I'm going to be getting sample data that maybe will approximate these distributions and so if I sampled a bunch of uh if I sampled x a bunch of times if uh I sample X I'm going to say x uh J n * if I sample xn independent times and I average and average then this mean uh xar equal 1 / n * the sum from uh J = 1 to n of all of my independent trials this is my sample mean I'm going to put this in uh in parentheses this is my sample mean okay my sample mean will converge as n goes to Infinity to the expected value of that random variable uh then this sample mean will converge the limit as n goes to Infinity of xar will equal will converge to uh this expected value which I'm going to call MU it'll uh equals my expected value of X and this is a really important result we're going to come back to this this is actually um this is the law of large numbers we're going to we're going to prove this later um but essentially this is just a statement of the law of large numbers that if I sample my distribution enough and average that sample it should converge to the analytic expected value uh of that distribution I should converge my my sample mean should converge to the true mean of that distribution and my you know kind of variance around that mu will shrink as n goes to Infinity very very very important result here and it's another uh kind of example of what this expected value means it's the limit of the average of a bunch of Trials of this random variable and later we're actually going to code this up we're going to do a 100 coin flips and we're going to see how that starts to converge and we're going to do that a bunch of times and see the variance uh of those sample means and that's going to tell us lots of things about the statistic and we can always invert that and ask questions like if I gathered 50 samples and here is my mean How likely is it that it is a that it's actually being sampled from this particular distribution How likely or unlikely is it that I got this sequence of samples um you know given things like its mean and its variance okay good um this is super useful super simple but it also can be quite misleading okay so I want to point out a couple of things that can be pretty misleading here this is a gaussian distribution where the mean mu is the expected value here is another completely different distribution in yellow this distribution has the exact same expected value the exact same Center of mass of the distribution and in fact that value has zero probability of actually of of actually sampling an element that has that value all of the weight is in these two kind of these bodal Peaks here and so this yellow curve has the same expected value but it's a completely different distribution and in fact that distribution you would never expect to actually sample um an instance of X that had that value me so that's kind of weird um weird things can happen with oddly shaped distributions okay I need other numbers other parameters to Define this distribution and to distinguish these two one of those numbers is going to be the standard deviation so the expected value is kind of the average the standard deviation or variance is going to measure how much spread my my distribution has so the yellow one clearly has more spread than the the pink curve and that would distinguish these two um and this is called your first moment the expected value is your first moment kind of like your moment of inertia it actually looks a lot like a moment the variance and standard deviation are related to the second moment and it turns out there are higher order moments third fourth fifth and so on and taken together those higher moments almost are like a fingerprint for your distribution so if I know all the moments of this yellow distribution and all the moments of my pink distribution I can say a lot about them and I can distinguish them it's almost like the tailor series for a function it's like an expansion of your probability density in terms of the mean the standard deviation the third moment fourth moment fifth moment so I'm just going to make a little note of that that um this is the first moment these are called moments uh mu this expected value the second moment would have to deal with um the standard deviation or the the variance but there are more and more moments dot dot dot Dot and these moments are like a fingerprint or like a tailor series kind of expansion of your probability density and we're going to use this later it's fascinating stuff this is related to the Lao transform of your PDF um Lelo comes up everywhere in probability and statistics and this is one of the coolest places is in this moment generating function that generates these moments but that's an aside um really what I was trying to tell you is that I can have distributions with the same expected value that are completely different and the expected value doesn't actually mean that it's even likely that I find my distribution at that point kind of weird okay so it's not likely the most it's not necessarily the most likely value of x um so in fact I'm going to define a couple things here so the most likely value of x is called the mode this is the uh most likely value of x to find my function the literally the the value of X that has the highest probability okay there is the the mean or the average that's what we computed here that's the expected value this is the uh kind of weighted average and then there's a third uh value called the median and that's actually often times the most useful for uh statistics where there's outliers or weird distributions the median uh and this is what we call the middle of the distribution okay so it's literally the value that's in the middle of the distribution which weirdly in this yellow case is actually still at mu so this is maybe not the best example of median um and I'm going to write out and Define what these are in a minute but I want to point out um this notion of the median being robust um this is a robust way of doing statistics so if you have outliers the expected value is highly sensitive to outliers the median is very robust to outliers what do I mean by outliers um let me give you an example so let's say I have the distribution of wealth um let's say like the amount of money people have in their banks in the US okay and let's say that nominally it looks like this there's kind of a fat tail but there's a peak and there's a distribution this is you know the amount of of wealth people have in a given country but there are on the far far far far ends of the tale people like uh Jeff Bezos and Bill Gates and Elon Musk and there are only a few necessarily of these people that are like ultra wealthy you know hundred billion dollar net wealth but that actually moves the mean significantly so the mean of the distribution actually gets well uh off of what you would expect kind of if you didn't have these outliers what the mean would be but the median uh which is robust is actually going to do a good job of capturing this peak here okay and I actually looked up the numbers it's pretty shocking the average sorry the median us household uh wealth the median is about 200k that's kind of approximately the peak of this distribution the average household wealth is 1 million1 million dollar and that is almost entirely because of these huge outliers so these outliers aren't just moving the the mean a little bit they're moving it by a factor of five that's how much money there is in these taals this anomaly these uh kind of rare events or outliers out here are shifting the whole expected value of this distribution so the median the middle of the distribution is much more robust to to the those few outliers on the other side so I'm going to write out what this means the middle of the distribution is X such that um the cumulative density function equals 1/2 literally half of the probability is left and half of the probability is to the right the mode is the most likely it's literally the X such that my probability density of X is maximized you could write this as the argmax of P of X or F ofx that's so fine and the mean or average is this expected value of x this expectation of X that we're calling Mew here okay good um that was a lot that's a lot of information that's probably all I want to tell you um is essentially the expected value is a very useful quantity in probability and statistics it is one of the most important numbers that characterizes a distribution but it's not the only important number I also need to know the variance and the higher order moments it is highly sensitive to outliers so if you think you have outliers or rare events the median might be a more robust Choice um but expectation is easy to calculate and it also will converge to the S the sample mean will converge to the expected value um in statistics in the large n limit That's the Law of large numbers and we'll prove that later okay thank you

---

## 48. Joint Probability Distributions: Marginal and Conditional Densities
**Channel:** Steve Brunton | **Views:** 20K | **Date:** 8 months ago | **Duration:** 9:36 | **ID:** pribJ8bUBzo
**Link:** https://youtube.com/watch?v=pribJ8bUBzo

### Transcript:
PROFESSOR: Welcome back. So in the last lecture,
we introduced this notion of a joint probability
distribution between two random variables, x and y. Essentially, you can
define a probability of x happening and y happening. This is kind of
what we had before, where it's the
probability of x and y from conditional probability. And that notion
is actually going to help us use these joint
distributions to compute conditional densities
and something called the marginal density. So these are important
concepts you should know. One of the reasons I really
liked the probability and stats course I took, which was kind
of a senior undergrad class, is because it allowed
you to do calculus. So calculus is a super powerful
way of handling functions like probability densities. And the marginal and
conditional densities are essentially
things that you get if you do clever calculus on
these joint distributions. And they're related
to the notion of conditional
probability from before, things that we use to
derive Bayes' theorem and things like that. So we've already seen that you
can have joint distributions like this two-dimensionally
symmetric Gaussian in x and y, where each of x and y is itself
distributed as a Gaussian. And I hinted that if you take
this two-dimensional Gaussian probability density and you
just average out the x variable, you'll get a Gaussian and y. And if you average
out the y variable, you'll get a Gaussian in x. And I just want to
formalize that here. Those are called the
marginal density functions. So if in a continuous
random variable x and y, we know that our probability
density function-- I'll just write this down--
our probability density function is given by
this function f of x, y. And I can compute the
probability of my random variable x and y living in some
2D area by just integrating this thing up over all of those
little infinitesimal dx dy's in that area. That's the PDF. And the marginal density is
defined in the following way. The marginal density. So we've heard
marginal all the time in economics and statistics. Marginal density
essentially allows me to take this PDF in
x and y, this joint PDF. Let's call this a joint PDF. And it allows me
to write a PDF just in terms of x by averaging
out the y variable. So I can get the
marginal density f just in terms of
the x variable f of x. And this is essentially
what I would get if I take this
joint distribution and just integrate
out the y variable. I'm basically saying, what is
the probability of x conditioned on something in y happened. Any y can take on
all of these values. I'm just going to integrate over
all the probabilities of all of the things that could
happen in the y-direction and get rid of that y variable. So this equals the integral
from minus infinity to infinity of my joint
probability distribution f of x, y dx dy. Good. And that's it. It's a really, really
simple definition. You literally just--
sorry not dx dy, just dy. It's a really, really
simple definition, where essentially
what you're doing is you're just
integrating out the y variable to get a function that
only depends on the x variable. And again, roughly
speaking, remember the law of total probability. Something has to
happen. y has to take on one of the possible values
that this random variable could take on. So if I integrate out all of
those possible possibilities of y, then I'm left with just
a probability distribution of what x is going to
be kind of averaged over all of those things
that y could have been. And you can do this again for y. That's pretty easy. You can build the
marginal density in y. It's exactly the same thing. But now we're integrating
out the x variable. In discrete random variables,
these are continuous. In discrete random variables,
it's the same thing. So if this is a
Bernoulli random variable or a Poisson random
variable, you can do the same exact thing,
where now if I have this P x, y, I can derive a probability
just in x that essentially of little x. And what it is I'm going to
take this distribution here, this x equals x, y equals y. And I'm just going to average
out all of these y variables. So I'm going to say
I'm going to add up all of the possible
probabilities over all of the possible states that
my y variable could take, and I'm going to
essentially average out this y variable to get something
that's just a function of x. I have too many
parentheses here, but that doesn't really matter. So that's a really simple
idea of this marginal density function, and it's just
something you can define. If you have a
joint distribution, you can average out
one of those variables to get just the
distribution in x. Things I want you to do is to
verify that this is actually a well-defined PDF. If you integrated this from
negative infinity to infinity, it had better equal 1. So make sure that you actually
believe that these really are PDFs. And make sure that
you think you can go back backwards and forwards. So you can actually
look up the formula for a two-dimensional Gaussian. I'm going to write down
what I think it is. e to the minus, let's say
x-squared plus y-squared divided by 2, 1 over root 2 pi. There may very well be
an integration factor I'm missing here. But let's say that
this is f of x, y. You could easily write
this as f of r comma theta. This is just r-squared. So you could write this
as f of r comma theta. And I want you to go through the
exercise of going back and forth between these marginal
densities and this probability distribution. Convince yourself
that this makes sense that you can manipulate
these things. And then try it on some
simpler distributions too. One last thing I
want to point out. There was this notion that
was super important earlier of a conditional probability. So all of Bayes' theorem
and inverse statistics is based on this
conditional probability, and figuring out the
probability of x given that we know y happened or vice versa. And so I just want
to write down how this looks using these
joint distributions. So the probability--
and I'll do this in a discrete random variables. First, the probability
that x takes on some value given that y
takes on a little value y is going to be my joint
probability distribution. Probability of x, y divided by
the marginal probability of y, which I didn't write down here--
but it's exactly the same, where you just average out x-- divided
by the marginal probability of y. And I think you can actually-- I want you to go back
a couple of lectures to the conditional probability
and to the Bayes' theorem, and I want you to write down a
page on a white sheet of paper. I want you to write down
that version of this math, where now the probability
of x and y happening is probability of x and y,
kind of probability of x and y, divided by the probability of y. This is almost
identical to what we wrote down in conditional
probability earlier. This is now just using
these distribution functions to make it a little
bit more formal. This is a function over
all values of x and y, which is a little
bit more general. And similarly, we can do
this in continuous time. I'll just write this down
because it's pretty cool. The probability density of-- here I did x given y. Down here, I'll
write y given x just to make it more interesting. And you can again just
flip the variables. And you get y given x. No big deal. So the conditional probability
distribution of y given x for a continuous
random variable-- this is of little
y given little x-- is just equal to my
probability distribution x, y divided by my marginal
density for x, this fx of x. And again, you can
convince yourself. This is really like
the probability of x and y divided by
the probability of x. So this is very much
like what we did before in conditional probabilities. Now we're defining these
conditional density functions. Nothing here was complicated. It's a lot of
information, but I think it's all useful information. From your discrete and
continuous joint probability densities, you can
derive marginal densities where you integrate out
one of the variables. Or you can write down
conditional densities where it's the
probability distribution of one variable given that you
know another variable exists. Or sorry, it takes this value. And this is essentially
creating a distribution out of those conditional
probabilities that we wrote down earlier. Thank you.

---

## 49. Joint Probability Distributions
**Channel:** Steve Brunton | **Views:** 41K | **Date:** 8 months ago | **Duration:** 14:34 | **ID:** NBo5bXIX7Ac
**Link:** https://youtube.com/watch?v=NBo5bXIX7Ac

### Transcript:
PROFESSOR: Welcome back. Okay, so we've introduced the
concept of random variables and probability distributions
over those random variables. Now it's time to talk about
joint probability distributions. So this is not how
you would hand out 100 joints at a Phish concert. This is how two random
variables may or may not depend on each
other, and jointly affect some probability of
both of those events happening. So given two random
variables x and y. So x and y are two
random variables. They don't have to be the
same distribution-- two random variables. I can define a joint
probability distribution as the probability
little x, little y. This is the probability
that my random variable x equals x, and my
random variable y takes on the value little y. This is a really simple idea. We've already talked about
conditional probabilities. What is the chance of x
happening given that y happens? This is very, very
closely related. And here I've
drawn this, or I've written this in a discrete,
random variable form. But you can also do this in
continuous random variables. And I'll do that
in just a minute. So I just want to give
a couple of examples to motivate why we're
introducing this new concept. So a number of examples. In fact, there's
a ton of examples. So one of the ones I
think about a lot is if you have a turbulent
fluid, then the velocity components, the x, the y, and
the z velocity components, are jointly distributed random
variables for a turbulent fluid. So in turbulence, the u, v, and
w velocity components in the x-, y-, and z-directions are jointly
distributed random variables, and that joint distribution
would depend on the fluid flow of interest. If I have random,
isotropic turbulence where direction doesn't
matter, maybe these would be independent. I don't know. If I have a boundary layer where
the flow is going from left to right in the
x-direction, there will be a very
specific structure to this joint
probability distribution of how v and w and u correlate. So that's one cool example. Another big example is in
things like population health and medical outcomes. So if you have patients'
biometrics and demographics, so let's say health and patient
demographic but also biometrics. So there will be
correlations, for example, in probability of heart disease,
given that I am a 40-year-old male living in the
US, in Washington. Those demographics
and biometrics. And let's say I'm 6 feet
tall and a certain number of kilograms, that,
taken together, can inform a joint distribution
of different health outcomes, that might
be relevant to make actionable decisions based on. And actually, this is
super, super closely-- when you have these joint
distributions of things like this. This is one of the
underlying assumptions that goes into the principal
components analysis. So lots of you have
actually already seen PCA, principal components
analysis, before. PCA. This is how you take
high-dimensional data that you collect from a system. Maybe I just measure the
demographics and biometrics and health outcomes of
1,000 or 10,000 people. And I do principal components
analysis on that data to extract approximations
of that joint distribution. And I have a whole
lecture series on PCA. This is kind of an advanced
topic in statistics. We'll get to that
at some point soon. And this is
essentially assuming. Sometimes we neglect
this assumption, or we forget casually that
there's this assumption that the joint
distribution for PCA is a joint Gaussian
distribution, that these would be normally
distributed random variables. But sometimes we
can forget that. And there's a lot more examples. I want you to be thinking
of joint distributions for discrete variables,
for continuous variables, and things you can do with that. One of my favorite
examples-- and this is actually how I'm going to
introduce the continuous version of a joint distribution. One of my lab mates
in grad school in one of his follow-on jobs worked
at a sports analytics company, and I heard that they
collected a bunch of data like camera data of the
basketball court during games. And they could follow
players around. And so you can actually-- it's a really, really
simplified court. And what you can do is you can
actually follow a player around through an entire
season, and you can build a probability
density of where you are most likely to see that player. So maybe you have a player
that hangs out here more often, and sometimes they're here. And very rarely they'll be here. That would be a
probability distribution for where that
player, let's say, LeBron James is going
to be across a season. And again, we're starting to
get into this notion of building these distributions from data
that you actually collect. This is a data-driven
approximation to a probability distribution. You're modeling
where this person is going to be as a
probability density function. And so, again, in
continuous time, we often denote this PDF as
this function f of x and y. And roughly speaking,
it's the probability of finding them at an
infinitesimal little dx by dy kind of teeny-tiny little
infinitesimal section here. And so you can compute
the probability that my random
variable or my person is going to be in a region. So let's say I define some
region here, some region A. The probability of x,
y being in that region A is just the
integral of this PDF. It's the integral over that
domain A of f of x, y, dx dy. So it's exactly how we do a
single random variable, a PDF of a single random variable. But now you can
integrate over areas. And you could do this for
three-dimensional random variables. You would integrate
over volumes. Really simple idea
to calculate the area of being in some finite region
of this court given this PDF. Good. What are some other
things I want to tell you? I want to tell you what happens
if these two variables are independent. That's pretty important. And connect it to
separation of variables. Maybe just for a moment, I'll
go back to this Gaussian example here. So what if I have two
variables, x and y, and they are both normally
distributed random variables, they're both Gaussians? Then this can actually
set up a new distribution that we're going
to call f of x, y, where these are
jointly distributed, where x is a Gaussian,
and y is a Gaussian. And you could basically
build another two-dimensional Gaussian. I'm not going to
write out the PDF, but I'm going to draw a
picture for you if I can. It's a little bit of a
hard picture to draw. So if it's a Gaussian in x and
let's say it's a Gaussian in y, then you get this kind of
radially symmetric Gaussian in x and y. So we're going to say
this is my x-direction. Let's say this is
my y-direction. And you'll notice that
this joint PDF is itself a two-dimensional Gaussian. Again, that's the underlying
assumption of PCA, principal components, is that
your high-dimensional data is a high-dimensional
Gaussian, kind of this high dimensional
Gaussian structure. And you'll notice
that if I average out all of the x variables, I should
recover a Gaussian PDF in y. And if I average out
all of the y variables, I should get a Gaussian
distribution in x. And these are called the
marginal distributions, where you average out all of y
to get the marginal distribution in x, or you average
out all of x to get the marginal distribution in y. And we'll see this more later. I just wanted to paint
this picture for you, that if you have, for
example, two variables that are themselves Gaussians, you
can build a joint distribution that's a two-dimensional
Gaussian where each of the marginal
probabilities are themselves Gaussians. OK, good. The last major thing
I want to show you is this notion of independence. This is a really
important property, and we're going to
use this over and over and over again when we
compute the expected value of a joint distribution, when
we compute the variance in PCA, things like that. So we have already seen
this notion of independence when we looked at
conditional probabilities. So two variables x and y
are independent if having information about y doesn't
change my probability of x and vice versa. And you can also write it
for these joint distributions as well. So independence. These variables x and y, these
random variables are independent if the probability of x
equaling some specific value and y equaling
some specific value is the product of the two
independent densities, is the product of
the probability of x being this value
times the probability of y being this specific
value little y. And you'll notice,
this is almost exactly like the notion of
separation of variables when you solve a partial
differential equation. So if I'm solving
the heat equation on a two-dimensional
rectangle and I'm looking at the
heat distribution, I can often separate
that solution into a function of x
times a function of y. That's the same exact idea here. So this is just like
separation of variables. And actually, in that heat
example, the separation of variables for the
heat distribution, we actually also involve
convolution with a Gaussian. The solution to
the heat equation involves a Gaussian heat kernel. But that's neither
here nor there. So this notion of independence
is really, really important. It allows you to multiply these
probability density functions to get the joint distribution
if x and y are totally independent random variables. Now, sometimes this doesn't
work-- separation of variables. We know that sometimes this
works, and sometimes this doesn't work. So let's come up
with an example. Let's say I'm throwing
darts at a board. So let's say I
have a dart board. Usually, they're circular. And usually, they're divided
into a bullseye and then rings and sectors. So I could try. And actually, if I'm any
good at throwing darts, you'll notice that
the distribution will start to look like a Gaussian. Ideally, if you're
actually good at darts, you'll start to get a
Gaussian distribution about where you're aiming for. So if you aim for the bullseye,
you'll have this 2D Gaussian distribution around
that bullseye. In fact, in one
of our old houses, we had a dart board on a wall. And occasionally, we
would miss the board because we weren't that good. And when we took
the board off, you could actually see this,
tapering Gaussian distribution of density away from the board. Now if I tried to write
this PDF in x, y variables, it wouldn't be separable. Because if I go out
in the x-direction, my y probability really
does depend on where I am in the x-variable. So I s separate this
PDF into x and y. It's not separable in x and y. Just like the heat equation,
if I hit a blowtorch on this circular
disk at the center, the heat distribution
is not going to be separable in x and y, but
it is separable in theta and R in the radial and
angular coordinates. So there often are
good coordinates in which I could represent
my probability density. That would separate
due to independence. And there's coordinates
that are bad. Just like in
differential equations, there's good coordinates. In probability, there's
often good coordinates also. Now, of course,
gravity does bias this and breaks this symmetry. So maybe we're throwing darts in
0 gravity in the International Space Station. But this is a useful idea that
you should know of independence. And we're going to
use this all the time. This property of independence of
two processes are independent. You can build a
joint distribution by multiplying their densities. Or you can decompose a
density into two products. OK, good. One of the things I'm going
to do in a follow-up video is talk about something called
the marginal distribution. I already hinted at it here-- is this idea that if I
have a joint distribution, I can average out y and get
a marginal distribution in x or vice versa to do that in y. And I'm going to relate
that to the notion of conditional probability-- this kind of conditional idea
that we use in Bayes' theorem earlier. And we're going to
relate it to independence and joint distributions, I
think, in the next video. All right, thank you.

---

## 50. The Chi Squared Distribution: The Square of the Normal Distribution
**Channel:** Steve Brunton | **Views:** 17K | **Date:** 8 months ago | **Duration:** 13:08 | **ID:** h9j849vAsAA
**Link:** https://youtube.com/watch?v=h9j849vAsAA

### Transcript:
PROFESSOR: Welcome back. So we showed in the
last couple of lectures how to define functions
of a random variable x. So for example, if x is a
normally distributed function, we can build functions y of x
like this linear translation and scaling. And in general, this is
a pretty robust strategy. This is a really, really
simple function of x. It's just a linear
function, and we showed how to derive the
PDF and CDF, the probability density and cumulative
density of y given that we know the PDF and CDF of X. But today, I want to do a more
sophisticated example that actually comes up all over
the place in statistics. One of the most
useful distributions around is the
distribution of X-squared if X is a normal
distributed random variable. So that's what we're
going to do today. And I'm actually going to-- yes, I'm going to say that X
is just a simple standard unit normal Gaussian distribution. So mean 0 standard deviation 1. And what we're
going to do is we're going to introduce this
new random variable Y. And we're going to say
that Y equals X-squared. And I'm just going to tell you--
well, it's not the punchline. The name of this is called
the chi-squared distribution. So Y follows what's called
the chi-squared distribution. And if you've done any
statistics in the past, you've almost
certainly come across this chi-squared distribution. It's the most
useful distribution for hypothesis testing or
one of the most useful. If I have data,
if I collect data and I think it belongs
to some distribution, I can essentially test
that hypothesis using this chi-squared distribution. Roughly speaking, just very,
very broad brushstrokes, if I take my collected data
and my putative model-- the model I think the data
follows-- and I subtract them and square that
error, those errors should approximately follow
a normal distribution based on the central limit theorem. And if I add up the sum of
the squares of those errors, that should follow something
like a chi-squared distribution. So chi-squared is super, super
useful for hypothesis testing, even if the
distribution, I think, my data follows isn't normal. Even if it's a
different distribution, I can still oftentimes
use chi-squared. So that's enough preamble. Now I'm just going
to show you how to actually compute the PDF of
this chi-squared distribution. Now, remember, if I have
the probability density function of X, let's
say this unit normal, I can't just take that
function and square it. I can't just take this
unit normal function e to the minus X-squared over
sigma-squared and square it. That's not a well-defined PDF. So I have to go through
this slightly more cumbersome procedure. I have to write down what
is the cumulative density function of this new variable
Y. I have to relate it to the cumulative
distribution of X that I have, and then I have to
take its derivative to get the probability density
function with respect to Y. I'm just going to show
you how this works. And I'll stick with
pink for a little while. So the cumulative
density function of this new chi-squared
variable is F sub y of little y. This is the probability
that my new random variable Y is less than some number,
some specific value y. This is a function of
a variable little y, and this is the probability
that my random variable happens to be less than little y. And that is essentially-- how do I want to write this? If my new variable Y
is less than little y, that means X-squared
is less than little y. I'm actually going to
write out all my steps. I don't want to skip steps
here and get confused. So this is the probability that
X-squared is less than little y, which is the same
as the probability that X is greater than
negative square root of Y, negative square
root of Y, and less than the positive
square root of Y. So the probability of
X-squared being less than y. It means that X has to
either be less than root y or greater than negative root y. It has to be between
plus or minus root y because X is squared. Good. And this thing, because X
was a standard unit normal, I can actually write
down the answer. Remember, we had the cumulative
distribution function of this. We have defined Fx for a
standard unit normal as this phi function. It has a special name
because in the olden days, you would actually have to look
this up from a lookup table. So it was a named function,
this error function or this sigmoidal
function, which is the cumulative distribution
of a standard unit normal. So it has its own name phi. And so this probability
is phi of root y minus phi of minus root y. That is the cumulative
distribution function. It's this function that I know. And all I do is I plug in
root y and minus root y. And I get this cumulative
distribution function here. But I don't just want the CDF. What I really want is I want the
probability density function. So here, it's a Gaussian normal. I want to know the probability
density function of Y here. So what I'm going to have
to do is to get the PDF. I'm going to have to
take the derivative of this expression, of this
expression, with respect to y. And we're going to
use the chain rule, just like we would normally do. And I'm going to go
back to pink here. So the PDF of my variable
Y. Essentially, f y of y is just equal to the
derivative with respect to y of my cumulative
density function, of F y y. And these functions here. So it's the derivative
of this with respect to its independent variable. So this is going to
equal phi prime of y times the derivative
of y with respect to y. That's y to the 1/2 is 1/2 y
to the minus 1/2 times 1/2 y to the minus 1/2. And I have two copies. I have this one,
and I have this one. And then minus the same thing. Good. And how do I want to do that? So that's this guy
here plus another. I'm going to get
minus and minus. So plus another phi prime
of minus root y times 1/2 y to the minus 1/2. Good. And I feel like there is
some kind of a symmetry trick happening here
because in my notes, these two terms combine to equal
y to the minus 1/2 phi of root y. So I think, actually,
this is something you'll need to figure out,
is phi prime of root y. So this phi prime
here, I think, we're going to have to figure out
why I can combine these two quantities here. I think that's not
entirely obvious because this is a minus root
y, and this is a plus root y. So I want you to actually think
through why that is the case. And I'm guessing it's
actually because I'm taking the derivative of these things. And so the slope at
plus and minus root y are equal and opposite. And so it seems like I probably
just missed a sign somewhere. I think this should
be a minus here. And then this all works out. The details are important, but
that's not the main point here. The main point is for you
to see the procedure here. We have this new random
variable X-squared. So X is normal, and
we want to introduce what is the PDF of X-squared. So we start with the
cumulative density function. We relate that cumulative
density function of our new variable to
the cumulative density function of our old variable. We know this big phi function. And then we take its derivative
to get an expression like this down here. And remember, the derivative
of this big phi function-- this is my big phi function. It's my CDF of X. The
derivative is just my PDF of X. So this equals y to the minus
1/2 times my x PDF evaluated at root y. So literally, I would take
my normal distribution, my Gaussian, and I would plug
in root y every time I see an X. And I multiply it by
y to the minus 1/2. And so you can actually
write this down. You would say that this is f
y of little y is equal to y to the minus 1/2 times e to the
minus y over 2 divided by root 2 pi. And I'm skipping a step here. Remember that the fx, the normal
distribution for a standard unit normal is just 1 over root 2 pi
e to the minus x-squared over 2. So this is the PDF that we know. This is phi prime, the
derivative of my CDF. This is the PDF that I know
for my standard unit normal. And we went through
all of this math and differentiated our
CDF for our new variable to get its PDF in terms
of this PDF that I know. And so now what I do
is I plug in root y. This should be an x here. I plug in root y
every time I see an x. So I evaluate my PDF
of my X variable, but I now plug in root y. And I multiply by
y to the minus 1/2. And I get this new
PDF of my y variable. This is the probability
density function of X-squared when X is a normally
distributed random variable. This is called the
chi-squared distribution, and it's super, super useful
for hypothesis testing in statistics, for testing
if your data matches some distribution that you
think it should be matching. Tiny, tiny, tiny last recap. You can't just take your
PDF for X and square it. This is not just
this PDF-squared. That doesn't work. That would not be a well-defined
probability density. So instead, what you do is you
define the cumulative density function of your new variable. You represent it in terms
of your old random variable to get the cumulative
density function of y in terms of functions you know
like the cumulative density of x. Then you take its derivative
to get the probability density function of this new variable y. You take its derivative,
derivative, derivative. Maybe there's some
steps in the middle here that are a little hairy,
but you take its derivative. And now you have the PDF of y in
terms of functions you already know, the PDF of x. And so if you plug
all this into here, you get the chi-squared
distribution, the chi-squared distribution
from statistics. Super useful. We're going to use
this a bunch in later lectures when we actually
start doing hypothesis testing and statistics all because we
now know how to build functions of a random variable. Thank you.

---
