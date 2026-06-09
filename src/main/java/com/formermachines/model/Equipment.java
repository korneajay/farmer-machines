package com.formermachines.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "equipments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Equipment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    private String type; // "TRACTOR", "HARVESTER", "ROTAVATOR"
    private String brandModel;
    private String regNumber;
    private Double costPerHour;
    private Double acresPerHour;
    private String description;
    
    @Builder.Default
    private String status = "AVAILABLE"; // "AVAILABLE", "BUSY", "OFFLINE"

    @ManyToOne
    @JoinColumn(name = "current_village_id")
    private Village currentVillage;
}
