package com.formermachines.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bookings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "farmer_id", nullable = false)
    private User farmer;

    @ManyToOne
    @JoinColumn(name = "equipment_id", nullable = false)
    private Equipment equipment;

    private Integer hours;
    private String cropType;
    private String fieldAddress;
    private String status; // "PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"
    private String otpCode;
    private Integer rating; // 1 to 5
    private Double totalCost;
    
    @Builder.Default
    private LocalDateTime requestDate = LocalDateTime.now();
}
