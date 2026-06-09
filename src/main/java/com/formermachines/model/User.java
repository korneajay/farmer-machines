package com.formermachines.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String phone;

    private String name;
    private String role; // "FARMER", "OWNER", or "ADMIN"
    private String aadhaar;
    private String drivingLicense;
    
    @Builder.Default
    private Boolean isAvailable = false; // "like Rapido driver" for owners

    @ManyToOne
    @JoinColumn(name = "village_id")
    private Village currentVillage;
}
