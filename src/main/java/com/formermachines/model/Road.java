package com.formermachines.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "roads")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Road {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String u; // start village name
    private String v; // end village name
    private Double distance; // weight in km
}
