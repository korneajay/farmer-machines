package com.formermachines.controller;

import com.formermachines.model.*;
import com.formermachines.repository.*;
import com.formermachines.FormerMachinesApplication.PathfindingService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ApiController {

    private final VillageRepository villageRepository;
    private final RoadRepository roadRepository;
    private final UserRepository userRepository;
    private final EquipmentRepository equipmentRepository;
    private final BookingRepository bookingRepository;
    private final PathfindingService pathfindingService;

    public ApiController(VillageRepository villageRepository,
                         RoadRepository roadRepository,
                         UserRepository userRepository,
                         EquipmentRepository equipmentRepository,
                         BookingRepository bookingRepository,
                         PathfindingService pathfindingService) {
        this.villageRepository = villageRepository;
        this.roadRepository = roadRepository;
        this.userRepository = userRepository;
        this.equipmentRepository = equipmentRepository;
        this.bookingRepository = bookingRepository;
        this.pathfindingService = pathfindingService;
    }

    // 1. Villages
    @GetMapping("/villages")
    public List<Village> getAllVillages() {
        return villageRepository.findAll();
    }

    // 2. Roads
    @GetMapping("/roads")
    public List<Road> getAllRoads() {
        return roadRepository.findAll();
    }

    // 3. Users
    @GetMapping("/users")
    public List<User> getUsers(@RequestParam(required = false) String role) {
        if (role != null) {
            return userRepository.findAll().stream()
                    .filter(u -> u.getRole().equalsIgnoreCase(role))
                    .toList();
        }
        return userRepository.findAll();
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/users/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String phone = payload.get("phone");
        if (phone == null || phone.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Phone number is required"));
        }
        Optional<User> userOpt = userRepository.findByPhone(phone);
        if (userOpt.isPresent()) {
            return ResponseEntity.ok(userOpt.get());
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
    }

    @PostMapping("/users/register")
    public ResponseEntity<?> register(@RequestBody Map<String, Object> payload) {
        String phone = (String) payload.get("phone");
        String name = (String) payload.get("name");
        String role = (String) payload.get("role");
        String aadhaar = (String) payload.get("aadhaar");
        String drivingLicense = (String) payload.get("drivingLicense");
        Number villageIdNum = (Number) payload.get("currentVillageId");

        if (phone == null || name == null || role == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Phone, Name and Role are required"));
        }

        Village village = null;
        if (villageIdNum != null) {
            village = villageRepository.findById(villageIdNum.longValue()).orElse(null);
        }

        User user = User.builder()
                .phone(phone)
                .name(name)
                .role(role.toUpperCase())
                .aadhaar(aadhaar)
                .drivingLicense(drivingLicense)
                .currentVillage(village)
                .isAvailable(role.equalsIgnoreCase("OWNER"))
                .build();

        try {
            User saved = userRepository.save(user);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Phone number already registered"));
        }
    }

    @PutMapping("/users/{id}/availability")
    public ResponseEntity<?> toggleAvailability(@PathVariable Long id, @RequestBody Map<String, Boolean> payload) {
        return userRepository.findById(id).map(user -> {
            Boolean available = payload.get("isAvailable");
            if (available != null) {
                user.setIsAvailable(available);
                userRepository.save(user);
            }
            return ResponseEntity.ok(user);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/users/{id}/location")
    public ResponseEntity<?> updateLocation(@PathVariable Long id, @RequestBody Map<String, Long> payload) {
        return userRepository.findById(id).map(user -> {
            Long villageId = payload.get("villageId");
            if (villageId != null) {
                Village village = villageRepository.findById(villageId).orElse(null);
                if (village != null) {
                    user.setCurrentVillage(village);
                    userRepository.save(user);
                    
                    // Also update location of owner's equipment if applicable
                    List<Equipment> equipments = equipmentRepository.findByOwner(user);
                    for (Equipment eq : equipments) {
                        eq.setCurrentVillage(village);
                        equipmentRepository.save(eq);
                    }
                }
            }
            return ResponseEntity.ok(user);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        return userRepository.findById(id).map(user -> {
            if (payload.containsKey("name")) user.setName((String) payload.get("name"));
            if (payload.containsKey("phone")) user.setPhone((String) payload.get("phone"));
            if (payload.containsKey("role")) user.setRole(((String) payload.get("role")).toUpperCase());
            if (payload.containsKey("aadhaar")) user.setAadhaar((String) payload.get("aadhaar"));
            if (payload.containsKey("drivingLicense")) user.setDrivingLicense((String) payload.get("drivingLicense"));
            if (payload.containsKey("isAvailable")) user.setIsAvailable((Boolean) payload.get("isAvailable"));
            if (payload.containsKey("currentVillageId")) {
                Number vId = (Number) payload.get("currentVillageId");
                if (vId != null) {
                    villageRepository.findById(vId.longValue()).ifPresent(user::setCurrentVillage);
                }
            }
            try {
                return ResponseEntity.ok(userRepository.save(user));
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Phone number already in use"));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        return userRepository.findById(id).map(user -> {
            // Cannot delete admin
            if ("ADMIN".equalsIgnoreCase(user.getRole())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Cannot delete admin account"));
            }
            try {
                // Cascade delete associated records
                List<Booking> farmerBookings = bookingRepository.findByFarmer(user);
                bookingRepository.deleteAll(farmerBookings);

                List<Booking> ownerBookings = bookingRepository.findByEquipmentOwner(user);
                bookingRepository.deleteAll(ownerBookings);

                List<Equipment> equipments = equipmentRepository.findByOwner(user);
                equipmentRepository.deleteAll(equipments);

                userRepository.deleteById(id);
                return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
            } catch (Exception e) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("error", "Cannot delete user. Error: " + e.getMessage()));
            }
        }).orElse(ResponseEntity.notFound().build());
    }

    // 4. Equipment
    @GetMapping("/equipment")
    public List<Equipment> getAllEquipment(@RequestParam(required = false) String type,
                                           @RequestParam(required = false) String status) {
        if (type != null && status != null) {
            return equipmentRepository.findByTypeAndStatus(type.toUpperCase(), status.toUpperCase());
        }
        return equipmentRepository.findAll();
    }

    @PostMapping("/equipment")
    public ResponseEntity<?> registerEquipment(@RequestBody Map<String, Object> payload) {
        Number ownerIdNum = (Number) payload.get("ownerId");
        String type = (String) payload.get("type");
        String brandModel = (String) payload.get("brandModel");
        String regNumber = (String) payload.get("regNumber");
        Number costPerHourNum = (Number) payload.get("costPerHour");
        Number acresPerHourNum = (Number) payload.get("acresPerHour");
        String description = (String) payload.get("description");
        Number villageIdNum = (Number) payload.get("currentVillageId");

        if (ownerIdNum == null || type == null || brandModel == null || regNumber == null || costPerHourNum == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "OwnerId, Type, BrandModel, RegNumber and CostPerHour are required"));
        }

        User owner = userRepository.findById(ownerIdNum.longValue()).orElse(null);
        if (owner == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid owner ID"));
        }

        Village village = null;
        if (villageIdNum != null) {
            village = villageRepository.findById(villageIdNum.longValue()).orElse(null);
        } else {
            village = owner.getCurrentVillage();
        }

        Equipment equipment = Equipment.builder()
                .owner(owner)
                .type(type.toUpperCase())
                .brandModel(brandModel)
                .regNumber(regNumber)
                .costPerHour(costPerHourNum.doubleValue())
                .acresPerHour(acresPerHourNum != null ? acresPerHourNum.doubleValue() : 1.0)
                .description(description)
                .currentVillage(village)
                .status("AVAILABLE")
                .build();

        Equipment saved = equipmentRepository.save(equipment);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/equipment/{id}/status")
    public ResponseEntity<?> updateEquipmentStatus(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        return equipmentRepository.findById(id).map(eq -> {
            String status = payload.get("status");
            if (status != null) {
                eq.setStatus(status.toUpperCase());
                equipmentRepository.save(eq);
            }
            return ResponseEntity.ok(eq);
        }).orElse(ResponseEntity.notFound().build());
    }

    // 5. Bookings
    @GetMapping("/bookings")
    public List<Booking> getBookings(@RequestParam(required = false) Long farmerId,
                                     @RequestParam(required = false) Long ownerId) {
        if (farmerId != null) {
            return userRepository.findById(farmerId)
                    .map(bookingRepository::findByFarmer)
                    .orElse(Collections.emptyList());
        }
        if (ownerId != null) {
            return userRepository.findById(ownerId)
                    .map(bookingRepository::findByEquipmentOwner)
                    .orElse(Collections.emptyList());
        }
        return bookingRepository.findAll();
    }

    @PostMapping("/bookings")
    public ResponseEntity<?> createBooking(@RequestBody Map<String, Object> payload) {
        Number farmerIdNum = (Number) payload.get("farmerId");
        Number equipmentIdNum = (Number) payload.get("equipmentId");
        Number hoursNum = (Number) payload.get("hours");
        String cropType = (String) payload.get("cropType");
        String fieldAddress = (String) payload.get("fieldAddress");

        if (farmerIdNum == null || equipmentIdNum == null || hoursNum == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "FarmerId, EquipmentId and Hours are required"));
        }

        User farmer = userRepository.findById(farmerIdNum.longValue()).orElse(null);
        Equipment equipment = equipmentRepository.findById(equipmentIdNum.longValue()).orElse(null);

        if (farmer == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid Farmer ID"));
        }
        if (equipment == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid Equipment ID"));
        }
        if (!"AVAILABLE".equalsIgnoreCase(equipment.getStatus())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Equipment is not available for booking"));
        }

        int hours = hoursNum.intValue();
        double totalCost = hours * equipment.getCostPerHour();
        
        // Generate a simple 4-digit OTP
        String otpCode = String.format("%04d", new Random().nextInt(10000));

        Booking booking = Booking.builder()
                .farmer(farmer)
                .equipment(equipment)
                .hours(hours)
                .cropType(cropType != null ? cropType : "Other")
                .fieldAddress(fieldAddress != null ? fieldAddress : "Field near village")
                .status("PENDING")
                .otpCode(otpCode)
                .totalCost(totalCost)
                .requestDate(LocalDateTime.now())
                .build();

        Booking saved = bookingRepository.save(booking);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/bookings/{id}/status")
    public ResponseEntity<?> updateBookingStatus(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        return bookingRepository.findById(id).map(booking -> {
            String newStatus = payload.get("status");
            String clientOtp = payload.get("otp");
            
            if (newStatus == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Status is required"));
            }
            
            newStatus = newStatus.toUpperCase();

            // OTP Validation when starting work (IN_PROGRESS)
            if ("IN_PROGRESS".equals(newStatus)) {
                if (clientOtp == null || clientOtp.trim().isEmpty()) {
                    return ResponseEntity.badRequest().body(Map.of("error", "OTP is required to start work"));
                }
                if (!clientOtp.equals(booking.getOtpCode())) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Invalid OTP code"));
                }
            }

            booking.setStatus(newStatus);
            bookingRepository.save(booking);

            // Cascade status changes to the underlying equipment
            Equipment equipment = booking.getEquipment();
            if ("IN_PROGRESS".equals(newStatus)) {
                equipment.setStatus("BUSY");
                equipmentRepository.save(equipment);
            } else if ("COMPLETED".equals(newStatus) || "CANCELLED".equals(newStatus)) {
                equipment.setStatus("AVAILABLE");
                
                // If completed, update owner's village location to farmer's/booking village location
                // for realistic simulation (the machinery moved to the farmer's village!)
                if ("COMPLETED".equals(newStatus)) {
                    Village farmerVillage = booking.getFarmer().getCurrentVillage();
                    if (farmerVillage != null) {
                        equipment.setCurrentVillage(farmerVillage);
                        equipmentRepository.save(equipment);
                        
                        User owner = equipment.getOwner();
                        owner.setCurrentVillage(farmerVillage);
                        userRepository.save(owner);
                    }
                }
                equipmentRepository.save(equipment);
            }

            return ResponseEntity.ok(booking);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/bookings/{id}/rate")
    public ResponseEntity<?> rateBooking(@PathVariable Long id, @RequestBody Map<String, Integer> payload) {
        return bookingRepository.findById(id).map(booking -> {
            Integer rating = payload.get("rating");
            if (rating != null && rating >= 1 && rating <= 5) {
                booking.setRating(rating);
                bookingRepository.save(booking);
                return ResponseEntity.ok(booking);
            }
            return ResponseEntity.badRequest().body(Map.of("error", "Rating must be between 1 and 5"));
        }).orElse(ResponseEntity.notFound().build());
    }

    // 6. Pathfinding
    @GetMapping("/path")
    public ResponseEntity<?> getShortestPath(@RequestParam String start, @RequestParam String end) {
        try {
            PathfindingService.PathResult result = pathfindingService.getShortestPath(start, end);
            if (result.getDistance() == Double.MAX_VALUE) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "No route found between " + start + " and " + end));
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error in pathfinding calculations: " + e.getMessage()));
        }
    }
}
