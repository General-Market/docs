//! Typed observer primitives for event wiring between components.
//!
//! These provide a uniform interface for connecting components via events.
//! Instead of passing raw channel senders/receivers, components expose
//! `SingleObserver<T>` or `Broadcast<T>` that are wired at construction time.
//!
//! `notify()` is always non-blocking and never panics — if nobody is listening,
//! the event dissolves into nothing, as most things do.

use std::fmt;
use tokio::sync::{broadcast, mpsc};

/// An observer that forwards events to exactly one consumer.
/// Wraps a `tokio::mpsc::UnboundedSender<T>`.
pub struct SingleObserver<T: Send + 'static> {
    sender: Option<mpsc::UnboundedSender<T>>,
}

impl<T: Send + 'static> SingleObserver<T> {
    /// Create an unwired observer. Events sent before wiring are silently dropped.
    pub fn new() -> Self {
        Self { sender: None }
    }

    /// Create a connected observer-receiver pair.
    pub fn channel() -> (Self, mpsc::UnboundedReceiver<T>) {
        let (tx, rx) = mpsc::unbounded_channel();
        (Self { sender: Some(tx) }, rx)
    }

    /// Wire this observer to a sender. Replaces any existing wiring.
    pub fn set(&mut self, sender: mpsc::UnboundedSender<T>) {
        self.sender = Some(sender);
    }

    /// Returns true if an observer has been wired.
    pub fn is_wired(&self) -> bool {
        self.sender.is_some()
    }

    /// Publish an event to the observer. No-op if not wired or if the receiver
    /// has been dropped.
    pub fn notify(&self, event: T) {
        if let Some(ref sender) = self.sender {
            let _ = sender.send(event);
        }
    }
}

impl<T: Send + 'static> Default for SingleObserver<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Send + 'static> fmt::Debug for SingleObserver<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self.is_wired() {
            write!(f, "SingleObserver(wired)")
        } else {
            write!(f, "SingleObserver(unwired)")
        }
    }
}

/// An observer that broadcasts events to multiple consumers.
/// Wraps a `tokio::sync::broadcast::Sender<T>`.
pub struct Broadcast<T: Clone + Send + 'static> {
    sender: broadcast::Sender<T>,
}

impl<T: Clone + Send + 'static> Broadcast<T> {
    /// Create with specified channel capacity.
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    /// Subscribe a new receiver.
    pub fn subscribe(&self) -> broadcast::Receiver<T> {
        self.sender.subscribe()
    }

    /// Publish an event to all subscribers. Returns number of receivers that got it.
    /// Returns 0 if nobody is listening.
    pub fn notify(&self, event: T) -> usize {
        self.sender.send(event).unwrap_or(0)
    }

    /// Returns the number of active subscribers.
    pub fn subscriber_count(&self) -> usize {
        self.sender.receiver_count()
    }
}

impl<T: Clone + Send + 'static> fmt::Debug for Broadcast<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Broadcast(subscribers={})", self.subscriber_count())
    }
}

/// Wire a `SingleObserver` to a closure that runs on each event.
/// Returns a `JoinHandle` for the spawned task.
pub fn observe<T, F>(observer: &mut SingleObserver<T>, handler: F) -> tokio::task::JoinHandle<()>
where
    T: Send + 'static,
    F: Fn(T) + Send + 'static,
{
    let (tx, mut rx) = mpsc::unbounded_channel();
    observer.set(tx);
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            handler(event);
        }
    })
}

/// Wire a `Broadcast` to a closure that runs on each event.
/// Returns a `JoinHandle` for the spawned task.
pub fn observe_broadcast<T, F>(
    broadcast: &Broadcast<T>,
    handler: F,
) -> tokio::task::JoinHandle<()>
where
    T: Clone + Send + 'static,
    F: Fn(T) + Send + 'static,
{
    let mut rx = broadcast.subscribe();
    tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            handler(event);
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    #[tokio::test]
    async fn single_observer_channel_delivers_events() {
        let (observer, mut rx) = SingleObserver::<u64>::channel();
        observer.notify(42);
        observer.notify(99);

        assert_eq!(rx.recv().await, Some(42));
        assert_eq!(rx.recv().await, Some(99));
    }

    #[tokio::test]
    async fn single_observer_set_wires_after_creation() {
        let mut observer = SingleObserver::<String>::new();
        assert!(!observer.is_wired());

        let (tx, mut rx) = mpsc::unbounded_channel();
        observer.set(tx);
        assert!(observer.is_wired());

        observer.notify("hello".to_string());
        assert_eq!(rx.recv().await, Some("hello".to_string()));
    }

    #[tokio::test]
    async fn single_observer_unwired_notify_is_silent() {
        let observer = SingleObserver::<i32>::new();
        // Must not panic
        observer.notify(1);
        observer.notify(2);
        observer.notify(3);
    }

    #[tokio::test]
    async fn single_observer_default_is_unwired() {
        let observer = SingleObserver::<u8>::default();
        assert!(!observer.is_wired());
    }

    #[tokio::test]
    async fn single_observer_debug_format() {
        let unwired = SingleObserver::<u8>::new();
        assert_eq!(format!("{:?}", unwired), "SingleObserver(unwired)");

        let (wired, _rx) = SingleObserver::<u8>::channel();
        assert_eq!(format!("{:?}", wired), "SingleObserver(wired)");
    }

    #[tokio::test]
    async fn broadcast_delivers_to_multiple_subscribers() {
        let bc = Broadcast::<u64>::new(16);
        let mut rx1 = bc.subscribe();
        let mut rx2 = bc.subscribe();

        assert_eq!(bc.subscriber_count(), 2);

        let count = bc.notify(42);
        assert_eq!(count, 2);

        assert_eq!(rx1.recv().await.unwrap(), 42);
        assert_eq!(rx2.recv().await.unwrap(), 42);
    }

    #[tokio::test]
    async fn broadcast_no_subscribers_returns_zero() {
        let bc = Broadcast::<u64>::new(16);
        assert_eq!(bc.notify(1), 0);
    }

    #[tokio::test]
    async fn broadcast_debug_format() {
        let bc = Broadcast::<u8>::new(4);
        assert_eq!(format!("{:?}", bc), "Broadcast(subscribers=0)");

        let _rx = bc.subscribe();
        assert_eq!(format!("{:?}", bc), "Broadcast(subscribers=1)");
    }

    #[tokio::test]
    async fn observe_helper_spawns_task_and_handles_events() {
        let mut observer = SingleObserver::<u64>::new();
        let collected = Arc::new(Mutex::new(Vec::new()));
        let collected_clone = collected.clone();

        let handle = observe(&mut observer, move |event| {
            let c = collected_clone.clone();
            // We're in a sync closure, so use try_lock (task is single-threaded per event)
            c.try_lock().unwrap().push(event);
        });

        observer.notify(10);
        observer.notify(20);
        observer.notify(30);

        // Drop the observer to close the channel, which ends the spawned task
        drop(observer);
        handle.await.unwrap();

        let result = collected.lock().await;
        assert_eq!(*result, vec![10, 20, 30]);
    }

    #[tokio::test]
    async fn observe_broadcast_helper_spawns_task() {
        let bc = Broadcast::<String>::new(16);
        let collected = Arc::new(Mutex::new(Vec::new()));
        let collected_clone = collected.clone();

        let handle = observe_broadcast(&bc, move |event| {
            collected_clone.try_lock().unwrap().push(event);
        });

        bc.notify("alpha".to_string());
        bc.notify("beta".to_string());

        // Drop broadcast sender to close the channel
        drop(bc);
        handle.await.unwrap();

        let result = collected.lock().await;
        assert_eq!(*result, vec!["alpha".to_string(), "beta".to_string()]);
    }
}
