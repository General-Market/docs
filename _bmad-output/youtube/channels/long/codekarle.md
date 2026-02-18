# CodeKarle Long-Form Transcripts

14 video transcripts.

---

## 1. System Design Interview - Tips & Tricks | Biggest Mistakes to Avoid
**Channel:** CodeKarle | **Views:** 82K | **Date:** 5 years ago | **Duration:** 3:40 | **ID:** 4Q2fokImKfM
**Link:** https://youtube.com/watch?v=4Q2fokImKfM

### Transcript:
Let's look at some of the biggest mistakes that candidates make in a System Design interview. A lot of times people don't even ask whether it's a low level design or a high level design that you need  and straightaway jump to a class level diagram making classes, functions and all of that. And that's not right, in case the interviewer is expecting a high level design. So make sure you clarify what exactly you want before you actually go present a solution. The next thing which is very similar again, is let's say if the interviewer asked you to design Uber and let's say, you know how Uber is built. Don't jump straight into the solution. Right! Why? Because Uber has a lot of functionality, maybe the interviewer was actually interested in a couple of specific ones. Right! So just clarify before you start, on what functional requirements are there as part of building this design. Basis those functional requirements, your design could totally change. Right! So clarify the functional requirements. And a lot of times, candidates also skip the non functional things, for example, scale. So let's just say if you're building a chat application for your company, which has 50 employees, the design of that would be totally different when compared to the design of a chat application like WhatsApp, which is supposed to be used by billions of users. Right! So if the interview was actually expecting you to build a small enough chat application and you end up building a WhatsApp, that would be a total disaster. So clarify this thing much in advance that what kind of a scale is being expected, what number of users will be there, some information about throughput, data size and all of that before you actually jump to a solution. The next thing is you need to time your solution pretty well. what happens mostly is - people get so much involved with one particular component that they totally skip the remaining ones and they don't have time. Ok! So you need to realize that you just have 40 - 45 minutes for this interview and you need to cover a lot of things. Right! So maybe one good way to start is - in a high level design interview, you could possibly start with basic building blocks on what all components are there, how do they interact with each other and then get into the depth of one or two of them. Now, when you are deciding which ones to go deep into, don't just assume certain things. Ask the interviewer on what they want to talk about because at times people have this pre meditated that they do want to talk about a particular functionality, how would that be implemented. Right!
So give this opportunity to the interviewer to direct you in certain cases and don't make certain assumptions. The next thing is, nobody expects you to know everything. At times, candidates assume that they are supposed to know everything. And if they don't know certain things, they either get bogged down or they make some things on the fly and present that. Don't do that if it's a small component that you are not aware of. So let's just say, again, taking an example of Uber and let's say if it involves a rate limiting system somewhere in between and you do not know how to build that. Then one way is to clearly call that I don't know how to build a rate limiting system, but if I were to build it, I would build it in this way. And that totally elevates your solution, irrespective of whether it is right or wrong, because at least you know what you don't know. And that's a very important. And it's okay to ask tips also at this point in time. If there are certain things that you want some inputs on, feel free to ask the interviewer on -
Is it going in the right direction? What additional could we be doing ? and any other questions that you have. So, yeah! these are the most common pitfalls that you must avoid in any system design interview.

---

## 2. Database Design Tips | Choosing the Best Database in a System Design Interview
**Channel:** CodeKarle | **Views:** 593K | **Date:** 5 years ago | **Duration:** 23:28 | **ID:** cODCpXtPHbQ
**Link:** https://youtube.com/watch?v=cODCpXtPHbQ

### Transcript:
Hi everyone. Let's talk about databases now.
So in your system design interview how good your design is and how well
it can scale depends very much on the choice of database that you've used.
Now databases generally do not impact your functional requirements, so whatever your
functional requirement is you can satisfy that by using any
database that you want. But normally the non-functional requirements are the ones
which are impacted by the choice of database. So let's just say you have
certain query patterns, or certain kind of a data structure or certain kind of a
scale to handle, there are a different set of databases optimized for different
kinds of such things, right. So based on the choice of database it would impact
how well your design can scale up to the requirements that are given as part of
your non-functional requirements (NFRs) so in this video what we'll do is we'll go
over some very common use cases that normally you might come across in your
System Design Interview and then look at some of the potential solutions or
possible set of databases that you can use to handle those scenarios. Now normally the choice of database depends on a couple of factors. The very first
thing is the structure of the data that you have. Whether it's a very structured
data or a totally non structured data that is one of the factors.
The other factor that impacts the choice of database is the query pattern that you have.
And the next obvious one is the amount of scale that you need to handle.
So all these three factors would make a difference in to the choice of database
that you want. Now in this video we'll look at some common obvious ones in the
beginning and then towards the end we'll look at the SQL-NoSQL comparison and
a combination of certain kinds of databases that can help you solve a
real-world problem. Let's talk about Caching Solutions. So whichever system you
are designing in an interview, you would definitely have to use some caching
solution there. Now there are a lot of use cases for caching. Let's say you are
querying a database and you do not want to query the database a lot of times, you
could cache the value in a cache, right. Alternatively, if you are making a remote
call to a different service and that is having a high enough latency, you might
want to cache the response of that system locally at your end in a caching solution And there could be a lot of
use-cases for caching. Now generally the way caching works is you have a key
and you have a value. So key normally is whatever your where clause is
in the query or whatever your query param or request params are when 
you're making an API call  and value is basically the response that you are expecting from the other system, right.
So all of these kind of values would be stored in normally key value
stores. Now very common used solutions are "Redis". You could also use "Memcached",
you could use "etcd". "Hazelcast" is picking up a lot these days. So you
could use any of them. Normally in the videos that I make I tend to use Redis
because that is a very battle-tested solution and it is used by all the big
companies in the world and it is fairly stable. So in whatever the System Design
you have, where you have to use a caching solution, you could use a Redis. I'll just
note it down so that you can refer it Redis is the solution for caching.
Now again this does not mean that you cannot use anything else, you could use any
similar solution and that would work just fine. Next let's look at some File Storage Options.
So let's just say you are designing a system like Amazon where
you are having various products that you are selling. Now the sellers would be
uploading product images, maybe products videos, right.
You need a data store to store those images and videos. Similarly you could be
potentially building a system like Netflix which has videos all together.
And you need a storage to support videos So wherever you have a image/video kind
of a thing, there we'll use something called as a Blob Storage. Now these are
not really databases. Databases are fundamentally meant for things where you
can query on. Now a file is not something which you normally query on.
You will just serve it as it is, right. So then is when Blob Storages come in.
Now there are a lot of providers for that one of the most common ones and the and  a fairly cheaper (Cost Effective) 
one is Amazon S3 and it is a fairly good system used by a lot
of company, so whenever you have a requirement of storing images/videos and
anything of that sort, you could use Amazon S3 as a data store. Now along with
S3 you might want to use something called as a Content Delivery Network
which is often called as a CDN. Now CDN is generally
used for distributing the same image geographically in a lot of locations.
So let's take a simple example that you have a product image that is stored in
Amazon S3 as a primary data source and there are a lot of people coming from
throughout the globe who are accessing that product. So you might want to
distribute that image into various servers across the globe so that
individual people can query them in a much faster way as compared to querying
an S3 which is probably located in a couple of locations. So for all
Blob kind of content you would then be using something like a for all blob you
would be using something like the S3 plus a content delivery network and that
should be fairly fine on all your interview questions. Now the next very
common use case that you might encounter is for example if you're building a
product like Amazon and you need to provide text searching capabilities on
various products. So the seller has uploaded a product with a particular title some
description and you want users to search that, right. Now that search thing would
be provided on a text of title and on the text of description. Very similar use
cases would be when you have a product like Netflix to build and you want 
to... give the option for the users to search or movie name, movie titles, genres,
maybe cast and crew names and all of that. Or alternatively you might be
designing something like an uber or Google Maps kind of a thing where you
want to provide text searching capability with support for fuzzy search.
So for all of these kind of use cases you would be using something called as a
Text Search Engine. Now a very common implementation of a Text Search Engine
is provided by Elastic Search and Solr, and both of them are built on top of
something called an Apache Lucene now Lucene fundamentally provides these
text searching capabilities and that is then being used by both of these
products Elastic Search (ES) and Solr. So the next use case and quickly write it down is
your text search which is Elastic Search and Solr. Now one more thing that they
support is something called as a Fuzzy Search. So what is that is.. I will quickly go
over that. Let's say if you are searching for the word Airport and let's say is
the user typed in "AIRPROT" with the wrong spelling, okay.
this O and R are interchanged right. Now, If a user searches for this and you do not
return back any result, then that's a bad user experience, right. So you need your
database to be able to figure out that the user did   not really meant this thing [AIRPROT],
the user actually meant AIRPORT, right? Now how does that database identify,
so this word can be converted into the correct spelling of airport by
changing two characters, right. R needs to be converted into O and O needs to
be converted into R, right? so this is at an edit distance of two. So you can
provide a level of fuzziness that your search engine needs to support.
This has a fuzziness factor of two, which is the Edit Distance. Normally there are a lot of
other factors also that come in but this is roughly how fuzzy searching is
implemented in most of the solutions. So wherever you have any search
capabilities there you use either Elastic Search or Solr.
Now one very important thing about both of these are, these are not databases.
These are search engines. So the difference between a Search Engine and a
Database is whenever you write something in a Database, Database gives you a
guarantee that that data wouldn't be lost. Now both of these data stores don't give you any such guarantee. They claim
that they are giving a good enough availability and a redundancy and all of
that but potentially data could be lost so you should not keep any of these as
your primary source of truth Your primary data store should be somewhere
else and it you could load that data into either of these systems to provide
the searching capabilities and these two are very efficient at search.
Next, let's look at what do you do if you want to store some metrics kind of a data.
So let's say if you are building a system like Graphite, Grafana or Prometheus
which is basically an application metrics tracking system. So let's say if
the use case that you are given is a lot of applications are pushing metrics
related to their throughput, their CPU utilizations, their latencies, and all
of that. And you want to build a system to support that.
Then is when comes something called as a Time Series Database. Now think of Time
Series Database as an extension of relational databases but with not all
the functionalities and certain additional functionalities. So regular
relational databases that you have would have the ability to update a lot of
records right or they would also give you the ability to very random records
but whenever you are building a metrics monitoring kind of a system you would
never do random updates. You would always do sequential update in append-only mode.
So if you have put an entry at time T1 the next entry would be a time T 2 which
is greater than T1. The next entry would be at time T3 which is greater than T1
and T2 right. So it's an append only write mode. Also the read queries that
you do, they are kind of bulk read queries with the time range, right.
You query for last few minutes of data or few hours of data or few days of data, right.
But you don't do a random read or a random update. Now time series
databases are optimized for this kind of a query pattern and input pattern.
So there are a lot of time series databases InfluxDB is one of them, openTSDB 
is one of them so you could use either of them if you have that kind of
a use case. I will quickly write this thing also. For time series, you use something
called as an openTSDB, it stands for Open Time Series Database. The next use case is
when you have lot of information and you want to store all of that information of
a company in a certain kind of a data store for various kind of analytics
requirements. So let's just take an example of something like an Amazon or
Uber or any system design where you want to provide analytics on all the
transactions. You might want to provide analytics like how many orders I'm
having, what geographies are giving me what revenues, which is the most sought
after item, stuff like that. So where you want to do analytics on the data of the
whole company, there you need something like a Data Warehouse. That basically is
a large database in which you can dump all of that data and provide various
querying capabilities on top of the data to serve a lot of reports. Now these are
generally not used for transactional systems, these are generally 
used for offline reporting. So if you have that kind of use case
then you can use something like a Hadoop which can very well sit in for that
purpose, where you put in a lot of data from various transactional systems and
then build a lot of systems that can provide reporting on top of that data. Now let's look at slightly tricky scenarios where you might want to choose  between a relational and 
a non-relational database. So the very first thing that
helps you decide what kind of a database do you want to use, is the structure of
the data. So if you have a very structured information then possibly a
relational database makes sense. Now what is a structured information? it would be
an information that you can easily model in form of tables and tables would have
rows and columns of information. For example if you want to store a user
information something like a user profile on any social network it would
have name, email address, city, phone number, and bunch of very standard
information that each user will have That would be a structured information.
So if we try to make a flowchart of how to decide which database to use this is
how it would look like. The very first choice that we need to make is
whether we have a structured data or an unstructured data. Now let's say if we
have a structured data the next question that we need to ask ourselves is, do we
need any atomicity or transactional guarantees from the database or not?
So, let's just say that you're building a payment system which supports a feature
like somebody can transact money from their account to somebody else's account, right.
Now fundamentally at the very core of it, it will have two queries, one of
them will reduce the amount from the person's account and the other query
would add the amount into the beneficiary's account, right. Basically
reducing from account A and adding into account B. Now your database should be
able to provide you certain guarantees which wrap both these query into
transactional boundaries, saying either both of them would execute or both of
them would not execute. But it should never happen that amount has been
debited from account A but not credited in into account B or credited into
account A but not debited from account B. Something of that sort should not happen.
Also it should provide you some consistency saying if you have done a
transaction the next call that you made to fetch the account balances it should
reflect the amount. It should not be that sometimes it is reflecting the correct amount and sometimes it is not 
reflecting the correct amount.  If you have that kind of requirement where in your building of
payment system or an inventory management system where you have the
count of number of products that you have while people are buying them and
the count needs to reduce, for all of those kind of scenarios, that would
fall into that yes you need an atomicity you need consistent, you need
transactions, then basically you need to use a relational database, okay.
Now there are multiple providers of relational database you could use any of them.
Some of the very common ones are MySQL, Oracle, SQL Server, Postgres and there
are a lot of them. I've just mentioned the common ones it does not mean that
you cannot use any other database of your choice. Feel free to use any
database which provides you ACID Guarantees. Now let's say you have
relational data but you do not need ACID Guarantee. Let's say you are just
storing user information which does not have any use case of these atomicity
requirements. You could still choose to use a relational database or you
could choose to use a non relational database, it wouldn't make too much of a
difference, because normally you would be easily be able to map a structured data
into a NoSQL model, so either of these scenarios would be fine.
Now let's say you do not have structured data - so what do you do? So there are a
bunch of scenarios in which your use case might fit in. So maybe you are trying to
build a catalogue kind of a system for an e-commerce platform like Amazon which
has information of all the items that are available on that platform, right.
So let's just say if you are building that catalogue for Amazon and if we take
certain examples, so let's say there is the item like shirt. Now each item would
have certain attributes. A shirt would have an attribute like a size: could be
large, a color: could be red, something of that sort. If you have a
refrigerator, it would have a volume like 200 litres/400 litres or whatever. It
would also have a power saving mode like 3-star/5-star/what not. So those are the
attributes of a refrigerator, right. Similarly, something like a milk, would
have quantity and an expiry date, right. Now normally when you are on an
e-commerce platform you not only need to see these attributes if it is just about
seeing them you could kind of dump it as a Json and store it
in any databases. But normally you would also want to query that.
Now querying on a JSON or random attributes is a bit tricky on the relational
databases, but there are certain kinds of databases that are optimized for those
kind of queries. So these are the databases where you have a lot of data
not just data in terms of volume but in terms of structure. So if you have lot of
attributes that can come in and a wide variety of queries that can come in, then
you fall into this category, and if that is the case then you need to use
something called as a document DB. Now there are a lot of providers of document 
DBs, MongoDB, Couchbase are some of them. Earlier we looked at Elastic Search and
Solr for text searching those are also special cases of Document Database.
Now let's just say your your data is not relational and you do not have complex
queries, you have a couple of straightforward queries you could still
use a document DB if it doesn't fall into the third category. Now what is the
third category? Let's say if you have an ever-increasing data. What do I mean by
ever-increasing data? So let us take an example of Uber. So all the drivers of
Uber are continuously sending location pings. so let's stay there are some number
of drivers and they kind of translate into X number of location records per
day. So there would be X number of records inputted per day. But this
X would not be a constant, it would be a growing number why because the number of
drivers of uber are increasing day by day right so this data would become
probably X one day one. Additively 1.1X on day two, 1.2x
on date three, so on and so forth. So it would not be increasing in a linear
fashion it would be increasing but in a more than a linear fashion. So that
is what I am calling an ever increasing data. Plus if you have finite number of
type of queries. So let's if you want to track location pings of drivers the most
important query that you will do is find all the locations of a driver whose
driver ID is something right. So if you have less number of type of 
queries (maybe high volume) but   a large amount of data then these kind of databases would be the best choice for
you. This is something called as a columnar DB or a Column oriented DB and Cassandra and HBase are the most used and
most stable options out there for these kind of scenarios. Now there would be a
lot of other alternate as well but these are the most stable ones and have been
battle tested again for a lot of years I would recommend to use either of these
two in such kind of scenario. Now in my videos I generally prefer using
Cassandra over HBase, the only reason being Cassandra is not very heavy to deploy
HBase generally tends to have a lot of components that it comes with, but
performance wise both of them are roughly similar. Each of them have their
pros and cons but in a design interview it wouldn't matter which one do you use.
Now, what if you don't have any of these what if you don't need ACID, you don't need
these wide variety of data types and query types and you don't have an inner
ever-increasing data? Then you can use any data base of your choice. Then it
would basically be a low scale system having a very small number of queries on
a very small number of attributes on a very small size of a data set. You would
generally not get these kind of requirements in a system design
interview but if you get you could use any of these unless it's something that
we've already talked about which are one of the special cases in some other
scenario. So if it's not that you could use any of these data bases and
that should be fine. But normally when you are in a system design you would not
get a design that you will be satisfied by just one of these databases. So let's
look at slightly more trickier real-world scenarios. Now let's take an
example of us building an e-commerce platform something like an Amazon.
Now when you are managing inventory on that side you want to make sure that you are not over selling items. So let's say there is
just one quantity of a particular item left and there are 10 users who want to
buy that you want to have this ACID properties there to make sure that only
one of the users should be able to commit the transaction other users
should not be able to commit the transaction, right. You can put
constraints and all of that on there. It would make sense to use a RDBMS
database for the inventory management system of a system like Amazon or maybe
an order management system right But if you look at the data of Amazon it
is an ever interesting data. Why? because the number of orders are additive each
day new orders are coming in they cannot purge the data due to lot of legal
reasons plus the number of orders are also increasing so it naturally fits
into this model right with you where I am recommending together
Cassandra. So what you could use is a combination of both of these databases.
You could use MySQL or any other RDBMS alternate for storing data about
the orders it has just placed and not yet deliver to the customer. Once the
item is delivered to the customer you can then remove from this RDBMS, and
put it into Cassandra as a permanent store. I walked through this
implementation in much more detail in the Amazon system Design, so I would
recommend to have a look on how a combination of database can become a
very power choice there. Now let's look at another example again taking an
example of Amazon, let's say if you want to build a reporting kind of a thing
which lets you query something like get me all the users who have bought
sugar in last five days now sugar is not just a product. There
are a lot of sellers selling different sugar alternates of different companies
maybe, of different qualities maybe, right. so sugar would then be like a lot of
item IDs right and on top of those a lot of item IDs there must be a lot of
orders. Now again I am saying that orders would either be in Cassandra or
in this (RDBMS) right but if you are doing random queries where some you might want
to query on who bought sugar, who bought TV, who bought TV of certain quality, who
bought a fridge of certain quality, that kind of logically goes into a model
where I was recommending to use a Document DB. now what you could do is
you could store the querying part over here (Document DB). You could basically say 
that I'll store a subset of order information into a MongoDB which says that user ID so
and so, had an order ID so-and-so, on some particular date, which has these ten
item ID in the certain quantity, right On this database you could run a query
which will return you a list of users and list of order right and then
you could take those Order IDs and query on both of these systems (RDBMS+Cassandra) right 
so here we are using all the three systems in combination to provide various querying
capabilities like with user bought what kind of use case, right. So in any real
world scenario you would have to use a combination of such databases to fulfill
the functional and non-functional requirements that you have. Now all of
these being said this is just an indicative cheat sheet of what database
fits well in what kind of a scenario. when you are in an interview you could
use this to kind of get done with it but if you are actually using it in a
real-world system I would recommend to read a bit more about it to choose which
out of these few do you want to actually use, right. Also there are a lot
of other databases that I have not talked about which are basically examples of
RDBMS's or example of columnar databases. It does not mean that these
are the only options. There are a lot of other options out there you could
explore them and use those as well. so yeah I think this should be a good enough place
for a database choice given a certain use-case.

---

## 3. Notification Service System Design Interview Question to handle Billions of users & Notifications
**Channel:** CodeKarle | **Views:** 187K | **Date:** 5 years ago | **Duration:** 20:32 | **ID:** CUwt9_l0DOg
**Link:** https://youtube.com/watch?v=CUwt9_l0DOg

### Transcript:
Hello, everyone! In this video, we'll look at how can we design a notification service that is scalable enough. This is never a stand alone system but this is always embedded in some other system design.
Even I have used it in a lot of other system designs videos that I have made.
Let's say if you are building a e-commerce application or a booking system or anything of that sort. You'll always have a notification service which will be used to notify your consumers. Let's look at how can we build a notification service. Now let's look at some Functional (FRs) and Non Functional Requirements (NFRs) that this platform should support. The very obvious first thing is that it should be able to send notifications. The next thing is that it should be pluggable. Now what does pluggable mean? So let's say we want to support SMS and email as one form of notification. Now, tomorrow somebody might want to say that I want to support in-app notifications as well. So it should be easy enough to add that. It can be further extended to a lot of kinds of notifications. So, for example, you could have something like a WhatsApp notification or anything of that sort. So, extendability is something that should be taken care of. The next thing is that it should be built as a SaaS product. Why SaaS? because the main idea is you should know who's sending what number of notifications. And it should be possible for you to rate limit. There are two use cases where you'll need that. So rate limiting as a offering you'll need, if you are giving out to other companies as a product to use. But, even internally, you would need to do some kind of rate limiting. Let's just say its being used by a company like Amazon. Now there are multiple business verticals. If all of them send you notifications, then you'll end up getting hundreds of notifications in a day. So that's a very bad user experience. So notification system should be able to overall put a rate limit across all the users across all the platforms saying a particular user should not get more than five notifications in a day. There could be certain amount of classifications done. So there are two kinds of notifications. One is a transactional notification saying you have made an order, this much amount of money has been deducted from your account, something of that sort. So transactional notifications are ok to get. But promotional notifications should always have a rate limit. So if you're building for within your company, then you'll build a user level rate limiting. But if you're giving it out externally to other companies as a product, then you might want to put a rate limiting saying how many requests can you make for this server.  Or maybe make billing tiers and price them accordingly. So basically this is something that you need to capture at least and then act upon. The next thing is prioritization.
Again... we'll support multiple priorities of messages. So the idea of priorities is that some messages are low priority and certain messages are high priority. Let's say, if you are sending a one time password (OTP), then that's a very high priority message. Why? Because if the user wouldn't get that SMS or email or anything, then they would not log into your platform and they'll not do the transaction that they wanted to do. But if it's a promotional message, it is okay if it's low priority and if it gets delayed, if it goes to the user let's say half an hour late also, it doesn't really matter. So we'll have this prioritization, basis which you'll always process the high priority messages first and then the low priority messages. Coming to the non functional requirements (NFRs).
This platform should always be available. Why? Because, if you are planning to build it as a  SaaS product which can be used by other companies, then down time would really cost us a lot. Plus, it should be built in a way that it's easy enough to add more clients. And whenever we want, we should be able to attribute saying how many clients have made us how many number of requests. Now, let's look at the overall architecture of the whole system. Just a disclaimer to start with, if you are building it for a small enough use case like let's just say if you want to send out some email notifications to some customers, given some criteria, you can build all of this as one deployable service and put all the logic in one place. But if you truly want to build it as a SaaS product wherein enormous number of clients would be using it for a lot of notifications, then this kind of a system would probably be worth it. Let's just look at the starting point. The starting point of the whole system is then a couple of clients i.e. Client 1, Client 2, could be any number of clients, who want to send out a notification. Now, there are 2-3 kinds of requests that they can send you. But all of those requests would come into something called as a Notification service, which is an interface for us to talk to the other teams in the company, other companies or anything that we want. There are two kinds of request mainly. One is where they tell you that I want to send this particular content to this particular user, let's say a email id kind of a thing, as an e-mail. This is one of the requests. Other request could be saying, I have this user id and send them this notification. And you decide how do you want to send, whether as an email or as a SMS or whatever? Normally the first kind of a model would be used by other companies where they want to decide that they need to send as SMS or email or whatever. The second model would generally be used when you are building this to be consumed within your own company. But normally as a SaaS product, its good to have both the interfaces. The idea of notification service is, for most kind of requests, it will just take the request, put it into Kafka and respond back to the client saying, I have taken the request and I will send the notification in a couple of seconds at max. You could make this transaction as a synchronous flow but that will take a bit more time and that will keep the client blocked. So, it's probably best to take the request and dump it into a Kafka and move on. But let's just say if for a very critical scenario, you need it to be a synchronous flow. You can basically make the whole process synchronous through API calls. But assuming its a Kafka for now, let's look at what happens next. This Notification service would just do a very basic set of validations saying that email id should not be null or user id should not be null, content should not be null, something of that sort. There might be a lot of other validations, given certain kinds of events that you want to do. All of those validations would happen in this component which is called Notification Validater and Prioritizer. It does a couple of things. Validations is one part of it. The main thing that it does, it decides the priority for a message. So based on some attribute within the message, let's say, we''ll keep a message type identifier kind of a thing in a request and based on that, it will decide the priority of a message. Normally, OTP is something which will be high priority because if the user can't login into the system, they can't place an order and things like that. The second most high priority thing would be a transactional message saying your order has been placed, it will be delivered by so and so time. The third, least priority one would would a promotional message wherein you are sending out offers and coupons and stuff like that. So, it decides the priority and puts the event into a Kafka topic, specific for each priority. So there'll be a topic for high priority messages, there'll be a different topic for medium priority, there'll be a different topic for low priority. And while consuming, the consumers will first consume the high priority messages and then the medium and low priority. The idea is - we don't want any lag in the high priority messages, but we should be at times okay if there's a spike on low priority message and if it takes time, that's okay. Now comes something called as a Rate Limiter. These two components can be interchanged depending upon the conversation with your interviewer. But I'm keeping Rate Limiter before it because the next component is a slightly heavier component.  Rate Limiter does two kinds of rate limiting.
1) It checks that the client who's calling me, is that client allowed to call me these many number of times. That is the first thing. 2) The user whom I'm sending this notification, am I supposed to send this notification to this user these many number of times. Let's go into detail. So there could be a subscription that we have with a certain client that they can call us maybe 10 times in a second. All of those kind of rate limiting, would be one kind of rate limiting. The other thing is there could be a configuration saying I cannot send more than three promotional messages to a particular user in a day. That would be another kind of rate limiting. Both these rate limiting would be implemented in a very similar way. Saying there would be a key. It could be a client id, user id, anything. And whenever you get a request, you basically increment that key into this Redis for a certain timestamp. Or maybe the timestamp need not be a exact timestamp, it could be day, it could be second, it could be at a minute level or any level. The moment you exceed that threshold is when you drop that request. There's one more thing that it does, which is called request counting. Let's just say with some of the clients you have a pay for use kind of a subscription model, saying they can call you any number of times, there is no rate limiting as such but as the number of calls increases, the amount of money we charge them also increases. So they pay at a request basis. For those kind of clients, we'll implement it in a very similar way. Just that we will not restrict the request. We'll keep incrementing the counter and then there can be reporting built on top of it. The next component is something called as a Notification Handler and User Preferences. First let's look at what are user preferences.
User might give us a preference saying don't send me SMS, send me emails instead. Or a user could have said that I want to unsubscribe from all your promotional messages. So all of those would be handled by this User Preference Service. It has two components that it talks to.
One is a Preferences DB, which is a single source of truth for all the user preferences that we have in our system. This would be mainly used when we are building it for our own use. Let's say Amazon is building this notification system for their own use. This will normally not be used when you're integrating with third parties. Third parties would handle this piece on their end.
The second thing it will talk to is a User service which is basically - let's say you got a request saying to this user id 123, send this particular text. What is that user 123? It's something that you can search from user service to get the email id or phone number or anything of that sort, given a user id. This basically could handle one more kind of rate limiting. A user might say that don't send me more than three promotional messages in a week or one promotional message in a week. So, if that kind of a rate limiting also exists and want to support that, then this whole Rate Limiting module would come after this Notification Handler. But, because this is a very light weight thing and this calls a DB, calls an external service,  that's the reason I have kept it after the Rate Limiter. But based on your conversation with your interviewer, you could swap either of these. Once we have all of this finalized, we basically have a full fledged system that we can actually use to notify. We have a phone number, we know that we'll send it as an SMS and we have the content or we have the email id, we know we'll send it as an e-mail and we have the content. All of that is put into another Kafka for basically sending it out. Why do we need so many Kafkas? Because let's just say we had a lot of SMSes and this SMS service is not able to handle it. One way is to increase the number of consumers. But if there are certain spikes in certain clients, it's probably not worth to add a hardware for all the time for that. So we might as well put into Kafka and this SMS Handler could handle things at its own pace. There are multiple handlers that sit on top of this Kafka. You could decide to build all of these as one deployable unit, but again, with the SaaS (Software as a Service) thing in mind, I'll rather keep that as a separate service in each of them. So there are multiple handlers.
Let's take a couple of examples. So all the SMS requests that will come into this Kafka would be handled by this SMS Handler. Plus, there could be different topics for each of these. So email could have one topic, SMS could have one topic and stuff like that. Now SMS Handler might integrate with multiple vendors for sending SMSes. Let's say you are a global company. You have one vendor that deals with SMSes in Asia, another vendor that deals with SMSes in USA , another vendor for Europe, stuff like that. So you could have multiple vendors that you are integrated with and all the SMS vendor integration could be done through this SMS Handler. Now, let's say if you have... if you are in India and you have 5 vendors that work in India. So what request should go to which vendor? What is the priority? How do we distribute request amongst them? That piece could also be handled within this own handler. Same thing, you have for emails. You have a Email Handler. And by the way, this communication with the handler and vendor could be a sync call. Moving back to Email Handler. Email Handler takes all the e-mail requests and calls the email vendor which will send out the real emails. This email vendor could be a simple SMTP server that you have at your end. Then you will have In-App Handler, which basically handles all the in-app notifications that you want to send out or a push notification, kind of a thing. You can use a Firebase for Android and probably use a Apple push notification service for sending out such notifications on iOS platform. You could also have a IVRS Handler.
A classic example would be, I don't know, either Amazon or Flipkart, one of them. When you place a very high value cash on delivery (CoD) order, they actually send you an IVRS call, saying that we have got this order from you, do you, are you really sure you have kept this as a cash on delivery order and you can press 1 or 2 to kind of confirm or reject. So all of those things could be handled by the IVRS Handler. This is a very low throughput scenario and it would happen once in a while when compared to SMS or emails or anything of that sort. You can again scale these independently based on the kind of traffic you have. Now coming to pluggability. Let's say somebody comes and says that you need to add WhatsApp aslo as a notification mechanism. So basically you just need to add a WhatsApp Handler and basically introduce a type called WhatsApp Messaging at this layer and all of that can flow through all the way. This Kafka... this basically Notification Handler will have a new topic for WhatsApp messages and a WhatsApp Handler will basically take care of sending those notifications out. So that's how you can make it fairly pluggable. Now coming to what this Notification Tracker is?
You always need to keep a track of what all notifications you have sent.
In case somebody sues you or there is some auditing required, you need to know what all communication you have sent out. So for all of that, you have a Notification Tracker which puts all the notifications that you have sent out on its own Cassandra. This is normally a write only thing, which would be read once in a while when there's an audit or something of that sort. Depending upon your traffic and the throughput, you could decide to club some of these components. So for example, you can decide to club all of these components as a single deployable service. You could also club both these components into a single deployable service and you can move the Prioritizer right there and make lesser number of components and try to club all of this as one service as well if it's a very low throughput thing. You can decide it based on your conversation with your interviewer on how do you want to do that? Now, let's do something different. What if you want to send bulk notifications? What if you want to do something like - for all the users who have ordered a TV in last 24 hours, send them a notification like installation service or anything of that sort. Or for all the users who had ordered milk 3 days back, send them a notification that whether do you want to order the same thing again or not? So all of those things come under something called as a bulk notification. Now, how do you want to do that? So the very first thing is there would be a UI kind of a thing, which is represented as Bulk Notification UI, which will talk to something called as a Bulk Notification service, which takes a filter criteria and a notification and sends it out. Filter criteria would be something like find all the users who have placed a milk order, anything in last three days and send them a notification with certain text. How does that work? So there's something called as this User Transaction Data. This basically abstracts out a lot of services which are outside the scope of this notification service but real business functional services. For example, again, taking the example of Amazon, let's say, there are a couple of services that handle their e-commerce orders. There are a couple of services that handle their pantry orders. All of those services would be putting their transactional information - that your order has been placed, it has been delivered, it has been canceled - all of those kind of attributes into various Kafka topics. What we could do is basically build a search functionality on top of those topics. Normally, in most companies, you do have those kind of products already built. But assuming you don't have that, let's try to build that. And if we have that, we can just leverage it.
What will happen is - this will put information into a lot of Kafkas, lot of topics.
I am abstracting it  out as this one Kafka. All of those information would be listened by something called as a Transaction Data Parser. Now, this Transaction Data Parser basically... first of all, parses all of that information. Now, because you have multiple clients and multiple services who are sending data, they could be putting in multiple formats of json or XML. So, for example, pantry (Amazon) could have a separate signature and regular e-commerce could have a separate signature. This data parser basically takes all of those messages, puts it in a format or converts it in a format that it understands and then it puts it into its own data store. It could be Elasticsearch or a MongoDB kind of a structure where you could do complicated aggregations and nested queries. On top of this data store, there's something called as a Query Engine. That Query Engine basically takes a query, which could be like an aggregation plus a filter kind of a thing, saying, find out all the users who are in Bangalore let's say, who have ordered some food item  in the last few days, or find all the people who are having some items in their cart but have not placed the order or any kind of a filter criteria that you want to build that would be powered by this Query Engine. It would have its own DSL (Domain Specific Language), which would be a format - how do you kind of structure your query and that would be a signature that it exposes. Now, this Query Engine would query
that thing on this data store. So it also understands the schema of this data store and it basically would return us a list of users that match that criteria. Now this Bulk Notification service has a list of users that it has got from Query Engine, it has a message that it got from this UI, it basically call this Notification service saying send this notification to all of these users and these users, it would get from this Query Engine. This Query Engine is not something which would just be used by this Notification service. It could be used by a lot of services. You could have a very simple Rule Engine which possibly says that if a user has cancelled 10 consecutive orders in last 3 days,
go deactivate their account. They are probably, you know, just doing fraud. Or, there could be a simple Fraud Engine running which has some criteria and
takes some action basis that. All these condition and action kind of a thing, wherever you have a condition running and action happening, all of those could be, you know, powered by this kind of a thing. In fact, your Notification service
itself is that kind of a thing. So you have a filter criteria as your condition and action is basically the notification sending process. So this could also be a part of your Rule Engine. Something like 5 days after an order has been delivered, send a mail to consumers for giving a product review.
So something of that sort. And this could then also be used
 to build a Search platform altogether. But overall, this is something that and if this is something that is already built in the company, you could just leverage that and have this Bulk Notification service talk to the querying platform of that whole platform. So, yeah, I think that should be it
for a Notification service. Thanks for watching.

---

## 4. Airbnb System Design | Booking.com System Design | System Design Interview Question
**Channel:** CodeKarle | **Views:** 219K | **Date:** 5 years ago | **Duration:** 38:57 | **ID:** YyOXt2MEkv4
**Link:** https://youtube.com/watch?v=YyOXt2MEkv4

### Transcript:
Hi everyone!
Welcome to CodeKarle. My name is Sandeep in this video we will be looking at a
very common design interview problem which has been asked by a lot of
companies lately so let's look at how do we design a
hotel booking system something very similar to booking.com or
airbnb but just one thing to call out we will be looking at a very high level
architecture of the whole system and not at a lower level class diagram
and all of that in this video so before we jump into the problem let's
first look at the functional requirements then we look at the non-functional requirements of what we want to achieve
and then we look at the design so we have two major consumers of this
application one is the hotel side of users and then
there are the consumers who want to book the hotel
so for the hotel managers we'll have these three major functionalities
1) they should be able to onboard onto our platform 2) they should be able to
update their property so for example they might want to add a new room they
might want to change the pricing they might want to add new images and stuff
like that 3) then they should be able to see what all
bookings are there and along with that also get some insight into the revenue
numbers and all of that From a user standpoint they should be
able to search for a property in a particular location
with a couple of search criteria so for example they might want to filter within
a price range or some aspects of the property like a
five-star property or a beach front property and stuff like that.
Then they should be able to book that hotel and once they have booked they
should be able to look at their bookings okay these are the major requirements
now we should also design it in a way that we leave scope for 
some kind of analytics to be done   so these are the functional side of things from a non-functional side of
things we need this platform to run at a
very low latency and it should give a very high
availability and a very high consistency by high consistency I mean if you are
booking a hotel or if a user is booking a hotel he should be able to see that hotel immediately now from a scale standpoint what kind of scale do we want
so a quick google search tells me that there are roughly 500,000 hotels in the
whole world at this point in time there are roughly 10-12 million rooms in
all the hotels across the world at this point in time
and roughly there... you can assume that there are thousand
rooms in a particular hotel in general so there are some hotels who have
which have more than 7000 rooms at this point in time but
those are some edge cases we should be able to handle that. The reason I am
talking about this thousand number is so let's say a hotel has thousand rooms
now these rooms will be booked over a course of many days
so there will never be a situation that there is just one room available
and there are thousands of users who are wanting to book that. At max what will
happen is that there is one room and there are two three users who are
trying to book that and we will be able to use that assumption for our leverage
at later point in time. Now let's look at the overall design of
the whole system and how the data flows within each component
then we look individually into some of the components.
So the whole business flow starts at this point
which is basically a UI that we give out to the hotel managers
through this you it could be either a website or a mobile app
but through this UI they would come on onboard onto our platform
and the same UI would be used by them to modify the property.
So let's say they want to add a new image or they want to add a new room or
if they want to make any modifications this is the UI that they talk to.
Now this UI talks to a Load Balancer through which it talks to a hotel service.
This is basically a service which
manages the hotel part which is basically the onboarding
and the management. All right, now let's just say there's a spike in traffic
so there could be multiple nodes of this hotel services that could be added here
and so this becomes a horizontally scalable
component Now hotel data in itself is a very much
relational data plus earlier we talked about the number
of photos that's not too many so it doesn't even have a scale problem
so we'll be using a clustered MySQL here with one master and multiple slaves slaves can be added as and when required. let's say there's a huge spike in Read
traffic, we can add more slaves but this data resides within MySQL
database Now let's just say any image is added, so
hotels can add images about the rooms about their whole
building and all of that all those images would be stored into a CDN and the reference to the CDN which is
basically a URL of the image would be stored in the database and that  
URL would be sent out to customers and whenever they want to render an
image that would be looked up directly from the CDN. Now what is a CDN? it's basically a geographically distributed data store 
which we will be using for sending out images throughout the whole
world. So let's just say I'm connecting from India somebody's
connecting from US they want to look up for an image of a particular hotel
so I'll look up on the CDN server which is in India the other person will look
up into the CDN server which is in US So this becomes the hotel life
cycle management The next thing is basically
let's just say each time a modification is happening to a hotel
let's just say a new hotel comes in we want to bubble up this hotel to the
users who are going to search for this right, now there are multiple ways in
which we can send out this information to the search piece, right. 
I'll be using a Kafka here
so each modification that is happening within hotel service
will flow through a kafka cluster and there'll be multiple consumers that will
be sitting on top of this cluster which will populate their data store for
serving the search traffic and for other traffic as well, right. So
one of the consumers will be the search consumer
what happens is let's say a hotel gets a new room, for example. There will
be a payload that is put into Kafka which has all the information that is
required Now the search consumer pulls up the
payload from Kafka and it stores into its own database
and this database would be used to power the search on the website.
Okay, now for search, I am using an elastic search.
Elasticsearch is basically a database that is built on Lucene platform.
Similarly, instead of elasticsearch you could also use a Solr here.
Both are kind of similar components ideally it would depend on what
infrastructure is being used in your company you could use that right.
But the idea of using elasticsearch is that I want
this piece to be supporting fuzzy search now let's just say i am searching for a
hotel in maldives or let's say user is searching for a
hotel in maldives, the user might not know the correct spelling,
right. If they type in a wrong word I don't want them to get no results.
I would want this to be able to support a fuzzy search
so I have to be able to handle all the typos and spelling mistakes and all of
that plus i also want to give similar..
similarity kind of a thing there so that's the reason i'm using elastic
search here. So all the data of each individual hotel, flows through
the kafka via the search consumer into this
elasticsearch cluster. Now on top of this elasticsearch
sits the Search Service. Now again let's just say there's a spike
in traffic I can increase the number of nodes in
kafka cluster, I can increase the number of search consumers here
and I can increase the number of nodes in elasticsearch cluster. So till now
whatever we have talked about is again horizontally scalable, right.
And again coming to Search Service this is the service which powers the
search on the website now website is... i'm using a generic term
sometimes I'll use a website sometimes I'll say UI but it's basically all modes
of communication through which a user can come in.
That could be an app, that could be a website right.
So the user talks to through again a load balancer
to the search service whenever they want to search for a particular hotel
again they will give a date range and a location for example as a search
criteria and along with that they could also provide some tags.
Now those tags would be the properties of the hotels.
So again going back to my previous example a five star property
is a tag. A beachfront property is a tag. Now the search on elasticity
would be happening on either of these tags and the ranges that are provided basically the date range, price range and
all of that. okay, so this takes care of the search
flow. Now once the user has seen some of the
results on the website they would want to book a hotel.
The booking again happens through this UI. So I've
made this UI saying that it's a search and book UI. Normally,
it will be the same app or the same website through which they are searching 
and then booking right. Now a booking request
again comes to this load balancer and talks to Booking Service.
Booking Service essentially again sits on top of a MySQL database
now these are two different MySQL clusters. I am purposefully not using a same cluster here although we could use the same
cluster and have two different databases in that
but because we are talking about a fairly large system that has
like a good enough amount of scale I would want to keep different clusters so
as to you know take care of the scaling
separately of each other Now, whenever a booking happens,
that booking gets stored into this MySQL we go over the exact flow of booking
when we go over the details of implementation within the Booking
Service, but essentially this stores the data into this MySQL and it
talks to a Payment Service Normally what will happen... 
a booking request will come, it stores something, it will send the
request for payment, once there's a success,
it will mark the booking confirm. Now again,
whenever a booking is happening, the data is flowing into the same kafka,
right. Why? so let's just say there was just one room available in a hotel
right and that room is now booked i want to make sure that this hotel is not
available for search now in that same date range,
because it's not available. So all of those information is
again sent to the same kafka which is read by Search Consumer and
then it takes care of even removing the hotels which are now completely booked.
Now if you can see, there's something called an Archival Service here.
What I have done is, I am just storing the live data into MySQL.
By live data, I mean the bookings that are done but have not been completed
thereby making sure that this is having a scale which is low enough
that MySQL can easily handle, and once the booking moves to a terminal state
so let's say booking is cancelled or booking is completed
it will move through the archival service to a Cassandra cluster.
The reason I'm using a Cassandra here is so cassandra is a
very good database which can handle a huge amount of reads and writes.
It has a constraint that it needs a partition key on which all the queries
should happen. So let's say if I want to search by a
"booking_id" my partition key has to be a "booking_id"
in that case I cannot do any kinds of queries on a Cassandra
therefore I did not use a Cassandra as a source of truth database.
Because on this database I need to do a large variety of queries.
We'll come to all of those when we go into the detail of Booking Service,
but once it is archived we just need to do GETs on those. So therefore Cassandra
makes a good enough sense over here. Now, once the booking is done, all of that
is fine, but now we need to notify all the
people right? So then comes the Notification Service.
So let's say whenever a booking is made, or any changes are happening into a
booking or it moves into a terminal state,
there'll be a Notification Service that consumes events from this kafka
and notifies the people, so for example on each booking, we need to notify the hotel
right. Whenever a booking is cancelled by the hotel we need to notify the consumer
or in fact on each booking we need to notify the consumer with an invoice
right. So all of those is taken care by this Notification Service.
Now coming back to the UI for hotels and users. So each time a
booking is done or even without that a user might want
to see their old bookings or a hotel might want to see all the
bookings that they have. This is more of a read-only view for them,
right? That will be powered by this Booking Management Service,
which talks to now two data sources. It talks to the MySQL cluster for all the
active bookings, which are to happen sometime in future
and to the Cassandra cluster, for the bookings that have already
happened right. Now i am adding a Redis on top of this MySQL
to reduce the load on this MySQL, so Redis will act as my Cache
and whenever I have a query so for example something like
get bookings of a user so I can cache this result into this Redis.
And it'll be a write-through cache, so whenever a new booking is coming in
this will get updated all right. Now this is the functional flow
the bigger component here is how do we do the analytics on this
so let's just say a business person wants to know how much revenue I'm
making or how many bookings I'm having or what
are my best performing hotels and stuff like that.
So they need to do a lot of analytics Now mostly while designing the system
we'll never always know what kind of analytics is required right
so what I've done for that is I've used a Hadoop Cluster on which
I'm pushing in all the events that are going into my kafka.
Which is basically information about all my hotels, about all my bookings,
about all the transactions that happen in my system. So there will be a Spark Streaming Consumer that runs somewhere
that reads from this kafka and puts all the data into a Hadoop Cluster
on which I can do Hive queries or any different kind of queries
and build up a lot of reporting. So this is overall how the system looks
like and how the data flows. Now let's go into
the details of some of the components. Now let's look at what Hotel Service internally is. 
So it's not a very complicated service it is basically
a CRUD Service which provides Create, Update, Read, Delete operations on the hotel data store. And it is the source of truth for hotel
data. Now, this is not an exhaustive list of neither the APIs nor the DB Schema
that you see here there will be a lot more things, but this
will give you a feel of how it should be. So let's look at some of the APIs. 1) There'll be a POST API  /hotels to create a hotel which will be part of
their onboarding process. 2) There will be a GET API with an id
GET /hotel/{hotel_id} which will give back the information of
the hotel which can be rendered on the screen and the hotel guy can see it. 3) There will be a PUT API
PUT /hotel/id which will be used to update any information of a hotel. 4) Similarly there will be a PUT API PUT /hotel/{hotel_id}/room/{room_id} which would be used to update the room
information or create new rooms and all of that.
Now this is not an exhaustive list there'll be a lot more APIs that you can
add it as in when you know there's a
requirement to add. Now let's look at how the DB schema might look like.
So there are a couple of important tables now this is again not an
exhaustive list of databases of the tables so there's one hotel
table into this hotel DB but before that everything in red
here is either a primary key or a foreign key.
everything in blue is just a column now this hotel table contains your very
standard things id, name, locality_id which is a foreign
key to locality table description, original_images, 
display_images and is_active. Now I have two columns for
original and display images? so original_images is basically the
artifact that the people have uploaded display_images could be a
compressed version of that, that we've compressed, it could be a version that we
have uploaded on the CDN, it could be something different than
the original image but we still need to keep both of
them so we have stored it here. is_active is basically like a soft delete flag Then coming to rooms table. It has a
room id obviously, a hotel_id which references into this[hotel] table
a display_name which could just be a identifier to
tell the customer on what kind of a room it is, is_active again a soft delete flag,
quantity basically tells how many such rooms are there in
the hotel and a price_min and a price_max.
Now why do I have do we have two prizes? Remember the
hadoop cluster that we had in the original design that we made.
it has a lot of data about various kinds of things
we might as well run a machine learning model onto it and do some
supply demand analytics and then come up with the optimal price!
right? let's say supply is low there's a lot of demand there are just a
few rooms left... might as well increase the price!
or let's say if there are too many rooms and very few customers might as well
reduce the price. So this price_min and price_max could be
the ranges which the hotel provides, wherein the price could be fluctuated by
the system. A good starting point could be an average of both these prices right. 
Then there's a facilities table, which is basically
a list of all the facilities that a hotel and a room can possibly have
and these hotels_facilities and room_facilities are basically 
mapping tables which is a many-to-many relationship between a hotel_id and a
facility_id. again is_active flag everywhere is
basically a soft delete flag. now again this is not a full list of
tables there are a lot of information missing. I've skipped the auditing information, I've skipped the bookkeeping information
like created_on, updated_time and all of that. A lot of
information missing but this will give you a fair enough idea
and it will be a good starting point for you to come up with a DB schema for this.
One more thing to note here that if you remember the original design that we had
I did not keep a Redis cache on top of this MySQL database
but I did keep a Redis cache on the other MySQL database which was for
Booking DB Now why is that? We could have kept the
Cache on top of this and all these GET APIs could have been a bit more faster
right, but this is not coming in the critical path of any
high throughput business interaction right so all the customers are not
querying this database, neither  this service, they are
always querying the Search Service so if this service is a little bit slow
that's okay but adding a Redis Cluster is a cost. So
you need to do a trade-off analysis between what cost are you adding of an infrastructure and what benefit it adds to you if it is worth it you might as well go
and add a Redis cluster here, but I don't think it is worth it and that's
the reason I did not add it. Now let's look at the internal
functioning of the Booking Service. We'll first start off just walking
through the DB Schema again it's not a full-fledged schema
there are a lot of details missing like bookkeeping information like created_time, updated_time and all of that but let's focus on the meaty part here.
So it has a table called available_rooms which has a
room_id it has a date, it has an initial_quantity
that comes from the hotel service and it has a available_quantity available_quantity is basically the
number of rooms that are remaining for that particular room_id for that
particular date. Now, it has a constraint
saying it cannot go negative. Here is where the true power of MySQL we are utilizing and that's the reason why I chose to use
MySQL here the other table here is a booking table
it has a booking_id which is the primary key here, which will
be referenced across the whole system it has a room_id, again comes from the
room table it has a user_id, a start_date and an end_date for a particular booking, number_of_rooms
which is how many rooms the person has booked,
status and an invoice_id. looking at this design
we can clearly understand that one booking cannot contain
different room types you can have multiple rooms of the same room type
but you cannot have like one deluxe room and one regular room in one booking.
If you want that there'll be a small change required
but i think that's a minor detail it can be taken care of easily.
The important part here is the status column.
it has these four values  - reserved, booked cancelled and completed. Now canceled
and completed are the terminal statuses here so the booking gets first created into reserved status.
Then based on the payment success it can either move to book or cancel.
And once the user stays in that, it moves to complete.
Now you can add more statuses depending upon your conversation with your
interviewer but these four statuses are the main
ones that will help us achieve what we initially thought of.
Now, let's look at the API Signature so this will have one important API called a book API
it will be a POST API which will take these five attributes. It will contain a user_id it will contain a room_id, it will contain the quantity.
Now again if you want to make multiple rooms multiple quantity we'll have to
change it a bit to have an array but let's stick to this
for now it'll have a start_date and it'll have a end_date.
The price will come from somewhere else let's assume for now.
It'll actually come from the data store which contains the price for the room at
this point in time we don't want to generally take the
price from the user because then the request can be tampered with and that's
not really a good design okay now let's do a quick revision of
the design because i skipped some important
details in the earlier larger diagram and we'll go over that now. So the way
Booking Service actually works is when it gets a request to do a
booking it first of all queries this table and
the available_rooms table and check whether or not I have that many number
of rooms remaining or not. So if there are no rooms left for that
particular room_id for that particular date, there's no point of proceeding so we can error out from there.
But in case that's a success and we have rooms then we actually go ahead with the
blocking of the room saying that now I'll block it
temporarily and if the payment is success I'll actually
book the room. I'll do a quick dry run of what actually happens.
Assuming this is the request that came in user_id: 1 | room_id: 5 | quantity: 1 
for some date "dt" to "dt +1".  
The room_id: 5 on that particular date "dt" has 7 available rooms. So our first
check is a success that we have enough rooms. So what essentially will happen is there'll be a row created in this table
with a booking_id: (some_uuid) | room_id: 5 user_id: 1 | start_date: dt
whatever that is, end_date would be "dt + 1" whatever that is, number_of_rooms in the request is
quantity:1, and status would be at this point in time, RESERVED. invoice_id at this point in time
would be NULL because there is no invoice created till now Now, we have a record, along with
that we also decrement the quantity here now here again we are utilizing a very
important feature of MySQL which is part of the ACID property
 and transactions. So we are creating a record here[booking table] and we
are reducing the quantity here[available_rooms] to 6. what essentially we are trying to do is
basically bounding this as part of one transaction so let's say there was just
one room left and two three requests came in only one
transaction would be successful to do both these things. Basically to insert
this record and reduce the quantity because we have this constraint sitting
over here which says that quantity cannot be negative.
okay so only one of the transaction will be success,
and only one of the rooms will be booked and no two users will be redirected to
payment. That being taken care of what is the
next step so i have written down the steps here if you want to actually look
at so what we have gone through till now is
step number one and step number two okay we've inserted in booking and
reduces reduce the quantity in available_rooms our step number three is something that I did not cover as part of the
larger design review because it was getting too much cluttered.
Now we cannot keep this room reserved for an infinite amount of time.
What we can say is if the payment is success in next five minutes,
well and good, if not then we'll assume that the payment will not go through
and will unblock the room so that somebody else could book it, okay.
So there are multiple ways to implement that what I choose to implement here is
something using the TTL(Time To Live) of Redis. So because we anyway are using a Redis we can utilize the same cluster of
Redis for this use case as well. So what we'll do is we'll put the key in Redis saying some booking_id
expires at some timestamp Now the time stamp could be a
configurable number, it could be a fixed timestamp across the board, it
could be a country specific timestamp, for India have an
expiry time of five minutes, for US have expiry time of four minutes, something of
that sort but whatever that time is, we'll insert
that into redis. Now what redis does is, it has something
called callbacks so one of the later versions of Redis
has introduced this concept called callbacks so whenever a key is getting expired you'll get a notification, okay. 
And you can do whatever you need to do at that point in time, right. 
So, if you get a Success notification from payment,
well and good. Success notification means the payment has gone through,
then you will mark the booking as BOOKED but before that if you get a
callback from Redis saying that the key has expired and you've not got the
success from payment you will say that the booking is CANCELLED.
Alternatively you could also get a failure from payment saying for whatever
reason the payment didn't go through and you got a failure response from the
Payment Service, in that again you can say CANCELLED.
Now if you want a bifurcation of the varieties of CANCELLED,
you can maybe make multiple statuses like cancel because of invoicing / cancel
because of payment/ cancel because of expiry, whatever right
or you could maybe add a status_reason column or something of that sort but that's a very minor detail we'll skip that for now, okay. 
So let's go over what all possibilities are there in this
and how each of them behaves, okay. So, first very simple thing is - 
what happens when payment is a Sucess? so in case payment is a success
everything remains the same just the status becomes BOOKED. okay, in that case, we do get some
invoice_id as well. So basically we'll get an
invoice_id from Payment Service whenever you know a booking is getting
success and we'll just update the invoice_id there and then the
regular kafka events would also be sent saying the booking is now complete and here's the kafka event for that in case
somebody wants to do something on that. What happens when payment fails?
Now in this we just have these four statuses so the booking status will
become CANCELLED. okay there would be no invoice_id in
this case Why? because if the payment did not go
through there obviously is not an invoice that is generated.
And everything else remains the same but, if the payment did not go through, we
need to revert the available_quantity again. so available_quantity in that case would become seven.
Now let's say your key expired so basically let's say the user was
redirected to payment screen and there was no response from payment
service for whatever reason what happens then if we get a call back
from Redis and based on that call back we can say
that okay now the payment has not gone through
we will follow the same process as payment failure we will mark this
CANCELLED okay we will mark this CANCELLED and we'll
increment the quantity in available_quantity so that the room is now available for somebody else to use. 
Again in that scenario there is no invoice generated. But this you do only if the status is RESERVED.
Why? -  coming to the next case, what happens if both (3) and (1) happen.
What happens if you get a key expiry event and a payment is also success. so there are two conditions
if the payment has already been successful and the booking has already
been moved to BOOKED status, after that if you
get this key expired event then you don't do anything because that
is any way bound to happen right? but what if it happens the
other way around what if key expired first you move the
booking to CANCELLED state but then you get a notification saying
payment is success Now there are multiple directions
in which you could take it based on your conversation with your interviewer
and the non-functional requirements and in fact even the functional requirements
for that matter you could do two three things. You could
now either revert the payment saying for whatever reason we were not
able to book the room so here's your payment back.
Alternatively you could do something even more smarter.
You could say that now I have anyway got the payment from the user,
I can check if there are rooms available and I'll book them, right?
Now this could be done based on what the requirement is
and you could talk to your interviewer and implement it either ways.
All good so far but there are a couple of caveats here.
The TTL that you have talked about it is not a very precise measure so
let's just say that a key was supposed to expire at 10:00 okay, 
you will probably never ever get a call back at this point
in time it will always have some delay. Now in
this case it doesn't matter too much instead of at 10:00 if you get it at 10:01 it's possibly okay also. So it's not too big of a problem and the reason for that is because of
the way expires are implemented in Redis I'll not go too much into detail of that
but there's a background process that runs in Redis for keys that are not accessed and whenever that process
gets to access a particular key is when it will expire it.
So it is not necessary that it will acquire it at exactly the same time.
But let's say if you wanted it to be totally precise then you could possibly tweak the implementation
a bit and do a slightly different way so instead of doing a TTL based approach
you could in fact implement a queue with it within Redis and have a poller that kind of queries Redis, the topmost node of the queue every one second and whichever one it it
finds has expired then you could kind of delete that but
that's not that's obviously much better but that
comes at a cost so you'll have to build a kind of a
polling mechanism so that's additional development effort
and then it will be continuously bombarding Redis every one second
so there's a lot of CPU being utilized on both the sides on the cron side,
and on the Redis side so possibly you'll have to add more nodes into the Redis
cluster and also on the side where cron is being
developed So now that's a tradeoff. Do you want to
be notified absolutely immediately when the keys are supposed to be expired
and at the cost of additional hardware that trade-off you can again make
with the conversation with your interviewer. But
otherwise all of this being said I would still go with a TTL based approach
because in this particular example it doesn't really matter so much.
Now a couple of optimizations you could do. So, let's just say payment is success. You know that key will expire after some time,
for sure, right? because it's there in Redis. You don't need to keep that key there you know the payment is success you can
evict the key right, even if the for the payment
failure case you know that payment has failed it will
expire after five minutes might as well delete the key then and there, right.
So these are certain optimizations that you could do over
this implementation to make it even more better. But on and off this is how the booking flow works. Now again
reiterating we have used a couple of important features of MySQL
and that's what is helping us to make the code on application side much more
smoother had we used some other database which
doesn't provide for example if you were using Cassandra here
we would not have had access to the transactions and the constraints and all
of that you would have to implement it on
application side. That's additional effort on our side to make sure things
are consistent. in this case I would rather leave it to
MySQL to implement all of those things. 
Now coming back to the same architecture again i just want to call out that all of the
components that you see here are individually horizontally scalable
so let's just say there's a traffic spike happening on one of the components
we could increase the number of nodes in that particular service
maybe that particular database and then that should work just fine.
As far as kafka and hadoop cluster are concerned we could add more nodes into
that as well and they should also scale to a much larger
scale than what we need. Cool, so now let's look at what kind of
alternates that we could have used instead of this particular design choice.
So first of all why MySQL, we could use any other relational database here.
We could use a Postgres we could use a SQL Server,
anything which provides ACID guarantees should be fairly fine here.
As far as Redis is concerned we could use a memcache or any other cache
instead of Redis and that should also be good.
Cassandra, I would still stick to Cassandra because
that is exactly what we need here now technically in place of Cassandra we
could also use a HBase here that would also work fine but it has a
lot of operational overhead in terms of deployment and maintaining it over time
so that's the reason I would prefer Cassandra over HBase or any other similar
system The way cassandra works is every data in
cassandra is you know sharded across a partition key
so each query has to happen on a partition key now the
queries that we are doing are just of two varieties.
1) Get bookings by hotel or 2) Get bookings by user. There is no the third variety
so we basically have two kinds of data which is distributed by two different
partition keys on which the queries are happening. So this would be kind of a very good choice here. In place of Kafka, 
we could have used an Active MQ or a Rabbit MQ or any other queueing
mechanism there's an amazon queue(SQS) also we could
have used that but i think kafka scales much better than most of them so
i think it's a fairly good choice here. Other than that in general we definitely
need to monitor how are our CPUs and Memory is behaving. 
So if I have a CPU spike at certain points in time that is something we need
to kind of look at so across the whole infrastructure we
need to keep an eye on how my CPU usage  percentage is, how my
memory usage percentage is, how my disk usage for Redis is, how my disk
usage for elastic search is all of these things are what we need to
monitor now monitoring could be done through a
grafana kind of a tool on which i can set up alert. So if the
let's say a particular metric has some threshold
the moment I cross that threshold or with certain conditions
I could send out an alert and the team could get notified that something is
potentially wrong and they need to look at that.
this will help us to make sure that we in the end achieve our
NFRs that we talked about of latency and high availability.
Because let's just say something goes wrong let's just say
memory is you know utilize more than what we expected
eventually it will lead to some machines going down and eventually it will lead
to us having a lower availability that than what we expected so yeah these are the things that we need to monitor and alert on.
Now in the next section let's look at how this whole thing would be spread across geographies, so for example let's say
there's an earthquake in one of the data centers and everything just goes away out of the blue what do we do?
So let's look at that next So let's say we have these four data
centers data center 1, data center 2 data center 3, and data center 4 which
are located in different geographical regions across the globe, okay.
Now we want to create a topology in a way that we do get low latency and high availability
okay so one very simple approach that we could do is say that DC 1
is our primary and all the three DC's are our secondary data centers
and data is replicated to all the three data centers in near real time okay, so that's okay it's good enough. but it's not very
good to be honest because we are just using 25 percent of
our capacity as primary which is active and rest
three data centers are sitting idle and not really doing anything.
So let's try to improvise what we could instead do
is divide the data centers and thus the globe into two parts. 
What we could say is this is region one and this is region two okay now the
countries or people accessing our services
who are closer to this region(R1) will connect to this region(R1)
and the people who are closer to that region(R2) will connect to that region(R2).
Now how are we able to do that so the data in a hotel management system is fairly specific to a geography so all the hotels in let's say India can be you know separated from all the hotels in US.
Similarly all the rooms all the bookings are now specific to hotels and thus
specific to geography so we could kind of bifurcate the data
as per geography right which gives us the leverage to
divide the system into two halves right now what will happen here now
let's just say DC1 is the primary in this region(R1) and DC3 is
the primary in R2 okay now if DC1 goes down all the data in DC1 is getting replicated to DC2 in near
real time so if that goes down DC2 can become
active and all the clients who are connecting
to DC1 and how will they connect so there will be bunch of clients who
are connecting via some DNS to DC1 right if this goes down DNS can flip and connect to DC2 if this link is broken right similar thing can happen on this side so this way what we have is basically
dividing our infrastructure into two halves thereby
clients who are closer to this region are connecting to the servers that are
closer to them thus giving them lower latency right.
Now we could go even one step further we could say that we'll divide the region into four parts and we could do we could go
as much as deep we want into this to increase the
latency basically to reduce the latency and
increase the availability but i think for all practical purposes
at least for a Hotel Booking System this R1 R2 thing is more than sufficient
to give us a good enough latency and a very high availability.
So I think yeah that should be it for a Hotel Booking System.

---

## 5. TinyURL System Design | URL Shortner System Design Interview Question | Bitly System Design
**Channel:** CodeKarle | **Views:** 178K | **Date:** 5 years ago | **Duration:** 24:36 | **ID:** AVztRY77xxA
**Link:** https://youtube.com/watch?v=AVztRY77xxA

### Transcript:
Hello everyone! Welcome to codeKarle.
In this video we'll be talking about possibly one of the most common
system design interview question. So let's see how do we design a URL shortening service, something very similar to tinyurl.com. Let's start with the functional (FRs) and
non functional requirements (NFRs). This is a fairly straightforward problem.
You have these two functional requirements - given a long URL, you get a short URL.
So, when somebody wants to shorten the URL, they'll give you a long URL and you need to return a shorter URL for that. On the other side, when somebody hits a short URL then you basically redirect the person to the longer URL, which is the second point. On the non-functional side, this service needs to be highly available and it should work at a very low latency. Because, let's just say, we were building it for a Facebook or a Twitter kind of a scenario,  it would just be a bad experience if it just takes a lot of time to respond. And this being a very platform kind of a component, it needs to be always available and respond back in a very short time. The very first thing to answer is -
What should be the length of our short URL? That depends upon the scale that we need to build this system for. If we're just told a couple of hundreds of URLs, maybe 2-3 characters are more than enough. But if you are building it at a Google scale or a Facebook scale, then we need to think over what should be the length of our short URL. Because we should not run out of the short URLs. Another option is - we build a system agnostic of the length and we start from somewhere and it keeps on incrementing. But let's start with a fixed length to start. The very first question you need to ask your interviewer is - What is the traffic you are looking at? How many unique URLs will come to you for shortening? Probably every day, every month, something of some number. Until what duration you need to support that? Let's just assume that - Once a URL is converted into a shorter URL, you need to save it for at least next ten years. Sounds a bit too much, but let's just take it as a number, okay. With that in mind, let's look at how can we come up with the potential length. So, let's just say that your interviewer tells you that there are 'X' number of requests that come to you every second. So, (X * 60) is the number of requests.
These are basically the number of short URLs that you have to generate. So, these are the number of requests
that come to you in a minute. These are the number of
requests that come to you in an hour. Multiplying by 24 gives you the number of requests in a day. Multiplying by 365 gives you the number of requests in a year. Multiplying by 10 years. Whatever this number would be, you should be able to build a system which can handle these number of unique requests. Let's just say this number is 'Y'.
Now, the next question to ask is - What all characters can you include in the short URL? Should it be just numbers? Could it be alphabets? Could it be capital alphabets and small case alphabets? What all is allowed? Generally, people take [A to Z], [a to z] and numbers. So maybe we can stick to that but you could ask your interviewer and then you could come up with a set of, basically a character set that is allowed for short URLs. For now, let us assume that we'll take [a to z], [A to Z] and numbers [0 to 9]. These are 62 characters which you can use in the short URL. Now, you need to have some length, you need to come up with a length which can handle these number of URLs, these number of unique combinations of these 62 characters. Let's just say if the length was 1, then you can support 62 URLs. Because there is one possibility each. If the length of the short URL is 2, then you can support (62 ^ 2), which is some number let's say. Basically, you need to come up with a number where (62 ^ n)  is greater than this number Y. You solve this equation and you get the answer to n. n would be log62(Y). The feeling of it. Let's say, if this number comes down to be 4.5, then you take n = 5 so you will create short URLs of length 5. As a general number, (62 ^ 6) is somewhere around 58 billion if I am not wrong and (62 ^ 7) is somewhere around 3.5 trillion. Both of these are very massive numbers. Depending upon what is your use case, you can come up with some length. Let's just say, for our use case, we will stick to 7 characters. Generally, I have seen it's a standard that these short URLs generally use 7 characters, may be more at times. But we will stick to 7 characters and we will be able to support 3.5 trillion unique URLs. That I am assuming is more than this number (Y). If it so happens that this Y is even more,
then you can probably take 8 characters, 9 characters or whatever. Now, let's look at one of the potential architectures that can solve this problem. This is not a final version. We will iterate over it. So, let's just say, there is this UI, which takes the long URL as input and gives back the short URL. So, it will call the Short URL Service. There'll be multiple instances of this service, which somehow generates a short URL and stores it in the database and returns the short URL to the customer. On the other side, this could also be used when somebody hits a short URL wherein the Short URL Service would fetch the long URLs from the database and then redirect the user to the longer URL. This looks nice. But then we have not covered one important point that how does this service really generate a short URL. Even though we had those 62 characters, for all the communication further we'll just assume, we'll just use numbers so that it's easy to calculate and think over it. Let's just say, there are multiple instances of this service and all of them are getting some requests. This service could also generate a number 111, this service could also generate a number 111 and then we will end up with a collision. If two services generate a same short URL for two requests then we have a problem. In technical terms it's called a
collision but for us it's a problem because we cannot have one short URL
pointing to two long URLs. You can say that the possible solution could be that we first check in the database and then you know  kind of retry. That would be fine but then the problem is that's not really efficient. What we need is a predictable way to generate a short URL knowing that there would be no collisions at all. One very simple way to do
that is using one of the features of Redis. So let's just say, we use a Redis cluster and all of these services request a number from Redis. Redis makes sure that it will always return a unique number. So basically what it will do is - it will start the counting from 1 all the way up to billions, trillions, whatever. And each time it gets a request, it increments the counter and responds back. We will make sure that all of these guys are getting unique numbers and from unique number at base 10, they can convert to base 62 and generate the short URL. Now that would work fine
but then we have a problem. The problem is that first of all, everybody now is connecting to Redis. So, we have Redis under a huge amount of load. Second problem is - remember one of the important key things of any system design interview, you should never create a single point of failure. What is happening is - in all the requests that have to generate a short URL, this Redis becomes a single point of failure and there is no backup to it. If this goes down then there is no way we can recover, which is a problem. You can argue that we can have multiple Redis but that's also tricky. Moreover, if the scale becomes beyond the capacity of one Redis machine, then we are in much bigger problem.  Why? Because, let's say, if one Redis is not able to scale to the latency requirements that we wanted to, this will again start choking the whole
system. Another alternate is - that we keep multiple Redis that will give us high availability and it will give us better performance because now there are
multiple machines and some of these machines will talk to this Redis and
let's say this machine talks to this Redis. This would work just fine till the time these Redis don't start generating duplicate numbers.  If both the Redis are starting from the same
index, again they'll start generating duplicates. What we need to do is - somehow make sure that both these Redis do not generate a same number. One very simple way is - to give a series
to this Redis, another series to this Redis to start with. That would work fine. But, what if you have to add a third Redis. Now it becomes complicated. Now you need somebody to manage what series are being given to whom. Plus once you have that management piece, we might as well try to get away from Redis. Let's try to look at a slightly more advanced system which can generate unique URLs without using a Redis, without having a single point of failure. Let's look at one of the possible solutions which can solve this problem. Remember, what we need. Whenever we get a long URL and we need to convert it to a short URL, we basically need to make sure that our service machine should be able to generate a unique number, which will never ever get repeated even by any other instance of the service. So, each of these two service instances should generate a number, which other ones will never ever generate. Convert that number from base 10 to base 62 and return back. This is the flow that we need. What we've done is - again going over the UI, so this is the, green thing is basically the Long to Short UI, from where somebody can give a long URL and expect to get a short URL as an output. It talks to a load balancer and behind it are multiple instances of Short URL Service.  What I am trying to now do is - I have introduced a Token Service. The idea is all of these guys need to have a number. And making sure that none of them, none of the other machines generate the same number. One of the simple ways to do that is -assign ranges to each of the machines. I can say that - this Short URL Service will request a token range from Token Service. Each time Token Service gets a request, it will run on a single threaded model and it will give a range to any of the service instances. Let's say, it says that, I am giving a range (1 - 1,000) to this machine. Now, this machine on startup will also call Token Service. So, all of these services call Token Service either when they start up or when they are running out of the range. Now, let's say, this service got a range from (1001 - 2000). Similarly, other instances of the same service would also get some range. This Token Service can be built on top of a MySQL, because it runs at a very low scale. It will get a call once in a couple of hours and it will return like the ranges.  I have taken these numbers as (1 - 1,000). Realistically, it will be a bit larger number so that at least it can run for an hour or so. So, now Token Service has given numbers to each of these services. Now, the flow is very simple. Let's say, a request reaches this service. It takes the first number 1001, converts that into base 62 and returns the output. Obviously after saving it. The next request comes, it increments it. It takes 1002, saves it in Cassandra, returns back. Next request comes in, it uses 1003. Let's say, it somehow gets lots of requests, gets to 2000. At that point in time, maybe a bit before that also, when we are closing the end of the range, it will query Token Service and get the next range. Let's say, the next range that this service got is (5001 - 6000), let's say. So, now it will continue processing this one. Now, when (5001 - 6000) is assigned to this service, when this service will make a request, it can possibly get (6001 - 7000), but it will never get this (5001 - 6000) range. Why? Because that thing is maintained by Token Service and the way it would probably work is - it will keep a range as a record and keep a flag, whether it is assigned or not. In a simple MySQL, on transaction basis, you get a record. When you get a request, you take the first unassigned token range and return that. And because it will then sit on top of a MySQL database, it will make sure that it is always unique. So, this becomes kind of our read flow. Now, let's say, there is a massive amount of traffic. All we need to do is - keep multiple instances of Token Service, at max. Even though it might... so, there are multiple ways to scale it. First of all, we can increase the length of the range so that it doesn't get bombarded too often. So, instead of thousands - thousands, we can allocate millions of tokens at once so it doesn't get too many requests. And anyway, this service will be distributed in multiple geographies at least and multiple data centers so that this doesn't become a single point of failure. There are some problems in this. Possible problems are - What if this service got this (5001 - 6000) range, started working for a while, used a couple of tokens and then it kind of got shut down and died? Let's say, there was an Out Of Memory error and this process got killed. What happens to those tokens? So, those tokens go away. Go away as in, there is no track record of how many tokens are being used. All what is happening is - it is iterating over that list in-memory and assigning one token to each request. If this service dies down, it will probably, on
the same machine, it will get started up again and the next time we will get another token range. Let's say, third time, it gets a token range of (9001 - 10000). Now, all the unused tokens of this (5001 - 6000) range, there is no record of them. So, they are kind of gone forever. If you look at it, let's say, even if this happens a couple of times in a day, overall how many tokens? If with the length of 7 for a short URL, we are able to support 3.5 trillion unique numbers. That is a very massive number. If you lose out a couple of thousands of tokens out of this range, it is like taking a bucket out of an ocean. It doesn't really matter. So, even if you lose out some tokens, it's okay!!  But, if you start tracking those tokens, then it will become a fairly complicated system. Just to make it easy for us to develop, we will say that - okay! when the system shuts down, all those tokens go away. We don't need them. We will get a new range of tokens and work out of that. That is one thing that we could do. 
This is basically the long URL to short URL path. On the other side, when a short URL is hit, all you do is - you get a request in short URL, you hit your database and you get the longer URL, you send it back to this service. This service does a redirect and the user gets redirected to the main URL. One thing I have not answered is - Why
did I use a Cassandra? Ideally, I could have used any database here. All we need to do is - to keep a database which can handle these many number of unique URLs. A MySQL, at these number of records would start giving some problems. We can shard it probably and make it work. Cassandra will, for sure, work. So, that's
the reason I've kept Cassandra. You can try using a MySQL here. With enough sharding and all of that, that would possibly also work fine. That's not that big of a problem. Plus this Token service is also using a MySQL. So, that could be shared across both the services as well. Whatever we have built till now is good enough from a functional and non-functional standpoint and it does what we were supposed to build. But is it good enough?
Definitely not!! Why? Because this system, what we have
built, does not give us any metrics about how it is being used, what kind of URLs are the top most used URLs, what kind of geographies people come from and it does not give any kind of metrics that we would want to have out of this system. For example, whenever a person is generating a short URL, wouldn't it be nice, if we can tell them what kind of geography do your people come from or what kind of hits are you getting or what kind of user agents or devices the people are connecting from. All of those things would be valuable information for any person who's generating a short URL. Similarly for us, let's say, if we have multiple data centers. Let's say, for example, we have 4 data centers and we want to choose any 2 of them as primary  and 2 of them as standby data centers - and they are spread across the globe. If you have to decide which ones should be primary and which ones should be secondary, normally, what companies do is - they just make a decision based on somebody's gut feeling. But we could make a data-driven decision over here, depending upon what kind of traffic we are getting, from what kind of geographies and wherever we are getting most amount of traffic from, the data centers closer to those geographies could be made as primary data centers. For doing all of these things, it will be good to have a good enough amount of analytics that this system emits out. Let's look at how can we do that? Let's see how the analytics is being built. The normal flow, the way it works is -
whenever we get a request with a short URL, let's say, a client sends us a request. We query our database, get the longer URL from the database based on the short URL and return it back to the client, which then redirects the user to the longer URL. Instead of just simply returning the URL, what we'll essentially do is - each time the request comes to us, that request will come with a lot of attributes. It will give us some origin header saying what is the platform from where this request has come in. So, let's  just say, we posted this link on a Facebook or a LinkedIn kind of a platform, it will have that information. It will also have information about the user agent which is calling, let's say, if it's an Android application or iOS application or a browser. It will have that kind of an information as well and it will also have a source IP address. All of these information, before sending out the response, we will also put that into a Kafka, which will be used to then power the Analytics. Based on the IP address, we'll also be able to come up with what country it is. So, all of those things can be taken care of on the Analytics side. But if we start putting into Kafka on each request when we get the request, it will impact our non-functional requirement of latency.  Why? Because, now we are doing an additional step in the process and that will increase the latency. So, I would not recommend doing that. What instead we could do as a fairly nice solution is - make that Kafka request as a parallel call. So, you can have a different thread, in which you can send the Kafka write and return back to the user. And asynchronously, it can be returned to Kafka. What is the problem in doing an asynchronous thing? There is a potential possibility that the Kafka write could fail, for whatever reason, and you have returned back to the user so you'll miss certain analytics. Now, in this kind of a system, because payment and all is not involved, it's just some simple analytics, we should be okay if we are losing out on certain events. So, I think it's okay if we build it this way also. Worst case, we'll just lose out on some analytics, which is fine. But, can we improve it even further? So, the problem with this approach is - each time we write to Kafka, it involves some I/O (input/ output). There's a CPU involved, there's a I/O involved, there's a network transfer involved. Can we avoid all of this i.e. doing all of this on each call? Probably! So, what we could do is - instead of writing into Kafka on each request, we could maybe aggregate that information locally in a machine.  So, maybe you can have a queue or some kind of a data structure in which you are persisting each record that we got a request for this short URL with count 1. The request again comes in, you increment the count to count 2. Something of that sort you could implement. Or you could simply make it as a queue of all the requests. Whenever the size of the data structure crosses some threshold, or you could do it on a time basis also, saying every 10 seconds you'll flush that. So, in whatever condition you can flush the data into that data structure, into one call in Kafka. Basically you are reducing the I/O that you are doing with each request and doing it as a batch write. The benefit you get is - you can have now drive much more performance out of that single machine, thereby helping us in the non-functional requirements of high availability, low latency, all of that. And secondly, it will improve the overall performance of the system. Again, the drawback here is - now you can lose out, not just one event but a lot of events. Based on your conversation with your interviewer, you can decide on - if that's okay or not. Personally, I would say it's a fairly okay thing if you lose out on 10, 20, 30 events. That's perfectly fine. Now, we have put all the events into Kafka. Now what happens? So, there are a bunch of ways you can implement Analytics. One very simple approach is - you can dump all of this data into a Hadoop and then build some Hive queries and some kind of queries on top of it, which will generate you aggregate results. Alternatively, you could also have a Spark Steaming job running, which comes up every 10 minutes, let's say and takes all the data in last 10 minutes and does some aggregate analysis on top of it, saying which URL was it, how many times, which geographies people came in, how many times, something of that sort and dumps the aggregate information into a data store, which can then be used to power various kinds of analytics that user can see. So, you could implement it in either way you want, based on the conversation with your interviewer. So yeah!! I think this should be it for a URL shortening system.

---

## 6. Zoom System Design | WhatsApp / FB Video Calling System Design | System Design Interview Question
**Channel:** CodeKarle | **Views:** 127K | **Date:** 5 years ago | **Duration:** 56:01 | **ID:** G32ThJakeHk
**Link:** https://youtube.com/watch?v=G32ThJakeHk

### Transcript:
Hello everyone!! This is another video in the system design interview preparation series from codeKarle. Now, this is something that has lately been asked very frequently by a lot of companies. So, let's look at how do we build a video conferencing application or a video chatting application, something very similar to Zoom or WebEx or WhatsApp video call or Facebook video call, Google Hangouts. There are a lot of apps these days. So, let's try to build one of them. Also, near the end, we'll try to look at how could we enhance this platform to build a live streaming system. Something, for example, if you want to stream a live speech of a politician, or if you want to stream a live game or match, how do you do that to millions of users? Let's look at some of the functional and non-functional requirements that this platform needs to support. So, the very first functional requirement is that this platform should support a one to one calling feature wherein one person is making a video call to another person. The next obvious feature is that it should support a group calling also. Maybe 5 - 10 people could come together on a group video call or an audio call, and they should be able to see other's screen or picture or anything. The next thing is - these calls could be audio calls, could be video calls, and people would also be allowed to do a screen share. Now, video and screen share are fundamentally the same thing. It is just a stream of video content whose input sources are now different. Input source for a video call would be a camera and input source for a screen recording would be a screen share. But fundamentally, both of them are still implemented in a very same way. We'll also allow our users to record these video calls, in case, you know, they want to look at it at a later point in time. Screen recording is supported in some of the platforms like Zoom. All the personal use apps like WhatsApp and all, don't support that. So, we'll not go into too much of detail on this, but we'll still go over it, a little bit. Let's look at some of the non-functional requirements now. The very first thing is that this platform should be superfast. If you have seen my other videos, I generally say that the system should have a low latency. But in this scenario, low latency would not be good enough. So if you do a comparison with YouTube, if let's say, a video on YouTube is buffering, that would be okay. People would realize that it is probably buffering because of slow network connectivity or whatever. But when you are on a video call, you cannot have a lag because if you start having a lag a video call and too in a group video call, that would be a really, really bad user experience and nobody would want to come on this platform. So, we need to absolutely make sure that the platform is super fast and it almost seems instantaneous conversation. The next thing is that the system should have a very high availability. It should be fault tolerant in terms of hardware and also distributed geographically, so as to provide low latency and durability. The next thing is that - in some scenarios, data loss is okay. The idea of data loss is - let's say if you are watching a video and if a couple of frames of the video are missed, normally you wouldn't even realize that. And that too when you are on a video call with somebody, if a few frames get missed, it really wouldn't make a difference. So, if we have to compare amongst all the three - latency, availability and absolute data consistency, consistency is what we will be okay to let go of, if you are able to get a better latency and availability. Let's try to look at how can we design this system given all of these constraints. This video basically takes inspiration from another video that I have made, which is on building a chat application like WhatsApp. There were a lot of concepts that were introduced in that video, which we will be using here and we'll extend the whole design to now support even video capabilities. So, I would recommend to watch that video first before watching this video. Now, assuming you are aware of how do we build a chat application, let's go over some of the conceptual things which we'll be using in this video. And let's try to understand some protocols on which Internet is based. Let's look at how does a client application talk to a server. So normally when you're building a system design, you'll have a couple of services that are sitting on the backend  and a couple of clients which are talking to them. Normally these would be implemented as Rest APIs or some kind of an API, which would generally work on HTTP protocol. To make it secure, nowadays we are using HTTPS generally instead of HTTP. So that is one way to communicate. Another way could be wherein you need to build something like a WhatsApp wherein a server might want to send notification to a user or a user might want to send a message to the server and you need a bidirectional communication protocol. For all of those kind of use cases, we use something called as a WebSocket. Both of these HTTP, HTTPS and WebSocket, all the three of these are basically built on something called as a TCP, which is a Transport Layer Protocol. Now, let's try to understand how does TCP work and why are we talking about that in this video particularly. The way TCP works is - let's say you have a client which wants to talk to a server. So, the very first thing as part of TCP that happens is - a connection is established between a client and a server. Now the way connection is established is - client sends a message to a server saying that I want to connect to you. Are you okay with that or not? If server has resources to connect to that client, server will send back a response to the client saying, yes, I'm okay, let's connect. Then client will send a confirmation saying, okay, great, we are connected. And then is when a connection is established between a client and a server. All good till now!! Let's talk about how does the data flow happen. Let's just say.. so everything in the TCP world is in the form of packets. So there are packets of information that are sent from client to server. Let's say the client wanted to send a packet which has some information and let's say it has a id, P1. Now, to send P1 to the service, what client actually does is - it says that I'm sending a packet P1, which is a packet number one for this kind of communication that we are having and sends it to the server. The server then sends an acknowledgement back to the client saying I have received P1 packet. Till a certain point in time, if a client does not receive an acknowledgement, it again sends the same packet P1. Furthermore, the client will send more packets P2, P3, P4.. each of the packets will have this number 1, 2, 3, 4, 5. It will not be 1, 2 ,3, 4, 5 kind of a number but logically speaking, some number through which the server would be able to identify the order in which the packets are supposed to be received. The whole idea of doing all of this is - that TCP is basically a lossless protocol. It tries, to the best of its ability, to make sure that there is no data loss happening between a client and a server. Wherever it figures out that there is a potential data loss, let's say if it did not get an acknowledgment for a particular packet, it tries to replay that. Also on the server side, it tries to arrange all of the packets in the same order in which they were supposed to be based on this number and then sends it back to the application. So, TCP does all of these things for you. There are a couple of other things also that TCP does. One of the things is called congestion control. If, let's say, TCP realizes that there is too much congestion on the network, it delays sending certain packets so as to make sure the network is not overwhelmed by a lot of packets. These kind of things are sometimes good, sometimes bad. What we are seeing here is - for each one packet of information, there are a couple of times the data is being sent. In our scenario, that is a very bad thing. Why? Because remember the non-functional requirements, we are okay with some data loss but we want the communication to be fast. First of all, to establish a communication, there is three way handshake. Then each packet comes up with a lot of additional information about the sequencing and all of those things. So generally, a TCP header would roughly be 20 bytes. And that's a lot of information and we should try to minimize that as much as possible. So that and then congestion control on top of it, would sometimes even slow down sending the packets from the client itself. Now that being used for a video chatting application, would slow down our experience totally. Why? Because one packet of information, gets an acknowledgement, maybe gets retried.. too much of traffic.. probably not worth it. So let's try to look at some other alternates. So this was TCP for you. Now, there is something called UDP. UDP is a Transport Layer Protocol again. Equivalent to TCP. Runs at the same layer but functionally, totally different. The way UDP works is - let's say you have a client and it wants to send something to the server. It keeps on sending the payload irrespective of whether the server is getting it or not. So let's say, it has these - P1, P2, P3 - packets to send.
It sends P1, server got P1. Then it will send P2. Let's say P2 got dropped in between. It would not bother to send P2 again. It sends P3 and let's say server gets P3. So the server now just has P1 & P3. And P2 got lost in between in the network due to congestion or packet loss or anything. Now, if you compare this with this, it has a lot less data transfer happening in between. And if you look at the header size of UDP, that is roughly, I believe, 8 bytes or something,  which is significantly lesser than the header size of TCP. So there is a lot less overhead in sending each data packet. This kind of a thing, is a lossy protocol.  There could potentially be data loss but it will guarantee that it'll be faster. One drawback here is - the packets could come out of order. So, server could get P3 first and then P1.
So, this kind of thing exists in UDP. TCP, on the other hand, makes sure it is ordering all the packets by this number that was sent along. So this problem was not happening in TCP. But, in our case, we should be okay with that because a couple of packets here & there, a couple of missing frames, a couple of out of order frames, should not be too much of a problem for video conferencing app. So, that's the reason we'll be using UDP here. Now, when we say UDP, we'll not be using your UDP for everything. We'll be using TCP for all the communication between a client and a server which does not involve video transfer. For all the API calls, let's say, a person wants to initiate a conversation with a user, all of those would still be done on TCP. Just the time when there's actually a video transfer happening, that piece would happen on UDP. Let's quickly look at how WhatsApp chatting works and then we'll build on top of it. So, let's just say, there are two users U1 and U2 - and U1 wants to send a WhatsApp message to user U2. So, remember the WhatsApp video, there used to be something called as a WebSocket Handler, which was basically keeping persistent connections based on WebSockets with all the active users. When U1 wants to send a message to U2, U1 will basically inform the handler saying - I want to send this particular message to this particular user; go; send it. WebSocket handler will involve a lot of other systems in between and in the end, it will send a message the U2. Now, other systems that were involved are not of significance in the context that we are talking about right now. So, let's ignore all of that, assuming this is the flow and then to and fro communication can happen between U1 and U2. Let's just say that U1 wants to initiate a video call with user U2. It can follow the same process. It can basically inform the WebSocket Handler saying, I want to make a video call to user U2. First of all, handler will check whether U2 is online or not. If the user is offline, it can handle it in multiple ways. So you can discuss with your interviewer and finalise on that. You can either send an error message to U1 or make a ringing call like what WhatsApp does and kind of do nothing to U2, whatever you want to do, you can do it. But let's just say that user U2 is online. Then, handler will send a message to U2 saying that, user U1 wants to initiate a call with you. Do you want to accept it or not? If the user accepts it, it again follows the same route and the call is established. If the user rejects it, it follows the same route again. End user can see an error message or a different UI saying the user has not picked up the call.  Now, let's say, we have a situation where the call has been accepted. Normally you can do the video call over this whole communication, the way chat was working, that would work fine. But remember, in the previous section, what we said was we do not want to do a video call over TCP. Remember, WebSocket is a protocol that is built on top of TCP. For video calling, we want to do it on top of UDP. So we'll probably have to do something different from what this is. But along with that, wouldn't it be.. let's just say that this server also supports UDP for example. For a moment, let's imagine that. Instead of going all the way, it would be really nice if user U1 can directly talk to U2, in a more peer-to-peer way. If that is possible, then that would be a much better solution. Why? Because it will give a much lower latency and now nobody is dependent on a central server. Plus that reduces the cost also for the service provider because they don't have to intercept all the calls and like transfer the payload from user 1 to user 2. Let's try to see how can we establish a connection between these two parties. Now, UDP fundamentally is a connectionless protocol. So there is no connection as such. Whenever somebody wants to send a UDP message, they essentially say that send this particular message to this particular IP address at this particular port.
That's what actually happens. But each time I say that there needs to be a UDP connection kind of a thing, it basically means that U1 understands how to send a message to U2 and U2 understands how to send a message to U1. Now, what does U1 need to send a message to U2? It essentially needs U2's public IP address.
And U2 needs U1's public IP address to send a message. Now, there comes something called as a Connector. Connector's job is essentially to identify the public IP addresses of both of these users and inform them. So, U1 will call Connector and Connector will tell U1 about U1's public IP address. U2 will call Connector and Connector will tell U2 about U2's public IP address and then through WebSocket Handler, they will interchange each other's public IP address with each other and then they can start sending UDP messages to each other. Now, why do we need a public IP address?
So, each time a machine wants to talk to another machine, they need to have a public IP address to talk to. Now, for all the devices that are on IPv6, this would not be a problem, and that's very straightforward. But as far as I know, statistically, more than 70% of the devices in the world are still on IPv4. So, this is still a major problem that we need to solve because majority of our users will be on IPv4. And what happens with IPv4 is - most of the devices would be connected to their home WiFi router, for example, through a private IP address. So, they wouldn't have a public IP address directly. Then their router would also not have a public IP address. That again would have some private IP address. And at the end of it, there would be an ISP router which would essentially have a public IP address. So, we need to.. basically whatever ISP router U2 has, that could become the public IP address of U2. And U1 needs to get to know that. So, let's do it in two parts. First, let's identify how each of the users identify their own public IP address. So, I have drawn a small diagram here to make it easy for us. This is the same connector component. Let's say, connector has a IP address of 1.2.3.4. And these are the three devices that we have in the system who want to understand their own public IP address. Let's say, this laptop has a IP address of 192.160.1.1, which is a private series IP address. This mobile device again has a 192.160.1.2 IP address. And this could be a smart tv, IP phone, anything, which has a IP address of 192.160.1.3. Let's say, if this laptop wants to identify its public IP address then, what exactly happens. This laptop would then talk to ISP's router via a lot of routers. It could be talking to it's home router then a couple of more routers in between. At the end it will talk to ISP's router. Let's say this laptop establishes this connection with this ISP's router on port P1.  Externally, let's say, the the public IP address of this router is A.B.C.D. These routers will have firewalls. They'll have something called as a Network Address Translator and a lot of things. This NAT essentially (Network Address Translator) converts this public IP address into this private IP address. Let's see how would that work? So this device would send a message to this connector component asking for it's public IP address. If you send a request essentially to 1.2.3.4, that request will go here. This router will forward the request to 1.2.3.4. Now, when this connector gets the request, it will get to know that I have got a request from A.B.C.D from a particular port, let's say P1. If this device was connected to port P1 of this particular router, then connector will get to know that P1 was the port through which I got the request. So in the response, it will send this kind of a message. It will say to the same IP address, A.B.C.D of this router, on this port, let's say it is P1 in this case, it will send the same message, saying your public IP address is A.B.C.D:P1. This device will get to know that my public IP address is A.B.C.D on port P1. Now, same thing happens when these devices connect. It will send a request to router connected on port P2 on the router. Then the request goes forward to connector. Connector sends back a response because now it will know that it got connected to port P2 on this device. It will send that request. NAT will convert that request, which was supposed to come for A.B.C.D:P2 (for the port) to this particular device's IP address. And this guy will also get to know. Similarly, all three of them will get to know that their public IP address is A.B.C.D, with individual port - P1, P2, P3 whatever that is. So, this is how a device gets to know their public IP address. All good till now. Assuming both the parties have got their own public IP address. Let's say, public IP address of U1 is IP1:P1 (port).
And public IP address of U2 is IP2:P2 (port). Now, once they have got this information, they will again talk to WebSocket handler saying.. U2 will say that my public IP address is this, inform this to U1. And U1 will say that my public IP address is this, inform it to U2. WebSocket handler will inform both the other parties that these are the public IP addresses. Now, you can go, talk to each other. There are a couple of other things that also happen here. One of the very common or important thing is.. let's say, U1 is on a very high speed Internet and it can support HD video. But U2, for example, is on a 2G connection. It cannot support a HD video. It would probably have a low definition video or just audio. Now, do you think it makes sense for U1 to start sending high definition video when U2 cannot receive it? Probably not! because the communication now will not happen via all this. Communication is supposed to happen through this route. If U1 starts sending HD packets, U2 will not be able to process them at the same speed that U1 is sending at. Essentially, the experience would be really bad. So both the parties will exchange a couple of attributes about their own connections, their own configurations, and then decide on a particular configuration for the video call. So both the parties will inform what kind of a network bandwidth they are on. They will also inform the kind of codec that they support.  And they will probably also inform about their resolutions and stuff like that. Based on that, a mutual decision would be taken that we will support let's say a low definition Basically the minimum of the requirements - which ever device has minimum requirements in each category, those minimum requirements are chosen. So, if let's say, U2 has lower bandwidth availability then low bandwidth will be chosen. If, let's say, U1 is on a mobile phone with a lower number of pixels, then the communication will probably happen on lower number of pixels, something of that sort. Now, that handshake again happens through the same route, via WebSocket Handler. Now, once all of that is finalized, then is when the actual video call begins. That could be a video call. It could be a audio call. It could be screen share, anything. Now, it is just a stream of packets which is being sent to either this IP address or this IP address. Now, each device does two things - it sends a payload and it receives a payload. So, the logic of how to show something on the UI or the application, would be taken care of by the clients itself. So, each of the applications running on these devices would take care of how do I render the stream of input that I'm getting and how do I render the stream of output that I'm sending out. So, all of those things would be taken care of at that level. Now, all of this sounds really nice. Then why don't we do this for all the use cases? Why did we have this in the first place? We could have built chat also this way. But it is not always so easy. Most of the times what would happen is, first of all, UDP might not be supported. Because, let's say, there are.. so, at this layer, along with NAT, there would be a firewall also.  Most of the times or not most of the times, but some of the times, some of the firewalls do not allow UDP traffic. In that case, the traffic needs to then move to TCP and then eventually either on websocket or HTTP(s) protocols. Either of the two protocols, the communication will move to.
So, all of those things happen. But there is a slight more technicality even here. There is something called as a Symmetric NAT. What that is, is basically when this device wants to connect to this connector, it basically connects via port P1. So, if there's a symmetric NAT, it will make sure that only this connector can talk back to P2. What we are doing essentially is.. there is this user device U of another user who's also talking to the same port. In the scenario, there was one connector which got to know of this port. And then there is U1 which is also talking to the same port. But in case there's a symmetric NAT, then this wouldn't work. This firewall will block this connection of U2 trying to access this port. And if that happens, this whole thing goes for a toss and then we cannot do any of it. So what is the solution? So the solution now is putting something called as a Call Server in between. What this Call Server does is basically a combination of connector + data transfer. This Call Server then, through a similar process, is able to identify each of their addresses. It gets to know. It sends them also. Then, this serves as a intermediate layer for these two parties to talk to each other. So, U1.. it doesn't send directly to U2 any information.. U1 basically sends all the information to Call Server. Call Server then redirects all the information to U2. U2 again sends the information to Call Server and Call Server sends the information to U1. This is how the communication, if it cannot happen in a peer to peer model, it would happen through something called as this Call Server. Now, this is not something that I've invented right now. It is a very standard way of doing video calling. So, this whole process, what we talked of, is something called as a WebRTC. This is a protocol on which this kind of a communication works. WebRTC stands for, I think, Web Real Time Communication. Now, all of the handshaking that this WebSocket handler did, this thing is called as signaling in the world of WebRTC. This connector component that we had, it is actually called as something called as STUN Server. And this Call Server that we used, it is something called as a TURN Server. This is a very standard protocol on which all of these kinds of communications are built. Like, for example, WhatsApp video calling, Facebook Messenger video calling, all of those are built on a this kind of a setup. Next, let's look at how does this work out when there are multiple people in a call or you want to have a group chat kind of a thing. So, for group video calling, we will follow a slightly different and a hybrid approach. First of all, we'll classify groups into two categories. So, all the groups who have less than or equal to five users will be the groups which have small number of users. And all the groups which have more than five users will be called as a group with large number of users. Now, this five number is a bit of a configurable number. We'll come to how do we come to this number later on. Let's take a hypothetical example, when there are these 4 users and they want to do a group video call amongst them. Now, let's say, if U1 is actually talking about something, U1's data needs to be sent to U2, U3 and U4. Now, let's just imagine if these are connected by a peer to peer model, what exactly would happen is U1 would send a particular piece of information to U2, then to U3, then to U4, all separately. Now, for 3 - 4 users, this this is a fairly fine thing. But, let's imagine this for 100 users. U1 has to send the same piece of information now to 100 users, if this group is of 100 users. That's a problem. Mathematically, if we look at it, let's say, if there are N number of users in a group, each user's bandwidth utilization is increased by (N-1) number of times. Why? Because each user has to send data to all the users and has to receive data from all the users. And this is a bit of a problem. Not a bit. It's actually too much of a problem if it's a large number of users in that group. So, basis that, we'll say that if these are small number of users, this is probably okay. But if there are larger number of users, this wouldn't work and we'll follow the approach via the Call Server. So, all the users.. let's again take an example of U1 sending a piece of information, U1 will just send this piece of information to Call Server.
Call Server would then send it to all the three users. Now, what happens.. each user is just sending once to Call Server and receiving from Call Server. And this takes care of aggregating all the data, sending to whoever is supposed to get and all of that. Now, this Call Server gets a lot of load in this case, but at least the users bandwidth utilizations are still in control. And this is a much better option because we can scale up this. We can add more hardware. We can increase the bandwidth that this Call Server has because this is something which is in our control. But the user's Internet connectivity is not in our control. So, this is a much better option to route all the calls through Call Server in case the group has large number of users. Now, coming to how did I come to the number five? So that was a random number. Ideally, you need to talk to your interviewer about what that number should be. But it will not be a static number. It would be a dynamic number. Dynamic in the sense that it would be decided when the call is being created based on the number of participants that are there and the kind of network that the participants come from. So, taking a hypothetical example - if let's say, all these users are from the same private network. Let's say these users work in the same office and they are sitting at their desks and trying to connect onto a call. Now, if everybody is in the same private network, they'll have a very minimal latency. Then we can possibly support even 20 users connected on the same call. But let's say, if these users are connected from different countries, different geographies, then possibly even for 3 - 4 users, doing this would be a big problem and we would want to have this conversation routed through the Call Server. So, that would depend not only on the geography but on the Internet connectivity that each user has and a lot of other attributes. So, you can talk to your interviewer about how do you want to drive that thing. There is one more reason why we would want to route all the calls through Call Server. So remember, we had a functional requirement that we might want to record the call. Now, if you want to do a recording and if you go via the peer to peer model, then there is no way we can record the entire conversation. Either we do a client side recording and then do an asynchronous push, but that's not too good a solution. So, if a call has to be recorded, then anyway the call has to be routed through the Call Server. If it is a call that need not be recorded, then based on some conditions you can do a peer to peer conversation or through Call Server. Now, normally when you think of a peer to peer communication, it sounds that it might be insecure. But it is not an insecure channel. If let's say, U1 and U2 are communicating with each other, hypothetically, let's say it's a one to one conversation. Even then.. you remember, there was a handshake that was happening through the Signalling Server and all of those. Now, ideally, when the handshake happens, they would also exchange a set of cryptographic keys through which the whole conversation would be encrypted. So, U1 would encrypt the piece of payload that it sends out to U2 and U2, when it receives the payload, it can decrypt the payload and then play the video. So, anybody listening to that conversation in between would have no clue about what is happening. So, this is a fairly secure channel. Now, again, this can be extrapolated to a group conversation also. And even the group conversations can be encrypted in the same way. Now, let's look at the overall architecture of the whole system. Now, if you look at any videoconferencing platform, they always have a chat system along with that. Whether it be more of professional products like Zoom and Webex and all of those or it be more informal products like WhatsApp video calling or Facebook video call, all of them do have a chat functionality along with them. So, the architecture diagram that we'll see now is basically an extension of the architecture diagram that we looked at in the WhatsApp System Design. I have just included the components that are in addition to that, which would help us to support the video calling feature. But all the chat related products or systems would anyway be there in the overall architecture. With that, let's get started. A bit of convention to start with - Everything in green is a user interface. Most likely these will be mobile applications. Things in black are the load balancers + reverse proxy + authentication authorization layer. Things in blue are the web services or the UDP services that we have developed. And things in red would be the databases, data stores or some kind of clusters that we will use. So, the flow begins at a point when a particular user, let's say U1, wants to initiate a call with a user U2. Now, all the users who are live in the system are connected to one of the backend components  called as a WebSocket Handler, very similar to WhatsApp chat implementation. This WebSocket Handler keeps live connections with all the users who are active in the system. And there is something called as a WebSocket Manager, which keeps track of which machine of WebSocket Handler is talking to which user. So remember, there were not one or two of such machines. There were hundreds or maybe thousands of such machines. So, that's the reason we need something called as a WebSocket Manager who orchestrates which machine is talking to which user. So, in case there is a communication that needs to be established between two users, WebSocket Handler can talk to the WebSocket Manager asking for which is the other WebSocket Handler machine that is talking to user U2, something of that sort. Now, this WebSocket Handler is built on top of..  it basically uses Redis as a data store. It would not keep it just in memory. It would also persist in the disk to make it a bit more fault tolerant. Now, let's say, user U1 wants to initiate a call with user U2. It makes a call to WebSocket Handler, which basically calls something called as a Signalling Service. Now, Signalling Service is the one that initiates the conversation between two parties. It will also have some policies, which will check for certain conditions. So, let's say, if you have something like a Facebook and you want to put a restriction saying, if you are not friends, then you cannot make a video call between two parties or to a user, then all of those things would sit within Signalling Service. It would also use a component called User Service, which is basically a repository of all the users in the system to power such functionalities. Now, if there's something like Zoom, such a thing would not exist because there is a concept of guest user in Zoom. So, all of those things, you can talk to your interviewer about and you can figure out those nitty-gritties. But that's a very small piece so, it should not be a big trouble. Now, Signalling Service will basically talk to U2 and basically tell the WebSocket Handler of U2 to ask U2, if U2 wants to accept the call or not. If U2 rejects the call or if U2 is offline, then it can be handled in certain ways. But if let's say U2 accepts the call, then Signalling Server basically informs U1 that U2 has accepted your call. Now we can initiate the conversation. Then comes something called as a Connector. So, all of the users will talk to all of these components. I have not drawn the arrows because that will clutter the diagram. But now at this point, what happens is - both U1 and U2 talk to this Connector component. Remember the connector component in the previous segment, which was also called as the STUN Server in the WebRTC world. So, this component is responsible for telling each of the parties about their publicly accessible IP addresses. Now, through Connector, they'll get to know their public IP address. And again, through this similar WebSocket Handler via Signalling Server, they would communicate these two things to each other, saying my IP address is this, my IP address is that. Now both of them know each other's IP addresses. Then, they will also do another handshake which talks about what kind of a bitrate they can support, what kind of codec they can support, what kind of bandwidth they have available. So, all of those information would also be shared, again via WebSocket Handler. Once that thing is established between both the parties, then they can start with the communication. Basically then a regular peer to peer connection is established between U1 and U2 and they can start sending packets to each other and continue with the video call. Now, the way video call would actually work is those videos would not be bigger chunks like five - five seconds each. So, I have also made another video on a video streaming platform, something like Netflix. There we were using slightly larger chunks. But in this scenario, we'll use much smaller chunks, which is of a few milliseconds kind of a thing, or maybe one-fourth of a second or one-fifth of a second, something of that sort and those big chunks would be sent across to each other so that the experience is nearly seamless. And it looks more of a real time thing. Now, let's just say, it is not able to establish a peer to peer connection for whatever reason maybe public IP address is not there, maybe that's a symmetric NAT, whatever happens, if that is not something that can be done, then comes something called as a Call Server, which in the WebRTC world is called as a TURN system. Now, each of them communicate to each other through this TURN Server. U1 sends a message to TURN Server and this server sends it to U2. Similarly, U2 sends a message to this server and this server sends it to U1. So, this basically becomes a point which is orchestrating communication between both the parties. This is how your regular one-on-one connection or a regular one-on-one video call would work out. Now, you remember, in the beginning of the call, there was a handshake which talked about what kind of bandwidth requirements we have. Now, bandwidth is something that is not very constant. While a call is happening, there could be a network that gets choked in between and.. let's say, U2's network got choked and U2 now wants to support a lower definition video instead of a high definition video then, in the middle of the call also, it should be able to talk to U1, again via the WebSocket Handler saying now I don't have enough bandwidth. Maybe earlier it was supporting a high definition video, but now it wants to support a low definition video. Those things could be changed in the middle of the call as well, again via the same route of WebSocket Handler and Signalling Service. Now, each time there is such a change happening in the video call, that does impact the experience, a little bit at least. As a person who's made the system, you definitely want to be aware of all such changes. So, whenever such a thing happens, Signalling Service would basically put out an event into Kafka. So, once Signalling Service puts that event into Kafka saying,  bandwidth was changed, it can be further used for some kind of processing to figure out how stable the networks are, in which geographies and based on that, we can make some business decisions. That is something that we need to capture. Along with that, these devices could send some analytics information along with everything else like maybe how frequently the Wi-Fi is changing, what kind of a battery usage is there while being on a video call, how much data is being consumed while on the video call. All of those details, each of the devices would send to WebSocket Handler and WebSocket Handler would send to Analytics Service, which is basically, purely a system that is taking inputs for analytics, Analytics Service then puts the events into Kafka, which we'll look at later on how can we process. Now, remember, we had a functional requirement saying, if we have a system like Zoom, we might want to support a recording feature wherein  somebody can also look at the recording of the conversation that happened between two people or any number of people, for that matter. So, then comes something called as a Logger Service. In case... it is a recording based system... a peer to peer communication would not happen, all the communication would happen through this Call Server. Now, when U1 sends a message to Call Server to send to U2, Call Server not only sends it to U2 but it also sends to something called as a Logger Service. Similarly, when U2 is sending a message to U1 via Call Server, it will not just send it to U1, but will also send to this Logger Service. The Logger Service then basically aggregates all of those small - small chunks of data and keeps storing that into a distributed file system. You can use anything over here. You can use a network file system, or you could use a system like S3 or you can just dump it into Hadoop. You can use anything over here. But the idea is - this Logger Service would be storing all of those small chunks in a permanent data store that is fault tolerant. Now, it would be here just for a short period of time, till the time the call is active. Once the call gets disconnected between U1 and U2, it, via WebSocket Handler, Signalling Service would get to know that the call has been finished. Signalling Service would then put an event into Kafka saying the call has been finished, if somebody needs to do something, go do that. Then comes something called as a File Creator. Again, for a lack of better word, I have called it File Creator. The idea of this is - whenever a call is terminated, this File Creator would listen to that event.. each call would have a meeting id kind of a thing.. and File Creator would get to know that this meeting id has terminated. Similarly, all the file chunks that were stored in the distributed file system, would also be stored against that meeting id. So, this File Creator would basically read all of that data, which is basically all the chunks of that whole conversation, process them, make a video out of it and store it in another location. I would want to use an Amazon S3 over here because now we need a fairly distributed store because you don't know how many number of times that video would be seen. So, we can use this over here. Similarly, you can use any other standard store as well. Now, once it has created a file, it can send a notification to the users who are involved in the conversation, saying your meeting has been recorded, here is the file, here is the link, go access it. So, that's how this flow would end. Now, let's look at how does a group conversation happen. So remember, group conversations, we were building them in two modes. If there are small number of people like three or four people, we could possibly build a peer to peer communication between all of them. But now, each packet of information would be sent to all the users. That is one way. The other way is through Call Server in case we have more number of users, let's say hundreds of users, then, each device talking to hundreds of others, would be too much of a trouble to manage. So then, Call Server comes in. Now, one to one communication is slightly different because you just have two parties. You just need to relay the information sent from one party to the other party. But a group conversation is slightly tricky. Why?
Because there you need to do something called as Transcoding. If you have not looked at the video that I have made on Netflix, I would suggest to watch that because that talks in much detail about what this transcoding means. But the main idea of transcoding is - if let's say, there is a source video and there are multiple users who are trying to access it. Each user might be coming from a different kind of a bandwidth availability, different kind of a codec that it can support, different kind of a file format that it can support. So the idea of transcoding is to convert an original video into multiple such format in which you can support all the devices, having a wide variety of bandwidth ranges, wide variety of bitrates and all of that. Now, what happens in a group video call - let's say there is a user U3 also over here. Now, this user U3, is having a very, very bad internet connection, and user U1 and U2 want to have a high definition call. And let's say there are hundreds of users let's say, but three for our example.
Basic idea is I want to do the conversation through Call Server. Now, U1 and U2 want to have a high definition call. U3 wants to have a low definition call. Now, how do you do it? So, what happens is - on the packets.. let's just say U1 is talking about something and that needs to be sent to U2 and U3. So, the message would come back to this Call Server from U1. Call Server knows that U2 is having a high definition ability. So, it would send the same package that it got from U1, which was in high definition, directly to U2. It also knows that U3 needs to have a low definition video. So then, it will call something called as a transcoding service. Now, this Transcoding Service could physically, from a hardware standpoint, be running on the same machine to minimize the latency. But logically, it's a different component. So then Call Server talks to Transcoding Service which transcodes the high definition video into a low definition format and sends that to U3. On the other side, when U3 is talking about something, U3 anyway would talk in a low definition, right? So transcoding can happen just one way. You can convert a high definition video into a low definition video, but you cannot convert a low definition video into a high definition video. So the video parts that U3 is sending to the Call Server, it knows that it's a low definition video, I can anyway not convert it into high definition. It would send that as it is to U1 and U2. So all that intelligence is built within this Call Server about each user and what kind of bandwidths and bitrates and all of those things they support. And it would use a cache based on Redis to keep all of that information. Now, again, when you have a group called, each of them could be having a wide variety of network connectivity. And each of their bandwidth requirement might change during the call. So, let's say, U3 started off with a high definition requirement, but in between it wanted to have a low definition requirement. Something of that sort could also happen. So, again, that communication would happen via Signalling Service and Call Server would get to know that now U3 has moved to a low definition mode. So, now I need to start using the Transcoding Service. Maybe earlier it did not have the requirement to do this transcoding. So all of those things would be handled by Call Server at runtime. Now, let's look at the last component, which is basically Analytics. So, there's something called as this Analytics Engine which will power all the analytics. In the previous sections, we had put in a bunch of events into Kafka. This analytics engine, would basically read all of those events and publish some kind of reports. Now, if you want to do a very simple analytics, like just figuring out how many number of calls happened in a day or something very trivial like, how many times people generally get dropped off in a call. So, if it's a basic set of analytics, then you can basically put all of that information in a time series database and plot some graph on top of it. And you should be good. But if you want to do some fancy analytics and some really smart things built on top of it, then you can use a Hadoop cluster to put all of that data and you can run some Spark jobs to basically do a lot of data crunching and publishing out some smarter reports. So all of that could be done. You can have a conversation with your interviewer on what kind of analytics needs to be done. But since we did not cover it as part of functional requirements, I'll keep it here. You can look at any other video which I have made which talks about how to do analytics at much larger scales. Probably a Google map video would be a good example of that. Now, let's look at some intelligence that exists within the client. So, let's take an example of U1 doing a video conversation with U2. So, clients as we know are intelligent enough to identify what all bandwidths they can support, what all bitrates they want to support, what all codecs that they can support and communicate that to the other party. They are also intelligent enough to come up with a consensus on what configuration of the communication they would want to support. Now, let's say U1 and U2 are talking in a peer to peer fashion. Now, let's just say due to some reason, there is an issue in the network and the call is getting dropped off. Or let's say the public IP address of one of the users is changing. In that scenario, the clients would automatically be able to figure out that this is happening and they would be intelligent enough to mutually decide that we would now move the call from a peer-to-peer fashion to something via this Call Server. And this would happen dynamically without users doing something about it. So, that level of intelligence also exists within the client. Now, how would that work? So, let's say that these two communicate via this WebSocket Handler and this Signalling Service and we need to now move the connection to the Call Server. And it need not happen exactly at the same time. Both of the clients can move the communication at their own pace to the Call Server. So, let's say, U1 first gets to know that we have decided that we'll move the communication to Call Server. So, U1 will send all the data to Call Server and Call Server will take care of sending that data to U2. But U2 could still be sending the data to U1 directly. And when U2 decides or gets to know that the communication needs to be moved to via this Call Server, then U2 could basically follow this new route. So, all of that can happen independently and each of the clients can do that at their own pace. Now, the same thing could happen in a group conversation also. So group conversation, if it is happening in a peer-to-peer fashion, the clients or the devices could then decide to move it to a Call Server, at runtime, if they are having any issues. Next, let's look at how do we use this system to support a live broadcast of some massive event. Now, let's just say that there is a big sporting event happening somewhere. Let's just say, for example, a India v/s Pakistan cricket World Cup final.
Possibly millions of people would want to watch it. So, let's see how can we scale this system to work at that scale where millions of users are trying to watch a livestream. So, everything on this side of this red line is outside the scope of the system. But this is because it's an input into our system.
So that's why, I have put it. So, in any kind of an event, whether it be a political event, a sporting event, whatever, there would be multiple cameras and multiple audio devices that would be taking inputs. So, there could be a bunch of cameras, there could also be a bunch of audio devices. I'm assuming there is something called as an Input Manager. It could be hardware. It could be software which basically aggregates all of that and decides that which camera out of those three or five I want to stream right now,
which audio device out of those many, I want to stream right now. It then basically send me an audio plus video combination into the system that needs to be streamed. We'll try to follow a very similar model that we had for a group conversation, using a Call Server. Now, this Input Manager basically sends the request to a Call Server saying this is the stream, now, send it across to whoever wants to watch it. Now, the thing with these kind of massive scale live streams is, there are a lot of users on a wide variety of devices. So in our example, let's say there are some.. or a lot of users on mobile devices. There are a lot of users on TVs. There are another lots of users on TVs for example, and there are a lot of other users on laptops. So these are the devices that we want to support. Coming back to this Call Server which got our input stream. What this Call Server will do is - it will basically forward the request to multiple transcoders. Now, the thing with transcoders is - if it's a good enough hardware and we have one input stream and we want to convert that into another output stream of a different format, it can do that in real time. While the stream is coming in, it can transcode it and send it out. All we need is - multiple transcoders, which is a function of how many output formats do we want. Let's say, if in this example we have three kinds of users, we'll possibly have three kind of output formats and therefore three sets of transcoders. So it will send that to all those transcoders, which will then send the transcoded output to a set of Call Servers. Now, what this Call Server gets is essentially the file format that would be sent out to one type of users. So in this case, there are three file formats. So there'll be three such Call Servers and three such transcoders.
I have made just two for representation purposes. Now, let's say, this Call Server gets all the data that is to be sent to mobile devices. It would then send to multiple Call Servers. Now, this Call Server is not sending directly to users. Why? Because remember, any sporting event would probably be seen by a lot of people in a lot of geographies. So, we need a CDN kind of a thing with which we can first distribute in a lot of geographies and then from those geographies, we can distribute out to multiple users. Kind of taking an inspiration from something that Netflix has done wherein they put a hardware at a ISP's end and just send that request to the ISP first. And then from ISP, it is sent out to users. So, a very similar approach I'm trying to follow here. So, this Call Server would send to multiple such Call Servers and all these servers would be geographically distributed across the globe. And then individual Call Sever will talk to one type of user. So, each Call Server.. so, if one Call Server is dedicated for mobile users, then it'll talk to thousands of users, but only mobile users so that it can just to work on one stream of data. If there are multiple streams, then we'll have to have a lot of logic about which stream to send out to which user, which will complicate the process. So, this Server gets all the data, for example, for laptop users so it will send out to all those. This Call Server, for example, gets the input stream for TV users. It will stream out to all of those users. Similarly, as many number of Call servers as we need, they would send out the payload to the users that they work for. Now, this management, that needs to be a system that kind of records that which Call Server is talking to which user, in case there is a downtime on this Call Server, we can bring up another Call Server that can fulfill those particular users. So, we can use something like a WebSocket Manager that we have used earlier, to orchestrate the communication between these Call Servers. But, that's a very minute detail. So, I am skipping over that. Now, the idea is - we want to keep these Call Servers as close to the users as possible because otherwise if there are a lot of routers in between, all those routers will have to carry the same set of information multiple times. So, if this Call Server is close to the users, that latency would be minimized because this is just a couple of hops in between the Call Servers. But from Call Sever to users, there could be a lot of hops. So, we want to minimize the number of hops over here because this is where the data is getting replicated multiple times. If there are more number of hops on this side, data is being sent only once. So, that is still okay, if you have a larger path over here. So, we'll try to push these servers as close to the users as possible. So, yeah! I think this should be it for a video conferencing system. Thanks for watching.

---

## 7. WhatsApp System Design | FB Messenger System Design | System Design Interview Question
**Channel:** CodeKarle | **Views:** 166K | **Date:** 5 years ago | **Duration:** 27:51 | **ID:** RjQjbJ2UJDg
**Link:** https://youtube.com/watch?v=RjQjbJ2UJDg

### Transcript:
Hello everyone. This is another video in the design interview preparation series from code. So in this video let's talk about how do we design a chat application something like a WhatsApp or a Facebook messenger or any other messenger of that sort. Now let's look at some functional and non-functional requirement that this platform needs to support. Okay. So we will support a onetoone chat wherein a person can send a message to another person or a user. uh there would be something called a group chat where there could somebody could make a group of people and whenever anybody in the group sends a message to the group that message is received by everybody in the group. Okay. Then the messages could contain text it could contain images. It could contain videos and then it could extend to other kind of documents as well. There is something called read received which is basically the single tick when you when the message is sent, double tick when the message is delivered to the user and a blue tick when the person sees the message. Okay. And then we'll also show last scene time of a particular user. Coming to the non-functional requirements, this platform needs to have a very very low latency because for a chat application, it needs to look very realtime. So while you are sending a message the other person should immediately be able to see that message and obviously it should have a very high availability. This system should not go down no matter what happens. Also there should not be uh any lag. So in other videos that we have talked about in the past we were able to live with a lot of lag as well. But in this video we cannot have a lag because again it needs to be a very realtime system wherein I'm typing something to you and you can see it then and there and then respond to it. Right. Coming to some scale numbers, these are approximate numbers of WhatsApp. Again, I do not know if these are actually correct or not, but I just read it somewhere. So, WhatsApp has roughly 2 billion users out of which 1.6 billion users access it on a monthly basis. These are unique users. Each day, WhatsApp has somewhere close to 65 billion messages being sent across all the users. And that's a very big number. So we'll try to look at how can we design a system that can deliver all of these functional requirements with a very low latency and can live with these kind of numbers. Now numbers for Facebook Messenger are approximately similar and other chat application could also be running at a very same scale. Let's look at the overall architecture of the whole system. We'll first start with the chatting solution and then we'll look at other small pieces that surround it. Okay. Now let's start with the user flow. All of these things that you see here are basically user devices. Could be mobile phones, could be web browsers, could be variable devices like smartwatch and all of that. And let's say user one wants to send a message to user two. Okay. So the flow goes like this. User one wants to send a message to user two with a message ID M1. Okay. Now what happens is user one is talking to something called a websocket handler one. Uh now there'll be a lot of these websocket handlers. What this is is basically a websocket handler is a server on our back end which is keeping open connections with all the active users. Right now these are the live users who are having a active internet connection kind of a thing. Okay. Now all of these user are connected to some of the machines then there be a lot of these machines and all of these would be distributed across the globe so that people in certain geography talk to the server which are nearer to them so as to have a lesser latency. Now let's just say user one is connecting connected to this websocket handler one and it sends this message to websocket handler one saying send this message M1 to user U2. Okay. Now this web soocket handler does two three things when this happens. it talks to something called uh websocket manager. Okay, websocket manager is a repository of uh the fact that which device is connected to what all users. Now because these are probably thousands of devices, we need to give that information at some central place which is this websocket manager service. It sits on top of a radisk which stores two information mainly. First of all, it s shows that user one is connected to websocket handler one and websocket handler one is connected to user one, user 10, user 20 something of that sort. So a list of user ID that a particular machine is connected to that information gets stored in that disk. Now let's say a connection break between a user and a machine and now the user is connected to a different machine. So that information is updated into this uh websocket manager through this websocket manager into this. Now the second thing that websocket handler one does is talk to something called message service. Now message service is basically the repository of all the messages in the system. It will have API to get a message by message ID, get the message by user ids and various filters. So if you want to fetch all the unread messages by a particular user and all of that that would be powered by this message service and it sits on top of a Cassandra database. Okay. Why Cassandra? Because again we have these billions of users who will send many many billions of messages. So Cassandra is a fairly good data store to store that kind of a volume. Plus the query pattern that we have fairly aligns with the query pattern that Cassandra is good at. So that's the reason we choose a Cassandra here. Now there are two kinds of messages message services that we can build. Basically there are two kind of messaging platforms that we have. One is something like a Facebook which stores all of your messages. So in that case everything would be stored in a katanda permanently and then there's something like a WhatsApp which stores the messages only till the time it is not delivered to the users and once it gets a delivery acknowledgement then it deletes the message. So if we want to build a WhatsApp kind of a system we could delete the message from here also. Now deletes are a bit inefficient in Cassandra. So if you were to build a build that kind of a system we might choose some other data store as well but for now Cassandra would work very fine. Okay. So coming back to we were at websocket handler one which got this message saying U1 wants to send to U2 a message M1. It talked to both of these services and it can it would happen parallelly. So it can happen in any order. Okay. So message service would save the message into Cassandra and give the message ID. Okay. And uh let's say message ID is M1. And web soocket manager will now tell websocket handler one saying user U2 is connected to this websocket handler 2. Okay. Now do whatever you want to do. Now this guy websocket handler one will talk to websocket handler 2 saying that I've got a message for you too. I believe that guy is connected to you. Go send him that message. Okay. Uh now there are two three possibilities. Websocket handler 2 could actually be connected to that user still and he will send the message right or it could not be connected. It will say that I'm not connected to the user. The person has probably gone offline. So he'll not do anything and the flow ends there. Now let's say the web soocket handler 2 sends this message to YouTube. Now there are two three things that can happen. The user can maybe the user is not using the app actively but the message got delivered. So this device will send a message to websocket handler 2 saying that I've received the message or the second option could be the person actually open on the chat chat of this user U1 and could see the message then and there. Right? So the device would send a message saying I have seen the I have received and seen the message M1. Now this guy websocket handler 2 again query websocket manager saying that this message was now either delivered or read. I need to inform user one. So tell me which machine is talking to user U1. It'll get this particular machine's IP saying this guy is now handling user U1. And it'll send this message to websocket handler one saying this particular message ID M1 has now been read or received whatever and go inform the user and this will be informed to the user. Now how are these connections happening? So these are websocket connections which is basically a birectional connection. So there's no client and server heads any party can send a message. So that's how even server is able to send a message to the client. Okay. And these are built on top of TCP. Now in this whole process we queried websocket manager a lot of times right? User one calling for U2 U2 calling for U1 and all of that. Now at the same time if the user sends multiple messages again we'll try to do that right. So let's try to cache this information somewhere. So each machine will cache two kinds of things. One it will cach is the list of users that are connected to itself. So if user U2 was also connected to the same machine, it would have the data in memory. it would never have to call this manager. Okay. The other thing is uh it would temporarily for a very short duration of a time maybe 10 20 30 seconds cache the information about conversations that it has had recently. So if user U2 was connected to this handler H2 this guy will keep it in cache saying user U2 is on this particular machine because if one sends another message to this U2 it now need not call this web soocket manager. But keep in mind this second cache needs to be stored with a very low time to live and it should expire every 30 odd seconds because remember these are global users. So let's say if somebody is connecting from Sri Lanka, you would probably get connected to a server in India. Right now that's a fairly large amount of distance and that comm and that communication might break in between and the person might get connected to a different machine the next time. So to kind of handle those things easily, we keep this cache at a very low TPL. Okay. Now there are another set of things it now the receipts that we have sent to user U1 and user U2 all those receipts we need to decide whether we want to store them or not all right so if let's say we want to store the read receipts also we can store that as a probably status in Cassandra in the same table saying this particular message has a to start with status as sent then it'll move to received then it'll move to red right now we can decide you can decide that based on your on your conversation with the interviewer whether you want to store this information or even whether you want to store the messages in the first place or not. So all of those things are a conversation that you need to have with your interviewer but you still need to store it for at least some time. So let's just say that user one sent a message to user U2 and then went offline. Now the received wouldn't go back right. So at least for a short duration of time those read receives need to be stored in the database and whenever user one comes online then you'll get that. Right? Now let's just say user one wanted to send a message to user three. Right? So uh second message user one is sending a message to user C which is some message M2 with some text. Right? Now what will happen is uh again it'll store in through message service. It will call websocket manager to get who is the machine which is handling user U3. Now user U3 is offline. Okay. There is no machine that is talking to user U3. So now websocket manager will return a response saying I don't have a machine. Right now the flow ends there. User this websocket handler one does not inform anybody because there is no machine talking to user U3. So the flow breaks there. Now when user U3 comes online. Now let's just say that user U3 gets connected to this websocket handler 3. What this webocket handler do in the very first place is to query message service and ask for are there any messages for user U3 that are not in received or read status. Okay. This message service will respond back and user UC will see all those messages. Right? Then when as those messages are being received and read those communications will flow back through the same flow like we discussed earlier. So then these machines will start talking to each other for user UC as well and those receipts will go on to other users as well. Good. Now there is a potential race condition here. when user one was sending a message for user U3. Assume at the exact same time user 3 came online. Okay. Now we said these are parallel calls wherein a person is figuring out the machine who is being used for U3 and storing the message. Now let's just say that it the very first thing that happened was webocket manager returned that there is no machine that is talking to user U3. The next thing that happens was user U3 comes online and queries message service saying that get me all the messages. The third thing that happens is it stores into websocket manager that this machine 3 is handling user U3. Right? And the fourth thing that happens is this message gets stored into this message service. Now websocket handler 3 thinks that it has fetched all the messages for user U3 and displayed it on the device. This websocket handler one thinks that user 3 is offline and I have stored the message and done my work but fundamentally whatever this message M2 was that has not received this guy right because before that message was was stored this webocket handler three retrieved all the messages right so these kind of race conditions could happen when you are doing parallel pulse but there are multiple ways to handle it you can either do it uh sequentially but that will increase the latency so I not recommend that what another solution you could possibly we do is this websocket handler keeps pulling the server once in a while saying are there any messages that I still missed right so for so all of those messages could be pulled but that would happen at a fairly low frequency and that those could be bulk calls something like are there any messages for user U1 U2 U3 to U which are in sent status right for all the active users that this machine is connected to and if it finds any messages it will send all of those messages as Now there are certain things that happen on the device itself. So let's say user one was offline and you can still send message onto some user chat right while you are offline. So let's say you want send another message to somebody while it was offline. So what would happen is so it will try to connect because internet is not there. It will not be able to connect to any server in that scenario. What will happen even in all other scenarios also all the messages would be stored in a local database which is persisted onto the device disk like let's say it's a Android application it could use a any kind of a Android database like SQLite or anything and store all those messages on the disk now whenever the device comes gets the internet connection it'll pull those messages from a Q kind of a thing or the database and sends those messages right so this is how it would be able to handle scenarios where the device was offline Okay, cool. Now we have the next thing as group messages. So how does that work? So group messages almost work in a very similar way. So let's say another scenario you wanted to send a message to group G1 a message called M3. Right now what would happen is in case of groups the behavior is slightly different. So this web soocket handler wouldn't take care of panning out to all the groups. This is a very lightweight service. This which just takes a message from a user and sends it to somebody and or gets a message from somebody and sends it to a user. It doesn't have a lot of logic. Okay. For group messages, what it'll do is it'll just send a message to message service saying user U1 wants to send a message MC to group G1. Uh store it and do whatever you need to do. So this message service will insert that into Cassandra saying the message is stored. Along with that, it'll also do for all the group messages. It'll put all of those messages into a Kafka topic saying there's a group message that I've got which is this user U1 sending to group G1 a message M3 go send it out. Okay. From Kafka there will be something called a group message handler. This is basically a Kafka consumer which is listening onto the same topic and it is responsible for sending out all the group messages. Okay. First of all, it does some validations that it needs to assuming that's out of scope for us saying whether a U1 is even in the group to be able to send it to G1. But assuming that's not a part of scope, it basically queries group service to get all the users that are into group G1. Okay, it gets a list of users. Then it'll remove the user U1 from that list and now it has a list of the users that are supposed to get this message. Right? Now it follows the exact same flow that was used for one to one messages but for all of these users. So it basically calls websocket manager saying give me all the machines that these users are connected with. Okay, it'll get a response machine one is connected to user U3, U4, U5, machine 2 is connected to some other set of users and all of that. Then it'll send the messages to individual machines saying to this user send this message to this user send this message. Right? And then the receipts and all will follow the exact same that was handled earlier. Right? Now the next thing what happens when people are uploading assets like images or videos or anything of that sort. So the very first thing that happens when you are trying to upload any any content is that there is some kind of a compression that happens. Now in real WhatsApp there's a encryption also that happens right at device and the encrypted messages are sent out and when the messages are received even the encrypted messages are received and they're decrypted but we'll keep that out of scope we'll just think of some compression there okay so this let's say U3 is sending a image to U2 right so what will happen is U3 is sending to U2 some image right now this is basically two a two-step process. The first step is upload an image to a server and get an image ID and then send that image ID via the regular route to user YouTube and then YouTube can fetch the image. Right? So how the image upload works is again these are lightweight servers. They wouldn't have any logic. Okay. So very first thing is compression on of the image over here or video or anything. Then it'll talk to something called this asset service. Okay. So this U3 is talking to asset service through this load balancer. Okay. Again all the authentication authorization will happen at this layer and asset service now gets the whole image or video or whatever. Right? Asset service will use S3 as a data store and it'll store all the images there. Right now based on which image is getting what kind of hits on S3, it might decide to move some of the images on CDN and it could also decide to move replicate into multiple CDNs or some CDNs from where it is getting traffic. Okay. But assuming it has uploaded the image on S3 and it sends a response saying now let's say it is a image I1 right now it will come as a regular message to YouTube through this websocket handler and webock these two websocket handlers saying now send this message and the receipts will happen in the same way that we talked about earlier. Now there could be one optimization that happens. Let's say there's a political event or a sports event and a lot of people are sharing the same image for some reason, right? Do we need to upload the same image multiple times if five people are uploading the same image? Probably not. So before it even uploads to asset service, the first thing that the device will do is take a hash of those images and send the hash content to asset service. Right? Basically, it'll it's a way of asking do you have this image already or not? If you have it then just send it to user YouTube. If you don't have it then ask me and I'll upload it something of that sort. And of course when it's about hashing there would be various problems like duplicate hash outputs and collisions and all of that. So instead of taking one hash we could probably take five different hash algorithms and use all of them to get five different hashes. And if all the five hashes are matching against an image then we'll say that an image is already there. If it's not matching then we'll say that the image needs to be uploaded and it'll follow the regular route that we talked about and if it is already there then anyway it's there it just sends a message. Now let's look at remaining few components and and how they help in the whole system. So this is the user app which talk to all of these components. It could be a browser as well. Now the very first thing is something called user service. This is basically a service which owns the user profile information. uh it could be like name, their user ID, their profile picture in case of WhatsApp and some user preferences in case of Facebook it will be a larger set of data but all of that whatever that data is would be residing in a clustered MySQL for which runs the user database okay now all of those information would also be cached in status cluster very similar to the way we have implemented in other uh similar solutions against a key we'll be having the user profile information and a lot of other information as well okay now There's something called a group service which basically maintains all the group information. It basically has information of which group has what all users. Think of it as a many to many table with a user ID and a group ID and a time when user was acted and added into the group and maybe a status saying whether the user is admin or something of that sort. Again this information would be stored in the MySQL cluster uh which would be geographically distributed and it'll have multiple slaves through which the read queries will be run. Now it'll also have a radius sitting on top of it. So all the APIs like let's say get users in a group and something of that sort would be powered by this radius cluster uh and those APIs would be sitting within the group service. Now each time either user service or group service queries radius and it does not find the data is when they actually query one of the slaves of these databases fetch the information put it into radius and respond back to the whoever is calling them. Okay. And then group service was used in the group messaging workflow that we looked at earlier. Now each action that a user is taking on their app gives us a lot of information right. So for example, if a person is visiting some user's profile a lot of times that tells us that the person is interested in this user right it could be used for some kind of analytics or let's say if a particular person is talking a lot about sports that does tell us that the person is a sports enthusiast. Now how could we do that? So all events that are happening either there are events within the app or there are messages or anything of that sort would be sent either to this analytic service and then to Kafka or directly to Kafka in case of messages. Right? Now there could be a spark streaming consumer running on top of this which could do a lot of inferences. Right? First of all, it could do some message classification into some tags like a message is a sports kind of a message or a general message or a politics kind of a message and then try to classify user bases that. So that is one kind of analytics. Another thing could be just simply some information about what are people talking about in general. Now this is not possible if the messages are end to end encrypted. But if that's not the case then we should be easily able to infer all of that. Now there are two parts. One is uh doing some logic based on some streaming content that could be done by a simple spark streaming consumer and that consumer would also put that data into Hadoop right and then you can run a lot of analytics query based on adoop something like which are the people who talks about sports a lot or which are the people who just talk about a particular kind of political party or anything of that sort those kind of analytics could be run out of that Haru cluster. Now these events are also having one more usage. So each time a person does an activity on the app those events are listened by something called last scene service. Okay. Now this last scene service is basically the service used to store the last scene time of a user. Okay. Now the service I have made it to sit on top of a Cassandra database which has a column called user ID and a column called last scene time. This could also alternatively sit on top of a radius if you have finite amount of data. But along with last scene time if you want to store certain other information then reddis might have memory issues. So in that scenario you can use a Cassandra. You might have a doubt that when we use MySQL for a user information why don't we use a MySQL here. The reason is let's say a user is on the app every 5 seconds the app will send a notification that the user is late right. So every 5 seconds for each user this will have a insert into the database. What that means is this is having an extremely high throughput and now MySQL might not be able to support that because these are all the rights which will go into the master node of my SQL. But if it's a Cassandra, it could be spread out easily across a lot of users. Now, Reddis might also have those update problem because for all the users you're doing a lot of inserts. So, Reddius might not be able to scale. But if it's a Cassandra, it should easily be able to scale to any amount of traffic, any amount of users and those pings coming at any frequency. Right? One more thing. So, there are two kinds of events that are spawned. One are the events that are spawned by the app and one are the events that are spawned by the users. So example of events spawned by app could be as soon as you turn the internet on the app would make a websocket connection and pull in some request. Now that is not a user activity. So that would not be captured as a you know activity of a user in the last scene service. But as soon as the person opens the app or closes the app or does anything within the context of an app those are actually the events that last scene service would be looking at. In general, all the services that we looked at, we are looking at here in in the other previous section, all of those are as usual horizontally scalable. So when your number of users or anything increases, you just add more number of nodes and that should be able to handle itself. Other than that, you'll obviously need to do a lot of monitoring alerting basically to ensure that you are able to get to your NFRs of no lag, low latency, and high availability. So some of the important things that you want to kind of keep a track of from a monitoring perspective is the CPU memory utilization of your services, your disk utilization in the databases, um your throughputs and latency onto your web services and the disk utilization in your Kafka and more importantly the lag in Kafka. So let's say if your lag increases you need to add more number of consumers. So all of those metrics you can capture store it into a graphana kind of a store and plot some graphs out of it and also you can build some alerting out of it in case your numbers go beyond a certain threshold you can send out alerts. So those alerts could be used to make some decisions. So for example if your throughput is increasing significantly you could add more machines into a particular service and in fact those things could be automated as well. So you might if you're using a AWS kind of a thing you might write a script which looks at your throughput and in adds more nodes or removes certain nodes. So all of those things are very important when it comes to a chat application because one of your very critical NFR is uh that it needs to be actually real time. If it's not real time then it'll give a very bad experience and then people will kind of drop out of your platform. So yeah that should be it about that application. Thanks for watching this video. If you have any suggestions on what videos we should make next or how we could improve this one, do let us know by commenting here. And don't forget to subscribe to this channel, like the videos, and share the videos with your friends while we keep working to get more such content to you. Happy learning.

---

## 8. System Design and Architecture Interview Preparation Series by FAANG Engineers
**Channel:** CodeKarle | **Views:** 216K | **Date:** 5 years ago | **Duration:** 0:39 | **ID:** 3loACSxowRU
**Link:** https://youtube.com/watch?v=3loACSxowRU

### Transcript:
Hi Everyone,
welcome to the System Design Interview Preparation Series from CodeKarle.
So if you are giving interviews and want to make sure that you
really nail your System Design Interview, then this series is for you.
We'll cover two important things as part of the series:
1) The most common interview questions that most companies are asking
these days 2) We'll look at some important
topics that you need to be well aware of before you go for a Design Interview. So, continue watching and Happy Learning!!

---

## 9. Amazon System Design | Flipkart System Design | System Design Interview Question
**Channel:** CodeKarle | **Views:** 351K | **Date:** 5 years ago | **Duration:** 33:01 | **ID:** EpASu_1dUdE
**Link:** https://youtube.com/watch?v=EpASu_1dUdE

### Transcript:
Hi everyone! Welcome to CodeKarle.
In this video, we'll be looking at another very common System Design Interview problem,
which is to design an ecommerce application, something very similar to
Amazon or Flipkart or anything of that sort. Let's look at some functional and
non-functional requirements(NFRs) that this platform should support. 
So the very first thing is that people should be able to search for whatever product they want to buy and along with searching we should
also be able to tell them whether we can deliver it to them or not. 
So let's just say a particular user is in a very remote location where we cannot deliver
a particular product then we should clearly call it out right on the search page.
Why? -  because let's say a user has seen hundred products and then they go
to checkout flow add it into cart and then if we tell them that we can't deliver
then that's a very bad user experience. So at the page of search itself we
should be able to tell them that we cannot deliver or if you are delivering
then by when should we be able to deliver it to you. The next thing is
there should be a concept of a cart or a wishlist or something of that sort so
that people can basically add a particular item into a cart.
The next thing is people should be able to check out which is basically making a
payment and then completing the order. will not look at the how the payment
exactly works like the integrating with Payment Gateways and all of that but we'll broadly
look at how the flow overall works. The next thing is people should be able to
view all of their past historical orders as well. The ones that have been delivered , the
ones that have not been delivered, everything From the non-functional side
the system should have a very low latency. Why? - because it will be a bad
user experience if it's slow. It should be highly available and it should be
highly consistent. Now high availability, high consistency and low
latency all three together sounds a bit too much so let's break it down.
Not everything needs to have all these three So some of the products which are
mainly dealing with the payment and inventory counting, they need to be
highly consistent at the cost of availability Certain components,
like search and all, they need to be highly available, maybe at the cost of
consistent at times. And overall most of the user facing components
should have a low latency. Now let's start with the overall architecture of
the whole system. We will do it in two parts First, we look at the home screen and the search screen and then we look at the
whole checkout flows. And before we get to the real thing let's look at a bit of
convention to start with. Things in green are basically the user interfaces. It could
be browsers, mobile applications, anything. These two are basically not just load
balancers but also reverse proxies and an authorization and authentication layer
in between that will authenticate all the requests that are coming from outside
world into our system. All the things in blue that you see here are basically the
services that we have built. It could be Kafka consumers, could be Spark jobs
could be anything. And the things in red are basically the databases or any clusters
could be Kafka Cluster/Hadoop cluster or any public facing thing that we've used.
Now let's look at the user interface what all we'll have.
So we mainly have two user interfaces. One is the home screen which would be the first
screen that a user comes to it would by default have some recommendations based
on some past record of that user, or in case of new user some general recommendations.
In case of search page it would just be a text box where in user head put in a
text and will give them the search results. With that let's look at how the data flow begins.
So a company like Amazon would have various suppliers that
they would have integrated with now these suppliers would be managed by
various services on the supplier front okay. I am abstracting out all of them as something called as an Inbound Service.
What that does is basically it talks to various supplier system and get all of the data Now let's say new item has come in.
Or a supplier is basically onboarding a new item. That information comes
through a lot of services and through Inbound Service into a Kafka. That is basically a
supplier word coming into the whole search and user side of things. Now
there are multiple consumers on that Kafka, which will process that
particular piece of information to flow into the user world.
Let's look at what that is. So the very first thing that will happen is
basically something called as an Item Service. So Item Service has a lot of people talking to it and if I start drawing all
the lines, it become too cluttered so I've not on any connection to item
service but item service will be one of the important things that listen to this
kafka topic and what it does is it basically on board a new item. 
Now it also is basically the source of truth for all items in the ecosystem. 
So it will provide various APIs to get an item by item ID, add a new item, remove an
item, update details of a particular item and it
will also have an important API to bulk GET a lot of items. So get a GET API with a
lot of item IDs and it is in response it gives details about all of those items.
Now Item Service sits on top of a MongoDB. Why do we need a Mongo here?
 - So item information is fundamentally very non structured. Different item types
will have different attributes and all of that needs to be stored in a queriable
format. Now if we try to model that in a structured form into MySQL kind of
database that will not be an optimimal choice. So that's why we've used a Mongo.
To take an example, let's say if you look if you look at attributes of some products
like a shirt, it would have a size attribute and it would probably have a
color attribute right. Like a large size t-shirt of red color. If you look at
something like a television, it will have a screen size, saying a 55 inch TV with the led
display kind of a thing. There could be other things like a bread, which could have
a type and weight. Like 400 grams of bread of which is of wheat bread or a
sweet bread or something of that sort. So, it's a fairly non-structured data and
that's the reason I use a Mongo database here. Now, coming to other consumers that will
be sitting on that Kafka. So on this Kafka, there is something
called as a Search Consumer. What this does is basically whenever a new item
comes in, this search consumer is responsible for making sure that item is
now available for the users to query on. So what it does is all the items that
are coming in it basically reads through all of those items. It puts that in a format that the search system understands and
it stores it into its database. Now, search uses a database called Elastic
search, which is again a NoSQL database, which is very efficient at
doing text-based queries. Now this whole search will happen either on the product
name or product description and maybe it will have some filters on the product
attributes. Those kind of things is something that elastic search is very
good at. Plus in some cases you might also want to do a fuzzy search, which is
also supported very well by Elastic Search. Now on top of this Elastic Search,
there is something called as a Search Service. This Search Service is basically
an interface that talks to the front end or any other component that wants to
search anything within the ecosystem. It provides various kinds of APIs to filter
products, to search by a particular string or anything of that sort. And the
contract between Search Service and Search Consumer is fixed so both of them
understand what is the type of data that is stored within Elastic Search. That is
the reason consumer is able to write it and the Search Service is able to search for it.
Now, once .. a user wants to search something, there are two main things around it. 
One is basically trying to figure out the right set of items that
needs to be displayed but there is also an important aspect that we should not
show items that we cannot deliver to the customers. So for example, if a customer
is staying in a very remote location and if we are not able to deliver big
sized items like refrigerator to that pin code, we should not really show that
search result to the user as well because otherwise it's a bad experience
that he will see the result but you will not be able to order it, right. 
So search service talks  to something called as a Serviceability and TAT(Turn Around Time) Service.
This basically does a lot of things first of all it tries to figure out that,
where exactly the product is. In what all warehouses. Now given one of those Warehouse or some of those warehouses, it tries to see - do I have a way to deliver products from 
this warehouse to the customer's pincode? and if I have, then what
kind of products can I carry on that route. Now certain routes can carry
all kinds of products but certain routes might not be able to carry things like big products or other kind of product, right. So all of
those filtering stays within the Serviceability and TAT Service.
Now it also does one more thing that it tells you in how much time I will be able to
deliver, okay. So it would be like in number of hours or days or anything of
that sort it can say that probably I will be able to deliver it in 12 hours,
 or 24 hours or something of that sort. Now if serviceability tells that I cannot deliver, search will simply filter
out those results and ignore that and return the rest of the remaining things.
Now Search might talk to User Service. There's something called as a
User Service here. We'll get into that later but the User Service is basically
a service that is the source of true so for the user data and it(Search) can query that(User 
Service) to fetch some attributes of user probably a default address or something
of that sort, which can be used basically which can be passed as an argument to
Serviceability Service to check whether I can deliver it or not, okay. 
Now Search Service returns the response to the user which can be rendered and the
people can see whatever you know they want to see. Now each time a Search
happens, an event is basically put into Kafka. The reason behind this is whenever
somebody is searching for something they are basically telling you an intent to
buy a kind of product, right? That is a very good source for building a
Recommendation. We'll look at how Recommendation can be build later on, but
this is an input into the recommendation engine and we will be using a Kafka to pass it along. So each search query goes into
Kafka, saying this user ID searched for this particular product. Now from the
Search Screen user could be able to wishlist a particular product or add it
to cart and buy it, right? All of those could be done using the Wishlist
Service and Cart Service. Wishlist Service is the repository of
all the wish lists in the ecosystem and the cart services by repository of all
the carts in the ecosystem. Carts are basically a shopping bag, which when people
put product into it and then checkout.  Now both these services
are built in exactly the same way(almost). They provide APIs to add a product into
user's cart or wishlist. Get a user's Cart or Wishlist.
Or delete a particular item from that. And they would have a very similar
data model and they are both sitting on their own MySQL databases. Now from a
hardware standpoint I'd like to keep these two  as separate Hardwares. Just in case,
for example Wishlist size becomes too big and it needs to scale out so we can
scale this particular cluster accordingly. But otherwise
functionally both of them are totally same. Now each time, a person is
putting a product into Wishlist, they are again giving you signal. Each time they
are adding something into their cart they are again giving a signal,
about their preferences, things that like that they want to buy and all of that, right?
All of those could again be put into Kafka for a very similar kind of analytics. 
Now let's look at what those analytics would be? - So from this Kafka
there would be something like a Spark Streaming Consumer.
One of the very first things that it does is - kind of come up with some kind
of reports on what products people are buying right now. Those would be things
like coming up with the report saying what was the most bought item in the
last 30 minutes, or what was the most Wishlisted listed item in last 30 minutes,
or in Electronics category what which product is the most sought-after product.
So all of those would be inferred by this Spark Streaming. Other than that
it also puts all the data to Hadoop saying this user has liked this product,
this user has searched for this product anything that happens, right. On top of it,
we could run various ML Algorithms. I've talked about those in detail in another
video(Netflix Video), but the idea is - given a user and a certain kinds of products that they like,
we could be able to figure of two kinds of information. One is what other
products this user might like okay and the other thing is how similar is this
user to other users and based on products that other users have already
purchased we would recommend a particular product to the user. So all of
those is calculated by this Spark Cluster on top of which we can run various ML
jobs to come up with this data. Once we calculate those recommendations,  this
Spark Cluster basically talks to something called as a Recommendation Service. Which is basically the repository of all the recommendations, and it has various kinds of recommendations. One is given a user ID,
if you store general recommendations saying what are the most recommended products
for this user. And it will also store the same information for each category.
Saying for electronics for this user these are the recommendations. For the
food kind of a thing, for this user, these are the recommendations. So when a person
is actually on home page they will first see all in just general recommendations
and if they navigate into a particular category they'll see the specific
recommendations we are specific to the category. Now we have skipped a couple of
components. User Service is a very straightforward service which basically
you can look at any other of my videos that have talked about it in detail(Airbnb Video),
but it's a repository of all the users. It provides various API is to Get details
of a user, Update details of user and all of that. It'll sit on top of a MySQL
database and a Redis Cache on top of it. Now let's say Search Service wants to
get details of a user the way it will work is, it will first query Redis
to get the details of the user. If the user is present, it will return from there.
But if the user is not present in Redis it will then query the MySQL
Database (one of the slaves of that MYSQL cluster), get the user information,
store it in Redis, and return it back. So that's how User Services will work.
Now there are some other components that are here. One is Logistic Service and one is Warehouse service. Normally these two components
come in once the order is placed. But in this scenario this Serviceability
Service might query either of these two services not a runtime, but before
catching the information to fetch various attributes. So for example it
might query this Warehouse Service to get a repository of all the items that are in the
warehouse or it might query Logistic Service to get details of all the pin
codes that are existing or maybe details about or the Courier Partners that work
in a particular locality and all of with that all of the information this
Serviceability Service will basically create a graph kind of a thing saying
what is the shortest path to go from point A to point B and in how much time
can I get there. Now we have not covered this service in
detail. I have also made another video on implementation of Google Maps. This is
very similar to that. So if you want to get into details you can look at
that(Google Maps Video) but just to just to call it out this doesn't really do any calculation
at runtime. You store all the information in a cache and whenever
anybody queries, it will query the cache and return the results
from the cache itself, and no runtime calculation because those kind of
calculations are fairly slow. And it will pre-calculate all possible requests that can come to it. Basically if there are N Pincodes and M Warehouses, it will do a M x N and calculate all possible combinations of requests that can come
to the service, and store it in a cache. Now let's look at what happens when a
User tries to place an order. So the user interaction, to place an order is
represented as this User Burchase Flow. This could be access to apps, mobile apps
or web browsers or anything. Now whenever User says that I am ready to place an
order take me to the payment screen which is the last piece in the app flow
then basically the request goes to something called as the Order Taking
Service. Think of Order Taking Service as a part of Order Management System
which takes the order. Now Order Management System sits on top of a MySQL database. Why MYSQL? - because if you look at order and table form for order,
it will have a lot of tables, some with order information, some with customer information, some with item information and there are a lot of
updates that happen on to the Order Database, right, for each order. 
Now we need to make sure that those updates are atomic and they can form a transaction
so as to make sure that there are no partial updates happening. And because MYSQL provides that out of the box we would leverage that here. So that's why MySQL. 
Now whenever this gets called the very first thing that happens is a
record gets created for an order, an order ID gets generated. Now the
next thing that we do is we put an entry into this Redis saying, this order ID was
created at some point in time and this record expires at some point. Why is it
being used, we'll come to. But think of it as an entry that goes in something like -
Order id: "O1", gets placed and 10:00 let's say. it expires at 10:05.
Something of that sort. Now the record that goes into this
MySQL Database has an initial status. Think of it as a Status of: "CREATED".
So basically the record that goes into this table is something like -
order O1, was created at 10:00 with status: "CREATED". You can have different
set of names also that's fine. The third thing that happens is we basically
call Inventory Service. The idea of calling Invented Service is we want to
block the inventory. So let's say if there were five units of a television
that a user wanted to purchase, we will reduce the inventory count at this point
in time, and then send the user to payment. Why do we do that? - Let's just say there
was just one TV and three users want to come in at the same time. Now we want to
make sure only one of them buys the TV and for two of them it should show that it
is out of stock, right? We can easily enforce that, through this Inventory
Service, by having a constraint on to the table which has the 'count' column saying
that 'count' cannot go negative. Now each time you basically want to place that
order for a TV, only one of the.. if the count is one, only one of the users will
be able to do that transaction where the count reduces. For the other two, it'll be a
Constraint Violation Exception because the count cannot be negative. So only one
of them will go through with the inventory, right! Now once the inventory
is updated then the user is taken to something called as a Payment Service.
Think of it as an abstraction over the whole payment flow where in this service
talks to your Payment Gateways and takes care of all of the interaction with the payment.
We will not go into details of how that works, but the interaction
with the Payment Service can lead to two-three outcomes. One of them is that payment
service could come back saying the payment was successful. Or it could say that the
payment failed due to some reason, could be a lot of reasons. Or the person could
just close the browser window after going to the payment gateway and not come back in which case payment service would not
give a response. So these are there are these three possibilities. Now let's see
what can happen, okay. So one of the very first thing that can happen is let's just say at 10:01, we got a confirmation from
Payment saying payment was successful. In that case it'll.. the order would get
confirmed, right. So let's say we call it and that status is now "PLACED", or any
other name for that matter. So now once the payment has been successful, we
update the status of the order over here in the database saying that order is
PLACED. Now the work is done. At that point in time an event would be send in
to Kafka, staying an order has been placed, with so-and-so details, okay!
Another option - it could(Payment Service) could come back saying that.. the payment failed.
Let's say there was no money in the account or whatever happened. 
Now once the payment has failed, we need to do a lot of things. First of all, we need
to cancel the order, because the payment has not happened. So let's say the other
possible scenario is the order could be CANCELLED, right? Now.. if the payment has failed we need to increment the inventory count
again. so we'll basically again call Inventory Service and saying that - you
decremented the quantity for this particular order ID, now let's increment
it back. So that's a rollback transaction kind of a thing, that is happening here, okay.
So that is one more thing we'll do. And also we'll have a Reconciliation
Service that sits on top of this whole system which reconciles basically checks
every once in a while that if there were ten orders overall I do have the correct
inventory count at the end, just to handle cases with due to some reason we missed
update of inventory count or the write fail. So all of those scenarios can be
handled by the Reconciliation flow. Now there is one more scenario that can
happen. Payment Service could not at all come back, right? The user close the
browser window, the flow ends there, payment service doesn't respond back to us.
Now what do we do? We can't keep the inventive blocked. So let's say there was
just one television available this user has gone to the payment screen, closed the
window and gone away. Now we still have that one television physically available
in our warehouse but the database says it's not available.
We need to bring it back, right. So for that the Redis comes in.
So at 10:05 what will happen is Redis this record will get expired, right. 
Redis will have a will have a expiry. We'll have a expiry call back on top of Redis which will
basically be invoked saying that this particular report whatever you insert
inserted, it has got expired. Now do whatever you want. At that point in time
Order Taking Service will catch that event and say that now this particular record has expired, I'll basically follow the same flow that
was followed for payment cancellation basically I'll time out the payment and
mark it CANCELLED, okay. So at that point in time again at 10:05, this order would
be moved to CANCELLED State in the Database and the inventory would get updated back
again, right. So everything is good but there are a couple of scenarios here. 
So there could be potential risk conditions. What happens if your payment success
event and your expiry happens at the same time. What do you do then? So there
are two three scenarios in which it would happen. The first scenario is that
payment success comes first and then expiry happens. So in that... that is a
scenario that will always happen. So whenever a payment is success let's
say at 10:01 payment got success anywhere at 10:05 this expiry would have
happened, right? So this is something that is bound to happen for all the  the orders.
So one optimization we could do here is each time we get a payment
success or payment failure event, we can delete the entry form Redis, so as to
make sure it's expiry event does not come in. The other scenario is that
expiry comes first and then payment success. Now whenever we would have got..
let's say expiry came at 10:05 and payment success happens at 10:07. Now
whenever we get the expiry event we would have canceled the order, we would
have decremented the inventory count. But now the payment has happened,
that we got to know. There we could do 2-3 things. We could either refund the money
back to the customers saying that for whatever reason we are not able to
process, here's your money back. Alternatively, we could also say that now we have anyway got the money from the customer. We know what the person was able to... was trying
to order. Due to a issue one our side possibly the order didn't go through. So we could create a new order mark this payment for
that order, and then put that directly into PLACED status. So that is another
thing that we could do. Assuming for all the orders as soon as
we get a payment success and payment failure, we will delete these entries
from Redis so to make sure there are no.. these conditions do not happen too frequently. That will help us to save the memory footprint as well, because the
lesser amount of data we have in Redis, the lesser RAM it would consume,
and it will be much more efficient okay. Now one thing I want to call out about
this Redis expiry is - this is not very accurate. So let's say if it was the
supposed to expire at 10:05, we might not get the call back exactly a 10:05. We might
get a callback at 10:06, 10:07 or sometime after 10:05 and that is because of the
way it is expiry works. So Redis doesn't expire all the records at that point in
time. It basically it checks all the records every once in a while for expiry
and whenever it finds some of the docs/ some of the keys that are expired
then it expires that. So it might happen that it'll expire after a few minutes. Now in
this scenario it doesn't really matter so I think we should be okay with this
kind of an approach but if you are trying to do something which is much
more mission-critical, then possibly you might have to do a different approach.
But even you should talk about this to your interviewer, and if they say
then you might also change the implementation a bit. You might implement
a queue and keep polling that queue every second or something of that sort.
Okay. Now once the payment has happened or not happened or whatever happened, you
would put all of those events into Kafka anyway. There is one more reason why you
want to put two events. So let's say there was this one item one television
left okay and somebody has purchased that. Now you want to make sure that
nobody else is able to see the television because anyway the count has
become.. inventory count has become zero you cannot take an order, right. So you
need to... basically make sure that it should be removed from search. 
Now remember there was a Search Consumer that we looked at in the previous section.
That Search Consumer would also take care of inventory kind of things.
So as soon as an item goes out of stock it would basically remove that element
from in the listing. Basically it will remove the documents pertaining to that
particular set of items. Now there is one problem in this whole thing that we have
decided/built. This MySQL can very quickly become a bottleneck. Way? -
Because there are a lot of Orders. So for a company like Amazon they will probably
have like millions of Orders in a day a couple of millions at-least. And
that number could bloat up significantly over an year. And normally you would have to
keep Order Data for a couple of years for auditing purposes, right. So this Database is going massively big. we need to do something about it. So remember the
whole use case of having this MySQL is to take care of atomicity, transaction,
basically the acid properties for orders that are being updated. But for the orders that
are not being updated, we don't really need any of these functionalities, right.
So what we can do is once you order reaches a terminal state, let's just
say an order is DELIVERED or CANCELLED, we can basically move it to Cassandra.
So there is something called as Archival Service, which is a cron kind of a thing,
which runs every one day/12 hours at some frequency and it pulls all the
orders which have reached the terminal status from this MYSQL and
puts it into Cassandra. Now how does it do that? - so you can see these two
services. There's the Order Processing Service and there's a Historical Order
Service. These two are again component of the whole larger Order
Management System which are do certain things of their own. So Order Processing
Service is the service which takes care of the whole lifecycle of the order. So once
the order has been placed any changes to that order happen through this. This will
also provide APId to Get the orders if somebody wants to get Order details.
Again, similarly, Historical Order Service will provide all kinds of the APIs to
fetch information about Historical Orders. Now Archival Service will
basically query Order Processing Service to fetch all the orders who have reached
terminal status, get all of those details, call Historical Order
Service to insert all of those entries into its Cassandra, and once it has got a
success saying I've inserted into Cassandra, replicated in all the right
places, then it will basically call Order Processing Service to delete that. Let's
say there is some error, something breaks in between, it will retry the
whole thing and because it is idempotent it doesn't really matter we can replay
it as many number of times as we want. Cool. Now coming to the...once the user has
placed the order all of the things will happen, logistics and all can happen behind
the scenes. Now the user can go and see their past orders, right. That will be
powered by this Orders View. So Orders View will basically...there will be a service
here which kind of is the back end of Orders View, but that'll clutter
the diagram too much. Assume there's a service here which talks to the Order View, and that talks to these two services. So basically what it will do is, it will
basically query Order Processing Service to fetch information about all the live
orders who are in transit it. It'll call Historical Order Service for all the
orders that have been completed. It will merge the data and it will return back
to display on the App or website or wherever, cool. Now why did we use a
Cassandra here? - So Historical Order Service will be used in a very limited set
of query patterns. So some of the queries that will run is: 
1) Get information of a particular order ID 
2) Get all the orders of a particular user ID 3) possibly get all the orders of a particular seller.
But there will be a small number of type of queries that will run
on this Cassandra and Cassandra very good when you have that finite number of
queries(by type) but a large set of data. that's the reason we have used Cassandra.
Now coming to whenever an order is placed we want to notify the
customer that your order has been successfully placed. It will be delivered to
in 3 days or something of that sort. You'll have to possibly notify a seller,
you might have to notify somebody else or when something happens. Let's say
an order is cancelled by the seller you want to notify the customers. So all of
those notifications would be taken care by this Notification Service. Think of it
as an abstraction which can abstract out all various kinds of notification like
SMSs, Emails and all of that. I made another video(on Notification Service Design) 
which talks about in detail of how do you implement Notification Service. 
So you can go have a look at that as well. While ... a user is placing all the
orders, all of those things are happening, all the events are going into this Kafka
on which we are running a Spark Streaming Consumer. It does a lot of things. 
One of the... very first things that it does is it can publish a report
saying in the last one hour what are our items which have been ordered the most.
Or which category has generated the most amount of revenue like electronics or
food or something of that sort, right. So it can publish out some of the reporting
metrics that we want to quickly look at. Other than that,  it will also put the whole of
the data into Hadoop cluster. Now we have real order information of a user which
is a very good thing for recommendations So on top of it, will have some
spark jobs which will run some very standard ALS kind of algorithms, which
would be predicting that this particular user, given that he's ordered certain
things in the past, what are the next set of things that this person might order.
Or because this customer looks like that customer and that customer
ordered so-and-so product, so this customer might also order so-and-so product.
So there could be, a lot of kind of models that you can run to predict what
are the right set of recommendations for this user, which would be then send to this
Recommendation Service which we looked at in the last section, it will store it into its Cassandra and the next time when the user comes in, we'll show them those
kind of recommendations. It would not just have like recommendations based on
your orders but also similarity, so again taking the same example if you have
ordered a white board you will definitely want to order marker. So all
of those things would also be taken care by this.

---

## 10. Uber System Design | Ola System Design | System Design Interview Question - Grab, Lyft
**Channel:** CodeKarle | **Views:** 153K | **Date:** 5 years ago | **Duration:** 30:00 | **ID:** Tp8kpMe-ZKw
**Link:** https://youtube.com/watch?v=Tp8kpMe-ZKw

### Transcript:
Hello, everyone!! Myself Sandeep from codeKarle. And in this video, let's look at how do we design a cab booking system, something like an Uber or OLA or Lyft or something of that sort. Let's start with the functional and non functional requirements that we want this system to support. So, very first thing is - as a customer, when you open your app, you should be able to see what cabs are around you. So, that is the See Cab feature in your vicinity. The next thing is - if you want to book a cab from one place, point A to point B let's say, you need to know how much time it will take to travel from point A to point B. And, you should be able to get an approximate price of how much would it cost you to book a cab via this platform. The next thing is - you should obviously be able to book a cab. We'll not get into the varieties of.. types of cab like go, premium and all of that. We'll just assume that there is one type of cab. You can add more features, simply! That's not a big trouble. The next thing is - there should be a very good location tracking of what driver was at what place at what point in time, for various reasons. From a non-functional standpoint, this platform should be global and it should be accessible to people of all countries. At least, we'll design it in that way. What that means is - you need to have servers in a lot of geographies so as to make sure that people in a certain geography are accessing the servers near to them and thereby reducing the latency. Next obvious thing - it needs to work at a fairly low latency. Though this is not very, very mission critical, but it still needs to be, you know, reasonably fast. Availability should be very high. This system should not go down. It will cause a lot of problems to people who are stuck somewhere, if the system is down. And at the same time, it should have high consistency. High Availability - High Consistency, might seem to you that it is trying to violate the CAP theorem, which basically says that - assuming all the systems in the world are distributed nowadays, so out of availability and consistent, you can just get one. The idea is - certain components of this need to be very highly available and certain other components need to be very highly consistent, not both at the same time. From a scale standpoint, this system should scale to a very good number. If I look at just some of the statistics of Uber, there are roughly 100 million active users that use Uber on a monthly basis. These are unique users.  And Uber, in general, does roughly 14 million rides per day. So with that thought in mind, let's try to look at a system that can scale up to these numbers, with these criterion. Now, the main problem that companies like Uber are trying to solve is - when you have a customer's location, who wants to book a cab, you try to find out some few drivers who are very near to this location and then using some logic, try to come up with the best driver who is suited to do this trip for this customer. So the problem then becomes, how do you find these 2 - 3 closest drivers to this customer? There are multiple ways to do that. We'll go over one of the ways which uses a concept called segment and mapping segments, basically. Now, this is a term that I just made up. It's not an industry standard term. So, just keep that in mind. Now let's just say, you have a city, something like this. The idea is you basically divide it into rectangular segments. So, you kind of divide this city into multiple pieces. And you say that - this is probably your segment id 1. This is your segment id 2, something of that sort. Now, the idea is - you are dividing a city. It'll normally be divided into a lot more segments than what you can see here. Now, the idea is - given certain coordinates of the segment boundary and given certain coordinates of a cab,  you should be able to figure out which segment does a cab belong in. Now, the problem looks trivial, and it is not difficult also. So, think of it like a standard coordinate system. This is point (0,0). This is (0,1). This is (1,0). This is (1,1). Somewhere here. Now, if a point lies somewhere in between here, let's say (0.4, 0.5), you should be able to mathematically say that this point lies within this boundary. A very similar logic we'll try to use when we try to assign a particular segment to a cab. Also, keep in mind that cabs continuously moving and their locations are continuously changing. So, we'll try to make sure that we get continuous pings from all the cabs and then keep a track of which segment do they belong in. A cab could be here right now. Could be in this particular segment. And the cab driver is going via a road, over here. Now, this changes the segment. And this information would be calculated at runtime, as and when we are getting pings from the cab. So, we'll have something called a Maps Service. This Maps Service will do a couple of things. The very first thing is that - it will be responsible for dividing the city into these segments and taking care of the segments. The other thing it will also do is - given a lat long of a cab and given a lat long of a customer, tell which segment do these users belong to at this point in time. This service will also be used to calculate ETA from point A to point B and the route from point A to point B and thus even the distance. But, we'll abstract out. We'll not go into much detail on how that ETA and distance piece is implemented. Think of it for now as if we'll be using a Google Maps Service and we'll go over the details of implementation of that when we do another system design video on implementing Google Maps. With that being said, there is also one more thing that this service does. So let's just say, there is a huge amount of traffic or huge amount of cab drivers in this particular segment. And it is getting unmanageable. So the idea of segment is - it should be a small set of drivers that are in the segment. So this service will take care of dividing this segment into multiple parts. It could do it into 4 parts. It could divide it into 6 parts. That logic resides within Maps Service. Let's just say, there is very less traffic in some other locality. So, it could also decide to merge a couple of segments into one segment and say, this whole thing is now one segment. So all the segment management remains within this service. Now, let's look at the overall architecture and how individual users and drivers get connected to the system. All the users get connected through this User App, which talks to a Load Balancer, which talks to something called as a User Service. This User Service is your repository of all the user information. Plus, it is also a proxy, that will connect to other services to get any information that a user wants. So, for example, if a user wants to see their profile, update their profile, all the APIs to do that are powered by User Service. If somebody wants to fetch user information, any other service for example, then all the APIs for that are powered by this service. Let's say, if a user wants to see their trips, then this User Service will talk to Trip Service, fetch all the trips for that user and send it back to the user. So that's the responsibility of User Service. From a database standpoint, it sits on top of a MySQL cluster, which stores all the user information within that. And it also uses a Redis for caching the same information. So let's say, a GET API to get a user's information is called, it first queries the Redis. If it has information, it returns from there. If it doesn't have information, then it queries a MySQL slave, fetches that information, stores it in Redis and then returns back to whoever was calling. The next flow that the user calls is basically when they try to book a cab. The whole screen that the customer, kind of, goes through when they are trying to book a cab is powered by this Cab Request Service. Essentially what it does is - it basically makes a WebSocket connection with the User's App, which displays them a few cabs onto their UI  which are around them. Also, it places a request with something called a Cab Finder. We'll go over this in the next section. Whenever Cab Finder responds back with a cab, this Cab Request Service talks to the User App, basically sends them a response, through this WebSocket connection, saying that the cab is booked and these are the details and whatever is required. This is approximately the major user flows. Now quickly, let's look at the driver flows. A driver basically talks via the Driver App. Again, there is a very similar Driver Service, exactly similar to the User Service. But for drivers, again, all the APIs for getting, updating all the driver information is powered via this. If a driver wants to see their payment information for example, their payment history, this Driver Service will expose an API which the Driver App will call and Driver Service will internally call a Payment Service to get that information and respond back. It could call Trip Service to get the trips of all the drivers. And, all the UI data gets powered by this service. This service sits on top of another MySQL which has all the driver information. And it uses Redis for caching in exactly the same way the User Service does. This Driver App also talks to something called as a Location Service through a series of servers, again maintaining a WebSocket connection with these servers. And, as and when a driver is moving through the city, every 5 seconds or 10 seconds, their location is being sent out to this Location Service, which then queries the Map Service that we talked about earlier, to find out which segment does the driver belong to. And when the customer places this cab request, customer's segment is calculated, driver segments are calculated and they are mixed and matched by the Cab Finder and a couple of other components to give the best suited driver for a particular trip. Now, let's look at how does a customer and driver come together. All the active drivers in the system, who are online right now, ready for trips and all, are mentioned as D1, D2, D3. There'll be a lot more such drivers. All those drivers.. each of them is connected to one of the servers through a WebSocket connection. And those servers are called out as WebSocket Handler 1, WebSocket Handler 2, WebSocket Handler 3. Now, why do we need WebSocket here? So, we always need a connection between the driver and a service.. for a lot of reasons. One of the very first things is that - a driver continuously sends location pings to the backend, telling about the location. Now, if each time they start creating a new connection, that's a kind of a heavy operation. So, we'll have this connection live. Also, at times, the servers might want to talk to driver. So, let's say, if a trip is assigned to a driver, we need to inform the driver. So, we can reuse the same connection to talk to a driver and tell them that this is the trip information that you have to do right now. For all of that, there are these WebSocket Handler servers. In the real world, there'll be hundreds of such servers, who are interfacing with all the drivers, which are throughout the world, geographically split. Now, let's say, somebody in the system identifies that a trip is being given to a driver and to reach out to the driver, they first need to know that which out of these hundreds of WebSocket Handler servers, do I need to talk to. For that, there is something called as a WebSocket Manager. Now, this WebSocket Manager is another distributed service which manages the fact that which server is connected to what all drivers. So, let's say, D3 is a new driver that has come online right now and through the load balancer, it got connected to WebSocket Handler 3. So, this Handler will inform the Manager, saying I have now got connected to D3 also. So, if there's anything for D3, inform me. And this Manager will store this in it's database. Now, let's say, this connection got broken and D3 is offline right now. Again this Handler will inform the  Manager that D3 is now offline. Do not reach out to me for any communication of D3. This manager sits on top of a Redis cluster. This Redis would not just be storing data in-memory, it will also be storing it in a persistent store on disk. And it will basically store 2 kinds of mapping. One is saying that.. the most frequently used one, is that - which driver is connected to which host.. which is saying something like D1 is connected to H1. Similarly, there'll be an entry for each of the drivers in the system, saying which driver_id is connected to what host_id. It'll also have a reverse mapping, saying which host_id is connected to what all driver_id. So, it could have a mapping saying H1 is connected to D1, D2, D3, so on and so forth. Because that mapping might be used for something. Coming to other things that this WebSocket is used for. So these drivers/ devices send location pings to our backend, let's say, every 5 seconds. So, every 5 seconds, we get a hit about the location information. All the location related information is managed by something called Location Service. It does a lot of things. One of the things that happens here is - it stores the information about the driver's location into it's Cassandra. Why Cassandra? Because, again, there are like thousands probably or maybe even millions of drivers across the globe who are sending their location updates every 5 seconds. So, there are a lot of updates happening. So, a Cassandra should be able to easily scale up to that number. That's the main reason. There are 2 kinds of information that get stored here. One is - the live location of the driver, which is the last known location. The other thing that is stored is - while a driver is doing a trip with a customer, we need to know exactly what was the route followed, for any auditing purpose or billing purpose. Very common use case is - Once we know the points that the driver followed, we would be able to trace that out and then come up with the real distance that the driver actually travelled and then use that to come up with the pricing. So all of those things are basically responsibilities of Location Service. Location Service also talks to Map Service. Remember, Map Service from the previous section. Map Service is a service that maintains the segments that we have created throughout the city and throughout the globe. So, Map Service maintains not just the segments, it also gives us the ETA, which will be the time taken from point A to point B and the distance that will be followed and also the route that should be followed from point A to point B. Think of Map Service as an abstraction that we have. We'll not go into the details of implementation of Map Service right now. I have made another video which is on the design of Google Maps, that goes into details of how Map Service is implemented. But, that being said, Location Service, as soon as it gets a ping from a driver, it basically queries Map Service and tries to figure out that this lat long belongs to which segment. It then stores it into it's Redis, saying, this segment has these drivers. This update happens only when a driver's segment changes. If he's in the same segment, then no change happens. This basically is used for a lot of purposes. So, let's say, we want to find out drivers in a vicinity, we'll query this service saying who all are the drivers that are basically in S1. There is one more thing that Map Service does. It basically keeps a mapping of which all are the segments surrounding a particular segment. Which, we'll come to in a while on how it is being used. There's something called as Trip Service. Trip Service is basically the source of truth for all the trip information. It sits on top of a MySQL database and a Cassandra database. It uses MySQL for all the live information, basically information of all the trips that are either about to happen in some near future or are in progress. Once the trip is completed, then it basically can move to Cassandra. Now, why don't we store all the information in MySQL? Because over time, this will become a very massive volume of data. Plus, if it is just for read queries, Cassandra is also good enough. So, we don't really need to store it in MySQL. The main reason of storing it in MySQL is because trip would have a lot of information. It would have information about the customers, about the divers, about potential start times; end times, about the potential distances, about the real values and maybe some events information that have come in between, maybe some payment information and a lot of other things. Now, if you look at it in tables terms, these will be a lot of tables. And, for each event that comes in against a trip, we might need to update a lot of such tables. And there, it is very good to have transactional properties. So, that's the reason we'll be using a MySQL for all the trips that will be updated. And once the trip is completed, then we can move it to Cassandra. Now, this movement from MySQL to Cassandra is taken up by this Trip Archiver Service, which basically is a cron, which spawns once in every probably 12 hours and pulls the data from MySQL and puts it into Cassandra. Coming back to Trip Service.. Trip Service will expose all the APIs around trips. So, if you want to get a trip by id or if you want to get all the trips of a particular driver or all the trips of a user, all of those APIs would be powered by Trip Service. And let's say, if it's a search by a driver_id, it will query MySQL, it will query Cassandra, it will get the results from both of them, merge them and then return it back to whoever was calling.
So, that's how it's flow would be. Now, let's get to the main flow on what happens when a customer actually requests a cab. The customer flow begins at this point where they basically make a request to Cab Request Service through again an open connection between both the parties, the Customer and this service. And basically, what the customer says is - this is my source lat long. I need to go to a destination which is identified by certain lat long. Get me a cab. I'm assuming there is just one type of cab and no varieties and types of cab. If you want to implement, that is a straightforward thing to implement.  But given this request, Cab Request Service then queries something called as Cab Finder, which is responsible to come up with that one driver who will do the trip. At the end of all of it, Cab Finder will respond back to Cab Request Service saying, this is your trip_id, this is your driver_id, go send it back to the customer.. in a nice form, with all the details about the driver and all of that. And Cab Service would send that. Cab Finder will also put a notification into a Kafka, whether or not it was able to find a driver. Let's say, if it's not able to find a driver, may be because there is a scarcity of drivers, all of that would go into Kafka, which can be used for further Analytics like for example, telling drivers that this is a location where there are more customers and less drivers so why don't you go into that location to get more trips or something of that sort. Coming to what Cab Finder does. The very first thing Cab Finder would do is basically - it has a source lat long, which is basically identifier of a particular location of a customer. It will first of all query Location Service saying, get me the segment in which this customer currently is. Along with that, also give me a list of drivers that are near this customer. What it does is - it first of all queries Map Service with the lat long of the customer, to get the segment which the customer is in. It then queries surrounding segments. So, I'll try to explain why do we need surrounding segments. So, let's say, there is a rectangle like this and customer was sitting here. There were a couple of drivers in various locations in this segment. There could possibly be a driver just here. But, if we query all the drivers within this segment, then we'll get a driver who is far away. But, a driver is just next to customer, maybe in another segment. So, for doing that, we basically.. let's say if it is segment S1, we need to find all the segments that are surrounding S1 and get the closest 10 drivers, let's say, in all of those segments. So, let's say, there could be a couple of segments over here and maybe you can have something like this. This is S2, S3, S4, something of that sort. So, we'll query all of these segments. Basically, we'll not query, we'll just off load that job to Map Service saying, get me all the segments that are surrounding this segment S1, that Location Service gets. Then, Location Service basically figures out all the drivers and then tells Map Service to get the closest 10 drivers to this customer, out of a list of those drivers. Distance between the customer and the driver is also something Map Service is good at. Remember, it is able to find and identify the distance between two points. So, it can identify the distance between two customers and drivers, taking into account the road distance, not the aerial distance. Let's say, it got some 5 - 10 drivers which are close by to the customer. Location Service will return it to Cab Finder. Now basically, we need to identify 1 driver out of these 10 who will do the trip. Now, there comes something called modes. There could be multiple modes in which this cab request could be served. We could say that for certain kind of customers, just pick the best driver. Let's say, if it's a premium customer, then we just pick the best driver out of the lot and assign that. Or, if it's an average customer, we might want to do some different thing. We might want to broadcast to all the drivers and whoever accepts first, we can assign that driver to the trip. So, all of these modes are basically something that Cab Finder decides that which mode I want to run it in. Given whatever mode it is, it might need some additional inputs. So, if it's the best driver mode, then it might need to stack rank all the drivers. So, all of these are basically something that is handled by Driver Priority Engine. We'll get to the logic, what it follows, later on. Cab Finder then queries Driver Priority Engine saying, I have these drivers for this kind of a customer, you just arrange them and give me back. Then it gets a list of those drivers. And given the mode and given the list, it then tries to identify one of the drivers who will actually do that trip. It then queries WebSocket Manager and asks WebSocket Manager saying, which was the host that was actually, you know, integrating with this particular driver. It will then call WebSocket Handler. Let's say it chose D1, it will then call this Handler 1 saying, D1 you have a trip, go do it. The same notification would be sent via Cab Request Service to Customer saying, Customer, you have got a new driver, which is driver D1. And then the regular flow follows wherein the driver starts moving to the customer's location. So, this is how we'll figure out, how to assign a driver to a customer. Once a driver is assigned, basically, what it means is, a trip has to be created and updated. So, this will then basically update the Trip Service saying, I've created a trip with this customer, with this particular start point, this end point, this driver and whatever information it needs to. And, that gets persisted into this MySQL via this Trip Service. So, this is basically the booking flow. As part of the booking flow, we had inserted a lot of events. Whether Cab Finder was able to find a ride for the customer or not. And even the Location Service was putting in a lot of events into Kafka. Now, let's try to look at how do we use those events. This Kafka is getting a lot of events like location update events, trip update events, no driver found events, a lot of things. Let's look at some of the use cases where we can utilize those events to our benefit. One of the very common thing is - whenever a trip is completed, we need to initiate a payment to the driver. That could be aggregated over a few hours or a few days or something of that sort. But, we still need to store information about a potential payment. There would be a Payment Service, which sits on top of this Kafka, which would have a Kafka consumer, which listens to all the trip completion events. And as soon as a trip is completed, it would insert a record in it's Payment MySQL database, which says that - this particular driver, did this particular trip_id, for a user with user_id, and with lots of attributes like distance travelled, time taken and all of that. And finally an amount of money that needs to be paid to this driver. If that needs to be an instantaneous payment, this Payment Service could talk to a Payment Gateway to deliver a payment.. like transact the money. Or, if it needs to be aggregated, then it can basically run a cron which does the payment every once in a few days or something of that sort. If, let's say, a driver wants to see their payment history, there would be APIs that would be running out of this service, which will give all the payment transaction information against a particular driver, which we talked about in the very first section that, could be powered through Driver service, talking to Payment Service. Now, let's look at some other use cases. On top of this Kafka cluster, there would be a Spark Streaming Cluster in which some Spark streaming jobs would be running. One of the very common things is to basically create a heat map. If, let's say, from a particular geography, we are getting a lot of events saying, there are no drivers found, that means that, there is a surge of customers in that area and there are very few drivers. So, we can create a heat map within Driver App, powered by this Streaming, which kind of shows a particular segment or a few areas, which are having this kind of a scarcity so drivers can move to locations to get more tips. This is a classic example of a Streaming kind of an application. What it will also do is - it will basically put all the events into a Hadoop cluster, which can be used for further Analytics. On top of this Hadoop cluster, we could run a lot of ML jobs or regular Spark jobs, which will do a lot of things. So, the very first thing is basically to do a customer classification into various categories. So, if a customer takes a trip with us every day, we'll classify them as a premium customer. If it's a once in a while coming customer, then it would be just another customer for us. Same classification could be done for drivers. So, there'll be these User Profiling and Driver Profiling jobs, which would ideally be a ML classification model running, which will classify those users as premium or regular, or drivers as premium drivers or regular drivers. The same information would also be used to create an ML model, which can do the Driver Priority that we talked about in the previous section. So, based on certain attributes of drivers, for example, their ratings or the customer feedback or their ETA.. basically the accuracy of how much ETA was supposed to happen and how much ETA did actually the driver take. There could be a lot of attributes on which we stack rank the drivers. All of those could be aggregated in these jobs and drivers could be given a score. And using those scores, drivers could be ranked by Driver Priority Engine. So, something of that sort could also be built. Now, we could also power the same... I forgot to make this link. This same information could be used to generate a fraud score. Let's say, if there is a very high correlation between a driver and a customer. Let's say, if all the location pings say that a customer and driver move together or if all the trips done by a driver are against a particular customer. For most of them, we can safely say that this customer and driver are either friends or that's the same person using two mobile phones to book a trip by this customer and do a trip and thereby, you know, using the.. there's something called as incentive programme run by these ubers and all the other companies. So, it's basically a way to exploit that kind of a programme. So, all those kind of frauds could be captured by these kind of models again. The same data could be used as an input into Map Service. Let's say, if we don't have traffic information into maps. All these lat longs could basically power the traffic information of Map Service. We can safely assume that - we'll not know the exact number of people traveling on the road, but, if some road has more of our cars, then we can safely assume that probably there is more traffic also there. If we are at a Uber scale, we can safely assume that. So, that could be an input into Map Service or at least the traffic data and some of the road condition data also. So, if the average speed of a driver on certain roads is very high, we can safely assume that that's a freeway or a highway or a good road. If the average speed is very low, we can assume that there is either high traffic or the road is not in good condition. Or there is something wrong with the road. And also the same information could then be used to come up with a better, enhanced ETA Calculation Engine. Exact details of it, we'll go over in the Google Maps video. So, I would recommend that you look at that. But this could be one of the use cases where we use all of these information. So, yeah, I think this is mainly about an Uber kind of an application.

---

## 11. Facebook System Design | Instagram System Design | System Design Interview Question
**Channel:** CodeKarle | **Views:** 141K | **Date:** 5 years ago | **Duration:** 46:51 | **ID:** 9-hjBGxuiEs
**Link:** https://youtube.com/watch?v=9-hjBGxuiEs

### Transcript:
Hello everyone!! Welcome to CodeKarle. 
In this video we will be talking about how to design a social network like Facebook.
The important thing to get take care of here is, how do we design a system that
can scale up to the requirements that Facebook has. Now I have already made a
video on how to be device twitter, so I would recommend to watch that video
first because this video takes an inspiration of that video and tries to
take it to the next level by making some changes which can help that system scale
to a much larger volume at a lower cost and in a much scalable way. Now the same
system can be used for any other social network as well, like Instagram, LinkedIn or
even Twitter for that matter. So yeah let's get started!
Let's look at some of the functional and non-functional requirements that we want this platform
to support. So from the functional side the very first requirement is that we
should be able to post, make a Post. Post is anything that we want to update
on the platform. right. It could have an image, it would have a video, it could be
just text and eventually you can extend it to a lot more varieties of course.
The next thing is you should be able to like a post, you should be able to
comment on a post and you should also be able to share a post, right. For now let's
restrict it to commenting just on posts and not on comments. The next thing is
adding a friend. So a person should be able to go on somebody else's profile
and add them as friend. Now this is a non-directional relationship, so if I am your friend you are also my friend. So the friendship
is non-directional but there is a concept of weightage of friendship that
will come to in a while, that would be a directional concept, okay. The next thing is
user should be able to see a timeline. Now that timeline is something where in
let's say I have hundred friends, so all the hundred friends, that would
have posted whatever they wanted to I would see all of that data in my
timeline. So that's the timeline functionality. The next thing is user
should be able to see other post and others profiles. So by other's
profile, we mean it's just a profile page through with you add them as friend. Other's post is basically a timeline of a particular user. It would
be self profile or self timeline or some particular users timeline. That can be
accessed again through a UX by going on to their profile and looking at their posts.
The next thing is something called activity log. What this means is we
should be able to log everything that a user does on this platform. So for
example if a user posts something, they like something, they comment, they share,
they search for something, all of that should be tracked and should be visible
to a user somewhere, okay. So these are the functional side of things. From a
non-functional standpoint we know that any social network is a very read heavy
system. So let's say if I post something all of my friends would be seeing it,
right. So for one write that is happening in the system, there are probably
hundreds of reads that are happening. The same thing was the case of Twitter as well. Now it should have a very fast rendering
and posting time. So if I want to post something, I should get a success message
that the post is saved very quickly and whenever I am looking at somebody's
profile, my timeline, somebody's posts view, all of that should also render very quickly. 
But some lag is okay. Now lag and latency are two very different things. Latency should be low but lag is okay.
What lag means is if let's say a user post something, if it takes 10-20 seconds
for their friends to see that post, it's okay to have those 20 seconds in between
but whenever they see is the page should render very quickly. The next thing is
access patterns, so any social networks has a very unique access pattern. So
whenever a post is created, it will suddenly start to get a lot of views, lot
of like, lots of comments, and all of that There will be a time when it reaches its peak which will be the highest point of
interaction that the post has, then slowly over time that post will start to
decay and maybe after a couple of days or a couple of weeks there would be
absolutely no interaction on to that post. We will use this specifically
for handling images and videos because that is the heavy content and we might
be able to optimize on cost, on our hardware by using this property of the
access pattern. One other thing is that this platform needs to be built in a way that
can be global. Now by global there are two three aspects that come in. First of
all, it means that there are a huge variety of devices through which people
will access it. Second thing is the platform should be available in multiple
languages and should be able to handle content in multiple languages. The other
thing is people coming from this platform are from a wide variety of
internet bandwidths, so it should not happen that it is very very slow in some
geographies and if it is then we need to make sure that we have enough servers in
their locality, in that geography, so that people in that area are still able to
access this platform in a fast enough way. So global basically means that we
need to have a global presence from our hardware as well. Now coming to the scale,
these are some really big numbers Facebook has 1.7 Billion Unique Daily
Active Users(DAU).  What this means is 1.7 billion users, access facebook on to the
read path at least, most of them some of them would be writing as well but most
of them would be reading, right. There are 2.6 Billion Monthly Active Users(MAU). 
Now honestly I'm not sure of authenticity of this data. It could be a bit here and
there, but from what I read about these are the numbers of just Facebook and
not including WhatsApp and Instagram. Those are separate. Overall including them the
number crosses 3 Billion I believe. Now these people access Facebook, ninety-five
percent of these people access through mobile phones. So we need to kind do
some optimizations that are very specific to mobile devices also. Because 95 percent the user base is on mobile, so let's do
some optimization for that. Now, again coming to some volumes of some functional requirements. Every minute, these are the number of actions that people take. They upload one hundred and fifty thousand images, which needs to be uploaded onto our server spread out in various CDNs and made available for the users they update three hundred thousand statuses. These are the new statuses that come into the system which needs to be distributed across all the user base and they post five hundred thousand comments every minute. if you look at the numbers of Twitter, they were a bit smaller than this.
In fact significantly smaller than this, so we were able to cache all
of the data, right. In this case because of the sheer volume of these numbers we
might not be able to cache everything so there is where some changes we'll do from
the Twitter design. If you have not looked at that video I would recommend
to go and watch that first before moving further from this. Now coming to one more thing very similar to the previous video have
categorized users into five segments and we will be handling these segments
of users separately in certain flows. Now based on your requirement with
your interview, you could make more categories or less category but on and
off for a Facebook like system, this should be good enough user segregation.
Famous users are the users who have huge number of friends, okay. Now in our
case, we have not included followers as a functional requirement, so this would not be that bit of a problem because I believe Facebook has some restrictions
on number of friends that you can have so that will still be a finite(small) number.
But in case we start having that we would have a problem, so let's add
something called a Famous User as well. Now there is something called an active
user. Active user is a person who has access Facebook in the last few days.
Let's say for all practical purposes during this conversation, we'll assume
that people who have access Facebook in last 3 days, are considered active.
And we'll do certain optimizations to make sure their page loads are fast enough. 
Live these are the users who are actually browsing through the
platform right now, so instead of waiting for them to request for new posts or new
content, we will probably send them notifications through a communication
between their device and our servers if a new content comes in. Passive users
are the users who are not regularly active, so we will not cache any content
for them. Whenever they come into the system will try to generate whatever we
need to do for them, okay. Inactive are basically the deactivated accounts, it
could be fake profiles, it could be people who are requested to get their account
deleted and these are people who do not access Facebook. We just have their
accounts because it's good to have. But these are soft deleted accounts. Now let's go
what the overall architecture. As usual I have divided the overall architecture
into multiple components and we will look at them one by one. A bit of
convention to start with. Things in green are the user interaction points, It could be
web browsers, but for most of the users, it would be Mobile Applications.
Things in black, these two are the Load Balancers plus reverse proxy, plus
authentication and authorization layer which will validate the API calls coming
from the outside world into our system. Things in blue are the web services that
we have written. It could be web services Kafka consumers, Spark jobs, basically
the code written by us. Things in red are the Databases, Data Stores, any
clusters like Kafka cluster, Hadoop Cluster, or any open source tool that we'll be using or any
third party component like a CDN for example. With that, let's start with the
user flows on how does the user come into the system. Now this is very similar
to the Twitter design, so we try to go over it quickly. User onboarding and
login and user interactions like looking at their profile, creating their profile,
updating their profile are basically this green box and all of that is taken
care by User Service. User Service is the primary source of data for any user information.
It provides all the APIs that the UI needs or the APIs that other systems in
the overall infrastructure would need. These would generally be APIs to get a
user by user ID, update a user by user ID, get details of a lot of users in bulk,
so all of those APIs will be powered by this User Service. Now this user service
sits on top of a clustered MySQL Database because of the volume we might
need to shard the data across multiple hardwares, but it will we have MySQL
Database because again user information is a very standard and a relational set
of data points. We don't really need a NoSQL Database for it. Plus one more
thing about user information is it is not updated very very frequently. So most
of the information about the User like email Id, name, location, stuff like that
is a constant information. So MySQL is a fairly good database for that.
It also sits on top of a Redis cluster. What does that Redis does is -  it
basically caches a lot of information. So like Twitter video, we'll also be
using a lot of Redis and a lot of caching here... And we'll go
over what all is cached at what point in time, but to start with, the very
first thing that stays in Redis is basically all the user information.
So let's say if an API call comes in to fetch details of a user to User Service,
it first tries to look up in Redis, if it finds the information then it returns
from there. If it doesn't find the information, then it queries MySQL
Database, gets the information, updates Redis and then responds back to the user,
okay. And whenever a user logs in or user account gets created or anything happens,
an event is pushed into Kafka, for a lot of reasons. So for new accounts we will be
doing a fraud check, just to validate if they are not fake accounts. For any
updates to the account we might want to push that information to other systems.
So let's say if the person changes their email id or phone number, we might want
to inform the notification service about their notification preferences. So all of
that would be taken care of by this Kafka. The next thing is how does the user add somebody as a friend. So a user can
go onto somebody else's profile and add them as a friend, okay. 
All of those interactions are this green box and it is taken care of by the Graph Service.
Graph Service again because it maintains the whole graph of how the
network is maintained it keeps their relationships and also the weightages of the relationships. What weightages are we'll come to in a while,
but this is basically source of truth if you want to infer how close are two
people or which users connected to what all people, Graph Service will expose API for all those kind of functionalities.
Now again as User Service, Graph Service also sits on top of a clustered MySQL
Database. Again it'll need to be sharded because it will have like
multiple times data when compared to User Service. But still it will again be
very structured. So think of it as a table with a user ID, and a friend ID
kind of a thing it's very core and there will be other tables which kind of
build in other functionalities but at the core it will just be one table with
that kind of a mapping, okay. Now again all the user relationships would be stored in a Redis. So if I want to quickly find out that
who all are the Friends of a particular user, I would not want to query MySQL
for all those kind of requirements because all those APIs would be used
very frequently by other systems. So all that information again gets stored in a
Redis cluster, in which the key user ID, and value is basically "list of friends", okay.
Now I have made one cluster ideally because of the volume I'd want
to keep two different clusters for these two use cases but we could keep one also
if we can have a bigger cluster so that depends. Now other than this, there
are a lot of other attributes that also get stored in this Redis. Key in all the
places is user ID, values are these things. User Details and Friends, we have looked at.
It also stores what is the user type against a user ID. Remember the user type
that we talked about: active user, live user, passive user, famous user, so based
on some logic it would... User Surface would be able to identify what
kind of a user it is and it would be able to update that. It will get notified
through somebody. So somebody would tell you the service that user is now live,
make it live or user is now become famous, make them famous,
something of that sort. There is something called Relevance Tag, which we'll
look in the last section, but the idea of Relevance Tags is: so there's a lot
of information that can be shown on Facebook. Let's say if I update a status
about sports, instead of sending that to all of the friends, if we restrict that
to only those friends who were actually interested in sports,
then that will be a very engaging... then that could lead to an engaging
conversation between me and them. But if there are people who are totally not
interested in sports and they also get to see that, they will just scroll
through it and that would not be a good experience for them because they are
seeing junk content because they don't like that, plus it is opportunity loss
for Facebook because it could have shown something relevant which could have
initiated a conversation through which some more interactions would have happened,
user would have probably spend more time on Facebook, right. So Relevance Tags is
something that will be powered through analytics will get to know of Relevance Tags,
and it will be used at the time of figuring out, that who or needs to be
shown a particular status or anything. All right! The next thing is Last Access
Time. It is same as the Last Accessed Time that used to keep in Twitter. It would
use for a lot of functionalities mainly showing how much time back a user was
online in chat and stuff like that. So we are not building chat as part of this
video, but it could be used for that and it could be used for some other
functionalities as well. Now let's look at how does a user post some content and
how do they retrieve their timeline and other user posts, okay. First let's look
at some of the generic components that we are using here. So there is a component
called Short URL. What this is is so let's say somebody wants to post an
external URL on to Facebook. It's generally a good idea to keep track of
what kind of URLs are being posted and how are they being hit. So what we will do
is we will have a Short URL Service which converts at any URL into a short URL and short URL would be posted on the
platform. Okay and then it would be redirected to the long URL when a person
clicks on it. So I've made it a separate video on two short URLs you can have a
look at that to know in details about how it is implemented.
Now there's something called Asset Service. So remember a post can contain
an image and a video. Now the thing with images and videos is so people are
coming onto Facebook from various kind of devices. They have a phone, they can
use a laptop and aspect ratios on both these platforms are very different, right.
So if a user uploads a photo which is kind of a square-ish photo, that would look very
bad on a mobile phone so we might want to do something and play with the
resolutions to make the pictures look good, right. Plus if it is a very high
definition photo or a video, it wouldn't give any added advantage when you are
viewing it on mobile phone. It will just add a lot more data, right and bandwidth
consumption will increase. So it does make sense to reduce the aspect ratio
and the number of pixels in the content there. So all of those pieces are being
taken care of by Asset Service. So I have made a different video on Video Streaming/ Processing Platform something like YouTube or a Netflix. This is basically your
whole platform which is a Video Serving Platform. It takes care of file
conversions to multiple formats, to multiple bandwidths, to multiple aspect
ratios. It takes care of streaming the content and all of that. It also takes
care of one very important thing so remember in the NFRs we talked about the
access pattern. So when a photo is added in the first few weeks it will be
accessed a lot and then it will slowly die down, right. So once the access
to that photo dies down, then we don't really need to keep it on CDN.
Then we can remove it from CDN, so that the capacity can be used for some
other photos, right. So that is also taken care by Asset Service, saying that with
which particular content would reside on CDN and which would reside on S3. So
we'll be using Amazon S3 as an Image Store and a Video Store here. It also takes care of one thing like, let's say there's a
celebrity, who has a very old photo Now let's say another celebrity comments
on that photo, so suddenly that photo will become popular now right, which was
a very old photo which was removed from CDN. But now that it has become popular again this service would keep a track of how
my CDNs are being accessed, what is the hit rate on each photo and
if a photo is access frequently into from S3, it will basically pull it
from S3 and put it into all the CDNs wherever it is getting accessed from.
So this is basically a Video/Image Streaming Optimization to take care of
the global geographical data okay. There's also User Service and Group
Service, which we talked about in the previous section, we'll be using it in a
bunch of places. Cool! So now let's start with the user
flow when they try to post a content. So that piece is being taken care by this
add a post box. It talks to something called as Post Injection Service. Now if it has audio/video content, Post Injestion Service will talk to Asset Service. If it has URLs, it'll talk to Short URL Service. And then it will have a final content that it will actually need to persist. Now for all
post kind of data, I'm using a Cassandra here. Again being a very same
reason that the volume of posts are very high, right of the order of lots of
thousands per second. So a Cassandra is a good choice here because it can handle
that kind of traffic on both write path and the read path.
Now other than Cassandra you could have used a HBase also here.Both are kind of
giving similar-ish performances. I just chose to use Cassandra because set up
for that is much easier, okay. Now once a particular post has come in and it got
saved into Cassandra, there is a service called Post Service. Now this Post
Service is the source of truth service and the owner of this post information. And
this is a Service that will provide APIs to everybody else to access a particular
post. Basically if you wanted to Get post by ID, or Get a lot of post by
a lot of IDs, all of those APIs are provided by this Post Service.
Now whenever a post comes in, Post Injection Service reads the post. Puts it
into Cassandra and then posts an event into a Kafka. And from there on it
will be spread out to further other systems which will do their own jobs. 
So at that point in time, Post Injection Services's work is done and then we will get
to, how a post kind of comes back to the user. So there is something called
Analytics that you can see here, it is not a Service actually. It is a lot of
components, so on this Kafka there will be a Streaming Consumer which will keep
listening to all the events that are coming in, and it will try to tag it
using a machine learning model saying that this post is of what kind of a
category, okay. So basically it has a classification model that is ready and
it applies the post on that model and come up with some tags for that particular post,
which will be used to score to post on various relevant parameters.
Once this analytics cluster tags a particular post ,it'll
put it back into Kafka from where it will be processed further.
Now.... doing this kind of a thing, we can do it because remember we
had a NFR of the fact that some lag is okay so if somebody posts(adds a post) if I
see it after a few seconds that is okay and in during that few seconds I can do
all of this fancy logic to figure out who are the right set of users who
should see this post, okay. So once this Analytics puts it back into Kafka there
is something called Post Processor which runs. Now this Post Processor basically
looks at the content of... so it gets the event from Kafka, which has the content
of the post and some tags along with that, and obviously the user ID who
posted the content. It then queries User Service and Group Server, so these are two separate services. I have just clubbed into one box that it's easy to kind of draw it out. So this Post Service will now fetch all the friends of this
particular user, who potentially can see this post, okay. Along with the... so that is the group information. Along
with that it will also find out the Relevance Tags stored against the user. 
So we also do some user profiling that we look into the next section that
basically is a classification of users into some tags. So a user could be tagged
to let's say politics and sports, okay. And let's say if the post is also about
sports, then this user would see it. If the post is about technology let's say
and the user is tagged to politics and sports, then the user would not see that
particular post. So now it fetches all of these information about a post, about
all the users that this person is friends with, and tries to come up with a
subset of users who should see this post. It's then puts all the relevant
posts into Redis. Now what Redis here is It basically is a timeline of
all the users. So remember the twitter video, it is something very
similar to that. It basically has a timeline So let's say "user1" posted this post okay and it has friends with "user2" and "user3", okay. Lets say coming after
relevance, this Post Processor decides that only U2 should be able to see
that post. So what it will do is, it'll in the timeline of U2, it already has some posts. It will put that post lets say Pi, okay. So that now when user U2
accesses their timeline, they can look up directly from Redis and they don't need
to do anything else, okay. So once we have posts into Redis now Post Processor's
job is done. Now coming to the other side of things. What happens when a user
accesses a particular.. when a user accesses their timeline? - So there are two kinds of
timelines that a person can see. One is if they go to somebody else's profile
and they want to see all of their posts okay so that is a very straightforward
implementation. What that does is it basically calls Timeline Service. I
want to see all the posts of this particular user. Timeline Service would
then query Post Service, saying give me all the posts of this particular user
and it displays it back. So that's a very straightforward implementation. The other
side of things is, when they want to see their own timeline.
Which basically contains posts of all of their friends, right. Now the flow that
happens is - this is the timeline box. It basically calls Timeline Service
which then does a lot of things. It gets all the... basically the timeline from
Redis for that particular user. Now again remember the Twitter video it
would not contain all of the users, it'll contain only normal user's data. Why?
Because normal users can be easily managed with this kind of a model. For
famous users we need to do something different. The reason is that if a famous..
so right now we don't have a problem with famous user because we just have
friends, but let's say we introduce a concept of followers and famous users
start having multiple millions of followers, then the problem is this Post
Processor will have to update Redis for millions of users. And that is not
scalable, so that's the reason we'll do exactly the same thing as we did for
Twitter implementation. We will basically give that responsibility to Timeline Service to merge the data for normal users and famous users. So what it does is whenever a particular user's timeline needs to be shown it queries User and Group Service, figures out the list of users that this person is friends with and it queries the user timeline from here, which is the post of all the regular users (normal users), and then it basically also know the famous users that this person has friends with, right. It queries Post Service and ask the Post
Service to give all the posts of the famous users. Then it aggregates the information and sent it back, okay. Now before sending it back, it could also persist this into Redis okay. Along with a very similar implementation again with that particular time stamp let's say Ti it says that at Ti, I have inserted this data which contains the regular users data and famous users data. Now the next time when a request comes in what we will do is we will basically look at this timestamp if this time stamp is in the last couple of seconds or maybe a minute
we'll return the data as but if it is more than a few minutes, so we know that this was last refreshed a lot of minutes, back then what we say we again queries the Posts of famous users just in case they would have posted
something different okay. So this is how we handles the regular active users and
the famous users. Now we can do a lot of optimization for the live users. What
live user thing is, so when an event is posted and Post Processor figures out
that what all friends this guy has and who all needs to get the relevant posts it also knows because it has queried User Service, it knows that the user is now actually live. So along with sending in to Redis, this what it will do is it will put another event in a different topic into the Kafka, saying this user is live and this is the timeline that he sees.. needs to see now with this new
additional content, somebody go tell given this information, okay. Then comes
the job of Live User Service. What this is, it basically is the service which has
open connections based on WebSockets with all the clients(Users), right. So these are
your regular users who are using mobile apps or web browsers, who are on the platform
right now and this Service has an open connection with all the users.
Now whenever this service gets a particular event saying this user's view needs to be
updated, it will send the event to the app via the WebSocket protocol and the
app would then... show up the new post in whatever way it needs to.
So this is the separate thing that we do for live users.
Now there is something called Archival Service. What it does is, so this Redis cannot
contain data for a lot of period of time. What we are saying is -
we'll put only today's data into this Redis All the posts that have come in today.
For everything in the past, we'll use something called as Archival Service.
Remember a post can just be created at a certain timestamp, right. It can have
comments, likes and all of that, but it is made and once it is made it doesn't really.. it's created time doesn't really change, right. 
So what we can do is... and the timeline for a particular day once it is
created, it just... new things get added to it but old things don't change from there, 
they remain the way they are. So what we can do is... we can cache this timeline. But instead of using an in-memory solution like Redis, we could use a
Cassandra for storing that. So what archival service does is at some
point in time during a day it basically fetches all the users timeline whatever have been created, it puts it into something called an
aggregated timeline Cassandra and clears this cache, okay. Now this makes sure that we have a finite amount of data within Redis, which is small. It's not a lot of data. Now for the users where this doesn't exist, it will try to
create that kind of a timeline by simulating the same behavior. It can in
fact call Timeline Service and get the time line and save it for all of those
users. Now the format in which it'll save is roughly similar to this. What it will do is, it'll say that user Ui, at a date DTi, has a timeline of a
particular thing, right. Now coming to Timeline Service, an actual time line needs to be created. It'll not only query some Redis and Post Service it will also query from Archival Service if the user scrolls down a lot, and needs to see
yesterday data or day before yesterday's data. All of the older data need not be
computed at that point in time. It can just be looked up this
itself and this can store data not only for the active users, but also for
famous users, passive users and all of them. And that's the reason I wanted to
use a Cassandra here because now we can scale this also infinity. 
And wherever we are saying we are caching something, we are storing something, we
are just storing the post IDs. We are not showing the actual content, and to
get the actual content this Post Service can be used to construct the whole
payload. Now there is one more thing with this. at places where we've used Cassandra,
there is a potential problem that could be created. We could create hot spots. What a hot spot is - is basically, so Cassandra is
basically a distributed thing, which is across a lot of machines, right. Now if
you don't choose a partition key properly, it could potentially happen
that only one machine is serving most of the live traffic, all the updates are
happening on one machine and all the reads are happening from the same
machine and all the other machines are just lying idle with no work. This would
happen if you have a partition key something like a date range, so all the
updates of today would happen on the partition which is handing today's data,
and all the reads will also happen from that, right. So we need to be a bit
careful about choosing the partition keys there, a user ID based key would be a
fairly good thing, but a date based thing (Partition Key) would definitely create hot spots. 
So wherever you are using Cassandra we need to be very doubly sure of basically to
make sure that we don't create a hot spot. Coming to the last section of
this video, let's talk about how are likes and comments handled. So assuming there's
a UI through which people can do a comment or a like. This could come through various
devices like phones, browsers, whatever. So whenever a user presses a like
button, the request goes to this Like Service. Now this Like Service is our owner
of all the like's information. So even when you want to make a like(put a like on something)
or you want to get the number of likes in a particular post, all of those are
powered by this Like Service, okay. Whenever a person puts or adds a like, that
information gets stored into Cassandra. Think of it as a table saying userID
and postID okay. So postID contains the post which is being liked and userID is
basically the user who's liking it. Let's say if you want to add a
functionality of like being put on a comment, right. This comment would also
have an ID, so we can add a parent type kind of a thing or post type kind of a
thing, saying postID so-and-so, and post type could be either a post or a comment
or anything right, and then the user who'se like it. Alternatively if you want to add more types of likes, like upvote, downvote, or
something of that sort, you could add a like type also in that. 
So that becomes the permanent store but there's a Redis is also that is used here. What
is that for? - so generally what we see is whenever a post is displayed, along with
the post content the number of likes are also shown. Details are not shown but
number of likes are shown, right. So the number of likes is being powered by Redis.
Redis stoers information of the count of likes on a particular post, only
for the recent posts, okay. Once a post becomes outdated, this particular entry
will have some TTL(Time To Live) of a few days and that will get expired. But for all the
recent posts, it should have an information of the count.
So whenever a like comes into the system, it gets stored into Cassandra and
Redis update gets called. So basically there's a thing called update and get in
Redis(INCR operation) which the atomic update into Redis, so that takes care of thread
safety and all of those issues. That can be used to power the updates.
Now once a like has been posted that information would also be put into
Kafka saying this user has liked this particular post. How that will be used
we'll come to in a while. Now let's get to comments. So again there's something
called Comment Service, which is basically the repository of all the comments into the system. Whether you want to make a comment or you want to get
all the comments from a post, that will be powered by this Service. And this uses
a Cassandra as a Datastore... a very simple schema it will have. It will have a postID and a comment text and whenever you want to get all the comments on a particular
post you just run a WHERE clause on the postID. It'll obviously have userID and
all of those attributes as well, timestamp, and all those things, but those
are minor things. Now whenever somebody wants to get all the comments
that is also powered by this Cassandra We don't really need a caching here.
So this Redis was used because it was storing aggregate information. So instead
of Redis call, the alternate was to do a SELECT COUNT(*) query from
Cassandra. But over here in case of comments, it is anyway look up by ID (PostID)
whether it is on Redis, or whether it is on Cassandra - it's not too slow. So we can use Cassandra without any cache here. Now we did not talk about sharing
of posts earlier, but sharing of post would exactly be implemented in a way a
post is implemented. So a shared post would be just another post with a parent
ID of the original post so that it can be referenced that from where is this
post coming from. Now whenever a comment is added it also gets posted
into Kafka for further analytics. Let's come to something called Activity Tracker.
So you remember we talked about... when we talk about Functional
Requirements, that we want to capture all the activity than by a person on Facebook right.
So let's say a person makes a post, or a person likes a post,
all of that should be tracked. So anyway all that information is coming into this
Kafka. Whether it is a person liking something, whether it is a comment,
whether it's a post, everything is actually coming here, right. All we need
to do is to store that information against a userID, with the timestamp
that this was the action taken, and some attributes of that action. So this
Cassandra of Activity Tracker would primarily have a userID, a timestamp, an action, like
action could be "liked a comment ID" or "made a post with the postID" or "searched
with a search string" all of that right So all of that would be powered by this
Activity Tracker. This would have both insert a APIs into Cassandra and get APIs
to fetch the data from Cassandra and show it on to an Activity UI. This
Activity Tracker would listen to the same topic that everybody is writing to. Now coming to Search. Search is implemented in exactly the same way as it was in
Twitter so I will not go over it in much detail. But assume that if all the events
are anyway coming to Kafka there will be a search consumer that reads all those
events, stores it into an Elastic Search which is very efficient for
text-based searching and there is a Search Service that sits on top of
that Elastic Search, run the query and returns the data,
and in some cases we might want to cache the results of the search response, so
before sending it to the user we might cache it in a Redis as well.
All of that is abstracted as part of this search box for which you can look
at the Twitter video in which I've explained it in much detail. And while a person is searching that information also gets pushed into Kafka so that can be logged by Activity Tracker. So we had put a lot of information into Kafka saying that we
will do some analytics on it let's try to do... let's try to take some
examples of what kind of analytics can be done. So let's say a person posts a
content. That content can be classified using some very standard
classification ML Algorithms into certain Tags. So for example a post
could be tagged as a sports related post right now if a person is having a lot of
sports related posts, that means the person is giving us a signal that that
person is interested in to sports, right. So what we will actually do is - you will
have this Spark Streaming Sonsumer running which will put all the information about
all the activities and by user into this Hadoop Cluster. That would include the
post, the comments, the likes, what not. And then we'll have some algorithm
which basically do this user profiling saying if a user is liking a lot of
sports related posts, that means the person is interested in that. If the
person is commenting on similar posts, that also gives the same signal, right.
So all of those information could be used to generate a user profile which
classifies users interests. Now in real Facebook we have the option to
explicitly like a particular thing, right. Let's say I like a sports page that means I'm
explicitely giving a signal. But in case of this scenario, we did not include it
as part of functional requirements, so we can use this data to infer all of those
things. So that basically creates a user profile. Once the user profile is
created that is put back into Kafka, and remember the very first section where we
had a User Service which was storing a User Profile Tag kind of a thing,
User Service basically reads that event and stores those tags against the user
which is then used for various kind of things in the system that we talked
about in that section too. Now there is something called Graph Weight. 
So what is that? - so let's say myself and Elon must have friends on Facebook! hypothetically :) 
Now I might like a lot of his posts, but he might not really
like mine, right. What that tells is I like to content that he posts but he
does not like the content that I post. So even though we are friends, even
though will be shown some of the content that both of us might post, but there is
some affinity of mine towards seeing his post, rather than somebody else's, right.
That information can be captured by the Graph Weight Job, which basically say that
out of all my friends whose post have I liked most or whose posts have a
commented the most on. And bases that logic, it will create a profile of mine
saying I am more inclined towards these two three people and less inclined
towards the rest of them, so I'll see more posts of these people.
That becomes your Graphs Weight Job. Now this runs on top of a Spark Cluster
can query the data within Hadoop, run a couple of spark jobs, do all the maths and
publish data, right. Now we have left something called Trends. Trench is
basically something very similar to the trending thing on Twitter we talked
about that while during that Twitter video. It basically tells us what people
on Facebook are talking about right now. Basically what this Streaming Job will
do, is basically it'll take all the posts, all the comments, tokenize them and
split them by space characters, remove some very common stop words, like a' , 'and', 'of',
'the', 'for', 'is', and all of that, and then the remaining words will be put into the
Trends Service stackedranked by their count. So at any point in time we will
know what word is the most used word right now. And that will give us
some inferences about what kind of things people are talking about and it
cannot just be words it can be phrases also and we can
a lot of intelligence to figure out what people are talking about and what people are interested in right now, and all of that information could be stored in
a Redis cache, because anyway it's a temporary information for right now and
it will get updated in a while and there can be a UI kind of a thing that can
we build on top of it if there's a need. So these were the Functional
Requirements. Now coming a bit one the non-functional requirements. All of this
is that we have talked about. One thing that I did not explicitly mention
but all the services that you see here and in the previous sections, were
scalable horizontally. So whenever the traffic increases you basically add
nodes into that particular service or that particular database, or that
particular cache and it would scale automatically. But that being said
we still need to... there are a lot of different kind of technologies used here,
and we need to do a lot of alerting monitoring on all of these things, right. 
So for example is there are... there's a Web Service that we have built. We need to measure
the latency that it is having, the throughput that it is having, the CPU and
memory usage within that, the disk usage and then if anything kind of spikes up
then we need to send out an alert. Similarly for all the databases we need
to keep a track on how many... what are the throughput and latency are, how many
queries are getting executed, what is the disk space, we don't want a database disk
to be full at any cost. So all of.. again CPU, memories anyway are there, so all of those
things on the database, on the caches, on the web servers, on Kafka, all of these
those things need to be monitored on and as soon as they go beyond a particular
threshold, there needs to be some good enough alerting, so that the people get
to know that something is going beyond limits and can look into it proactively so as to make sure that we are able to maintain the uptime and latency
and everything, there by maintaining the non-functional requirements.
So I think that should be it for a Facebook kind of a system. Now just to re-iterate, the
same design can be used for any other social networks like Instagram, Twitter,
LinkedIn or anything of that sort.

---

## 12. Twitter System Design | System Design Interview Question
**Channel:** CodeKarle | **Views:** 139K | **Date:** 5 years ago | **Duration:** 47:54 | **ID:** EkudBdvbDhs
**Link:** https://youtube.com/watch?v=EkudBdvbDhs

### Transcript:
Hello everyone!! This is another video
from the Design Interview Preparation Series from CodeKarle. So in this video
let's look at how do we design Twitter. Let's look at some of the
Functional and Non-Functional Requirements that we want this platform
to support. So from the functional side, the very first thing is we
should be able to Tweet, which is basically saying that we should be able
to post a content of 140 characters length. It could have a image, it could
have a video content, it would probably have links to external websites and all
of that, okay. The second requirement is something called Re-Tweet. So if somebody
has tweeted something, you should be able to Re-Tweet that, which is very
similar to a share on Facebook. The next thing is you should be able to
follow someone. Now that is a directed relationship. So if let's say I follow
user A, does not mean user A also follows me. So that's a unidirectional thing.
The next thing is you should be able to search for some particular content
within all the tweets that have been been posted on Twitter by some users.
This would be usually used to do some trend analysis or to figure out what's
happening in the world or in case if you want to just read about what people are
talking about a particular topic, so for example if Game of Thrones is launched and
you want to see what people are saying about it, you can probably search for it.
So these are the functional requirements. From the non-functional
side, one of the very... good to know or important to know things is, it is a very
read heavy platform. So if let's say one user is posting something that is seen
by a lot of users, right. So for each write that is happening into a system
there are a lot of reads that is happening. Statistically speaking I don't
know how much correct this number is but I have read it somewhere that Twitter
has 100 times more read traffic compared to the write traffic. So that is one of the very first NFRs(Non Functional Requirement) that the system should be able to support that kind of access patterns. Now these are the list of NFRs that we'll
be looking at. The next thing is it should be able to render very fast. So if
somebody wants to look at their home screen or basically timeline kind of a
thing, that should render in less than a second. The reason being to basically improve the user experience. Now when you are
tweeting something again that flow should be fast. So you should get a success
response saying that your tweet has been posted successfully. So basically all
these both of these two translates into and that the system should be having a
very low latency and at the same time it should be always available, so this
system can not go down. But in some cases lag is okay. So when we say lag it does
not mean that the page will take seconds to load. What it means is that if
somebody has posted a tweet, I might be able to see it after 20 seconds, so that
is okay, If I am seeing a content later. But whenever I am seeing it, it is
rendering very fast. So that's how we want the site to load, okay. Now let's
look at some scale numbers. these These are probably real Twitter numbers, but I
am not sure how correct they are. I just read it somewhere, so I am quoting that. So Twitter has roughly 150 Million Daily Active Users(DAU). What this means is 150 million users access Twitter daily on the reader path at least. Some of these would be writing as well but most of them would be reading. And Twitter has roughly 350 Million Monthly Active Users(MAU). Again 350 Unique Users access Twitter on a monthly basis. Overall Twitter has roughly... 1.5 Billion User Accounts. These could be accounts of people or
organizations or anybody right it would probably also include a lot of fake
accounts from a tweet scales perspective Twitter has roughly 500 Million Tweets coming into the system per day. that is a very very massive number. what that translates into is there are roughly 5700 Tweets coming into the system every second, on an average. at peak load this number increases to 12,000 Tweets per second. So now let's try to look at how do we design a system
which can scale up to these numbers and maybe even more. First let's classify all
our users into some categories. We will be having 5 categories in which we will
divide all the users and then we will handle each category of users in a
slightly different way. So the very first category something called as
Famous Users. Now these are the people which have huge number of followers on
Twitter. These could be people like politicians, these could be celebrities,
sports persons, or CXOs of some companies. We will come to what different we
will do later on why we are designing the system but I just want to
classify the list of users to start with. The next set of users are the active
users. Now the definition of active for a platform like Twitter can change over
time but the main idea here is people who are accessing Twitter in
last couple of days or a couple of hours are classified as active users. In all of our discussion will assume that people who have access Twitter in
the last 3 days are active users. I believe in the real implementation of
Twitter they consider people who have accessed the system in last 30 days as
active, but I am again not too sure of that. Now the next category of users is something on Live Users. Now these are
the subset of active users ok and these are the people who are actually
accessing the platform right now. Something like the online feature of
Facebook or any other platform. Now these users, we will be interacting with
them in a slightly more... slightly different way, so as to improve their
experience. And as soon as a person goes offline, they are moved back to active status. Passive users are the people
who are not in any of these categories but are having active accounts, okay. These
are the people who have not accessed Twitter in the last three days
and are not famous. Inactive Users are basically the deleted accounts you
can say. We don't delete really any users we do a soft delete, so that's another kind
of user. We don't really do anything for them to be honest. Let's look at an
overall architecture of the whole system Now this whole system is fairly big and
there are a lot of components and it will become too cluttered if I like
kind of put that whole thing at once So what I have done is I have divided it
into three components. The very first is a user onboarding flow, 
on how do they come into the system. The next section would be the Tweeting
flow which talks about how do they post a Tweet, and how do they get the various
screens that they have access to -=like their home screen, their users screen and all of
that. And the next section will talk about search and a bit of analytics that
we want to do. So and also one thing I want to call out, so whenever you
are designing a read heavy system, so in this case this has 100X more
reads than the number of writes that are happening. So whenever you design such a
read heavy system you need to kind of make sure that as much as possible you need to
either precompute information or cache some of the information. So a lot of
things that we'll go over a would require a kind of a caching implementation
somewhere, so just keep a note of that and whenever you try to come up with
your own design, just make sure you have enough caching in place to make sure the
latencies are well in control.  And a bit of convention to start with before we start So everything in green is basically a
user interaction point, it would be a UI that we give out to users through which they
interact, a browser or a mobile app could be anything. The things in black are
basically Load Balancers and along with load balancing the take care of being a
reverse proxy and authentication authorization layer in between so that
they can authenticate all the API calls coming from outside system into our
system. The things in blue that you see here are the rest services or the web
services or the Kafka consumers that we've written by our own. The things
that are in red are either some clusters some databases or some open source tools
that you've used. So with that let's start
the very first user interaction, which is basically their onboarding process. 
When they come in and register themselves on our platform. So there's something called
User Service which is basically the source of truth of all the user related
information in our system. And that User Service will power the login flow, the
registered flow, the user profile screen and all a lot of things, okay. That User
Service will also power a lot of internal tools and APIs required for
serving internal tools. So for example if some other service wants to get
information about a particular user, they might want to query User Service.  Now as
far as the APIs are concerned this has a.. set of GET APIs to get by a particular userID, to get by emailID, and all of that. It'll have some post
APIs to update the details of a particular user and it will also have a
very important, bulk get API. So whenever somebody wants to fetch the
information of a lot of users, so for example if there is a screen, on which
you see the followers of a particular user, so there will be lot of followers,
right. So instead of calling this User Service one by one for each user to
display their name, their email ID, their photo and all of that, we could very well
make a call with probably 20-30-40 user IDs in request and information
about all of them coming at once in the response to save up on the network
bandwidth, right. So that is User Service. Now User Service sits on top of a
clustered MySQL Database. Now this user information is a very much
relational information. From a scale standpoint it has millions of users, but
they are still finite enough and it will not go unboundedly. Plus logically it is
a very relational model, so it makes sense to use a MySQL here. And
we'll be doing certain optimizations on this MySQL, so this user information
is a data which doesn't change too frequently, right. So once the user comes
in and gives their information to us very rarely would it happen that they
update some information right. So this is more of a Write heavy system and
a bit of reads do happen on it, but reads are mostly powered by a Redis cache that
I have put in place. So what happens is Redis cache is basically a image of a User
Database and which has a key of user ID so whenever somebody hits User
Service to fetch details of a particular user it first tries to look up in Redis
that do I have information about that user or not? - if it has, it returns from then and
there. If it does not have information in Redis, then it will query one of the read
slaves of this User Database, get the information, store it in Redis, and
respond back to the client. So when the subsequent requests come for the same
users they can be served out of this Redis cache, okay. Now we have a lot of
information that is stored in Redis Here is a list of all the things, we'll
go over them one by one as and when we get to those components. So user details
is the is one of the things that we talked about. In all of these information
the Key is a userID and Value is some object of this type. Coming to the
next interaction, which is the User Follow process. So any particular user of
this platform can go to someone else's profile and then follow them, right. They
might also want to get certain information about the following process like they
want to know who do I follow or how many user follow me. All of those
things are basically this piece of interaction which is powered by
something called Graph Service, okay. The reason it's called Graph Service is
because it creates a network of how everybody in the ecosystem is connected.
Again Graph Service has a lot of APIs basically first of all to add a new
follow link. It will also have API to get all the followers of a person and
get all the people who this person is following, right. It will also have some
bulk API is very similar to User Service which will be get all the
followers of a list of users or get a list of list of users of a list of users
who are being followed right a bit complicated but let's go over how
that is kind of implemented. At the crux of it is basically sits on top of
another MySQL Database. Now these are two different MySQL clusters on
which this data would be residing. This would be a fairly larger data, so we
will have to probably look at sharding that data. But at the very core of it
think of it like a logically one table which has a userID, a followerID and a
timestamp on which the transactions happened, there will be a
lot of other attributes but logically there will be these two columns userID
and a followerID, right. Now again this is a data which does not get updated
very frequently. Overall at a larger layer across all the 150 million active
users per day, this would be updated but for one user it wouldn't get updated too
frequently because if you look at yourself, how frequently do you go and
follow somebody? - does not happen every minute or every hour right! So that is
the reason it makes sense to cache this information as well. Now there are two
kinds of information that we need to cache here. First of all given a userID what
are the list of users that this person follows which is basically this
following thing and then given this userID who are the list of users that follow
this particular user, which is basically the followers of this user, right. So these
are another set of two information that we are storing in another Redis, or in
fact we could use the same Redis here. because it's anyway a clustered Redis.
Again similar to User Service all the APIs that come to Graph Service first try to
get from Redis, if they don't find information, they query the MySQL, then
they persist into Redis and respond back to the user. So these were the user flows there's another thing which we need to talk about. So whenever a user is interacting with
Twitter right, they're sending certain signals even if they are not
explicit. So let's say if they are browsing through a list of tweets that
they go through, and let's say if they spend a lot of time on one of the tweets,
they are kind of telling that they have interest in this tweet, right.
There could be a lot of other information that we can gather based on the way
people access the whole platform, right. So whenever we find some event of
importance that is happening on the UI this UI could be a browser, could be an
app, anything. We do send an event saying something happend
just track it and then we can use it for analytics. So all of such events would be
sent through this Load Balancer to a service called an Analytics Service, which
we'll be putting into a Kafka. What happens to that we'll probably look at
in subsequent sections. Coming to the last service in this so remember the user grouping that we created of Famous users, active users, live users, passive users, and all of that, there was something on Live Users. These are the users who are using our platform right now, okay. So, let's say if I'm using Twitter right now and one of the people who I follow posted something. It would make sense to
just so that I don't have to open the app, refresh, or do something, if it just
somehow comes to my phone right? or let's say somebody is tagged me in a tweet and
if I get notified about that. That would be a nice user experience. So that is done through the service, okay. What the service does is it basically keeps a (WebSocket) connection open with all the live users okay and whenever any event happens that needs to be sent to this user it happens via that WebSocket, right. Now how does this come into play, we'll look at in the other sections in more detail, but for now this information is good enough, okay. Now along with this there is some other information that we are capturing as part of the interactions between the
user and the server right. We are basically capturing till how much time the
user is actually live. And when this communication between the two parties
stop, we do realize that the person has gone away, close the app, close the
browser, the person is not live anymore All of that information is also of important to us because now... if the person is not live we cannot send them this kind of a notification. We need to do something different, right. So that information also needs to be stored somewhere. So that information will be put into Kafka saying the user is not live anymore, he was last live at a
particular time stamp. That information would go through all the way to User
Service. It will store it in the cache saying the user type has now moved from
a live user, to active user. His last access time was some particular timestamp and then other systems can use that
information to modify the behavior in certain cases. Now let's try to look
at what happens when somebody posts a Tweet. Which means adding a new Tweet.
First of all Tweets could contain text, it could contain images, it could contain
videos also possibly, okay. So let's just say if it's a image or a video content,
we will have something called an Asset Service. What that does is it is
responsible for all the multimedia content, which could be videos, images,
anything of that sort. It takes care of uploading it to wherever it needs to and
even when somebody needs to see it this is responsible for displaying the
content, okay. If you want to get into details of how Assets Service is built, I
would recommend... so I have already made a video on the design of Netflix and
Amazon Prime, basically Video Hosting Platform So Asset Service is basically our
video hosting platform here, okay. So I would recommend to watch that video
instead of going over the nitty gritties here. But assuming we have a platform
which takes care of all the images and videos and all of that, now we are just
left with a tweet, which can have a text and a couple of links(URLs), okay. Now a link
whenever we talk about a link even if you if somebody wants to place a link in
the text of a Tweet... Tweet has a constraint of 140 characters, so you anyway cannot paste a big text there, right. So first of all what you need is a
URL shortener, okay. So whenever you want to post a big URL, there will be a URL
shortener, which will give you a short URL instead of the big URL and you could
post that. Assume that can be taken care of in UI automatically, and for the back
end of it will have a Short URL Service. So I do have another video on the design
of tinyURL, just think of it as a tinyURL system. And details of this
Short URL Service can be looked up on that video. Now assuming we have these
two components, all we now have to handle is basically storing a
text of a Tweet, and retrieving it when we need to, right. So all of that
functionality goes within the Tweet Ingestion Service, okay. So each time a
person posts a Tweet, basically types a text, hits the submit button, that basically
makes a call to this Tweet Ingestion Service. Which first of all, the very
first thing it does is - stores it in a permanent Datastore. We are using a
Cassandra for storing the Tweets. Now why Cassandra? because we have a massive amount of data First of all we have millions of
tweets per day and there are.. and Cassandra can easily handle that scale. Now other
than Cassandra we could have possibly used HBase also here, both Cassandra and
HBase are equally competent enough to handles the data of this scale and for the
use case and the kind of queries we have. Both have a bit of pros and cons. I chose to use a Cassandra because the set up of Cassandra is fairly easy. If you want to
set up Hbase, we will require the zookeeper, a Hadoop cluster, and that adds a
lot of maintenance, okay. Now assuming Cassandra is our data store, think of it
very logically speaking, think of it as having a table, which has... a Tweet
table, which has a tweetID, a userID, who posted the tweet and a Tweet content,
and a couple of other attributes okay. So this is how the structure would look
like. Now Tweet Ingesting Service is just responsible for posting a tweet. It
doesn't provide a get API and all of that. Once it has posted to Cassandra, what
it does is, it puts a event into Kafka saying I have got a new tweet whose
TweetID so-and-so, whatever the ID is which is auto-generated by this service,
it has been posted by this userID and this is the content. Whoever needs to do
whatever, go to the job, right. So this Tweet Injection Service puts this message
into this Kafka and the flow of Tweet Injection is over. So this is how we have
saved the Tweet. Now let's get to other side of things. But first we'll
go over a couple of components that we have built to... a couple of platform
components. So there is this Tweet Service that I have. This is basically a source of truth service for all the Tweets. So this basically sits
on top of this Cassandra cluster and owns the schema, and the data within that.
This Tweet Service will provide you all set of APIs that you need to
display any Tweet. So get by tweetID get tweets of a User, all those kind of APIs are provided by this Tweet Service and whenever somebody's timeline need to be
generated, that is also powered by this Tweet Service, okay. Now for a second
quickly jumping on the user side of things and then we'll get back to how
the flow works. So when somebody wants to look at the tweets okay, on the read flow,
there are two kind of views that a person can have, okay. One is called a
User Timeline, which is basically a... timeline is basically a series of Tweets,
ordered by something generally by timestamps, okay. Now User timeline is
basically your own timeline. This basically contains all the tweets, all
the retweets, that you have posted. Then there is something called Home
Timeline. Home timeline is what you see on your home page. So all the people
that you are following, all their tweets will show up in your Home Timeline, okay.
So generally a very logically speaking construction of user timeline is
basically a SELECT(*) from tweets on Cassandra WHERE userID = 'your userID',  and
construction of home timeline is logically a SELECT(*) from tweets in Cassandra
WHERE userID in [all the people you follow] Now these list of people
that you follow could possibly be thousands of people, right so... and making
this query at runtime would end up.. it will be something like first of all fetch a user's followers.. like all the people that a user follows, and once you have
that list of people get all the tweets and then arrange that. That would
be a very okay enough naive implementation but that would not scale
at you know at a scale where we have 150 million users accessing our website daily,
and that too hitting this API call multiple times in a day, right. We will
have to have a... That'll slow down things a lot, if we start
querying Cassandra for each thing and it'll just not be scalable enough. Instead what
we are trying to do here is we'll cache the user's timeline. We'll say that we know there
are some active users who will come website. Instead of calculating at
runtime we precalculate all of their timelines and just show it to them then and there. Remember the NFRs(non-functional requirements)
that we have. Whenever a person comes on the home screen, they should be able to
see their timeline very very quickly. So that's the approach we are
trying to follow. So remember now whoever tweet... whenever people are tweeting
something which is going to a Kafka, now there is a Tweet Processor. What that
Tweet Processor does is it basically sees that ok user1 has tweeted something,
now let me try to get their followers, okay. and let's say it figures out that there are
some users whose timeline needs to be updated, because this tweet will now show
up in all of those user's timelines. Then it will create the timeline
for all of those users and put it in this cache. So now when those users try
to come on their home screen they just do a cache look up and there view is sorted.
So if I just have to list down the things, it basically is something like
let's say user "u1", posted a tweet "t1" and user "u1" is followed by let's say "u2" "u3" and "u4". So what this does is it basically in the timeline of user "u2", "u3", "u4", it puts tweet "t1". Along with what all other tweets it had, right. So each of their timelines could have a lot of tweets this now is appended and at the very beginning. Similarly whenever... similarly there
are a lot of users posting tweets, so a lot... all the tweets are coming here, this
service is identifying all the followers and whole of that mapping and then updating all of the people's timelines. So this is basically how we are
trying to do. Now this service needs to get basically a list of all the
people who are being followed right, so for that it will query the Graph Service. I have not made the link but Tweet  Processor will query the Graph Service to figure out all the users basically this "u1" to this "u2" "u3" "u4" mapping. This will be queried from Graph Service. All good till now, but there
are a lot of problems in this design. The problems are, because we are maintaining
everything in Redis, Redis first of all is an in-memory solution. So it'll put all
the data in memory. What that means is we need to have massive amounts of RAM, okay.
Now if we try to keep timelines of all the users in memory, that's something
very inefficient. That's the reason I kind of categorize the users in the very beginning. So only those users timelines would be stored in Redis who are active. If a user is passive, we kind of know
that the user will not come on Twitter for a while, so why bother to create the
timeline, right. We will see at the time and when the user logs in. Now that is one side of the problem, so if we kind of just list down what happens for each user, for all the active users all the data in Redis. Now what happens if a
passive user comes in. How does that passive user see their timeline? - so in that scenario all the requests for this timeline will come to Timeline
Service the flow is that these are the UIs through which the users will
request, those requests will come to Timeline Service. Timeline Service queries Redis for all the active users. It is easily able to figure out who are active users by querying User Service. which anywhere has a user to type mapping in its own cache remember the previous section. Now once Timeline Service figures out that the user is a passive user and I do not have its data in Redis what it will do is, it will essentially query whoever it needs to in the system try to figure out all the data that it needs to figure out, and then it creates the timeline. So what it does is essentially it first of all queries Graph Service saying that I have got this new user whose timeline I need to create. Give me all the users who this user follows. So it gets a list of users whose tweets would now be shown. Then it queries that Tweet Service to give all the tweets of all
of the users. Obviously it will not be all the tweets, it'll be some tweets till
some time in the future and then it can be a paginated kind of a thing, right.
Once it gets all the tweets of all those users, it now arranges them as per timeline...
as per the timestamps, stores it back in the Redis, and returns to the UI. So now we have a solution to handle active users, passive users. Now once
active and passive users are handed we could do some kind of optimizations for
the live users. Remember Live users are the users who are online right now, okay.
Now those users are anyway sitting on the Twitter app, they don't need to
really follow all of this process. What we could do is, we anyway... the Tweet
Processor anyway knows that who all's timelines have to be updated, right.
And all the tweets are anyway coming to this Kafka and we also know that who
are the live users, okay. Once we figure out that... Once the Tweet Processor
figures out that a particular users timeline is to be updated and if
it figures out it's a live user, it actually puts back an event into Kafka,
and then comes the live WebSocket thing that we talked about in the previous
section. At that point in time it was just used to check if a user is live,
but this thing can actually send a notification to the app, right. Now again
reiterating over the flow. An event comes to Kafka, Tweet Processor tries to update Redis. But while updating Redis it will also get to know that this user is a live user. So it will put back an event into Kafka, saying whoever is
responsible for sending this notification down to the user, go send right away. Don't wait for the person to query back, right.
Through this route, it will come to the user app and the UX should be able to
handle it saying you have more tweets and just scroll up or scroll down and
something of that sort. So now even live users, they don't need to ever even query
Redis, right. While they are on the app, they will keep getting those notifications and
newer tweets will just keep showing on their UI. Cool! But this still
has a lot of problems. So as of now if I look at Donald Trump, he has roughly
75 Million followers. What that means is each time Donald Trump makes a
tweet, there needs to be 75 million updates For each of his tweets. Now that's
a lot of ... that's a very big number! And that's fairly inefficient if we
start updating 75 million records on the update of one person, right, and if he
starts tweeting very very frequently then we are in for big trouble.
So instead what we could do is remember now we have something called
Famous users. Those are the people who have big number of subscribers or big number
of followers, right. We will not do any of this things for the... for those kind of
users(Famous Users). What essentially would happen is Timeline Service will take care of merging everything. So Timeline Service knows that Redis has data only of tweets of normal users, okay. So once it gets the data of all the users, it now tries to
figure out that what are the tweets that should be shown to this user of famous users. So Timeline Service, then basically queries Graph Service again and tries to figure out who are the famous users
that this person was following and get their tweets as well. Now Timeline Service, after querying from Graph Service, through Tweet Service has all
the tweets of a person like Donald Trump. Timeline Service also has the tweets of normal
users and it can show it the UI. but before showing it to the UI, 
it can update in Redis. It can update in Redis, saying
that I have not just captured the regular Users, I have also captured the famous users and not... it will also add a flag
saying that I have updated the data in this particular user's timeline of famous users at a particular timestamp. Ok! So now what data structure it stores is something like a list of tweets plus a time stamp T(i). OK! Now the next time we get a request from the same user, we basically see... this Timeline service looks at this time stamp. If this time stamp was probably 5-10 minutes before, then it can again query the tweets of some famous users from Tweet service.  Because those could have again tweeted in the last 5 - 10 minutes. Right! But, if this timestamp is just 5 seconds in the past, we can safely assume that there is no new tweet and just return from this Redis directly without querying the Tweet service and then the Cassandra and all of that. Ok!  So famous users, we'll follow, we'll kind of handle in a slightly different way just because if we try to handle it in a normal way, it is going to put up a lot of load on various components in the picture. Now, the only thing left is inactive users. So those are user accounts that are anyway deactivated. So, those users don't really login. They can't even login because those are deactivated accounts. So, we don't need to do any of these things for those kind of users. Ok! But now coming to, again coming to the famous users Now there could be certain users who are famous, who follow some other famous user. Right! So let's say a Donald Trump is following Elon Musk for example. Right! And both have millions of followers. So, what we could do is neither of the tweets will follow So both of their tweets will not go the Redis route normally but if Elon Musk tweets then Donald Trump should get notified at least. At least the famous users within themselves should get to know of each user. Right! So those kind of things could be handled by Tweet Processor that whenever a tweet of a famous user comes in, don't update the cache of all the users but just update the cache of other famous users that are following this user. Right! So those are some nitty gritties that can be handled depending upon the, depending upon how is it that you are trying to build the system. Right! But in general, this is something that should work out fairly fine. Ok! Now what could potentially be the bottlenecks here? This Cassandra could be a bottleneck. Why?  Bcoz there are a lot of times when we are querying this. This Redis is definitely a piece that needs to scale up. Why? Bcoz this is something totally in RAM.  So we need to take care of these couple of components. And then Kafka of course! So these three components are something that we need to really look at and optimise as much as we can and also make sure that we have enough... So at least on Redis and all we should have enough TTL so that we don't keep really old junk data. So clean up and all should be taken care of on these components. Other than that, everything that you see here is, even these  components that you see here - Redis, Cassandra, Kafka - everything is horizontally scalable. So, as and when the number of tweets in the system increases, all we need to do is add more machines into each of these components and then things should kind of work just fine.
Now coming to the last part which is Search and Analytics.
Let's first look at how does Search work. So, by search, what we mean is, if somebody wants to search for a particular text we want to show them all the tweets that have that particular string in that, ordered by some relevance score. Ok! So let's look at how is that, how could that be built. So, remember the Tweet Ingestion service that we talked about in the previous section, which was basically the entry point of all the tweets into our  system and it used to put a event into Kafka, which was read by a service for putting into Redis. Right! Now there could be a lot of other consumers who are consuming the same data. Ok! One of such consumers is a Search Consumer. What that does is - it basically looks at all the tweets, basically consumes all the tweets that are coming into the system and stores it into a database. Ok! which is then used for searching and it uses a database called Elasticsearch which is clustered NoSQL database very efficient for text - based searching. Now why Elastic Search? so the requirement here is we need to do a text identification first of all and a relevance. Right! So we need to first of all identify all the tweets which have a particular search string that the user has mentioned. And out of all the tweets which have that particular sub string, now, rank them in order of relevance. Now there are various implementations to it. A very basic implementation is something called tf - idf which is Term Frequency -  Inverse Document Frequency which basically tries to look at how many times a particular word has come in a document and... against all other words and then tries to rank it accordingly. Ok! Now Elasticsearch uses Lucene to power all of those kind of things. So any Lucene based database would work just fine. Ok! Now once Search Consumer processes all the data and stores it into Elasticsearch, it is basically ready for search. Ok! Now coming to the user side of things. A user can then basically give a search string as an input which would come through this Search UI, it would talk to a Load Balancer (LB) and talk to this Search service. Ok! This Search service would then query Elasticsearch, get the results and give it back to the users. Ok! So this is how we complete the loop. Search service and Search Consumer are very well aware of the contract. So, Consumer is basically writing and Search service is reading from the data store. Cool! Now, if we go over the Non - Functional Requirements (NFRs) that we talked of, we talked of something that there is some lag is okay in some of the use cases. Right! So, let's say if I posted a tweet and let's say if you are searching for something, if you do not get my tweet, it doesn't really matter too much. Right! Or may be you get that tweet 5 minutes later,  that is also fine. So what we can.. okay and that is the functional side of things. The way search works is - let's say some event happens in the world, people start searching for it, a lot of people start searching for it together. Right! And then slowly after a while, that whole thing dies out and then nobody keeps searching for that word. Right! So, with this assumption, what we can say is -  if something is searched for, it is possible that somebody else would also search for the same thing. Right! Now we don't have to compute the search results again and again. Because the moment we start querying Elasticsearch again, it would have some kind of caching but it will not, it will still try to actually make a full search and return the latest set of data also. Now we can live without latest set of data. So what we'll do is - once the Search service gets us a set of results from Elasticsearch, it will put it in the Redis. Ok! And it will put it in the Redis with a Time To Live (TTL) of let's say 2-3 minutes. So what we
are saying is till 2-3 minutes, we'll have that search result and after that it will expire. And now, instead of querying Elasticsearch,  Search service, when it gets a request, it will first query Redis, if it gets a result, well and good. It will return then and there. If it does not get a result, it will then query Elasticsearch, get the search results, store it in Redis and then respond back. So, this says by adding Redis, we will effectively reduce a lot of load on Elasticsearch and which includes the computation cost and which kind of translates into money because the more the number of queries we have to do, the more hardware will be required and effectively Redis would be much cheaper option here. Cool! So this is about Search. Now, let's look at some of the Analytics that can be done on top of this data. Again going back to the same
Kafka where in a series of tweets were coming. One very common feature of Twitter that you see, is something called what is
trending right now. And it's not just Twitter, any thing... in any such kind of
platform you would want to know what people are talking about, right!
What we could easily do is, on top of this Kafka, have a very simple Spark
Streaming Consumer running which basically just checks for - what were the most common keywords in last one hour. 
Now it need not be just the hashtags. What it could do is - let's say there is a Tweet,
with a lot of words. It basically tokenizes the Tweet, basically splits each
string of Tweet, by space character and it'll get a list of words. And then it will
dump all of that list of words somewhere and then aggregate over last one hour to
try to come up with the words that were use the maximum. Now very likely
these will be very common words like "a", "and", "the", "is", "of", so it can remove some of
these stop-words, and then come up with a relevant set of words which are actually
something that people are talking about. That can be, basically used to
power the trending kind of a features So even though we didn't talk about it as
part of functional requirements but this will be a good thing as an analytics. So what we could do is have a Trend Service, which Spark Streaming will write to every let's say half an hour. It looks at last one hour of data, and dumps in what all are the trending things right now, okay. And there could be a Trends UI, which can be build on top of this Service and it kind of powers that UI. As a storage we don't need this to be a permanently... we don't need a database for it because this is anyway temporary information. We could again use a Redis for storing it. As a cache because, it'll anyway again in the next half an hour Spark Streaming will again give a list of trending words to this Service again. 
Now we've used a lot of Redis here, so even though it's an in-memory data store, kind
of a thing, but it does have the option to store it to disk. So if let's say
there's an outage and there is a downtime and the... some of the
machines in the cluster go down. You still have data persisted on... on
the on the desk, sorry. So it's not very you know... it is a bit fault tolerant as well. Coming to the next set of things. This... and by the way, this Trends ... right now we just talked about trends in general. These trends would also be
calculated at a geographical level saying what are people from India
talking about or what are people from let's say France talking
about or any such thing, okay. Now let's say all the Tweets that we have, we might
as well put it into a Hadoop cluster for... because in a company of Twitter scale,
there will be lot of analytics done. Something similar to trends is one
of the options. There could be other lot of analytics right, something like who is
right now the most engaging Twitter user, or which is a person whose Tweets have been re-tweeted the most? or stuff like that. All of those could be
answered by various kinds of queries which can be powered by Hadoop. Not just by
Hadoop, but tools on top of that, okay. Now a very common use case could be
something like the newsletter that a lot of these companies send. Twitter also
sends that, there are a lot of companies which send weekly newsletter about
various things. It could be things around business, it could be things about
some new promotions that they are launching right, so all of those
promotional content could be powered it. Let's look at an example. So let's
just say we have a weekly cron job which basically is responsible to pull back
all the passive users. So passive users are the ones who are not using the
platform frequently and it is good for Twitter if they start using it, right.
So to engage those users, Twitter could start a weekly email which talks about
some of the very.. you know popular tweets in the last one week, right. Now those
popular tweets if it's just one list, it would not make... it would not be
personalized and it will not make sense to a lot of people. So what could be done
is a nice ML kind of a thing there, saying for which passive user, what are
the most relevant tweets in the last seven days, that this person would be
interested in. Get the list of let's say top five tweets and send them a
notification right, saying these are the tweets that you have missed, why
don't you come on the platform. So this could be used as a re-engagement kind
of a platform. There could be a lot of other things that could be done on this. Now
how would that notification be sent? - There would be a
Notification Service that will be invoked, saying this is the user, these are
the tweets, go send the content. The notification service can talk to the
User Service, to get the emailID, phone number and stuff like that. It can then
find the user's communication preference from it's own Datastore, and then send
out a notification whether it's the email or SMS or maybe in-app notification,
whatever that is. So I've done another video specifically
on how to build a very scalable Notification Service. So if you want to
get into details of that - you might as well have a look at that video. But
overall this is something that would work out just fine for a Twitter kind of a system. Now at Twitter scale, all of these things are good but let's just say that you know the
scale increases five times or let's just say instead of Twitter, it's a Facebook. Now
how do you design that. So there are a lot of things that will need to get changed. Why? - because a lot of things here, we are
doing it in memory. If the scale increases five times, then it becomes a
lot difficult to do all of that in memory. So all of those things I will be
covering in an another video, in which we'll be talking about how to design Facebook.
So yeah I think for Twitter I think this should be  it.

---

## 13. Netflix System Design | YouTube System Design | System Design Interview Question
**Channel:** CodeKarle | **Views:** 211K | **Date:** 5 years ago | **Duration:** 1:04:49 | **ID:** lYoSd2WCJTo
**Link:** https://youtube.com/watch?v=lYoSd2WCJTo

### Transcript:
Hello everyone, myself Sandeep from CodeKarle.
In this video will be looking at one of the most common interview problems being asked in product
companies these days, which is how do you build a video streaming platform, something very similar
to a Netflix or YouTube, Amazon Prime, Hotstar, anything of that sort. So now let's look at some of the functional
and non-functional requirements that we want this platform to support. So the very first thing is people should be
able to come up and upload video. Now, those people could be individuals like
you and me, or it could be production houses who are uploading their movie and songs and all of that. But all of those people should be able to
upload video. Now as a convention, we will be calling all
such people who are uploading videos as production houses throughout this video. Now users, once they come onto our platform, they would
have a homepage on which they would see some most viewed videos So they should be able to see that homepage
with some of the recommendations. And then they should be able to search for
a particular video, any movie or anything that they want to search for. Now once to see the search
results, They should be able to play one of the videos,
whatever they want. So search and play is one of the features. Now, the thing is, the users could come from
a wide variety of devices, could be laptops, could be mobile phones, could be wearable devices
like smartwatches and all of that. So our platform should be able to support
all of such devices that are... on which it is possible to play a video. Now, looking at some of the non-functional
requirements, the very first thing that is utmost important for any video platform is there should be
no buffering at all. Now, that sounds a bit ambitious, but at least
we'll try to minimize the buffering as much as possible. Now what do we mean by no buffering? So what it means is the video should be available
when the device needs to play, which means that the server which is serving the video
should be responding in very low latency and should be always available. So no buffering actually translates to low
latency Plus high availability. The next non-functional requirement is to
increase the user session time. Now, there could be a lot of reasons why the
users session time is high or low. So if the platform is not built in a nice
way and there's a lot of lags or a lot of buffering, people would not like
it and will drop off. So, again, low latency, high availability
becomes one of the solutions towards this particular NFR. What else could be? Maybe you don't have a good content. So if the content is bad, people would not
come on the platform. But let's keep content outside of the scope
of this video. Other than that, it could be that you do have
good content, but you are not showing the right content to the right person. Which internally translates
to having a reasonably good recommendation to start with and then improvising it over time. So then, kind of a good recommendation engine
is one of the other outcomes of the non-functional requirements that we have here. Now, we have talked about a small requirement
that we've actually missed. So when we say all of the devices...
all devices should be supported, that's actually a very big requirement, that we have not looked at in
depth. So all of these devices, like your browser,
your mobile phones with different kinds of phones, you have windows, phones or Android phones or IOS phones. And then there are smartwatches and there
are a huge variety of devices that can play video. All of these devices, support some of the
formats, not all devices will support all of the video
format And there are some formats which are specific
to some kinds of devices. Now supporting all devices, essentially means that we need to support
all of the formats. So if we just kind of list down some of the
devices, let's say that there are a bunch of devices
that we have, this translates into some formats that we need
to support. So there are these many number of formats
that will have to support. Now there are a wide variety of devices again. So each format should be possibly be running
on a wide variety of devices. There could be phones with multiple aspect
ratios and the screen dimensions are different on
a TV and on a phone. So there are lot of dimensions and aspect
ratios that are come in. And all of the formats and dimensions should
co-exist. So then for each format, you have a lot of
dimensions. So this kind of translates into the amount
of pixels we have. So the 1080p and 720p kind of translates somewhat
into this Now this clubbed with all of the kinds of
networks that people are coming in. So if you are building a global platform,
then people could come in from a wide variety of regions which have different bandwidth. Somebody could be coming from a high bandwidth
region. Somebody could be coming from a modrate one. Somebody could be coming from an extremely
low bandwidth region. So you have types of bandwidth that you want
to support. Now, a video has a lot of things, right? So, the number of pixels are just one part
of it. Then there's something called frames per second,
there's something called the bitrate of audio. All of those things can be increased or decreased
to reduce the file size. And that translates into the reduction in
the bandwidth requirement. So there could be all combinations of that....
all combinations of those attributes that you could put in the video to have various formats or various
versions of the video with different bandwidth requirements. So you have a lot of versions of bandwidth
to support. Now, let's just say that there are "I" formats,
there are "J" dimensions, and there are "K" bandwidth options. So you have ( i * j * k ) number of types
of users, which, by the way, could be a very big number. We have different many types of use cases
and users to handle. Now we'll look at how do we, you know, easily
handle all of these users in a generic way. So as to make sure that even if a new kind
of file format comes in. So it's easy enough for us to handle. Coming to the users of this platform,
there are three consumers who will be using this platform. There's the client, there's the user and then
there's the production house. We'll go over each of them. So client is basically a device. It could be your laptop or it could be your
mobile phone, It could be your smartwatch or it could be any device that has a video playing
functionality(capability). And the software that runs within the client
would be intelligent enough to do certain things. And that's the reason clients becomes an important
aspect to this whole solution. the second one is the user who is actually
viewing the content on the clients. So let say I'm viewing the video on your platform
through a mobile phone. So my mobile phone becomes the client, I become
the user. (User: This is a human being) The third one is the production house which
we looked at earlier. These are the users who will be uploading
video on to our platform, but not to confuse within various kinds of
users, we'll call them all production houses, these
need not be real productional houses, it could be individuals
as well. Now, let's look at how a clients work. So
in this video, remember client is basically any device that
we are using to play a video, so in this... in this
example, we have a laptop and a mobile phone both are playings some video.
Now, if you noticed any of these platform, they don't download the whole file to your device and then start playing. They
basically request a chunk of the video, play that, And while that chunk is being played, the
client request for the further chunks, and subsequently each chunk comes in that gets played and next chunks are in transit
from the server to the client. So that's how it normally works. Now, in this example, a part of video is played
and some chunks are coming. Now a client has a very important functionality it's basically first tries to figure out what
device am I on and what file format can it support. Now let's say our device supports multiple
formats, It will probably request for one of them based
on some logic that sits within the client, could be based on best quality or whatever. Now, let's say it requests for a high definition
variant of that file format and first chunk get received on the client and it starts playing video. Now, let's see if the client somehow realizes
that the subsequent chunks are not coming well in time. Let's say the second and third and fourth
chunks are coming very slowly. It has not received them and it figures out
that it will not be able to get that chunks Well in time, it basically request for a low
quality version of that chunk. So let's say if you're playing 1080p video,
it'll probably a request for a 480p video now. What this does is it basically tries to at-run-time,
figure out how much bandwidth I have and basis that tries to adjust the quality of the video. Now let's say it plays a couple of seconds
of video on 480P and then it somehow realizes that I have a lot of chunks of a 480P now, and then I
can use a high definition variant of the video or download a High-Definition variant of a video. So then the next chunk that it request it
requested on a high quality, so let's say it again moves back to 1080p And then rest of the video, for example, plays
in 1080p So this thing is called Adaptive Bitrate Streaming. Now there are libraries to kind of build the
functionality, but most of these clients, which are applications that run on your TV and your phones and all
the places they have this kind of a logic built in to be able to improve the user experience because
it's always good to play a high quality version, but not at the cost of buffering. So as much as possible, all these clients
try to maximize the quality as much as possible. But when they realize that they are not able
to get enough bandwidth, the move to a low quality version. So this is all about the Adaptive Bitrate
Streaming and client is mainly just this. It mainly takes care of how which files type
to request and how to play the content. Now let's look at the overall architecture
of the whole system. But there are a lot of components in this
video streaming application. So if I try to put all of them on the whiteboard
at once, it'll become a bit too cluttered and overwhelming. So what I've done is we look at all the components
one by one in a sequential manner and post watching this video, you can look at the overall architectural
diagram. I put a link of that overall architectural
diagram in the description, so you can go and have
a look at that. So now let's look at the overall architecture
of the whole system. We will first start with the set of services
that are powering all the tools that are given to the production
houses. And then we look at the other set of systems.
A bit of a convention to start with: Everything in blue, are the services that we have written These could be Web services, Kafka consumers,
anything that we have build on our own. Everything in red is either a data store or a database or a cluster or something open
source that we have consumed. Everything in green is end consumers. In this case, it happens to be a UI that is
given out to the production houses for uploading and managing the content. Everything in black
would be load balancer. It is said that load balancer, but it is a
load balancer plus an authentication and authorization layer in between, which authenticates all the API calls that are coming from the outside
world into our system. So that being said, let's look at how the
business flow works. So the very first step of the whole flow is:
Somebody coming into this "UI" and uploading a content. Now, there are multiple ways in which the
content can be uploaded. For a small video, there could be upload button wherein somebody's uploading the files from their
own disk. That can work out for a video of a couple
of minutes. But for movies, that is practically not possible. So for the raw files that the production houses
would give out for a movie would easily be 20 GB, 30 GB or
maybe 40 GB big. These are the most highest definition content
with a good audio quality and all of that And then that will be later transcoded into
different kinds of formats. So that had a lot of information, therefore
very big size. Upload doesn't make too much of a sense there. So ideally, the way it would probably work
is they'll probably have an SFTP server running somewhere on their
side. Wherein the content would be present, they
would just give a link to that SFTP server, some user name and
password and let us do all the work. So assuming that's how it is done...
the UI for production houses, will talk to this Asset Onboarding Service, give it to URL, and Asset Onboarding Service
would then call up wherever that content is hosted maybe another S3 bucket, maybe some SFTP server,
or wherever. And pull the content and put it into its Amazon S3. So the data that we are using for hosting
the video is Amazon S3. That's a kind of a cheap database you can think of it - if you're not aware
of what that is. And that is generally used for storing images,
videos any type of content. We are using a Cassandra, as a data store which contains
all the information about all the videos, so a video would have some information about who's uploading
it. It would have a description, lot of images
probably attached to it, maybe some thumbnails and a large variety of tags and a lot of other information. So all of that would be in store a Cassandra. So what Asset Onboarding service does is,
it starts pulling from the source, uploads it into S3. Once the file is on our
Amazon S3 then there are a lot of steps that we need
to do. Asset Onboarding Service would then send out
an event into Kafka saying I've taken the file and put it
in my S3. Now whoever wants to do whatever, go do your
job. So there the part of an Asset Onboarding Service
ends and it sends an event into Kafka. Now there are a lot of consumers that are
sitting on this Kafka. One of the consumers is the Content Processor Now Content Processor is basically a - think
of it like a workflow engine, which does a lot of things
to that files that have been uploaded for it to be
available in various kinds of formats, various bandwidth requirements and all of that that we talked
about earlier, while going over the Functional Requirements. So coming to what this does. First of all, like we talked about, while
the video, is being streamed, It'll never be streamed as a single file. There'll be chunk that the video would be
divided in. And all of the processing that is done on
the video would also be done in chunks. So it makes sense to chunk up the file at
the very beginning so that we can parallelize all the further
efforts. So the very first thing that happens to a
file is it goes to a file chunker OK, which divides it into multiple segments. It could be size base segment, time base segment
or any random method of segmenting. So I'll quickly draw out how it looks like. So think of it as one big file that was uploaded. It gets divided into, let's say four smaller
chunks. OK, now this Content Processor, Also uses Kafka to send out various events
and to invoke the further processes. What it does is for each of these sub-segments. It calls a Content Filter, what does Content
Filter does is So in each video there are certain.... So in each video platform, there are certain
kinds of things that are not allowed. So, for example, if I go and upload Pirates
of the Caribbean movie onto YouTube, I'm not supposed to upload that right. There are legal reasons why that's how it
is. So there are certain checks that need to happen. So piracy is one of the first things. There could be other things that are legally
not allowed, like nudity or maybe some content regarding religious things, So all of those checks need to happen. And now all of those checks can parallelly
happen on individual components(chunks), instead of looking at one big file. So this Content Filter takes up one chunk
by one, so think of it like multiple workers, parallelly each worker working on one of the chunks and doing certain
things. Once Content Filter goes through, it sent
out event saying I'm done, now whoever have the next
thing in, can go pick it up. The next thing is the Content Tagger, what
essentially it does is - So let's say there's a video being uploaded,
now the production house will give out some tags by which that can
be searched. But there could be some other things that
we can infer out of it. So, for example, if there's a football video,
we might want to tag it saying a particular player in that. And there could be other kinds of taggings
that we might want to do. So this Tagger is what goes through the whole
video, tries to extract some parts of it which can
be converted into like English tags which can then be searched upon or even in the other
languages. The another set of things that the tagger
does is try to create thumbnails of the video. So across the whole video stream, it tries
to figure out some screens which are good, and it creates
a list of thumbnails that would be later used for AB
testing and trying to figure out which out of the thumbnails
are actually the best ones. And those would be uses thumbnails for the
later and for the whole video. at later point in time. Post the content...
I quickly draw how the things are flowing. So what happens is: everything goes to a filter,
this the Content Filter stage. Then everything goes to a Tagger stage. This is the Content Tagger. Now post Content
Tagger we have something called a Transcoder. Transcoding
is basically an activity of converting one file type into
another file type. So the raw video that was uploaded, whose
chunks we are processing those would be converted into multiple file
formats, like, for example, a AVI or MKV or MP4 or
something of that sort. So think of it, something like - post this
Transcoding effort, each file(chunk) will be split into multiple
sub-files(sub-chunks). Similarly for this, similarly for this, similarly
for this. Now each of these formats that we have, now, we have four files(chunks) instead of
one. So each of the four will be sent out for individual
transformations next. Next thing is Quality Converter. So there are like we talked about in the initial
Functional Requirements, people have different kinds of bandwidth that they kind of are on. So we might want to have multiple formats
which require different bandwidth. So each of those formats(chunks) will now be converted into multiple formats
basis the bandwiths that we have. So let's say this one is converted into three parts(chunks). Similarly, all of these, and all the combinations,
would have fanned out into multiple, you know think of
it like a tree And each node have as many number of childs
as the output of the particular Encoder or Converter or
Transformers. Now once all of that is done,
then we basically upload individual components(chunks) onto the CDN. This is basically a final piece, which says
that I am an AVI of this movie, which runs from second(5) to second(7) seven and offer a certain
bandwidth requirement. And similarly, there are thousands of chunks
or maybe even millions of chunks which are now created, which are all uploaded on CDN. So this is the file processing cycle. Now, once that is done, and even while it
is happening, all of the events are put into Kafka. But Kafka is not just used for invoking the
further processors, it is also used for something even more smarter. So let's say Content Tagger tags each chunk
with a certain tag All of that information could be put into
Kafka, which is this Kafka, now there could be a Spark Streaming process
that runs across all these chunks for a particular movie
ID and keeps aggregating all the tags that are
received. It can then filter out 10 top tags and then tag the movie with those tags, right.
So this way we, even though we are segregating all of that
information across a lot of worker nodes but at the end, it is aggregated at one point
in time. That aggregation could be done through Spark
Streaming. It could also be done through a lot of other
ways. Think of it something like all of these pieces are individually
getting aggregated and then all the other sub-pieces
are getting aggregated at the next stage. It looks
like an map-reduce, it could be implemented in either way you
want. Now post this, the work of Content Processor
is complete when it has uploaded all the chunks on the CDNs So this is one of the CDNs that we are using
which have all the information. There'll be more such CDNs that we'll talk
about as and when we proceed. When all of that is done, again, even when
CDN upload is complete, it will send out events into Kafka. There'll be an Asset Service that will
be reading all of these events. Because somewhere we need to keep a track
of what is happening with the whole movie, how many chunks are there? which chunk is
in which status? So all of that is being handled by this Asset
Service and it is storing all the information about all the chunks into this Cassandra. Once it identifies that everything is complete
and all the chunks have been processed completely, it'll send out a notification through, again
routing through Kafka via Notification Service, to the person who has actually uploaded the image,
saying your movie is now processed. Because this process is not something which
will be completed in seconds, so the person will give a URL from this UI,
click a submit button and go away. Maybe a few minutes, maybe an hour later,
when the whole of the process is complete, you will get notified that this process is
done. So, other than notifications, there a lot
of other consumers that are also running on this Kafa. Search Consumer is one of them. Similarly there'll be lot of other things.
We will go over them in the subsequent section. Now, let's talk about the services that are
powering the user facing products. Users are the people who are consuming content
on our platform. So one of the very first interactions that
we have with the user is when they try to log in. And this login could happen from a bunch of
clients, could be from a mobile application, could be from a smart TV, a web browser, anything of that
sort. But we'll assume all of those are coming through
this one product called User Device Login Flow, which talks to User Service internally for
authentication. Now, the responsibility of the User Service
is to be the source of truth of all user related information. This User Service sits on top of a MySQL database
which has all information of the user like name, email address, contact information, country
they are coming from, their interests if they have given any. It could also have information about subscriptions
if we have a subscription based model. Now, it uses a Redis as a cache. Now, what'll
happen is - a lot of times a lot of other services in the ecosystem will call User Service to
get information about a particular user. User Service could potentially call MySQL
all the time for all the requests, but that's probably not an efficient choice. We might as well cache that user information
because that is not changing very frequently. For caching, we'll be using a Redis where
the key would be a 'user_id' and the value would be the payload of the user information. So, to give you an example of when this would
happen - so probably a Search Service would call a User Service to get user information so that
they can filter out certain results. So some search results would have an age restriction
for example or some search results would be applicable only in certain countries. So for all of that information, User Service
becomes the source of truth. So that's mainly about User Service. There's one more thing that it does. So each time a person tries to login, we would
want to store some information about the device and the geography that the person has come in
from. We would be sending it to a Kafka for analytics. What kind of analytics can happen? So, just to give you a rough number, I don't
know how to give that, but I have read somewhere that more than 40% of the users of Netflix, Netflix
believes that they share credentials with their friends and what not. If you are building a subscription based model,
we would probably not want that to happen. But before figuring out that it should happen
or not, we need to figure out that it is happening. And how could we figure out - that if the
same account is being logged in from a lot of devices and from different geographies, it probably means
that either the person is traveling a lot or the credentials have been shared with others. Similarly, there could be other kind of user
profiling that could be done on top of this data. And this data will come through device fingerprinting
via User Service all the way to Kafka. And then whatever analytics that needs to
be done, could be done on top of that data. Next thing that the user does after login
is basically get to see a home screen and on the home screen they should be able to search something. So that is basically powered by the Home Page
Service and the Search Service. Home Page Service is the one that gives out
the data that would be rendered as soon as the person has logged in - which is the first screen
that the person sees. And if they are searching something that would
be powered by Search Service. Functioning of both of these services - we'll
probably look at in the next section. But basis the result of these two services,
we would probably want to do some analytics on top of it. Let's just say that we have some UI, something
like a YouTube or Netflix for example, wherein you see some category and some videos
within those categories. And then there's the option to see more videos
within that category. And let's just say, if our analytics says
that a lot of people are actually going on that more videos and are not clicking on the videos that are shown
in the first page. That means that there is something wrong in
the Home Page Service and it is not returning the best possible results to the user. And that needs
some improvement. The same thing could be said about Search
Service. If, let's say, it's a paginated result and a lot of people are going to page number
2, page number 3, that means that service is probably not returning
the best possible results for this user at this point in time. And again, it needs
to be tweaked. But to come up with this fact that we need
to do some improvement, we need to have the data to have a look at how many people are actually
going to page number 2 without clicking on any video of page number 1. And all of that would be done by this Analytics
Service. So this is basically a User Activity Analytics
Service which gets feed from various actions done by users on the app or website or any client and it
sends it to a Kafka, and basis that, there could be some kind of analytics that we could do, which will
then be used to improve the search results and the recommendation engine and all of those things. Let's just say that a person has done some
search and they've got to a video and then they want to play it. So what they would do? They would probably
click on that, get to a screen, click on a play button or however the UI looks like, and they expect
the screen to start playing. How does that work? That actually follows
this flow, which is basically, I am abstracting it saying that it is a user device playing video flow. What that does is - it basically makes a call
to this Load Balancer, to this Host Identity Service. Remember the previous section wherein we took
a video from a publishing house and then made a lot of chunks of it and uploaded it on
a CDN (Content Delivery Netwrok). We actually did not upload it on just one
CDN. We uploaded it on a lot of CDNs. For example, let's just say that we uploaded
it into a CDN in US and probably somewhere in Germany. All of that information about a video, it's
CDNs, all of that lies within this Cassandra Cluster on which this Assest Service sits, which we
looked at in the previous section. This Host Identity Service, it knows what
video you want to play and where you are coming from. It will query Assest Service to get me all
the CDNs that are available with this video. And given the location of the user and the
location of all the videos that are there, it will try to come up with one of the CDNs that is responsible
to play this particular video. That's the main responsibility of this Host
Identity Service. This service could return 2 types of CDNs. One I am calling Main CDN, which is basically
a repository of all the videos that we have. There is another CDN that we have, which I
am calling CDN Optimized for Local Views, for a lack of a better word. But it is basically a CDN, which is geography
centric. Let's just say that we had two CDN servers
like we talked about, one in U.S., one in Germany, and a user is coming from U.S itself. So they will be redirected to the main CDN. But let's just say there is a user coming
from India. Normally, let's say if Germany is close by, they would get the CDN of Germany to talk
to. But for some reason, let's just say that we
have enough analytics and we get to know that people in India are watching a particular video a lot.
We could actually host a CDN service in India and upload that video in that CDN. Now all the
users asking for that particular video from India would be given the local CDN to talk to, because
that helps us to save a lot of network traffic. If you are closer to a server, you will get
the response faster, thereby helping us improve on one of the non-functional requirements (NFRs)
of low latency. Now, as a client is playing a particular video, there are a lot of information that we can
capture about this interaction of a person viewing a video. One very good thing that we can capture is
- How good a video is? Most of us don't really rate a video usually.
We rate it thumbs up - thumbs down on YouTube for example, only when it's extremely good
or extremely bad. But normally we don't. But capturing a rating about a particular
video is a very important thing for a video streaming platform because they can use that information for
improving the search for example. One data point to proxy as rating is what
length have people watched a video for. So, if a lot of people are closing a particular
video in 10, 20, 30 seconds, it's probably not that good. But if a lot of people are watching more than
90% of the video, they are kind of giving a signal that it's
a good video. So these are again some analytics that can
be done basis how people are watching a particular
video. And all of that is done by the Stream Stats
Logger Service, which basically gets pings once in a while that a person has watched this video till
this point in time, and that again gets pushed into Kafka. And that can again be used to do some analytics
mainly to come up with a rating for a particular video. Now let's look at the remaining pieces of
the architecture and how it all comes together. More importantly, in the previous two sections,
we had put in a lot of events into Kafka of various types. Now we'll try to understand how each of those
events is helping us and what information can we extract out of it and how it will help us
to enhance our whole system. One of the events that Asset Service publishes
is the on-boarding of a new video. Remember, sometime time back we talked about
that whenever a new video is being added, it is divided into chunks. Then it goes through a workflow and at the
end it gets uploaded into CDN. And once that whole process is completed,
Asset Service pushes an event into a Kafka saying now the video is ready. What that means is - now the video is ready
for consumers to see it. And how would the consumer see it? Only when it pops up either in their home
page or in their search results. So essentially what we need to do is make
this video available for searches, so that the event that was pushed to Kafka would have a lot
of information about the whole movie. So let's say information like cast, crew,
some description, some additional attributes. So what we will do is - so there will be a
Search Consumer Service which will be listening to the topic where that event was published. It will pick up that event, it will convert
that event in a format that it wants to. So, think of it like it can discard some of
the fields, it can create some new fields also. So let's say if it has a particular tag, which
might mean that we need to do an age filter, it might add a flag into that JSON saying
I want to do an age filtering. And post all of the data massaging that it
has to do, it will put it in its data store. We are using an Elasticsearch here. Why Elasticsearch? Mainly because we need to do a fuzzy search
here. Why fuzzy search? Aagain, if somebody wants to search for Pirates
of the Caribbean, it has a long name. Probably somebody will do a typo. And spelling mistakes is fairly common when
it comes to searches. So instead of returning back no results, we
might want to do a fuzzy search so that we are still able to identify that there's a spelling mistake but the user meant that he wanted to see Pirates of the Caribbean so we'll give them the search results aligned
with that. It might also help us to do a type ahead suggestion, something very similar to what Google auto
suggest does. And all of those features are provided by
Elasticsearch out of the box so that's the reason Elasticsearch makes perfect
sense over here. So this is basically the ingestion into Elasticsearch
flow. On the other side, when a user is actually
trying to search for a movie, What he'll do is - he'll follow this flow
- wherein they will come to their home screen, they'll type something in the search box. It comes through this Load Balancer to Search
Service. The schema is shared between Search Service
and Search Consumer. So, both of them understand what data is within Elasticsearch
and how it is maintained and what fields mean what. So it would be able to search for that particular
string on all the fields that are important enough. So for example, a person might want to search
by Pirates of the Caribbean or by Johnny Depp or by some other attribute, but all of that should
return the same movie. And that can happen if the search happens
on maybe 4 - 5 fields or maybe more. So this particular piece would be taken care
of by Search Service. Let's say, Search Service gets some response
from Elasticsearch and it gets to know that there is a particular flag which says that I need to
do an age level filtering on the user who's searching for, what then it will possibly do is - it will
query the User Service and get the information of the particular user. And basis the information it gets from User
Service, it might choose to show that result or ignore that result. And at the end of it, after doing this whole
data massaging, it can respond back to the UI with the search results, which can then be displayed
to the users. So this is the Search flow. One thing to call out here is that - all the
components that you see here and even in the previous sections that we
had, all of those components are horizontally scalable. So let's say, if there is traffic increasing
in one of them, we need to just increase the number of machines into that particular node or that
particular service or that particular data store and things should, you know, work just fine. Coming back again to the Content Processor
which was the workflow engine which was executed when a new video is added, it had a component
called Content Tagger. All the chunks went through Content Tagger
and it had the logic of parsing the whole video and extracting some tags out of it. Now, let's just say there are thousands of
chunks which are individually being processed and all of those information about tags in each chunk
is being put to Kafka. Now, let's try to understand how would that
get aggregated and how would that be stored back again. Assuming that information again comes to Kafka.
There will be a Spark Streaming Cluster running which will be listening on to the topic where
all the tags related information is being passed through. That information would have a 'movie_id',
tag information like a 'tag_name' or something and probably a 'chunk_id' and some additional
information like how many chunks are there so that it is able to identify that everything
is processed. Now what it will do is - it will keep polling
all of the information and maybe it will look at previous one hour of data or half an hour of data or
some time frame and do a simple reduce by key wherein a key could be your 'movie_id'. What essentially it does is - think of it
in the SQL world as something like a GROUP BY movie_id and COUNT(tag) and GROUP
BY tag as well. So it gets to know that for a movie, what
all tags were present and how many times each tag came in. And then it could do a ORDER BY COUNT(*) and
then SELECT TOP 10 or TOP 5 or something of that sort. So this cluster, just in itself, should be
good enough to identify that - given a movie and all the events about all the chunks and their tags, which
are the top 5 or top 10 tags in that movie. It could then send back the same information
to Kafka, which could then be read by Asset Service which could then be persisted back in the
Cassandra data store that it uses. So this was one more event that we covered. Some additional thing that we did not talk
about when we were discussing Asset Service was - Why are we using a Cassandra here? Cassandra is a database that can handle massive
amounts of reads and massive amounts of writes and that is because of the way it has been
designed. Cassandra follows a no master kind of a strategy.
So, it has a ring of a lot of nodes wherein each node stores some part of the data, and each node
knows that what particular data is residing in which node. Now, assuming that kind of a structure, if
we want to handle more amount of data, all we need to do is to add more nodes in the Cassandra cluster
and it should be able to handle more data. What is the volume of the data that we have? So if you just go by some metrics, YouTube for example, has a bit more than a
billion videos. In our case, we have not only videos, but
also information about chunks. So we have like probably a billion odd videos
and probably thousands of chunks in those videos. So that is a massive amount of data and Cassandra
should be able to handle that without any load. Now coming to what Cassandra is good at and
what Cassandra is bad at. Ideally, Cassandra is really good when you
have a small number of (distinct type of) queries
and a query is by something called partition key. Think of it like a namespace wherein data
is categorized. So all the queries that will happen on this
data store will be something like give me all the movies by a publisher or give me all the movies by a production
house for that matter, or give me all the movies or the chunks of a particular movie or give me
all the information of a particular chunk. If you look at this pattern, it is a very
straight forward pattern wherein there is a key and then there are some values. If we store the data in a format where this
key is the partition key then these are very efficient queries in the world of Cassandra. Now, what Cassandra is bad at? It is really bad when you want to do random
queries. So if you want to do a LIKE search in description
or if you want to search by a crew name, or any random thing, then Cassandra is bad. But like we discussed previously, we are not
using Cassandra for those kind of searches. Those kind of searches are powered by Search
Service, which sits on top of an Elasticsearch. Cassandra is also really bad at doing aggregation. But we'll also not be doing any aggregations
on Cassandra. For that we have a Hadoop cluster, which we'll
talk about soon. Coming back to the Content Tagger part of
the Workflow Engine, which came into picture when a new video is
uploaded. So, other than tagging the videos, it was
also creating a lot of thumbnail images, which we said that one of them will possibly
be chosen as the best thumbnail. So how does that work out? Assuming all of those information again comes
to a Kafka saying for a movie_id, some id, a lot of thumbnails that were generated. They will be generated for individual pieces
and then that could be aggregated. So that is one part of the story. Assuming all of that information comes to
this Spark Cluster and then it gets stored into a Hadoop cluster. Now, the next side of things. When the search results are shown to the user,
randomly some of the thumbnails would be shown to some of the users. What we could now do is - remember the user side of things, where we had a Home Screen Service, a Search
Service and an Analytics Service. Analytics Service was sending out various
events into Kafka about the performance of search results and the results of Home Page
Service. This could also bring us information about
which thumbnail works best. So let's say, there are particular thumbnails
on which we get a lot of clicks and there are certain thumbnails on which we do not get a lot of
clicks. Both these information - of all the thumbnails
and the performance of each thumbnail would be joined together to figure out which thumbnail is the best
one for a movie and that thumbnail should be shown. So this is one of the ways in which we could
figure out the best thumbnail. You can take it one step further. You can say that, I do have that data in Hadoop,
of all the thumbnails. We'll put the data of Analytics Service also
into Hadoop saying I have a log of which thumbnail got what kind
of views for what kind of users. Now, instead of just finding one best thumbnail,
we could run our Machine Learning model on this, which kind of tells us that for which kind
of user which thumbnail works the best. So now we don't have one best thumbnail. We
probably have a lot of best thumbnails for a kind of users. Now, when the Search Service queries, it kind
of tries to figure out what type of a user I have, and basis that, it can select a thumbnail. Now, how do we do user tagging, we'll come
to that in a while, but this could be one good use case of a Machine Learning model that can run out of
this Apache Spark Cluster. We were also putting a lot of information
into Kafka about the videos that a person is watching and what percentage of the video are they
watching. So what we said was - if a person is watching
a video for a very short time, we can safely assume that the person does not like the video. Or if the person is watching a video for a
very long time, we can assume that the person is liking a video. So, because we did not have a functional requirement
(FR) of adding a rating to a video, therefore, we do not have this information
in a very first hand model, but we can use this time duration as a proxy
for rating. Let's just say that we convert this into a
numerical value of 1 - 5 and try to give a rating to a video that a person would have potentially given
basis the time they have watched. Think of it - for a lot of videos, for a lot
of users, there are too many users, giving ratings to too many videos. All of this information also
comes into this Kafka. Now what could we do? First of all, we could just simply classify
users into groups. We can say that if a person is liking certain
kinds of videos, they possibly fall into some category or say
possibly like some genre. Let's say a user likes Mission Impossible
and Matrix for example, they do like action movies, we can possibly say. This is the kind of a user classification
we are trying to do. Once we have this information about a particular
user and we are able to classify them against a couple of genre, we can store that information
into Cassandra because then this information would be used for a lot of other things like
recommendations. But this is one kind of things that we have. The other input would be the searches that
the user is doing. So if a user is searching for, let's say, Back To The Future, the person is telling
you that he wants to see that movie, whether you have that movie in your data store or not, but
it is still good to know what that movie is about because that will still give you enough information
about the user. All of these can also be a part of User Profiling
Information. Basis these lots of data points, we should
be able to classify users into a couple of genres that they like. This is basically a part of user classification. We could say that if a person likes action
movies and let's say the best movie in action is for example again, Mission Impossible then the person
is very likely to watch Mission Impossible because they like action movies. So, this could be a way of recommending movies
to a user. So this becomes a recommendation engine, which
you can see right here. The same data which comes to Kafka, flows
into your Spark Streaming, gets stored into Hadoop, there is some analytics done on top of it,
some classification, it would not be a very simple mathematical
thing, it could very well be a Machine Learning model and that could kind of give us an input. There could be another set of things done.
There is something called Collaborative Filtering. Let's say, if user_1 likes, again I'll use
the same example, Mission Impossible and let's say Matrix and Back To The Future and user_2 also likes
the same set of movies. Now, if we have a user_3, who likes Back To
The Future and Matrix. We can very likely say because this user_3 looks very similar to
user_1 and user_2, therefore, he's very likely to watch Mission
Impossible. So this is again a Machine Learning model. There are a lot of implementations of that. There's something called ALS which is Alternating
Least Square, which is one of the good implementations of
this kind of a model. We could use any of this information and either
pre-calculate a lot of information about users or calculate it and stored it somewhere or do
something about it. Let's say if we pre-calculate, we could store
all of this information into this Cassandra again, saying a user is likely to watch these sets
of movies. So when you are building a homepage for this
user, try to put this movie into that. Now when it comes to building the homepage,
there are let's say 3 rows that you want to show, then those rows could be driven by the kind
of genres that the person is interested in, basis the previous data that we talked about and the records within those rows could be
determined by this ALS method or any other similar method. Whether this works or not, we'll get to know
via the Analytics Service, which was also putting in information into
the Kafka. If it turns out to be a bad model, we can
kind of iterate over and try to figure out what best can we do. Another event coming into this Kafka was the
geo-tagging and the device finger printing of users at the time of login. Again, that could be handled in exactly a
similar model. Put that into Spark Streaming, put that into
Hadoop, do a GROUP BY kind of a thing by user_id, try to figure out how many unique logins have
come in for users, if you want to, kind of bifurcated by the kind of devices that the user has logged
in through, or the kind of geographies that the person
has done it from. Just put that in a report kind of a thing
and have someone look at it. Maybe we'll get to know that people are travelling
and because of that, the data is actually that great. Or maybe we'll get to know of some users who
are actually spreading out their credentials and giving their access to others. Maybe!! Data can give us a lot of information. One component that we have not talked about
till now is the Traffic Predictor. What that is? Remember, we have two kinds of CDNs. One is the main CDN, which has all of our
data, which is in a very few locations across the globe. And then we have local CDNs which are sitting
in each country or maybe multiple such CDNs within a country, which are catching data to improve
the experience of users within that country. There are multiple ways to load that data
into that local CDN. One is - if somebody is watching the video,
you request from the main CDN and also put it into the local CDN.
That is probably okay. But to be honest, not really good. What if you would predict that what are the
things that people are going to watch tomorrow? If, let's say, you can come up with a list
of videos that people will watch on the following day,
you could actually cache it beforehand. And by doing that, you can save up a lot of
bandwidth. And the most important thing, by caching you
will get is that, you will be able to achieve your NFRs. Because now if the latency is reducing, you
will have less probability of buffering and thereby have a better user experience. How would that work? Again, it would be a Machine Learning model
that uses all of the usage data like what videos people are watching and use that to predict what possibly people
will watch. But one more key data input into that would
be a new launch. Let's say a new TV series is going to be launched
tomorrow. You know for a fact that people in a lot of
geographies would watch that. Let's say if it's a series in German, you
know that people in Germany would be watching it and not probably people in India because they
wouldn't understand. Right!! So it makes sense to put it in the local CDN
only in Germany. So all of these data points could be used
and could be input into the Traffic Predictor, which again, would run on the same data that
sits within the same Hadoop cluster and it should be able to give out information
saying - for tomorrow, you need to have these videos
in these - these CDNs. What that will give is - for each CDN, what
all videos need to come (from source of truth). How that will play out? Overall once it calculates all the videos
that are required to be present in each CDN, it will put an event into Kafka saying - this
is my report of what I believe is required tomorrow. Go make sure it is available, whoever is responsible. There is something called as CDN Writer. Again
for the lack of a better word I have named it like this. What this does is - it basically looks at those events and fetches
all the videos and puts them in the right place. It could fetch from (Amazon) S3, which is
our source of truth or it could fetch from the main CDNs and put this in the required CDNs. In the next section, let's look at how that
could be done efficiently. Let's say that CDN Writer got a message saying
Local CDN 1.. I'm using a short hand "LC" and assuming "LC1" is an identifier of Local
CDN 1, so, assuming the message was saying that "LC1"
needs to have C1, C2, C3, C4, C5 and C6 chunks. It will first query Asset Service and try
to figure out what all is already there in that local CDN. Let's say Asset service returns a value saying
C1, C2, C3, C10 and C11 are already there. Then all it does is - basically figures out
that we need to remove C10 and C11. These need to be removed and the remaining
three (C4, C5 and C6) need to be added. So these three need to be added. And these would be sent to the local CDN. Even though the recommendation and prediction,
all of that was happening at the level of a movie, but still we will be sending chunks when we
send to various CDNs. The reason is that - let's say, Mission Impossible
is supposed to be in a CDN which is in India. Now, we don't need to have all formats of
Mission Impossible in all possible bandwidths. Maybe certain formats have a higher prediction
and certain bandwidths into that have higher prediction. So only those chunks corresponding to those
particular formats and those particular bandwidths would be sent to the local CDN and not all
of them. Now, let's look at how is this data actually
sent to these local CDNs. So let me quickly draw out the thing. Assuming,
there is this S3, which is the source of truth. And let's say there are a couple of Main CDNs. Let's call them MD1 and MD2. These are our true copy which have all the
data. This is like a replica. We'll not have hundreds
of these main CDNs. We'll just have a couple of them. But local CDNs would be a lot, probably a
couple of them in each country. So when we have to send all the information,
let's just say that - chunks C1 to C25 were supposed to be sent
in five CDNs - LC12, LC2, LC3, LC4 and LC5. So, chunks 1 to 25 were supposed to be sent
in all these five. One way to do it is - pull all 25 in each
of them. In all five of them. What we are essentially doing here is - bottle
necking this S3. Remember a very important thing in any system
design interview is - you should never ever have a single point
of failure. Agreed!! S3 is a fairly well distributed thing. You could even use the MDs here to basically
pull all the data, but even that's not a very good approach. Instead, what you could do is - you could
do something like what Torrent does. Basically, send some of the information to
some clients, some of the information to some other clients. A client here is basically the CDN and then
let the CDNs get the data amongst themselves. So one possible way to do is - you send the
chunks C1 to C5 to Local CDN1 (LC1), then you send chunks 6 to 10 to LC2, you send chunks 11
to 15 here (LC3), 16 to 20 here (LC4) and chunks 21 to 25 over to LC5. So all of them have some part of it. And this file transfer would happen from S3
or your Main CDNs (MD1 and MD2). But once the file is fully transmitted to
all of them in chunks, they can distribute the data amongst themselves. So, LC1 can send chunk 1 to LC2 and LC3, and
then LC3 can send chunk C1 to LC4 and LC5. What this does? It basically decentralizes
the whole process. This is exactly the implementation of - how
Torrent is implemented. Decentralization gives a lot of benefits that
we are not putting S3 under load. Why? Because we have to pay for this. The
more we use S3, the more we have to pay. By doing this, we are reducing the load on
S3. Plus one more thing that we would achieve
is - all of these transfers we can do when these local CDNs are at a very low load. S3 being a very global service, will always
have some kind of reads happening on it. But these local CDNs, let's say, if it's 3
am in the morning in India, the Indian CDNs would be having a very low traffic. Similarly, the U.S. CDNs would have very low
traffic when it's 3 am in the morning for U.S. So at that point in time, if we do all of
this fancy process, it would be much more efficient when the CPUs are anyway free on all of these
computes. So this is how we could do it efficiently. Now, let's look at an optimization that is
happening in this space. First, let's look at how does your client
talk to Internet in general. This not an exact representation, but it is
somewhat like that. So let's say this your device. It talks to
your modem. It talks to a router. It then talks to ISP's router maybe after a couple of hops.Then it goes
through an ISP, you can say a firewall kind of a thing and then it goes out to the Internet. Let's say if you were trying to access [youtube.com/something],
it will first go to [youtube.com], try to get the
place from where the video chunks can be downloaded. That could be a S3 location or it could be
some CDN. S3 would probably be far away and CDN would be close by. And then the video would start streaming all
the way through all of these hops that are in between, all the way to your device. Let's imagine there are a lot of people who
are connecting to this ISP who are asking for one particular video which is for some region,
very famous. So there are a lot of such people who are
connecting through the same route and asking for the same video. Now what happens, if it is in CDN, it will
follow this route all the way to all the three users. And these could not be just three users. These
could be a lot of users. So now, the same video is being sent by this
service of [youtube.com], to this ISP and then it is going to a lot of users. This is a wastage
of resources for both, ISP and the service provider. For service provider, why? Because if there
is too much of traffic, they have to add more number of nodes. If the same ISP is requesting the same video
again and again, they are basically sending the same data to this ISP, but still they have to add more
nodes because the traffic is increasing. For ISP - they have to pay as much as they
use the bandwidth. So, the more they query some external service,
the more they have to pay for the bandwidth. So for both of them, it's kind of not a very
good idea. So as a optimization here, what a lot of ISPs
do is - over here, they kind of try to, if you just maximize this node, they kind of add a hard disk. So, some content which is being requested
very frequently, they try to cache it over here. So next time, when a fourth user queries the
same content, it basically goes to this machine and responds back from here. Now, that is an optimization which an ISP
can choose to do. Now that depends upon their trade offs. Whether the cost of buying this hardware and
maintaining it, is it cheaper compared to the cost of bandwidth
over time? If yes, then they would buy this hard disk. If not, then they would bother not to. But for [youtube.com], they are anyway on
a loss. They anyway have to have that many number of hardware, if ISP does not choose to do this. So what some companies, especially Netflix,
what they have done is - over here, let's say, in the CDN they had
a lot of hardware. What they have done is - they have removed
one of the machines from here and what they have said is - I'll give this
machine to this ISP, like they don't actually give the machine, but let's just think of it in cost terms. They save some cost by reducing some hardware
over here and they invest that cost into buying hardware for the ISPs, which Netflix provides
them and maintains it. Now for ISP, it is a free hardware that they
have got and they can use it to cache the content of Netflix. Now, what happens is - for Netflix, they are
kind of cost neutral. For ISP, they now get to save a lot of cost
of bandwidth because they now have a big hard disk. And this is by the way, not a small hard disk.
These are like big disks which can store hundreds of terabytes of information. Now, if you look at a user, for user, it is
definitely beneficial. Why? Because they are getting most of the content
delivered from right here. So it helps us in a lot of functional requirements. First of all, extremely low latency. Because just in a couple of hops you are getting
this data, whereas otherwise it was probably a lot of hops. And then extremely high availability. Why? Because, let's say, there are a bunch of earthquakes
everywhere around the world and lot of data centers got damaged. Even
then you would be able to, kind of, see this video. You might not want to see a video at that
time, but that's a different story. But overall, everybody in the ecosystem is
kind of having a benefit if people choose to do this. For Netflix, it is called Open Connect. And these applications or the hardware is
called Open Connect Appliance, which they kind of install at the premise
of some ISPs. But a lot of companies in the industry are
kind of trying to do so. So this is something not really a part of
your system interview as such. You would not talk about that in the interview. But this is still something that you need
to be aware of, because this is something happening in this space. So, yeah!! Then, this should be it about the
video streaming platform.

---

## 14. Google Maps System Design Interview Question
**Channel:** CodeKarle | **Views:** 193K | **Date:** 5 years ago | **Duration:** 1:01:07 | **ID:** jk3yvVfNvds
**Link:** https://youtube.com/watch?v=jk3yvVfNvds

### Transcript:
Hi everyone!! Welcome to CodeKarle. My
name is Sandeep, and in this video we'll go over how do we design a navigation
application like Google Maps. Now let's go over some Functional and Non
Functional Requirements(NFRs) that we want this platform to support. 
So the very first thing is when a person wants to move from point A to point B, this
platform should be able to give them a couple of information .
1) What is the route that they should follow 2) Given that route how much distance
they'll have to cover and how much time it will take. As an enhanced variant we
could also build a system in which we show them 2-3 routes and then let them
choose that they want to minimize the distance or minimize the time. 
3) The next thing is that it should have a very pluggable model. So let's say we make a
very basic design which just has no traffic data or anything of that sort.
Now let's say if you want to plug in traffic information it should be easy
enough to add it. Now post that let's say if you want to add information about
weather or accidents or construction going on somewhere or road blockages or
something of that sort, it should have a very easy way to input this data and not
make a change in whole of the architecture. So that's the main idea of making a pluggable. 
4) There's one more thing that we'll cover in a very brief
thing, that is basically how do you identify roads. So there are two three
ways in which we can identify new roads. So one very basic or the most efficient
way is to just ask government sources to give us all the information about
all the roads data that they have. Now they might not have all the data but at
least we'll have a good starting point. Now beyond that we can capture a lot
of organic data. So let's say if a lot of users are going on to a place or a route
kind of a thing which we don't identify as a road, then we can easily say that it
there is a road that we don't know of and we can kind of onboard that Road
onto our system. Now we can use some data like number of people traveling on it,
which sides are they traveling to, what is the volume of traffic, what is the
speed and correlate that with the existing roads that we have and try to
even come up with how wide the road is!! Is it a single lane road or if it's a
four lane/six lane kind of a road. All of those information could be figured
out. But we will still not go into this in much depth over the video. Mainly what we'll focus on is How do we efficiently find the route between two points? Now coming to the non-functional requirements the very first thing is the system should be always Available. This should not go down.
The next thing is it should have a good enough accuracy. Now let's say if you are
not giving the very best route but if even if you are giving a good enough
route that should be okay, unless it's not a terrible route, okay. And it should
not be too slow so let's say if it takes 1 second/2 seconds/3 seconds to
do all the calculations and come up with output that should be okay. It's not that
it should respond back in a millisecond with the best route between two points.
That's a bit too much to ask for, a couple of seconds one, two, three seconds
should be okay. But it should not be too slow. Like it should not take 15 seconds to
come back with the response, okay!! Coming to the scale, again I do not know
if these numbers are authentic, but from what I've heard and read, Google Maps
roughly has a billion MAU (Monthly Active Users) and these users generally access
Google Maps a couple of times in a day or maybe a couple of times in a week at least. What that means is we'll probably
have roughly five to ten billion requests coming in a month for time,
distance and route between two points from users. Then there are also five million
companies which use Google map so companies could be companies like Uber
who are using Google Maps to come up with the Navigation and Pricing System,
or it could be smaller companies which have a very similar use case. 
But that means that we need to keep these things in mind that we have a very large volume
of users who are coming into system who will be using this platform and design it accordingly. now building this Navigation App is a very hard problem to
solve. Not because of the kind of Algorithms that we'll use. But more because
of the kind of requirements this has. So for example, if we try to calculate the
number of roads in the world there are various theories, which you know come up
with various numbers. In general people cannot claim that there are somewhere
close to 50-100 million roads in the world. It could be you know even a much larger number.
Now if we try to model it as a graph it would probably have somewhere
close to 50 million vertexes and maybe you know hundreds of millions of edges
if we divide the roads into multiple chunks and all of that, right. So that is a
very very massive data set.Now a lot of companies don't even have access to this
kind of a data, where in what road is connecting from where to where. That kind
of information is kind of non-existent throughout the whole world and there is
no single place where you can fetch that, which makes it a very hard problem
to build an navigation system like this. The next thing is, it is very
hard to even quantify a lot of attributes that will impact the ETA. 
For example traffic and weather condition and Road quality. Things like these are
very hard to quantify so there is not a very easy mathematical formula that you
can come up with to calculate the ETA that will be required to cover a
particular distance. One more challenge this is, a lot of things into the whole
road systems are very unpredictable. There could be and a random accident
happening somewhere, there could be a road closure due to any kind of reason
and those things are not really predictable and that's the main reason
why you know a lot of companies have not been able to build this kind of system successfully. We will be using an ideology of Dynamic Programming while we
try to solve this problem. So basically what we will do is, we will try it for a
very small area, and then we will try to solve it for a larger area, and then even
larger area and then across cities and countries and so on and so forth. So
before we get started let me introduce you a concept called "Segment". Now this
is not an industry standard term I just made up this name on my own, so just keep
that in mind. A Segment is basically a small area that is small enough that we
can easily operate on to it. Think of it like this we can have segments of one
kilometer by one kilometer throughout the globe. So let's just say if you have
a city, something like this, what we'll do is we'll divide the city into multiple
segments. Now ideally there will be a lot more segments than what we are drawing
but for understanding this should be good enough, okay. Now the idea behind
these segments is that it will have four coordinates which are the four corners
of a Segment, through which we can identify the segment boundaries and each
segment would have an identifier. You can say this segment s1, this is s2, something
of that sort. Now the thing with segments is whether a point lies within a
particular segment? - is something we should be easily be able to calculate. 
So for example think of it like a coordinate system you have these x axis
and y axis, this is your point (0,0), this is your point (0,1), this is
your point (1,0) and let's say this is your point (1,1). This is your
square of one each, right. Now whether a point lies within this or outside this we can
easily identify based on what its coordinates are right and similarly for
this based on its XY coordinates we should be able to identify whether this
lies in this particular segment or not. So what we will try to do is each user
will try to map it to some segments basis their coordinates, right! Now one
good thing about these segments is because these are functions of Lat-Long,
we should easily be able to identify some approximate distance
between two segments. So let's just say if you want to identify this distance
between these this segment and this segment, right. So basically let's say if we come up with the center points of both of these and these are two
lat/longs we can easily find the distance between (aerial distance) between
these two points. We use this in the later sections but it's a very easy
mathematical calculation given two lat/longs, find the aerial distance
between these, right? Now what we'll actually do is, let's say the whole globe
for example, we will actually divide the whole globe into multiple
segments some of the segments would just have water and nothing else but most of
the segments would have some localities and we will be solving for one segment
each and then we will extend the solution for multiple segments segments
which will then cut across multiple cities and countries and whatnot, okay!!
Now the way we model the road network is like a graph. So think of two points
let's say this is point A and this is point B, and then the road between these
two points, okay. So this becomes one vertex(A), this becomes another vertex(B) and
the road between them can be represented as an edge. Now each road would have
a weight. Now will not have one weight like you normally have in usual graphs,
will have multiple weights. so let's say this road is of length 2 kilometers so one of
the weights on this road would be 2 We could have a bit more
weights along with that. We would have a traffic weight, we could have a
time-based weight. So let's just say we come up with the average number thing in
general it takes 150 seconds to cross this road, so 150 becomes another weight.
okay! So this is how we represent a particular road and similarly there could
be other weights that we can add. Now a road, even though it looks like a
non-directional thing, but it is actually are directed relationship. Normally
how would you represent it? - you'll say that this one Road from A to B which is 2
kilometers long, takes 150 seconds. There's also another road which is from B to A,
which is again two kilometers long, but this one probably takes 200 seconds
to cover, right! Why do we need a directed relationship here? -  Firstly in order to
handle if there is a different ETA or different traffic pattern or something
of that sort. Plus more importantly, if this says that it takes infinite amount
of time to reach here that's basically a way to say that it's a one-way Road. Only
you can go from point A to point B but not from B to A, right! So we can use all
of these ways to track various things like one ways or various different kinds
of roads. Now even though if it's a directed graph but for all the like
talking within this video I will draw a single line thinking of it as a non
directed relationship, because it makes the drawing easier and explanation
easier, but when you are actually going to implement it, you will implement it as
a directed relationship. Now let's look at what happens when you want to find
the distance between two points within a segment or even ETA or something of that
sort? So let's say this is a graph of all the roads, within a particular segment
and there are these ABCDEFGH... are the junctions or the points where you might
want to start or end from, and everything else is basically in edge. And
edges could have weights, assuming that all the edges have certain weight. Let's say this
edge has a weight of, first attribute is the length which could mean 2 kilometers the
next attribute might say that how much time it takes to cover that 2 kilometer. This would have a length of 5 kilometers and would take 700 seconds to
cover that. Now let's say if you want to go from point A to point C, how
can we go?   - There could be multiple routes. So one of the routes
could be from A to B to C. There could be another route from A to B to E to C
there could be another route from A to I to H to G to B to C and there could be
another, a lot more number of routes. How do you find the best route
from going from point A to point C? This is a very standard problem in the
Graph Data Structures, there are various algorithms to solve it. We can use
anything like a Dijkstra or a Bellman Ford Algorithm to come up with the shortest
path between point A to point C. Once you have calculated this and we
might as well decide to cache it. Because within a segment, it's good to
know how can you move from point A to point B. Normally what you would do is
you would run something like a Floyd-Warshall Algorithm, which calculates the
shortest path between all possible edges in all possible vertexes within a
particular segment and then store that information so that you do not have to
recalculate it. So what it will end up being is, there are these all
normal roads which are edges and then there could be a calculated edge also
which says that, for A to C, the shortest path takes ten kilometers, it takes two
thousand seconds and it is via Point A then B then E then C, something of
that sort could be a calculated edge as an output of Floyd-Warshall Algorithm,
which can be stored in another Data Store which can then be looked up if you
want to quickly look at how much time does it take from reaching a point A to
point C. Now what we looked at earlier was given a junction A and given a
junction C how do we calculate the shortest distance between those two
junctions. What if the point with what we are looking at is not really a junction
which is the meeting point of two roads but any random point in the globe which
just comes on a particular road. Let's say that point is X, okay. And now we want
to find the shortest distance between X and C. What that translates is basically
find this distance (X->A), lets you call it . Find this distance (X->B) let's say we call it J.
Basically find that two short... two or three closest junctions from that point.
Normally if that is on a road it'll just be two junctions right, and find the
shortest distance from those two junctions. So whatever is the distance
from A to C and B to C, add I and J respectively into that and then
whichever is the shortest one that becomes your answer. Now if you want to
extend it further and say that I want to find out the distance between X and Y? - 
What you basically mean to solve is A to C, the distance between A to C,
the distance between B to E, and then these two good respective distances
add it. So this (C->Y) is let's say  i`,  this(E->Y) is j` So what you want to do is a comparission
between [ i + i` + distance(A,C)] or this the distance of [ j + j` + distance (B,E) ] So this is how you
can handle any point even if it is not a junction. Now whenever you're calculating remember we looked at that we can use a
Floyd-Warshall Algorithm and then calculate all the possible distances
within a segment, right. What we should also do at that time is look at what all
possible exits are there some a Segment. Why that's important? we'll come to. 
Let's say there are these two roads which are exiting a particular segment. Let's
say this is a Exit 1(E1). Let's say this is a Exit 2(E2). And the segment Id
is let's say S1. So what we say is this particular Junction is S1E1 and this
particular Junction is S1E2. What we'll also calculate is distance of each
Junction not from just other junctions but also from these two points. So we
will also know that what is the shortest route from reach from C to S1E1
and from C to S1E2. And we'll store this also as a cached information. Now
let's come to how do we solve it across multiple segments. Now let's say if you
have this point A. From now on we will just look at junctions because that
makes the calculation easier okay. You want to calculate distance from point A
to point B and all these rectangles that you see are unique Segments and
these two points are in different Segments. Then how do you actually
calculate the distance between the two points and the same logic would be used
to calculate the ETA and anything between these two points okay. So what we
are essentially saying is, we have this point A and we have this point B. Now
given the lat/longs we would be able to identify an aerial distance between them.
Let's just say that the aerial distance between them is 10 kilometers, okay. 
We also know that each segment is one kilometer by one kilometer in length and
width right. So what we can say is we'll at max go... so because this is 10
kilometers on aerial distance, what we can say is.. adding some buffers we will
not cross more than 20 Segments on each directions either going from North to
South or going from East to West. That 20 number is basically a buffer that you
can come up with based on your conversation with your interviewer.
But the idea is this number(10 KMs) will give us some input onto how many segments do I
want to look at. So 20 segments on the North-South side and 20 segments on East-West side is what we'll look at to come up with the optimal route from point A to point
B. Because normally what would happen is there will be millions of roads into the
world. And if you start doing a Dijkstra across the whole globe just to
calculate distance between these two points, that will be very un-optimal. 
So we have to break that Dijkstra at some point in time. So this number would be used to
break that Dijkstra saying that we will not go further that beyond this point.
Now one obvious way to solve this is you have all the roads connecting the whole city
which cuts these two points as well. Run a Dijkstra across the city and then come
up with the shortest distance between point A to point B. But if you look at it
and if you look at it that way that there are probably millions of users
querying at the same time to find distance between any two points, Running
those many number of Dijkstra's Algorithms would be heavily inefficient.
So we'll do some slight optimization there. What we'll do is, there are... we'll
basically say that there are two exits out of this block(Segment having A). Basically to reach
this block(Segment having B) we need to exit this block and there are these two ways. Let's say if we have
calculated that these two are the only exists within this segment. Let's say this a
segment S1. So A belongs to S1 and these two are the exits, this is S1E1
and this is S1E2 and they have some great W 1 and W 2 let's say. 
Now what we'll do is, this segment... this junction is basically having two points.
One is S1E1.. two identifiers basically, S1E1 and S2E1. this is segment ID
S2 and this is exit number one of that segment so this has another identifier
for S2. What we are saying then is this has another point on the same route
which is S2E1 and weight between them zero. similarly there'll be a lot of points.
This graph will fan out. On the other side for B,
let's say B belongs to segment S4 there are another two exits through which you
can reach B. One is S4E2 and one is this one which is S4E1 even. Now if we just connect all the exits to exits for ten blocks(Segments) on the North side,
ten blocks(Segments) on the South side, ten blocks on this side and ten blocks on that side,
we'll basically be able to come up with a crisscross of a lot of Road which connects these four points right and there'll be a lot of junctions within
that, there'll be a lot of roads, but these will be basically just entry points and
exit points of the segments. We don't really care what are... what is happening
within the segment when we are cutting across segments. Why? -  because to reach
this segment we anyway need to cross all of the other segments right. Now we don't
care if this route which we are calling as let's say this is segment S6 and this
point is S6E1, this point is S6E2 Now this is basically a calculated
path from these two exit points. This exit point to that exit point basically.
This real path would look something like this right but we don't really care
what's happening within the segment. All we care about is from this point(S6E1) to this
point(S6E2), I know the distance, and I'll use that. Then from this point to this point I
know the distance I'll use that. So we'll basically be using all the exit points distances and use them as weights, and come up with this graph at runtime. Now given like ten 
segments on each side, we'll probably have this graph of a couple of hundreds of
edges at max right. Now we can run a Dijkstra on this graph staying with that
what is the shortest path to go from here(A) to here(B). This Dijkstra runs on
top of the graph which was created by just entry points and exit points in
everything else, and entry point and start point and entry point and end point in the
starting and ending segments. Everything else was just a connector
from individual end point to individuals basically exits of a particular segment.
Now this is fine when we have to travel for like ten odd kilometers we can still
create a graph of these 100-200 edges and calculate. What if you want to go
 inter-city? What if you want to go from City 1 to City 2 and then you
want to calculate it? Then it becomes a big trouble to... because let's say the
distance between those two city is thousand kilometers then there are
possibly thousands of segments multiple thousands of segments that you'll
look at, right. That would too complicated to run a Dijkstra at runtime. Now like we
extended the solution from one segment to multiple segments, we can basically
create a Mega-Segment, right? We can say this whole thing that you see
here is 1 Mega-Segment and there could be this exit to this Mega Segment this exit
to this Mega Segment and probably an exit here to this Mega Segment, right? And
then what we can say is, let's say you have this whole map of a country. I
know it looks terrible but let's say this is one country, what you can say this is 1
mega segment you can basically divide this country into mega segments.
And then recursively solve for it even further. Now when you were to if you are
to solve in the mega segment world you have basically converted this whole
country into possibly 50 mega segments and now if you want to go from here to
here, you basically need to just connect the exit points of individual
Mega Segments. You don't really care what is happening within a mega
segment, you don't really care what is happening within segments under those
mega segments and roads under those segments. All you care about it from my
start point how do I get to the nearest exit or all the exits of that mega
segment and from these exits of mega segments how do I get to further mega
segments recursively and then somehow reach this end point, right. Now you can
have n levels of nesting. Ideally three levels of nesting is more than enough.
Now what is the ideal size of this mega segment? - Again there is no right answer
you can come up with based on some calculation with your interview again on
this. But the idea if you still want to calculate this thing across cities or across states,  this segment approach would still not scale you need to do an
abstraction on top of segments which can be represented as a Mega-Segment and
then solve it recursively. All good so far but we have not really
talked about how do we come up with the weights on an edge and how do...what all weights do we even consider? So the very first obvious weight is the amount
of distance between two points right so that is one thing that will definitely have. 
Along with that we will also keep an ETA that normally under normal
traffic conditions, in the normal weather conditions, how much time does it take
for a user to go from point A to point B. Now when we have both these
information we can obviously keep a next obvious thing saying what is the average
speed of vehicles. Speed = (distance/time) so  basis that will
be able to come up with an average speed. Now you might think that the next
obvious you things are weights like traffic and weather condition and all of
that but I would definitely not recommend that. Even... let's assume
this is what we have build already and now somebody comes up and asks you to
implement traffic data into this okay now if you want to add traffic as a
weight onto your edges that'll be a very very bad design. Why? - Because with an
additional attribute that you are adding you are basically changing the logic of
your underlying Dijkstra which runs on a segment, right. Now let's say tomorrow
somebody comes up asking you for a weather information you will again
change the whole logic of your Dijkstra. That piece is a bad design, okay. So ideally..
basically the set of things that a good design should entail is basically that
it should not restrict addition of new features plus each change should be
small enough and contained. It should not basically impact the whole feature. 
So what we'll say is traffic and all all of those in things are basically attributes
which impact your speed okay and basis whatever your average speed is you can
calculate the ETA as a function of distance and average speed, right? 
So all we'll say is traffic, weather, roadblocks all of those they'll never be weights on your
graph, okay. They would just be attributes that impact your average speed. So
average speed would be a function of traffic, it could be a function of
weather it could be a function of any number of
fields that you want. Let's say if you want to add a accident, or construction work
going on someplace or whatever you want to add. So all of those would basically
impact your average speed. Now normally you don't have to do all these fancy
things, never ever! Why? - Because it's for a company like Google Maps they know...
let's say there are hundreds of people going from point A to point B. They 
anyway know how much time they took right plus a very important feature
about this kind of data is, this traffic data would always be normally
distributed. So if we want to plot, Let's say this is basically any metrics let's say
ETA of how much time it took for people to go from point A to point B on a graph
it would always look like a normal distribution, okay. What that means is you
do kwow that there is this point which most of the users are hitting and as a...
with some statistical calculations of one standard deviation from each of
these point you will be easily be able to calculate this range that normally for
most of your users at least 50-60-70% of your users, this is the
window of time that it will take. Let's say this is 5 seconds this is 7
seconds and let's say average is 6 seconds for example so statistically you can
come up with this number as a function of lot of users who are crossing the
roads. So you don't really care how much is the traffic, what is the weather, when
you anyway have this real-time information So for all the
geographies where you have people using your application, there you have organic
data from real users at this point in time so you don't really care about
traffic and all of that. Traffic and all other things will come into picture only
in places where you can either not get enough data from users or there is some
other reason why you're maybe legally not allowed to get information of users
right because of which if you don't have real data users, then is when you will
bother about using traffic and weather and all those attributes to come up
with this average speed number basis that you can even know the distance from
point A to point B, you can come up with a ETA, okay.
Now how do we quantify traffic? you cannot say that if there are 805
vehicles, it will take this much amount of time, right. The number of vehicles on
a road and things like that cannot be calculated at all. No matter how good
technology you build right. So when these things cannot be quantified how do you
use them as a measure? So what we can say is basically create multiple "Tiers".
Let's say this is traffic measurement and this is Weather Management. 
All you can say is traffic is low or it is medium or it is high and whether it is
good or it is bad, right. So you will have these kind of Tiers for each of the
attributes that you have and all you can say is every time traffic goes from here(Low)
to here(Medium), it has a 20% increase onto average speed or something of that sort.
right every time traffic goes from low to medium, average speed reduces by 20
percent. Basis these transitions of traffic volume... now you can always say that
traffic is low or high based on the number of users that are probably using
your application or from some other sources, right. Let's say you have this
kind of a measure, so there are companies like Waze and all, which will give you the
kind of information that how's the weather, how is the traffic in a very
abstracted form. Now once you have this information you can calculate
average speed as a relative number from the original value calculated. so let's
say with the good weather, with the medium traffic you knew the average
speed was later 20 kilometers per hour Now if the traffic goes to high, you
kind of reduce it by 20%, so it basically becomes 16 kilometers per hour. Basis is
this kind of a calculation, you will calculate the ETA. Now as and when
inputs are coming, you are making changes into your weights on the graph. How
does it impact the overall system? So coming back to the previous drawing that
we made remember we had something called as a segment and we had lots of roads
within the segment and let's say the traffic increase we got a signal from
some third party saying traffic has increased on a particular Road. Now do
whatever you want to. Now let's say there was this one exit point and one exit
point and distance between this was some Let's say there are some X weight to this
particular theoretically calculated road. And let's say it was actually
using this particular road on which the traffic is increased, let's say it 
actually was following this kind of a graph, something of that sort.
Now similarly all other roads are getting changed. So all you can say is remember
in this all the theoretically calculated roads that we have to be calculated we
were caching that what all real roads are a part of this theoretically
calculated road. Which is... it is not a real route, but a calculated edge. 
So each time this thing changes, weight changes on any real road, you basically
try to infer, what all actual cached roads are impacted. And then you
basically make a change into the cached roads also. So you say that okay the time
taken initially was 10 seconds, for this path, now it has become 15. So let me
increase the value of this particular calculated road from point E1 to E2 by 5 seconds Now let's say you do this for one
segment, then what basically happens is you recursively bubble it up over a lot of cached things. So let's say if there was a mega segment who's... 
who had this kind of an entry-exit point that this is ME1 and this was in ME2
and you know that ME1, the route from every ME1 to ME2 uses this E1-E2. So what
you will do is you will basically bubble up the amount of time for this route by 5
seconds. So what we are essentially saying is as then when you get traffic
data you basically update the ETA on a particular road. Then update the ETA on
all the calculated routes that this road is a part of. 
And update and then basically that becomes at a segment level. And then do the same
thing recursively for all the segments that are a part of a mega segment. 
So basically what you are doing is you're bubbling of all the calculated values
and then updating whole of the graph. Now these things are not happening
at once not all the signals are coming up at one, right. So as in when something
changes you bubble up till the level where it goes and then stop. So let's say this
road was not a part of this ME1 ME2 for example, then it will stop at the
segment level, right. But if it is a part of a mega segment road also, then it will
bubble up in the mega segment level. Now, other than just traffic and weather,
there's also one very important factor that you can use. So you can also use
historical ETAs to come up with a real or a predicted ETA for a particular Road.
And this historical ETA is basically calculated in a way that you
basically look at the day of week and the hour of day so let's say Monday, 5 p.m. this road takes 20 seconds to cover, but on Sundays 5 p.m. is this road
takes just 10 seconds to cover so something of that sort is what you can cache
at a level of a day of week and hour of day. And then use that historical data to
infer. So let's say if you do not have traffic information also, then you can use this
kind of an information to somehow come up with the predicted ETA.
Now coming back to the segment, due to some activities within the segment so let's
just say there are a lot of roads on the segment. There is there are these two
exit points and there are these points which have some roads now let's say
we've calculated that the ETA of fastest way to go from point
SE1 to SE2, involves 500 units of time. let's say 500 seconds, okay. And it uses
the route SE1 to A to B to C to SE2, okay. Now let's just say that there's a
traffic increase on A to B. Now we could identify it by a lot of attributes. Let's
just say people moving between A to B their average time increases right.
Or we get a signal saying you know the traffic is increasing significantly. For
whatever reason let's say we increase the time of
basically the ETA for going from point A to point B. So it would impact the ETA from
SE11 to SE2. Now there is a limit to which it can bubble up right so
let's say it increases from 500 to let's say 550 due to some increase in A to B
so all that is okay. But let's just say that we have real data of users, and for
some reason it is taking a lot of time for some people but we put to go from
point A to point B and let's just say this increases to let's say 850. Now a
jump from 500 units of time to 850 units of time is a very big jump. It is
having a.. roughly a 70% right. So now it is possible that the
fastest route from SE 1 to SE2 does not include this route ABC! It could be some
other route. So what we will do is if ETA increases or decreases, generally in case of increase only we'll do this. if ETA increases by greater than some
percentage. It's a configurable amount. Let's just say we have it set that if
the ETA increases by 30% then we recalculate things within that segment.
Because all the updates that you are getting are against a
segment only. So whenever a particular road's time increases you can
calculate everything within that segment, right. Which means recalculating paths from SE1 to SE2. Let's just say, that we figured out that
now the new shortest path is not this path and it is basically the pass from
SE1 to A to H to G to F to E and to SE2. So, this basically becomes your new shortest
path, right. Now if it is the shortest path, then we need to bubble up that
information, right. First of all we need to say that whoever was traveling from
SE1 to SE2, now needs to follow a new path right which is a path from
 SE1-A- H - G - F - E - SE2, right. This is one part of the things. But what if there was
a mega segment over here which encompasses a lot of segments, whose exit
points were also including this particular path. This is let us say ME1
and let's say ME2. Now if the exit point path of this
Mega Segment also includes this part then even that mega segments path would
change so the part where they use ABC now that would get converted into this,
right. So these are the things that you'll have to do each time a weight changes.
so when the increases beyond the threshold then you have to do. So let's
just say increase happen from 500 to 510 then all of this calculation is probably
not even worth it. Because the best you can get is probably somewhere between
500 to 510. Now let's say 10 seconds would not be too much of an enhancement
right. But if it is such a big jump from 500 to 850 for example then you might as
well recalculate everything within the segment and then bubble up whatever is
required. Now you'll not just calculate with respect to exit points, you'll also
calculate the shortest path to reach from let's say SE1 to A, or SE1 to B. 
All of those will also be calculated but for representation this was a good
enough way to explain you the concept. Now let's look at the architecture of
the whole system. So we will do it in two parts: First we'll look at the flow wherein all users are connected to the system
wherein we are capturing their location information from all the users even if
they are not using our map service. This is basically for improving our map
service altogether and a bit of user profiling. In the next section we'll look at
how does the actual navigation flow works for the user who want to find the
shortest route between two points and what are the systems required for that.
And at the end we'll look at some of the analytics. With that let's get started.
A bit of a convention to start with: Things in green are basically user devices
could be mostly these will be mobile phones, could be web browsers as well.
Things in black are load balancers plus reverse proxies plus an authentication
authorization layer in between which will authenticate all the external requests coming to the system.
Things in blue are the things that we have built on our own. It could be web services, Kafka
consumers or anything of that sort. Things in red are either some infrastructure
component that we've used or some databases or some clusters like Kafka, Hadoop and all of that, cool. So let's look at how the user flow begins.
The very first interaction with the user is when they when they have the app
installed on their phone, with their location services turn on, so we get
regular pings from a user's device every few seconds. Now if the user is
stationary, the device will have the logic to not send the location ping
every five seconds and maybe send it every five minutes or ten minutes or
something of that sort, because that will reduce the load on our system if the
user is anyway at the same point + Better battery life. But while the user is in transit, we will
increase the frequency, so as to make our data more accurate.
This talks to.. this basically keeps the persistent connection with the
device. The reason for a persistent connection is, so that we don't have to
create a new connection everytime. Also this would be generally a Websocket connection,
because sometimes we might need to send some information on to the user devices as well.
So this WebSocket handler is basically the service that talks to all
the user devices. Now there would normally be thousands of such WebSocket
handlers for talking to all the users that are currently online. So we need
somebody who can manage the fact that which handler machine is talking to
which user. So then comes something called as a Web Socket Manager. 
It basically keeps a track of which machine(read user) is connected to which WebSocket handler,
so which user device is basically connected to which machine of
this WebSocket Handler Service. It basically keeps that information in a
Redis. If let's say it lost that information is lost we can kind of pull
that information again from the servers. So we don't need to kind of store that
information in a persistent Data Store. The next thing what happens is, as in when
users are sending their locations the frequency of the location pings is
handled by the device and then the device location comes to us
basically coming at the Location Service. Now Location Service is basically a
repository of all the location related information . It basically has some
endpoints through which you can ingest some users information, something like a
user ID with the timestamp with a particular Lat/Long. That kind of
a structure. It puts all of that information into a Cassandra as a
permanent data source to keep a track of the fact that which user was at what
location at what point in time. Remember this is not just for users who are using
our app right now for navigation, but for all the users in the world. How this
data would help us we'll come to in a while. Now, as and when it's getting location
pings, it is also putting all of those pings into a Kafka.
All the location pings that are going into this Kafka, are basically
read by this Spark Streaming Consumer. This does a lot of calculations, 
some of them are here and some of them we look at in the later sections.
First of all what it does is, if let's say a lot of users are traveling at a place
where.. which we do not identify, okay. But their movement pattern tells
us it looks like a road. So this basically is a job which would be
a Streaming Job which would look at last ten minutes of data and see how the
users are moving and basically it'll be used to add new roads into our system.
Now as and when a new road is added each time a new road is added that would
basically impact the particular Segment within which the roads are added and
then basis that all the Segment related information that we calculated
earlier that we talked about earlier that would be recalculated. So that might impact
a lot of segments and Mega Segments recursively if that's a very critical new road that we've found. The next thing is
basically an average speed job. What that does is, it basically looks at again if
we look at within a segment a lot of people moving from point A to point B, it
tries to figure out what is the average speed that these users have over let's
say last fifteen twenty minutes and use that information to as a proxy for a
real-time information and then suggest that and basically it will then update the weights of the graph that we talked
about earlier. Again that would bubble up to various Segments and Mega
Segments if that's a part of a critical road. Now how would that bubble of
process happen? - So this Spark Streaming Job, individual jobs would actually write
back things into Kafka. So let's say if a new road is identified, it would write
that to a separate topic saying I've identified a new road which
connects point X to point Y. Now there will be a map update service which
listens to that particular topic and it updates it in a Data Store. It updates it
in a graphs Cassandra, which is managed by this Graph Processing
Service, so each time a new road is found, Map Update Service would invoke Graph
Processing Service to tell that I have found a new road just store that in your
Datastore which sits on top of a Cassandra. Now what this service is, we'll look
at in the next section in more detail. Now, each time average speed job finds out
there is some change that has happened it would again put an event into Kafka
in a separate topic now and there'll be something called as a Traffic Update
Service that listens to this topic which would update the traffic related
information again into the same Cassandra through Graph Processing Service.
There is something called as a Hotspot Identifier. So let's just say
there's a particular locality on which there is some average number of people
per given area kind of a metric that we have. Now let's have suddenly a lot of
people start gathering in that area it gives us a signal that there is some
activity happening at that point. It could be that there is some social
event, some sports thing happening or but something is happening there so that
could be able to identify hotspots within the graph. Because eventually once
we identify that hotspot we'll know that after probably a while, there will be a
lot of traffic in that area as well right. So that could help us in certain
ways. Now for certain things Spark Streaming would itself
insert a lot of information and put out events but in general it will dump all
of that data into Hadoop cluster, which has location pings of all the users
across a lot of time. Now we could do some ML Jobs onto it which
classify these certain other things. So let's say if you've identified a new
road but we do not know what kind of a road that is. If it's a one-way, if it's a
two-way Road, if it's a single lane road or maybe a six-lane Road. So all of those things would be identified by this Road Classifier and this particular job could now put that event into that road topic and Map Update Service could now store that additional information saying now that I have not just identified that
road but now I also know that this is a probably a six-lane Road or something of
that sort There could be something called as a Vehicle Identifier. While you are getting location pings, if you
start getting those pings at a very high frequency let's say every one
second if you are getting that you can input a lot of information about the
vehicle in which the person is traveling. So let's just say that the traffic is
going normal at certain pace but one particular person is stopping every few
kilometres let's say, okay. Now what that could mean that could mean that either
there's a red light or there's a traffic jam there, possibly. But we know what are
the junctions you know where the red lights can be we know how the
traffic jam are because we know the data for the user as well. Now if it's not
any of these two criteria then that means that the person is traveling in a
public transport something like a bus and then the bus is stopping at each bus
stop, all right. Other kind of things that we can infer is if let's say the ride is
bumpy or if the person is going left and right here and there very frequently or
having a very fast acceleration and very fast breaking it's probably a two wheeler.
if not in all other scenarios if it's a smooth enough right stable enough
acceleration going straight in one road it is very likely a four-wheeler. Now we
do tell information to Google specifically that we are actually
traveling in a two wheeler or four wheeler while we select a map but if
let's say that option is not available then this kind of data would be good
enough to infer which kind of vehicle a person is traveling in, which will help
us in a lot of other attributes. So these individual jobs what all they identify
they could put that into back into the same Kafka in probably a separate topic for each job and then those information could be
analysed even further. Now let's look at the user journey when they want to
actually get the navigation from point A to point B. So normally what people do is
they search for a particular location which then gets converted into a
particular lat/long right. So all of those is being done by Area Search
Service. This basically does two kind of things. One is, it has some areas within
Elastic Search on which it provides fuzzy searching and once the person has search
for a particular area or locality or location anything. It then
gets converted into a lat/long. So basically it stores the lat/long along
with the place name, description all of that, in a document. The other thing is it
tries to dynamically figure out: Given an address kind of a thing which lat/long
that address points to. So it does that address resolution into a lat/long as well.
Now let's say... so post the response from this user will have a start point
and end point as a latitude longitude both of them and then they would want to
request the path, okay. First let's quickly go over what is this Navigation
Tracking Service. So while the person is actually started the navigation and
they're going towards the destination all of their location coordinates will
be tracked as part of Navigation Tracking Service. This does two main things:
1)  If the user is deviating from the route that we suggested, we will kind of inform
the app back and then that will probably show a pop-up kind of a thing, saying that
you are probably going wrong, maybe you want to course-correct to the right path.
2) It will also store all the data so it will push all of the data
into Kafka, while the person is traveling then that data could be used for later
analysis saying, at this point in time a person searched for a route from point A
to point B, and this was the route that we recommended. It could be used for
figuring out how good the recommendation of the path is. That being said, let's
jump to the main piece which actually figures out how to connect point A to
point B, okay. So all of those requests are being handled by this Map Service.
This Map Service over here is basically an interface service which provides
multiple interfaces for people to request the directions from some point
to some point. One of the interface is given to the user devices. A similar
interface could be given out to companies where in all the rate-limiting
and their throughput calculation against their account information is being
calculated and stored, okay. It's not an intelligent service it just
forwards the request to something called as a Graph Processing
Service. Graph Processing Service basically does a lot of things. 
First of all it queries Segment Service which sits on top of its own Database of
Cassandra, in which it stores all the segments and their corner coordinates
along with a lot of information of those segments. So let's see if they if the
Graph Processing Service wants to figure out that what are the segment's for the
start point and the end point, it will get that information on the
Segment Service. Now if it so happens that both the points are within the same
segment then it's a short duration ride. Then the Graph Processing Service might choose to
do a couple of things it might look up that, Do have this
data already cached? if yes, it will directly return to the Map Service saying there is a response. If not, it'll then decide what do I do next?
It can now if it is the same segment it can probably say that I will run a
proper Dijkstra's algorithm and then try to figure out the shortest path between
the two points. It can do that and then return the response. Alternatively, if
it's in different segments then it will try to fan out into the whole basically
it will try to create a pick the sub graph of the main whole world's graph
that we want to look up as part of the Dijkstra and run it, okay. Now for doing
that it will look up on a lot of things. First of all it will look up for all the
roads within those segments, the entry-exit points of the segments,
into its Cassandra. It will also have live traffic information which would
have updated the ETAs into the graph again from the same Cassandra. Now it would have also got some input from something called as a Third Party Data Manager. Now it doesn't query Third Party Data Manager at runtime. Third Party Data Manager in fact, pushes data into Graph Service which then
impacts the live traffic information so let's say if it says that there is a
huge amount of traffic at certain point it'll update that. Let's say if it says
that there is a massive kind of a rain happening somewhere, it will update the
live traffic information thing there is some rain and that would probably cause some delays and the average speed would slow down and ETA would increase,
something of that sort. Now using all of that information it basically creates
the whole graph that we looked at in the previous sections and then it either
looks up in the cache and returns the result or it might run the Dijkstra's Algorithm or some Algorithm to basically figure out the shortest path between two
points and then return the result. let's say if it doesn't have any traffic
information, any ETA information it might also query Historical Data Service to find out at this point in time how much ETA can expect from point A to point B. if it doesn't have that information for some of the points. Now Historical Data Service sits on top of its own Cassandra which basically stores the information of the form that at some day, day of the week like Sunday, Monday, Tuesday in some hour, let's say 4 PM, 5 PM, something of that sort, from point A to point B, how much
was the average speed of people normally and how much ETA did it take. So all of that kind of information would be stored in Historical Data Service. Bases all of that, Graph Processing Service will return back the response to Map Service
and then to the user going by the exact same set of logic that we looked at in
the previous sections. Now all of this is done a lot of events have gone
into Kafka. One of the common events was that by the Area Search Service which we
didn't go over. So each time a search is happening the service will put an event
into Kafka. Now what that would do is it will basically give us a list of areas
that are being searched most often. So we can do some optimizations for them.
Another thing would happen is, so not we can do a lot
of analytic on top of this data okay that is coming into Kafka. One of the
very first thing we need to do is to figure out that out of all the third
party that we are integrated with which of them is actually giving right
information and which of them is actually given the wrong information. How
do we do that? So let's say some third party gave us some
information saying from point A to point B, there is a lot of traffic, and
ETAs would increase. But our data if it says that ETAs have not been impacted at
all, that means that particular information was incorrect, right. Now if
that happens from the same Third Party a lot of times, then we can safely say
that, that third party has a wrong information or it gives us wrong information. right. Now this Third Party Data Manager, abstracts out on a lot of third party companies, so we could be pulling data from a lot of companies all of that is abstracted under this Third Party Data Manager but the reporting
would be done at an individual organization level. That being said, there
are a lot of other kinds of analytics that we might want to do. First of all we
might want to identify what is the road that a particular person is on, right? so
as part of navigation you want to probably have a audio kind of a thing
saying turn right in ninety meters to get on Mahatma Gandhi Road,or something of
that sort, right. All of that inferences could be done by the Spark Streaming
saying where exactly I am in how much time am I about to reach a
junction and what is the road name on which I will get to next. So all of that
could be done by this. There are a lot of other analytics that we could also do on
top of this data. Let us look at it next. So out of all the events that are being
put into this Kafka, there is a lot of analytics that we can do and we should
do. So one of the very important things to analyze is how accurate our ETA
predictions are? So let's just say we predicted that it will take 40 minutes
to cover a distance from point A to point B and if it takes something around
38-39 minutes then that's fairly accurate. But if in real world it takes somewhere
around 20 minutes then that's a fairly bad prediction. So we need to have this
data on how accurate our predictions are so that we can figure out that we need
to invest more time into you know upgrading that algorithm that comes up
with the ETAs. Along with that it will also give us some information about
which of the routes are the ones that we are recommending to people, but people
are not taking. Maybe there is something wrong with the routes that exist in our
database, right. So all of those things could also be inferred. Some common things
that we can infer is what are some common hotspots in the city that people
gather at. These could be some social gathering places or things of that sort.
So that will kind of give us some points of interest that we can build over time
using this data to start with. Other than that some obvious things that we can also
figure out is, what are the home locations and work locations of some of
the people. We could also infer user profile data. So for example if a person
is going to a lot of pubs for example then they are more of a social kind of a
person. If a person is traveling outside the city very frequently on
weekends, the person likes travelling. So things like that can also be inferred
basis just a location data. Coming to the last thing, now this normally wouldn't be
a part of a design interview but there's something you should be aware of because
this is an important thing that companies like Google Maps have to take
care of. So how do you handle disputed areas? So while in Google Maps there is a
clear-cut boundary of states and countries and all of that but if there
is a disputed region how does Google Maps decide where to make the boundary of the
country or state right. So a classic example of this would be a dispute
between the countries of India, Pakistan and China in the state of Jammu and
Kashmir. So India claims that whole of the land is under their territory. China
claims that some of the parts of that state belongs to China and Pakistan
claims that some of the parts of that state belongs to Pakistan. So now how
does Google decide or any such mapping provider decides, that how where do they
define the country boundaries, right. Now this becomes very tricky for Google
because they cannot take anybody's side and whichever decision they make they
are going to kind of piss off some of the countries. Plus that's even worse
in this scenario because these three countries combined together have more
than one third of the world's population. So that's a very rich source of revenue
for Google. So how can you handle? -  so what Google does is something very smart and
also very tricky. So what they do is, based on the country where you are coming from
they'll show you a different country boundary. So for people who are coming
from India, to all of those people they show that the whole part belongs to
India. Now to the people of Pakistan they show that the part that they are
claiming belongs to Pakistan and the parts that are disputed between India
and China are shown as the dotted line. Similarly for people coming from China
they show the part that China claims is theirs they show under China's
territory and remaining disputed area between India and Pakistan is shown as a
dotted line with no country boundary specified. So this is something if if you
come across this kind of the thing in an interview could try to replicate but
keep this out of the scope of the interview at least, but still something
good to know. So yeah I think this is it for Google Maps kind of a system.

---
