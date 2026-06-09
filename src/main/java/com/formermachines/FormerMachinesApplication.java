package com.formermachines;

import com.formermachines.model.*;
import com.formermachines.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Service;

import java.util.*;

@SpringBootApplication
public class FormerMachinesApplication {

    public static void main(String[] args) {
        SpringApplication.run(FormerMachinesApplication.class, args);
    }

    // Dijkstra Pathfinding Service Bean
    @Service
    public static class PathfindingService {
        private final RoadRepository roadRepository;

        public PathfindingService(RoadRepository roadRepository) {
            this.roadRepository = roadRepository;
        }

        public static class PathResult {
            private final double distance;
            private final List<String> path;

            public PathResult(double distance, List<String> path) {
                this.distance = distance;
                this.path = path;
            }

            public double getDistance() { return distance; }
            public List<String> getPath() { return path; }
        }

        public PathResult getShortestPath(String start, String end) {
            if (start.equalsIgnoreCase(end)) {
                return new PathResult(0.0, Collections.singletonList(start));
            }

            List<Road> roads = roadRepository.findAll();
            
            // Build adjacency list
            Map<String, Map<String, Double>> graph = new HashMap<>();
            Set<String> nodes = new HashSet<>();

            for (Road road : roads) {
                String u = road.getU();
                String v = road.getV();
                double dist = road.getDistance();

                nodes.add(u);
                nodes.add(v);

                graph.putIfAbsent(u, new HashMap<>());
                graph.putIfAbsent(v, new HashMap<>());

                graph.get(u).put(v, dist);
                graph.get(v).put(u, dist);
            }

            if (!nodes.contains(start) || !nodes.contains(end)) {
                return new PathResult(Double.MAX_VALUE, Collections.emptyList());
            }

            // Dijkstra Algorithm
            Map<String, Double> distances = new HashMap<>();
            Map<String, String> previous = new HashMap<>();
            PriorityQueue<String> queue = new PriorityQueue<>(Comparator.comparingDouble(distances::get));

            for (String node : nodes) {
                distances.put(node, Double.MAX_VALUE);
                previous.put(node, null);
            }

            distances.put(start, 0.0);
            queue.add(start);

            while (!queue.isEmpty()) {
                String current = queue.poll();

                if (current.equalsIgnoreCase(end)) {
                    break;
                }

                Map<String, Double> neighbors = graph.getOrDefault(current, Collections.emptyMap());
                for (Map.Entry<String, Double> neighborEntry : neighbors.entrySet()) {
                    String neighbor = neighborEntry.getKey();
                    double weight = neighborEntry.getValue();

                    double alt = distances.get(current) + weight;
                    if (alt < distances.get(neighbor)) {
                        queue.remove(neighbor);
                        distances.put(neighbor, alt);
                        previous.put(neighbor, current);
                        queue.add(neighbor);
                    }
                }
            }

            double finalDist = distances.getOrDefault(end, Double.MAX_VALUE);
            if (finalDist == Double.MAX_VALUE) {
                return new PathResult(Double.MAX_VALUE, Collections.emptyList());
            }

            // Reconstruct path
            List<String> path = new LinkedList<>();
            String curr = end;
            while (curr != null) {
                path.add(0, curr);
                curr = previous.get(curr);
            }

            return new PathResult(finalDist, path);
        }
    }

    // Database seeding script
    @Bean
    public CommandLineRunner seedDatabase(
            VillageRepository villageRepository,
            RoadRepository roadRepository,
            UserRepository userRepository,
            EquipmentRepository equipmentRepository) {
        return args -> {
            // 1. Seed Villages
            Village rampur = villageRepository.save(Village.builder().name("Rampur").xCoord(35).yCoord(50).build());
            Village pipri = villageRepository.save(Village.builder().name("Pipri").xCoord(55).yCoord(35).build());
            Village kalyanpur = villageRepository.save(Village.builder().name("Kalyanpur").xCoord(15).yCoord(65).build());
            Village sonpur = villageRepository.save(Village.builder().name("Sonpur").xCoord(75).yCoord(25).build());
            Village bilaspur = villageRepository.save(Village.builder().name("Bilaspur").xCoord(25).yCoord(85).build());
            Village rajpur = villageRepository.save(Village.builder().name("Rajpur").xCoord(90).yCoord(15).build());
            Village gopalpur = villageRepository.save(Village.builder().name("Gopalpur").xCoord(95).yCoord(45).build());

            // 2. Seed Roads (weights)
            roadRepository.save(Road.builder().u("Rampur").v("Pipri").distance(5.0).build());
            roadRepository.save(Road.builder().u("Rampur").v("Kalyanpur").distance(8.0).build());
            roadRepository.save(Road.builder().u("Pipri").v("Sonpur").distance(6.0).build());
            roadRepository.save(Road.builder().u("Kalyanpur").v("Sonpur").distance(4.0).build());
            roadRepository.save(Road.builder().u("Kalyanpur").v("Bilaspur").distance(12.0).build());
            roadRepository.save(Road.builder().u("Sonpur").v("Rajpur").distance(9.0).build());
            roadRepository.save(Road.builder().u("Bilaspur").v("Rajpur").distance(5.0).build());
            roadRepository.save(Road.builder().u("Rajpur").v("Gopalpur").distance(7.0).build());

            // 3. Seed Farmers
            User rajesh = userRepository.save(User.builder()
                    .phone("9876543210")
                    .name("Rajesh Kumar")
                    .role("FARMER")
                    .currentVillage(rampur)
                    .build());
            userRepository.save(User.builder()
                    .phone("8765432109")
                    .name("Ramesh Singh")
                    .role("FARMER")
                    .currentVillage(pipri)
                    .build());
            userRepository.save(User.builder()
                    .phone("7654321098")
                    .name("Suresh Yadav")
                    .role("FARMER")
                    .currentVillage(kalyanpur)
                    .build());

            // 4. Seed Owners
            User amit = userRepository.save(User.builder()
                    .phone("9988776655")
                    .name("Amit Patel")
                    .role("OWNER")
                    .aadhaar("123456789012")
                    .drivingLicense("DL12345")
                    .isAvailable(true)
                    .currentVillage(sonpur)
                    .build());
            User vijay = userRepository.save(User.builder()
                    .phone("8877665544")
                    .name("Vijay Verma")
                    .role("OWNER")
                    .aadhaar("234567890123")
                    .drivingLicense("DL23456")
                    .isAvailable(true)
                    .currentVillage(bilaspur)
                    .build());
            User harpreet = userRepository.save(User.builder()
                    .phone("7766554433")
                    .name("Harpreet Singh")
                    .role("OWNER")
                    .aadhaar("345678901234")
                    .drivingLicense("DL34567")
                    .isAvailable(true)
                    .currentVillage(rajpur)
                    .build());

            // 5. Seed Admin
            userRepository.save(User.builder()
                    .phone("8187872374")
                    .name("Admin")
                    .role("ADMIN")
                    .aadhaar("999999999999")
                    .drivingLicense("ADMIN00")
                    .isAvailable(true)
                    .currentVillage(rampur)
                    .build());

            // 5. Seed Equipment
            equipmentRepository.save(Equipment.builder()
                    .owner(amit)
                    .type("TRACTOR")
                    .brandModel("John Deere 5050D")
                    .regNumber("UP-15-AB-1234")
                    .costPerHour(500.0)
                    .acresPerHour(1.2)
                    .description("High-performance heavy tilling tractor")
                    .currentVillage(sonpur)
                    .status("AVAILABLE")
                    .build());
            equipmentRepository.save(Equipment.builder()
                    .owner(amit)
                    .type("TRACTOR")
                    .brandModel("Mahindra Arjun 555")
                    .regNumber("UP-15-CD-5678")
                    .costPerHour(450.0)
                    .acresPerHour(1.0)
                    .description("Reliable medium-duty farming tractor")
                    .currentVillage(sonpur)
                    .status("AVAILABLE")
                    .build());
            equipmentRepository.save(Equipment.builder()
                    .owner(vijay)
                    .type("TRACTOR")
                    .brandModel("Kubota MU4501")
                    .regNumber("UP-16-EF-9012")
                    .costPerHour(480.0)
                    .acresPerHour(1.1)
                    .description("Ergonomic tilling tractor with low fuel consumption")
                    .currentVillage(bilaspur)
                    .status("AVAILABLE")
                    .build());
            equipmentRepository.save(Equipment.builder()
                    .owner(vijay)
                    .type("HARVESTER")
                    .brandModel("Preet 987")
                    .regNumber("UP-16-GH-3456")
                    .costPerHour(1500.0)
                    .acresPerHour(2.5)
                    .description("Combine harvester ideal for paddy and wheat crops")
                    .currentVillage(bilaspur)
                    .status("AVAILABLE")
                    .build());
            equipmentRepository.save(Equipment.builder()
                    .owner(harpreet)
                    .type("ROTAVATOR")
                    .brandModel("Sonalika Tiger")
                    .regNumber("UP-17-JK-7890")
                    .costPerHour(300.0)
                    .acresPerHour(1.5)
                    .description("7-feet rotavator attachment for soil preparation")
                    .currentVillage(rajpur)
                    .status("AVAILABLE")
                    .build());
            equipmentRepository.save(Equipment.builder()
                    .owner(harpreet)
                    .type("HARVESTER")
                    .brandModel("Kartar 4000")
                    .regNumber("UP-17-LM-1234")
                    .costPerHour(1400.0)
                    .acresPerHour(2.2)
                    .description("Heavy-duty multi-crop combine harvester")
                    .currentVillage(rajpur)
                    .status("AVAILABLE")
                    .build());

            System.out.println("Seeded database successfully with Villages, Roads, Users, and Equipment.");
        };
    }
}
