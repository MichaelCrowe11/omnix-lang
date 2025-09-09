/*!
 * Conflict-free Replicated Data Types (CRDTs) for OMNIX
 */

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::cmp::Ordering;

/// G-Counter (Grow-only counter)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCounter {
    counts: HashMap<String, u64>,
    node_id: String,
}

impl GCounter {
    pub fn new(node_id: String) -> Self {
        Self {
            counts: HashMap::new(),
            node_id,
        }
    }
    
    pub fn increment(&mut self) {
        *self.counts.entry(self.node_id.clone()).or_insert(0) += 1;
    }
    
    pub fn value(&self) -> u64 {
        self.counts.values().sum()
    }
    
    pub fn merge(&mut self, other: &GCounter) {
        for (node, count) in &other.counts {
            let current = self.counts.entry(node.clone()).or_insert(0);
            *current = (*current).max(*count);
        }
    }
}

/// PN-Counter (Positive-Negative counter)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PNCounter {
    positive: GCounter,
    negative: GCounter,
}

impl PNCounter {
    pub fn new(node_id: String) -> Self {
        Self {
            positive: GCounter::new(node_id.clone()),
            negative: GCounter::new(node_id),
        }
    }
    
    pub fn increment(&mut self) {
        self.positive.increment();
    }
    
    pub fn decrement(&mut self) {
        self.negative.increment();
    }
    
    pub fn value(&self) -> i64 {
        self.positive.value() as i64 - self.negative.value() as i64
    }
    
    pub fn merge(&mut self, other: &PNCounter) {
        self.positive.merge(&other.positive);
        self.negative.merge(&other.negative);
    }
}

/// LWW-Map (Last-Write-Wins Map)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LWWMap<V> {
    entries: HashMap<String, (V, Timestamp)>,
    node_id: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct Timestamp {
    time: u64,
    node_id_hash: u64,
}

impl<V: Clone> LWWMap<V> {
    pub fn new(node_id: String) -> Self {
        Self {
            entries: HashMap::new(),
            node_id,
        }
    }
    
    pub fn set(&mut self, key: String, value: V) {
        let timestamp = Timestamp {
            time: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            node_id_hash: self.hash_node_id(),
        };
        
        self.entries.insert(key, (value, timestamp));
    }
    
    pub fn get(&self, key: &str) -> Option<&V> {
        self.entries.get(key).map(|(v, _)| v)
    }
    
    pub fn merge(&mut self, other: &LWWMap<V>) {
        for (key, (value, timestamp)) in &other.entries {
            match self.entries.get(key) {
                Some((_, existing_ts)) if existing_ts >= timestamp => {
                    // Keep existing value
                }
                _ => {
                    // Take new value
                    self.entries.insert(key.clone(), (value.clone(), *timestamp));
                }
            }
        }
    }
    
    fn hash_node_id(&self) -> u64 {
        // Simple hash for demo
        self.node_id.bytes().fold(0, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64))
    }
}

/// OR-Set (Observed-Remove Set)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ORSet<T: Clone + Eq + std::hash::Hash> {
    elements: HashMap<T, HashSet<UniqueTag>>,
    node_id: String,
    counter: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct UniqueTag {
    node_id: String,
    counter: u64,
}

impl<T: Clone + Eq + std::hash::Hash> ORSet<T> {
    pub fn new(node_id: String) -> Self {
        Self {
            elements: HashMap::new(),
            node_id,
            counter: 0,
        }
    }
    
    pub fn add(&mut self, element: T) {
        let tag = UniqueTag {
            node_id: self.node_id.clone(),
            counter: self.counter,
        };
        self.counter += 1;
        
        self.elements
            .entry(element)
            .or_insert_with(HashSet::new)
            .insert(tag);
    }
    
    pub fn remove(&mut self, element: &T) {
        self.elements.remove(element);
    }
    
    pub fn contains(&self, element: &T) -> bool {
        self.elements.contains_key(element)
    }
    
    pub fn merge(&mut self, other: &ORSet<T>) {
        for (element, tags) in &other.elements {
            self.elements
                .entry(element.clone())
                .or_insert_with(HashSet::new)
                .extend(tags.clone());
        }
    }
    
    pub fn elements(&self) -> Vec<T> {
        self.elements.keys().cloned().collect()
    }
}

/// Vector Clock for causal ordering
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorClock {
    clocks: HashMap<String, u64>,
    node_id: String,
}

impl VectorClock {
    pub fn new(node_id: String) -> Self {
        Self {
            clocks: HashMap::new(),
            node_id,
        }
    }
    
    pub fn increment(&mut self) {
        *self.clocks.entry(self.node_id.clone()).or_insert(0) += 1;
    }
    
    pub fn update(&mut self, other: &VectorClock) {
        for (node, clock) in &other.clocks {
            let current = self.clocks.entry(node.clone()).or_insert(0);
            *current = (*current).max(*clock);
        }
        self.increment();
    }
    
    pub fn compare(&self, other: &VectorClock) -> CausalOrder {
        let mut less = false;
        let mut greater = false;
        
        let all_nodes: HashSet<_> = self.clocks.keys()
            .chain(other.clocks.keys())
            .collect();
        
        for node in all_nodes {
            let self_clock = self.clocks.get(node).copied().unwrap_or(0);
            let other_clock = other.clocks.get(node).copied().unwrap_or(0);
            
            match self_clock.cmp(&other_clock) {
                Ordering::Less => less = true,
                Ordering::Greater => greater = true,
                Ordering::Equal => {}
            }
        }
        
        match (less, greater) {
            (true, false) => CausalOrder::Before,
            (false, true) => CausalOrder::After,
            (false, false) => CausalOrder::Equal,
            (true, true) => CausalOrder::Concurrent,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CausalOrder {
    Before,
    After,
    Equal,
    Concurrent,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_g_counter() {
        let mut counter1 = GCounter::new("node1".to_string());
        let mut counter2 = GCounter::new("node2".to_string());
        
        counter1.increment();
        counter1.increment();
        counter2.increment();
        
        assert_eq!(counter1.value(), 2);
        assert_eq!(counter2.value(), 1);
        
        counter1.merge(&counter2);
        assert_eq!(counter1.value(), 3);
        
        counter2.merge(&counter1);
        assert_eq!(counter2.value(), 3);
    }
    
    #[test]
    fn test_or_set() {
        let mut set1 = ORSet::new("node1".to_string());
        let mut set2 = ORSet::new("node2".to_string());
        
        set1.add("apple");
        set1.add("banana");
        set2.add("banana");
        set2.add("cherry");
        
        set1.merge(&set2);
        
        assert!(set1.contains(&"apple"));
        assert!(set1.contains(&"banana"));
        assert!(set1.contains(&"cherry"));
        
        let elements = set1.elements();
        assert_eq!(elements.len(), 3);
    }
}